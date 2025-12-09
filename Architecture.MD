# Vinyl Vault – Architecture

## 1. Overview

Vinyl Vault is a web application for managing vinyl record collections with multi-tenant support. Users can manage personal collections or collaborate within GitHub organization collections. The system scans barcodes on record sleeves, looks up metadata from external music databases, and stores collections in isolated MongoDB databases per tenant. The solution is built as a public-facing system running on a Raspberry Pi 5, with a security-focused design and a Backend-for-Frontend (BFF) proxy.

## 2. Goals and Constraints

- Minimize manual data entry for vinyl records.
- Keep all JWTs and backend secrets away from the browser.
- Use GitHub as the single sign-on provider.
- Support multi-tenant collections (personal and GitHub organizations).
- Support role-based access per tenant: ADMIN/CONTRIBUTOR and READER.
- Provide strict tenant isolation with database-per-tenant architecture.
- Run on a single RPi 5 with limited resources but public internet exposure.
- Prefer clear, maintainable TypeScript code across backend and frontend.
- Use pnpm workspaces for monorepo management.

## 3. Logical Architecture

Main components:

- **React/Relay Web Client** (`packages/frontend`)
  - Vite-powered SPA served over HTTPS.
  - Talks only to the BFF GraphQL endpoint.
  - Uses Tailwind CSS for styling.
  - AuthContext manages user state and current tenant selection via `/auth/me` endpoint.
  - Tenant switcher component allows users to switch between personal and organization collections.
  - Barcode scanning via @zxing/browser library (camera + manual input).
  - Mobile-first design with bottom navigation for authenticated users.
  - Views: Home (welcome), Scan (barcode lookup with album results), Collection (placeholder), Search (placeholder), Tenant Selector.

- **GraphQL BFF** (`packages/bff`)
  - Express + Apollo Server 4.
  - Exposes a Relay-friendly GraphQL schema.
  - Handles GitHub OAuth Web Application Flow:
    - `/auth/github` - Initiates OAuth redirect.
    - `/auth/github/callback` - Exchanges code for token, creates session.
    - `/auth/logout` - Destroys session.
    - `/auth/me` - Returns current user and available tenants.
    - `/auth/tenants` - Lists user's accessible tenants (personal + orgs).
    - `/auth/switch-tenant` - Switches active tenant in session.
    - `/auth/setup` - Handles post-installation redirect from GitHub App to link user and create org tenant.
  - Uses `express-session` with `connect-mongo` for session storage.
  - HTTP-only secure cookies for browser sessions.
  - Session includes current tenant context (tenantId, tenantType).
  - Creates short-lived JWTs with tenant context for calls to the Domain Backend.
  - Receives GitHub App webhook events and integrates with backend for org tenant creation.

- **Domain Backend** (`packages/backend`)
  - Apollo Server (standalone).
  - Encapsulates business logic and data access.
  - Validates JWTs from the BFF (user id, role, tenantId, tenantType).
  - Enforces strict tenant isolation on all database operations.
  - Manages dynamic connections to tenant-specific MongoDB databases.
  - Interacts with tenant MongoDB databases for users, records, and releases.
  - Integrates with external music APIs (Discogs/MusicBrainz) queried in parallel.
  - Implements blended scoring system for release aggregation into Albums.
  - Provides detailed score breakdowns for transparency and debugging.
  - Caches release metadata per tenant to ensure data isolation.

- **MongoDB** (Multiple Instances)
  - **BFF MongoDB** (`MONGODB_URI`): Stores only session information via `connect-mongo`.
  - **Tenant MongoDB Databases** (Dynamic `MONGODB_URI_BASE` + tenantId):
    - Each tenant has a completely separate MongoDB database.
    - Database naming: `vinylvault_user_{userId}` for personal tenants, `vinylvault_org_{orgId}` for organization tenants (using GitHub org ID for stability).
    - Stores tenant-specific data: users, records, and releases.
    - Complete logical and physical isolation between tenants.
    - Users can be members of multiple organization tenants.
  - **Central Registry** (`MONGODB_REGISTRY_URI`): Stores user-tenant-role mappings and tenant metadata.
  - Running via Docker for development (see `infra/docker-compose.yml`).

