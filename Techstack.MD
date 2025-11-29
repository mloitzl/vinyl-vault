# Vinyl Vault – Tech Stack

## 1. Overview

This document summarizes the technology choices for Vinyl Vault across frontend, backend, data, integration, and infrastructure. It is meant to guide implementation and onboarding. [web:21][web:35]

## 2. Frontend

- Language: TypeScript
- UI Library: React
- Data Layer: Relay (React Relay)
- Build Tooling: Vite or Next.js (choose based on preference; default: Vite SPA).
- Styling: Tailwind CSS or CSS Modules (to be decided). [web:35][web:38]

Responsibilities:

- Implement SPA that communicates exclusively with the BFF GraphQL endpoint.
- Manage authentication state based on `viewer` query, not local tokens.
- Use Relay connections and fragments for records, releases, and viewer. 

## 3. Backend-for-Frontend (BFF)

- Runtime: Node.js (LTS) on Raspberry Pi 5.
- Language: TypeScript.
- Web Framework: Express or Fastify (default: Express).
- GraphQL: Apollo Server (standalone or integrated with Express). [web:11][web:14]
- Auth:
  - GitHub OAuth Web Application Flow.
  - HTTP-only, Secure cookies for browser sessions. [web:18][web:22][web:25]

Responsibilities:

- Expose a Relay-friendly GraphQL schema (viewer, records, scanBarcode, etc.).
- Handle GitHub login/logout endpoints.
- Map GitHub identity to local user in MongoDB.
- Maintain sessions via cookies and in-memory or MongoDB-backed session store.
- Create and sign short-lived JWTs for calls to the domain backend. [web:14][web:23][web:26]

## 4. Domain Backend

- Runtime: Node.js (LTS).
- Language: TypeScript.
- GraphQL: Apollo Server.
- ODM/DB Client: Official MongoDB Node.js driver or Mongoose (to be decided). [web:21][web:27]

Responsibilities:

- Expose domain-centric GraphQL schema (User, Record, Release).
- Implement business logic and data access.
- Validate and decode JWTs from the BFF.
- Integrate with external music APIs (e.g., Discogs/MusicBrainz) and maintain cached releases. [web:3][web:21]

## 5. Database

- DBMS: MongoDB (running locally on RPi 5, possibly via Docker). [web:21][web:27]
- Collections:
  - `users` (GitHub-linked users and roles).
  - `records` (physical owned items).
  - `releases` (cached external metadata).
- Features:
  - Indexes for common queries (user+barcode, barcodes, artist/title).
  - Timestamps and minimal audit fields. [web:21][web:27]

## 6. External Services

- GitHub OAuth:
  - Used for login.
  - Required scopes: basic user info and optionally `user:email`. [web:22][web:25]
- Music Metadata APIs:
  - Discogs and/or MusicBrainz for barcode-based release lookup. [web:3][web:21]
- TLS Certificates:
  - Let’s Encrypt via reverse proxy (Caddy, Nginx, Traefik). [web:16]

## 7. Infrastructure and DevOps

- Host: Raspberry Pi 5 (Linux).
- Containerization: Docker (optional but recommended for isolation). [web:16][web:21]
- Reverse Proxy: Caddy or Nginx (default: Caddy for easy HTTPS). [web:16]
- Process Management:
  - Docker restart policies or systemd unit files for services.
- Logging:
  - Application logs to stdout with structured logging.
  - System logs via journalctl, rotated regularly. [web:13][web:16]
- Monitoring (optional):
  - Lightweight tools (e.g., Prometheus node exporter + Grafana if desired).

## 8. Development Environment

- IDE: Cursor with Vibe Coding.
- Version Control: Git (GitHub repository).
- Package Manager: npm, pnpm, or yarn (default: pnpm).
- Code Quality:
  - ESLint, Prettier, TypeScript strict mode.
  - Basic test setup with Jest or Vitest. [web:35][web:38]