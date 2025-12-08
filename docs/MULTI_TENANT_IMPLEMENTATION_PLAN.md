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

**Goal:** Route all data operations to tenant-specific databases and enforce role-based authorization.

**Duration:** 3-4 days

**Phase 4 Checklist (execute in order):**
1) Context type: add `packages/backend/src/types/context.ts` with GraphQLContext interface (userId, username, tenantId, tenantRole, db, registryDb fields).
2) Apollo Server setup: update `packages/backend/src/index.ts` to extract JWT from Authorization header, validate, extract tenant context, get db/registryDb connections, populate resolver context.
3) releasesCache service: update `packages/backend/src/services/releasesCache.ts` to accept `db` parameter in all functions; replace global `connection` usage with passed db.
4) Resolvers - queries: update `packages/backend/src/graphql/resolvers.ts` query resolvers to use `context.db` for data operations (records, lookupBarcode); verify all queries read from correct tenant database.
5) Resolvers - mutations: update mutation resolvers (createRecord, updateRecord, deleteRecord) to use `context.db` and add authorization checks (requireAdmin or requireMember).
6) Authorization utils: create `packages/backend/src/utils/authorization.ts` with helpers `requireRole(context, allowedRoles)`, `isAdmin(context)`, `isMember(context)`, `canWrite(context)`, `canRead(context)`.
7) Verification: test queries execute against tenant db, verify JWT tenant context routes to correct db, test authorization rejection for non-admin mutations, ensure barcode cache isolated per tenant, no TypeScript errors.

### Tasks

#### 4.1 GraphQL Context Type
- [ ] Create `packages/backend/src/types/context.ts`:
  ```typescript
  import { Db } from 'mongodb';

  export interface GraphQLContext {
    userId: string;           // MongoDB ObjectId as string
    username: string;         // GitHub username
    tenantId: string;         // tenant identifier (user_{userId} or org_{orgId})
    tenantRole: 'ADMIN' | 'MEMBER' | 'VIEWER';
    db: Db;                   // tenant database connection
    registryDb: Db;           // central registry database connection
  }
  ```
- [ ] Export type for use in resolver definitions
- [ ] Update `packages/backend/src/graphql/resolvers.ts` to import GraphQLContext
- [ ] Update all resolver function signatures to receive `context: GraphQLContext`

#### 4.2 Apollo Server Context Builder
- [ ] Update `packages/backend/src/index.ts` (Apollo Server initialization):
  - Add context builder function:
    ```typescript
    context: async ({ req }: { req: ExpressRequest }) => {
      // 1. Extract JWT from Authorization header
      const authHeader = req.headers.authorization;
      const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
      
      // 2. If no token, return anonymous context (or reject)
      if (!token) {
        throw new AuthenticationError('No authorization token provided');
      }
      
      // 3. Verify JWT and extract tenant context
      const payload = verifyJwt(token);
      
      // 4. Get database connections
      const registryDb = getRegistryDb();
      const db = getTenantDb(payload.tenantId);
      
      // 5. Return populated context
      return {
        userId: payload.sub,
        username: payload.username,
        tenantId: payload.tenantId,
        tenantRole: payload.tenantRole,
        db,
        registryDb,
      };
    }
    ```
  - Import: `verifyJwt` from `packages/backend/src/auth/jwt.ts`
  - Import: `getTenantDb`, `getRegistryDb` from `packages/backend/src/db/connection.ts`
  - Import: `AuthenticationError` from apollo-server-express
- [ ] Test JWT extraction: verify context is populated correctly with valid token
- [ ] Test token validation: verify invalid tokens throw error

#### 4.3 ReleasesCache Service Update
- [ ] Update `packages/backend/src/services/releasesCache.ts`:
  - Change function signatures to accept `db: Db` as first parameter:
    - `async function getCachedRelease(db: Db, releaseId: string): Promise<...>`
    - `async function cacheRelease(db: Db, release: ...): Promise<void>`
    - `async function clearCache(db: Db): Promise<void>`
    - Any other cache functions
  - Replace all `connection` or `db` references with passed `db` parameter
  - Update collection references: `db.collection('releases_cache')`
  - Update call sites in resolvers to pass `context.db`:
    - `getCachedRelease(context.db, releaseId)`
    - `cacheRelease(context.db, release)`
