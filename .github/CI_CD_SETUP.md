# GitHub Actions Secrets Setup Guide

This guide explains how to configure GitHub repository secrets needed for the Vinyl Vault CI/CD pipeline.

## Overview

The CI/CD pipeline requires secrets for:
1. **Docker Registry Access** - Push images to ghcr.io
2. **Kubernetes Cluster Access** - Deploy to K3s cluster via kubectl
3. **Environment Configuration** - Application secrets for staging/production

## Repository Secrets

Go to **Settings → Secrets and variables → Actions** to create these secrets.

### 1. Docker Registry (Automatic)

**Secret Name**: `GITHUB_TOKEN` (automatically provided)

- **Type**: Automatic GitHub token
- **Usage**: Authenticate with ghcr.io (GitHub Container Registry)
- **Permissions Required**: `packages: write`
- **Status**: ✅ Already configured in workflows

The workflows use the automatic `GITHUB_TOKEN` which has permission to push to ghcr.io. No manual configuration needed.

### 2. Kubernetes Cluster Access

#### Create kubeconfig secret

**Secret Name**: `KUBECONFIG`

1. Get kubeconfig from your K3s control plane:

   ```bash
   # SSH to control plane node
   ssh pi@<control-plane-ip>
   
   # Get kubeconfig content
   cat ~/.kube/config
   ```

2. Create the secret:
   - Go to **Settings → Secrets and variables → Actions**
   - Click **New repository secret**
   - **Name**: `KUBECONFIG`
   - **Value**: Paste the entire kubeconfig YAML content
   - Click **Add secret**

3. Verify the kubeconfig works:

   ```bash
   # The workflows will use this automatically
   # Test locally:
   export KUBECONFIG=<your-kubeconfig-path>
   kubectl cluster-info
   kubectl get nodes
   ```

**⚠️ Security Note**: The kubeconfig contains the cluster CA certificate and authentication tokens. Treat it as sensitive data:
- Store in GitHub secrets (encrypted)
- Do NOT commit to repository
- Rotate credentials if compromised
- Consider using short-lived tokens with RBAC

#### Configure RBAC for self-hosted runner

The self-hosted runner should have a dedicated service account with minimal permissions:

```yaml
# Create service account for CI/CD
apiVersion: v1
kind: ServiceAccount
metadata:
  name: github-actions-ci
  namespace: kube-system
---
# Role for deployment permissions
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRole
metadata:
  name: github-actions-ci
rules:
  # Deployments
  - apiGroups: ["apps"]
    resources: ["deployments", "replicasets", "statefulsets"]
    verbs: ["get", "list", "watch", "create", "update", "patch", "delete"]
  
  # Pods and logs
  - apiGroups: [""]
    resources: ["pods", "pods/log"]
    verbs: ["get", "list", "watch"]
  
  # Services and ingress
  - apiGroups: [""]
    resources: ["services"]
    verbs: ["get", "list", "watch"]
  - apiGroups: ["networking.k8s.io"]
    resources: ["ingresses"]
    verbs: ["get", "list", "watch"]
  
  # Certificates (cert-manager)
  - apiGroups: ["cert-manager.io"]
    resources: ["certificates"]
    verbs: ["get", "list", "watch"]
  
  # Secrets (read-only for verification)
  - apiGroups: [""]
    resources: ["secrets"]
    verbs: ["get", "list"]
  
  # Persistent volumes
  - apiGroups: [""]
    resources: ["persistentvolumeclaims"]
    verbs: ["get", "list", "watch"]
  
  # Events
  - apiGroups: [""]
    resources: ["events"]
    verbs: ["get", "list"]
---
# Bind role to service account
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRoleBinding
metadata:
  name: github-actions-ci
roleRef:
  apiGroup: rbac.authorization.k8s.io
  kind: ClusterRole
  name: github-actions-ci
subjects:
  - kind: ServiceAccount
    name: github-actions-ci
    namespace: kube-system
```

Apply the RBAC:

```bash
kubectl apply -f - <<'EOF'
[paste the YAML above]
EOF
```

### 3. Environment-Specific Secrets

These secrets are created directly in Kubernetes namespaces (not GitHub secrets). The workflows verify they exist before deploying.

For details on creating these secrets, see:
- **Staging**: `infra/k8s/overlays/staging/SECRETS.md`
- **Production**: `infra/k8s/overlays/production/SECRETS.md`

