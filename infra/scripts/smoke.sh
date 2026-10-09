#!/usr/bin/env bash
# Smoke test the running stack. Usage: BASE=http://localhost:4000 ./smoke.sh
set -euo pipefail
BASE="${BASE:-http://localhost:4000}"
RAG="${RAG:-http://localhost:8000}"
EMAIL="smoke_$(date +%s)@tvp.test"
PASS="Password123!"

echo "== api health =="
curl -fsS "$BASE/health" && echo

echo "== rag health =="
curl -fsS "$RAG/health" && echo

echo "== register =="
REG=$(curl -fsS -X POST "$BASE/v1/auth/register" \
  -H 'content-type: application/json' \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASS\",\"displayName\":\"Smoke\",\"accountType\":\"traveler\"}")
echo "$REG"
TOKEN=$(echo "$REG" | sed -n 's/.*"accessToken":"\([^"]*\)".*/\1/p')

echo "== create post =="
curl -fsS -X POST "$BASE/v1/posts" \
  -H "authorization: Bearer $TOKEN" \
  -H 'content-type: application/json' \
  -d '{"body":"Hello from smoke test - Ha Long Bay is beautiful","lang":"en"}' && echo

echo "== feed =="
curl -fsS "$BASE/v1/posts/feed?limit=5" && echo

echo "== planner ask (SSE, first bytes) =="
curl -fsS -N -X POST "$BASE/v1/planner/ask" \
  -H "authorization: Bearer $TOKEN" \
  -H 'content-type: application/json' \
  -d '{"message":"Suggest a 3-day trip in Da Nang","lang":"en"}' --max-time 15 | head -c 600 && echo

echo "== ALL SMOKE CHECKS PASSED =="
