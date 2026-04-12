# Vinyl Vault – Tech Stack

## 1. Overview

This document summarizes the technology choices for Vinyl Vault across frontend, backend, data, integration, and infrastructure. It is meant to guide implementation and onboarding.

**Monorepo Structure:** pnpm workspaces with four packages:
- `packages/frontend` - React SPA
- `packages/bff` - Backend-for-Frontend
- `packages/backend` - Domain Backend
- `packages/demo-server` - Koyeb demo orchestrator

## 2. Frontend (`packages/frontend`)

- **Language:** TypeScript (strict mode)
- **UI Library:** React 18
- **Data Layer:** Relay (React Relay)
- **Build Tooling:** Vite 5
- **Styling:** Tailwind CSS
- **Dev Server:** Port 3000 with proxy to BFF

**Key Dependencies:**
- `react`, `react-dom` - UI framework
- `react-relay` - GraphQL client with `@connection`, `usePaginationFragment`, `@deleteEdge`/`@appendNode` for store updates
- `tailwindcss` - Utility-first CSS
- `vite` - Build tool and dev server (with `relayRequireToImport()` plugin for ESM compatibility)
- `@zxing/browser` - Barcode scanning via camera

**Responsibilities:**

- Accept web requests from browser clients (GraphQL queries/mutations + session cookies).
- Display and manage vinyl record collections with cursor-based pagination (`usePaginationFragment`, "Load More") and instant store updates (`@deleteEdge`/`@appendNode`).
- Browse artists, albums, and genres via the `/browse` route (Artists/Albums/Genres tabs).
- Provide barcode scanning via camera or manual input for album lookup.
- Enable complete CRUD operations: Create (scan), Read (list/detail), Update (edit modal), Delete (confirmation).
- Show collection statistics with lightweight `AppCountsQuery` (`records(first:1) { totalCount }`, `artists(first:1) { totalCount }`).
- Display toast notifications for user action feedback (success/error states) with auto-dismiss.
- Implement RecordEditModal with form validation, ESC/backdrop close, and optimistic UI updates.
- Proxy all GraphQL queries/mutations to the backend GraphQL endpoint with JWT authorization header.
- Manage HTTP session lifecycle and authentication via GitHub OAuth.
- Guide GitHub App installation flow via `/auth/setup` to onboard organization tenants (no automatic org sync on login).
- Create and sign JWT tokens containing user ID, username, avatar, current tenantId, and tenantRole.
- Track active tenant selection in session and populate JWT accordingly.
- Expose `/auth/me` REST endpoint for client-side authentication state.
- Serve as security boundary: no direct backend access from browser.
- Provide tenant switching mutations (switchToPersonalTenant, switchToOrganizationTenant).
- Query registry database for user-tenant-role mappings during authentication and tenant switching.

## 3. Backend-for-Frontend (BFF) (`packages/bff`)

- **Runtime:** Node.js (LTS)
- **Language:** TypeScript (strict mode)
- **Web Framework:** Express 4
- **GraphQL:** Apollo Server 4 with `expressMiddleware`
- **Session Store:** `connect-mongo` 5.x (MongoDB-backed sessions)
- **Dev Server:** Port 3001

**Key Dependencies:**
- `express` - Web framework
- `@apollo/server` - GraphQL server
- `express-session` - Session middleware
- `connect-mongo` - MongoDB session store
- `jsonwebtoken` - JWT signing/verification
- `dotenv` - Environment variable loading
- `@graphql-tools/stitch` - Schema stitching
- `@graphql-tools/schema` - Schema utilities
- `@graphql-tools/executor-http` - HTTP executor for forwarding requests
- `@graphql-tools/wrap` - Schema wrapping

**Auth Endpoints:**
- `GET /auth/github` - Initiate OAuth flow
- `GET /auth/github/callback` - Handle OAuth callback
- `POST /auth/logout` - Destroy session
- `GET /auth/me` - Get current user

**Responsibilities:**

