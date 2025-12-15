# Plan: Production Deployment to K3s with GitHub Actions

This plan covers security hardening, containerization, Kubernetes deployment with MongoDB StatefulSets, and CI/CD automation for deploying Vinyl Vault to your 4-node Raspberry Pi K3s cluster with staging (vinylvault.antisozializer.org) and production (vinylvault.loitzl.com) environments.

## Configuration Summary

- **K3s Cluster**: 4-node Raspberry Pi 5 cluster
- **ClusterIssuer**: `letsencrypt-prod` (cert-manager, HTTP-01 challenge)
- **Current StorageClass**: `local-path` (Rancher local-path provisioner - local disk only)
- **Target Storage**: NFS on Synology DSM 6.2.4 at 192.168.1.5 (requires setup)
- **MongoDB**: 2 separate StatefulSets (BFF + Backend), each with 3 replicas
- **Namespaces**: `vinylvault-staging`, `vinylvault-production` (same cluster)
- **Registry**: ghcr.io (GitHub Container Registry)
- **Ingress**: Traefik
- **Secrets**: Plain Kubernetes secrets
- **CI/CD**: GitHub Actions with on-premise self-hosted runner

⚠️ **Action Required**: NFS provisioner and storage class must be configured before Phase 3 (MongoDB deployment).

---

## Phase 0: NFS Storage Setup (PREREQUISITE)

This phase must be completed before Phase 3 (MongoDB StatefulSet configuration). It sets up NFS on your Synology and deploys an NFS provisioner to K3s for dynamic persistent volume provisioning.

### 0.1: Synology NFS Server Configuration

#### Tasks

1. [ ] **Enable NFS service on Synology DSM 6.2.4**

   - Login to DSM web interface at `http://192.168.1.5:5000`
   - Go to **Control Panel** → **File Services** → **NFS**
   - Check **Enable NFS service**
   - Select **NFSv3** and **NFSv4** (enable both for compatibility)
   - **Max NFS protocol**: NFSv4.1
   - Click **Apply**

2. [ ] **Create shared folder for Kubernetes storage**

   - Go to **Control Panel** → **Shared Folder**
   - Click **Create** → **Create Shared Folder**
   - **Name**: `k8s-storage` (or your preferred name)
   - **Description**: "Kubernetes persistent volume storage"
   - **Location**: Select volume (e.g., `/volume1/k8s-storage`)
   - **Enable Recycle Bin**: Optional (recommended for production)
   - Click **OK**

3. [ ] **Configure NFS permissions for the shared folder**

   - In **Shared Folder** list, select `k8s-storage`
   - Click **Edit** → **NFS Permissions** tab
   - Click **Create**
   - **Server or IP address**: `192.168.1.0/24` (adjust to your K3s subnet)
   - **Privilege**: Read/Write
   - **Squash**: Map all users to admin (or specific UID if needed)
   - **Security**: sys (authentication via IP)
   - **Enable asynchronous**: Unchecked (safer for databases)
   - **Allow connections from non-privileged ports**: Checked
   - **Allow users to access mounted subfolders**: Checked
   - Click **Save**

4. [ ] **Verify NFS export**

   - SSH into Synology (enable SSH in Control Panel → Terminal & SNMP)

   ```bash
   ssh admin@192.168.1.5
   cat /etc/exports
   # Should show: /volume1/k8s-storage 192.168.1.0/24(rw,async,no_wdelay,...)
   ```

5. [ ] **Test NFS mount from K3s node**

   ```bash
   # From any K3s node
   ssh pi@<k3s-node-ip>

   # Install NFS client (if not present)
   sudo apt-get update
   sudo apt-get install -y nfs-common

   # Test mount
   sudo mkdir -p /mnt/nfs-test
   sudo mount -t nfs 192.168.1.5:/volume1/k8s-storage /mnt/nfs-test

   # Test write
   sudo touch /mnt/nfs-test/test-file
   ls -la /mnt/nfs-test/

   # Cleanup
   sudo umount /mnt/nfs-test
   sudo rmdir /mnt/nfs-test
   ```

#### Confirmed Configuration

- **NFS Path**: `/volume1/k8s-storage` ✅
- **Subnet**: `192.168.1.0/24` ✅ (already enabled)
- **Storage Allocation**: 1 TB per namespace (staging + production = 2 TB total, well within 18 TB capacity)
- **Provisioner**: `nfs-subdir-external-provisioner` ✅
- **Separate Paths**: Yes - automatic subdirectory per namespace/PVC
- **UID/GID**: MongoDB containers run as UID 999. Using `fsGroup: 999` in StatefulSet security context
- **Performance**: NFS over 1GbE is sufficient for RPi workloads

