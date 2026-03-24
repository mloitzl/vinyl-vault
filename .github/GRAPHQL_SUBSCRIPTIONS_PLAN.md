# Architecture Plan: GraphQL Subscriptions in Relay (Vinyl Vault)

> **Status**: Analysis complete — implementation not started.
> **Decision needed**: Whether to proceed and when.

---

## 1. Current State (post Relay migration)

Zero subscription infrastructure at every layer:

| Layer | Status | Gap |
|---|---|---|
| Relay `Environment` | `Network.create(fetchFn)` only | No `subscribeFunction` |
| BFF Apollo Server | `expressMiddleware()` HTTP only | No WebSocket upgrade handler |
| Backend Apollo Server | `expressMiddleware()` HTTP only | No WebSocket server |
| BFF Schema Stitching | `buildHTTPExecutor` HTTP only | Cannot forward subscriptions |
| Backend SDL | No `type Subscription` | Zero subscription types |
| Frontend deps | No `graphql-ws` | No WebSocket client |
| BFF/Backend deps | No `graphql-ws`, no `ws` | No WebSocket server |
| K8s BFF Service | `sessionAffinity: ClientIP` ✅ | Already sticky |
| K8s Backend Service | No session affinity ❌ | Not sticky |
| Dev Nginx | `Upgrade`/`Connection` headers ✅ | Already WebSocket-ready |

**Current workaround**: `useNotificationCount` polls every 30 s; when count increases,
`SocialPage` reloads via `loadQuery({ fetchPolicy: 'network-only' })`.

---

## 2. What "Relay-idiomatic subscriptions" means

Relay treats subscriptions as first-class citizens. The same store directives that
mutations use (`@appendNode`, `@deleteEdge`, custom `updater`) work identically for
subscriptions — the Relay migration already done makes the frontend side cheap.

```ts
// Define the subscription with graphql tag (compiled by Relay compiler)
const Sub = graphql`
  subscription useFriendRequestSubscription($connections: [ID!]!) {
    friendRequestReceived {
      friendRequest @appendNode(connections: $connections, edgeTypeName: "FriendRequestEdge") {
        id
        createdAt
        requester { id githubLogin displayName avatarUrl }
      }
      notificationCount
    }
  }
`;

// Call it from a component — Relay updates the store automatically
requestSubscription(environment, {
  subscription: Sub,
  variables: { connections: [ConnectionHandler.getConnectionID(ROOT_ID, 'SocialPage_pendingFriendRequests')] },
  updater: (store) => {
    const payload = store.getRootField('friendRequestReceived');
    const newCount = payload?.getValue('notificationCount');
    if (newCount !== null && newCount !== undefined) {
      store.getRoot().setValue(newCount, 'notificationCount');
    }
  },
});
```

The `subscribeFunction` in the Relay `Environment` replaces the polling:

```ts
// packages/frontend/src/relay/environment.ts
import { createClient } from 'graphql-ws';

const wsClient = createClient({
  url: `${window.location.origin.replace(/^http/, 'ws')}/graphql`,
  connectionParams: () => ({ token: getJwtFromStore() }), // see auth note below
  shouldRetry: () => true, // auto-reconnect on pod restart
});

export const RelayEnvironment = new Environment({
  network: Network.create(
    fetchGraphQL,  // queries + mutations — unchanged
    (request, variables, _cache, sink) => ({
      dispose: wsClient.subscribe({ query: request.text!, variables }, sink),
    }),
  ),
  store: new Store(new RecordSource()),
});
```

---

## 3. Key Architectural Decision: Where Do Subscriptions Live?

### Option A — BFF owns subscriptions via MongoDB Change Streams ✅ RECOMMENDED

```
Browser ──── WebSocket ──── BFF ──── MongoDB Change Stream (registry db)
                              └─── (backend stays HTTP-only)
```

**Why this is correct:**
- BFF already has auth context (session + JWT) and already intercepts social mutations
- `MONGODB_URI` in BFF already connects to the registry DB (`vinylvault_registry`) ✅
- MongoDB replica sets now available on Atlas and local docker ✅ — Change Streams require RS
- No dual-transport executor needed — schema stitching unchanged
- Consistent with BFF responsibility model (session, auth, social coordination)
- Change Stream watches `friend_requests` collection for `insert` operations where
  `recipientId = context.userId`, then pushes to the subscriber

### Option B — Backend owns subscriptions, BFF proxies ❌ AVOID

```
Browser ──── WebSocket ──── BFF ──── WebSocket ──── Backend
                              └─── @graphql-tools/executor-ws (dual-transport)
```

- Requires a dual-transport executor in BFF: HTTP for queries/mutations, WebSocket for subscriptions
- Backend K8s service needs session affinity added (currently missing)
- Significantly more complex for no architectural benefit

