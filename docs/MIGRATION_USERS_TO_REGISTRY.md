# Migration: Move Users to Registry Database

## Background

As part of fixing a MongoDB connection pooling anti-pattern
([`bugfix/mongodb-connection-pooling`](../packages/backend/src/scripts/migrate-users-to-registry.ts)),
the `users` collection was moved from the BFF database (`vinylvault`) to the
central registry database (`vinylvault_registry`).

**What changed:**
- `packages/backend/src/services/users.ts` previously called `connectToDatabase()`, which
  pointed to `MONGODB_URI` (`vinylvault` — the BFF session DB).
- It now calls `getRegistryDb()`, which points to `MONGODB_REGISTRY_URI`
  (`vinylvault_registry` — the correct home for users per the SDD).

Environments with existing user records need a one-time data migration before deploying
the updated backend.

---

## Migration Script

**Location:** `packages/backend/src/scripts/migrate-users-to-registry.ts`

**Behaviour:**
- Reads all documents from `vinylvault.users` (legacy)
- Copies each one to `vinylvault_registry.users` (registry)
- Skips users that already exist in the registry (matched on `githubId`)
- **Idempotent** — safe to run multiple times

---

## Environments

### Staging (GitHub Actions → Kubernetes)

The migration runs automatically as part of the `deploy_pr_to_staging` job in
`.github/workflows/build.yml`, **before** the new manifests are applied.

It uses the just-built backend image and reads connection strings from the
`mongodb-secrets` Kubernetes secret in the `vinylvault-staging` namespace.

No manual action is required.

### Demo (Koyeb)

This is a one-time manual step. Run it from your local machine **before** deploying
the updated backend to Koyeb:

```bash
MONGODB_URI=<koyeb-bff-mongo-uri> \
MONGODB_REGISTRY_URI=<koyeb-registry-mongo-uri> \
pnpm --filter backend migrate:users-to-registry
```

Expected output:

```
Found 3 user(s) in legacy DB.
  copy  alice
  copy  bob
  copy  carol

Done. inserted=3 skipped=0
```

If re-run after a successful migration:

```
Found 3 user(s) in legacy DB.
  skip  alice (already in registry)
  skip  bob (already in registry)
  skip  carol (already in registry)

Done. inserted=0 skipped=3
```

---

## Running Manually on Any Environment

The script respects the standard backend env vars:

| Variable               | Description                                                                       | Default                                         |
|------------------------|-----------------------------------------------------------------------------------|-------------------------------------------------|
| `MONGODB_BACKEND_URI`  | Backend DB where users were incorrectly stored (k8s, from `mongodb-secrets`)     | —                                               |
| `MONGODB_URI`          | Fallback for local use (same role as `MONGODB_BACKEND_URI`)                      | `mongodb://localhost:27017/vinylvault`          |
| `MONGODB_REGISTRY_URI` | Registry DB — correct home for users per the SDD                                 | `mongodb://localhost:27017/vinylvault_registry` |

```bash
# From the repo root
pnpm --filter backend migrate:users-to-registry

# Or with explicit connection strings
MONGODB_URI=mongodb://host1:27017/vinylvault \
MONGODB_REGISTRY_URI=mongodb://host2:27017/vinylvault_registry \
pnpm --filter backend migrate:users-to-registry
```

The two connection strings can point to **different MongoDB hosts**, which is the case
on staging where the BFF and backend databases are separated for security.

---

## Rollback

The migration is **additive only** — it never deletes documents from the legacy database.
If a rollback to the previous backend version is needed, the `vinylvault.users` collection
is still intact and the old code will continue to work against it.