---

### 0.2: Deploy NFS Subdir External Provisioner to K3s

We'll use the `nfs-subdir-external-provisioner` (formerly nfs-client-provisioner) which automatically creates subdirectories for each PVC.

#### Tasks

1. [ ] **Install Helm on K3s control plane node** (if not already installed)

   ```bash
   ssh pi@<control-plane-node>

   # Install Helm 3
   curl https://raw.githubusercontent.com/helm/helm/main/scripts/get-helm-3 | bash

   # Verify installation
   helm version
   ```

2. [ ] **Add NFS provisioner Helm repository**

   ```bash
   helm repo add nfs-subdir-external-provisioner \
     https://kubernetes-sigs.github.io/nfs-subdir-external-provisioner/

   helm repo update
   ```

3. [ ] **Create namespace for NFS provisioner**

   ```bash
   kubectl create namespace nfs-provisioner
   ```

4. [ ] **Deploy NFS provisioner with Helm**

   ```bash
   helm install nfs-subdir-external-provisioner \
     nfs-subdir-external-provisioner/nfs-subdir-external-provisioner \
     --namespace nfs-provisioner \
     --set nfs.server=192.168.1.5 \
     --set nfs.path=/volume1/k8s-storage \
     --set storageClass.name=nfs-client \
     --set storageClass.defaultClass=false \
     --set storageClass.reclaimPolicy=Retain \
     --set storageClass.archiveOnDelete=true \
     --set storageClass.pathPattern='${.PVC.namespace}/${.PVC.name}'
   ```

   **Parameter Explanation**:

   - `nfs.server`: `192.168.1.5` (Synology IP) ✅
   - `nfs.path`: `/volume1/k8s-storage` (NFS export path) ✅
   - `storageClass.name`: `nfs-client` (StorageClass name)
   - `storageClass.defaultClass`: `false` (keep `local-path` as default)
   - `storageClass.reclaimPolicy`: `Retain` (data preserved after PVC deletion)
   - `storageClass.archiveOnDelete`: `true` (move to `archived-` prefix)
   - `storageClass.pathPattern`: Separate subdirectory per namespace ✅

5. [ ] **Verify NFS provisioner deployment**

   ```bash
   # Check pods
   kubectl get pods -n nfs-provisioner
   # Should show: nfs-subdir-external-provisioner-xxxxx RUNNING

   # Check StorageClass
   kubectl get storageclass
   # Should show:
   # local-path (default)
   # nfs-client

   # View StorageClass details
   kubectl describe storageclass nfs-client
   ```

6. [ ] **Test NFS provisioner with a test PVC**

   ```bash
   # Create test PVC
   cat <<EOF | kubectl apply -f -
   apiVersion: v1
   kind: PersistentVolumeClaim
   metadata:
     name: test-nfs-pvc
     namespace: default
   spec:
     storageClassName: nfs-client
     accessModes:
       - ReadWriteMany
     resources:
       requests:
         storage: 1Gi
   EOF

   # Check PVC status (should be Bound)
   kubectl get pvc test-nfs-pvc

   # Check PV created
   kubectl get pv

   # Check directory created on Synology
   # Should see: /volume1/k8s-storage/default-test-nfs-pvc-pvc-xxxxx/

   # Create test pod to write data
   cat <<EOF | kubectl apply -f -
   apiVersion: v1
   kind: Pod
   metadata:
     name: test-nfs-pod
     namespace: default
   spec:
     containers:
     - name: test
       image: busybox
       command: ['sh', '-c', 'echo "Hello NFS" > /data/test.txt && cat /data/test.txt && sleep 3600']
       volumeMounts:
       - name: nfs-volume
         mountPath: /data
     volumes:
     - name: nfs-volume
       persistentVolumeClaim:
         claimName: test-nfs-pvc
   EOF

   # Check pod logs
   kubectl logs test-nfs-pod
   # Should output: Hello NFS

   # Verify file on Synology
   # Login to Synology and check: /volume1/k8s-storage/default-test-nfs-pvc-pvc-xxxxx/test.txt

   # Cleanup test resources
   kubectl delete pod test-nfs-pod
   kubectl delete pvc test-nfs-pvc
   # PV should transition to Released (not deleted due to Retain policy)
   ```

