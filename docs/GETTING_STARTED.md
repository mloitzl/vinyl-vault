# Getting Started Guide

This guide will help you get Vinyl Vault running on your local machine from scratch. It's written for complete beginners — no prior experience with this project is required.

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Fork and Clone the Repository](#step-1-fork-and-clone-the-repository)
3. [Install Node.js and pnpm](#step-2-install-nodejs-and-pnpm)
4. [Register a GitHub OAuth Application](#step-3-register-a-github-oauth-application)
5. [Configure Environment Variables](#step-4-configure-environment-variables)
6. [Start MongoDB with Docker](#step-5-start-mongodb-with-docker)
7. [Install Dependencies and Run](#step-6-install-dependencies-and-run)
8. [Access the Application](#step-7-access-the-application)
9. [Troubleshooting](#troubleshooting)

---

## Prerequisites

Before you begin, make sure you have:

- A [GitHub account](https://github.com/signup)
- A computer running macOS, Linux, or Windows
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) installed (for MongoDB)
- A terminal/command line application

---

## Step 1: Fork and Clone the Repository

### 1.1 Fork the Repository

1. Go to the Vinyl Vault repository on GitHub: `https://github.com/mloitzl/vinyl-vault`
2. Click the **Fork** button in the top-right corner
3. Select your GitHub account as the destination
4. Wait for the fork to complete — you now have your own copy!

### 1.2 Clone Your Fork

Open a terminal and run:

```bash
# Replace YOUR-USERNAME with your GitHub username
git clone https://github.com/YOUR-USERNAME/vinyl-vault.git

# Navigate into the project folder
cd vinyl-vault
```

---

## Step 2: Install Node.js and pnpm

### 2.1 Install Node.js

Vinyl Vault requires **Node.js version 20** or later.

#### Option A: Using nvm (Recommended)

[nvm](https://github.com/nvm-sh/nvm) lets you easily switch between Node.js versions.

**macOS/Linux:**
```bash
# Install nvm
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash

# Restart your terminal, then:
nvm install 20
nvm use 20
```

**Windows:**
Use [nvm-windows](https://github.com/coreybutler/nvm-windows/releases) instead.

#### Option B: Direct Download

Download and install Node.js 20 LTS from [nodejs.org](https://nodejs.org/).

#### Verify Installation

```bash
node --version
# Should output v20.x.x or higher
```

### 2.2 Install pnpm

pnpm is a fast, disk-efficient package manager. Install it globally:

```bash
npm install -g pnpm
```

Verify installation:

```bash
pnpm --version
# Should output 8.x.x or higher
```

---

## Step 3: Register a GitHub OAuth Application

Vinyl Vault uses GitHub for user authentication. You need to create an OAuth App.

### 3.1 Create the OAuth App

1. Go to [GitHub Developer Settings](https://github.com/settings/developers)
2. Click **OAuth Apps** in the left sidebar
3. Click **New OAuth App**
4. Fill in the form:

   | Field | Value |
   |-------|-------|
   | **Application name** | `Vinyl Vault (Dev)` |
   | **Homepage URL** | `http://localhost:3000` |
   | **Application description** | `A vinyl record collection manager` (optional) |
   | **Authorization callback URL** | `http://localhost:3001/auth/github/callback` |

5. Click **Register application**

### 3.2 Get Your Credentials

After registration:

1. Copy the **Client ID** — you'll need this later
2. Click **Generate a new client secret**
3. **Copy the Client Secret immediately!** You won't be able to see it again.

> 💡 **Tip:** Save these credentials somewhere safe temporarily (e.g., a text file). You'll add them to your `.env` file in the next step.

---

## Step 4: Configure Environment Variables

### 4.1 Create Your .env File

The project includes a sample environment file. Copy it to create your own:

```bash
# From the project root directory (vinyl-vault/)
cp .env.sample .env
```

### 4.2 Generate Security Secrets

You need to generate two random secrets for JWT and session security.

**Option A: Using Node.js (works everywhere)**
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```
Run this command **twice** — once for `JWT_SECRET` and once for `SESSION_SECRET`.

**Option B: Using OpenSSL (macOS/Linux)**
```bash
openssl rand -base64 32
```
Run this command **twice**.

### 4.3 Fill in Your .env File

Open `.env` in a text editor and update these values:

```env
# GitHub OAuth (from Step 3)
GITHUB_CLIENT_ID=paste_your_client_id_here
GITHUB_CLIENT_SECRET=paste_your_client_secret_here
GITHUB_CALLBACK_URL=http://localhost:3001/auth/github/callback

# Security Secrets (from Step 4.2)
JWT_SECRET=paste_your_first_generated_secret_here
SESSION_SECRET=paste_your_second_generated_secret_here

# MongoDB (use port 27017 as docker-compose exposes it there)
MONGODB_URI=mongodb://localhost:27017/vinylvault-sessions
BACKEND_MONGODB_URI=mongodb://localhost:27017/vinylvault

# URLs (keep defaults for local development)
FRONTEND_URL=http://localhost:3000
```

### 4.4 Optional: External Music APIs

For barcode scanning to retrieve album metadata, you can optionally configure:

```env
# Discogs API (https://www.discogs.com/settings/developers)
DISCOGS_API_TOKEN=your_discogs_api_token

# MusicBrainz (just needs a user-agent, no API key required)
MUSICBRAINZ_USER_AGENT=VinylVault/1.0 (your-email@example.com)
```

---

## Step 5: Start MongoDB with Docker

### 5.1 Start Docker Desktop

Make sure Docker Desktop is running on your machine.

### 5.2 Start MongoDB Container

From the project root directory:

```bash
docker compose -f infra/docker-compose.yml up -d mongodb
```

This starts MongoDB in the background. The data is persisted in a Docker volume, so it survives restarts.

### 5.3 Verify MongoDB is Running

```bash
docker ps
```

You should see a container named `vinylvault-mongodb` running.

---

## Step 6: Install Dependencies and Run

### 6.1 Install All Dependencies

From the project root directory:

```bash
pnpm install
```

This installs dependencies for all packages (frontend, BFF, backend).

### 6.2 Start All Development Servers

```bash
pnpm dev
```

This starts three servers concurrently:
- **Frontend** on http://localhost:3000
- **BFF** (Backend-for-Frontend) on http://localhost:3001
- **Domain Backend** on http://localhost:4000

Wait until you see output indicating all servers are ready.

---

## Step 7: Access the Application

1. Open your browser and go to: **http://localhost:3000**
2. Click **Sign in with GitHub**
3. Authorize the application when prompted
4. You're in! 🎉

### Available Endpoints

| Service | URL | Description |
|---------|-----|-------------|
| Frontend | http://localhost:3000 | Main web application |
| BFF GraphQL | http://localhost:3001/graphql | GraphQL API (BFF layer) |
| Backend GraphQL | http://localhost:4000/graphql | Domain API |

---

## Troubleshooting

### "GITHUB_CLIENT_ID is required"

Make sure your `.env` file exists in the project root and contains valid GitHub credentials.

### "Connection refused" to MongoDB

1. Check Docker is running: `docker ps`
2. If no containers, start MongoDB: `docker compose -f infra/docker-compose.yml up -d mongodb`
3. Verify the port in `.env` is `27017`

### "The redirect_uri is not valid" during GitHub login

The callback URL in your GitHub OAuth App settings must match **exactly** what's in your `.env`:
- Check for typos
- Ensure it's `http://localhost:3001/auth/github/callback`

### Port already in use

If a port is already in use, you can either:
1. Stop the other application using that port
2. Or change the port in `.env` (e.g., `BFF_PORT=3002`)

### pnpm command not found

Reinstall pnpm:
```bash
npm install -g pnpm
```

### Node.js version too old

Check your version:
```bash
node --version
```

If it's below v20, install a newer version (see Step 2).

---

## Next Steps

- 📖 Read [Architecture.MD](../Architecture.MD) to understand how the app is structured
- 🔧 Check [docs/DEV_HTTPS.md](./DEV_HTTPS.md) for running with HTTPS (needed for mobile testing)
- 🐛 Found a bug? Open an issue on GitHub!

---

## Quick Reference

```bash
# Start everything
pnpm dev

# Start just MongoDB
docker compose -f infra/docker-compose.yml up -d mongodb

# Stop MongoDB
docker compose -f infra/docker-compose.yml down

# Install dependencies
pnpm install

# Run a specific package
pnpm --filter @vinylvault/frontend dev
pnpm --filter @vinylvault/bff dev
pnpm --filter @vinylvault/backend dev
```

Happy collecting! 🎵📀