- **External APIs**
  - Music metadata APIs (Discogs, MusicBrainz) for barcode lookups.
  - GitHub OAuth for authentication.

## 4. Deployment Architecture

Target deployment on Raspberry Pi 5:

- Reverse Proxy (e.g., Caddy, Nginx, or Traefik)
  - Terminates TLS (Let’s Encrypt) and enforces HTTPS.
  - Routes `/graphql` and `/auth/*` to the BFF.
  - Serves static frontend assets.
- BFF Container/Service
  - Listens on an internal port.
  - Accessible only via the reverse proxy.
- Domain Backend Container/Service
  - Listens on an internal port.
  - Accessible only from the BFF (enforced by Docker network / firewall).
- MongoDB Container/Service
  - Bound to localhost or internal Docker network.
  - Not exposed to the internet. [web:13][web:16][web:19]

Security hardening on the Pi:

- Hardened SSH (keys only, no password, non-root login). [web:13][web:19]
- OS kept up to date with security patches.
- Firewall restricting inbound traffic to HTTPS (and SSH from trusted networks). [web:13][web:16]

## 5. Key Cross-Cutting Concepts

### 5.1 Authentication and Sessions

**GitHub OAuth Web Application Flow:**

1. User clicks "Sign in with GitHub" → frontend redirects to `/auth/github`.
2. BFF redirects to GitHub authorization URL with `client_id` and `redirect_uri`.
3. User authorizes on GitHub → GitHub redirects to `/auth/github/callback` with code.
4. BFF exchanges code for access token via GitHub API.
5. BFF fetches user profile from GitHub API.
6. BFF calls Backend GraphQL mutation to create/update user in Backend MongoDB `users` collection.
7. BFF creates session (stored in BFF MongoDB via `connect-mongo`).
8. BFF sets HTTP-only session cookie and redirects to frontend.

**Session Management:**

- Sessions stored in BFF MongoDB `sessions` collection (via `connect-mongo`).
- Cookie: `vinylvault.sid`, HTTP-only, secure in production.
- Session contains: `userId`, `githubId`, `username`, `role`, `avatarUrl`, `displayName`, `tenantId`, `tenantType`, `availableTenants`, `createdAt`, `updatedAt`.
- Frontend fetches user and tenant info via `/auth/me` endpoint on load.
- Users can switch tenants via `/auth/switch-tenant` endpoint, updating session context.
- No backend JWT is exposed to the browser.

**Data Flow Between BFF and Backend:**

- BFF never writes directly to any tenant MongoDB database.
- All tenant operations (create, update, fetch) are forwarded from BFF to Backend via GraphQL queries and mutations with tenant context.
- BFF stores only session data in its own MongoDB instance.
- Backend validates tenant context in JWT and routes operations to correct tenant database.

### 5.1.1 Dual Authentication Pattern

The system uses two complementary GitHub authentication modes:

**Mode 1: User Authentication**
- "Sign in with GitHub" button on login screen
- Provides: User avatar, email, GitHub username
- Result: User identification ("I am Martin")
- Scope: `read:user user:email read:org`
- Use: Personal tenant creation and user-scoped operations

**Mode 2: GitHub App Installation**
- "Add Organization" button allowing explicit app installation
- User directed to: `https://github.com/apps/<app-slug>/installations/new`
- GitHub displays only organizations where user has installation authority
- Provides: Installation ID and organization name
- Result: Organization-to-installation association ("Organization X can be managed by Installation ID")
- No additional scopes needed - installation flow grants necessary permissions automatically
- Use: Organization tenant creation with explicit user intent

**Integration Flow:**