---

### 0.3: Configure NFS StorageClass for MongoDB

#### Tasks

1. [ ] **Create MongoDB-specific StorageClass** (optional, for better organization)

   ```bash
   cat <<EOF | kubectl apply -f -
   apiVersion: storage.k8s.io/v1
   kind: StorageClass
   metadata:
     name: nfs-mongodb
   provisioner: nfs-subdir-external-provisioner
   parameters:
     archiveOnDelete: "true"
     pathPattern: "mongodb-\${.PVC.namespace}-\${.PVC.name}"
   reclaimPolicy: Retain
   volumeBindingMode: Immediate
   allowVolumeExpansion: true
   EOF
   ```

2. [ ] **Update Phase 3 MongoDB manifests** to use `storageClassName: nfs-mongodb` (or `nfs-client`)

3. [ ] **Document storage structure on Synology**

   ```
   /volume1/k8s-storage/
   ├── vinylvault-staging/                              (Namespace isolation ✅)
   │   ├── data-mongodb-bff-0-pvc-xxx/                  (10Gi, BFF sessions)
   │   ├── data-mongodb-bff-1-pvc-xxx/                  (10Gi)
   │   ├── data-mongodb-bff-2-pvc-xxx/                  (10Gi)
   │   ├── data-mongodb-backend-0-pvc-xxx/              (20Gi, tenant data)
   │   ├── data-mongodb-backend-1-pvc-xxx/              (20Gi)
   │   ├── data-mongodb-backend-2-pvc-xxx/              (20Gi)
   │   └── [Total: ~90Gi, within 1TB limit ✅]
   └── vinylvault-production/                           (Namespace isolation ✅)
       ├── data-mongodb-bff-0-pvc-xxx/                  (10Gi)
       ├── data-mongodb-bff-1-pvc-xxx/                  (10Gi)
       ├── data-mongodb-bff-2-pvc-xxx/                  (10Gi)
       ├── data-mongodb-backend-0-pvc-xxx/              (20Gi)
       ├── data-mongodb-backend-1-pvc-xxx/              (20Gi)
       ├── data-mongodb-backend-2-pvc-xxx/              (20Gi)
       └── [Total: ~90Gi, within 1TB limit ✅]

   Total Storage: ~180Gi allocated, ~2TB reserved (10% of 18TB Synology capacity)
   ```

---

### 0.4: Troubleshooting NFS Setup

#### Common Issues

**Issue**: NFS provisioner pod fails with "mount.nfs: access denied"

- **Solution**: Check NFS permissions in Synology, ensure IP range includes all K3s nodes
- **Solution**: Verify `no_root_squash` or appropriate squash option in Synology NFS settings

**Issue**: PVC stuck in Pending state

- **Solution**: Check provisioner logs: `kubectl logs -n nfs-provisioner deployment/nfs-subdir-external-provisioner`
- **Solution**: Verify NFS server is reachable from K3s nodes: `ping 192.168.1.5`
- **Solution**: Test manual NFS mount from K3s node (see 0.1 step 5)

**Issue**: MongoDB pod fails with "chown: changing ownership of '/data/db': Operation not permitted"

- **Solution**: MongoDB runs as UID 999. Configure NFS export with appropriate squash option
- **Solution**: Add `securityContext` to StatefulSet:
  ```yaml
  securityContext:
    fsGroup: 999
    runAsUser: 999
  ```

**Issue**: Performance issues with MongoDB on NFS

- **Solution**: Ensure async mode is disabled in Synology NFS export for data consistency
- **Solution**: Consider using SSD cache on Synology for better performance
- **Solution**: Monitor network utilization between K3s and Synology

#### Verification Checklist

- [ ] NFS service enabled on Synology
- [ ] Shared folder `k8s-storage` created with NFS permissions
- [ ] NFS mount tested successfully from K3s node
- [ ] nfs-common package installed on all K3s nodes
- [ ] NFS provisioner pod running in `nfs-provisioner` namespace
- [ ] StorageClass `nfs-client` (or `nfs-mongodb`) available
- [ ] Test PVC successfully bound and data written
- [ ] MongoDB StatefulSets updated to use NFS StorageClass

---

## Phase 1: Security Review & Hardening

### Steps

