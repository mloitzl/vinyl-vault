# Phase 6 Setup Checklist

Complete this checklist to get your CI/CD pipeline ready for first deployment.

## 📋 Pre-Setup Verification

- [ ] Self-hosted runner is online with label `self-hosted`
  ```bash
  # Verify runner health in GitHub Actions settings
  ```

- [ ] You have admin access to the GitHub repository
  - [ ] Can create secrets
  - [ ] Can view Actions tab
  - [ ] Can view workflow runs

- [ ] K3s cluster is accessible
  ```bash
  kubectl cluster-info
  kubectl get nodes
  ```

## 1️⃣ GitHub Repository Secret Setup

### Create KUBECONFIG Secret

**Why**: Allows workflows to authenticate with your K3s cluster

**Steps**:

1. Get your kubeconfig:
   ```bash
   # SSH to K3s control plane
   ssh pi@<control-plane-ip>
   
   # Display kubeconfig
   cat ~/.kube/config
   ```

2. In GitHub, go to **Settings → Secrets and variables → Actions**

3. Click **New repository secret**

4. Create secret:
   - **Name**: `KUBECONFIG`
   - **Value**: Paste entire kubeconfig YAML (from step 1)
   - Click **Add secret**

5. Verify creation:
   ```bash
   # Try a test push to develop - should see kubeconfig being used
   ```

✅ **Verified**:
- [ ] `KUBECONFIG` secret created in GitHub
- [ ] Can see it listed in Secrets and variables
- [ ] Value is the complete kubeconfig YAML

---

## 2️⃣ Staging Namespace Secrets Setup

### Create Kubernetes Secrets in Staging

**Location**: `vinylvault-staging` namespace

**Required Secrets**: 4 total

#### Step 1: Create app-secrets

```bash
# Generate secure random values
JWT_SECRET=$(openssl rand -base64 32)
SESSION_SECRET=$(openssl rand -base64 32)

# DISCOGS_API_TOKEN - get from your Discogs account (or use placeholder)
DISCOGS_TOKEN="your_discogs_api_token_here"

# Create the secret
kubectl create secret generic app-secrets \
  -n vinylvault-staging \
  --from-literal=JWT_SECRET="$JWT_SECRET" \
  --from-literal=SESSION_SECRET="$SESSION_SECRET" \
  --from-literal=DISCOGS_API_TOKEN="$DISCOGS_TOKEN"
```

✅ Verify:
```bash
kubectl get secret app-secrets -n vinylvault-staging
kubectl describe secret app-secrets -n vinylvault-staging
```

- [ ] `app-secrets` created in staging

#### Step 2: Create mongodb-secrets

```bash
# Get connection strings from MongoDB deployment
# Or generate them if creating fresh MongoDB

# Example (adjust for your actual MongoDB setup):
MONGODB_BFF_URI="mongodb://root:password@mongodb-bff-0.mongodb-bff.vinylvault-staging.svc.cluster.local:27017/vinylvault_bff?authSource=admin"
MONGODB_REGISTRY_URI="mongodb://root:password@mongodb-backend-0.mongodb-backend.vinylvault-staging.svc.cluster.local:27017/vinylvault_registry?authSource=admin"
MONGODB_URI_BASE="mongodb://root:password@mongodb-backend-0.mongodb-backend.vinylvault-staging.svc.cluster.local:27017?authSource=admin"

# Create the secret
kubectl create secret generic mongodb-secrets \
  -n vinylvault-staging \
  --from-literal=MONGODB_BFF_URI="$MONGODB_BFF_URI" \
  --from-literal=MONGODB_REGISTRY_URI="$MONGODB_REGISTRY_URI" \
  --from-literal=MONGODB_URI_BASE="$MONGODB_URI_BASE"
```

✅ Verify:
```bash
kubectl get secret mongodb-secrets -n vinylvault-staging
```

- [ ] `mongodb-secrets` created in staging

#### Step 3: Create github-secrets

```bash
# Get values from your GitHub OAuth App and GitHub App

GITHUB_CLIENT_ID="your_oauth_app_id"
GITHUB_CLIENT_SECRET="your_oauth_app_secret"
GITHUB_APP_ID="your_github_app_id"
GITHUB_APP_WEBHOOK_SECRET="your_webhook_secret"

# Create the secret
kubectl create secret generic github-secrets \
  -n vinylvault-staging \
  --from-literal=GITHUB_CLIENT_ID="$GITHUB_CLIENT_ID" \
  --from-literal=GITHUB_CLIENT_SECRET="$GITHUB_CLIENT_SECRET" \
  --from-literal=GITHUB_APP_ID="$GITHUB_APP_ID" \
  --from-literal=GITHUB_APP_WEBHOOK_SECRET="$GITHUB_APP_WEBHOOK_SECRET"
```

