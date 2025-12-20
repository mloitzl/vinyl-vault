#!/bin/bash
# Teardown the entire staging environment (namespace + resources)
# WARNING: This deletes ALL resources in the vinylvault-staging namespace,
# including Secrets, PVCs, Services, StatefulSets, ConfigMaps, etc.

set -euo pipefail

NAMESPACE="vinylvault-staging"

echo "⚠️  You are about to DELETE the entire namespace: $NAMESPACE"
echo "This will remove MongoDB pods, services, secrets, PVCs, and any other resources in that namespace."
echo ""
read -r -p "Type 'delete' to confirm: " CONFIRM
if [[ "$CONFIRM" != "delete" ]]; then
  echo "Aborted."
  exit 1
fi

echo "\n🧹 Step 1: Deleting MongoDB resources (if present)"
kubectl delete statefulset -n "$NAMESPACE" mongodb-bff mongodb-backend --ignore-not-found
kubectl delete svc -n "$NAMESPACE" mongodb-bff mongodb-backend --ignore-not-found
kubectl delete secret -n "$NAMESPACE" mongodb-bff-secret mongodb-backend-secret --ignore-not-found

echo "\n🧹 Step 2: Deleting PVCs in $NAMESPACE"
kubectl delete pvc --all -n "$NAMESPACE" --ignore-not-found

echo "\n🧹 Step 3: Deleting all remaining namespaced resources"
kubectl delete all --all -n "$NAMESPACE" --ignore-not-found || true
kubectl delete configmap --all -n "$NAMESPACE" --ignore-not-found || true
kubectl delete ingress --all -n "$NAMESPACE" --ignore-not-found || true

echo "\n🗑️  Step 4: Deleting namespace $NAMESPACE"
kubectl delete namespace "$NAMESPACE" --wait=false || true

# Wait until the namespace is fully gone
ATTEMPTS=60
SLEEP=2
for ((i=1; i<=ATTEMPTS; i++)); do
  if ! kubectl get namespace "$NAMESPACE" >/dev/null 2>&1; then
    echo "✅ Namespace $NAMESPACE deleted."
    break
  fi
  echo "...waiting for namespace to terminate (attempt $i/$ATTEMPTS)"
  sleep "$SLEEP"
done

if kubectl get namespace "$NAMESPACE" >/dev/null 2>&1; then
  echo "⚠️  Namespace still terminating. Some resources may have finalizers."
  echo "You can retry later or inspect with: kubectl get ns $NAMESPACE -o yaml"
else
  echo "🎉 Teardown complete for $NAMESPACE."
fi
