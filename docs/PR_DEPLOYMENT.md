# PR Deployment to Staging

## Overview

The PR deployment workflow automatically builds and deploys feature branch images to the staging environment. This allows testing PRs in a realistic environment before merging to `develop`.

## How It Works

### 1. **Build Workflow (build.yml)**
- Triggered on: `push` to `main`, `develop`, feature branches + `pull_request` events
- **PR Images**: Tagged with `pr-{PR_NUMBER}` (e.g., `pr-42`)
- **Branch Images**:
  - `main` → `latest-production`
  - `develop` → `latest-staging`
  - Feature branches → `{commit-sha}`
- Images are **always pushed** to GHCR

### 2. **Deploy PR Workflow (deploy-pr-staging.yml)**
- Triggered on: Pull request with `deploy-staging` label
- Updates Kubernetes staging manifests with PR image tag
- Performs rolling deployment
- Posts status comment on PR

## Usage

### Prerequisites
- Add `KUBE_CONFIG_STAGING` secret to GitHub (base64-encoded kubeconfig)
- Ensure staging K8s cluster has image pull access to GHCR

### Deploying a PR to Staging

1. **Create a PR** against `main` or `develop`
2. **Add the `deploy-staging` label** to the PR
3. **Workflow automatically triggers** after build succeeds
4. **Status comment appears** on PR with deployment link

```bash
# PR images are available immediately:
ghcr.io/mloitzl/vinylvault-backend:pr-42
ghcr.io/mloitzl/vinylvault-bff:pr-42
ghcr.io/mloitzl/vinylvault-frontend:pr-42
```

### Manual Deployment (without GitHub label)

If you want to manually deploy a PR build to staging:

```bash
PR_NUMBER=42
IMAGE_TAG="pr-${PR_NUMBER}"

# Update backend
kubectl set image deployment/backend \
  backend=ghcr.io/mloitzl/vinylvault-backend:${IMAGE_TAG} \
  -n vinylvault-staging

# Update bff
kubectl set image deployment/bff \
  bff=ghcr.io/mloitzl/vinylvault-bff:${IMAGE_TAG} \
  -n vinylvault-staging

# Update frontend
kubectl set image deployment/frontend \
  frontend=ghcr.io/mloitzl/vinylvault-frontend:${IMAGE_TAG} \
  -n vinylvault-staging

# Wait for rollout
kubectl rollout status deployment/backend -n vinylvault-staging --timeout=5m
```

## Image Tagging Scheme

| Trigger | Branch | Tag | Push | Example |
|---------|--------|-----|------|---------|
| `push` | `main` | `latest-production` | ✅ | `latest-production` |
| `push` | `develop` | `latest-staging` | ✅ | `latest-staging` |
| `push` | feature/* | `{commit-sha}` | ✅ | `3e17696` |
| `pull_request` | any | `pr-{number}` | ✅ | `pr-42` |

**Bonus tags**: All images also get tagged with short commit SHA for traceability

## Workflow Status

PR deployment posts a comment with:
- ✅ Success: Link to staging environment
- ❌ Failure: Link to workflow logs

## Environment Variables

Update these in the workflow if needed:

```yaml
KUBE_NAMESPACE: vinylvault-staging  # Target namespace
REGISTRY: ghcr.io                    # Container registry
```

## Troubleshooting

**Deployment doesn't trigger?**
- Check that PR has `deploy-staging` label
- Verify `KUBE_CONFIG_STAGING` secret exists

**Images not found?**
- Ensure build workflow completed successfully
- Check GHCR credentials in staging cluster

**Rollout timeout?**
- Check pod logs: `kubectl logs -n vinylvault-staging`
- Verify image pull secrets are configured

## Related

- [Build Workflow](./build.yml) - Creates PR images
- [Deploy Production](./deploy-production.yml) - Production deployment
- [Deploy Staging](./deploy-staging.yml) - Develop branch auto-deploy