- [ ] Verify all cache operations now use tenant database

#### 4.4 Query Resolvers - Tenant-Scoped Data Access
- [ ] Update `packages/backend/src/graphql/resolvers.ts` query resolvers:
  - **records query**: 
    - Change to use `context.db.collection('records')`
    - Filter by `{ tenantId: context.tenantId }` if not already partitioned by database
    - Return records from tenant database only
  - **lookupBarcode query**:
    - Use `getCachedRelease(context.db, ...)` for cache lookup
    - Search Discogs/MusicBrainz
    - Cache result via `cacheRelease(context.db, ...)`
  - **viewer query** (BFF):
    - Query registry for user info
    - Query user's available tenants via backend query
    - Return user with active tenant from session
  - Any other queries: update to use `context.db`
- [ ] Verify all queries read from correct tenant database

#### 4.5 Mutation Resolvers - Authorization & Data Access
- [ ] Update `packages/backend/src/graphql/resolvers.ts` mutation resolvers:
  - **createRecord mutation**:
    - Call `requireMember(context)` - throw if not MEMBER or ADMIN
    - Use `context.db.collection('records')`
    - Add `tenantId: context.tenantId` to record document
    - Return created record
  - **updateRecord mutation**:
    - Call `requireMember(context)` 
    - Use `context.db.collection('records')`
    - Verify record belongs to current tenant (filter by tenantId)
    - Return updated record
  - **deleteRecord mutation**:
    - Call `requireMember(context)`
    - Use `context.db.collection('records')`
    - Verify record belongs to current tenant
    - Return deletion result
  - **addUserToTenant mutation** (tenant management):
    - Call `requireAdmin(context)` - throw if not ADMIN
    - Call backend tenants service (already added in Phase 3)
  - **updateUserTenantRole mutation** (if created):
    - Call `requireAdmin(context)`
    - Verify target user and role update
- [ ] Add `tenantId` field to all record operations for tenant isolation verification

#### 4.6 Authorization Utilities
- [ ] Create `packages/backend/src/utils/authorization.ts`:
  ```typescript
  import { AuthorizationError } from 'apollo-server-express';
  import { GraphQLContext } from '../types/context';

  export function requireRole(
    context: GraphQLContext,
    allowedRoles: string[]
  ): void {
    if (!allowedRoles.includes(context.tenantRole)) {
      throw new AuthorizationError(
        `User role ${context.tenantRole} not authorized. Required: ${allowedRoles.join(', ')}`
      );
    }
  }

  export function isAdmin(context: GraphQLContext): boolean {
    return context.tenantRole === 'ADMIN';
  }

  export function isMember(context: GraphQLContext): boolean {
    return context.tenantRole === 'ADMIN' || context.tenantRole === 'MEMBER';
  }

  export function requireAdmin(context: GraphQLContext): void {
    if (!isAdmin(context)) {
      throw new AuthorizationError('Admin role required for this operation');
    }
  }

  export function requireMember(context: GraphQLContext): void {
    if (!isMember(context)) {
      throw new AuthorizationError('Member or Admin role required for this operation');
    }
  }

  export function canWrite(context: GraphQLContext): boolean {
    return isMember(context);
  }

  export function canRead(context: GraphQLContext): boolean {
    // All roles can read
    return true;
  }
  ```
- [ ] Import and use in resolvers:
  - `requireAdmin(context)` before admin-only mutations (tenant management, user role updates)
  - `requireMember(context)` before record mutations (create, update, delete)
  - `canRead(context)` before queries (informational check, all roles pass)

#### 4.7 Authorization Enforcement in Resolvers
- [ ] Apply authorization checks in `packages/backend/src/graphql/resolvers.ts`:
  - Import: `requireAdmin`, `requireMember`, `canWrite`, `canRead` from utils/authorization
  - Tenant management mutations (createTenant, addUserToTenant, removeUserFromTenant, updateUserTenantRole):
    - Add `requireAdmin(context)` at start of resolver
  - Record mutations (createRecord, updateRecord, deleteRecord):
    - Add `requireMember(context)` at start of resolver
  - Queries (records, lookupBarcode):
    - Call `canRead(context)` (verify all roles can read)
    - Or add optional `canRead(context)` check for logging/auditing
