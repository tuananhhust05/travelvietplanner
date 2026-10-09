from __future__ import annotations

import hashlib
import logging
from typing import AsyncIterator

import httpx

from .config import settings

log = logging.getLogger("rag.providers")

GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta"


def embed_text(text: str) -> list[float]:
    """Return a dense embedding. Deterministic stub when no API key configured."""
    if settings.stub_mode:
        return _stub_embedding(text)
    try:
        with httpx.Client(timeout=20.0) as client:
            r = client.post(
                f"{GEMINI_BASE}/models/{settings.gemini_embed_model}:embedContent",
                params={"key": settings.gemini_api_key},
                json={"content": {"parts": [{"text": text}]}},
            )
            r.raise_for_status()
            values = r.json()["embedding"]["values"]
            return values[: settings.embed_dim]
    except Exception as exc:  # noqa: BLE001
        log.warning("embed failed, using stub: %s", exc)
        return _stub_embedding(text)


def _stub_embedding(text: str) -> list[float]:
    seed = hashlib.sha256(text.encode()).digest()
    return [((seed[i % len(seed)] / 255.0) * 2 - 1) for i in range(settings.embed_dim)]


async def generate_stream(
    query: str, context: str, lang: str, history: list[dict] | None = None
) -> AsyncIterator[dict]:
    """Stream answer tokens and web-search sources as structured dicts.

    Yields:
      {"type": "token", "delta": "<text>"}
      {"type": "sources", "sources": [{"title", "url"}, ...]}
    """
    if settings.stub_mode:
        yield {"type": "sources", "sources": []}
        async for tok in _stub_stream(query, context, lang):
            yield {"type": "token", "delta": tok}
        return
    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            prompt = _build_prompt(query, context, lang, history)
            async with client.stream(
                "POST",
                f"{GEMINI_BASE}/models/{settings.gemini_model}:streamGenerateContent",
                params={"key": settings.gemini_api_key, "alt": "sse"},
                json={
                    "contents": [{"parts": [{"text": prompt}]}],
                    "tools": [{"googleSearch": {}}],
                },
            ) as resp:
                async for line in resp.aiter_lines():
                    if line.startswith("data:"):
                        import json

                        try:
                            data = json.loads(line[5:].strip())
                            candidate = data["candidates"][0]
                            parts = candidate["content"]["parts"]
                            for p in parts:
                                if "text" in p:
                                    yield {"type": "token", "delta": p["text"]}
                            meta = candidate.get("groundingMetadata") or {}
                            chunks = meta.get("groundingChunks") or []
                            if chunks:
                                sources = [
                                    {
                                        "title": c.get("web", {}).get("title", ""),
                                        "url": c.get("web", {}).get("uri", ""),
                                    }
                                    for c in chunks
                                    if c.get("web")
                                ]
                                if sources:
                                    yield {"type": "sources", "sources": sources}
                        except Exception:  # noqa: BLE001
                            continue
    except Exception as exc:  # noqa: BLE001
        log.warning("generate failed, using stub: %s", exc)
        yield {"type": "sources", "sources": []}
        async for tok in _stub_stream(query, context, lang):
            yield {"type": "token", "delta": tok}


async def _stub_stream(query: str, context: str, lang: str) -> AsyncIterator[str]:
    if lang == "en":
        msg = f"[stub answer] You asked: '{query}'. "
        msg += "Grounded on internal KB. " if context else "No internal sources matched. "
        msg += "Configure GEMINI_API_KEY for real answers."
    else:
        msg = f"[trả lời mẫu] Bạn hỏi: '{query}'. "
        msg += "Dựa trên KB nội bộ. " if context else "Chưa có nguồn nội bộ khớp. "
        msg += "Cấu hình GEMINI_API_KEY để có câu trả lời thật."
    for word in msg.split(" "):
        yield word + " "


