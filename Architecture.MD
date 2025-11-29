# Vinyl Vault – Architecture

## 1. Overview

Vinyl Vault is a web application for managing a personal vinyl record collection. Users scan barcodes on record sleeves, the system looks up metadata from external music databases, and the collection is stored in MongoDB. The solution is built as a public-facing system running on a Raspberry Pi 5, with a security-focused design and a Backend-for-Frontend (BFF) proxy. [web:21][web:27]

## 2. Goals and Constraints

- Minimize manual data entry for vinyl records.
- Keep all JWTs and backend secrets away from the browser.
- Use GitHub as the single sign-on provider.
- Support two roles: admin/contributor and reader.
- Run on a single RPi 5 with limited resources but public internet exposure.
- Prefer clear, maintainable TypeScript code across backend and frontend. [web:21][web:27][web:37]

## 3. Logical Architecture

Main components:

- React/Relay Web Client
  - SPA served over HTTPS.
  - Talks only to the BFF GraphQL endpoint.
- GraphQL BFF (Proxy)
  - Exposes a Relay-friendly GraphQL schema.
  - Handles GitHub OAuth login/logout and HTTP-only session cookies.
  - Enforces high-level authorization (role checks).
  - Proxies calls to the Domain Backend via short-lived JWTs.
- Domain Backend (Apollo GraphQL)
  - Encapsulates business logic and data access.
  - Validates JWTs from the BFF (user id, role).
  - Interacts with MongoDB for users, records, and releases.
  - Integrates with external music APIs (Discogs/MusicBrainz) behind the scenes.
- MongoDB
  - Stores users, roles, records, releases, and cached external metadata.
- External APIs
  - Music metadata APIs (e.g., Discogs, MusicBrainz) for barcode lookups.
  - GitHub OAuth for authentication. [web:3][web:21][web:22][web:25]

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

- Browser initiates GitHub OAuth Web Application Flow:
  - User is redirected to GitHub for login and consent.
  - GitHub redirects back to BFF callback with authorization code.
  - BFF exchanges code for GitHub access token and fetches user identity. [web:18][web:22][web:25]
- BFF maps GitHub user to local User in MongoDB.
- BFF issues a secure, HTTP-only session cookie:
  - Contains an opaque session ID or a signed session token.
  - No backend JWT is exposed to the browser. [web:23][web:26]

### 5.2 Authorization

- BFF and backend both use the same role model:
  - ADMIN (or CONTRIBUTOR): can add/update/delete records and manage roles.
  - READER: read-only access to the collection.
- BFF enforces role-based access on GraphQL operations exposed to the client.
- Backend validates and trusts only JWTs signed by the BFF:
  - Claims: `sub` (user id), `role`, timestamps, optional `github_login`. [web:14][web:23][web:29]

### 5.3 Data Model (Logical)

- User
  - GitHub identity and local role.
- Record
  - Represents a physical vinyl owned by a user.
- Release
  - Cached metadata about a particular music release from an external source.
- Relationships
  - User 1—N Record
  - Release 1—N Record (different owners or copies). [web:21][web:27]

### 5.4 External Integration

- Barcode scan from browser → BFF → backend:
  - Backend checks local `releases` cache by barcode.
  - If not found, it queries external music APIs, stores a `release`, and returns candidates.
- GitHub OAuth:
  - Browser interacts only with BFF’s auth endpoints.
  - GitHub tokens and secrets stay server-side. [web:3][web:22][web:25]

## 6. Quality Attributes

- Security:
  - JWT between BFF and backend only.
  - HTTPS, secure cookies, minimal exposure of internal ports.
  - Hardened OS and MongoDB configuration. [web:13][web:16][web:27]
- Maintainability:
  - TypeScript across services.
  - Clear separation between BFF and domain backend.
- Performance:
  - Local MongoDB and caching of release metadata.
  - Lightweight traffic profile, suitable for RPi 5. [web:21][web:27]
- Availability:
  - Designed for single-node deployment but can be containerized for cloud later.