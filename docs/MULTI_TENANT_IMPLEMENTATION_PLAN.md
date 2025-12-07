# Multi-Tenant Implementation Plan

**Status:** Planning Phase  
**Last Updated:** 2025-12-07  
**Target Architecture:** Database-per-Tenant with Central Registry

## Executive Summary

This plan transforms Vinyl Vault from single-tenant to multi-tenant architecture, enabling users to manage both personal collections and shared organization collections. The implementation uses database-per-tenant isolation for security and scalability.

**Key Decisions:**
- ✅ Database-per-Tenant (strict data isolation)
- ✅ Per-tenant release cache (no shared cache)
- ✅ Periodic GitHub organization sync (every 6 hours)
- ✅ Central registry database for user-tenant-role mappings
- ✅ JWT-based tenant context propagation

**No Production Data:** Clean slate - can start fresh with schema changes.

---

## Phase 1: Foundation & Registry Database

**Goal:** Establish the central registry database and core multi-tenant data models.

**Duration:** 2-3 days

**Phase 1 Checklist (execute in order):**
1) Env samples: add `MONGODB_URI_BASE`, `MONGODB_REGISTRY_URI`, `GITHUB_ORG_SYNC_ENABLED` to `infra/.env.sample` and root `.env.sample`.
2) Backend config: extend `packages/backend/src/config/env.ts` to read `MONGODB_URI_BASE` and `MONGODB_REGISTRY_URI`.
3) BFF config: extend `packages/bff/src/config/env.ts` to read `GITHUB_ORG_SYNC_ENABLED`.
4) Registry connection: add `packages/backend/src/db/registry.ts` (connect once, export `getRegistryDb`).
5) Tenant DB helper: add `getTenantDbName(tenantId)` helper in `packages/backend/src/db/connection.ts` (no tenant pooling yet, just name generation placeholder).
6) Models: add `packages/backend/src/models/tenant.ts` and `userTenantRole.ts`; update `user.ts` to drop global role.
7) Verification: smoke test connections (registry + default tenant name), lint passes.

### Tasks

#### 1.1 Environment Configuration
- [ ] Add new environment variables to `infra/.env.sample`:
  - `MONGODB_URI_BASE=mongodb://localhost:27017` (for tenant databases)
  - `MONGODB_REGISTRY_URI=mongodb://localhost:27017/vinylvault_registry` (registry)
  - `GITHUB_ORG_SYNC_ENABLED=true`
- [ ] Update root `.env.sample` with same variables
- [ ] Update `packages/backend/src/config/env.ts` to read new MongoDB vars
- [ ] Update `packages/bff/src/config/env.ts` to read GitHub sync vars

#### 1.2 Registry Database Collections
- [ ] Create `packages/backend/src/db/registry.ts`:
  - Registry connection management (separate from tenant connections)
  - Collections: `users`, `tenants`, `user_tenant_roles`
- [ ] Create `packages/backend/src/models/tenant.ts`:
  ```typescript
  interface TenantDocument {
    _id: ObjectId;
    tenantId: string;           // user_{userId} or org_{orgName}
    tenantType: 'USER' | 'ORGANIZATION';
    name: string;
    githubOrgName?: string;
    databaseName: string;       // vinylvault_user_{userId}
    createdAt: Date;
    updatedAt: Date;
  }
  ```
- [ ] Create `packages/backend/src/models/userTenantRole.ts`:
  ```typescript
  interface UserTenantRoleDocument {
    _id: ObjectId;
    userId: ObjectId;           // ref to users in registry
    tenantId: string;           // tenant identifier
    role: 'ADMIN' | 'MEMBER' | 'VIEWER';
    createdAt: Date;
    updatedAt: Date;
  }
  ```
- [ ] Update `packages/backend/src/models/user.ts`:
  - Remove `role` field (now in user_tenant_roles)
  - Keep only GitHub profile data

#### 1.3 Database Connection Management
- [ ] Refactor `packages/backend/src/db/connection.ts`:
  - Change from single connection to connection pool manager
  - `getRegistryDb()` - returns registry database
  - `getTenantDb(tenantId: string)` - returns tenant database (cached connections)
  - `getTenantDbName(tenantId: string)` - generates database name
  - Connection pooling for tenant databases
- [ ] Update BFF MongoDB connection:
  - Keep using `MONGODB_URI` for session storage (single DB)
  - No changes needed in BFF database layer

