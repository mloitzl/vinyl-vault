# Kubernetes Infrastructure

This directory contains Kubernetes manifests and scripts for deploying Vinyl Vault to your K3s cluster.

## Directory Structure

```
infra/k8s/
├── namespaces/              # Namespace definitions
│   ├── vinylvault-staging.yaml
│   └── vinylvault-production.yaml
├── mongodb/                 # MongoDB StatefulSets
│   ├── mongodb-bff-staging.yaml
│   ├── mongodb-bff-production.yaml
│   ├── mongodb-backend-staging.yaml
│   ├── mongodb-backend-production.yaml
│   └── MONGODB_OPS.md       # MongoDB operations guide
└── scripts/                 # Deployment automation
    ├── generate-mongodb-secrets.sh
    ├── deploy-mongodb-staging.sh
    ├── deploy-mongodb-production.sh
    └── verify-mongodb.sh
```

## Quick Start

### Prerequisites

1. **NFS Provisioner**: Must be running (Phase 0 complete)
   ```bash
   kubectl get pods -n nfs-provisioner
   kubectl get storageclass nfs-client
   ```

2. **kubectl**: Configured to access your K3s cluster
   ```bash
   kubectl get nodes
   ```

### Deploy to Staging

```bash
cd infra/k8s/scripts
./deploy-mongodb-staging.sh
```

This will:
- Create `vinylvault-staging` namespace
- Generate secure MongoDB passwords
- Deploy BFF and Backend MongoDB instances
- Output connection strings for your `.env` file

### Deploy to Production

```bash
cd infra/k8s/scripts
./deploy-mongodb-production.sh
```

Includes a safety confirmation prompt.

### Verify Deployment

```bash
./verify-mongodb.sh vinylvault-staging
# or
./verify-mongodb.sh vinylvault-production
```

## What's Deployed

### BFF MongoDB
- **Purpose**: Sessions and user cache
- **Replicas**: 1 (single instance)
- **Storage**: 
  - Staging: 10 GB
  - Production: 20 GB
- **Resources**:
  - Staging: 250m-1000m CPU, 512Mi-1Gi RAM
  - Production: 500m-2000m CPU, 1Gi-2Gi RAM

### Backend MongoDB
- **Purpose**: Registry database + all tenant databases
- **Replicas**: 1 (single instance)
- **Storage**:
  - Staging: 50 GB
  - Production: 100 GB
- **Resources**:
  - Staging: 500m-2000m CPU, 1Gi-2Gi RAM
  - Production: 1000m-4000m CPU, 2Gi-4Gi RAM

## Connection Strings

After deployment, you'll see connection strings like:

```bash
# BFF MongoDB (from within cluster)
mongodb://root:<password>@mongodb-bff-0.mongodb-bff.vinylvault-staging.svc.cluster.local:27017/vinylvault_bff?authSource=admin

# Backend MongoDB Registry
mongodb://root:<password>@mongodb-backend-0.mongodb-backend.vinylvault-staging.svc.cluster.local:27017/vinylvault_registry?authSource=admin

# Backend MongoDB Base URI (for tenant databases)
mongodb://root:<password>@mongodb-backend-0.mongodb-backend.vinylvault-staging.svc.cluster.local:27017?authSource=admin
```

**Important**: Save these connection strings! Passwords are stored in K8s secrets.

## Common Operations

### View MongoDB Pods

```bash
kubectl get pods -n vinylvault-staging -l component=database
```

### Check Logs

```bash
kubectl logs -f mongodb-bff-0 -n vinylvault-staging
kubectl logs -f mongodb-backend-0 -n vinylvault-staging
```

### MongoDB Shell

```bash
# mongo shell with auth (credentials from container env)
kubectl exec -it mongodb-bff-0 -n vinylvault-staging -- \
  mongo -u "$MONGO_INITDB_ROOT_USERNAME" -p "$MONGO_INITDB_ROOT_PASSWORD" --authenticationDatabase admin
kubectl exec -it mongodb-backend-0 -n vinylvault-staging -- \
  mongo -u "$MONGO_INITDB_ROOT_USERNAME" -p "$MONGO_INITDB_ROOT_PASSWORD" --authenticationDatabase admin
```

### Port Forward (for local development)

```bash
# BFF MongoDB
kubectl port-forward -n vinylvault-staging mongodb-bff-0 27017:27017

# Backend MongoDB (use different port)
kubectl port-forward -n vinylvault-staging mongodb-backend-0 27018:27017
```

### Storage Status

```bash
kubectl get pvc -n vinylvault-staging
```

## Troubleshooting

### Pod Won't Start

```bash
# Check events
kubectl describe pod mongodb-bff-0 -n vinylvault-staging

# Check logs
kubectl logs mongodb-bff-0 -n vinylvault-staging --previous
```

### PVC Not Binding

```bash
# Check PVC status
kubectl describe pvc mongodb-data-mongodb-bff-0 -n vinylvault-staging

# Check NFS provisioner
kubectl logs -n nfs-provisioner deployment/nfs-subdir-external-provisioner
```

### Connection Issues

```bash
# Test DNS resolution
kubectl run -it --rm debug --image=busybox --restart=Never -n vinylvault-staging -- \
  nslookup mongodb-bff-0.mongodb-bff.vinylvault-staging.svc.cluster.local

# Test MongoDB connection
kubectl run -it --rm debug --image=mongo:4.4.6 --restart=Never -n vinylvault-staging -- \
  mongo "mongodb://mongodb-bff-0.mongodb-bff.vinylvault-staging.svc.cluster.local:27017"
```

## Next Steps

1. ✅ Deploy MongoDB (you're here!)
2. Update application `.env` files with MongoDB connection strings
3. Build and push Docker images to ghcr.io
4. Create application Deployment manifests
5. Create Ingress manifests for Traefik
6. Set up GitHub Actions CI/CD

## More Information

- **MongoDB Operations**: See `mongodb/MONGODB_OPS.md` for detailed operations guide
- **Deployment Plan**: See `.github/prompts/plan-productionDeployment.prompt.md`
- **Phase 0 (NFS Setup)**: See deployment plan for NFS configuration steps
