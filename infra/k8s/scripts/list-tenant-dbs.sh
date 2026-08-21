#!/usr/bin/env bash
# List tenant database names from registry metadata.
# Output: one database name per line.

set -euo pipefail

MONGO_SHELL="$(command -v mongosh 2>/dev/null || command -v mongo 2>/dev/null || true)"
if [[ -z "${MONGO_SHELL}" ]]; then
  echo "Error: mongosh/mongo is required." >&2
  exit 1
fi

MONGODB_HOST="${MONGODB_HOST:-mongodb:27017}"
MONGODB_ROOT_USERNAME="${MONGODB_ROOT_USERNAME:-root}"
MONGODB_ROOT_PASSWORD="${MONGODB_ROOT_PASSWORD:-}"
REGISTRY_DB_NAME="${REGISTRY_DB_NAME:-vinylvault_registry}"
TENANTS_COLLECTION="${TENANTS_COLLECTION:-tenants}"

if [[ -z "${MONGODB_ROOT_PASSWORD}" ]]; then
  echo "Error: MONGODB_ROOT_PASSWORD is required." >&2
  exit 1
fi

REGISTRY_URI="mongodb://${MONGODB_ROOT_USERNAME}:${MONGODB_ROOT_PASSWORD}@${MONGODB_HOST}/${REGISTRY_DB_NAME}?authSource=admin"
ADMIN_URI="mongodb://${MONGODB_ROOT_USERNAME}:${MONGODB_ROOT_PASSWORD}@${MONGODB_HOST}/admin?authSource=admin"

TENANT_DBS="$(
  "${MONGO_SHELL}" "${REGISTRY_URI}" --quiet --eval "
    db.getCollection('${TENANTS_COLLECTION}')
      .find({ databaseName: { \$type: 'string' } }, { _id: 0, databaseName: 1 })
      .forEach(function(doc) {
        if (doc.databaseName) print(doc.databaseName);
      });
  " | grep -E '^vv_[a-z0-9]+' | sort -u || true
)"

if [[ -n "${TENANT_DBS}" ]]; then
  printf '%s\n' "${TENANT_DBS}"
  exit 0
fi

echo "Registry lookup empty, falling back to listDatabases filter..." >&2

"${MONGO_SHELL}" "${ADMIN_URI}" --quiet --eval "
  db.adminCommand({ listDatabases: 1 }).databases.forEach(function(d) {
    print(d.name);
  });
" \
  | grep -E '^vv_[a-z0-9]+' \
  | sort -u

