# Production Environment Secrets
# 
# These secrets must be created manually in the vinylvault-production namespace
# before deploying the application.
#
# ⚠️  PRODUCTION SECURITY NOTICE ⚠️
# - Use strong, unique secrets different from staging
# - Store secrets securely (password manager, vault)
# - Rotate secrets regularly (quarterly recommended)
# - Never commit actual secret values to version control!
# - Use separate GitHub OAuth App and GitHub App for production

---

## Prerequisites

Before deploying to production, ensure you have:
1. MongoDB deployed in vinylvault-production namespace (Phase 3)
2. MongoDB root passwords from Phase 3 deployment
3. **Separate** GitHub OAuth App created for production
4. **Separate** GitHub App created for production (with private key)
5. Generated production-grade JWT and session secrets (different from staging!)
6. Discogs API token
7. DNS records pointing to cluster:
   - `vinylvault.loitzl.com` → `192.168.1.60`

---

## Secret Generation Commands

### 1. Generate JWT and Session Secrets (Production-Grade)

```bash
# Generate JWT secret (use same value for BFF and Backend)
# MUST be different from staging!
JWT_SECRET=$(openssl rand -base64 48)  # 48 bytes for production
echo "JWT_SECRET: $JWT_SECRET"

# Generate session secret (BFF only)
# MUST be different from staging!
SESSION_SECRET=$(openssl rand -base64 48)  # 48 bytes for production
echo "SESSION_SECRET: $SESSION_SECRET"
```

### 2. Get MongoDB Passwords from Phase 3

```bash
# BFF MongoDB password
MONGODB_BFF_PASSWORD=$(kubectl get secret mongodb-bff-secret -n vinylvault-production -o jsonpath='{.data.mongodb-root-password}' | base64 -d)
echo "BFF MongoDB Password: $MONGODB_BFF_PASSWORD"

# Backend MongoDB password
MONGODB_BACKEND_PASSWORD=$(kubectl get secret mongodb-backend-secret -n vinylvault-production -o jsonpath='{.data.mongodb-root-password}' | base64 -d)
echo "Backend MongoDB Password: $MONGODB_BACKEND_PASSWORD"
```

### 3. Prepare MongoDB Connection Strings

```bash
# BFF MongoDB URI
MONGODB_BFF_URI="mongodb://root:${MONGODB_BFF_PASSWORD}@mongodb-bff-0.mongodb-bff.vinylvault-production.svc.cluster.local:27017/vinylvault_bff?authSource=admin"

# Backend Registry URI
MONGODB_REGISTRY_URI="mongodb://root:${MONGODB_BACKEND_PASSWORD}@mongodb-backend-0.mongodb-backend.vinylvault-production.svc.cluster.local:27017/vinylvault_registry?authSource=admin"

# Backend Tenant Base URI
MONGODB_URI_BASE="mongodb://root:${MONGODB_BACKEND_PASSWORD}@mongodb-backend-0.mongodb-backend.vinylvault-production.svc.cluster.local:27017?authSource=admin"
```

---

## Create Kubernetes Secrets

### Secret 1: app-secrets

```bash
kubectl create secret generic app-secrets \
  --namespace=vinylvault-production \
  --from-literal=JWT_SECRET="${JWT_SECRET}" \
  --from-literal=SESSION_SECRET="${SESSION_SECRET}" \
  --from-literal=DISCOGS_API_TOKEN="${DISCOGS_API_TOKEN}" \
  --dry-run=client -o yaml | kubectl apply -f -
```

### Secret 2: mongodb-secrets

```bash
kubectl create secret generic mongodb-secrets \
  --namespace=vinylvault-production \
  --from-literal=MONGODB_BFF_URI="${MONGODB_BFF_URI}" \
  --from-literal=MONGODB_REGISTRY_URI="${MONGODB_REGISTRY_URI}" \
  --from-literal=MONGODB_URI_BASE="${MONGODB_URI_BASE}" \
  --dry-run=client -o yaml | kubectl apply -f -
```

### Secret 3: github-secrets