- Expose a Relay-friendly GraphQL schema via **schema stitching** (`@graphql-tools/stitch`): BFF's own `schema.graphql` contains only auth/session types; Backend types are proxied automatically.
- Handle GitHub OAuth Web Application Flow.
- Inject JWT into forwarded requests via `buildHTTPExecutor` (`packages/bff/src/graphql/executor.ts`).
- Maintain sessions via HTTP-only cookies and BFF MongoDB session store.
- Create and sign short-lived JWTs for calls to the domain backend.

**Important:** The BFF does NOT write directly to the Backend MongoDB. User data is stored exclusively in the Backend. The BFF MongoDB is used only for session storage.

## 4. Domain Backend (`packages/backend`)

- **Runtime:** Node.js (LTS)
- **Language:** TypeScript (strict mode)
- **GraphQL:** Apollo Server 4 (standalone)
- **DB Client:** Official MongoDB Node.js driver 6.x
- **Dev Server:** Port 4000

**Key Dependencies:**
- `@apollo/server` - GraphQL server
- `mongodb` - Database driver
- `jsonwebtoken` - JWT verification
- `typesense` - Typesense client (search adapter + sync worker)

**Search Services (`src/services/`):**
- `typesense.ts` - Typesense client singleton, collection schema, upsert/delete/two-step search
- `typesense-query.ts` - Query builder: user query string → Typesense `SearchParams` (phrase, must, mustNot, facets)
- `typesense-highlights.ts` - Maps Typesense `<mark>` snippets to `SearchHighlight[]` GraphQL type

**Sync Worker (`src/sync-worker/`):**
- `index.ts` - Entry point; startup sequence and graceful shutdown
- `change-stream-listener.ts` - Single `client.watch()` on all `vv_*` namespaces; real-time MongoDB→Typesense sync
- `initial-sync.ts` - Full bulk-upsert on first start (batches of 500)
- `token-store.ts` - Resume token persistence in registry DB `sync_state` collection

Run locally with: `pnpm --filter @vinylvault/backend sync-worker`

**Responsibilities:**

- Expose domain-centric GraphQL schema (User, Record, Release, Album, Tenant, Artist, Album browse, Genre).
- Implement tenant-scoped business logic and data access.
- Manage complete record lifecycle (create, read, update, delete) with ownership validation and role-based authorization.
- Implement repository pattern for clean data access (RecordRepository with CRUD methods, ReleaseRepository with caching).
- Provide cursor-based pagination for Relay compatibility with text search and filtering.
- Support text search on records (notes, condition, location) and exact match filtering (location).
- Handle composite release IDs (SOURCE‡externalId) and MongoDB ObjectId formats.
- Validate and decode JWTs from the BFF, extracting tenantId and tenantRole.
- Dynamically connect to tenant-specific MongoDB databases (`vv_<12-char-SHA256-hash-of-tenantId>`, e.g., `vv_a1b2c3d4e5f6`).
- Enforce tenant isolation at database level - all queries execute against tenant database.
- Initialize MongoDB indexes automatically on first tenant database access.
- Implement role-based authorization (admin, member, viewer) for tenant operations.
- Integrate with external music APIs (Discogs/MusicBrainz) queried in parallel.
- Normalize, score, and aggregate releases into Album objects using per-tenant scoring configuration.
- Maintain per-tenant cached releases in tenant MongoDB database.
- Provide detailed score breakdowns for traceability (QR-02).
- Query registry database for tenant metadata and user-tenant-role relationships.

**External API Services (`src/services/`):**
- `discogs.ts` - Discogs API integration (search by barcode, fetch release details)
- `musicbrainz.ts` - MusicBrainz API integration (search by barcode, fetch release details with tracks)
- `releasesCache.ts` - MongoDB caching layer for releases
- `users.ts` - User CRUD operations

**Scoring Module (`src/services/scoring/`):**
- `types.ts` - TypeScript interfaces for the scoring system
- `config.ts` - Configuration loader with defaults
- `normalize.ts` - Text normalization and release grouping
- `score.ts` - Release scoring logic
- `aggregate.ts` - Album aggregation from grouped releases
- `orchestrator.ts` - Main orchestrator (parallel API queries, full pipeline)