---

## 4. Full Change Surface (Option A)

### `packages/backend` — **unchanged**

No changes. Backend stays HTTP-only forever.

---

### `packages/bff` — 4 areas

#### 4a. New dependencies

```json
"graphql-ws": "^5.16.0",
"ws": "^8.18.0"
```

#### 4b. Explicit HTTP server + WebSocket server (`src/index.ts`)

Replace `app.listen(config.port)` with:

```ts
import http from 'http';
import { WebSocketServer } from 'ws';
import { useServer } from 'graphql-ws/lib/use/ws';

// After apolloServer.start() and app.use('/graphql', ...) setup:
const httpServer = http.createServer(app);
const wsServer = new WebSocketServer({ server: httpServer, path: '/graphql' });

useServer(
  {
    schema,
    context: async (ctx) => {
      // Extract JWT from connectionParams (not cookies — see auth note)
      const token = ctx.connectionParams?.token as string | undefined;
      if (!token) throw new Error('Unauthenticated');
      const userId = verifyJwt(token).sub;
      return { userId, db: null }; // same shape as HTTP GraphQLContext
    },
    onDisconnect: async (_ctx, _code, _reason) => {
      // Change Streams are cleaned up by the async generator's return path
    },
  },
  wsServer,
);

httpServer.listen(config.port, () => {
  logger.info(`BFF ready on port ${config.port} (HTTP + WebSocket)`);
});
```

#### 4c. Schema additions (`src/schema.graphql`)

```graphql
type FriendRequestReceivedPayload {
  friendRequest: FriendRequest!
  notificationCount: Int!
}

type Subscription {
  friendRequestReceived: FriendRequestReceivedPayload!
}
```

#### 4d. Subscription resolver + MongoDB Change Stream

```ts
// New file: packages/bff/src/services/subscriptions.ts
import type { ChangeStreamDocument } from 'mongodb';
import { getRegistryDb } from './db.js';

export async function* watchIncomingFriendRequests(recipientId: string) {
  const db = await getRegistryDb();
  const collection = db.collection('friend_requests');

  const pipeline = [
    { $match: { operationType: 'insert', 'fullDocument.recipientId': recipientId } },
  ];

  const stream = collection.watch(pipeline, { fullDocument: 'updateLookup' });

  try {
    for await (const change of stream as AsyncIterable<ChangeStreamDocument>) {
      if (change.operationType === 'insert' && change.fullDocument) {
        yield change.fullDocument;
      }
    }
  } finally {
    await stream.close();
  }
}

// In resolvers.ts:
Subscription: {
  friendRequestReceived: {
    subscribe: async function* (_root, _args, context: GraphQLContext) {
      if (!context.userId) throw new GraphQLError('Not authenticated');
      const pendingCount = await getPendingRequests(context.userId);
      for await (const doc of watchIncomingFriendRequests(context.userId)) {
        const requester = await findUserById(doc.requesterId);
        yield {
          friendRequestReceived: {
            friendRequest: { ...doc, id: doc._id.toString() },
            notificationCount: pendingCount.length + 1, // approximate; or re-query
          },
        };
      }
    },
  },
}
```

---

### `packages/frontend` — 3 areas

#### 5a. New dependency

```json
"graphql-ws": "^5.16.0"
```

#### 5b. Relay Environment (`src/relay/environment.ts`)

Add `subscribeFunction` as second argument to `Network.create()`:

```ts
import { createClient } from 'graphql-ws';

const wsClient = createClient({
  url: `${window.location.origin.replace(/^http/, 'ws')}/graphql`,
  connectionParams: () => {
    // Read JWT from Relay store or session storage — populated after login
    const token = sessionStorage.getItem('vv_jwt') ?? '';
    return { token };
  },
  shouldRetry: () => true,
});

export const RelayEnvironment = new Environment({
  network: Network.create(
    fetchGraphQL,
    (request, variables, _cache, sink) => ({
      dispose: wsClient.subscribe({ query: request.text!, variables }, sink),
    }),
  ),
  store: new Store(new RecordSource()),
});
```

#### 5c. New subscription hook (`src/hooks/relay/useFriendRequestSubscription.ts`)

```ts
import { useEffect } from 'react';
import { requestSubscription, graphql, ConnectionHandler } from 'react-relay';
import { ROOT_ID } from 'relay-runtime';
import { useRelayEnvironment } from 'react-relay';

const FriendRequestSubscription = graphql`
  subscription useFriendRequestSubscription($connections: [ID!]!) {
    friendRequestReceived {
      friendRequest @appendNode(connections: $connections, edgeTypeName: "FriendRequestEdge") {
        id
        createdAt
        requester { id githubLogin displayName avatarUrl }
      }
      notificationCount
    }
  }