**Verification:**
- [ ] Can connect to registry database
- [ ] Can create and retrieve tenants
- [ ] Can create user-tenant-role mappings
- [ ] Multiple tenant database connections work in parallel

---

## Phase 2: JWT & Tenant Context

**Goal:** Extend JWT tokens to include tenant context and update authorization.

**Duration:** 2-3 days

**Phase 2 Checklist (execute in order):**
1) BFF JWT payload: extend `packages/bff/src/auth/jwt.ts` payload to include tenantId, tenantRole, username, avatarUrl; update `signJwt`/`verifyJwt` signatures accordingly.
2) Session state: update `packages/bff/src/types/session.ts` to add `activeTenantId?`; add helpers `setActiveTenant`/`getActiveTenant` (default to personal tenant on first login).
3) Backend JWT validation: add `packages/backend/src/auth/jwt.ts` with `verifyJwt` and `extractTenantContext` (tenantId, tenantRole, userId, username, avatarUrl).
4) GraphQL context wiring: in `packages/backend/src/graphql/resolvers.ts` (and server setup), extract JWT from Authorization header, validate, and populate resolver context with userId, tenantId, tenantRole.
5) Verification: issue a test token from BFF util and ensure backend extraction returns tenant context; ensure invalid tokens are rejected.

### Tasks

#### 2.1 JWT Token Extension
- [ ] Update `packages/bff/src/auth/jwt.ts`:
  - Add `tenantId: string` to `JwtPayload`
  - Add `tenantRole: 'ADMIN' | 'MEMBER' | 'VIEWER'` to `JwtPayload`
  - Add `username: string` and `avatarUrl: string` to `JwtPayload`
  - Keep `sub: string` (userId)
- [ ] Update `signJwt()` to accept tenant context
- [ ] Update `verifyJwt()` to return tenant context

#### 2.2 Session Tenant Tracking
- [ ] Update `packages/bff/src/types/session.ts`:
  - Add `activeTenantId?: string` to session data
  - Track which tenant user is currently viewing
- [ ] Create session helper:
  - `setActiveTenant(session, tenantId)` 
  - `getActiveTenant(session)` 
  - Default to personal tenant on first login

#### 2.3 Backend JWT Validation
- [ ] Create `packages/backend/src/auth/jwt.ts`:
  - `verifyJwt(token: string)` - extract and validate JWT
  - `extractTenantContext(token)` - get tenantId and tenantRole
- [ ] Update `packages/backend/src/graphql/resolvers.ts`:
  - Add `context` parameter to all resolvers
  - Extract JWT from authorization header
  - Populate context with `userId`, `tenantId`, `tenantRole`

**Verification:**
- [ ] JWT tokens contain tenant context
- [ ] Backend can extract tenant from JWT
- [ ] Invalid JWTs are rejected
- [ ] Session persists active tenant selection

---

## Phase 3: Personal Tenant Auto-Creation

**Goal:** Automatically create personal tenant for each user on first login.

**Duration:** 2 days

**Phase 3 Checklist (execute in order):**
1) GraphQL schema: add `TenantType` enum (USER, ORGANIZATION), `CreateTenantInput` input type, `Tenant` type, and mutations `createTenant` and `addUserToTenant` to `packages/backend/src/schema.graphql`.
2) Tenant service: create `packages/backend/src/services/tenants.ts` with `createPersonalTenant`, `createOrganizationTenant`, `getUserTenants`, `addUserToTenant`, `removeUserFromTenant`, `updateUserTenantRole` functions.
3) Backend resolvers: implement `createTenant` and `addUserToTenant` mutation resolvers in `packages/backend/src/graphql/resolvers.ts`; verify authorization and tenant creation logic.
4) BFF GitHub callback: update `packages/bff/src/auth/github.ts` to create personal tenant on first login via backend mutation and set activeTenantId in session.
5) Verification: test new user login creates personal tenant, database is created, user is ADMIN, session and JWT contain correct tenant context, no duplicate tenants on re-login.

### Tasks