✅ Verify:
```bash
kubectl get secret github-secrets -n vinylvault-staging
```

- [ ] `github-secrets` created in staging

#### Step 4: Create github-app-key

```bash
# Save your GitHub App private key to a file (if not already done)
# Then create the secret

kubectl create secret generic github-app-key \
  -n vinylvault-staging \
  --from-file=private-key.pem=/path/to/private-key.pem
```

✅ Verify:
```bash
kubectl get secret github-app-key -n vinylvault-staging
kubectl describe secret github-app-key -n vinylvault-staging
```

- [ ] `github-app-key` created in staging

#### Verify All Staging Secrets

```bash
# List all secrets
kubectl get secrets -n vinylvault-staging

# Should show:
# - app-secrets
# - github-app-key
# - github-secrets
# - mongodb-secrets
```

- [ ] All 4 secrets visible in staging namespace

---

## 3️⃣ Production Namespace Secrets Setup

### Repeat for Production

**Important**: Create separate secrets in `vinylvault-production` namespace

**Use different values**:
- `JWT_SECRET` - Generate new random value
- `SESSION_SECRET` - Generate new random value
- `GITHUB_CLIENT_ID` - Use production GitHub OAuth App
- `GITHUB_CLIENT_SECRET` - Use production OAuth App secret
- `GITHUB_APP_ID` - Use production GitHub App ID
- `GITHUB_APP_WEBHOOK_SECRET` - Use production webhook secret
- `github-app-key` - Use production GitHub App private key

**Steps**:

```bash
# Create namespace if needed
kubectl create namespace vinylvault-production

# Then follow Steps 1-4 above, but replace:
# - `-n vinylvault-staging` with `-n vinylvault-production`
# - Use production GitHub app values
# - Generate new random secrets (JWT_SECRET, SESSION_SECRET)
```

- [ ] `app-secrets` created in production
- [ ] `mongodb-secrets` created in production
- [ ] `github-secrets` created in production
- [ ] `github-app-key` created in production

---

## 4️⃣ Self-Hosted Runner Verification

### Verify Runner Setup

```bash
# 1. Check runner is online
# Go to GitHub: Settings → Actions → Runners
# Should see "self-hosted" runner with status "Idle"

# 2. SSH into runner machine
ssh runner@<runner-ip>

# 3. Verify required tools
which kubectl
which kustomize
echo $KUBECONFIG

# 4. Test cluster access
kubectl cluster-info
kubectl get nodes

# 5. Verify GitHub Runner process
ps aux | grep actions-runner
# Should see running process
```

Required on runner:

- [ ] kubectl installed: `which kubectl`
- [ ] kustomize installed: `which kustomize`
- [ ] KUBECONFIG set: `echo $KUBECONFIG`
- [ ] Cluster access works: `kubectl cluster-info`
- [ ] Can list nodes: `kubectl get nodes`

### Fix Missing Tools (if needed)

```bash
# Install kubectl (ARM64 for Raspberry Pi)
curl -LO "https://dl.k8s.io/release/$(curl -L -s https://dl.k8s.io/release/stable.txt)/bin/linux/arm64/kubectl"
chmod +x kubectl
sudo mv kubectl /usr/local/bin/

# Install kustomize
curl -s "https://raw.githubusercontent.com/kubernetes-sigs/kustomize/master/hack/install_kustomize.sh" | bash
sudo mv kustomize /usr/local/bin/

# Set KUBECONFIG
export KUBECONFIG=/path/to/kubeconfig.yaml
# Make persistent in ~/.bashrc or ~/.zshrc
echo 'export KUBECONFIG=/path/to/kubeconfig.yaml' >> ~/.bashrc
```

---

## 5️⃣ DNS Configuration

### Verify Domain Pointing

```bash
# Test staging domain
nslookup vinylvault.antisocializer.org
# Should resolve to your Traefik LoadBalancer IP

# Test production domain
nslookup vinylvault.loitzl.com
# Should resolve to your Traefik LoadBalancer IP

# Get LoadBalancer IP if needed
kubectl get svc -A | grep traefik
# Look for EXTERNAL-IP (should be your Traefik load balancer)
```

- [ ] Staging domain resolves: `vinylvault.antisocializer.org`
- [ ] Production domain resolves: `vinylvault.loitzl.com`
- [ ] Both point to Traefik LoadBalancer IP

---

## 6️⃣ Pre-deployment Code Requirements

### Phase 1 Prerequisites

Before deploying, these code changes must be made (Phase 1):

- [ ] Backend has `/health` endpoint at `GET /health`
- [ ] BFF has `/health` endpoint at `GET /health`
- [ ] Both endpoints return `{ status: 'ok', timestamp: '...' }`

**Why**: Kubernetes health probes depend on these endpoints

---

## 7️⃣ Test the Setup

### Test Build Workflow