1. Logged-in user clicks "Add Organization" button on frontend
2. Frontend redirects to GitHub App installation URL
3. GitHub validates user has installation authority for selected org(s)
4. User completes installation → GitHub sends `installation.created` webhook
5. Backend receives webhook with `installation_id` and `account.login` (org name) to `POST /webhook/github`
6. Backend validates webhook signature and stores installation in `installations` collection (registry)
7. GitHub redirects user to `/auth/setup?installation_id=...` (handled by BFF)
8. BFF verifies user is authenticated and calls backend mutation `completeInstallationSetup`
9. Backend links user to installation in `user_installation_roles` collection
10. Backend creates organization tenant and adds user as ADMIN
11. BFF updates session to include new org tenant in `availableTenants`
12. Frontend automatically switches to new org tenant and displays success message

**Advantages Over Automatic Sync:**
- Permission validation: GitHub filters orgs automatically - only shows ones user can manage
- Privacy: System only learns about orgs where user explicitly installs app
- User intent: Explicit action, not surprising automatic tenant creation
- Database efficiency: Only org tenants created when wanted
- No permission confusion: GitHub guarantees install only if user has authority
- Webhook-driven: Installation events create tenants in real-time, not on login

### 5.2 Authorization

**Role Model:**

- `ADMIN`: Full access within a tenant, can manage users and roles within that tenant.
- `CONTRIBUTOR`: Can add/update/delete own records within a tenant.
- `READER`: Read-only access to the collection within a tenant.

**Tenant Types:**

- `user`: Personal tenant, one per user. User is automatically ADMIN of their personal tenant.
- `org`: Organization tenant, derived from GitHub organization membership.

**Enforcement:**

- BFF enforces role-based access on GraphQL operations exposed to the client.
- Backend validates and trusts only JWTs signed by the BFF.
- JWT claims: `sub` (user id), `tenantId`, `tenantType`, `role` (within tenant), `iat`, `exp`, optional `github_login`.
- Backend enforces tenant isolation by validating tenantId in all operations.
- JWT secret configured via `JWT_SECRET` environment variable.
- JWT expiration configured via `JWT_EXPIRES_IN` (default: 15 minutes).

### 5.3 Data Model (Logical)

**User** (Tenant MongoDB `users` collection)
```
{
  _id: ObjectId,
  githubId: string,
  username: string,
  displayName: string,
  email: string | null,
  avatarUrl: string,
  role: 'ADMIN' | 'CONTRIBUTOR' | 'READER',  // Role within this tenant
  createdAt: Date,
  updatedAt: Date
}
```

**UserTenantRole** (Central Registry MongoDB `userTenantRoles` collection)
```
{
  _id: ObjectId,
  userId: string,           // User's GitHub ID
  tenantId: string,         // Tenant identifier
  tenantType: 'user' | 'org',
  role: 'ADMIN' | 'CONTRIBUTOR' | 'READER',
  createdAt: Date,
  updatedAt: Date
}
```

**Tenant** (Central Registry MongoDB `tenants` collection)
```
{
  _id: ObjectId,
  tenantId: string,         // Unique tenant identifier
  tenantType: 'user' | 'org',
  name: string,             // Display name
  githubOrgName: string | null,  // For org tenants
  databaseName: string,     // MongoDB database name for this tenant
  createdAt: Date,
  updatedAt: Date
}
```

**Session** (BFF MongoDB `sessions` collection)
- Managed automatically by `connect-mongo`.
- Contains session ID, expiry, current tenantId, and user data snapshot.

**Record** (Tenant MongoDB `records` collection)
- Represents a physical vinyl owned by a user within this tenant.
- Links to User and Release within the same tenant database.

**Release** (Tenant MongoDB `releases` collection)
- Cached metadata about a particular music release from an external source.
- Isolated per tenant to ensure data security.

**Album** (Aggregated from releases at query time)
- Normalized album combining data from multiple release sources.
- Contains: primary release with score breakdown, alternative releases, merged genres/styles, all external IDs.
- Created by the scoring orchestrator during barcode lookup.
- Includes score breakdown for traceability (QR-02): mediaType, countryPreference, trackListCompleteness, coverArt, labelInfo, catalogNumber, yearInfo, sourceBonus.