#### 3.1 GraphQL Schema for Tenant Management
- [ ] Update `packages/backend/src/schema.graphql`:
  - Add `enum TenantType { USER ORGANIZATION }`
  - Add `enum Role { ADMIN MEMBER VIEWER }`
  - Add input type `CreateTenantInput`:
    ```graphql
    input CreateTenantInput {
      tenantType: TenantType!
      name: String!
      githubOrgId: String
      githubOrgName: String
    }
    ```
  - Add type `Tenant`:
    ```graphql
    type Tenant {
      tenantId: String!
      tenantType: TenantType!
      name: String!
      databaseName: String!
      createdAt: String!
    }
    ```
  - Add type `UserTenantRole`:
    ```graphql
    type UserTenantRole {
      userId: ID!
      tenantId: String!
      role: Role!
      createdAt: String!
    }
    ```
  - Add mutations:
    ```graphql
    extend type Mutation {
      createTenant(input: CreateTenantInput!): Tenant!
      addUserToTenant(userId: ID!, tenantId: String!, role: Role!): UserTenantRole!
    }
    ```

#### 3.2 Tenant Service Implementation
- [ ] Create `packages/backend/src/services/tenants.ts`:
  - Import `getRegistryDb` and `getTenantDbName` helpers
  - Implement `createPersonalTenant(userId: ObjectId, username: string)`:
    - Generate `tenantId = user_{userId}`
    - Create tenant document in registry (tenantType: USER, name: username)
    - Return created tenant
  - Implement `createOrganizationTenant(orgId: string, orgName: string)`:
    - Generate `tenantId = org_{orgId}`
    - Create tenant document in registry (tenantType: ORGANIZATION, name: orgName, githubOrgId: orgId)
    - Return created tenant
  - Implement `getUserTenants(userId: ObjectId)`:
    - Query user_tenant_roles collection filtered by userId
    - Join with tenants collection to get full tenant info
    - Return array of tenant documents with user roles
  - Implement `addUserToTenant(userId: ObjectId, tenantId: string, role: Role)`:
    - Insert into user_tenant_roles collection
    - Handle duplicate key error (user already has role in tenant)
    - Return user_tenant_role document
  - Implement `removeUserFromTenant(userId: ObjectId, tenantId: string)`:
    - Delete from user_tenant_roles collection
    - Return deletion result
  - Implement `updateUserTenantRole(userId: ObjectId, tenantId: string, newRole: Role)`:
    - Update role in user_tenant_roles collection
    - Return updated document

#### 3.3 Backend Resolver Implementation
- [ ] Update `packages/backend/src/graphql/resolvers.ts`:
  - Add `createTenant` resolver:
    - Input: CreateTenantInput
    - Verify user is authenticated (context.userId required)
    - For USER tenants: only creator can create own personal tenant (userId-based tenantId)
    - Call `createPersonalTenant(context.userId, input.name)` or `createOrganizationTenant(input.githubOrgId, input.name)`
    - Return created tenant
  - Add `addUserToTenant` resolver:
    - Verify user has ADMIN role in target tenant (query user_tenant_roles)
    - Call `addUserToTenant(userId, tenantId, role)`
    - Return user_tenant_role document
  - Error handling: throw GraphQL errors for authorization failures and duplicate tenants

#### 3.4 BFF GitHub OAuth Callback Update
- [ ] Update `packages/bff/src/auth/github.ts`:
  - In callback handler after fetching GitHub user profile:
    1. Extract GitHub user ID and username from profile
    2. Create/upsert user in registry via backend mutation (or internal logic)
    3. Query backend for user's existing tenants via `getUserTenants` query
    4. If no USER tenant exists, call backend `createTenant` mutation with tenantType: USER
    5. Add user as ADMIN of personal tenant (call `addUserToTenant` if not already)
    6. Get user's ADMIN role in personal tenant (verify step 5)
    7. Call `setActiveTenant(req.session, personalTenantId)` to set session
    8. Sign JWT with tenant context: `signJwt({sub: userId, tenantId: personalTenantId, tenantRole: 'ADMIN', username, avatarUrl})`
    9. Redirect to frontend with JWT in query param or auth header
  - Error handling: log errors, redirect to login with error message if tenant creation fails
  - Idempotency: check existing tenant before creation (avoid duplicates)

**Verification Checklist:**
- [ ] GraphQL schema compiles without errors
- [ ] Tenant service functions work in isolation (unit test or manual)
- [ ] Personal tenant created on first user login
- [ ] Personal tenant database is accessible via `getTenantDb(personalTenantId)`
- [ ] User is ADMIN role in personal tenant (verified in user_tenant_roles)
- [ ] Session contains activeTenantId set to personal tenant
- [ ] JWT contains tenantId=user_{userId}, tenantRole=ADMIN, username, avatarUrl
- [ ] Re-login by same user doesn't create duplicate personal tenant
- [ ] Backend resolvers properly authorize mutation calls
- [ ] No TypeScript compilation errors
- [ ] Lint passes

