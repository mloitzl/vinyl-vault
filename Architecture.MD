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
  - Interacts with MongoDB for users, records, and releases.
  - Integrates with external music APIs (Discogs/MusicBrainz) behind the scenes.

- **MongoDB**
  - Running via Docker (see `infra/docker-compose.yml`).
  - Stores users, roles, records, releases, and cached external metadata.
  - Session store for BFF via `connect-mongo`.

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
6. BFF creates/updates user in MongoDB `users` collection.
7. BFF creates session (stored in MongoDB via `connect-mongo`).
8. BFF sets HTTP-only session cookie and redirects to frontend.

**Session Management:**

- Sessions stored in MongoDB `sessions` collection.
- Cookie: `vinylvault.sid`, HTTP-only, secure in production.
- Session contains: `userId`, `githubId`, `username`, `role`, `avatarUrl`, `displayName`.
- Frontend fetches user via `/auth/me` endpoint on load.
- No backend JWT is exposed to the browser.

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

**User** (MongoDB `users` collection)
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

**Record** (MongoDB `records` collection)
- Represents a physical vinyl owned by a user.
- Links to User and Release.

**Release** (MongoDB `releases` collection)
- Cached metadata about a particular music release from an external source.

**Relationships:**
- User 1—N Record
- Release 1—N Record (different owners or copies)

### 5.4 External Integration

**Barcode Lookup Flow:**
- Barcode scan from browser → BFF → backend.
- Backend checks local `releases` cache by barcode.
- If not found, queries external music APIs, stores a `release`, and returns candidates.

**GitHub OAuth:**
- Browser interacts only with BFF's auth endpoints.
- GitHub tokens and secrets stay server-side.
- Configuration via environment variables:
  - `GITHUB_CLIENT_ID`
  - `GITHUB_CLIENT_SECRET`
  - `GITHUB_CALLBACK_URL`

**Environment Configuration:**
- All secrets stored in `.env` file (not committed to git).
- See `docs/GITHUB_OAUTH_SETUP.md` for OAuth setup guide.

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
│   ├── bff/               # Express + Apollo Server
│   └── backend/           # Apollo Server (standalone)
├── infra/                 # Docker, Caddy configs
├── docs/                  # Setup guides
├── .env                   # Environment variables (not in git)
├── pnpm-workspace.yaml    # Monorepo configuration
└── tsconfig.base.json     # Shared TypeScript config
```