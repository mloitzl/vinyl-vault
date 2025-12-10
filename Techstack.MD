# Vinyl Vault – Tech Stack

## 1. Overview

This document summarizes the technology choices for Vinyl Vault across frontend, backend, data, integration, and infrastructure. It is meant to guide implementation and onboarding.

**Monorepo Structure:** pnpm workspaces with three packages:
- `packages/frontend` - React SPA
- `packages/bff` - Backend-for-Frontend
- `packages/backend` - Domain Backend

## 2. Frontend (`packages/frontend`)

- **Language:** TypeScript (strict mode)
- **UI Library:** React 18
- **Data Layer:** Relay (React Relay)
- **Build Tooling:** Vite 5
- **Styling:** Tailwind CSS
- **Dev Server:** Port 3000 with proxy to BFF

**Key Dependencies:**
- `react`, `react-dom` - UI framework
- `react-relay` - GraphQL client
- `tailwindcss` - Utility-first CSS
- `vite` - Build tool and dev server
- `@zxing/browser` - Barcode scanning via camera

**Responsibilities:**

- Accept web requests from browser clients (GraphQL queries/mutations + session cookies).
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

- **Runtime:** Node.js (LTS) on Raspberry Pi 5
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

**Auth Endpoints:**
- `GET /auth/github` - Initiate OAuth flow
- `GET /auth/github/callback` - Handle OAuth callback
- `POST /auth/logout` - Destroy session
- `GET /auth/me` - Get current user

**Responsibilities:**

- Expose a Relay-friendly GraphQL schema (viewer, records, scanBarcode, etc.).
- Handle GitHub OAuth Web Application Flow.
- Forward user operations (create, update, fetch) to Backend via GraphQL queries and mutations.
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

**Responsibilities:**

- Expose domain-centric GraphQL schema (User, Record, Release, Album, Tenant).
- Implement tenant-scoped business logic and data access.
- Validate and decode JWTs from the BFF, extracting tenantId and tenantRole.
- Dynamically connect to tenant-specific MongoDB databases (vinylvault_user_{userId} or vinylvault_org_{orgName}).
- Enforce tenant isolation at database level - all queries execute against tenant database.
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

- **DBMS:** MongoDB 7 (running via Docker)
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

**Tenant Databases (`vinylvault_user_{userId}` or `vinylvault_org_{orgName}`):**
- `records` - Physical owned items for this tenant
- `releases` - Cached external metadata for this tenant
- `scoring_configs` - Custom scoring configuration for this tenant (optional override)

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
  databaseName: string,       // MongoDB database name (e.g., vinylvault_user_12345)
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

- **Host:** Raspberry Pi 5 (Linux)
- **Containerization:** Docker with Docker Compose
- **Reverse Proxy:** Caddy (configured in `infra/Caddyfile`)

**Infrastructure Files (`infra/`):**
- `docker-compose.yml` - Service orchestration
- `Caddyfile` - Reverse proxy configuration
- `Dockerfile.bff` - BFF container
- `Dockerfile.backend` - Backend container
- `Dockerfile.frontend` - Frontend container

**Process Management:**
- Docker restart policies for production.
- `pnpm dev` for development (runs all services in parallel).

**Logging:**
- Application logs to stdout.
- System logs via journalctl, rotated regularly.

**Monitoring (optional):**
- Lightweight tools (e.g., Prometheus node exporter + Grafana if desired).

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