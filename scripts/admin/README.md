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
