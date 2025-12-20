# Kustomize Overlays - Deployment Guide

This directory contains environment-specific Kustomize overlays for Vinyl Vault deployment to staging and production environments.

## Directory Structure

```
overlays/
├── staging/
│   ├── kustomization.yaml    # Staging overlay configuration
│   └── SECRETS.md            # Staging secrets setup guide
└── production/
    ├── kustomization.yaml    # Production overlay configuration
    └── SECRETS.md            # Production secrets setup guide
```

---

## Environment Configuration Summary

### Staging Environment

- **Namespace**: `vinylvault-staging`
- **Domain**: `vinylvault.antisocializer.org`
- **Replicas**: 2 per service (backend, BFF, frontend)
- **HPA**: 2-3 replicas (scale based on load)
- **Image Tag**: `latest-staging`
- **Resources**: Standard (256Mi/250m CPU requests, 512Mi/500m CPU limits)
- **MongoDB**: Single replica StatefulSets (deployed in Phase 3)
- **GitHub Apps**: Separate staging OAuth App and GitHub App

### Production Environment

- **Namespace**: `vinylvault-production`
- **Domain**: `vinylvault.loitzl.com`
- **Replicas**: 4 per service (backend, BFF, frontend)
- **HPA**: 4-6 replicas (scale based on load)
- **Image Tag**: `latest-production`
- **Resources**: Enhanced
  - Backend: 512Mi/500m CPU requests, 1Gi/1000m CPU limits
  - BFF: 512Mi/500m CPU requests, 1Gi/1000m CPU limits
  - Frontend: 128Mi/200m CPU requests, 256Mi/400m CPU limits
- **MongoDB**: Single replica StatefulSets (deployed in Phase 3)
- **GitHub Apps**: Separate production OAuth App and GitHub App

---

## Prerequisites

Before deploying to any environment:

1. ✅ **Phase 0**: NFS storage configured on Synology (if using NFS)
2. ✅ **Phase 3**: MongoDB StatefulSets deployed to target namespace
3. ✅ **Phase 4**: Base Kubernetes manifests created
4. ⏳ **Phase 1**: Backend and BFF have `/health` endpoints (required)
5. ⏳ **Phase 2**: Docker images built and pushed to ghcr.io (required)
6. ⏳ **Secrets**: Environment-specific secrets created (see SECRETS.md in each overlay)
7. ⏳ **DNS**: Domain configured to point to cluster ingress (192.168.1.60)
8. ⏳ **GitHub Apps**: OAuth App and GitHub App created for environment

---

## ⚠️ CRITICAL: Secret Creation Order

**Secrets MUST be created BEFORE deploying manifests.**