1. **Add Backend health endpoint** at `GET /health` in `packages/backend/src/index.ts`
2. **Disable GraphQL introspection** in production for both `packages/backend/src/graphql/index.ts` and `packages/bff/src/graphql/index.ts`
3. **Add Helmet.js security headers** to BFF Express app in `packages/bff/src/index.ts`
4. **Update `.env.sample`** with missing variables (`GITHUB_APP_ID`, `GITHUB_APP_PRIVATE_KEY_PATH`, `GITHUB_APP_WEBHOOK_SECRET`, `GITHUB_APP_INSTALLATION_URL`)
5. **Add graceful shutdown handlers** to both backend and BFF for SIGTERM/SIGINT signals
6. **Audit all endpoints** - verify webhook signature validation, session checks on sensitive operations

### Further Considerations

- Add rate limiting middleware (express-rate-limit)?
- Add structured logging with Winston or Pino?
- Add APM integration (optional for MVP)?

---

## Phase 2: Dockerfile Production Optimization

### Steps

1. **Create `.dockerignore`** files at root and in each package to exclude `node_modules`, `.git`, `dist`, test files
2. **Add non-root user** to backend and BFF Dockerfiles with `USER node`
3. **Pin pnpm version** in Dockerfiles instead of using `@latest`
4. **Add HEALTHCHECK** directives to backend and BFF Dockerfiles
5. **Optimize layer caching** by copying only `package.json` and lock files first, then source code
6. **Update frontend nginx config** to handle SPA routing correctly (fallback to index.html)

### Further Considerations

- Use multi-platform builds for ARM64 (RPi) and AMD64 (optional)?
- Consider distroless images for smaller attack surface?

---

## Phase 3: MongoDB StatefulSet Configuration ✅ COMPLETED

⚠️ **Prerequisite**: Phase 0 must be completed (NFS provisioner installed, `nfs-client` or `nfs-mongodb` StorageClass available).

### Implementation Summary

**Status**: ✅ Completed on 2025-12-13

**What was created**:

- Namespace manifests for staging and production
- MongoDB StatefulSets for BFF and Backend (staging + production)
- Headless Services for StatefulSet DNS
- Automated deployment scripts with secret generation
- Verification and operations guide

**Key Files**:

- `infra/k8s/namespaces/` - Namespace definitions
- `infra/k8s/mongodb/` - MongoDB StatefulSets (4 files: BFF/Backend x Staging/Production)
- `infra/k8s/scripts/` - Deployment automation scripts
- `infra/k8s/mongodb/MONGODB_OPS.md` - Complete operations guide

**Architecture Decisions**:

- **Single replica** instead of 3 replicas (simplified for MVP, can scale to replica sets later)
- **Separate instances** for BFF (sessions) and Backend (registry + tenants)
- **NFS storage** via `nfs-client` StorageClass
- **Resource allocation**:
  - BFF Staging: 250m-1000m CPU, 512Mi-1Gi RAM, 10Gi storage
  - BFF Production: 500m-2000m CPU, 1Gi-2Gi RAM, 20Gi storage
  - Backend Staging: 500m-2000m CPU, 1Gi-2Gi RAM, 50Gi storage
  - Backend Production: 1000m-4000m CPU, 2Gi-4Gi RAM, 100Gi storage

### Deployment Instructions

#### Quick Start (Staging)

```bash
cd infra/k8s/scripts
./deploy-mongodb-staging.sh
```

This script will:

1. Create the `vinylvault-staging` namespace
2. Generate secure MongoDB secrets
3. Deploy both MongoDB StatefulSets
4. Wait for pods to be ready
5. Display connection strings for your `.env` file

#### Quick Start (Production)

```bash
cd infra/k8s/scripts
./deploy-mongodb-production.sh
```

Includes a safety prompt before deploying to production.

#### Verification

```bash
cd infra/k8s/scripts
./verify-mongodb.sh vinylvault-staging
```

This checks:

- Pod status
- PVC binding
- Service availability
- MongoDB connectivity
- Resource usage

### Connection Strings

After deployment, update your `.env` files with the connection strings:

**Staging** (from within cluster):

```bash
# BFF
MONGODB_URI=mongodb://root:<password>@mongodb-bff-0.mongodb-bff.vinylvault-staging.svc.cluster.local:27017/vinylvault_bff?authSource=admin

# Backend Registry
MONGODB_REGISTRY_URI=mongodb://root:<password>@mongodb-backend-0.mongodb-backend.vinylvault-staging.svc.cluster.local:27017/vinylvault_registry?authSource=admin

# Backend Tenant Base
MONGODB_URI_BASE=mongodb://root:<password>@mongodb-backend-0.mongodb-backend.vinylvault-staging.svc.cluster.local:27017?authSource=admin
```