The secrets required in each namespace:

#### app-secrets

```bash
kubectl create secret generic app-secrets \
  -n vinylvault-staging \
  --from-literal=JWT_SECRET=$(openssl rand -base64 32) \
  --from-literal=SESSION_SECRET=$(openssl rand -base64 32) \
  --from-literal=DISCOGS_API_TOKEN=your_discogs_api_key
```

#### mongodb-secrets

```bash
kubectl create secret generic mongodb-secrets \
  -n vinylvault-staging \
  --from-literal=MONGODB_BFF_URI="mongodb://user:password@..." \
  --from-literal=MONGODB_REGISTRY_URI="mongodb://user:password@..." \
  --from-literal=MONGODB_URI_BASE="mongodb://user:password@..."
```

#### github-secrets

```bash
kubectl create secret generic github-secrets \
  -n vinylvault-staging \
  --from-literal=GITHUB_CLIENT_ID=your_oauth_app_id \
  --from-literal=GITHUB_CLIENT_SECRET=your_oauth_app_secret \
  --from-literal=GITHUB_APP_ID=your_github_app_id \
  --from-literal=GITHUB_APP_WEBHOOK_SECRET=your_webhook_secret
```

#### github-app-key

```bash
kubectl create secret generic github-app-key \
  -n vinylvault-staging \
  --from-file=private-key.pem=path/to/private-key.pem
```

## Workflow Secrets Usage

### build.yml

```yaml
env:
  REGISTRY: ghcr.io
  GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}  # Automatic token
```

**What it does**:
- Uses automatic `GITHUB_TOKEN` to authenticate with ghcr.io
- Builds and pushes Docker images for backend, BFF, frontend
- Tags images with `latest-staging` (develop branch) or `latest-production` (main branch)
- Also tags with commit SHA for reference

### deploy-staging.yml

```yaml
env:
  NAMESPACE: vinylvault-staging
  KUSTOMIZE_PATH: infra/k8s/overlays/staging
```

**What it does**:
- Runs on self-hosted runner (label: `self-hosted`)
- Uses kubeconfig from `$KUBECONFIG` environment variable
- Verifies all Kubernetes secrets exist before deploying
- Deploys with kustomize
- Waits for rollout and runs smoke tests

**Kubernetes secrets verified**:
- `app-secrets`
- `mongodb-secrets`
- `github-secrets`
- `github-app-key`

### deploy-production.yml

```yaml
env:
  NAMESPACE: vinylvault-production
  KUSTOMIZE_PATH: infra/k8s/overlays/production
```

**What it does**:
- Runs on self-hosted runner (label: `self-hosted`)
- Triggered manually via workflow_dispatch (requires manual approval)
- Includes preflight checks for production safety
- Verifies all Kubernetes secrets exist
- Optionally auto-rollback on failure

**Additional input parameters**:
- `auto_rollback` (default: true) - Automatically rollback if deployment fails

## Setting Up Self-Hosted Runner

The self-hosted runner is already installed with label `self-hosted`. Verify setup:

```bash
# On the self-hosted runner machine:
echo $KUBECONFIG
kubectl cluster-info

# Should show cluster connection details
```

### Ensure runner has:

```bash
# Check installations
which kubectl
which kustomize
echo $KUBECONFIG

# kubectl version
kubectl version --client

# kustomize version
kustomize version
```

If any are missing:

```bash
# Install kubectl
curl -LO "https://dl.k8s.io/release/$(curl -L -s https://dl.k8s.io/release/stable.txt)/bin/darwin/arm64/kubectl"
chmod +x kubectl
sudo mv kubectl /usr/local/bin/

# Install kustomize
curl -s "https://raw.githubusercontent.com/kubernetes-sigs/kustomize/master/hack/install_kustomize.sh" | bash
sudo mv kustomize /usr/local/bin/
```

## Quick Checklist

- [ ] **GitHub secrets configured**:
  - [ ] `KUBECONFIG` created with K3s cluster configuration
  
- [ ] **Kubernetes secrets created in staging**:
  - [ ] `app-secrets`
  - [ ] `mongodb-secrets`
  - [ ] `github-secrets`
  - [ ] `github-app-key`

- [ ] **Kubernetes secrets created in production**:
  - [ ] `app-secrets`
  - [ ] `mongodb-secrets`
  - [ ] `github-secrets`
  - [ ] `github-app-key`