async def generate_itinerary(
    history: list[dict] | None, lang: str
) -> dict:
    """Generate a structured day-by-day itinerary from conversation context.

    Uses Gemini + Google Search grounding for up-to-date info. Returns
    {"itinerary": {...}, "citations": [{"title", "url"}, ...]}.
    """
    if settings.stub_mode:
        return _stub_itinerary(history, lang)
    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            prompt = _build_itinerary_prompt(history, lang)
            r = await client.post(
                f"{GEMINI_BASE}/models/{settings.gemini_model}:generateContent",
                params={"key": settings.gemini_api_key},
                json={
                    "contents": [{"parts": [{"text": prompt}]}],
                    "tools": [{"googleSearch": {}}],
                    "generationConfig": {
                        "responseMimeType": "application/json",
                        "temperature": 0.4,
                    },
                },
            )
            r.raise_for_status()
            data = r.json()
            candidate = data["candidates"][0]
            text = candidate["content"]["parts"][0]["text"]
            import json

            parsed = json.loads(text)
            # JSON mode strips groundingMetadata, so sources are embedded in the
            # JSON output itself (see _build_itinerary_prompt).
            sources = parsed.pop("sources", None) or []
            citations = [
                {"title": s.get("title", ""), "url": s.get("url", "")}
                for s in sources
                if isinstance(s, dict) and s.get("url")
            ]
            return {"itinerary": parsed, "citations": citations}
    except Exception as exc:  # noqa: BLE001
        log.warning("itinerary failed, using stub: %s", exc)
        return _stub_itinerary(history, lang)


def _build_itinerary_prompt(history: list[dict] | None, lang: str) -> str:
    convo = "\n".join(
        f"{t.get('role', 'user')}: {t.get('content', '')}" for t in (history or [])
    )
    if lang == "en":
        instruction = (
            "You are a Vietnam travel planning assistant. Based on the conversation "
            "below, build a realistic day-by-day itinerary. Use the web search tool to "
            "get accurate, up-to-date info (prices, opening hours, transport, weather). "
            "Return ONLY valid JSON matching this exact schema:\n"
            '{"days": [{"day": <int>, "title": "<string>", "budget": "<string>", '
            '"stops": [{"name": "<string>", "note": "<string>"}]}], '
            '"destination": "<string>", '
            '"sources": [{"title": "<string>", "url": "<string>"}]}\n'
            '"sources" is the list of web sources you actually searched (max 5, with real '
            'URLs). If you did not retrieve any source, return an empty array.\n'
            "If the conversation does not contain enough trip details to plan, return "
            '{"days": [], "destination": "", "sources": []}.'
        )
    else:
        instruction = (
            "Bạn là trợ lý lập kế hoạch du lịch Việt Nam. Dựa trên cuộc trò chuyện dưới "
            "đây, hãy xây dựng lịch trình chi tiết theo từng ngày. Dùng công cụ tìm kiếm "
            "web để lấy thông tin chính xác, mới nhất (giá cả, giờ mở cửa, di chuyển, thời "
            "tiết). Chỉ trả về JSON hợp lệ đúng schema sau:\n"
            '{"days": [{"day": <số>, "title": "<chuỗi>", "budget": "<chuỗi>", '
            '"stops": [{"name": "<chuỗi>", "note": "<chuỗi>"}]}], '
            '"destination": "<chuỗi>", '
            '"sources": [{"title": "<chuỗi>", "url": "<chuỗi>"}]}\n'
            '"sources" là danh sách các nguồn web bạn đã thực sự tra cứu (tối đa 5 nguồn, '
            'kèm URL thật). Nếu không tra cứu được nguồn nào, trả về mảng rỗng.\n'
            "Nếu cuộc trò chuyện chưa đủ thông tin để lập lịch trình, trả về "
            '{"days": [], "destination": "", "sources": []}.'
        )
    return f"{instruction}\n\n[CONVERSATION]\n{convo}"


def _stub_itinerary(history: list[dict] | None, lang: str) -> dict:
    return {"itinerary": {"days": [], "destination": ""}, "citations": []}


def _build_prompt(
    query: str, context: str, lang: str, history: list[dict] | None = None
) -> str:
    instruction = (
        "You are a Vietnam travel planning assistant. Use the internal context when "
        "relevant, and use the web search tool to fetch up-to-date information when "
        "needed (weather, prices, opening hours, current events). Always cite the "
        "sources you used."
        if lang == "en"
        else "Bạn là trợ lý lập kế hoạch du lịch Việt Nam. Dùng ngữ cảnh nội bộ khi phù hợp, "
        "và dùng công cụ tìm kiếm web để lấy thông tin mới nhất khi cần (thời tiết, giá cả, "
        "giờ mở cửa, sự kiện hiện tại). Luôn trích dẫn nguồn đã tra cứu."
    )
    prompt = f"{instruction}\n\n[CONTEXT]\n{context}"
    if history:
        lines = ["[CONVERSATION]"]
        for turn in history:
            role = turn.get("role", "user")
            content = turn.get("content", "")
            lines.append(f"{role}: {content}")
        prompt += "\n\n" + "\n".join(lines)
    prompt += f"\n\n[QUESTION]\n{query}"
    return prompt