**Production**: Same pattern, use `vinylvault-production` namespace.

### Next Steps

1. ✅ Deploy MongoDB to staging: `./deploy-mongodb-staging.sh`
2. Update `.env` with connection strings from deployment output
3. Test connectivity: `./verify-mongodb.sh vinylvault-staging`
4. Proceed to **Phase 4: Application Deployment Manifests**

### Tasks (Original Plan - Now Automated)

1. [x] **Create directory structure**

   ```bash
   mkdir -p infra/k8s/base/mongodb
   ```

2. [x] **Create BFF MongoDB StatefulSet** (`infra/k8s/mongodb/mongodb-bff-staging.yaml` & `mongodb-bff-production.yaml`)

   - Name: `mongodb-bff`
   - Replicas: 3
   - Image: `mongo:7-jammy` (ARM64 compatible)
   - **StorageClass**: `nfs-mongodb` (or `nfs-client` if not using dedicated class)
   - PVC size: 10Gi per replica
   - Resource limits: 512Mi memory, 500m CPU requests, 1000m CPU limits
   - Environment variables from secret: `MONGO_INITDB_ROOT_USERNAME`, `MONGO_INITDB_ROOT_PASSWORD`
   - Security context: `fsGroup: 999`, `runAsUser: 999` (MongoDB default UID)
   - Pod anti-affinity: prefer different nodes for replica distribution
   - Command: `mongod --replSet rs-bff --bind_ip_all`

3. [ ] **Create Backend MongoDB StatefulSet** (`infra/k8s/base/mongodb/mongodb-backend-statefulset.yaml`)

   - Name: `mongodb-backend`
   - Same config as BFF MongoDB
   - PVC size: 20Gi per replica (tenant data requires more space)
   - Command: `mongod --replSet rs-backend --bind_ip_all`
   - Separate secret: `mongodb-backend-secret`

4. [ ] **Create Headless Services**

   - BFF: `mongodb-bff-headless` (`infra/k8s/base/mongodb/mongodb-bff-service.yaml`)
     - `clusterIP: None`
     - Selector: `app: mongodb-bff`
     - Port: 27017
   - Backend: `mongodb-backend-headless` (`infra/k8s/base/mongodb/mongodb-backend-service.yaml`)
     - `clusterIP: None`
     - Selector: `app: mongodb-backend`
     - Port: 27017

5. [ ] **Create MongoDB replica set initialization script** (`infra/k8s/base/mongodb/init-replica-set.sh`)

   ```bash
   #!/bin/bash
   # Wait for MongoDB to start
   sleep 10

   # Initialize replica set (idempotent)
   mongosh --eval '
   try {
     rs.status();
     print("Replica set already initialized");
   } catch(e) {
     rs.initiate({
       _id: "rs-bff",
       members: [
         { _id: 0, host: "mongodb-bff-0.mongodb-bff-headless:27017" },
         { _id: 1, host: "mongodb-bff-1.mongodb-bff-headless:27017" },
         { _id: 2, host: "mongodb-bff-2.mongodb-bff-headless:27017" }
       ]
     });
     print("Replica set initialized");
   }
   '
   ```

6. [ ] **Create ConfigMap for init script** (`infra/k8s/base/mongodb/mongodb-init-configmap.yaml`)

   - Contains init scripts for both BFF and Backend replica sets
   - Mount as volume in StatefulSet init container

7. [ ] **Create Secret templates**

   - `infra/k8s/base/mongodb/mongodb-bff-secret.yaml` (template with placeholders)
   - `infra/k8s/base/mongodb/mongodb-backend-secret.yaml` (template with placeholders)
   - Document generation: `echo -n 'password' | base64`

8. [ ] **Add init container to StatefulSets** for replica set initialization
   - Only runs on pod-0 (primary)
   - Uses ConfigMap script to initialize replica set
   - Checks if replica set exists before initializing (idempotent)

### Storage Architecture with NFS

**Synology Configuration:**

- **Total Capacity**: 18 TB
- **Reserved for Vinyl Vault**: 2 TB (1 TB per namespace)
- **Expected Usage**: ~180 Gi initially (10% of reserved capacity)

