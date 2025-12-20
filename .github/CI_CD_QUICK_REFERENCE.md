# CI/CD Quick Reference

Quick commands for common CI/CD operations.

## 🚀 Triggering Deployments

### Trigger Build & Staging Deployment

```bash
# Make a change on develop branch
echo "# Update" >> README.md
git add README.md
git commit -m "chore: trigger build and staging deployment"
git push origin develop

# Watch in GitHub Actions
# 1. Actions → Build Docker Images (3-5 min)
# 2. Actions → Deploy to Staging (auto-triggered)
```

### Trigger Production Deployment

1. Go to GitHub repository
2. Click **Actions** tab
3. Select **Deploy to Production** workflow
4. Click **Run workflow** dropdown
5. Select **main** branch
6. Click **Run workflow** button
7. Wait for preflight checks to pass
8. Review approval gate
9. Production deployment begins

Or from command line:

```bash
gh workflow run deploy-production.yml --ref main
```

## 🔍 Monitoring Deployments

### Watch staging deployment

```bash
kubectl get pods -n vinylvault-staging -w
```

### Watch production deployment

```bash
kubectl get pods -n vinylvault-production -w
```

### Check deployment status

```bash
# Staging
kubectl get deployment -n vinylvault-staging -o wide

# Production
kubectl get deployment -n vinylvault-production -o wide
```

### View pod logs

```bash
# Backend logs
kubectl logs -f deployment/backend -n vinylvault-staging

# BFF logs
kubectl logs -f deployment/bff -n vinylvault-staging

# Frontend logs
kubectl logs -f deployment/frontend -n vinylvault-staging

# All pods from a namespace
kubectl logs -f --all-containers=true \
  -l app=backend -n vinylvault-staging
```

### Check pod events

```bash
kubectl describe pod <pod-name> -n vinylvault-staging

# Show last 20 events
kubectl get events -n vinylvault-staging \
  --sort-by='.lastTimestamp' | tail -20
```

## 🐛 Troubleshooting

### Pod won't start

```bash
# Check pod status
kubectl get pods -n vinylvault-staging

# Describe the pod
kubectl describe pod <pod-name> -n vinylvault-staging

# Check logs
kubectl logs <pod-name> -n vinylvault-staging

# Check image availability
kubectl get pods <pod-name> -n vinylvault-staging \
  -o jsonpath='{.spec.containers[0].image}'
```

### Deployment stuck rolling out

```bash
# Check rollout status
kubectl rollout status deployment/backend -n vinylvault-staging

# View rollout history
kubectl rollout history deployment/backend -n vinylvault-staging

# Describe deployment
kubectl describe deployment backend -n vinylvault-staging

# Check recent events
kubectl get events -n vinylvault-staging \
  --field-selector involvedObject.name=backend \
  --sort-by='.lastTimestamp'
```

### ImagePullBackOff error

```bash
# Check if image exists in registry
gh api repos/mloitzl/vinyl-vault/contents/packages \
  --paginate

# Or manually: https://github.com/mloitzl/vinyl-vault/pkgs/container

# Force pull latest image
kubectl rollout restart deployment/backend -n vinylvault-staging
```

### Secrets not found

```bash
# Check if secrets exist
kubectl get secrets -n vinylvault-staging

# Describe a secret
kubectl describe secret app-secrets -n vinylvault-staging

# Create missing secret
kubectl create secret generic app-secrets \
  -n vinylvault-staging \
  --from-literal=JWT_SECRET=$(openssl rand -base64 32) \
  --from-literal=SESSION_SECRET=$(openssl rand -base64 32) \
  --from-literal=DISCOGS_API_TOKEN=your_token
```

## 🔄 Rollback Operations

### Undo staging deployment

```bash
kubectl rollout undo deployment/backend -n vinylvault-staging
kubectl rollout undo deployment/bff -n vinylvault-staging
kubectl rollout undo deployment/frontend -n vinylvault-staging

# Wait for rollback to complete
kubectl rollout status deployment/backend -n vinylvault-staging
```