**Scoring Configuration (`config/scoring.json`):**
- Configurable weights for media type, country, track list, cover art, label, catalog number
- Preferred countries: US, UK, AT, DE (with variants)
- Deprioritized countries: RU, CN
- Preferred media types: vinyl, lp, 12", 10", 7", album
- Discogs source bonus: +5 points
- Tie-breaker: earliest release year
- Normalization affixes: remastered, deluxe, special edition, etc.

## 5. Database

- **DBMS:** MongoDB 8 (replica set required for change streams)
- **Docker:** Configured in `infra/docker-compose.yml`
- **Architecture:** Multi-tenant database-per-tenant with central registry
- **Connection:** 
  - `MONGODB_URI_BASE` - Base connection string for dynamic tenant databases (e.g., `mongodb://localhost:27017`)
  - `MONGODB_REGISTRY_URI` - Connection string for central registry database (e.g., `mongodb://localhost:27017/vinylvault_registry`)
  - BFF uses `MONGODB_URI` for session storage (e.g., `mongodb://localhost:27017/vinylvault_bff`)

**Registry Database (`vinylvault_registry`):**
- `sessions` - Session data (managed automatically by connect-mongo)
- `users` - Global user records with GitHub profile information
- `tenants` - Tenant records (personal and organization)
- `user_tenant_roles` - Mapping of users to tenants with roles (admin, member, viewer)

**Tenant Databases (`vv_<12-char-SHA256-hash-of-tenantId>`, e.g., `vv_a1b2c3d4e5f6`):**
- `records` - Physical owned items for this tenant (includes denormalized release fields for search)
- `releases` - Cached external metadata for this tenant
- `scoring_configs` - Custom scoring configuration for this tenant (optional override)

**Registry Database — additional collections:**
- `sync_state` - Typesense change-stream resume token (managed by sync worker)

**Important:** The multi-tenant architecture uses:
- **Registry database:** Central user-tenant-role mappings and session storage
- **Tenant databases:** Per-tenant data isolation with separate MongoDB databases
- **BFF:** Connects to registry database for sessions and tenant lookups
- **Backend:** Dynamically connects to tenant databases based on JWT tenantId

**User Schema (Registry Database):**
```javascript
{
  githubId: string,      // GitHub user ID
  username: string,      // GitHub username
  displayName: string,   // Display name
  email: string | null,  // Email (if provided)
  avatarUrl: string,     // GitHub avatar URL
  createdAt: Date,
  updatedAt: Date
}
```

**Tenant Schema (Registry Database):**
```javascript
{
  _id: ObjectId,
  tenantId: string,           // Unique tenant identifier (user_{userId} or org_{orgName})
  tenantType: 'USER' | 'ORGANIZATION',
  name: string,               // Display name
  githubOrgName?: string,     // GitHub organization name (if type=ORGANIZATION)
  databaseName: string,       // MongoDB database name (e.g., vv_a1b2c3d4e5f6)
  createdAt: Date,
  updatedAt: Date
}
```

**UserTenantRole Schema (Registry Database):**
```javascript
{
  _id: ObjectId,
  userId: ObjectId,           // Reference to users collection
  tenantId: string,           // Reference to tenant
  role: 'ADMIN' | 'MEMBER' | 'VIEWER',
  createdAt: Date,
  updatedAt: Date
}
```

**Features:**
- Indexes for common queries (user+barcode, barcodes, artist/title).
- Timestamps and minimal audit fields.

## 6. External Services

**GitHub OAuth:**
- Used for login (Web Application Flow).
- Required scopes: `read:user`, `user:email`.
- **Configuration via environment variables:**
  - `GITHUB_CLIENT_ID` - OAuth App client ID
  - `GITHUB_CLIENT_SECRET` - OAuth App client secret
  - `GITHUB_CALLBACK_URL` - Callback URL (default: `http://localhost:3001/auth/github/callback`)
  - `GITHUB_CALLBACK_URLS` - Comma-separated list of allowed callback URLs (for multiple environments)
- Setup guide: `docs/GITHUB_OAUTH_SETUP.md`