- [ ] Update error messages to be user-friendly
- [ ] Ensure authorization errors bubble up to Apollo error handling

**Verification Checklist:**
- [ ] Context type defined with all required fields ✓
- [ ] Apollo Server context builder extracts JWT and populates context ✓
- [ ] Invalid JWT tokens are rejected with AuthenticationError ✓
- [ ] releasesCache service accepts db parameter in all functions ✓
- [ ] All query resolvers use context.db for data access ✓
- [ ] All mutations have authorization checks ✓
- [ ] Authorization utilities prevent unauthorized access ✓
- [ ] Barcode cache isolated per tenant (different tenants can have different cache entries) ✓
- [ ] Records query filters to current tenant only ✓
- [ ] Cross-tenant data access impossible (queries always scoped to context.tenantId) ✓
- [ ] No TypeScript compilation errors ✓
- [ ] Lint passes ✓
- [ ] Test with different tenant contexts (manually switch JWT) ✓

---

## Phase 5: GitHub Organization Sync

**Goal:** Sync GitHub organization membership on user login, create org tenants, sync membership, support multiple org tenants.

**Duration:** 3-4 days

**Phase 5 Checklist (execute in order):**
1) GitHub API service: create `packages/bff/src/services/githubOrgs.ts` with `getUserOrganizations(accessToken)` and `getOrganizationMembers(orgName, accessToken)` functions; handle pagination and rate limiting.
2) Organization sync service: create `packages/bff/src/services/orgSync.ts` with `syncUserOrganizations(userId, githubId, accessToken, registryDb, backendClient)` function to fetch user's GitHub orgs, create/sync org tenants for each, sync membership per org.
3) Backend GraphQL service extension: ensure backend can accept org sync operations (create org tenants, add users to orgs); add error handling for missing orgs or failed tenant creation.
4) BFF GitHub callback update: update `packages/bff/src/auth/github.ts` to call `syncUserOrganizations()` after personal tenant creation; set initial activeTenantId (personal unless user in single org, then prompt choice).
5) Session/JWT management: update BFF to track all user's org tenants in session; generate JWT with correct tenant context for currently active tenant.
6) Error handling: add comprehensive error handling for GitHub API failures, org sync failures, tenant creation failures; log errors, gracefully degrade (skip sync, continue login).
7) Verification: test login creates personal tenant, syncs all GitHub orgs, creates org tenants, adds user to each org with correct role, subsequent logins update membership, user removed from org loses access on re-login.

### Tasks

#### 5.1 GitHub API Integration Service
- [ ] Create `packages/bff/src/services/githubOrgs.ts`:
  ```typescript
  export interface GitHubOrganization {
    id: number;
    login: string;
    name?: string;
    avatarUrl?: string;
    description?: string;
  }

  export interface GitHubOrgMember {
    id: number;
    login: string;
    name?: string;
    avatarUrl?: string;
  }

  export async function getUserOrganizations(
    accessToken: string
  ): Promise<GitHubOrganization[]>
    - Fetch user's organizations via GitHub API: GET /user/orgs
    - Handle pagination (limit: 100, loop through pages)
    - Map response to GitHubOrganization interface
    - Handle rate limiting (return empty array if rate limited)
    - Error handling: log errors, return empty array on failure

  export async function getOrganizationMembers(
    orgName: string,
    accessToken: string
  ): Promise<GitHubOrgMember[]>
    - Fetch org members via GitHub API: GET /orgs/{org}/members
    - Handle pagination (limit: 100, loop through pages)
    - Map response to GitHubOrgMember interface
    - Handle rate limiting (return empty array if rate limited)
    - Error handling: log errors, return empty array on failure
  ```
- [ ] Import axios or fetch for HTTP requests
- [ ] Add rate limit detection (check X-RateLimit-Remaining header)
- [ ] Add retry logic for transient failures
- [ ] Add comprehensive logging for debugging

