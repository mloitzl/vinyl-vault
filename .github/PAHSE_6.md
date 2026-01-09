# Phase 6: GitHub Actions CI/CD Pipeline - Complete Guide

## 📖 Documentation Index

All Phase 6 documentation is organized for easy navigation:

### 🚀 Quick Start
Start here if you want to get up and running quickly:

1. **[PHASE_6_SETUP_CHECKLIST.md](PHASE_6_SETUP_CHECKLIST.md)** - Complete setup checklist
   - Step-by-step verification of all requirements
   - Copy-paste commands for secret creation
   - Testing procedures
   - **START HERE for first deployment**

2. **[CI_CD_QUICK_REFERENCE.md](CI_CD_QUICK_REFERENCE.md)** - Quick command reference
   - Common kubectl commands
   - Deployment monitoring
   - Troubleshooting quick fixes
   - One-liners for common tasks

### 📚 Complete Documentation

3. **[PHASE_6_SUMMARY.md](PHASE_6_SUMMARY.md)** - Executive summary
   - Overview of what was created
   - Architecture diagrams
   - Workflow specifications
   - Deployment flow charts

4. **[PHASE_6_COMPLETE.md](PHASE_6_COMPLETE.md)** - Detailed implementation
   - Complete Phase 6 overview (400+ lines)
   - All three workflows explained in detail
   - Design decisions and rationale
   - Comprehensive learning resource

5. **[CI_CD_SETUP.md](CI_CD_SETUP.md)** - In-depth setup guide
   - GitHub secrets configuration
   - Kubernetes RBAC setup
   - Self-hosted runner configuration
   - Extended troubleshooting
   - Security best practices

### 💻 Workflow Files

Located in `.github/workflows/`:

6. **[workflows/build.yml](workflows/build.yml)** - Docker build workflow
   - Builds backend, BFF, frontend images
   - Pushes to ghcr.io
   - Smart image tagging
   - Multi-service parallel builds

7. **[workflows/deploy-staging.yml](workflows/deploy-staging.yml)** - Staging deployment
   - Automatic on develop push
   - Pre-deployment validation
   - Health checks and smoke tests
   - Detailed reporting

8. **[workflows/deploy-production.yml](workflows/deploy-production.yml)** - Production deployment
   - Manual trigger for safety
   - Approval gate
   - Enhanced monitoring
   - Optional auto-rollback

### 🔧 Configuration Files

9. **[.dockerignore](../.dockerignore)** - Docker build optimization
   - Excludes unnecessary files
   - Speeds up builds
   - Reduces image size

---

## 🎯 Where to Go For...

### I want to... | Go to...
---|---
**Set up CI/CD for the first time** | [PHASE_6_SETUP_CHECKLIST.md](PHASE_6_SETUP_CHECKLIST.md)
**Trigger a staging deployment** | [CI_CD_QUICK_REFERENCE.md](CI_CD_QUICK_REFERENCE.md) → "Trigger Build & Staging Deployment"
**Trigger a production deployment** | [CI_CD_QUICK_REFERENCE.md](CI_CD_QUICK_REFERENCE.md) → "Trigger Production Deployment"
**Monitor a deployment** | [CI_CD_QUICK_REFERENCE.md](CI_CD_QUICK_REFERENCE.md) → "Monitoring Deployments"
**Troubleshoot a problem** | [CI_CD_SETUP.md](CI_CD_SETUP.md) → "Troubleshooting" or [CI_CD_QUICK_REFERENCE.md](CI_CD_QUICK_REFERENCE.md) → "Troubleshooting"
**Understand the architecture** | [PHASE_6_COMPLETE.md](PHASE_6_COMPLETE.md) → "Architecture Overview"
**Learn about workflows** | [PHASE_6_COMPLETE.md](PHASE_6_COMPLETE.md) → Sections on each workflow
**Understand security setup** | [CI_CD_SETUP.md](CI_CD_SETUP.md) → "Security Configuration"
**Set up Kubernetes RBAC** | [CI_CD_SETUP.md](CI_CD_SETUP.md) → "Configure RBAC for self-hosted runner"
**Create GitHub secrets** | [PHASE_6_SETUP_CHECKLIST.md](PHASE_6_SETUP_CHECKLIST.md) → Section 1
**Create Kubernetes secrets** | [PHASE_6_SETUP_CHECKLIST.md](PHASE_6_SETUP_CHECKLIST.md) → Sections 2 & 3
**Rollback a deployment** | [CI_CD_QUICK_REFERENCE.md](CI_CD_QUICK_REFERENCE.md) → "Rollback Operations"
**View pod logs** | [CI_CD_QUICK_REFERENCE.md](CI_CD_QUICK_REFERENCE.md) → "View pod logs"
**Test the deployment** | [PHASE_6_COMPLETE.md](PHASE_6_COMPLETE.md) → "Deployment Testing & Validation" OR [PHASE_6_SETUP_CHECKLIST.md](PHASE_6_SETUP_CHECKLIST.md) → Section 7

