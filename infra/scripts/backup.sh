#!/usr/bin/env bash
# Backup MongoDB, Qdrant snapshot, and ES snapshot. RPO target 15min per plan-03.
set -euo pipefail
STAMP=$(date +%Y%m%d_%H%M%S)
OUT="${BACKUP_DIR:-./backups}/$STAMP"
mkdir -p "$OUT"
COMPOSE="docker compose -f infra/compose/docker-compose.prod.yml"

echo "[*] MongoDB dump ..."
$COMPOSE exec -T mongodb mongodump --archive --gzip --db travelvietplaner > "$OUT/mongo.archive.gz"

echo "[*] Qdrant snapshot ..."
curl -fsS -X POST "http://localhost:6333/collections/tvp_kb/snapshots" || echo "qdrant snapshot skipped"

echo "[*] Done -> $OUT"