---

## Phase 4: Tenant-Scoped Data Access

**Goal:** Route all data operations to tenant-specific databases.

**Duration:** 3-4 days

### Tasks

#### 4.1 Resolver Context Setup
- [ ] Create `packages/backend/src/types/context.ts`:
  ```typescript
  interface GraphQLContext {
    userId: string;
    username: string;
    tenantId: string;
    tenantRole: 'ADMIN' | 'MEMBER' | 'VIEWER';
    db: Db;  // tenant database connection
    registryDb: Db;  // registry database connection
  }
  ```
- [ ] Update Apollo Server initialization:
  - Extract JWT from authorization header
  - Validate JWT and extract tenant context
  - Get tenant database connection via `getTenantDb(tenantId)`
  - Get registry database connection via `getRegistryDb()`
  - Populate context object

#### 4.2 Update All Resolvers
- [ ] Update `packages/backend/src/graphql/resolvers.ts`:
  - Change all resolvers to use `context.db` (tenant database)
  - Update `lookupBarcode` to cache in tenant database
  - Update `records` query to filter by tenant database
  - Update `createRecord`, `updateRecord`, `deleteRecord` to use tenant database
- [ ] Update `packages/backend/src/services/releasesCache.ts`:
  - Accept `db` parameter (tenant database)
  - All cache operations use passed database
- [ ] Update `packages/backend/src/services/users.ts`:
  - Split into two files: `users.ts` (registry) and `tenantUsers.ts` (tenant-scoped)
  - Use `registryDb` for global user operations
  - Use tenant `db` for tenant-specific user data if needed

#### 4.3 Authorization Enforcement
- [ ] Create `packages/backend/src/utils/authorization.ts`:
  - `requireAdmin(context)` - throws if not ADMIN role
  - `requireMember(context)` - throws if not ADMIN or MEMBER
  - `canWrite(context)` - checks if user can modify data
  - `canRead(context)` - checks if user can read data (all roles)
- [ ] Apply authorization to mutations:
  - Tenant management: admin only
  - Record create/update/delete: admin or member
  - Queries: all roles

**Verification:**
- [ ] All queries/mutations execute against tenant database
- [ ] Switching JWT tenant switches database
- [ ] No cross-tenant data leakage
- [ ] Authorization properly enforced
- [ ] Cache operations isolated per tenant

---

## Phase 5: GitHub Organization Sync

**Goal:** Sync GitHub organization membership on user login (single org limit).

**Duration:** 2-3 days

### Tasks

#### 5.1 GitHub API Integration
- [ ] Create `packages/bff/src/services/githubOrgs.ts`:
  - `getUserOrganizations(accessToken)` - fetch user's GitHub orgs
  - `getOrganizationMembers(orgName, accessToken)` - fetch org members
  - Handle pagination for large orgs
  - Handle rate limiting

#### 5.2 Organization Sync Service
- [ ] Create `packages/bff/src/services/orgSync.ts`:
  - `syncUserOrganizations(userId, githubUserId, accessToken)`:
    1. Fetch user's GitHub organizations (via GitHub API)
    2. Check if user already has an organization tenant (2-tenant limit)
    3. If user has org tenant, verify they're still a member (update or remove)
    4. If user has no org tenant and belongs to orgs, select first org (or show UI to choose)
    5. For selected org, check if tenant exists in registry (use org ID)
    6. If not, create organization tenant via backend mutation (using org ID)
    7. Fetch org members from GitHub
    8. Add user to org tenant with VIEWER role (if new)
    9. Sync other org members (add missing, remove departed)
  - Return organization tenant info (or null if none)

#### 5.3 Sync Trigger Points
- [ ] Trigger sync on user login (only trigger point):
  - After GitHub OAuth callback
  - After upsert user and create personal tenant
  - Before setting activeTenantId
  - Ensures user sees available organization (if any)
  - Returns org tenant info to determine initial activeTenantId
- [ ] Handle org selection if user belongs to multiple orgs:
  - Option A: Auto-select first org alphabetically
  - Option B: Show org selection UI on first login
  - Recommendation: Option A for MVP simplicity