**Storage Layout:**

```
/volume1/k8s-storage/                                    (Synology NFS Share)
├── vinylvault-staging/                                  (Isolated namespace path)
│   ├── data-mongodb-bff-0-pvc-<uuid>/                   (10Gi - BFF sessions)
│   ├── data-mongodb-bff-1-pvc-<uuid>/                   (10Gi - BFF replica 1)
│   ├── data-mongodb-bff-2-pvc-<uuid>/                   (10Gi - BFF replica 2)
│   ├── data-mongodb-backend-0-pvc-<uuid>/               (20Gi - Tenant data primary)
│   ├── data-mongodb-backend-1-pvc-<uuid>/               (20Gi - Tenant data replica 1)
│   ├── data-mongodb-backend-2-pvc-<uuid>/               (20Gi - Tenant data replica 2)
│   └── Subtotal: 90Gi allocated, ~1TB reserved
│
└── vinylvault-production/                               (Isolated namespace path)
    ├── data-mongodb-bff-0-pvc-<uuid>/                   (10Gi)
    ├── data-mongodb-bff-1-pvc-<uuid>/                   (10Gi)
    ├── data-mongodb-bff-2-pvc-<uuid>/                   (10Gi)
    ├── data-mongodb-backend-0-pvc-<uuid>/               (20Gi)
    ├── data-mongodb-backend-1-pvc-<uuid>/               (20Gi)
    ├── data-mongodb-backend-2-pvc-<uuid>/               (20Gi)
    └── Subtotal: 90Gi allocated, ~1TB reserved

TOTAL: ~180Gi allocated, 2TB reserved (11% of 18TB Synology capacity)
```

**Benefits of Namespace Isolation:**

- ✅ Clear separation between staging and production data
- ✅ Easy to backup/restore per environment
- ✅ Simplified quota management (1TB per namespace)
- ✅ No risk of accidental cross-environment data access

### Connection Strings

**BFF MongoDB** (sessions):

- Staging: `mongodb://mongodb-bff-0.mongodb-bff-headless:27017,mongodb-bff-1.mongodb-bff-headless:27017,mongodb-bff-2.mongodb-bff-headless:27017/sessions?replicaSet=rs-bff`
- Production: Same pattern, different namespace

**Backend MongoDB** (tenant data):

- Staging: `mongodb://mongodb-backend-0.mongodb-backend-headless:27017,mongodb-backend-1.mongodb-backend-headless:27017,mongodb-backend-2.mongodb-backend-headless:27017/?replicaSet=rs-backend`
- Production: Same pattern, different namespace

### Further Considerations

- [ ] Configure automatic backups to separate Synology folder (Phase 9)
- [ ] Set retention policy: 7 daily, 4 weekly, 3 monthly backups
- [ ] Add MongoDB Prometheus exporter for monitoring (Phase 10)
- [ ] Configure MongoDB slow query logging for performance tuning
- [ ] Set up alerts for replica set member failures

---

## Phase 4: Kubernetes Base Manifests

### Steps

1. **Create namespace definitions** in `infra/k8s/base/namespaces/` for `vinylvault-staging` and `vinylvault-production`
2. **Create backend Deployment** in `infra/k8s/base/backend/deployment.yaml` with resource limits, health probes, and env var structure
3. **Create BFF Deployment** in `infra/k8s/base/bff/deployment.yaml` with session affinity and health probes
4. **Create frontend Deployment** in `infra/k8s/base/frontend/deployment.yaml` serving static files
5. **Create ClusterIP Services** for backend, BFF, and MongoDB instances
6. **Create Ingress resources** in `infra/k8s/base/ingress/` for Traefik with cert-manager annotations
7. **Define resource requests/limits** (backend: 256Mi-512Mi, BFF: 256Mi-512Mi, frontend: 128Mi-256Mi)
8. **Create HorizontalPodAutoscaler** resources (2-4 replicas per service based on CPU)

### Further Considerations

- Should frontend be served via CDN or directly from cluster?
- Need PodDisruptionBudgets for high availability?

---

## Phase 5: Kustomize Overlays for Staging & Production

### Steps

