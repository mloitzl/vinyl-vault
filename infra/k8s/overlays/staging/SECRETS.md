# Staging Environment Secrets
# 
# These secrets must be created manually in the vinylvault-staging namespace
# before deploying the application.
#
# NEVER commit actual secret values to version control!

## Prerequisites

Before deploying to staging, ensure you have:
1. MongoDB deployed in vinylvault-staging namespace (Phase 3)
2. MongoDB root passwords from Phase 3 deployment
3. GitHub OAuth App created for staging
4. GitHub App created for staging (with private key)
5. Generated JWT and session secrets

---

## Secret Generation Commands

### 1. Generate JWT and Session Secrets

```bash
# Generate JWT secret (use same value for BFF and Backend)
JWT_SECRET=$(openssl rand -base64 32)
echo "JWT_SECRET: $JWT_SECRET"

# Generate session secret (BFF only)
SESSION_SECRET=$(openssl rand -base64 32)
echo "SESSION_SECRET: $SESSION_SECRET"
```

### 2. Get MongoDB Passwords from Phase 3

```bash
# BFF MongoDB password
MONGODB_BFF_PASSWORD=$(kubectl get secret mongodb-bff-secret -n vinylvault-staging -o jsonpath='{.data.mongodb-root-password}' | base64 -d)
echo "BFF MongoDB Password: $MONGODB_BFF_PASSWORD"

# Backend MongoDB password
MONGODB_BACKEND_PASSWORD=$(kubectl get secret mongodb-backend-secret -n vinylvault-staging -o jsonpath='{.data.mongodb-root-password}' | base64 -d)
echo "Backend MongoDB Password: $MONGODB_BACKEND_PASSWORD"
```

### 3. Prepare MongoDB Connection Strings

```bash
# BFF MongoDB URI
MONGODB_BFF_URI="mongodb://root:${MONGODB_BFF_PASSWORD}@mongodb-bff-0.mongodb-bff.vinylvault-staging.svc.cluster.local:27017/vinylvault_bff?authSource=admin"

# Backend Registry URI
MONGODB_REGISTRY_URI="mongodb://root:${MONGODB_BACKEND_PASSWORD}@mongodb-backend-0.mongodb-backend.vinylvault-staging.svc.cluster.local:27017/vinylvault_registry?authSource=admin"

# Backend Tenant Base URI
MONGODB_URI_BASE="mongodb://root:${MONGODB_BACKEND_PASSWORD}@mongodb-backend-0.mongodb-backend.vinylvault-staging.svc.cluster.local:27017?authSource=admin"

# Backend MongoDB Uri
MONGODB_BACKEND_URI="mongodb://root:${MONGODB_BACKEND_PASSWORD}@mongodb-backend-0.mongodb-backend.vinylvault-staging.svc.cluster.local:27017/vinylvault_backend?authSource=admin"
```

---

## Create Kubernetes Secrets

### Secret 1: app-secrets

```bash
kubectl create secret generic app-secrets \
  --namespace=vinylvault-staging \
  --from-literal=JWT_SECRET="${JWT_SECRET}" \
  --from-literal=SESSION_SECRET="${SESSION_SECRET}" \
  --from-literal=DISCOGS_API_TOKEN="${DISCOGS_API_TOKEN}" \
  --dry-run=client -o yaml | kubectl apply -f -
```

### Secret 2: mongodb-secrets

```bash
kubectl create secret generic mongodb-secrets \
  --namespace=vinylvault-staging \
  --from-literal=MONGODB_BFF_URI="${MONGODB_BFF_URI}" \
  --from-literal=MONGODB_REGISTRY_URI="${MONGODB_REGISTRY_URI}" \
  --from-literal=MONGODB_URI_BASE="${MONGODB_URI_BASE}" \
  --from-literal=MONGODB_BACKEND_URI="${MONGODB_BACKEND_URI}" \
  --dry-run=client -o yaml | kubectl apply -f -
```

### Secret 3: github-secrets

```bash
# Get these values from your GitHub OAuth App settings
# https://github.com/settings/developers
GITHUB_CLIENT_ID="your_staging_client_id"
GITHUB_CLIENT_SECRET="your_staging_client_secret"

# Get these from your GitHub App settings
# https://github.com/settings/apps
GITHUB_APP_ID="your_staging_app_id"
GITHUB_APP_WEBHOOK_SECRET=$(openssl rand -base64 32)

kubectl create secret generic github-secrets \
  --namespace=vinylvault-staging \
  --from-literal=GITHUB_CLIENT_ID="${GITHUB_CLIENT_ID}" \
  --from-literal=GITHUB_CLIENT_SECRET="${GITHUB_CLIENT_SECRET}" \
  --from-literal=GITHUB_APP_ID="${GITHUB_APP_ID}" \
  --from-literal=GITHUB_APP_WEBHOOK_SECRET="${GITHUB_APP_WEBHOOK_SECRET}" \
  --dry-run=client -o yaml | kubectl apply -f -
```


### Secret 3.5: discogs
```bash
kubectl create secret generic discogs-secrets \
  --namespace=vinylvault-staging \
  --from-literal=DISCOGS_API_TOKEN="${DISCOGS_API_TOKEN}" \
  --dry-run=client -o yaml | kubectl apply -f - 
```
### Secret 4: github-app-key (Private Key)

```bash
# Download the GitHub App private key from GitHub App settings
# Save it as vinyl-vault-staging.pem

kubectl create secret generic github-app-key \
  --namespace=vinylvault-staging \
  --from-file=private-key=./vinyl-vault-staging.pem \
  --dry-run=client -o yaml | kubectl apply -f -
```

---

## Verify Secrets

