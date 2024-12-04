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

**Responsibilities:**

- Implement SPA that communicates exclusively with the BFF GraphQL endpoint.
- Manage authentication state via `AuthContext` and `/auth/me` endpoint.
- Use Relay connections and fragments for records, releases, albums, and viewer.
- Display user profile (avatar, name, role) in header when authenticated.
- Provide barcode scanning UI (camera + manual input) and wire it to the BFF lookup flow (FR-1 implemented).
- Display scored and aggregated Album results from barcode lookup (FR-2 implemented with blended scoring).

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

- Expose domain-centric GraphQL schema (User, Record, Release, Album).
- Implement business logic and data access.
- Validate and decode JWTs from the BFF.
- Integrate with external music APIs (Discogs/MusicBrainz) queried in parallel.
- Normalize, score, and aggregate releases into Album objects.
- Maintain cached releases in MongoDB.

**Scoring Module (`src/services/scoring/`):**
- `types.ts` - TypeScript interfaces for the scoring system
- `config.ts` - Configuration loader with defaults
- `normalize.ts` - Text normalization and release grouping
- `score.ts` - Release scoring logic
- `aggregate.ts` - Album aggregation from grouped releases
- `orchestrator.ts` - Main orchestrator (parallel API queries)

**Scoring Configuration (`config/scoring.json`):**
- Configurable weights for media type, country, track list, cover art, label, catalog number
- Preferred countries: US, UK, AT, DE
- Preferred media types: vinyl, lp, 12", 10", 7", album
- Discogs source bonus: +5 points
- Tie-breaker: earliest release year

## 5. Database

- **DBMS:** MongoDB 7 (running via Docker)
- **Docker:** Configured in `infra/docker-compose.yml`

### 5.1 BFF MongoDB (Session Store Only)

- **Purpose:** Stores only session information
- **Connection:** `MONGODB_URI` or `BFF_MONGODB_URI` environment variable
- **Default:** `mongodb://localhost:27017/vinylvault-sessions`

**Collections:**
- `sessions` - Session data (managed automatically by connect-mongo)

**Important:** In production, the BFF MongoDB is a completely separate instance from the Backend MongoDB. They are not reachable by each other. The BFF should never write any data other than sessions to its MongoDB.

### 5.2 Backend MongoDB (Domain Data)

- **Purpose:** Stores all domain data (users, records, releases)
- **Connection:** `BACKEND_MONGODB_URI` environment variable
- **Default:** `mongodb://localhost:27017/vinylvault`

**Collections:**
- `users` - GitHub-linked users and roles
- `records` - Physical owned items
- `releases` - Cached external metadata

**User Schema:**
```javascript
{
  githubId: string,      // GitHub user ID
  username: string,      // GitHub username
  displayName: string,   // Display name
  email: string | null,  // Email (if provided)
  avatarUrl: string,     // GitHub avatar URL
  role: string,          // 'ADMIN' | 'CONTRIBUTOR' | 'READER'
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
- Configuration:
  - `GITHUB_CLIENT_ID` - OAuth App client ID
  - `GITHUB_CLIENT_SECRET` - OAuth App client secret
  - `GITHUB_CALLBACK_URL` - Callback URL (default: `http://localhost:3001/auth/github/callback`)
- Setup guide: `docs/GITHUB_OAUTH_SETUP.md`

**Music Metadata APIs:**
- Discogs and/or MusicBrainz for barcode-based release lookup.
- Configuration:
  - `DISCOGS_API_KEY`
  - `DISCOGS_API_SECRET`
  - `MUSICBRAINZ_USER_AGENT`

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
- See `.env` comments for all available options

**Key Environment Variables:**
```
# BFF MongoDB (sessions only)
MONGODB_URI=mongodb://localhost:27017/vinylvault-sessions

# Backend MongoDB (domain data: users, records, releases)
BACKEND_MONGODB_URI=mongodb://localhost:27017/vinylvault

# GitHub OAuth
GITHUB_CLIENT_ID=your_client_id
GITHUB_CLIENT_SECRET=your_client_secret
GITHUB_CALLBACK_URL=http://localhost:3001/auth/github/callback

# JWT for BFF-Backend communication
JWT_SECRET=your_jwt_secret

# Session
SESSION_SECRET=your_session_secret
```

**Getting Started:**
1. Clone repository
2. Run `pnpm install`
3. Copy `.env.example` to `.env` and configure
4. Start MongoDB: `docker-compose -f infra/docker-compose.yml up -d mongodb`
5. Run `pnpm dev`
6. Open http://localhost:3000