#### 5.2 Organization Sync Service
- [ ] Create `packages/bff/src/services/orgSync.ts`:
  ```typescript
  import { Db } from 'mongodb';
  import type { BackendClient } from './backendClient.js';
  import { getUserOrganizations, getOrganizationMembers } from './githubOrgs.js';

  export interface OrgSyncResult {
    personalTenantId: string;
    organizationTenants: Array<{
      tenantId: string;
      name: string;
      role: 'ADMIN' | 'MEMBER' | 'VIEWER';
    }>;
    syncedAt: Date;
  }

  export async function syncUserOrganizations(
    userId: string,
    githubId: number,
    githubLogin: string,
    accessToken: string,
    registryDb: Db,
    backendClient: BackendClient
  ): Promise<OrgSyncResult>
  ```
  - Step 1: Fetch user's GitHub organizations
    - Call `getUserOrganizations(accessToken)`
    - Handle errors gracefully (log, continue with empty list)
  - Step 2: Get user's existing tenants from registry
    - Query `user_tenant_roles` for userId
    - Join with `tenants` collection
    - Separate personal tenant (tenantType: USER) from org tenants (tenantType: ORGANIZATION)
  - Step 3: For each GitHub org, sync org tenant
    - Check if org tenant exists (by githubOrgId)
    - If not exists: create org tenant via backend `createTenant` mutation
    - If exists: verify user is member, update membership
    - Add user to org tenant if not already added (via backend `addUserToTenant`)
    - Update user's role if changed
  - Step 4: For each existing org tenant in registry
    - Check if user is still member of that org on GitHub
    - If user removed from org: call backend to remove from tenant (or update role to VIEWER with note)
  - Step 5: Fetch and sync org members (for org management)
    - For each org tenant user is ADMIN of:
      - Call `getOrganizationMembers(orgName, accessToken)`
      - Sync members into org tenant (add missing, remove departed)
      - Handle errors gracefully (skip member sync if fails)
  - Return result with all user's tenants and sync timestamp

#### 5.3 BFF Backend Client Integration
- [ ] Update `packages/bff/src/services/backendClient.ts`:
  - Add method to create organization tenants:
    ```typescript
    async createOrganizationTenant(
      input: {
        tenantType: 'ORGANIZATION';
        name: string;
        githubOrgId: string;
        githubOrgName?: string;
      }
    ): Promise<{ tenantId: string; name: string; databaseName: string }>
    ```
  - Add method to add user to tenant:
    ```typescript
    async addUserToTenant(
      userId: string,
      tenantId: string,
      role: 'ADMIN' | 'MEMBER' | 'VIEWER'
    ): Promise<{ userId: string; tenantId: string; role: string }>
    ```
  - Add method to get user's tenants:
    ```typescript
    async getUserTenants(userId: string): Promise<Array<{
      tenantId: string;
      name: string;
      tenantType: string;
      role: string;
    }>>
    ```
  - Add error handling and logging for all mutations
  - Handle GraphQL errors (authorization, not found, duplicate)