```bash
# List all secrets in staging namespace
kubectl get secrets -n vinylvault-staging

# Expected output:
# NAME                  TYPE     DATA   AGE
# app-secrets           Opaque   3      Xs
# mongodb-secrets       Opaque   3      Xs
# github-secrets        Opaque   4      Xs
# github-app-key        Opaque   1      Xs
# mongodb-bff-secret    Opaque   1      Xd  (from Phase 3)
# mongodb-backend-secret Opaque  1      Xd  (from Phase 3)

# Verify secret keys (not values)
kubectl describe secret app-secrets -n vinylvault-staging
kubectl describe secret mongodb-secrets -n vinylvault-staging
kubectl describe secret github-secrets -n vinylvault-staging
kubectl describe secret github-app-key -n vinylvault-staging
```

---

## GitHub OAuth App Configuration

Configure your staging GitHub OAuth App with:

- **Application name**: Vinyl Vault Staging
- **Homepage URL**: `https://vinylvault.antisocializer.org`
- **Authorization callback URL**: `https://vinylvault.antisocializer.org/auth/github/callback`

---

## GitHub App Configuration

Configure your staging GitHub App with:

- **Webhook URL**: `https://vinylvault.antisocializer.org/webhook/github`
- **Webhook secret**: Use the `GITHUB_APP_WEBHOOK_SECRET` generated above
- **Permissions**:
  - Repository contents: Read-only
  - Organization members: Read-only
- **Subscribe to events**: Installation, Installation repositories

---

## Quick Setup Script

Save this as `setup-staging-secrets.sh`:

```bash
#!/bin/bash
set -e

echo "=== Vinyl Vault Staging Secrets Setup ==="
echo ""

# Generate secrets
echo "Generating JWT and Session secrets..."
JWT_SECRET=$(openssl rand -base64 32)
SESSION_SECRET=$(openssl rand -base64 32)

# Get MongoDB passwords
echo "Retrieving MongoDB passwords..."
MONGODB_BFF_PASSWORD=$(kubectl get secret mongodb-bff-secret -n vinylvault-staging -o jsonpath='{.data.mongodb-root-password}' | base64 -d)
MONGODB_BACKEND_PASSWORD=$(kubectl get secret mongodb-backend-secret -n vinylvault-staging -o jsonpath='{.data.mongodb-root-password}' | base64 -d)

# Build connection strings
MONGODB_BFF_URI="mongodb://root:${MONGODB_BFF_PASSWORD}@mongodb-bff-0.mongodb-bff.vinylvault-staging.svc.cluster.local:27017/vinylvault_bff?authSource=admin"
MONGODB_REGISTRY_URI="mongodb://root:${MONGODB_BACKEND_PASSWORD}@mongodb-backend-0.mongodb-backend.vinylvault-staging.svc.cluster.local:27017/vinylvault_registry?authSource=admin"
MONGODB_URI_BASE="mongodb://root:${MONGODB_BACKEND_PASSWORD}@mongodb-backend-0.mongodb-backend.vinylvault-staging.svc.cluster.local:27017?authSource=admin"

# Prompt for GitHub values
read -p "Enter GitHub OAuth Client ID (staging): " GITHUB_CLIENT_ID
read -sp "Enter GitHub OAuth Client Secret (staging): " GITHUB_CLIENT_SECRET
echo ""
read -p "Enter GitHub App ID (staging): " GITHUB_APP_ID
read -p "Path to GitHub App private key PEM file: " GITHUB_APP_KEY_PATH
read -sp "Enter Discogs API Token: " DISCOGS_API_TOKEN
echo ""

# Create secrets
echo "Creating app-secrets..."
kubectl create secret generic app-secrets \
  --namespace=vinylvault-staging \
  --from-literal=JWT_SECRET="${JWT_SECRET}" \
  --from-literal=SESSION_SECRET="${SESSION_SECRET}" \
  --from-literal=DISCOGS_API_TOKEN="${DISCOGS_API_TOKEN}" \
  --dry-run=client -o yaml | kubectl apply -f -

echo "Creating mongodb-secrets..."
kubectl create secret generic mongodb-secrets \
  --namespace=vinylvault-staging \
  --from-literal=MONGODB_BFF_URI="${MONGODB_BFF_URI}" \
  --from-literal=MONGODB_REGISTRY_URI="${MONGODB_REGISTRY_URI}" \
  --from-literal=MONGODB_URI_BASE="${MONGODB_URI_BASE}" \
  --dry-run=client -o yaml | kubectl apply -f -

GITHUB_APP_WEBHOOK_SECRET=$(openssl rand -base64 32)
echo "Creating github-secrets..."
kubectl create secret generic github-secrets \
  --namespace=vinylvault-staging \
  --from-literal=GITHUB_CLIENT_ID="${GITHUB_CLIENT_ID}" \
  --from-literal=GITHUB_CLIENT_SECRET="${GITHUB_CLIENT_SECRET}" \
  --from-literal=GITHUB_APP_ID="${GITHUB_APP_ID}" \
  --from-literal=GITHUB_APP_WEBHOOK_SECRET="${GITHUB_APP_WEBHOOK_SECRET}" \
  --dry-run=client -o yaml | kubectl apply -f -

echo "Creating github-app-key..."
kubectl create secret generic github-app-key \
  --namespace=vinylvault-staging \
  --from-file=private-key="${GITHUB_APP_KEY_PATH}" \
  --dry-run=client -o yaml | kubectl apply -f -

echo ""
echo "=== Secrets Created Successfully ==="
echo ""
echo "IMPORTANT: Configure your GitHub App webhook secret with:"
echo "  Webhook Secret: ${GITHUB_APP_WEBHOOK_SECRET}"
echo ""
echo "Ready to deploy to staging!"
```

Make executable and run:
```bash
chmod +x setup-staging-secrets.sh
./setup-staging-secrets.sh
```