```bash
# Make a small change to develop branch
git checkout develop
echo "# test" >> README.md
git add README.md
git commit -m "test: trigger build workflow"
git push origin develop

# Watch in GitHub Actions
# Go to Actions tab → Build Docker Images
# Should see all 3 services building
```

- [ ] Build workflow triggers on develop push
- [ ] All 3 images build successfully
- [ ] Images pushed to ghcr.io with tags

**Verify images**:
```bash
# Check registry (GitHub → Packages)
# Should see: vinylvault-backend, vinylvault-bff, vinylvault-frontend
# Each with tags: latest-staging, <commit-sha>
```

### Test Staging Deployment

```bash
# Make another change to develop
echo "# test 2" >> README.md
git add README.md
git commit -m "test: trigger staging deployment"
git push origin develop

# Watch in GitHub Actions
# 1. Build Docker Images (3-5 min)
# 2. Deploy to Staging (auto-triggered)
```

- [ ] Staging deployment triggers automatically
- [ ] Manifests preview displays
- [ ] kubectl apply succeeds
- [ ] Pods rollout successfully
- [ ] Health checks pass
- [ ] Smoke tests pass

**Verify deployment**:
```bash
kubectl get pods -n vinylvault-staging
kubectl get deployment -n vinylvault-staging -o wide
```

### Test Production Deployment (Optional)

```bash
# Go to GitHub Actions tab
# Select "Deploy to Production" workflow
# Click "Run workflow"
# Select "main" branch
# Click "Run workflow"

# Follow through approval gate and deployment
```

- [ ] Manual trigger works
- [ ] Pre-flight checks pass
- [ ] Approval gate appears
- [ ] Can approve deployment
- [ ] Deployment succeeds

---

## ✅ Final Checklist

### GitHub Configuration

- [ ] `KUBECONFIG` secret created and verified
- [ ] Self-hosted runner labeled `self-hosted` is online

### Kubernetes Secrets - Staging

- [ ] `app-secrets` created with all 3 keys
- [ ] `mongodb-secrets` created with all 3 keys
- [ ] `github-secrets` created with all 4 keys
- [ ] `github-app-key` created with PEM file

### Kubernetes Secrets - Production

- [ ] `app-secrets` created with production values
- [ ] `mongodb-secrets` created with production URIs
- [ ] `github-secrets` created with production values
- [ ] `github-app-key` created with production key

### Self-Hosted Runner

- [ ] kubectl installed and working
- [ ] kustomize installed and working
- [ ] KUBECONFIG environment variable set
- [ ] Cluster connectivity verified
- [ ] Runner idle and ready

### DNS & Infrastructure

- [ ] Staging domain resolves correctly
- [ ] Production domain resolves correctly
- [ ] Traefik LoadBalancer IP confirmed
- [ ] MongoDB deployed to both namespaces

### Application Code

- [ ] Backend `/health` endpoint implemented
- [ ] BFF `/health` endpoint implemented
- [ ] (Will be done in Phase 1)

### Testing

- [ ] Build workflow tested
- [ ] Staging deployment tested
- [ ] Production deployment tested (optional)

---

## 🚀 Ready to Deploy!

Once all checkboxes above are checked, your CI/CD pipeline is fully configured and ready for:

1. **Automatic staging deployments** on every develop push
2. **Manual production deployments** via GitHub Actions UI
3. **Docker image building** to ghcr.io
4. **Health monitoring** and smoke tests
5. **Optional auto-rollback** on failures

---

## 📝 Save Your Setup

Keep these values safe:

```bash
# Create a secure notes file (NEVER commit to git)
cat > ~/.vinyl-vault-setup.txt <<'EOF'
STAGING NAMESPACE: vinylvault-staging

GitHub Secrets:
- KUBECONFIG: [in GitHub, not in this file]

K3s Control Plane: [your IP]
Traefik LoadBalancer IP: [your IP]

Staging Domain: vinylvault.antisocializer.org
Production Domain: vinylvault.loitzl.com

Self-hosted Runner: 
- Status: Check GitHub Actions settings
- Tools: kubectl, kustomize, KUBECONFIG set

MongoDB Staging: [check deployment]
MongoDB Production: [check deployment]
EOF

# Make it readable only by you
chmod 600 ~/.vinyl-vault-setup.txt
```

---

## 🆘 Troubleshooting

### Secret not found error in deployment
→ See `infra/k8s/overlays/staging/SECRETS.md`

### kubeconfig error on runner
→ SSH to runner and verify: `echo $KUBECONFIG`

### Workflow stuck on rollout
→ Check pod logs: `kubectl logs <pod-name> -n vinylvault-staging`

### Images not pushing to registry
→ Check GITHUB_TOKEN permissions (automatic)

See `.github/CI_CD_SETUP.md` for detailed troubleshooting

---

**Once complete, your CI/CD pipeline is production-ready! 🎉**