```bash
# Get these values from your PRODUCTION GitHub OAuth App settings
# https://github.com/settings/developers
# ⚠️  Use separate OAuth App for production!
GITHUB_CLIENT_ID="your_production_client_id"
GITHUB_CLIENT_SECRET="your_production_client_secret"

# Get these from your PRODUCTION GitHub App settings
# https://github.com/settings/apps
# ⚠️  Use separate GitHub App for production!
GITHUB_APP_ID="your_production_app_id"
GITHUB_APP_WEBHOOK_SECRET=$(openssl rand -base64 48)  # 48 bytes for production

kubectl create secret generic github-secrets \
  --namespace=vinylvault-production \
  --from-literal=GITHUB_CLIENT_ID="${GITHUB_CLIENT_ID}" \
  --from-literal=GITHUB_CLIENT_SECRET="${GITHUB_CLIENT_SECRET}" \
  --from-literal=GITHUB_APP_ID="${GITHUB_APP_ID}" \
  --from-literal=GITHUB_APP_WEBHOOK_SECRET="${GITHUB_APP_WEBHOOK_SECRET}" \
  --dry-run=client -o yaml | kubectl apply -f -
```

### Secret 4: github-app-key (Private Key)

```bash
# Download the PRODUCTION GitHub App private key from GitHub App settings
# Save it as vinyl-vault-production.pem
# ⚠️  Use separate private key for production!

kubectl create secret generic github-app-key \
  --namespace=vinylvault-production \
  --from-file=private-key=./vinyl-vault-production.pem \
  --dry-run=client -o yaml | kubectl apply -f -
```

---

## Verify Secrets

```bash
# List all secrets in production namespace
kubectl get secrets -n vinylvault-production

# Expected output:
# NAME                  TYPE     DATA   AGE
# app-secrets           Opaque   3      Xs
# mongodb-secrets       Opaque   3      Xs
# github-secrets        Opaque   4      Xs
# github-app-key        Opaque   1      Xs
# mongodb-bff-secret    Opaque   1      Xd  (from Phase 3)
# mongodb-backend-secret Opaque  1      Xd  (from Phase 3)

# Verify secret keys (not values)
kubectl describe secret app-secrets -n vinylvault-production
kubectl describe secret mongodb-secrets -n vinylvault-production
kubectl describe secret github-secrets -n vinylvault-production
kubectl describe secret github-app-key -n vinylvault-production
```

---

## GitHub OAuth App Configuration (Production)

Create a **new** GitHub OAuth App for production:

- **Application name**: Vinyl Vault
- **Homepage URL**: `https://vinylvault.loitzl.com`
- **Authorization callback URL**: `https://vinylvault.loitzl.com/auth/github/callback`

---

## GitHub App Configuration (Production)

Create a **new** GitHub App for production:

- **GitHub App name**: Vinyl Vault
- **Webhook URL**: `https://vinylvault.loitzl.com/webhook/github`
- **Webhook secret**: Use the `GITHUB_APP_WEBHOOK_SECRET` generated above
- **Permissions**:
  - Repository contents: Read-only
  - Organization members: Read-only
- **Subscribe to events**: Installation, Installation repositories

---

## DNS Verification

Before deploying, verify DNS is configured:

```bash
# Check DNS resolution
nslookup vinylvault.loitzl.com

# Should return: 192.168.1.60

# Test from cluster
kubectl run -it --rm dns-test --image=busybox --restart=Never -- nslookup vinylvault.loitzl.com
```

---

## Quick Setup Script

Save this as `setup-production-secrets.sh`:

