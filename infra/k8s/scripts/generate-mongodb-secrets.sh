#!/bin/bash
# Generate MongoDB secrets for staging and production namespaces
# Usage: ./generate-mongodb-secrets.sh <namespace>

set -e

NAMESPACE=${1:-vinylvault-staging}

echo "🔐 Generating MongoDB secrets for namespace: $NAMESPACE"

# Generate secure random passwords
BFF_MONGO_ROOT_PASSWORD=$(openssl rand -base64 32 | tr -d "=+/" | cut -c1-32)
BACKEND_MONGO_ROOT_PASSWORD=$(openssl rand -base64 32 | tr -d "=+/" | cut -c1-32)

# Generate registry DB password (shared by both BFF and Backend)
REGISTRY_MONGO_PASSWORD=$(openssl rand -base64 32 | tr -d "=+/" | cut -c1-32)

echo "📝 Creating secrets in namespace: $NAMESPACE"

# Create BFF MongoDB secret
kubectl create secret generic mongodb-bff-secret \
  --namespace=$NAMESPACE \
  --from-literal=mongodb-root-password=$BFF_MONGO_ROOT_PASSWORD \
  --dry-run=client -o yaml | kubectl apply -f -

# Create Backend MongoDB secret
kubectl create secret generic mongodb-backend-secret \
  --namespace=$NAMESPACE \
  --from-literal=mongodb-root-password=$BACKEND_MONGO_ROOT_PASSWORD \
  --dry-run=client -o yaml | kubectl apply -f -

# Create Registry MongoDB secret (used by both services)
kubectl create secret generic mongodb-registry-secret \
  --namespace=$NAMESPACE \
  --from-literal=mongodb-registry-password=$REGISTRY_MONGO_PASSWORD \
  --dry-run=client -o yaml | kubectl apply -f -

echo "✅ Secrets created successfully!"
echo ""
echo "📋 Connection strings for .env file:"
echo ""
echo "# BFF MongoDB (sessions)"
echo "MONGODB_URI=mongodb://root:$BFF_MONGO_ROOT_PASSWORD@mongodb-bff-0.mongodb-bff.$NAMESPACE.svc.cluster.local:27017/vinylvault_bff?authSource=admin"
echo ""
echo "# Backend MongoDB (registry database)"
echo "MONGODB_REGISTRY_URI=mongodb://root:$BACKEND_MONGO_ROOT_PASSWORD@mongodb-backend-0.mongodb-backend.$NAMESPACE.svc.cluster.local:27017/vinylvault_registry?authSource=admin"
echo ""
echo "# Backend MongoDB (base URI for tenant databases)"
echo "MONGODB_URI_BASE=mongodb://root:$BACKEND_MONGO_ROOT_PASSWORD@mongodb-backend-0.mongodb-backend.$NAMESPACE.svc.cluster.local:27017?authSource=admin"
echo ""
echo "⚠️  Save these connection strings - passwords are stored in K8s secrets!"