### Undo production deployment

```bash
kubectl rollout undo deployment/backend -n vinylvault-production
kubectl rollout undo deployment/bff -n vinylvault-production
kubectl rollout undo deployment/frontend -n vinylvault-production
```

### Undo to specific revision

```bash
# View revision history
kubectl rollout history deployment/backend -n vinylvault-staging

# Rollback to revision 2
kubectl rollout undo deployment/backend -n vinylvault-staging --to-revision=2
```

## 📊 Viewing Resources

### Check all resources in namespace

```bash
kubectl get all -n vinylvault-staging
```

### View ingress and certificates

```bash
# Check ingress
kubectl get ingress -n vinylvault-staging

# Describe ingress
kubectl describe ingress -n vinylvault-staging

# Check certificates
kubectl get certificate -n vinylvault-staging

# Describe certificate
kubectl describe certificate -n vinylvault-staging
```

### Check resource usage

```bash
# Pod resource usage
kubectl top pods -n vinylvault-staging

# Node resource usage
kubectl top nodes

# Detailed resource info
kubectl describe nodes
```

### View persistent volumes

```bash
# Check PVCs
kubectl get pvc -n vinylvault-staging

# Check PVs
kubectl get pv

# Describe PVC
kubectl describe pvc <pvc-name> -n vinylvault-staging
```

## 🧪 Testing

### Test GraphQL endpoint (staging)

```bash
# Port forward to BFF
kubectl port-forward -n vinylvault-staging \
  svc/bff 4000:4000 &

# Test endpoint
curl -X POST http://localhost:4000/graphql \
  -H "Content-Type: application/json" \
  -d '{"query": "{ __typename }"}'
```

### Test health endpoints

```bash
# Backend health
curl http://backend.vinylvault-staging.svc.cluster.local:3000/health

# BFF health
curl http://bff.vinylvault-staging.svc.cluster.local:3000/health

# From outside cluster (use port-forward)
kubectl port-forward -n vinylvault-staging \
  svc/backend 3000:3000 &
curl http://localhost:3000/health
```

### Interactive pod testing

```bash
# Run a test pod
kubectl run -it --rm test-pod --image=curlimages/curl \
  --restart=Never -- sh

# Inside the pod
curl http://bff:4000/graphql
curl http://backend:3000/health
curl http://frontend/
```

## 📝 Common Commands Summary

| Task | Command |
|------|---------|
| Trigger staging | `git push origin develop` |
| Trigger production | `gh workflow run deploy-production.yml --ref main` |
| Watch pods | `kubectl get pods -n vinylvault-staging -w` |
| View logs | `kubectl logs -f deployment/backend -n vinylvault-staging` |
| Restart deployment | `kubectl rollout restart deployment/backend -n vinylvault-staging` |
| Undo deployment | `kubectl rollout undo deployment/backend -n vinylvault-staging` |
| Check status | `kubectl get deployment -n vinylvault-staging -o wide` |
| Test connectivity | `kubectl port-forward svc/bff 4000:4000` |
| Create secret | `kubectl create secret generic <name> -n <namespace> --from-literal=key=value` |
| View secrets | `kubectl get secrets -n vinylvault-staging` |
| Check resource usage | `kubectl top pods -n vinylvault-staging` |
| Get all resources | `kubectl get all -n vinylvault-staging` |

## 🔗 Useful Links

- **GitHub Actions**: https://github.com/mloitzl/vinyl-vault/actions
- **Container Registry**: https://github.com/mloitzl/vinyl-vault/pkgs/container
- **Staging App**: https://vinylvault.antisocializer.org
- **Production App**: https://vinylvault.loitzl.com
- **Kubernetes Dashboard** (if configured): Check your K3s setup

## ⚠️ Important Reminders

1. **Always test in staging first** before production
2. **Secrets are per-environment** - create separately for staging and production
3. **Auto-rollback helps** but monitor deployments manually
4. **Check logs** when something goes wrong - they usually tell you what happened
5. **Keep kubeconfig secure** - treat like a password