```bash
#!/bin/bash
set -e

echo "============================================"
echo "  Vinyl Vault PRODUCTION Secrets Setup"
echo "============================================"
echo ""
echo "⚠️  WARNING: You are setting up PRODUCTION secrets!"
echo "⚠️  Ensure you are using separate GitHub Apps/OAuth Apps"
echo "⚠️  and production-grade secrets (48+ bytes)"
echo ""
read -p "Continue with production setup? (yes/no): " CONFIRM
if [ "$CONFIRM" != "yes" ]; then
  echo "Setup cancelled."
  exit 0
fi
echo ""

# Generate secrets (48 bytes for production)
echo "Generating production-grade JWT and Session secrets..."
JWT_SECRET=$(openssl rand -base64 48)
SESSION_SECRET=$(openssl rand -base64 48)

# Get MongoDB passwords
echo "Retrieving MongoDB passwords..."
MONGODB_BFF_PASSWORD=$(kubectl get secret mongodb-bff-secret -n vinylvault-production -o jsonpath='{.data.mongodb-root-password}' | base64 -d)
MONGODB_BACKEND_PASSWORD=$(kubectl get secret mongodb-backend-secret -n vinylvault-production -o jsonpath='{.data.mongodb-root-password}' | base64 -d)

# Build connection strings
MONGODB_BFF_URI="mongodb://root:${MONGODB_BFF_PASSWORD}@mongodb-bff-0.mongodb-bff.vinylvault-production.svc.cluster.local:27017/vinylvault_bff?authSource=admin"
MONGODB_REGISTRY_URI="mongodb://root:${MONGODB_BACKEND_PASSWORD}@mongodb-backend-0.mongodb-backend.vinylvault-production.svc.cluster.local:27017/vinylvault_registry?authSource=admin"
MONGODB_URI_BASE="mongodb://root:${MONGODB_BACKEND_PASSWORD}@mongodb-backend-0.mongodb-backend.vinylvault-production.svc.cluster.local:27017?authSource=admin"

# Prompt for GitHub values
echo ""
echo "⚠️  Enter PRODUCTION GitHub OAuth App credentials:"
read -p "Enter GitHub OAuth Client ID (production): " GITHUB_CLIENT_ID
read -sp "Enter GitHub OAuth Client Secret (production): " GITHUB_CLIENT_SECRET
echo ""
echo ""
echo "⚠️  Enter PRODUCTION GitHub App credentials:"
read -p "Enter GitHub App ID (production): " GITHUB_APP_ID
read -p "Path to PRODUCTION GitHub App private key PEM file: " GITHUB_APP_KEY_PATH
echo ""
read -sp "Enter Discogs API Token: " DISCOGS_API_TOKEN
echo ""

# Create secrets
echo ""
echo "Creating app-secrets..."
kubectl create secret generic app-secrets \
  --namespace=vinylvault-production \
  --from-literal=JWT_SECRET="${JWT_SECRET}" \
  --from-literal=SESSION_SECRET="${SESSION_SECRET}" \
  --from-literal=DISCOGS_API_TOKEN="${DISCOGS_API_TOKEN}" \
  --dry-run=client -o yaml | kubectl apply -f -

echo "Creating mongodb-secrets..."
kubectl create secret generic mongodb-secrets \
  --namespace=vinylvault-production \
  --from-literal=MONGODB_BFF_URI="${MONGODB_BFF_URI}" \
  --from-literal=MONGODB_REGISTRY_URI="${MONGODB_REGISTRY_URI}" \
  --from-literal=MONGODB_URI_BASE="${MONGODB_URI_BASE}" \
  --dry-run=client -o yaml | kubectl apply -f -

GITHUB_APP_WEBHOOK_SECRET=$(openssl rand -base64 48)
echo "Creating github-secrets..."
kubectl create secret generic github-secrets \
  --namespace=vinylvault-production \
  --from-literal=GITHUB_CLIENT_ID="${GITHUB_CLIENT_ID}" \
  --from-literal=GITHUB_CLIENT_SECRET="${GITHUB_CLIENT_SECRET}" \
  --from-literal=GITHUB_APP_ID="${GITHUB_APP_ID}" \
  --from-literal=GITHUB_APP_WEBHOOK_SECRET="${GITHUB_APP_WEBHOOK_SECRET}" \
  --dry-run=client -o yaml | kubectl apply -f -

echo "Creating github-app-key..."
kubectl create secret generic github-app-key \
  --namespace=vinylvault-production \
  --from-file=private-key="${GITHUB_APP_KEY_PATH}" \
  --dry-run=client -o yaml | kubectl apply -f -

echo ""
echo "============================================"
echo "  PRODUCTION Secrets Created Successfully"
echo "============================================"
echo ""
echo "⚠️  IMPORTANT: Configure your PRODUCTION GitHub App webhook secret with:"
echo "  Webhook Secret: ${GITHUB_APP_WEBHOOK_SECRET}"
echo ""
echo "⚠️  IMPORTANT: Save these credentials securely!"
echo ""
echo "Ready to deploy to production!"
```

Make executable and run:
```bash
chmod +x setup-production-secrets.sh
./setup-production-secrets.sh
```

---

## Security Best Practices

1. **Separate Credentials**: Never reuse staging credentials in production
2. **Secret Rotation**: Rotate JWT_SECRET and SESSION_SECRET quarterly
3. **Access Control**: Limit who has access to production namespace
4. **Audit Logging**: Enable Kubernetes audit logs for secret access
5. **Backup Secrets**: Store production secrets in secure vault (1Password, Vault, etc.)
6. **Certificate Monitoring**: Set up alerts for TLS certificate expiration
7. **GitHub App Permissions**: Use minimal required permissions (principle of least privilege)
