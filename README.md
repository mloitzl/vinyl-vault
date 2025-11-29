# Vinyl Vault

A web application for managing a personal vinyl record collection. Scan barcodes, look up metadata from external music databases, and maintain your collection.

## Features

- 📀 Barcode scanning for quick record lookup
- 🔍 Automatic metadata retrieval from Discogs/MusicBrainz
- 🔐 GitHub OAuth authentication
- 👥 Role-based access (Admin/Contributor/Reader)
- 📱 Responsive design for mobile and desktop

## Architecture

- **Frontend**: React + Relay + Tailwind CSS (Vite SPA)
- **BFF (Backend-for-Frontend)**: Express + Apollo Server
- **Domain Backend**: Apollo Server + MongoDB
- **Database**: MongoDB
- **Infrastructure**: Docker + Caddy (reverse proxy)

See [Architecture.MD](./Architecture.MD) for detailed architecture documentation.

## Prerequisites

- Node.js 20+ (LTS)
- pnpm 8+
- MongoDB 7+ (or Docker)
- GitHub OAuth App (for authentication)

## Getting Started

### 1. Clone and Install

```bash
git clone https://github.com/your-username/vinylvault.git
cd vinylvault
pnpm install
```

### 2. Configure Environment

Copy the sample environment file and configure your settings:

```bash
cp .env.sample .env
```

See [docs/GITHUB_OAUTH_SETUP.md](./docs/GITHUB_OAUTH_SETUP.md) for detailed GitHub OAuth configuration instructions.

Required environment variables:
- `GITHUB_CLIENT_ID` - Your GitHub OAuth App client ID
- `GITHUB_CLIENT_SECRET` - Your GitHub OAuth App client secret
- `JWT_SECRET` - Secret for signing JWTs (generate with `openssl rand -base64 32`)
- `SESSION_SECRET` - Secret for session cookies (generate with `openssl rand -base64 32`)

### 3. Start MongoDB

Using Docker:
```bash
docker-compose -f infra/docker-compose.yml up -d mongodb
```

Or use a local MongoDB installation.

### 4. Start Development Servers

```bash
# Start all services in development mode
pnpm dev
```

Or start individually:
```bash
# Terminal 1 - Backend
cd packages/backend && pnpm dev

# Terminal 2 - BFF
cd packages/bff && pnpm dev

# Terminal 3 - Frontend
cd packages/frontend && pnpm dev
```

### 5. Access the Application

- Frontend: http://localhost:3000
- BFF GraphQL: http://localhost:3001/graphql
- Backend GraphQL: http://localhost:4000/graphql

## Project Structure

```
vinylvault/
├── packages/
│   ├── frontend/         # React + Relay SPA
│   │   ├── src/
│   │   │   ├── components/
│   │   │   ├── hooks/
│   │   │   ├── pages/
│   │   │   ├── relay/
│   │   │   └── types/
│   │   └── ...
│   ├── bff/              # Backend-for-Frontend
│   │   └── src/
│   │       ├── auth/
│   │       ├── graphql/
│   │       └── services/
│   └── backend/          # Domain Backend
│       └── src/
│           ├── db/
│           ├── graphql/
│           ├── models/
│           └── services/
├── infra/                # Docker & deployment configs
├── Architecture.MD
├── Requirements.MD
├── Techstack.MD
└── README.md
```

## Scripts

| Command | Description |
|---------|-------------|
| `pnpm dev` | Start all services in development mode |
| `pnpm build` | Build all packages |
| `pnpm lint` | Lint all packages |
| `pnpm test` | Run tests in all packages |
| `pnpm clean` | Clean build artifacts |

## Deployment

See [infra/README.md](./infra/README.md) for deployment instructions on Raspberry Pi 5.

## Documentation

- [Architecture](./Architecture.MD) - System architecture and design decisions
- [Requirements](./Requirements.MD) - Functional and non-functional requirements
- [Tech Stack](./Techstack.MD) - Technology choices and rationale

## License

MIT
