#!/bin/bash
# Deploy any branch to staging K8s environment
# Usage: ./scripts/deploy-branch-to-staging.sh [branch-name]
#
# If no branch is specified, uses current branch
# Images must already be built and pushed to GHCR

set -e

BRANCH="${1:-$(git branch --show-current)}"
NAMESPACE="vinylvault-staging"
REGISTRY="ghcr.io"
OWNER="mloitzl"

echo "🚀 Deploying branch '${BRANCH}' to staging environment"
echo ""

# Determine image tag based on branch
if [ "$BRANCH" = "main" ]; then
  IMAGE_TAG="latest-production"
elif [ "$BRANCH" = "develop" ]; then
  IMAGE_TAG="latest-staging"
else
  # For feature branches, use commit SHA
  COMMIT_SHA=$(git rev-parse --short HEAD)
  IMAGE_TAG="$COMMIT_SHA"
  echo "⚠️  Note: Feature branch detected, using commit SHA: $IMAGE_TAG"
  echo "   Make sure this commit has been pushed and images are built!"
  echo ""
fi

echo "📦 Image tag: ${IMAGE_TAG}"
echo "🔧 Namespace: ${NAMESPACE}"
echo ""

# Confirm deployment
read -p "Continue with deployment? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
  echo "❌ Deployment cancelled"
  exit 1
fi

echo ""
echo "Deploying services..."

# Update backend
echo "→ Updating backend..."
kubectl set image deployment/backend \
  backend=${REGISTRY}/${OWNER}/vinylvault-backend:${IMAGE_TAG} \
  -n ${NAMESPACE}

# Update BFF
echo "→ Updating BFF..."
kubectl set image deployment/bff \
  bff=${REGISTRY}/${OWNER}/vinylvault-bff:${IMAGE_TAG} \
  -n ${NAMESPACE}

# Update frontend
echo "→ Updating frontend..."
kubectl set image deployment/frontend \
  frontend=${REGISTRY}/${OWNER}/vinylvault-frontend:${IMAGE_TAG} \
  -n ${NAMESPACE}

echo ""
echo "⏳ Waiting for rollouts to complete..."
echo ""

# Wait for rollout completion
kubectl rollout status deployment/backend -n ${NAMESPACE} --timeout=5m &
kubectl rollout status deployment/bff -n ${NAMESPACE} --timeout=5m &
kubectl rollout status deployment/frontend -n ${NAMESPACE} --timeout=5m &

wait

echo ""
echo "✅ Deployment complete!"
echo "🌐 Visit: https://vinylvault.antisocializer.org"
echo ""
echo "To check pod status:"
echo "  kubectl get pods -n ${NAMESPACE}"