**GitHub App Installation (current):**
- Active approach for organization tenant onboarding: user-driven explicit app installation.
- Users click "Add Organization" button to install Vinyl Vault on specific GitHub organizations they manage.
- GitHub validates installation permissions automatically - users cannot install on orgs they don't manage.
- Two new backend endpoints required:
  - `POST /webhook/github` - Receives GitHub `installation.created` webhook events
    - Contains: `installation_id`, `account.login` (org name), `account.type`
    - Must validate webhook signature using GitHub app secret (`X-Hub-Signature-256` header)
    - Stores installation metadata in `installations` collection
  - `GET /auth/setup?installation_id=...` - Handles post-installation GitHub redirect
    - Requires authenticated user (session cookie)
    - Links user to installation in `user_installation_roles` collection
    - Creates organization tenant for the installation
    - Adds user as ADMIN of new org tenant
- Database changes:
  - New `installations` collection in registry DB storing installation metadata
  - New `user_installation_roles` collection linking users to installations with their role
  - See Architecture.MD section 5.3 for schema details
- **Configuration via environment variables:**
  - `GITHUB_APP_ID` - GitHub App ID
  - `GITHUB_APP_PRIVATE_KEY` - GitHub App private key (PEM format)
  - `GITHUB_APP_WEBHOOK_SECRET` - Webhook signature secret for validating incoming events
  - `GITHUB_APP_INSTALLATION_URL` - URL for app installation (e.g., `https://github.com/apps/vinyl-vault/installations/new`)
- This supersedes automatic GitHub organization sync on login

**Music Metadata APIs:**
- Discogs and MusicBrainz APIs queried in parallel for barcode-based release lookup.
- Results normalized, scored, and aggregated into Album objects.
- Configuration:
  - `DISCOGS_API_TOKEN` - Discogs personal access token
  - `MUSICBRAINZ_USER_AGENT` - User agent string for MusicBrainz API requests

**MongoDB Configuration:**
- Multi-tenant database architecture with central registry and per-tenant databases.
- Configuration:
  - `MONGODB_URI_BASE` - Base connection string for dynamic tenant databases (Backend)
  - `MONGODB_REGISTRY_URI` - Connection string for central registry database (Backend)
  - `MONGODB_URI` - Connection string for BFF session storage

**TLS Certificates:**
- Let's Encrypt via Caddy reverse proxy.

## 7. Infrastructure and DevOps

Three active environments:

**Local DEV:**
- Docker Compose + MongoDB (replica set) + Typesense on localhost.
- `pnpm dev` runs all app services in parallel (Vite :3000, BFF :3001, Backend :4000).
- `pnpm --filter @vinylvault/backend sync-worker` runs the change-stream sync worker (separate terminal).

**Staging (Kubernetes):**
- Namespace `vinylvault-staging`; manifests in `infra/k8s/` (kubectl + Kustomize).
- StatefulSets for `mongodb-bff`, `mongodb-backend`, and Typesense (3-node Raft).
- Sync-worker Deployment (`replicas: 1`, `Recreate` strategy).
- Images pushed to GHCR (`ghcr.io/mloitzl/vinylvault-*:latest-staging`).
- GitHub Actions CI/CD with self-hosted runner; build/push/deploy scripts in `scripts/`.

**Demo (Koyeb):**
- `packages/demo-server` orchestrates BFF + Backend as child processes; listens on port 8080.
- Deployed via `infra/Dockerfile.demoserver`. Frontend on Vercel.
- Uses Typesense Cloud free tier for search; sync worker deployed as a separate Koyeb service.

**Infrastructure Files (`infra/`):**
- `infra/docker-compose.yml` - Local DEV service orchestration (MongoDB replica set + Typesense)
- `Caddyfile` - Reverse proxy configuration
- `Dockerfile.bff` - BFF container
- `Dockerfile.backend` - Backend container
- `Dockerfile.frontend` - Frontend container
- `Dockerfile.sync-worker` - Sync worker container (shares backend build, different entrypoint)
- `Dockerfile.demoserver` - Demo server container (Koyeb)
- `k8s/` - Kubernetes manifests (Kustomize, staging + production)

**Process Management:**
- Docker restart policies for production.
- `pnpm dev` for development (runs all services in parallel).

