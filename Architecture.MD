# Vinyl Vault – Architecture

## 1. Overview

Vinyl Vault is a web application for managing a personal vinyl record collection. Users scan barcodes on record sleeves, the system looks up metadata from external music databases, and the collection is stored in MongoDB. The solution is built as a public-facing system running on a Raspberry Pi 5, with a security-focused design and a Backend-for-Frontend (BFF) proxy.

## 2. Goals and Constraints

- Minimize manual data entry for vinyl records.
- Keep all JWTs and backend secrets away from the browser.
- Use GitHub as the single sign-on provider.
- Support two roles: ADMIN/CONTRIBUTOR and READER.
- Run on a single RPi 5 with limited resources but public internet exposure.
- Prefer clear, maintainable TypeScript code across backend and frontend.
- Use pnpm workspaces for monorepo management.

## 3. Logical Architecture

Main components:

- **React/Relay Web Client** (`packages/frontend`)
  - Vite-powered SPA served over HTTPS.
  - Talks only to the BFF GraphQL endpoint.
  - Uses Tailwind CSS for styling.
  - AuthContext manages user state via `/auth/me` endpoint.
  - Barcode scanning via @zxing/browser library (camera + manual input).
  - Mobile-first design with bottom navigation for authenticated users.
  - Views: Home (welcome), Scan (barcode lookup with album results), Collection (placeholder), Search (placeholder).

- **GraphQL BFF** (`packages/bff`)
  - Express + Apollo Server 4.
  - Exposes a Relay-friendly GraphQL schema.
  - Handles GitHub OAuth Web Application Flow:
    - `/auth/github` - Initiates OAuth redirect.
    - `/auth/github/callback` - Exchanges code for token, creates session.
    - `/auth/logout` - Destroys session.
    - `/auth/me` - Returns current user.
  - Uses `express-session` with `connect-mongo` for session storage.
  - HTTP-only secure cookies for browser sessions.
  - Creates short-lived JWTs for calls to the Domain Backend.

- **Domain Backend** (`packages/backend`)
  - Apollo Server (standalone).
  - Encapsulates business logic and data access.
  - Validates JWTs from the BFF (user id, role).
  - Interacts with Backend MongoDB for users, records, and releases.
  - Integrates with external music APIs (Discogs/MusicBrainz) queried in parallel.
  - Implements blended scoring system for release aggregation into Albums.
  - Provides detailed score breakdowns for transparency and debugging.

- **MongoDB** (`MONGODB_URI`)
  - Stores both session information (via `connect-mongo`) and domain data (users, records, releases).
  - In development, a single MongoDB instance is used.
  - In production, you may want to use separate instances for BFF (sessions only) and Backend (domain data) for security and scaling. This would require creating separate environment variables and updating the BFF and Backend configuration.
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
- Session contains: `userId`, `githubId`, `username`, `role`, `avatarUrl`, `displayName`, `createdAt`, `updatedAt`.
- Frontend fetches user via `/auth/me` endpoint on load.
- No backend JWT is exposed to the browser.

**Data Flow Between BFF and Backend:**

- BFF never writes directly to the Backend MongoDB.
- All user operations (create, update, fetch) are forwarded from BFF to Backend via GraphQL queries and mutations.
- BFF stores only session data in its own MongoDB instance.

### 5.2 Authorization

**Role Model:**

- `ADMIN`: Full access, can manage users and roles.
- `CONTRIBUTOR`: Can add/update/delete own records.
- `READER`: Read-only access to the collection.

**Enforcement:**

- BFF enforces role-based access on GraphQL operations exposed to the client.
- Backend validates and trusts only JWTs signed by the BFF.
- JWT claims: `sub` (user id), `role`, `iat`, `exp`, optional `github_login`.
- JWT secret configured via `JWT_SECRET` environment variable.
- JWT expiration configured via `JWT_EXPIRES_IN` (default: 15 minutes).

### 5.3 Data Model (Logical)

**User** (Backend MongoDB `users` collection)
```
{
  _id: ObjectId,
  githubId: string,
  username: string,
  displayName: string,
  email: string | null,
  avatarUrl: string,
  role: 'ADMIN' | 'CONTRIBUTOR' | 'READER',
  createdAt: Date,
  updatedAt: Date
}
```

**Session** (BFF MongoDB `sessions` collection)
- Managed automatically by `connect-mongo`.
- Contains session ID, expiry, and user data snapshot.

**Record** (Backend MongoDB `records` collection)
- Represents a physical vinyl owned by a user.
- Links to User and Release.

**Release** (Backend MongoDB `releases` collection)
- Cached metadata about a particular music release from an external source.

**Album** (Aggregated from releases at query time)
- Normalized album combining data from multiple release sources.
- Contains: primary release with score breakdown, alternative releases, merged genres/styles, all external IDs.
- Created by the scoring orchestrator during barcode lookup.
- Includes score breakdown for traceability (QR-02): mediaType, countryPreference, trackListCompleteness, coverArt, labelInfo, catalogNumber, yearInfo, sourceBonus.

**Relationships:**
- User 1—N Record
- Release 1—N Record (different owners or copies)
- Album 1—N Release (grouped by normalized artist + title)

### 5.4 External Integration

**Barcode Lookup Flow (Implemented with Blended Scoring):**
- Barcode scan from browser (camera via @zxing/browser or manual input) → BFF → Domain Backend.
- The backend checks a local `releases` cache by barcode and returns cached candidates when available (currently disabled to always use live scoring).
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
  8. Returns `Album` objects to the BFF with full score breakdowns for traceability.

**Scoring Configuration:**
- Stored in `packages/backend/config/scoring.json`.
- JSON Schema validation via `scoring.schema.json`.
- Configurable without code changes (FR-CF-1, FR-CF-2, FR-CF-3).
- Includes: weights, preferred/deprioritized countries, media types, normalization affixes, source-specific rules.

### 5.5 GraphQL API Design

**BFF GraphQL Schema (`packages/bff/src/schema.graphql`):**
- Relay-friendly schema with `Node` interface for refetchable objects.
- Queries: `viewer` (current user), `node` (by ID), `records` (paginated collection).
- Mutations: `scanBarcode`, `createRecord`, `updateRecord`, `deleteRecord`.
- Key types: `User`, `Record`, `Release`, `Album`, `ScoredRelease`, `ScoreBreakdown`.
- Connection types for pagination: `RecordConnection`, `RecordEdge`, `PageInfo`.

**Backend GraphQL Schema (`packages/backend/src/schema.graphql`):**
- Domain-centric schema for internal use by BFF.
- Queries: `user`, `record`, `release`, `releasesByBarcode`, `records`.
- Mutations: `lookupBarcode`, `createRecord`, `updateRecord`, `deleteRecord`, `upsertUser`, `updateUserRole`.
- Full `Album` type with detailed scoring information and alternative releases.
- `LookupBarcodePayload` includes timing information for performance analysis.

**GitHub OAuth:**
- Browser interacts only with BFF's auth endpoints.
- GitHub tokens and secrets stay server-side.
- Configuration via environment variables:
  - `GITHUB_CLIENT_ID`
  - `GITHUB_CLIENT_SECRET`
  - `GITHUB_CALLBACK_URL`
  - `GITHUB_CALLBACK_URLS` (comma-separated list for multiple environments)

**Environment Configuration:**
- All secrets stored in `.env` file (not committed to git).
- See `docs/GITHUB_OAUTH_SETUP.md` for OAuth setup guide.
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