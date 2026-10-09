#!/usr/bin/env bash
# Restore MongoDB from an archive produced by backup.sh. RTO target 2h per plan-03.
set -euo pipefail
ARCHIVE="${1:?usage: restore.sh path/to/mongo.archive.gz}"
COMPOSE="docker compose -f infra/compose/docker-compose.prod.yml"

echo "[*] Restoring MongoDB from $ARCHIVE ..."
cat "$ARCHIVE" | $COMPOSE exec -T mongodb mongorestore --archive --gzip --drop
echo "[*] Restore complete. ES/Qdrant are derived — rebuild via worker reindex if needed."