**Relationships:**
- User 1—N Record (within same tenant)
- Release 1—N Record (within same tenant)
- Album 1—N Release (grouped by normalized artist + title, within same tenant)
- User N—N Tenant (via UserTenantRole mapping)

### 5.4 External Integration

**Barcode Lookup Flow (Implemented with Blended Scoring):**
- Barcode scan from browser (camera via @zxing/browser or manual input) → BFF → Domain Backend.
- Backend extracts tenant context from JWT and connects to appropriate tenant database.
- The backend checks the tenant's local `releases` cache by barcode and returns cached candidates when available.
- If no cached release is found, the backend:
  1. Queries Discogs and MusicBrainz APIs **in parallel** via `orchestrator.ts`.
  2. Converts results to a unified `RawRelease` format.
  3. **Normalizes** text fields (lowercase, trim, remove articles like "The", "A", "An", remove edition affixes like "Remastered", "Deluxe").
  4. **Groups** releases by normalized artist + title into album candidates.
  5. **Scores** each release based on configurable weights:
     - Media type preference (vinyl/LP: +20)
     - Country preference (US/UK/AT/DE: +15, deprioritized RU/CN: -10)
     - Track list completeness (+25 for complete, +10 for partial)
     - Cover art availability (+15)
     - Label info (+10), Catalog number (+5)
     - Discogs source bonus (+5)
  6. **Selects primary release** (highest score, with deterministic tie-breaking by earliest year).
  7. **Aggregates** into `Album` objects with best track list, merged genres/styles, all external IDs.
  8. **Caches results** in the tenant's database for future lookups.
  9. Returns `Album` objects to the BFF with full score breakdowns for traceability.

**Scoring Configuration:**
- Stored in `packages/backend/config/scoring.json`.
- JSON Schema validation via `scoring.schema.json`.
- Configurable without code changes (FR-CF-1, FR-CF-2, FR-CF-3).
- Includes: weights, preferred/deprioritized countries, media types, normalization affixes, source-specific rules.

### 5.5 GraphQL API Design

**BFF GraphQL Schema (`packages/bff/src/schema.graphql`):**
- Relay-friendly schema with `Node` interface for refetchable objects.
- Queries: `viewer` (current user with tenant context), `node` (by ID), `records` (paginated tenant collection).
- Mutations: `scanBarcode` (tenant-scoped), `createRecord`, `updateRecord`, `deleteRecord`, `switchToPersonalTenant`, `switchToOrganizationTenant`.
- Key types: `User`, `Tenant`, `Record`, `Release`, `Album`, `ScoredRelease`, `ScoreBreakdown`.
- Connection types for pagination: `RecordConnection`, `RecordEdge`, `PageInfo`.
- Viewer includes `activeTenant`, `availableTenants[]`, and `role` within current tenant.

**Backend GraphQL Schema (`packages/backend/src/schema.graphql`):**
- Domain-centric schema for internal use by BFF.
- All operations execute within tenant database context (extracted from JWT).
- Queries: `user`, `record`, `release`, `releasesByBarcode`, `records` (all tenant-scoped), `tenant`, `userTenantRoles`.
- Mutations: `lookupBarcode` (uses tenant cache), `createRecord`, `updateRecord`, `deleteRecord`, `upsertUser`, `createTenant`, `addUserToTenant`, `removeUserFromTenant`, `updateUserTenantRole`.
- Full `Album` type with detailed scoring information and alternative releases.
- `LookupBarcodePayload` includes timing information for performance analysis.
- Tenant-aware authorization checks for admin-only mutations (tenant management).

**JWT Token Structure:**
- Issued by BFF, validated by Backend.
- Contains: `userId`, `username`, `avatarUrl`, `tenantId`, `tenantRole`.
- Backend extracts `tenantId` to dynamically connect to correct tenant database.
- Backend extracts `tenantRole` for authorization decisions (admin, member, viewer).
- Short-lived (15 minutes) to minimize stale tenant context.

