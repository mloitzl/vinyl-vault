# Build and Deployment Scripts

Quick reference for local Docker image building and Kubernetes deployment.

## 🏗️ Building Images

### Build and Push to GHCR

```bash
# Build all services with auto-detected tag
./scripts/build-and-push-images.sh

# Build with custom tag
./scripts/build-and-push-images.sh my-feature-v1

# Build specific services only
./scripts/build-and-push-images.sh my-tag backend frontend
```

**First-time setup:**
```bash
# 1. Create GitHub Personal Access Token
#    https://github.com/settings/tokens/new?scopes=write:packages

# 2. Login to GHCR
export GITHUB_TOKEN="your_token_here"
echo $GITHUB_TOKEN | docker login ghcr.io -u YOUR_GITHUB_USERNAME --password-stdin
```

**Auto-tagging:**
- On `main` branch → `latest-production`
- On `develop` branch → `latest-staging`
- On feature branches → commit SHA (e.g., `abc1234`)

## 🚀 Deploying to Staging

### Deploy to Kubernetes

```bash
# Deploy current branch (auto-detects image tag)
./scripts/deploy-branch-to-staging.sh

# Deploy specific branch
./scripts/deploy-branch-to-staging.sh feature/my-feature
```

**Requirements:**
- kubectl configured for staging cluster
- Images already pushed to GHCR
- Access to `vinylvault-staging` namespace

## 📋 Complete Workflow

### Local Development Cycle

```bash
# 1. Create feature branch
git checkout -b feature/new-feature

# 2. Make changes
# ... edit code ...

# 3. Commit
git commit -am "Add new feature"

# 4. Build and push images
./scripts/build-and-push-images.sh
# → Images tagged with commit SHA

# 5. Deploy to staging
./scripts/deploy-branch-to-staging.sh
# → Uses same commit SHA

# 6. Test
open https://vinylvault.antisocializer.org
```

### Using GitHub Actions Instead

```bash
# 1. Push your branch
git push origin feature/my-feature

# 2. Go to GitHub Actions → "Deploy Any Branch to Staging"

# 3. Click "Run workflow" → Select your branch

# 4. Test deployment
```

## 🛠️ Available Scripts

| Script | Purpose | Example |
|--------|---------|---------|
| `build-and-push-images.sh` | Build and push Docker images | `./scripts/build-and-push-images.sh my-tag` |
| `deploy-branch-to-staging.sh` | Deploy to K8s staging | `./scripts/deploy-branch-to-staging.sh` |

## 🔍 Verification

```bash
# Check deployed images
kubectl get pods -n vinylvault-staging -o jsonpath='{range .items[*]}{.metadata.name}{"\t"}{.spec.containers[0].image}{"\n"}{end}'

# Check rollout status
kubectl rollout status deployment/backend -n vinylvault-staging

# View logs
kubectl logs -f -l app=backend -n vinylvault-staging
```

## 📚 Documentation

Full documentation: [DEPLOY_ANY_BRANCH_TO_STAGING.md](../docs/DEPLOY_ANY_BRANCH_TO_STAGING.md)

---

## Quick Tips

- **Fast iteration:** Build locally, deploy immediately
- **CI/CD:** Push to GitHub, use Actions to build & deploy
- **PR testing:** Add `deploy-staging` label to PR for auto-deploy
- **Rollback:** `kubectl rollout undo deployment/SERVICE -n vinylvault-staging`
- **Logs:** `kubectl logs -f -l app=SERVICE -n vinylvault-staging`