#### 5.4 GitHub Callback Update
- [ ] Update `packages/bff/src/auth/github.ts`:
  - After personal tenant creation:
    1. Fetch user's GitHub access token (already have from OAuth callback)
    2. Call `syncUserOrganizations(userId, githubId, githubLogin, accessToken, registryDb, backendClient)`
    3. Get result with all organization tenants
  - Set initial activeTenantId:
    - If user has 1 org tenant: show selection prompt or auto-select with message
    - If user has multiple org tenants: show selection UI or default to personal
    - If user has no org tenants: default to personal tenant
  - Store available tenants in session for later use
  - Handle sync errors gracefully:
    - Log error and continue login (don't block login on sync failure)
    - Set activeTenantId to personal tenant as fallback
  - Sign JWT with initial activeTenantId and correct role

#### 5.5 Session and JWT Management
- [ ] Update `packages/bff/src/types/session.ts`:
  - Add `availableOrganizations?: Array<{ tenantId: string; name: string; role: string; }>`
  - Keep `activeTenantId` for current active tenant
  - Add `syncedOrgsAt?: Date` to track when orgs were last synced
- [ ] Update `packages/bff/src/auth/jwt.ts`:
  - Ensure JWT payload includes correct `tenantRole` for active tenant
  - Map GitHub role to tenant role when signing JWT for org tenants
- [ ] Update BFF GitHub callback to populate session with all user's tenants

#### 5.6 Error Handling & Logging
- [ ] Add comprehensive error handling throughout orgSync flow:
  - GitHub API errors (rate limit, not found, auth failed)
  - Backend mutation errors (tenant creation failed, add user failed)
  - Registry database errors (query failed, insert failed)
  - Handle errors without blocking login process
  - Log all errors with context (userId, orgName, action)
- [ ] Add debug logging for tracing sync process:
  - Log when org sync starts/completes
  - Log each org processed
  - Log tenant creation/update operations
  - Log member sync operations
- [ ] Implement graceful degradation:
  - If GitHub API fails: sync what we can, continue with existing tenants
  - If tenant creation fails for an org: skip that org, continue with others
  - If member sync fails: skip member sync, continue with user sync
  - Always complete login even if sync partially fails

#### 5.7 Integration with Phase 3 & 4
- [ ] Ensure `createOrganizationTenant` mutation in backend works correctly
- [ ] Verify `addUserToTenant` respects first-user ADMIN logic (from Phase 3)
- [ ] Verify authorization checks in backend allow org membership sync (Phase 4)
- [ ] Test that JWT contains correct tenant context for org tenants

**Verification Checklist:**
- [ ] GitHub API service fetches user's orgs with pagination ✓
- [ ] GitHub API service fetches org members with pagination ✓
- [ ] Organization sync creates org tenant for each user's GitHub org ✓
- [ ] Organization sync adds user to each org tenant ✓
- [ ] First user in org tenant automatically gets ADMIN role ✓
- [ ] Subsequent org members get VIEWER role by default ✓
- [ ] User removed from GitHub org loses access on next login ✓
- [ ] User added to new GitHub org gets added to org tenant on next login ✓
- [ ] Multiple org tenants supported per user (no limit) ✓
- [ ] Session tracks all user's available tenants ✓
- [ ] Session tracks active tenant ID ✓
- [ ] JWT generated with correct org tenant context ✓
- [ ] Org sync handles GitHub API errors gracefully ✓
- [ ] Org sync handles backend errors gracefully ✓
- [ ] Login not blocked if org sync fails ✓
- [ ] Personal tenant always created and set as fallback ✓
- [ ] Org member sync works (add/remove members) ✓
- [ ] Rate limiting handled appropriately ✓
- [ ] Comprehensive logging for debugging ✓
- [ ] No TypeScript compilation errors ✓
- [ ] Lint passes ✓
- [ ] Test with multiple GitHub orgs ✓
- [ ] Test with user removed from org ✓
- [ ] Test with user added to new org ✓

---

## Phase 6: Tenant Switching UI & API

**Goal:** Enable users to switch between personal and organization tenants with a complete UI and API implementation.

**Duration:** 3 days

**Phase 6 Checklist (execute in order):**
1) BFF GraphQL schema: Add `Tenant` type, `availableTenants`, `activeTenant`, `switchTenant` mutation
2) BFF resolvers: Implement `viewer` query with tenant data, `switchTenant` mutation logic
3) BFF session helpers: Add `getTenantContext()` to read active tenant with role info
4) Backend schema: Verify `userTenants` query exists (added in Phase 5, now used by BFF)
5) Frontend auth context: Add `activeTenant` and `availableTenants` to auth state
6) Frontend TenantSwitcher component: Create dropdown UI for switching tenants
7) Frontend Header: Integrate TenantSwitcher and display current tenant
8) Relay schema: Regenerate for updated GraphQL types
9) Manual testing: Verify switching works, persists, and returns correct data
10) Verification: No TypeScript errors, lint passes, all tests pass

### Task Details

#### Task 1: BFF GraphQL Schema - Tenant Type & Queries
**File:** `packages/bff/src/schema.graphql`

Add the following:
```graphql
# Represents a tenant available to the user
type Tenant {
  id: String!
  name: String!
  type: TenantType!
  role: TenantRole!
}

enum TenantType {
  USER
  ORGANIZATION
}

enum TenantRole {
  ADMIN
  MEMBER
  VIEWER
}

# Extend User type to include tenant information
extend type User {
  availableTenants: [Tenant!]!
  activeTenant: Tenant
}

# Extend Mutation with tenant switching
extend type Mutation {
  """
  Switch the active tenant for the current user.
  Updates session and returns user with new active tenant context.
  """
  switchTenant(tenantId: String!): User!
}
```

