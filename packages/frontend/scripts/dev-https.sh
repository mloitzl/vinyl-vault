#!/usr/bin/env sh
set -e

# Simple helper to generate locally-trusted certs with mkcert and start Vite with HTTPS.
# Usage: HOST=192.168.1.102 sh ./scripts/dev-https.sh

HOST=${HOST:-localhost}
CERT_DIR=./certs

mkdir -p "$CERT_DIR"

if ! command -v mkcert >/dev/null 2>&1; then
  echo "mkcert not found. Install it from https://github.com/FiloSottile/mkcert"
  exit 1
fi

echo "Generating certs for host: $HOST"
mkcert -install
mkcert -key-file "$CERT_DIR/${HOST}-key.pem" -cert-file "$CERT_DIR/${HOST}.pem" "$HOST" 127.0.0.1 localhost

echo "Starting Vite with HTTPS on host $HOST"
node ./scripts/dev-https-runner.mjs "$HOST" "$CERT_DIR/${HOST}.pem" "$CERT_DIR/${HOST}-key.pem"