**Logging:**
- Application logs to stdout via **pino** (structured JSON, trace/span IDs injected via OTel mixin).
- Forwarded to **Betterstack Logs** via OpenTelemetry OTLP exporter (Authorization Bearer header).

**Monitoring:**
- **Betterstack Logs** — distributed traces, metrics, and structured log aggregation for BFF and Backend (via OTel OTLP).
- **LogRocket** — frontend session replay, JS error capture, and network request logging (`VITE_LOGROCKET_APP_ID`).

## 8. Development Environment

- **IDE:** VS Code / Cursor
- **Version Control:** Git (GitHub repository)
- **Package Manager:** pnpm (workspaces for monorepo)
- **Node Version:** LTS (see `.nvmrc`)

**Scripts (from root):**
- `pnpm dev` - Run all services in development mode
- `pnpm build` - Build all packages
- `pnpm lint` - Run ESLint across packages
- `pnpm test` - Run tests
- `pnpm update-schema` - Runs `generate-schema.mjs` to merge BFF + Backend SDL into `packages/frontend/schema.graphql`
- `pnpm relay` - Runs relay-compiler against the merged schema
- `pnpm update-schema && pnpm relay && pnpm build` - Full frontend build pipeline

**Admin Scripts (`scripts/admin/`):**
- Registered as `@vinylvault/admin-scripts` in pnpm workspace.
- Operations: `list-users`, `list-tenants`, `add-user-to-tenant`, `remove-user-from-tenant`, `remove-tenant`, `force-logout-user`, `statistics`, `migrate-cluster`.
- `backfill-search-fields.mjs` — Populates denormalized release fields on existing records across all tenant DBs; idempotent; supports `--dry-run`.
- `typesense-full-sync.mjs` — Wipes Typesense collection and re-indexes all tenants from scratch; supports `--stage DEV|STAGING|DEMO` and `--dry-run`.
- `migrate-cluster.mjs` — Copies all Vinyl Vault databases between two MongoDB clusters.
- Support `DEV`/`STAGING`/`DEMO` environments; `STAGING` auto-handles kubectl port-forward.

**Code Quality:**
- ESLint (configured in `.eslintrc.json`)
- Prettier (configured in `.prettierrc`)
- TypeScript strict mode
- Shared base config in `tsconfig.base.json`

**Environment Variables:**
- Stored in `.env` file at project root (not committed)
- Loaded via `dotenv` in BFF and Backend
- See `infra/.env.sample` for comprehensive documentation of all variables

**Key Environment Variables:**
```
# MongoDB - Multi-tenant Architecture
MONGODB_URI_BASE=mongodb://localhost:27017              # Base URI for tenant databases (Backend)
MONGODB_REGISTRY_URI=mongodb://localhost:27017/vinylvault_registry  # Registry database (Backend)
MONGODB_URI=mongodb://localhost:27017/vinylvault_bff    # BFF session storage

# Typesense (Full-Text Search)
TYPESENSE_HOST=localhost                # 'typesense' inside Docker, cluster.typesense.net for Cloud
TYPESENSE_PORT=8108                     # 443 for Typesense Cloud
TYPESENSE_PROTOCOL=http                 # 'https' for Typesense Cloud
TYPESENSE_API_KEY=local-dev-key         # generate with: openssl rand -hex 32

# GitHub OAuth
GITHUB_CLIENT_ID=your_client_id
GITHUB_CLIENT_SECRET=your_client_secret
GITHUB_CALLBACK_URL=http://localhost:3001/auth/github/callback
GITHUB_CALLBACK_URLS=http://localhost:3001/auth/github/callback,https://yourdomain.com/auth/github/callback

# JWT for BFF-Backend communication
JWT_SECRET=your_jwt_secret

# Session
SESSION_SECRET=your_session_secret

# External APIs
DISCOGS_API_TOKEN=your_discogs_token
MUSICBRAINZ_USER_AGENT=VinylVault/0.1.0 (your@email.com)
```

**Getting Started:**
1. Clone repository
2. Run `pnpm install`
3. Copy `.env.example` to `.env` and configure
4. Start MongoDB: `docker-compose -f infra/docker-compose.yml up -d mongodb`
5. Run `pnpm dev`
6. Open http://localhost:3000