**Checklist:**
- [ ] Add `Tenant` type with `id`, `name`, `type`, `role` fields
- [ ] Add `TenantType` enum (USER, ORGANIZATION)
- [ ] Add `TenantRole` enum (ADMIN, MEMBER, VIEWER)
- [ ] Extend `User` type with `availableTenants: [Tenant!]!`
- [ ] Extend `User` type with `activeTenant: Tenant`
- [ ] Extend `Mutation` with `switchTenant(tenantId: String!): User!`
- [ ] Schema compiles without errors
- [ ] Lint passes

---

#### Task 2: BFF Resolvers - viewer Query & switchTenant Mutation
**File:** `packages/bff/src/graphql/resolvers.ts`

Implement the following resolvers:

**viewer Query:**
```typescript
viewer: async (_parent: unknown, _args: unknown, context: GraphQLContext) => {
  // Verify user is authenticated
  if (!context.user) {
    return null;
  }

  // Get available tenants from session (populated at login)
  const availableTenants = getAvailableTenants(context.session) || [];
  
  // Get active tenant from session
  const activeTenantId = getActiveTenant(context.session);
  const activeTenant = availableTenants.find(t => t.id === activeTenantId);

  return {
    ...context.user,
    availableTenants,
    activeTenant: activeTenant || null,
  };
}
```

**switchTenant Mutation:**
```typescript
switchTenant: async (
  _parent: unknown,
  _args: { tenantId: string },
  context: GraphQLContext
) => {
  // Verify user is authenticated
  if (!context.user || !context.session) {
    throw new Error('Unauthorized: user not authenticated');
  }

  const { tenantId } = _args;

  // Get available tenants from session
  const availableTenants = getAvailableTenants(context.session) || [];
  
  // Verify user has access to target tenant
  const targetTenant = availableTenants.find(t => t.id === tenantId);
  if (!targetTenant) {
    throw new Error(`Unauthorized: user does not have access to tenant ${tenantId}`);
  }

  // Update session active tenant
  setActiveTenant(context.session, tenantId);
  
  // Save session changes
  await new Promise<void>((resolve, reject) => {
    context.session.save((err) => {
      if (err) reject(err);
      else resolve();
    });
  });

  console.log(`[resolvers] User switched to tenant: ${tenantId}`);

  // Return updated user with new active tenant
  return {
    ...context.user,
    availableTenants,
    activeTenant: targetTenant,
  };
}
```

**Checklist:**
- [ ] Update `viewer` query to fetch `availableTenants` from session
- [ ] Update `viewer` query to fetch `activeTenant` from session
- [ ] Map session tenant data to GraphQL `Tenant` type
- [ ] Implement `switchTenant` mutation with access validation
- [ ] Verify target tenant exists in user's available tenants
- [ ] Update session `activeTenantId` on successful switch
- [ ] Save session changes (use Promise wrapper for async callback)
- [ ] Return updated user object with new tenant context
- [ ] Add logging: `[resolvers] User switched to tenant: {tenantId}`
- [ ] Handle errors gracefully (unauthorized, tenant not found)
- [ ] TypeScript compiles without errors
- [ ] Lint passes

---

#### Task 3: BFF Session Helpers - getTenantContext
**File:** `packages/bff/src/types/session.ts`

Add helper function to retrieve current tenant context:

```typescript
/**
 * Get the current tenant context for a user (active tenant + role)
 * Used by BFF resolvers to return tenant-aware data
 */
export function getTenantContext(
  session: Session,
  availableTenants?: AvailableTenant[]
): AvailableTenant | undefined {
  const activeTenantId = getActiveTenant(session);
  if (!activeTenantId || !availableTenants) {
    return undefined;
  }
  return availableTenants.find(t => t.id === activeTenantId);
}
```

**Checklist:**
- [ ] Add `getTenantContext()` helper function
- [ ] Accept `session` and optional `availableTenants` parameters
- [ ] Return active tenant with role info or undefined
- [ ] Add JSDoc comments
- [ ] TypeScript compiles without errors

---

#### Task 4: Backend Schema Verification
**File:** `packages/backend/src/schema.graphql`

Verify the following query exists (should be from Phase 5):

```graphql
userTenants(userId: ID!): [UserTenantRole!]!
```

This query is used by BFF to fetch available tenants when needed.

**Checklist:**
- [ ] `userTenants` query exists in schema
- [ ] Query accepts `userId: ID!` parameter
- [ ] Returns `[UserTenantRole!]!` array
- [ ] Schema compiles without errors

---

