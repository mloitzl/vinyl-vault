# MongoDB Operations Guide

## Overview

VinylVault uses two separate MongoDB instances:
- **BFF MongoDB**: Stores sessions and temporary data
- **Backend MongoDB**: Stores registry database and all tenant databases

## Architecture

```
┌─────────────────────────────────────────────────┐
│ vinylvault-staging / vinylvault-production      │
├─────────────────────────────────────────────────┤
│                                                 │
│  ┌──────────────┐         ┌──────────────┐    │
│  │ mongodb-bff  │         │ mongodb-     │    │
│  │              │         │ backend      │    │
│  │ • Sessions   │         │ • Registry   │    │
│  │ • User cache │         │ • Tenants    │    │
│  │              │         │              │    │
│  │ 10/20 GB     │         │ 50/100 GB    │    │
│  └──────────────┘         └──────────────┘    │
│         ↓                         ↓            │
│    NFS Volume                NFS Volume        │
└─────────────────────────────────────────────────┘
```

## Deployment

### Initial Setup

1. **Deploy to Staging:**
   ```bash
   cd infra/k8s/scripts
   ./deploy-mongodb-staging.sh
   ```

2. **Save Connection Strings:**
   The script will output connection strings. Save these to your `.env` file.

3. **Verify Deployment:**
   ```bash
   ./verify-mongodb.sh vinylvault-staging
   ```

4. **Deploy to Production:**
   ```bash
   ./deploy-mongodb-production.sh
   ```

### Manual Deployment Steps

If you prefer manual control:

```bash
# 1. Create namespace
kubectl apply -f infra/k8s/namespaces/vinylvault-staging.yaml

# 2. Generate secrets
./infra/k8s/scripts/generate-mongodb-secrets.sh vinylvault-staging

# 3. Deploy MongoDB
kubectl apply -f infra/k8s/mongodb/mongodb-bff-staging.yaml
kubectl apply -f infra/k8s/mongodb/mongodb-backend-staging.yaml

# 4. Wait for ready
kubectl wait --for=condition=ready pod/mongodb-bff-0 -n vinylvault-staging --timeout=180s
kubectl wait --for=condition=ready pod/mongodb-backend-0 -n vinylvault-staging --timeout=180s
```

## Connection Strings

### From within Kubernetes cluster:

```bash
# BFF MongoDB
mongodb://root:<password>@mongodb-bff-0.mongodb-bff.vinylvault-staging.svc.cluster.local:27017/vinylvault_bff?authSource=admin

# Backend MongoDB (Registry)
mongodb://root:<password>@mongodb-backend-0.mongodb-backend.vinylvault-staging.svc.cluster.local:27017/vinylvault_registry?authSource=admin

# Backend MongoDB (Tenant Base URI)
mongodb://root:<password>@mongodb-backend-0.mongodb-backend.vinylvault-staging.svc.cluster.local:27017?authSource=admin
```

### From outside cluster (development):

Use `kubectl port-forward`:

```bash
# Forward BFF MongoDB
kubectl port-forward -n vinylvault-staging mongodb-bff-0 27017:27017

# Forward Backend MongoDB (use different port)
kubectl port-forward -n vinylvault-staging mongodb-backend-0 27018:27017
```

Then connect to `localhost:27017` or `localhost:27018`.

## Common Operations

### View Logs

```bash
# BFF MongoDB logs
kubectl logs -n vinylvault-staging mongodb-bff-0 -f

# Backend MongoDB logs
kubectl logs -n vinylvault-staging mongodb-backend-0 -f
```

### Execute MongoDB Shell

```bash
# BFF MongoDB (mongo shell with auth)
kubectl exec -it -n vinylvault-staging mongodb-bff-0 -- \
   mongo -u "$MONGO_INITDB_ROOT_USERNAME" -p "$MONGO_INITDB_ROOT_PASSWORD" --authenticationDatabase admin

# Backend MongoDB (mongo shell with auth)
kubectl exec -it -n vinylvault-staging mongodb-backend-0 -- \
   mongo -u "$MONGO_INITDB_ROOT_USERNAME" -p "$MONGO_INITDB_ROOT_PASSWORD" --authenticationDatabase admin
```

### Check Status

```bash
# Pod status
kubectl get pods -n vinylvault-staging -l component=database

# Resource usage
kubectl top pod -n vinylvault-staging -l component=database

# Storage usage
kubectl get pvc -n vinylvault-staging
```

### Automated Backup (mongodb-backend only)

```bash
# Cloudforge production uses CronJobs in namespace vinylvault
kubectl get cronjob -n vinylvault mongodb-backup mongodb-backup-verify

# Trigger ad-hoc backup run
kubectl create job --from=cronjob/mongodb-backup mongodb-backup-manual-1 -n vinylvault
kubectl logs -n vinylvault job/mongodb-backup-manual-1 -f
```

Backup object layout:

```text
s3://vinylvault-mongodb-backups/<db-name>/<timestamp>.archive.gz
```

Retention is controlled by bucket lifecycle policies (not in-job pruning).

### Automated Weekly Restore Verification (non-destructive)

