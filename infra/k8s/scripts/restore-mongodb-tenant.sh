#!/usr/bin/env bash
# Restore a tenant backup archive from S3-compatible storage into MongoDB.
# Default is non-destructive: restore into a scratch database.
#
# Usage:
#   restore-mongodb-tenant.sh <tenant-db> <backup-object-path> [--target-db <name>] [--namespace <ns>] [--pod <pod>] [--mongo-secret <name>] [--s3-secret <name>] [--live-restore]

set -euo pipefail

usage() {
  cat <<'EOF'
Usage:
  restore-mongodb-tenant.sh <tenant-db> <backup-object-path> [options]

Options:
  --target-db <name>      Target database name (default: <tenant-db>_restore_test_<timestamp>)
  --namespace <name>      Kubernetes namespace (default: vinylvault)
  --pod <name>            MongoDB pod name (default: mongodb-0)
  --mongo-secret <name>   Secret with root credentials (default: mongodb-secrets)
  --s3-secret <name>      Secret with S3 credentials (default: mongodb-backup-s3)
  --live-restore          Allow overwrite restore into the source DB (requires confirmation)
  -h, --help              Show this help
EOF
}

if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
  usage
  exit 0
fi

if [[ $# -lt 2 ]]; then
  usage
  exit 1
fi

TENANT_DB="$1"
BACKUP_OBJECT_PATH="$2"
shift 2

TARGET_DB=""
NAMESPACE="vinylvault"
POD_NAME="mongodb-0"
MONGO_SECRET="mongodb-secrets"
S3_SECRET="mongodb-backup-s3"
LIVE_RESTORE="false"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --target-db)
      TARGET_DB="${2:-}"
      shift 2
      ;;
    --namespace)
      NAMESPACE="${2:-}"
      shift 2
      ;;
    --pod)
      POD_NAME="${2:-}"
      shift 2
      ;;
    --mongo-secret)
      MONGO_SECRET="${2:-}"
      shift 2
      ;;
    --s3-secret)
      S3_SECRET="${2:-}"
      shift 2
      ;;
    --live-restore)
      LIVE_RESTORE="true"
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown option: $1" >&2
      usage
      exit 1
      ;;
  esac
done

if ! command -v kubectl >/dev/null 2>&1; then
  echo "Error: kubectl is required." >&2
  exit 1
fi
if ! command -v mc >/dev/null 2>&1; then
  echo "Error: mc (MinIO client) is required." >&2
  exit 1
fi

if [[ -z "${TARGET_DB}" ]]; then
  TARGET_DB="${TENANT_DB}_restore_test_$(date -u +%Y%m%d%H%M%S)"
fi

if [[ "${TARGET_DB}" == "${TENANT_DB}" && "${LIVE_RESTORE}" != "true" ]]; then
  echo "Refusing destructive restore into live DB without --live-restore." >&2
  exit 1
fi

if [[ "${LIVE_RESTORE}" == "true" && "${TARGET_DB}" != "${TENANT_DB}" ]]; then
  echo "--live-restore is only valid when --target-db equals <tenant-db>." >&2
  exit 1
fi

if [[ "${LIVE_RESTORE}" == "true" ]]; then
  echo "WARNING: This will overwrite live tenant database '${TENANT_DB}' in namespace '${NAMESPACE}'."
  read -r -p "Type the tenant DB name to continue: " CONFIRM
  if [[ "${CONFIRM}" != "${TENANT_DB}" ]]; then
    echo "Confirmation mismatch. Aborting."
    exit 1
  fi
fi

decode_secret_key() {
  local secret_name="$1"
  local key="$2"
  local encoded
  encoded="$(kubectl get secret "${secret_name}" -n "${NAMESPACE}" -o "jsonpath={.data.${key}}" 2>/dev/null || true)"
  if [[ -z "${encoded}" ]]; then
    return 1
  fi

  if printf '%s' "${encoded}" | base64 --decode >/dev/null 2>&1; then
    printf '%s' "${encoded}" | base64 --decode
    return 0
  fi

  printf '%s' "${encoded}" | base64 -D
}

MONGO_USER="$(decode_secret_key "${MONGO_SECRET}" "MONGODB_ROOT_USERNAME" || true)"
MONGO_PASS="$(decode_secret_key "${MONGO_SECRET}" "MONGODB_ROOT_PASSWORD" || true)"

if [[ -z "${MONGO_USER}" || -z "${MONGO_PASS}" ]]; then
  # Backward compatibility with mongodb-backend-secret shape.
  MONGO_USER="${MONGO_USER:-root}"
  MONGO_PASS="$(decode_secret_key "${MONGO_SECRET}" "mongodb-root-password" || true)"
fi

if [[ -z "${MONGO_PASS}" ]]; then
  echo "Could not read MongoDB root password from secret '${MONGO_SECRET}'." >&2
  exit 1
fi

AWS_ACCESS_KEY_ID="$(decode_secret_key "${S3_SECRET}" "AWS_ACCESS_KEY_ID")"
AWS_SECRET_ACCESS_KEY="$(decode_secret_key "${S3_SECRET}" "AWS_SECRET_ACCESS_KEY")"
S3_ENDPOINT="$(decode_secret_key "${S3_SECRET}" "AWS_ENDPOINTS")"
BUCKET_NAME="$(decode_secret_key "${S3_SECRET}" "BUCKET_NAME")"

if [[ -z "${AWS_ACCESS_KEY_ID}" || -z "${AWS_SECRET_ACCESS_KEY}" || -z "${S3_ENDPOINT}" || -z "${BUCKET_NAME}" ]]; then
  echo "S3 secret '${S3_SECRET}' is missing one or more required keys." >&2
  exit 1
fi

tmp_dir="$(mktemp -d)"
trap 'rm -rf "${tmp_dir}"' EXIT
archive_path="${tmp_dir}/restore.archive.gz"

mc alias set backup-target "${S3_ENDPOINT}" "${AWS_ACCESS_KEY_ID}" "${AWS_SECRET_ACCESS_KEY}" >/dev/null
mc cp "backup-target/${BUCKET_NAME}/${BACKUP_OBJECT_PATH}" "${archive_path}" >/dev/null

kubectl cp "${archive_path}" "${NAMESPACE}/${POD_NAME}:/tmp/restore.archive.gz"

kubectl exec -n "${NAMESPACE}" "${POD_NAME}" -- \
  mongorestore \
    --uri="mongodb://${MONGO_USER}:${MONGO_PASS}@localhost:27017/admin?authSource=admin" \
    --archive="/tmp/restore.archive.gz" \
    --gzip \
    --nsFrom="${TENANT_DB}.*" \
    --nsTo="${TARGET_DB}.*" \
    --drop

kubectl exec -n "${NAMESPACE}" "${POD_NAME}" -- rm -f /tmp/restore.archive.gz >/dev/null

echo "Restore completed."
echo "Source DB: ${TENANT_DB}"
echo "Target DB: ${TARGET_DB}"
if [[ "${TARGET_DB}" == "${TENANT_DB}" ]]; then
  echo "Mode: LIVE overwrite"
else
  echo "Mode: non-destructive test restore"
fi