**Note:** No periodic background sync - only sync on login per decision #1.

#### 5.4 Tenant Limit Validation
- [ ] Implement validation in `syncUserOrganizations`:
  - Query user's existing tenants from registry
  - If count >= 2, skip org sync (already at limit)
  - Log info message about tenant limit
  - Return existing org tenant (if any)
- [ ] Add error handling for edge cases:
  - User removed from org → remove org tenant access
  - User joins different org → replace org tenant (show warning in UI)

**Verification:**
- [ ] User organizations synced on login
- [ ] Organization tenant created with org ID (not name)
- [ ] Users added to org tenant with VIEWER role by default
- [ ] 2-tenant limit enforced (1 personal + 1 org max)
- [ ] User can only be in one organization tenant
- [ ] Removed org members lose access on next login
- [ ] Org name changes don't break tenant (using org ID)

---

## Phase 6: Tenant Switching UI & API

**Goal:** Enable users to switch between personal and organization tenants.

**Duration:** 3 days

### Tasks

#### 6.1 GraphQL Schema Updates
- [ ] Update `packages/bff/src/schema.graphql`:
  - Add `Tenant` type with fields: `id`, `name`, `type`, `role`
  - Add `availableTenants: [Tenant!]!` to `User` type
  - Add `activeTenant: Tenant` to `User` type
  - Add mutation: `switchTenant(tenantId: String!): User`
- [ ] Update `packages/backend/src/schema.graphql`:
  - Add query: `userTenants(userId: ID!): [UserTenantRole!]!`

#### 6.2 BFF Tenant Switching
- [ ] Update `packages/bff/src/graphql/resolvers.ts`:
  - Implement `switchTenant` mutation:
    1. Verify user has access to target tenant (query backend)
    2. Update session `activeTenantId`
    3. Query backend for user's role in new tenant
    4. Return updated user object with new tenant context
  - Update `viewer` query:
    1. Fetch user's available tenants from backend
    2. Include active tenant from session
    3. Map tenants to GraphQL Tenant type

#### 6.3 Frontend Tenant Switcher
- [ ] Create `packages/frontend/src/components/TenantSwitcher.tsx`:
  - Dropdown/modal showing available tenants
  - Current tenant highlighted
  - Switch button calls `switchTenant` mutation
  - Show tenant type (personal vs organization)
  - Show user's role in each tenant
- [ ] Update `packages/frontend/src/components/Header.tsx`:
  - Display current tenant name
  - Include TenantSwitcher component
- [ ] Update `packages/frontend/src/contexts/AuthContext.tsx`:
  - Include `activeTenant` and `availableTenants` in auth state
  - Refresh auth state after tenant switch

#### 6.4 Relay Schema Update
- [ ] Regenerate Relay schema: `pnpm --filter frontend relay`
- [ ] Update GraphQL queries/mutations to include tenant fields

**Verification:**
- [ ] User sees list of available tenants
- [ ] Can switch between personal and organization tenants
- [ ] Switching updates UI immediately
- [ ] Subsequent queries return data from new tenant
- [ ] Current tenant persists across page refreshes (session)

---

## Phase 7: Migration & Cleanup

**Goal:** Clean up old single-tenant code and data structures.

**Duration:** 2 days

### Tasks

#### 7.1 Data Migration (if needed)
- [ ] Create migration script `scripts/migrate-to-multitenant.ts`:
  - Option 1: Start fresh (drop all data) - RECOMMENDED
  - Option 2: Migrate existing users to personal tenants
  - If migrating: Move records/releases to personal tenant databases
- [ ] Run migration in development
- [ ] Verify data integrity

#### 7.2 Code Cleanup
- [ ] Remove old single-database code paths
- [ ] Remove global `role` from User model (now in user_tenant_roles)
- [ ] Update all TypeScript types to reflect multi-tenant architecture
- [ ] Remove obsolete environment variables
- [ ] Update GraphQL schema descriptions

#### 7.3 Documentation Updates
- [ ] Update `docs/GETTING_STARTED.md`:
  - Multi-tenant setup instructions
  - Environment variable examples
  - GitHub organization sync explanation
- [ ] Update `README.md`:
  - Feature list includes multi-tenancy
  - Screenshot showing tenant switcher
- [ ] Create `docs/MULTI_TENANT_GUIDE.md`:
  - User guide for switching tenants
  - Admin guide for managing organization tenants
  - Troubleshooting section

