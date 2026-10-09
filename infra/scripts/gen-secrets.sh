#!/usr/bin/env bash
# Generate RS256 keypair + internal service token into ./secrets (git-ignored).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
SECRETS="$ROOT/secrets"
mkdir -p "$SECRETS"

if [ ! -f "$SECRETS/jwt_private.pem" ]; then
  openssl genpkey -algorithm RSA -pkeyopt rsa_keygen_bits:2048 -out "$SECRETS/jwt_private.pem"
  openssl rsa -in "$SECRETS/jwt_private.pem" -pubout -out "$SECRETS/jwt_public.pem"
  echo "generated JWT keypair"
else
  echo "JWT keypair already exists, skipping"
fi

if [ ! -f "$SECRETS/rag_service_token" ]; then
  openssl rand -hex 32 > "$SECRETS/rag_service_token"
  echo "generated rag service token"
fi

echo "secrets ready in $SECRETS"