#### Task 5: Frontend Auth Context - Add Tenant State
**File:** `packages/frontend/src/contexts/AuthContext.tsx`

Extend auth context to include tenant information:

```typescript
interface AuthContextType {
  user: SessionUser | null;
  activeTenant: AvailableTenant | null;
  availableTenants: AvailableTenant[];
  isLoading: boolean;
  login: () => void;
  logout: () => void;
  switchTenant: (tenantId: string) => Promise<void>;
}

interface AvailableTenant {
  id: string;
  name: string;
  type: 'USER' | 'ORGANIZATION';
  role: 'ADMIN' | 'MEMBER' | 'VIEWER';
}
```

Update `useEffect` to populate tenant data from viewer query response.

**Checklist:**
- [ ] Add `activeTenant: AvailableTenant | null` to context
- [ ] Add `availableTenants: AvailableTenant[]` to context
- [ ] Add `switchTenant(tenantId: string)` function to context
- [ ] Extract tenant data from viewer query response
- [ ] Update context when switching tenants
- [ ] Handle errors during tenant switch
- [ ] Add logging for tenant changes
- [ ] TypeScript compiles without errors
- [ ] Lint passes

---

#### Task 6: Frontend TenantSwitcher Component
**File:** `packages/frontend/src/components/TenantSwitcher.tsx` (new file)

Create a dropdown/modal component for switching tenants:

```typescript
import React, { useState } from 'react';
import { useAuthContext } from '../contexts/AuthContext';

export function TenantSwitcher() {
  const { activeTenant, availableTenants, switchTenant } = useAuthContext();
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleSwitch = async (tenantId: string) => {
    setIsLoading(true);
    try {
      await switchTenant(tenantId);
      setIsOpen(false);
    } catch (error) {
      console.error('Failed to switch tenant:', error);
    } finally {
      setIsLoading(false);
    }
  };

  if (!activeTenant || availableTenants.length <= 1) {
    return null; // Don't show if only one tenant
  }

  return (
    <div className="tenant-switcher">
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="tenant-button"
      >
        {activeTenant.name}
        <span className="tenant-type">({activeTenant.type})</span>
      </button>

      {isOpen && (
        <div className="tenant-menu">
          {availableTenants.map(tenant => (
            <button
              key={tenant.id}
              onClick={() => handleSwitch(tenant.id)}
              disabled={isLoading || tenant.id === activeTenant.id}
              className={`tenant-option ${
                tenant.id === activeTenant.id ? 'active' : ''
              }`}
            >
              <div className="tenant-name">{tenant.name}</div>
              <div className="tenant-meta">
                <span className="type">{tenant.type}</span>
                <span className="role">{tenant.role}</span>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
```

**Checklist:**
- [ ] Create new `TenantSwitcher.tsx` component file
- [ ] Implement dropdown menu UI
- [ ] Show all available tenants in list
- [ ] Highlight current active tenant
- [ ] Display tenant name, type, and user's role
- [ ] Call `switchTenant` mutation on selection
- [ ] Handle loading state during switch
- [ ] Handle errors gracefully
- [ ] Hide switcher if only 1 tenant
- [ ] Add basic styling (CSS module or Tailwind)
- [ ] TypeScript compiles without errors
- [ ] Lint passes

---

#### Task 7: Frontend Header Integration
**File:** `packages/frontend/src/components/Header.tsx`

Update Header component to include TenantSwitcher:

```typescript
import { TenantSwitcher } from './TenantSwitcher';

export function Header() {
  // ... existing code ...

  return (
    <header className="header">
      <div className="header-content">
        <div className="header-left">
          {/* Logo and navigation */}
        </div>

        <div className="header-right">
          <TenantSwitcher />
          
          <div className="user-menu">
            {/* User profile, logout, etc. */}
          </div>
        </div>
      </div>
    </header>
  );
}
```

**Checklist:**
- [ ] Import `TenantSwitcher` component
- [ ] Add `<TenantSwitcher />` to header layout
- [ ] Position tenant switcher before user menu
- [ ] Ensure responsive layout on mobile
- [ ] Test on small screens
- [ ] TypeScript compiles without errors
- [ ] Lint passes

---

#### Task 8: Relay Schema Regeneration
**Command:** `pnpm --filter frontend relay`

