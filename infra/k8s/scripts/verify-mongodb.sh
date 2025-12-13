#!/bin/bash
# Verify MongoDB connectivity and health
# Usage: ./verify-mongodb.sh <namespace>

set -e

NAMESPACE=${1:-vinylvault-staging}

echo "🔍 Verifying MongoDB deployment in namespace: $NAMESPACE"
echo "=========================================================="

# Check if pods are running
echo ""
echo "📊 Pod Status:"
kubectl get pods -n "$NAMESPACE" -l component=database

# Check PVCs
echo ""
echo "💾 Persistent Volume Claims:"
kubectl get pvc -n "$NAMESPACE"

# Check Services
echo ""
echo "🌐 Services:"
kubectl get svc -n "$NAMESPACE" -l component=database

# Test BFF MongoDB connectivity
echo "\n"
echo "🔌 Testing BFF MongoDB connectivity..."
# Try authenticated ping first, then fall back to unauthenticated ping if auth fails
kubectl exec -n "$NAMESPACE" mongodb-bff-0 -- sh -c '
  if mongo --quiet -u "$MONGO_INITDB_ROOT_USERNAME" -p "$MONGO_INITDB_ROOT_PASSWORD" --authenticationDatabase admin --eval "db.adminCommand({ ping: 1 })" >/dev/null 2>&1; then
    mongo --quiet -u "$MONGO_INITDB_ROOT_USERNAME" -p "$MONGO_INITDB_ROOT_PASSWORD" --authenticationDatabase admin --eval "print(\"✅ BFF MongoDB is responsive (auth)\"); print(\"Version: \" + db.version());"
  else
    mongo --quiet --eval "var ok=db.adminCommand({ ping: 1 }).ok; if (ok) { print(\"⚠️  BFF ping OK (unauth). Auth failed; check credentials.\"); print(\"Version: \" + db.version()); } else { print(\"❌ BFF MongoDB ping failed\"); }"
  fi
'

# Test Backend MongoDB connectivity
echo "\n"
echo "🔌 Testing Backend MongoDB connectivity..."
kubectl exec -n "$NAMESPACE" mongodb-backend-0 -- sh -c '
  if mongo --quiet -u "$MONGO_INITDB_ROOT_USERNAME" -p "$MONGO_INITDB_ROOT_PASSWORD" --authenticationDatabase admin --eval "db.adminCommand({ ping: 1 })" >/dev/null 2>&1; then
    mongo --quiet -u "$MONGO_INITDB_ROOT_USERNAME" -p "$MONGO_INITDB_ROOT_PASSWORD" --authenticationDatabase admin --eval "print(\"✅ Backend MongoDB is responsive (auth)\"); print(\"Version: \" + db.version());"
  else
    mongo --quiet --eval "var ok=db.adminCommand({ ping: 1 }).ok; if (ok) { print(\"⚠️  Backend ping OK (unauth). Auth failed; check credentials.\"); print(\"Version: \" + db.version()); } else { print(\"❌ Backend MongoDB ping failed\"); }"
  fi
'

# Show resource usage
echo ""
echo "📈 Resource Usage:"
kubectl top pod -n "$NAMESPACE" -l component=database 2>/dev/null || echo "⚠️  Metrics not available (metrics-server may not be installed)"

# Show logs (last 10 lines)
echo ""
echo "📝 Recent logs from mongodb-bff-0:"
kubectl logs -n "$NAMESPACE" mongodb-bff-0 --tail=10

echo ""
echo "📝 Recent logs from mongodb-backend-0:"
kubectl logs -n "$NAMESPACE" mongodb-backend-0 --tail=10

echo ""
echo "✅ Verification complete!"
