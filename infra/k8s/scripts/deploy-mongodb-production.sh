#!/bin/bash
# Deploy MongoDB to production namespace
# This script handles the complete deployment process

set -e

NAMESPACE="vinylvault-production"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
K8S_DIR="$(dirname "$SCRIPT_DIR")"

echo "🚀 Deploying MongoDB to $NAMESPACE"
echo "=================================="
echo "⚠️  WARNING: This will deploy to PRODUCTION!"
echo ""
read -p "Are you sure you want to continue? (yes/no): " -r
if [[ ! $REPLY =~ ^[Yy][Ee][Ss]$ ]]; then
    echo "Deployment cancelled."
    exit 0
fi

# Step 1: Create namespace
echo ""
echo "📦 Step 1: Creating namespace..."
kubectl apply -f "$K8S_DIR/namespaces/vinylvault-production.yaml"

# Step 2: Generate secrets
echo ""
echo "🔐 Step 2: Generating MongoDB secrets..."
"$SCRIPT_DIR/generate-mongodb-secrets.sh" "$NAMESPACE"

# Step 3: Deploy MongoDB StatefulSets
echo ""
echo "💾 Step 3: Deploying MongoDB StatefulSets..."
kubectl apply -f "$K8S_DIR/mongodb/mongodb-bff-production.yaml"
kubectl apply -f "$K8S_DIR/mongodb/mongodb-backend-production.yaml"

# Step 4: Wait for StatefulSets to be ready
echo ""
echo "⏳ Step 4: Waiting for MongoDB pods to be ready..."
echo "Waiting for mongodb-bff..."
kubectl wait --for=condition=ready pod/mongodb-bff-0 -n "$NAMESPACE" --timeout=300s

echo "Waiting for mongodb-backend..."
kubectl wait --for=condition=ready pod/mongodb-backend-0 -n "$NAMESPACE" --timeout=300s

# Step 5: Verify deployment
echo ""
echo "✅ Step 5: Verifying deployment..."
kubectl get pods -n "$NAMESPACE" -l component=database
kubectl get pvc -n "$NAMESPACE"
kubectl get svc -n "$NAMESPACE" -l component=database

echo ""
echo "🎉 MongoDB deployment complete!"
echo ""
echo "📋 Next steps:"
echo "1. Update your production .env file with the connection strings shown above"
echo "2. Test connectivity: ./verify-mongodb.sh $NAMESPACE"
echo "3. Deploy application services"