---

## ✅ What Phase 6 Includes

### Workflows (3 total)

- ✅ **build.yml** - Automated Docker image building
  - Triggers: Push to main/develop, pull requests
  - Builds 3 services in parallel
  - Pushes to ghcr.io with intelligent tagging
  - Duration: ~3-5 minutes

- ✅ **deploy-staging.yml** - Automated staging deployment
  - Triggers: Automatic on develop push
  - Runs on self-hosted Kubernetes runner
  - Pre-deployment validation
  - Health checks and smoke tests
  - Duration: ~3-5 minutes

- ✅ **deploy-production.yml** - Manual production deployment
  - Triggers: Manual via GitHub Actions UI
  - Runs on self-hosted Kubernetes runner
  - Preflight checks and approval gate
  - Enhanced monitoring and optional auto-rollback
  - Duration: ~5-15 minutes

### Configuration (1 file)

- ✅ **.dockerignore** - Docker build optimization
  - Excludes 30+ unnecessary file patterns
  - Improves build speed
  - Reduces image size

### Documentation (5 guides + this index)

- ✅ **PHASE_6_SUMMARY.md** - Executive overview (600+ lines)
- ✅ **PHASE_6_COMPLETE.md** - Detailed implementation (400+ lines)
- ✅ **PHASE_6_SETUP_CHECKLIST.md** - Step-by-step setup (400+ lines)
- ✅ **CI_CD_SETUP.md** - Configuration guide (500+ lines)
- ✅ **CI_CD_QUICK_REFERENCE.md** - Quick command reference (300+ lines)
- ✅ **README.md** (this file) - Navigation guide

**Total**: 2,500+ lines of documentation and configuration

---

## 🚀 Getting Started (5 Steps)

### Step 1: Read the Overview (10 min)
Read [PHASE_6_SUMMARY.md](PHASE_6_SUMMARY.md) to understand what you're setting up

### Step 2: Follow Setup Checklist (30-60 min)
Use [PHASE_6_SETUP_CHECKLIST.md](PHASE_6_SETUP_CHECKLIST.md) to configure everything

### Step 3: Test Build Pipeline (5 min)
Push to develop branch to test automated build workflow

### Step 4: Test Staging Deployment (10 min)
Make a change and watch staging auto-deploy

### Step 5: Test Production (Optional, 10 min)
Manually trigger production deployment to verify safety gates

**Total time**: 1-2 hours for complete setup

---

## 📊 Phase 6 Specifications

| Aspect | Details |
|--------|---------|
| **Build System** | GitHub Actions (ubuntu-latest) |
| **Deploy Runner** | Self-hosted (on-premise K3s) |
| **Container Registry** | GitHub Container Registry (ghcr.io) |
| **Container Orchestration** | Kubernetes (K3s on Raspberry Pi) |
| **Configuration Management** | Kustomize overlays |
| **Secret Management** | GitHub secrets + Kubernetes secrets |
| **Deployment Strategy** | Rolling deployment with health checks |
| **Staging Trigger** | Auto on develop push |
| **Production Trigger** | Manual with approval gate |
| **Health Checks** | Readiness/Liveness probes + smoke tests |
| **Rollback** | Manual + optional auto-rollback |
| **Monitoring** | Detailed GitHub Actions logs + kubectl status |

---

## 🔄 Deployment Workflow

```
├─ Development
│  └─ Feature Branch → git push → Create PR → Code Review
│
├─ Testing (Automatic)
│  └─ Merge to develop → Build Workflow → Deploy to Staging
│
└─ Production (Manual)
   └─ Merge to main → Manual Trigger → Approval → Deploy to Production
```

---

## 🔐 Security Features

- ✅ Secret encryption (GitHub secrets)
- ✅ Kubernetes RBAC (minimal permissions)
- ✅ Production approval gate (manual)
- ✅ Pre-deployment validation
- ✅ Health checks (prevent broken deployments)
- ✅ Audit trail (GitHub Actions logs with timestamps)
- ✅ No hardcoded credentials
- ✅ Optional auto-rollback (if previous version available)

---

## 📋 Prerequisites

Before using Phase 6, you need:

