from __future__ import annotations

import logging
from qdrant_client import QdrantClient
from qdrant_client.http import models as qm

from .config import settings

log = logging.getLogger("rag.qdrant")


class QdrantStore:
    def __init__(self) -> None:
        self.client = QdrantClient(url=settings.qdrant_url, timeout=10.0)
        self.collection = settings.kb_collection

    def ensure_collection(self) -> None:
        try:
            existing = {c.name for c in self.client.get_collections().collections}
            if self.collection not in existing:
                self.client.create_collection(
                    collection_name=self.collection,
                    vectors_config={
                        "dense": qm.VectorParams(
                            size=settings.embed_dim, distance=qm.Distance.COSINE
                        )
                    },
                )
                log.info("created qdrant collection %s", self.collection)
        except Exception as exc:  # noqa: BLE001 - startup resilience
            log.warning("ensure_collection failed (qdrant starting?): %s", exc)

    def upsert_chunks(self, points: list[qm.PointStruct]) -> None:
        self.client.upsert(collection_name=self.collection, points=points)

    def search(
        self, vector: list[float], top_k: int = 6, lang: str | None = None
    ) -> list[dict]:
        flt = None
        if lang:
            flt = qm.Filter(
                must=[qm.FieldCondition(key="lang", match=qm.MatchValue(value=lang))]
            )
        try:
            res = self.client.query_points(
                collection_name=self.collection,
                query=vector,
                using="dense",
                limit=top_k,
                query_filter=flt,
                with_payload=True,
            )
            return [
                {"score": p.score, "payload": p.payload or {}} for p in res.points
            ]
        except Exception as exc:  # noqa: BLE001 - degrade gracefully
            log.warning("qdrant search failed: %s", exc)
            return []


store = QdrantStore()