**Verification:**
- [ ] No references to old single-tenant patterns
- [ ] All documentation up-to-date
- [ ] Clean build with no TypeScript errors
- [ ] All tests passing

---

## Phase 8: Testing & Polish

**Goal:** Comprehensive testing and edge case handling.

**Duration:** 3-4 days

### Tasks

#### 8.1 Unit Tests
- [ ] Test tenant database connection pooling
- [ ] Test JWT tenant context extraction
- [ ] Test authorization helpers
- [ ] Test GitHub org sync logic
- [ ] Test tenant switching

#### 8.2 Integration Tests
- [ ] Test full authentication flow (creates personal tenant)
- [ ] Test organization sync flow
- [ ] Test barcode lookup caches in correct tenant database
- [ ] Test cross-tenant isolation (can't access other tenant's data)
- [ ] Test role-based authorization enforcement

#### 8.3 End-to-End Tests
- [ ] Test user signup → personal tenant creation
- [ ] Test joining GitHub org → org tenant creation
- [ ] Test switching tenants → UI updates
- [ ] Test scanning barcode in different tenants → separate caches
- [ ] Test removing user from org → loses access

#### 8.4 Edge Cases & Error Handling
- [ ] Handle GitHub API rate limiting gracefully
- [ ] Handle missing tenant database (auto-create?)
- [ ] Handle user switching to deleted tenant
- [ ] Handle concurrent tenant switches
- [ ] Handle GitHub org sync failures
- [ ] Handle tenant database connection failures

#### 8.5 Performance Testing
- [ ] Test with 10+ tenants per user
- [ ] Test with 100+ members in organization
- [ ] Monitor connection pool usage
- [ ] Check query performance in tenant databases
- [ ] Verify no N+1 queries

**Verification:**
- [ ] All unit tests pass
- [ ] All integration tests pass
- [ ] All E2E tests pass
- [ ] No error logs under normal operation
- [ ] Performance acceptable with realistic data volumes

---

## Phase 9: Production Readiness

**Goal:** Prepare for production deployment.

**Duration:** 2 days

### Tasks

#### 9.1 Security Audit
- [ ] Review JWT signing/verification
- [ ] Review tenant isolation guarantees
- [ ] Review authorization enforcement
- [ ] Check for SQL injection equivalents (NoSQL injection)
- [ ] Validate all user inputs
- [ ] Rate limiting on tenant switching
- [ ] Secure GitHub token storage (if implemented)

#### 9.2 Monitoring & Logging
- [ ] Log tenant context in all operations
- [ ] Monitor tenant database connections
- [ ] Alert on tenant isolation violations
- [ ] Track GitHub sync errors
- [ ] Monitor MongoDB connection pool

#### 9.3 Deployment Configuration
- [ ] Update `infra/docker-compose.yml`:
  - Add MONGODB_URI_BASE environment variable
  - Add MONGODB_REGISTRY_URI environment variable
  - Add GitHub sync configuration
- [ ] Update deployment documentation
- [ ] Create production `.env` template
- [ ] Backup/restore procedures for multi-tenant databases

#### 9.4 Rollback Plan
- [ ] Document rollback procedure
- [ ] Test downgrade from multi-tenant to single-tenant (if needed)
- [ ] Database backup before production deployment

**Verification:**
- [ ] Security checklist complete
- [ ] Monitoring dashboards created
- [ ] Production deployment tested in staging
- [ ] Rollback plan documented and tested

---

## Implementation Guidelines

### Development Workflow
1. **Create feature branch** for each phase: `feature/multi-tenant-phase-N`
2. **Implement tasks** in order within each phase
3. **Test incrementally** - don't wait until phase end
4. **Merge to main** after phase completion and verification
5. **Tag releases**: `v0.2.0-phase1`, `v0.2.0-phase2`, etc.

### Testing Strategy
- **Unit tests**: For utilities and business logic (authorization, JWT, etc.)
- **Integration tests**: For database operations and API calls
- **E2E tests**: For full user flows (optional but recommended)
- Run tests after each task completion

### Risk Management

**High Risk Items:**
- Tenant database connection pooling (test thoroughly)
- Cross-tenant data leakage (add integration tests)
- GitHub org sync reliability (handle API failures gracefully)

**Mitigation:**
- Extensive testing in each phase
- Code reviews before merging
- Staging environment testing before production

### Estimated Timeline