- [ ] **Self-hosted runner configured**:
  - [ ] Running with label `self-hosted`
  - [ ] `kubectl` installed and configured
  - [ ] `kustomize` installed
  - [ ] `KUBECONFIG` environment variable set

- [ ] **DNS configured**:
  - [ ] `vinylvault.antisocializer.org` → Traefik LoadBalancer
  - [ ] `vinylvault.loitzl.com` → Traefik LoadBalancer

## Testing the Setup

### Test build workflow

1. Push to develop branch or create pull request
2. Check **Actions** tab → **Build Docker Images** workflow
3. Verify images are pushed to ghcr.io:

   ```bash
   # List images in ghcr.io
   gh api "repos/{owner}/vinyl-vault/contents/packages" \
     --jq '.[] | select(.type == "dir") | .name'
   
   # Or manually check at: https://github.com/mloitzl/vinyl-vault/pkgs/container
   ```

### Test staging deployment

1. Create a test branch from develop
2. Make a small change to a package
3. Create a pull request to develop
4. Once merged, deployment should trigger automatically
5. Check **Actions** tab → **Deploy to Staging** workflow
6. Verify pods are running:

   ```bash
   kubectl get pods -n vinylvault-staging -w
   ```

### Test production deployment

1. Go to **Actions** tab → **Deploy to Production**
2. Click **Run workflow** → select branch (main)
3. Follow the deployment progress
4. Monitor with:

   ```bash
   kubectl get pods -n vinylvault-production -w
   kubectl get deployment -n vinylvault-production
   ```

## Troubleshooting

### "secret app-secrets not found" error

**Problem**: Deployment workflow fails with missing secret error

**Solution**:
```bash
# Create the missing secret
kubectl create secret generic app-secrets \
  -n vinylvault-staging \
  --from-literal=JWT_SECRET=$(openssl rand -base64 32) \
  --from-literal=SESSION_SECRET=$(openssl rand -base64 32) \
  --from-literal=DISCOGS_API_TOKEN=your_token
```

See `infra/k8s/overlays/staging/SECRETS.md` for complete setup.

### "kubeconfig: not found" error

**Problem**: Self-hosted runner cannot access cluster

**Solution**:
1. Verify `KUBECONFIG` is set:
   ```bash
   echo $KUBECONFIG
   cat $KUBECONFIG
   ```

2. Set it if missing:
   ```bash
   export KUBECONFIG=/path/to/kubeconfig.yaml
   ```

3. Verify connectivity:
   ```bash
   kubectl cluster-info
   kubectl get nodes
   ```

### Workflow stuck on "waiting for deployments"

**Problem**: Rollout status checking hangs

**Solution**:
1. Check pod status:
   ```bash
   kubectl get pods -n vinylvault-staging
   kubectl describe pod <pod-name> -n vinylvault-staging
   ```

2. Check logs:
   ```bash
   kubectl logs <pod-name> -n vinylvault-staging
   ```

3. Check image availability:
   ```bash
   kubectl describe deployment <deployment-name> -n vinylvault-staging
   ```

4. Manually fix and re-run workflow:
   ```bash
   # If needed, manually deploy
   kubectl apply -k infra/k8s/overlays/staging/
   ```

## Security Best Practices

1. **Rotate secrets regularly**:
   - JWT_SECRET and SESSION_SECRET every 30 days
   - GitHub OAuth credentials when compromised
   - MongoDB passwords per security policy

2. **Limit secret scope**:
   - Use different secrets for staging vs production
   - Use RBAC to restrict which pods can access which secrets
   - Never log secret values

3. **Audit secret access**:
   - Monitor kubectl commands that access secrets
   - Review GitHub Actions logs for secret usage
   - Implement secret scanning in CI/CD

4. **Secure self-hosted runner**:
   - Keep kubeconfig secure (encrypted in GitHub)
   - Use separate service account with minimal RBAC
   - Monitor runner health and updates
   - Isolate runner from untrusted networks

## Next Steps

1. ✅ Create `KUBECONFIG` secret in GitHub
2. ✅ Verify self-hosted runner is running
3. ✅ Create Kubernetes secrets in staging (via SECRETS.md)
4. ✅ Create Kubernetes secrets in production (via SECRETS.md)
5. ✅ Test build workflow by pushing to develop
6. ✅ Test staging deployment (triggered automatically)
7. ✅ Test production deployment (manual trigger)