1. **Create kustomization.yaml** in `infra/k8s/base/` referencing all base manifests
2. **Create staging overlay** in `infra/k8s/overlays/staging/` with namespace patches, ingress host `vinylvault.antisozializer.org`, and resource adjustments
3. **Create production overlay** in `infra/k8s/overlays/production/` with namespace patches, ingress host `vinylvault.loitzl.com`, and higher resource limits
4. **Create Secret generators** in overlays for environment-specific secrets (GitHub OAuth credentials, JWT secrets, MongoDB credentials)
5. **Add ConfigMaps** for environment-specific non-sensitive config (backend URLs, frontend URLs, feature flags)
6. **Configure cert-manager ClusterIssuer references** in Ingress annotations for both environments
7. **Add network policies** (optional) to restrict pod-to-pod communication

### Further Considerations

- Use different GitHub OAuth apps for staging vs production?
- Configure different MongoDB retention policies per environment?

---

## Phase 6: GitHub Actions CI/CD Pipeline

### Steps

1. **Create `.github/workflows/build.yml`** triggered on push to `main` and `develop` branches
2. **Add Docker build job** with multi-stage builds for backend, BFF, frontend using `docker/build-push-action`
3. **Push images to ghcr.io** with tags: `sha-<commit>`, `latest-staging`, `latest-production`
4. **Create `.github/workflows/deploy-staging.yml`** triggered automatically on push to `develop`
5. **Create `.github/workflows/deploy-production.yml`** with manual approval gate (`workflow_dispatch`)
6. **Add kubectl deployment steps** using `self-hosted` runner with `kustomize build | kubectl apply`
7. **Add deployment verification** steps to check pod readiness and run smoke tests
8. **Configure GitHub secrets** for kubeconfig, ghcr.io credentials, and K8s secrets values

### Further Considerations

- Add automated rollback on deployment failure?
- Should we run integration tests before deployment?
- Need Slack/email notifications for deployment status?

---

## Phase 7: Secrets Management Setup

### Steps

1. **Document all required secrets** in `infra/k8s/README.md` with generation instructions
2. **Create secret templates** in `infra/k8s/base/secrets/` as YAML with placeholder values
3. **Generate production secrets** using `openssl rand -base64 32` for JWT and session secrets
4. **Create GitHub repository secrets** for all environment variables needed by workflows
5. **Create K8s secrets** manually on cluster using `kubectl create secret generic` for initial setup
6. **Add secret rotation procedure** documentation for JWT, session, and GitHub App credentials

### Further Considerations

- Implement secret scanning in CI/CD to prevent accidental commits?
- Use external-secrets operator for future secret management?

---

## Phase 8: Deployment Testing & Validation

### Steps

1. **Deploy to staging** using `kubectl apply -k infra/k8s/overlays/staging/`
2. **Verify pod startup** with `kubectl get pods -n vinylvault-staging -w`
3. **Check MongoDB replica set status** by exec into pod and running `rs.status()`
4. **Test authentication flow** - GitHub OAuth login, session persistence across pod restarts
5. **Test tenant isolation** - create records in personal and org tenants, verify database separation
6. **Verify all endpoints require auth** - curl test unauthenticated requests to GraphQL, record mutations
7. **Load test** using Apache Bench or k6 (conservative due to RPi limits)
8. **Monitor resource usage** with `kubectl top pods` and adjust limits if needed

### Further Considerations

- Create automated smoke test suite?
- Set up continuous monitoring dashboard (Grafana)?

---

## Phase 9: Production Deployment & Validation

### Steps

1. **Review staging deployment logs** and resolve any issues
2. **Trigger production deployment workflow** via GitHub Actions manual dispatch
3. **Verify DNS resolution** for `vinylvault.loitzl.com` points to cluster ingress
4. **Monitor cert-manager** certificate issuance with `kubectl get certificate -n vinylvault-production`
5. **Run production smoke tests** - auth flow, create/read/update/delete records, tenant switching
6. **Configure monitoring alerts** for pod restarts, high memory usage, MongoDB replica set issues
7. **Document rollback procedure** in `infra/k8s/ROLLBACK.md`
8. **Create backup schedule** for MongoDB using CronJob or external backup solution

### Further Considerations

- Set up log aggregation (Loki, ELK)?
- Configure uptime monitoring (UptimeRobot, Better Uptime)?
- Need disaster recovery plan documentation?

---

## Estimated Timeline

