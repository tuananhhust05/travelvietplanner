#!/usr/bin/env bash
# Seed a couple of KB chunks into the RAG service so planner has grounding.
set -euo pipefail
RAG="${RAG:-http://localhost:8000}"
TOKEN="${RAG_SERVICE_TOKEN:-change-me-internal-hmac-secret}"

curl -fsS -X POST "$RAG/internal/ingest" \
  -H "authorization: Bearer $TOKEN" \
  -H 'content-type: application/json' \
  -d '{
    "chunks": [
      {"document_id":"seed-1","title":"Da Nang overview","lang":"en","text":"Da Nang is a coastal city in central Vietnam known for My Khe beach, the Marble Mountains, and the Golden Bridge at Ba Na Hills. Best visited February to May."},
      {"document_id":"seed-2","title":"Ha Long Bay","lang":"en","text":"Ha Long Bay features thousands of limestone karsts. Cruises typically depart from Tuan Chau or Got harbor. Overnight cruises are popular."},
      {"document_id":"seed-3","title":"Da Nang tong quan","lang":"vi","text":"Da Nang la thanh pho ven bien mien Trung Viet Nam, noi tieng voi bai bien My Khe, Ngu Hanh Son va Cau Vang tren Ba Na Hills. Nen di tu thang 2 den thang 5."}
    ]
  }' && echo
echo "KB seeded"
