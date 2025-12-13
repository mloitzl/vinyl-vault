# Kubernetes Base Manifests - Phase 4

This directory contains the base Kubernetes manifests for Vinyl Vault deployment.

## Directory Structure

```
base/
├── backend/
│   ├── deployment.yaml       # Backend GraphQL server deployment
│   ├── service.yaml          # Backend ClusterIP service
│   └── hpa.yaml              # Horizontal Pod Autoscaler (2-4 replicas)
├── bff/
│   ├── deployment.yaml       # BFF API & Auth server deployment
│   ├── service.yaml          # BFF ClusterIP service (with session affinity)
│   └── hpa.yaml              # Horizontal Pod Autoscaler (2-4 replicas)
├── frontend/
│   ├── deployment.yaml       # Frontend static files (nginx)
│   ├── service.yaml          # Frontend ClusterIP service
│   └── hpa.yaml              # Horizontal Pod Autoscaler (2-4 replicas)
├── ingress/
│   └── ingress.yaml          # Traefik ingress with TLS (cert-manager)
├── configmaps/
│   └── app-config.yaml       # Non-sensitive configuration
├── secrets/
│   ├── app-secrets.yaml      # JWT, session secrets (template)
│   ├── mongodb-secrets.yaml  # MongoDB connection strings (template)
│   └── github-secrets.yaml   # GitHub OAuth & App credentials (template)
└── kustomization.yaml        # Base kustomization config
```

## Resource Allocation

### Backend (GraphQL API)
- **Requests**: 256Mi memory, 250m CPU
- **Limits**: 512Mi memory, 500m CPU
- **Replicas**: 2-4 (HPA based on 70% CPU, 80% memory)

### BFF (API & Auth)
- **Requests**: 256Mi memory, 250m CPU
- **Limits**: 512Mi memory, 500m CPU
- **Replicas**: 2-4 (HPA based on 70% CPU, 80% memory)
- **Session Affinity**: ClientIP (3-hour timeout)

### Frontend (Static Files)
- **Requests**: 64Mi memory, 100m CPU
- **Limits**: 128Mi memory, 200m CPU
- **Replicas**: 2-4 (HPA based on 70% CPU)

## Configuration Management

### ConfigMaps (Non-Sensitive)
The `app-config` ConfigMap contains:
- Frontend URL (public domain)
- BFF/Backend URLs (internal cluster DNS)
- GitHub App installation URL
- Feature flags

**Note**: Will be overridden by environment-specific overlays.

### Secrets (Sensitive)
Three separate secrets for better organization:

1. **app-secrets**: JWT secret, session secret, Discogs API key
2. **mongodb-secrets**: MongoDB connection strings from Phase 3
3. **github-secrets**: GitHub OAuth credentials and App private key

**Important**: Secret templates contain placeholders. Generate real values using:
```bash
# Generate random secret
openssl rand -base64 32

# Base64 encode for Kubernetes
echo -n 'your-secret-value' | base64
```

## Health Checks

All services include liveness and readiness probes:

- **Backend**: `GET /health` on port 4000
- **BFF**: `GET /health` on port 3000
- **Frontend**: `GET /` on port 80

**Note**: Backend and BFF require Phase 1 (Security Hardening) to add `/health` endpoints.

## Ingress & TLS

The ingress configuration:
- Uses Traefik ingress controller (pre-installed on K3s)
- Automatic TLS via cert-manager with `letsencrypt-prod` ClusterIssuer
- Routes:
  - `/` → Frontend (port 80)
  - `/api` → BFF (port 3000)
  - `/auth` → BFF (port 3000)
  - `/graphql` → Backend (port 4000)

## Docker Images

Expected image names:
- `ghcr.io/mloitzl/vinyl-vault-backend:latest`
- `ghcr.io/mloitzl/vinyl-vault-bff:latest`
- `ghcr.io/mloitzl/vinyl-vault-frontend:latest`

Images will be built in Phase 6 (CI/CD Pipeline).

## Next Steps

1. **Phase 5**: Create staging and production overlays with:
   - Environment-specific domains
   - Namespace patches
   - Resource adjustments
   - Replica count overrides (staging: 2, production: 4)

2. **Before Deployment**: 
   - Complete Phase 1 (add `/health` endpoints)
   - Complete Phase 2 (optimize Dockerfiles)
   - Build and push Docker images to ghcr.io
   - Generate and apply secrets to cluster

## Deployment Preview

To preview the manifests:
```bash
kubectl kustomize infra/k8s/base/
```

**Note**: This will not deploy yet (overlays needed for environment-specific config).
