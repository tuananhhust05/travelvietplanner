from __future__ import annotations

import json
import logging
import uuid
from typing import AsyncIterator

from fastapi import Depends, FastAPI, Header, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from .config import settings
from .guardrails import screen_input
from .providers import embed_text, generate_stream, generate_itinerary
from .qdrant_store import store

logging.basicConfig(level=logging.INFO)
log = logging.getLogger("rag.main")

app = FastAPI(title="tvp-rag", version="0.1.0")


@app.on_event("startup")
def _startup() -> None:
    store.ensure_collection()
    log.info("rag-service ready (stub_mode=%s)", settings.stub_mode)


def require_service_token(authorization: str = Header(default="")) -> None:
    token = authorization[7:] if authorization.startswith("Bearer ") else authorization
    if token != settings.rag_service_token:
        raise HTTPException(status_code=401, detail="invalid service token")


@app.get("/health")
def health() -> dict:
    return {"status": "ok", "service": "rag", "stub_mode": settings.stub_mode}


class QueryRequest(BaseModel):
    query: str = Field(min_length=1, max_length=4000)
    lang: str = "vi"
    conversation_id: str | None = None
    history: list[dict] | None = None


@app.post("/v1/query", dependencies=[Depends(require_service_token)])
async def query(req: QueryRequest) -> StreamingResponse:
    allowed, reason = screen_input(req.query)
    if not allowed:
        async def blocked() -> AsyncIterator[bytes]:
            yield sse("error", {"code": reason, "retryable": False})
        return StreamingResponse(blocked(), media_type="text/event-stream")

    vector = embed_text(req.query)
    hits = store.search(vector, top_k=6, lang=req.lang)
    context = "\n\n".join(
        f"[{i+1}] {h['payload'].get('text', '')}" for i, h in enumerate(hits)
    )
    citations = [
        {
            "n": i + 1,
            "documentId": h["payload"].get("document_id"),
            "title": h["payload"].get("title"),
            "score": round(h.get("score", 0.0), 4),
        }
        for i, h in enumerate(hits)
    ]

    async def event_stream() -> AsyncIterator[bytes]:
        yield sse("citations", {"citations": citations})
        async for item in generate_stream(req.query, context, req.lang, req.history):
            if item.get("type") == "sources":
                yield sse("sources", {"sources": item.get("sources", [])})
            else:
                yield sse("token", {"delta": item.get("delta", "")})
        yield sse("done", {"conversationId": req.conversation_id})

    return StreamingResponse(event_stream(), media_type="text/event-stream")


class ItineraryRequest(BaseModel):
    conversation_id: str | None = None
    lang: str = "vi"
    history: list[dict] | None = None


@app.post("/v1/itinerary", dependencies=[Depends(require_service_token)])
async def itinerary(req: ItineraryRequest) -> dict:
    return await generate_itinerary(req.history, req.lang)


class IngestChunk(BaseModel):
    document_id: str
    title: str
    text: str
    lang: str = "vi"


class IngestRequest(BaseModel):
    chunks: list[IngestChunk]


@app.post("/internal/ingest", dependencies=[Depends(require_service_token)])
def ingest(req: IngestRequest) -> dict:
    from qdrant_client.http import models as qm

    points: list[qm.PointStruct] = []
    for chunk in req.chunks:
        vector = embed_text(chunk.text)
        points.append(
            qm.PointStruct(
                id=str(uuid.uuid4()),
                vector={"dense": vector},
                payload={
                    "document_id": chunk.document_id,
                    "title": chunk.title,
                    "text": chunk.text,
                    "lang": chunk.lang,
                    "published": True,
                },
            )
        )
    store.upsert_chunks(points)
    return {"ingested": len(points)}


@app.delete("/internal/documents/{document_id}", dependencies=[Depends(require_service_token)])
def delete_document(document_id: str) -> dict:
    from qdrant_client.http import models as qm

    store.client.delete(
        collection_name=store.collection,
        points_selector=qm.FilterSelector(
            filter=qm.Filter(
                must=[qm.FieldCondition(key="document_id", match=qm.MatchValue(value=document_id))]
            )
        ),
    )
    return {"deleted": True, "document_id": document_id}


def sse(event: str, data: dict) -> bytes:
    return f"event: {event}\ndata: {json.dumps(data, ensure_ascii=False)}\n\n".encode()