**GitHub OAuth:**
- Browser interacts only with BFF's auth endpoints.
- GitHub tokens and secrets stay server-side.
- Configuration via environment variables:
  - `GITHUB_CLIENT_ID`
  - `GITHUB_CLIENT_SECRET`
  - `GITHUB_CALLBACK_URL`
  - `GITHUB_CALLBACK_URLS` (comma-separated list for multiple environments)
  - `GITHUB_ORG_SYNC_ENABLED` (enable/disable organization sync on login)

**GitHub App Installation Flow (Phase 6.5 - Planned):**

*Overview:* Shift from automatic GitHub organization sync on login to explicit user-driven app installation.

*Flow Diagram:*
```
┌─────────────────────────────────────┐
│ User clicks "Add Organization"      │
├─────────────────────────────────────┤
│ Redirects to GitHub App install URL │
│ https://github.com/apps/vinyl-...   │
└────────────┬────────────────────────┘
             │
             ↓
┌─────────────────────────────────────┐
│ GitHub displays orgs where user     │
│ has installation authority          │
│ (typically org owners/managers)     │
└────────────┬────────────────────────┘
             │
             ↓
┌─────────────────────────────────────┐
│ User clicks "Install"               │
│ GitHub validates permissions        │
│ (automatic - no access to restricted orgs)
└────────────┬────────────────────────┘
             │
      ┌──────┴───────┐
      ↓              ↓
┌────────────┐   ┌─────────────────┐
│ Webhook    │   │ Browser Redirect│
│ POST       │   │ to /setup       │
│ /webhook/  │   │ with installation
│ github     │   │ _id param       │
└────┬───────┘   └────────┬────────┘
     │                    │
     └────────┬───────────┘
              ↓
      ┌──────────────────┐
      │ Backend Links    │
      │ User to Install  │
      │ Creates Org      │
      │ Tenant           │
      └──────────────────┘
             ↓
      ┌──────────────────┐
      │ Org Tenant Ready │
      │ in Switcher      │
      └──────────────────┘
```

*New Endpoints:*
- `POST /webhook/github` - BFF/Backend webhook endpoint
  - Receives GitHub `installation.created` events
  - Validates webhook signature: `X-Hub-Signature-256` header verified with app webhook secret
  - Extracts: `installation_id`, `account.login` (org name), `account.type`
  - Stores installation record in `installations` collection
  - Returns 200 OK

- `GET /setup?installation_id=...&setup_action=install` - BFF endpoint
  - Requires authenticated user (session cookie validation)
  - Extracts `installation_id` from query parameter
  - Verifies user is authenticated (CSRF protection)
  - Links user to installation in `user_installation_roles` collection
  - Calls Backend to create organization tenant for the installation
  - Adds user as ADMIN role in new org tenant
  - Redirects to app with success message or error page

*New Database Collections (Registry Database):*

`installations` Collection:
```typescript
{
  _id: ObjectId,
  installation_id: number,        // GitHub installation ID (unique)
  account_login: string,          // Organization name (e.g., "acme-corp")
  account_type: 'User' | 'Organization',
  account_id: number,             // GitHub account ID
  repositories_count: number,     // (optional) number of repos
  created_at: Date,               // When app was installed
  updated_at: Date,
  
  // Who installed it
  installed_by_user_id: string,   // Local user ID who performed installation
  installed_at: Date
}
```

`user_installation_roles` Collection:
```typescript
{
  _id: ObjectId,
  user_id: string,                // Local user ID
  installation_id: number,        // Foreign key to installations (GitHub installation ID)
  org_name: string,               // Organization name (denormalized for easy lookup)
  role: 'OWNER' | 'MANAGER',      // User's role at time of installation (from GitHub org API)
  created_at: Date
}
```

*Security Considerations:*
- Webhook signature validation required: Always verify `X-Hub-Signature-256` header against app webhook secret
- Installation ID verification: Verify installation_id from URL matches webhook-received data (optional double-check)
- User authentication required: User must be authenticated (session cookie) to complete `/setup`
- CSRF protection: Validate session state during installation completion
- Rate limiting: Prevent duplicate installation attempts within short timeframe