| Phase                            | Duration      | Notes                                                 |
| -------------------------------- | ------------- | ----------------------------------------------------- |
| **Phase 0: NFS Setup**           | **0.5-1 day** | **New prerequisite - Synology + K3s NFS provisioner** |
| Phase 1: Security Hardening      | 1 day         | Code changes, testing                                 |
| Phase 2: Dockerfile Optimization | 0.5 day       | Incremental improvements                              |
| Phase 3: MongoDB StatefulSets    | 1 day         | NFS-backed replica sets                               |
| Phase 4: K8s Base Manifests      | 1.5 days      | Deployments, services, ingress                        |
| Phase 5: Kustomize Overlays      | 1 day         | Staging/production configuration                      |
| Phase 6: CI/CD Pipeline          | 1 day         | GitHub Actions workflows                              |
| Phase 7: Secrets Setup           | 0.5 day       | Manual secret generation                              |
| Phase 8: Staging Testing         | 1.5 days      | Thorough validation                                   |
| Phase 9: Production Deployment   | 1 day         | Deployment + validation                               |

**Total: 9-10 days** (assumes no major blockers)

---

## Prerequisites Checklist

### Infrastructure (Verified ✅ or Pending)

- [x] K3s cluster with 4 nodes operational
- [x] Traefik ingress controller installed
- [x] Cert-manager installed (`letsencrypt-prod` ClusterIssuer ready)
- [x] Current StorageClass: `local-path` (temporary)
- [ ] **Synology NFS server at 192.168.1.5 configured** (Phase 0)
- [ ] **NFS provisioner deployed to K3s** (Phase 0)
- [ ] **NFS StorageClass available** (`nfs-client` or `nfs-mongodb`) (Phase 0)
- [ ] All K3s nodes have `nfs-common` package installed (Phase 0)

### CI/CD & External Services

- [ ] GitHub Actions self-hosted runner installed on separate RPi
- [ ] Self-hosted runner has kubectl access to cluster
- [ ] Self-hosted runner has kustomize installed
- [ ] GitHub Container Registry (ghcr.io) access configured

### DNS & Networking

- [ ] DNS A record: `vinylvault.antisozializer.org` → cluster ingress IP
- [ ] DNS A record: `vinylvault.loitzl.com` → cluster ingress IP
- [ ] Cluster ingress IP identified (run: `kubectl get svc -A | grep traefik`)

### External Integrations

- [ ] GitHub OAuth apps created (staging + production)
- [ ] GitHub App configured with webhook URLs
- [ ] Discogs API key obtained (optional, for enhanced metadata)

### Storage Requirements

- [x] 18 TB total capacity on Synology ✅
- [x] 2 TB reserved for Vinyl Vault (1 TB per namespace) ✅
- [x] ~180Gi initial allocation for MongoDB data ✅
- [x] Network connectivity: K3s nodes ↔ Synology at 192.168.1.5 ✅

---

## Quick Start Commands

Before proceeding with implementation, gather this information:

```bash
# 1. Verify cluster ingress IP
kubectl get svc -A | grep traefik

# 2. Check current storage classes
kubectl get storageclass

# 3. Verify cert-manager ClusterIssuer (already confirmed: letsencrypt-prod)
kubectl get clusterissuer

# 4. Check K3s node IPs (for Synology NFS permissions)
kubectl get nodes -o wide

# 5. Test network connectivity to Synology
ping 192.168.1.5

# 6. Verify NFS is not yet configured
kubectl get pods -A | grep nfs
# Should return nothing (NFS provisioner not yet installed)
```

---

## Next Steps

**Phase 0 is now the critical path!** Complete NFS setup before proceeding:

1. **Follow Phase 0** step-by-step to configure Synology NFS and deploy the provisioner
2. **Verify** NFS provisioner working with test PVC
3. **Confirm** StorageClass `nfs-client` or `nfs-mongodb` available
4. **Then proceed** to Phase 1 (Security Hardening)

**Configuration Confirmed ✅:**

- Volume: `/volume1/k8s-storage` ✅
- Subnet: `192.168.1.0/24` (already enabled) ✅
- Storage per namespace: 1 TB (2 TB total) ✅
- Provisioner: `nfs-subdir-external-provisioner` ✅
- Namespace isolation: Separate paths per namespace ✅

**Ready to proceed with Phase 0 implementation!**

Start with Phase 0.1 (Synology NFS Configuration) - the subnet is already enabled, so you'll primarily need to:

1. Create the `k8s-storage` shared folder
2. Configure NFS permissions (subnet already correct)
3. Test NFS mount from a K3s node
4. Deploy the NFS provisioner with the confirmed Helm command