This regenerates Relay schema from updated GraphQL types.

**Checklist:**
- [ ] Run: `pnpm --filter frontend relay`
- [ ] Verify command completes successfully
- [ ] Check for generated schema updates
- [ ] No errors or warnings
- [ ] Commit generated files

---

#### Task 9: Manual Testing & Verification
**Instructions:**

1. **Setup:** Start dev environment - `pnpm dev`

2. **Test Tenant Switching:**
   - [ ] Login with account that has multiple tenants
   - [ ] Verify `availableTenants` list appears in Header
   - [ ] Verify current tenant is highlighted
   - [ ] Click to switch to different tenant
   - [ ] Verify UI updates immediately
   - [ ] Verify session persists selection on page refresh

3. **Test Data Isolation:**
   - [ ] Create a record in personal tenant
   - [ ] Switch to organization tenant
   - [ ] Verify record not visible (different tenant)
   - [ ] Switch back to personal tenant
   - [ ] Verify record visible again

4. **Test Role Display:**
   - [ ] Verify personal tenant shows role: ADMIN
   - [ ] Verify org tenants show role: VIEWER or ADMIN
   - [ ] Different roles visible in switcher

5. **Test Error Handling:**
   - [ ] Try to switch to invalid tenant (if possible)
   - [ ] Verify error message displayed
   - [ ] Verify UI remains stable

6. **Test Permissions:**
   - [ ] Verify can only switch to tenants user is member of
   - [ ] Verify cannot switch to other users' tenants

**Checklist:**
- [ ] User sees TenantSwitcher in header
- [ ] Can switch between 2+ tenants
- [ ] Switching updates UI immediately
- [ ] Switching persists across page refresh
- [ ] Data isolation works (records not shared)
- [ ] Role information displayed correctly
- [ ] Error messages clear
- [ ] No console errors
- [ ] No broken UI elements

---

#### Task 10: Final Verification
**File:** Multiple files

Run full verification suite:

```bash
# Type check
pnpm build

# Lint
pnpm lint

# Test (if tests exist)
pnpm test

# Manual verification - login and test switching
pnpm dev
```

**Checklist:**
- [ ] `pnpm build` completes without errors
- [ ] No TypeScript compilation errors
- [ ] No TypeScript compilation warnings
- [ ] `pnpm lint` passes (no linting errors)
- [ ] All tests pass
- [ ] No console warnings during manual testing
- [ ] Feature works end-to-end
- [ ] Ready to commit

### Implementation Notes

**Important Considerations:**

1. **Session Persistence:**
   - `activeTenantId` must be saved to session on every switch
   - Session must survive page refresh
   - Consider using HTTP-only cookies for security

2. **Data Isolation:**
   - Ensure BFF passes correct `tenantId` to backend queries
   - Backend enforces data isolation via context
   - Test that records from one tenant don't leak to another

3. **Role-Based Features:**
   - ADMIN: Can manage tenant members, delete tenant
   - MEMBER: Can create/edit records in tenant
   - VIEWER: Read-only access
   - Frontend may need to show/hide features based on role

4. **Error Handling:**
   - User removed from organization between login and switch
   - Session tenant invalid (should refresh available tenants)
   - Network error during switch
   - Handle all gracefully without losing user data

5. **Performance:**
   - Avoid re-fetching available tenants on every action
   - Cache available tenants in auth context
   - Only refetch on login or explicit user action

6. **Accessibility:**
   - Dropdown keyboard navigation (arrow keys, enter)
   - Screen reader support (ARIA labels)
   - Clear visual focus indicators

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

**Decision:** ✅ **ADMIN for first user, VIEWER for subsequent members**
- First user to access an org tenant gets ADMIN role automatically
- Subsequent organization members get VIEWER role by default
- ADMIN can promote members to MEMBER or ADMIN later
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

### 5. Multiple Organization Tenants Per User
**Question:** Should we limit number of tenants per user?

**Decision:** ✅ **Allow multiple organization tenants**
- 1 personal tenant (user_{userId}) - always created on signup
- Multiple organization tenants (optional) - user can join any number of GitHub organizations
- No artificial limits; each org becomes a separate tenant for data isolation
- Org sync: create or sync tenant for each org the user is a member of
- Provides flexibility for users active in multiple communities
- Tenant switching allows users to select active context

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