### Infrastructure
- [x] K3s cluster operational (4 nodes)
- [x] Traefik ingress controller installed
- [x] Cert-manager with letsencrypt-prod
- [x] Self-hosted runner online with label `self-hosted`
- [x] kubectl and kustomize on runner

### Configuration
- [ ] GitHub secret `KUBECONFIG` created
- [ ] Kubernetes secrets created in staging namespace
- [ ] Kubernetes secrets created in production namespace
- [ ] DNS records configured for both domains
- [ ] MongoDB deployed to both namespaces

### Code
- [ ] Backend `/health` endpoint (Phase 1)
- [ ] BFF `/health` endpoint (Phase 1)

---

## 🎓 Learning Path

1. **Understand the concept** → Read [PHASE_6_SUMMARY.md](PHASE_6_SUMMARY.md)
2. **Learn the details** → Read [PHASE_6_COMPLETE.md](PHASE_6_COMPLETE.md)
3. **Set up the system** → Follow [PHASE_6_SETUP_CHECKLIST.md](PHASE_6_SETUP_CHECKLIST.md)
4. **Use daily** → Bookmark [CI_CD_QUICK_REFERENCE.md](CI_CD_QUICK_REFERENCE.md)
5. **Troubleshoot** → Reference [CI_CD_SETUP.md](CI_CD_SETUP.md)

---

## 🆘 Need Help?

### For Setup Issues
→ See [PHASE_6_SETUP_CHECKLIST.md](PHASE_6_SETUP_CHECKLIST.md) section 7 "Test the Setup"

### For Troubleshooting
→ See [CI_CD_SETUP.md](CI_CD_SETUP.md) "Troubleshooting" section

### For Common Questions
→ See [CI_CD_QUICK_REFERENCE.md](CI_CD_QUICK_REFERENCE.md)

### For Architecture Questions
→ See [PHASE_6_COMPLETE.md](PHASE_6_COMPLETE.md) "Architecture Overview"

---

## 📝 File Structure

```
vinyl-vault/
├── .github/
│   ├── workflows/
│   │   ├── build.yml                    ← Docker image building
│   │   ├── deploy-staging.yml           ← Auto-deploy to staging
│   │   └── deploy-production.yml        ← Manual deploy to production
│   │
│   ├── PHASE_6_SUMMARY.md              ← Start here (overview)
│   ├── PHASE_6_COMPLETE.md             ← Detailed guide
│   ├── PHASE_6_SETUP_CHECKLIST.md      ← Setup instructions
│   ├── CI_CD_SETUP.md                  ← Configuration guide
│   ├── CI_CD_QUICK_REFERENCE.md        ← Daily reference
│   └── README.md                        ← This file
│
├── .dockerignore                        ← Build optimization
├── infra/
│   ├── Dockerfile.backend              ← Build configs
│   ├── Dockerfile.bff
│   ├── Dockerfile.frontend
│   └── k8s/
│       └── overlays/
│           ├── staging/
│           │   ├── SECRETS.md          ← Staging secrets guide
│           │   └── kustomization.yaml
│           └── production/
│               ├── SECRETS.md          ← Production secrets guide
│               └── kustomization.yaml
```

---

## ✨ Highlights

### For Developers
- **Easy deployments**: Just `git push origin develop`
- **Fast feedback**: 5-10 minute deployment to staging
- **Safe testing**: Automatic staging, manual production
- **Quick reference**: All commands in one place

### For Operations
- **Automated**: Less manual work
- **Observable**: Detailed logs and status
- **Reliable**: Health checks and validation
- **Safe**: Approval gates and rollback support

### For Security
- **Encrypted secrets**: GitHub's encryption
- **RBAC**: Minimal cluster permissions
- **Approval gates**: Manual production gate
- **Audit trail**: Complete deployment history

---

## 🎉 You're All Set!

Phase 6 is **100% complete** with:
- ✅ 3 production-ready GitHub Actions workflows
- ✅ 5 comprehensive documentation guides
- ✅ Docker optimization
- ✅ Self-hosted runner support
- ✅ Security best practices
- ✅ Troubleshooting guides

**Next step**: Follow [PHASE_6_SETUP_CHECKLIST.md](PHASE_6_SETUP_CHECKLIST.md) to configure your first deployment!

---

## 📞 Quick Links

- **GitHub Actions**: https://github.com/mloitzl/vinyl-vault/actions
- **Container Registry**: https://github.com/mloitzl/vinyl-vault/pkgs/container
- **Staging**: https://vinylvault.antisocializer.org
- **Production**: https://vinylvault.loitzl.com

---

**Happy deploying! 🚀**
