# Vinyl Vault Admin Scripts

Management scripts for user, tenant, and data administration.

All scripts accept `--stage DEV|STAGING|DEMO` (default: `DEV`).

---

## Prerequisites

```bash
# Install dependencies (mongodb driver is in root node_modules)
pnpm install
```

For **STAGING**: `kubectl` must be configured and pointing at the right cluster.  
For **DEMO**: create a `.env.demo` file at the repo root (see below).

---

## Scripts

### `list-users.mjs`
List all registered users.
```bash
node scripts/admin/list-users.mjs [--stage DEV]
```

### `list-tenants.mjs`
List all tenants with member counts and database names.
```bash
node scripts/admin/list-tenants.mjs [--stage DEV]
```

### `add-user-to-tenant.mjs`
Add a user to a tenant, or update their role if already a member.
```bash
node scripts/admin/add-user-to-tenant.mjs \
  --user <githubLogin> \
  --tenant <tenantId> \
  [--role ADMIN|MEMBER|VIEWER]   # default: MEMBER
  [--stage DEV]
```

### `remove-user-from-tenant.mjs`
Remove a user's role assignment from a tenant.  
> Note: their active session still caches the old tenant list — use `force-logout-user` to clear it immediately.
```bash
node scripts/admin/remove-user-from-tenant.mjs \
  --user <githubLogin> \
  --tenant <tenantId> \
  [--stage DEV]
```

### `remove-tenant.mjs`
Drops the tenant database and removes all registry entries.  
`--complete` additionally removes the user account and sessions (USER-type tenants only).

```bash
node scripts/admin/remove-tenant.mjs \
  --tenant <tenantId> \
  [--complete] \
  [--stage DEV]
```

You will be prompted to type the tenantId to confirm.

### `force-logout-user.mjs`
Delete all active sessions for a user. They will be redirected to login on their next request.
```bash
node scripts/admin/force-logout-user.mjs \
  --user <githubLogin> \
  [--stage DEV]
```

### `statistics.mjs`
Platform-wide statistics: users, tenants, role assignments, active sessions, and per-tenant record/release/artist counts.
```bash
node scripts/admin/statistics.mjs [--stage DEV]
```

### `backfill-search-fields.mjs`
Populate embedded release search fields (`releaseArtist`, `releaseTitle`, `releaseYear`, etc.)
on all existing record documents. New records receive these fields automatically; this script
covers records created before the denormalization was introduced. Safe to re-run.

```bash
node scripts/admin/backfill-search-fields.mjs [--stage DEV|STAGING|DEMO] [--dry-run]
```

Or with explicit URIs to keep credentials out of `ps` (same variable names as the backend `.env`):
```bash
export MONGODB_REGISTRY_URI="mongodb+srv://..."
export MONGODB_URI_BASE="mongodb+srv://..."    # base URI, no database name
node scripts/admin/backfill-search-fields.mjs [--dry-run]
```

On Atlas, both URIs typically point to the same cluster.

---

### `typesense-full-sync.mjs`
Wipe and fully re-index all tenant records in Typesense from MongoDB.  
Use this for disaster recovery or after a Typesense collection schema change.  
The sync worker's change-stream resume token is cleared so it resumes cleanly from the current position after the script finishes.

```bash
node scripts/admin/typesense-full-sync.mjs [--stage DEV|STAGING|DEMO] [--dry-run]
```

Or with explicit credentials to keep secrets out of `ps`:
```bash
export MONGODB_REGISTRY_URI="mongodb+srv://..."
export MONGODB_URI_BASE="mongodb+srv://..."
export TYPESENSE_HOST="xxx.a1.typesense.net"
export TYPESENSE_PORT="443"
export TYPESENSE_PROTOCOL="https"
export TYPESENSE_API_KEY="your-api-key"
node scripts/admin/typesense-full-sync.mjs [--dry-run]
```

---

Copy all Vinyl Vault databases (`vinylvault_registry`, `vv_*` tenant databases, `vinylvault_bff`) from one MongoDB cluster to another.  
Each destination collection is wiped before copying, so the script is safe to re-run.  
Atlas Search indexes must be created separately after migration.

```bash
node scripts/admin/migrate-cluster.mjs \
  --src  <source-mongodb-uri> \
  --dst  <destination-mongodb-uri> \
  [--batch-size 1000]   # documents per insert batch (default: 1000)
  [--skip-bff]          # omit vinylvault_bff (sessions)
  [--dry-run]           # preview what would be migrated without writing
  [-y]                  # skip the confirmation prompt
```

**Keeping secrets out of `ps`** — pass the URIs via environment variables instead of
CLI arguments so they never appear in the process list:

```bash
export VV_SRC_URI="mongodb://localhost:27017"
export VV_DST_URI="mongodb+srv://user:pass@cluster.mongodb.net"
node scripts/admin/migrate-cluster.mjs [--batch-size 1000] [--skip-bff] [--dry-run] [-y]
```

Or inline for a one-off run (variables are scoped to the child process, not exported to the shell):

```bash
VV_SRC_URI="mongodb://localhost:27017" \
VV_DST_URI="mongodb+srv://user:pass@cluster.mongodb.net" \
  node scripts/admin/migrate-cluster.mjs --dry-run
```

You can also use `--src` / `--dst` directly; `VV_SRC_URI` / `VV_DST_URI` are just the recommended alternative to avoid exposing credentials in `ps`.

Examples:
```bash
# Preview first, then run
node scripts/admin/migrate-cluster.mjs --dry-run
node scripts/admin/migrate-cluster.mjs -y
```

---

## Stage Configuration

### DEV (default)
Uses `mongodb://localhost:27017` — no configuration needed.

### STAGING
Requires `kubectl` configured for the staging cluster.  
The scripts automatically:
1. Fetch MongoDB passwords from k8s Secrets (`mongodb-backend-secret`, `mongodb-bff-secret`)
2. Open `kubectl port-forward` to the MongoDB pods
3. Clean up port-forwards on exit

### DEMO (Koyeb)
Create `.env.demo` at the repo root (this file is gitignored):
```bash
# .env.demo
MONGODB_URI=mongodb+srv://.../<vinylvault_bff>
MONGODB_URI_BASE=mongodb+srv://...
MONGODB_REGISTRY_URI=mongodb+srv://.../<vinylvault_registry>
```

Or export the same variables in your shell before running the script.

---

## Tenant ID format

| Type | Format | Example |
|------|--------|---------|
| Personal | `user_<githubId>` | `user_abc123def456` |
| Organisation | `org_<githubOrgId>` | `org_xyz789012` |

The corresponding MongoDB database name is `vv_<12-char-SHA256-hash>` of the tenantId.  
Use `list-tenants.mjs` to see the mapping.

---

## Roles

| Role | Description |
|------|-------------|
| `ADMIN` | Full access, can manage the tenant |
| `MEMBER` | Can add and edit records |
| `VIEWER` | Read-only access |