| Phase | Duration | Dependencies |
|-------|----------|--------------|
| Phase 1: Foundation | 2-3 days | None |
| Phase 2: JWT & Context | 2-3 days | Phase 1 |
| Phase 3: Personal Tenant | 2 days | Phase 1, 2 |
| Phase 4: Tenant-Scoped Data | 3-4 days | Phase 1, 2, 3 |
| Phase 5: GitHub Sync | 3 days | Phase 1, 2, 3 |
| Phase 6: Tenant Switching | 3 days | Phase 4, 5 |
| Phase 7: Migration & Cleanup | 2 days | Phase 1-6 |
| Phase 8: Testing & Polish | 3-4 days | Phase 1-7 |
| Phase 9: Production Ready | 2 days | Phase 1-8 |

**Total Estimated Duration:** 22-28 days (4-6 weeks)

---

## Success Criteria

### Functional Requirements
- ✅ Users automatically get personal tenant on signup
- ✅ GitHub organization members share organization tenant
- ✅ Users can switch between tenants in UI
- ✅ Data completely isolated between tenants
- ✅ Role-based authorization enforced (admin, member, viewer)
- ✅ Organization sync runs periodically and on login

### Technical Requirements
- ✅ Database-per-tenant architecture implemented
- ✅ Central registry database operational
- ✅ JWT contains tenant context
- ✅ Connection pooling efficient (<100ms tenant switching)
- ✅ No cross-tenant data access possible
- ✅ All queries execute against correct tenant database

### Quality Requirements
- ✅ No regressions in existing barcode scanning functionality
- ✅ Test coverage >80% for new multi-tenant code
- ✅ Performance acceptable with 10+ tenants
- ✅ Documentation complete and accurate
- ✅ Production deployment successful

---

## Open Questions & Decisions Needed

### 1. GitHub Access Token Storage
**Question:** Should we store GitHub access tokens for background org sync?

**Decision:** ✅ **Only sync on user login** (Option B)
- Simpler implementation
- No token storage security concerns
- Sufficient for MVP - sync happens when users actively use the app
- Can add background sync later if needed

### 2. Tenant Database Naming
**Question:** Confirm database naming convention?

**Decision:** ✅ **Use GitHub organization ID** (not name)
- Personal: `vinylvault_user_{userId}` (e.g., `vinylvault_user_507f1f77bcf86cd799439011`)
- Organization: `vinylvault_org_{orgId}` (e.g., `vinylvault_org_12345678`)
- Stable identifier that never changes
- Store display name separately in tenant record
- `tenantId` format: `user_{userId}` or `org_{orgId}`

### 3. Default Organization Role
**Question:** When user joins GitHub org, what should their default role be in tenant?

**Decision:** ✅ **VIEWER by default** (Option A)
- Most secure default - least privilege principle
- Organization ADMIN can promote users to MEMBER or ADMIN later
- Prevents accidental data modification by new members
- Clear permission escalation workflow

### 4. Tenant Deletion
**Question:** Should we support deleting organization tenants?

**Decision:** ✅ **YES - Support tenant deletion**
- ADMIN-only operation
- Deletes entire tenant database (all records and cache)
- Multi-step confirmation required (type tenant name to confirm)
- Warning about permanent data loss
- Implement in Phase 9 (Production Readiness)
- Consider soft-delete with grace period for recovery

### 5. Maximum Tenants Per User
**Question:** Should we limit number of tenants per user?

**Decision:** ✅ **Strict limit: 2 tenants maximum**
- 1 personal tenant (user_{userId}) - always created on signup
- 1 organization tenant (optional) - user can join ONE GitHub organization
- Prevents complexity and resource abuse
- Validates in org sync: if user already has org tenant, skip additional orgs
- Clear error message if user tries to join multiple orgs
- Can be relaxed in future if needed

---

## Next Steps

1. **Review this plan** with stakeholders
2. **Resolve open questions** above
3. **Set up project board** with tasks from each phase
4. **Create Phase 1 feature branch**: `git checkout -b feature/multi-tenant-phase-1`
5. **Start implementation** following phase order
6. **Daily progress updates** - track completion status

---

## Notes

- This plan assumes clean slate (no production data to migrate)
- Each phase builds on previous phases - order is important
- Verification checkboxes must pass before moving to next phase
- Add buffer time for unexpected issues (20% recommended)
- Consider pair programming for high-risk components