The Kustomize overlays do NOT include secret template files. Secrets are created using imperative `kubectl create secret generic` commands (see each environment's `SECRETS.md`). This prevents accidentally committing real secret values to the repository.

**Deployment sequence (must follow in order)**:
1. ✅ Create secrets first (SECRETS.md script in each overlay)
2. ✅ Deploy manifests second (`kubectl apply -k overlays/staging/` or `overlays/production/`)

If you skip secret creation and deploy manifests, pods will fail to start with errors like:
```
Error: secret "app-secrets" not found
Error: secret "mongodb-secrets" not found
```

Each environment's `SECRETS.md` contains:
- Detailed secrets setup instructions
- Automated setup script
- Security best practices
- How to rotate/update secrets

Read the appropriate `SECRETS.md` FIRST before deploying:
- **Staging**: `overlays/staging/SECRETS.md`
- **Production**: `overlays/production/SECRETS.md`

---

## Deployment Workflow

### Step 1: Setup MongoDB (Phase 3)

If not already done, deploy MongoDB to the target namespace:

```bash
# Staging
cd infra/k8s/scripts
./deploy-mongodb-staging.sh

# Production
cd infra/k8s/scripts
./deploy-mongodb-production.sh
```

### Step 2: Create Secrets

Follow the secrets guide for your target environment:

```bash
# Staging
cd infra/k8s/overlays/staging
cat SECRETS.md  # Read and follow instructions

# Production
cd infra/k8s/overlays/production
cat SECRETS.md  # Read and follow instructions
```

Or use the automated scripts:

```bash
# Staging
cd infra/k8s/overlays/staging
chmod +x setup-staging-secrets.sh  # (create from SECRETS.md)
./setup-staging-secrets.sh

# Production
cd infra/k8s/overlays/production
chmod +x setup-production-secrets.sh  # (create from SECRETS.md)
./setup-production-secrets.sh
```

### Step 3: Verify Configuration

Preview the generated manifests before applying:

```bash
# Staging
kubectl kustomize infra/k8s/overlays/staging/

# Production
kubectl kustomize infra/k8s/overlays/production/
```

Check for:
- Correct namespace
- Correct domain in Ingress
- Correct replica counts
- Correct image tags
- ConfigMap values match environment

### Step 4: Deploy Application

Apply the overlay to deploy:

```bash
# Staging
kubectl apply -k infra/k8s/overlays/staging/

# Production (use with caution!)
kubectl apply -k infra/k8s/overlays/production/
```

### Step 5: Verify Deployment

Watch pod startup:

```bash
# Staging
kubectl get pods -n vinylvault-staging -w

# Production
kubectl get pods -n vinylvault-production -w
```

Check deployment status:

```bash
# Staging
kubectl get deployments,pods,svc,ingress -n vinylvault-staging

# Production
kubectl get deployments,pods,svc,ingress -n vinylvault-production
```

### Step 6: Verify TLS Certificate

Wait for cert-manager to issue TLS certificate:

```bash
# Staging
kubectl get certificate -n vinylvault-staging
kubectl describe certificate vinylvault-staging-tls -n vinylvault-staging

# Production
kubectl get certificate -n vinylvault-production
kubectl describe certificate vinylvault-production-tls -n vinylvault-production
```

Certificate should show `Ready: True` within 1-2 minutes.

### Step 7: Test Application

```bash
# Staging
curl -I https://vinylvault.antisocializer.org
# Should return 200 OK

# Production
curl -I https://vinylvault.loitzl.com
# Should return 200 OK
```

Test authentication flow in browser:
1. Navigate to domain
2. Click login
3. Authenticate with GitHub
4. Verify redirect back to app with user session

---

## Common Operations

### Update Deployment (Rolling Update)

```bash
# Staging
kubectl apply -k infra/k8s/overlays/staging/

# Production
kubectl apply -k infra/k8s/overlays/production/
```

### Rollback Deployment

```bash
# Staging
kubectl rollout undo deployment/backend -n vinylvault-staging
kubectl rollout undo deployment/bff -n vinylvault-staging
kubectl rollout undo deployment/frontend -n vinylvault-staging

# Production
kubectl rollout undo deployment/backend -n vinylvault-production
kubectl rollout undo deployment/bff -n vinylvault-production
kubectl rollout undo deployment/frontend -n vinylvault-production
```

### View Logs

```bash
# Staging - Backend logs
kubectl logs -f deployment/backend -n vinylvault-staging

# Staging - BFF logs
kubectl logs -f deployment/bff -n vinylvault-staging

# Staging - Frontend logs
kubectl logs -f deployment/frontend -n vinylvault-staging

# Production - use vinylvault-production namespace
```

### Scale Manually (Override HPA)

```bash
# Staging - Scale backend to 3 replicas
kubectl scale deployment backend --replicas=3 -n vinylvault-staging

# Production - Scale BFF to 5 replicas
kubectl scale deployment bff --replicas=5 -n vinylvault-production
```

Note: HPA will override manual scaling based on CPU/memory metrics.

### Delete Deployment

```bash
# Staging (preserves MongoDB data)
kubectl delete -k infra/k8s/overlays/staging/

# Production (use with extreme caution!)
kubectl delete -k infra/k8s/overlays/production/
```

### Update Secrets

```bash
# Example: Update staging JWT secret
kubectl create secret generic app-secrets \
  --namespace=vinylvault-staging \
  --from-literal=JWT_SECRET="new-secret" \
  --from-literal=SESSION_SECRET="existing-session-secret" \
  --from-literal=DISCOGS_API_TOKEN="existing-discogs-token" \
  --dry-run=client -o yaml | kubectl apply -f -

# Restart pods to pick up new secret
kubectl rollout restart deployment/backend -n vinylvault-staging
kubectl rollout restart deployment/bff -n vinylvault-staging
```

---

## Monitoring & Troubleshooting

### Check Pod Status

```bash
# Staging
kubectl get pods -n vinylvault-staging
kubectl describe pod <pod-name> -n vinylvault-staging

# Production
kubectl get pods -n vinylvault-production
kubectl describe pod <pod-name> -n vinylvault-production
```

### Check Resource Usage

```bash
# Staging
kubectl top pods -n vinylvault-staging
kubectl top nodes

# Production
kubectl top pods -n vinylvault-production
kubectl top nodes
```

### Check HPA Status

```bash
# Staging
kubectl get hpa -n vinylvault-staging
kubectl describe hpa backend-hpa -n vinylvault-staging

# Production
kubectl get hpa -n vinylvault-production
kubectl describe hpa backend-hpa -n vinylvault-production
```

### Check Ingress & TLS

```bash
# Staging
kubectl describe ingress vinylvault-ingress -n vinylvault-staging
kubectl get certificate -n vinylvault-staging

# Production
kubectl describe ingress vinylvault-ingress -n vinylvault-production
kubectl get certificate -n vinylvault-production
```

### Common Issues

**Issue**: Pods stuck in `ImagePullBackOff`
- **Cause**: Docker image not built/pushed to ghcr.io
- **Solution**: Complete Phase 2 (Dockerfile optimization) and Phase 6 (CI/CD pipeline)

**Issue**: Pods stuck in `CrashLoopBackOff`
- **Cause**: Missing secrets, MongoDB connection failure, or application error
- **Solution**: Check pod logs: `kubectl logs <pod-name> -n <namespace>`

**Issue**: Certificate not issuing (cert-manager)
- **Cause**: DNS not configured, HTTP-01 challenge failing
- **Solution**: Verify DNS points to ingress IP (192.168.1.60), check cert-manager logs

**Issue**: 502 Bad Gateway on domain
- **Cause**: Pods not ready, BFF/Backend not responding
- **Solution**: Check pod readiness: `kubectl get pods -n <namespace>`

---

## Security Considerations

### Staging
- Can use less strict secrets (but still secure)
- Acceptable to use shared Discogs API key
- Separate GitHub Apps prevents production data leakage

### Production
- **Must** use production-grade secrets (48+ bytes)
- **Must** use separate GitHub OAuth App and GitHub App
- **Must** enable audit logging for secret access
- **Must** rotate secrets regularly (quarterly minimum)
- **Must** backup secrets to secure vault
- Consider implementing Pod Security Standards
- Consider implementing Network Policies for pod-to-pod restrictions

---

## Next Steps

After successful deployment:

1. **Phase 6**: Set up CI/CD pipeline with GitHub Actions for automated deployments
2. **Phase 7**: Document all secrets and establish rotation procedures
3. **Phase 8**: Perform thorough testing in staging environment
4. **Phase 9**: Deploy to production with validation and monitoring

---

## Quick Reference

### Staging Commands
```bash
# Deploy
kubectl apply -k infra/k8s/overlays/staging/

# Status
kubectl get all -n vinylvault-staging

# Logs
kubectl logs -f deployment/bff -n vinylvault-staging

# Rollback
kubectl rollout undo deployment/backend -n vinylvault-staging
```

### Production Commands
```bash
# Deploy (with confirmation!)
kubectl apply -k infra/k8s/overlays/production/

# Status
kubectl get all -n vinylvault-production

# Logs
kubectl logs -f deployment/bff -n vinylvault-production

# Rollback
kubectl rollout undo deployment/backend -n vinylvault-production
```

### DNS Verification
```bash
# Check DNS resolution
nslookup vinylvault.antisocializer.org  # Staging
nslookup vinylvault.loitzl.com          # Production
# Should return: 192.168.1.60
```

### Health Checks
```bash
# Staging
curl https://vinylvault.antisocializer.org/health

# Production
curl https://vinylvault.loitzl.com/health
```
