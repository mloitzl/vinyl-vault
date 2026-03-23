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

## Environments

Vinyl Vault is deployed in two distinct environments with different scaling and deployment strategies:

### 1. Production/Staging - Kubernetes on Raspberry Pi 5 (vinylvault.antisocializer.org)

A self-hosted Kubernetes setup running on a local Raspberry Pi 5 cluster using K3s.

**Architecture:**
- **Compute**: K3s cluster on Raspberry Pi 5
- **Database**: MongoDB running in Kubernetes (separate StatefulSets for BFF and Backend)
- **Storage**: NFS provisioner for persistent volumes
- **Ingress**: Traefik reverse proxy
- **Frontend**: Deployed as Kubernetes Deployment (static SPA)
- **Services**: Backend and BFF deployed as separate Kubernetes Deployments with auto-scaling (HPA)

**Environments:**
- **Staging** (`vinylvault-staging` namespace)
  - Full feature testing before production
  - Shared K3s cluster resources
  - Storage: 10GB (BFF MongoDB), 50GB (Backend MongoDB)
  
- **Production** (`vinylvault-production` namespace)
  - Live user data
  - Same K3s cluster (isolated via namespace)
  - Storage: 20GB (BFF MongoDB), 100GB (Backend MongoDB)

**Database Setup:**
- **BFF MongoDB**: Sessions and user cache (1 replica, 512Mi-1Gi RAM)
- **Backend MongoDB**: Registry database + all tenant databases (1 replica, 1Gi-2Gi RAM)
- Connection strings stored in Kubernetes Secrets

**Deployment:**
```bash
cd infra/k8s/scripts
./deploy-mongodb-staging.sh        # Deploy staging
./deploy-mongodb-production.sh      # Deploy production
```

See [infra/k8s/README.md](./infra/k8s/README.md) for detailed Kubernetes setup and operations.

### 2. Demo - Free-tier Cloud (vinyl-vault-demo.loitzl.com)

A lightweight, cost-optimized demo environment running on free-tier services using a unified deployment strategy.

**Architecture:**
- **Hosting**: Vercel (frontend) + Koyeb (backend/BFF)
- **Database**: MongoDB Atlas (free tier)
- **Unified Endpoint**: Demo Server orchestrator running both Backend and BFF in a single process

**Key Innovation - Demo Server Orchestrator:**
The demo environment uses a special orchestrator pattern (`packages/demo-server`) that:
- Launches both Backend and BFF services as child processes
- Provides a unified gateway on a single port (8080)
- Routes `/graphql` and `/auth` to the BFF
- Implements health checks aggregating both services
- Enables cost-effective deployment on free-tier platforms

**Services:**
```
┌─────────────────────────────────────────────┐
│      Demo Server Orchestrator (port 8080)   │
│  ┌──────────────────────────────────────┐   │
│  │  Express Gateway                     │   │
│  │  - Routes /graphql, /auth to BFF     │   │
│  │  - Health aggregation endpoint       │   │
│  └──────────────────────────────────────┘   │
│         ↓                       ↓            │
│  ┌──────────────────┐  ┌─────────────────┐  │
│  │ BFF              │  │ Backend         │  │
│  │ (port 3001)      │  │ (port 4001)     │  │
│  │ - Session auth   │  │ - Domain logic  │  │
│  │ - API gateway    │  │ - GraphQL API   │  │
│  └──────────────────┘  └─────────────────┘  │
│         ↓                       ↓            │
│      MongoDB Atlas (free tier)              │
└─────────────────────────────────────────────┘
```

**Environment Configuration:**
```env
# Frontend (Vercel)
VITE_API_URL=https://vinyl-vault-demo.loitl.com
VITE_API_GRAPHQL=https://vinyl-vault-demo.loitl.com/graphql

# Backend/BFF (Koyeb)
MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/vinylvault_bff
MONGODB_REGISTRY_URI=mongodb+srv://user:pass@cluster.mongodb.net/vinylvault_registry
MONGODB_URI_BASE=mongodb+srv://user:pass@cluster.mongodb.net

# Both services inherit from Demo Server environment
NODE_ENV=production
LOG_LEVEL=info
```

**Docker Image:**
The unified `Dockerfile.demoserver` builds all three packages:
- Compiles frontend (Vite SPA)
- Compiles backend and BFF
- Copies demo-server orchestrator
- Single image runs the unified endpoint

**Deployment:**
```bash
# Build and push unified image
docker build -f infra/Dockerfile.demoserver -t vinyl-vault-demo:latest .
docker push your-registry/vinyl-vault-demo:latest

# Deploy to Koyeb
# Configure environment variables for MongoDB Atlas connection
```

**Cost Optimization:**
- ✅ Vercel: 100GB/month transfer free tier
- ✅ Koyeb: Free tier with $0 compute + $0.06/GB outbound bandwidth
- ✅ MongoDB Atlas: 500MB storage, 100 connections free tier

**Limitations:**
- Single Backend/BFF instance (no horizontal scaling on free tier)
- Shared MongoDB connection (limited concurrent connections)
- Lower performance compared to Kubernetes setup
- Best for demos and small user counts

## Deployment

See [infra/README.md](./infra/README.md) for Docker composition and local development setup.

For production deployment:
- **Kubernetes**: [infra/k8s/README.md](./infra/k8s/README.md)
- **Demo**: Deploy using Docker image to Koyeb/Vercel

## Documentation

- [Architecture](./Architecture.MD) - System architecture and design decisions
- [Requirements](./Requirements.MD) - Functional and non-functional requirements
- [Tech Stack](./Techstack.MD) - Technology choices and rationale

## License

MIT