```bash
# Trigger ad-hoc verify run
kubectl create job --from=cronjob/mongodb-backup-verify mongodb-backup-verify-manual-1 -n vinylvault
kubectl logs -n vinylvault job/mongodb-backup-verify-manual-1 -f
```

`mongodb-backup-verify` restores backups into a temporary MongoDB instance inside the Job pod (not
the production instance), validates document counts, then drops temporary data.

### Manual Tenant Restore Runbook

```bash
# Safe default: restore to a scratch database (no overwrite)
infra/k8s/scripts/restore-mongodb-tenant.sh \
  vv_<tenant_db_hash> \
  vv_<tenant_db_hash>/20260821-030000.archive.gz \
  --namespace vinylvault \
  --pod mongodb-0

# Live overwrite restore (explicit + confirmation required)
infra/k8s/scripts/restore-mongodb-tenant.sh \
  vv_<tenant_db_hash> \
  vv_<tenant_db_hash>/20260821-030000.archive.gz \
  --namespace vinylvault \
  --pod mongodb-0 \
  --target-db vv_<tenant_db_hash> \
  --live-restore
```

List tenant DB names from registry:

```bash
MONGODB_HOST=mongodb:27017 \
MONGODB_ROOT_USERNAME=root \
MONGODB_ROOT_PASSWORD='<root-password>' \
REGISTRY_DB_NAME=vinylvault_registry \
infra/k8s/scripts/list-tenant-dbs.sh
```

## Scaling Considerations

### Current Setup (Single Replica)
- Simple, sufficient for most use cases
- Sessions are ephemeral (BFF)
- Tenant data has backup strategy

### Future: MongoDB Replica Set
To enable high availability, convert to replica sets:

1. Update StatefulSet to `replicas: 3`
2. Add replica set initialization scripts
3. Update connection strings to include all replicas
4. Enable authentication between replicas

## Storage

- **BFF Staging**: 10 GB NFS volume
- **BFF Production**: 20 GB NFS volume
- **Backend Staging**: 50 GB NFS volume
- **Backend Production**: 100 GB NFS volume

Storage is provided by the NFS provisioner on your Synology NAS at `/volume1/k8s-storage`.

### Expanding Storage

If you need more space:

```bash
# Edit the PVC (requires storage class to support expansion)
kubectl edit pvc mongodb-data-mongodb-backend-0 -n vinylvault-staging

# Change the storage size, save and exit
# Kubernetes will automatically expand the volume
```

## Security

### Secrets Management

MongoDB passwords are stored in Kubernetes secrets:
- `mongodb-secrets`: root credentials for the cloudforge overlay MongoDB StatefulSet
- `mongodb-bff-secret`: BFF root password (legacy split deployment)
- `mongodb-backend-secret`: Backend root password (legacy split deployment)
- `mongodb-backup-s3`: S3 endpoint/bucket/access credentials for backup upload

To view secrets:
```bash
kubectl get secret mongodb-secrets -n vinylvault -o jsonpath='{.data.MONGODB_ROOT_PASSWORD}' | base64 -d
```

To rotate passwords:
1. Generate new password
2. Update secret: `kubectl edit secret mongodb-bff-secret -n vinylvault-staging`
3. Restart MongoDB pod: `kubectl delete pod mongodb-bff-0 -n vinylvault-staging`
4. Update application deployment secrets

## Troubleshooting

### Pod won't start

```bash
# Check pod events
kubectl describe pod mongodb-bff-0 -n vinylvault-staging

# Check logs
kubectl logs mongodb-bff-0 -n vinylvault-staging

# Common issues:
# - PVC not bound: Check StorageClass and provisioner
# - Secret missing: Run generate-mongodb-secrets.sh
# - Resource limits: Check node resources
```

### Connection issues

```bash
# Test from within cluster
kubectl run -it --rm debug --image=mongo:4.4.6 --restart=Never -n vinylvault-staging -- \
   mongo "mongodb://mongodb-bff-0.mongodb-bff.vinylvault-staging.svc.cluster.local:27017"

# Check DNS resolution
kubectl run -it --rm debug --image=busybox --restart=Never -n vinylvault-staging -- \
  nslookup mongodb-bff-0.mongodb-bff.vinylvault-staging.svc.cluster.local
```bash
# 1. Stop application pods
kubectl scale deployment <app> -n vinylvault-staging --replicas=0

# 2. Repair MongoDB (mongo shell with auth)
kubectl exec -it mongodb-backend-0 -n vinylvault-staging -- \
   sh -c 'mongo -u "$MONGO_INITDB_ROOT_USERNAME" -p "$MONGO_INITDB_ROOT_PASSWORD" --authenticationDatabase admin --eval "db.repairDatabase()"'

# 3. Restart MongoDB
kubectl delete pod mongodb-backend-0 -n vinylvault-staging

# 4. Restore application
```
kubectl delete pod mongodb-backend-0 -n vinylvault-staging

# 4. Restore application
kubectl scale deployment <app> -n vinylvault-staging --replicas=2
```

## Monitoring

Key metrics to monitor:
- Pod CPU/Memory usage
- Storage usage (PVC capacity)
- Connection count
- Query performance
- Replication lag (if using replica sets)

Consider setting up Prometheus + Grafana with mongodb-exporter for production monitoring.