*Configuration via environment variables:*
  - `GITHUB_APP_ID` - GitHub App application ID
  - `GITHUB_APP_PRIVATE_KEY` - GitHub App private key (PEM format, multi-line)
  - `GITHUB_APP_WEBHOOK_SECRET` - Webhook signature secret for HMAC-SHA256 validation
  - `GITHUB_APP_INSTALLATION_URL` - Installation URL (e.g., `https://github.com/apps/vinyl-vault/installations/new`)

**Environment Configuration:**
- All secrets stored in `.env` file (not committed to git).
- See `docs/GITHUB_OAUTH_SETUP.md` for OAuth setup guide.
- Multi-tenant MongoDB configuration:
  - `MONGODB_URI_BASE` - Base connection string for tenant databases (Backend)
  - `MONGODB_REGISTRY_URI` - Connection string for registry database (Backend)
  - `MONGODB_URI` - Connection string for BFF session storage
- External API tokens: `DISCOGS_API_TOKEN`, `MUSICBRAINZ_USER_AGENT`.

## 6. Quality Attributes

- **Security:**
  - JWT between BFF and backend only.
  - HTTPS, secure cookies (HTTP-only, SameSite=lax).
  - Minimal exposure of internal ports.
  - Hardened OS and MongoDB configuration.
  - Environment secrets never exposed to frontend.

- **Maintainability:**
  - TypeScript strict mode across all services.
  - pnpm monorepo with shared configurations.
  - Clear separation between BFF and domain backend.
  - Shared tsconfig base configuration.

- **Performance:**
  - Local MongoDB and caching of release metadata.
  - Lightweight traffic profile, suitable for RPi 5.
  - Vite for fast frontend development.

- **Availability:**
  - Designed for single-node deployment.
  - Docker Compose for service orchestration.
  - Can be containerized for cloud deployment later.

## 7. Project Structure

```
vinylvault/
├── packages/
│   ├── frontend/          # React + Relay + Vite
│   │   └── src/
│   │       ├── components/    # UI components (Header, ScanBarcode, etc.)
│   │       ├── contexts/      # React contexts (AuthContext)
│   │       ├── hooks/         # Custom hooks
│   │       ├── pages/         # Page components
│   │       ├── relay/         # Relay environment configuration
│   │       └── types/         # TypeScript type definitions
│   ├── bff/               # Express + Apollo Server
│   │   └── src/
│   │       ├── auth/          # GitHub OAuth handlers, JWT utilities
│   │       ├── config/        # Environment configuration
│   │       ├── db/            # MongoDB connection
│   │       ├── graphql/       # GraphQL schema and resolvers
│   │       ├── services/      # Backend client for forwarding requests
│   │       └── types/         # TypeScript types (context, session)
│   └── backend/           # Apollo Server (standalone)
│       ├── config/        # Scoring configuration
│       │   ├── scoring.json
│       │   └── scoring.schema.json
│       └── src/
│           ├── db/            # MongoDB connection and collections
│           ├── graphql/       # GraphQL schema and resolvers
│           ├── models/        # Data models
│           └── services/      # Business logic
│               ├── discogs.ts     # Discogs API client
│               ├── musicbrainz.ts # MusicBrainz API client
│               ├── releasesCache.ts # Release caching
│               ├── users.ts       # User management
│               └── scoring/       # Blended scoring module
│                   ├── types.ts
│                   ├── config.ts
│                   ├── normalize.ts
│                   ├── score.ts
│                   ├── aggregate.ts
│                   ├── orchestrator.ts
│                   └── index.ts
├── infra/                 # Docker, Caddy configs
├── docs/                  # Setup guides
├── .env                   # Environment variables (not in git)
├── pnpm-workspace.yaml    # Monorepo configuration
└── tsconfig.base.json     # Shared TypeScript config
```