`;

export function useFriendRequestSubscription() {
  const environment = useRelayEnvironment();

  useEffect(() => {
    const pendingConnectionId = ConnectionHandler.getConnectionID(
      ROOT_ID,
      'SocialPage_pendingFriendRequests',
    );

    const { dispose } = requestSubscription(environment, {
      subscription: FriendRequestSubscription,
      variables: { connections: [pendingConnectionId] },
      updater: (store) => {
        const payload = store.getRootField('friendRequestReceived');
        const newCount = payload?.getValue('notificationCount');
        if (newCount !== null && newCount !== undefined) {
          store.getRoot().setValue(newCount, 'notificationCount');
        }
      },
    });

    return dispose;
  }, [environment]);
}
```

Call this hook from `SocialPageContent` to replace polling.

Also remove the 30 s `setInterval` from `useNotificationCount` (and the
`vinyl-vault:notifications-changed` reload logic in `SocialPage`) once subscriptions
are active.

---

### `packages/demo-server` — **1 line**

```ts
// packages/demo-server/src/index.ts
createProxyMiddleware({
  target: 'http://localhost:3001',
  ws: true,            // ← the only demo-server change
  changeOrigin: true,
  pathFilter: ['/graphql', '/auth', '/webhook'],
})
```

`http-proxy-middleware` forwards the HTTP Upgrade handshake to BFF on localhost
automatically. Because BFF and demo-server run on the same machine (fork'd child
process), there are no sticky-session concerns.

---

### `infra/k8s` — 1 small change (precaution)

Add `sessionAffinity: ClientIP` to `packages/backend`'s K8s Service (currently
missing). Not strictly needed for subscriptions (backend stays HTTP-only) but good
hygiene if subscriptions ever migrate there.

---

## 5. Deployment Comparison

| | Koyeb (demo-server) | Kubernetes (staging/prod) |
|---|---|---|
| WebSocket routing | `ws: true` in proxy (1 line) | Traefik supports ws natively — no annotation needed |
| Sticky sessions | N/A — single machine | BFF already has `sessionAffinity: ClientIP` ✅ |
| Backend affinity | N/A | Add `sessionAffinity` (precaution) |
| Multi-pod reconnect | N/A | `graphql-ws` `shouldRetry` handles it |
| Memory per connection | ~50–100 KB; negligible for demo | Same |
| Auth via cookie | ✅ cookie sent with ws upgrade | ✅ same |

---

## 6. Auth Note: Cookies vs connectionParams

Session cookies scoped to `.loitzl.com` **are** sent with the WebSocket upgrade
handshake (same-origin rules apply to ws:// the same way as https://). So cookie
auth works today without changes.

However, `connectionParams: { token: jwt }` is the more robust pattern because:
- Some ws client environments don't send cookies by default
- JWT validation in `useServer` context is simpler than session store lookup
- Keeps subscription auth stateless (no session dependency)

The JWT is already available in the BFF session — it just needs to be exposed to the
frontend (e.g., via `/auth/me` response or a short-lived `sessionStorage` entry set
after login).

---

## 7. Risk Register

| Risk | Likelihood | Mitigation |
|---|---|---|
| Change Stream cleanup on disconnect | Medium | Async generator's `finally` block closes the stream; `useServer` `onDisconnect` as safety net |
| WebSocket auth fails silently | Low | `useServer` throws on missing token; client receives `4401` close code |
| Pod crash during active subscription | Low | `graphql-ws` client retries automatically; Relay re-subscribes on reconnect |
| MongoDB Atlas Change Stream quota | Low | Atlas free tier allows Change Streams; each subscription = 1 open cursor |
| Koyeb `NODE_OPTIONS="--max-old-space-size=200"` OOM | Very low | `graphql-ws` connection ≈ 50–100 KB; negligible for a demo |

---

## 8. Polling → Subscriptions Migration

Once subscriptions are live, remove:
- `setInterval(fetchCount, 30_000)` in `useNotificationCount`
- `window.addEventListener('vinyl-vault:notifications-changed', () => reload())` in `SocialPage`
- Count-increase dispatch in `useNotificationCount.fetchCount`

Replace with:
- `useFriendRequestSubscription()` called from `SocialPageContent`
- Relay store `updater` updates `notificationCount` on root (badge re-renders automatically)

---

## 9. Summary Table

| Package | Lines changed (approx.) | Risk |
|---|---|---|
| `packages/bff` | ~120 (new deps, ws server, schema, resolver, service) | Medium |
| `packages/frontend` | ~50 (env, new hook, remove polling) | Low |
| `packages/demo-server` | 1 | Very low |
| `packages/backend` | 0 | — |
| `infra/k8s` | ~5 | Very low |
