import { Router } from 'express';
import { z } from 'zod';
import { ObjectId } from 'mongodb';
import { request } from 'undici';
import { asyncHandler, ApiError } from '../../lib/http.js';
import { validateBody } from '../../lib/validate.js';
import { authenticate } from '../auth/middleware.js';
import { getDb } from '../../db/mongo.js';
import { checkAndConsumeQuota } from './quota.js';
import { config } from '../../config.js';
import { logger } from '../../logger.js';

const router = Router();

const askSchema = z.object({
  message: z.string().min(1).max(2000),
  conversationId: z.string().nullable().optional(),
  lang: z.enum(['vi', 'en']).optional(),
});

const renameSchema = z.object({
  title: z.string().min(1).max(200),
});

function parseObjectIdParam(raw: string | string[]): ObjectId | null {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (!value || !ObjectId.isValid(value)) return null;
  return new ObjectId(value);
}

router.post(
  '/ask',
  authenticate(),
  validateBody(askSchema),
  asyncHandler(async (req, res) => {
    const userId = req.user!.id;
    const roles = req.user!.roles;
    await checkAndConsumeQuota(userId, roles);

    const db = getDb();
    const now = new Date();
    let conversationId = req.body.conversationId;
    if (!conversationId) {
      const conv = await db.collection('plannerConversations').insertOne({
        userId: new ObjectId(userId),
        title: req.body.message.slice(0, 60),
        createdAt: now,
        updatedAt: now,
      });
      conversationId = conv.insertedId.toString();
    }

    // Load conversation history (last ~20 messages, oldest first) to pass to RAG.
    const historyDocs = await db
      .collection('plannerMessages')
      .find({ conversationId: new ObjectId(conversationId) })
      .sort({ createdAt: 1 })
      .limit(20)
      .toArray();
    const history = historyDocs
      .filter((m) => m.role === 'user' || m.role === 'assistant')
      .map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content as string }));

    await db.collection('plannerMessages').insertOne({
      conversationId: new ObjectId(conversationId),
      role: 'user',
      content: req.body.message,
      createdAt: now,
    });

    // SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.write(`event: meta\ndata: ${JSON.stringify({ conversationId })}\n\n`);

    let assistantText = '';
    let sources: { title: string; url: string }[] = [];
    try {
      const upstream = await request(`${config.ragUrl}/v1/query`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${config.ragServiceToken}`,
        },
        body: JSON.stringify({
          query: req.body.message,
          lang: req.body.lang ?? 'vi',
          conversation_id: conversationId,
          history,
        }),
      });

      if (upstream.statusCode >= 400) {
        res.write(`event: error\ndata: ${JSON.stringify({ code: 'rag_error', retryable: true })}\n\n`);
        res.end();
        return;
      }

      for await (const chunk of upstream.body) {
        const text = chunk.toString();
        const { delta, sources: chunkSources } = extractDeltaAndSources(text);
        assistantText += delta;
        if (chunkSources.length) sources = sources.concat(chunkSources);
        res.write(text); // forward SSE frames verbatim
      }
    } catch (err) {
      logger.error({ err }, 'planner upstream failed');
      res.write(`event: error\ndata: ${JSON.stringify({ code: 'upstream_unavailable', retryable: true })}\n\n`);
    } finally {
      const images = sources.length ? await fetchImages(sources) : [];
      await db.collection('plannerMessages').insertOne({
        conversationId: new ObjectId(conversationId),
        role: 'assistant',
        content: assistantText,
        sources,
        images,
        createdAt: new Date(),
      });
      if (images.length) {
        res.write(`event: images\ndata: ${JSON.stringify({ images })}\n\n`);
      }
      res.write('event: done\ndata: {}\n\n');
      res.end();
    }
  }),
);

const itinerarySchema = z.object({
  conversationId: z.string().min(1),
  lang: z.enum(['vi', 'en']).optional(),
});

router.post(
  '/itinerary',
  authenticate(),
  validateBody(itinerarySchema),
  asyncHandler(async (req, res) => {
    const conversationId = parseObjectIdParam(req.body.conversationId);
    if (!conversationId) throw new ApiError(400, 'invalid_object_id', 'Invalid conversation id');
    const db = getDb();

    const conv = await db.collection('plannerConversations').findOne({
      _id: conversationId,
      userId: new ObjectId(req.user!.id),
    });
    if (!conv) throw new ApiError(404, 'not_found', 'Conversation not found');

    const historyDocs = await db
      .collection('plannerMessages')
      .find({ conversationId })
      .sort({ createdAt: 1 })
      .limit(20)
      .toArray();
    const history = historyDocs
      .filter((m) => m.role === 'user' || m.role === 'assistant')
      .map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content as string }));

    const upstream = await request(`${config.ragUrl}/v1/itinerary`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${config.ragServiceToken}`,
      },
      body: JSON.stringify({
        conversation_id: conversationId,
        lang: req.body.lang ?? 'vi',
        history,
      }),
    });

    if (upstream.statusCode >= 400) {
      throw new ApiError(502, 'rag_error', 'Itinerary service unavailable');
    }
    const body = (await upstream.body.json()) as {
      itinerary?: { days?: unknown[] };
      citations?: { title: string; url: string }[];
    };

    const citationImages = body.citations?.length
      ? await fetchImages(body.citations)
      : [];
    const enrichedCitations = (body.citations ?? []).map((c) => {
      const img = citationImages.find((i) => i.url === c.url);
      return img ? { ...c, imageUrl: img.imageUrl } : c;
    });

    // Cache the generated plan so reopening the conversation restores the canvas
    // without paying for another Gemini call.
    if (Array.isArray(body?.itinerary?.days) && body.itinerary.days.length > 0) {
      await db.collection('plannerConversations').updateOne(
        { _id: conversationId },
        {
          $set: {
            itinerary: body.itinerary,
            itineraryCitations: enrichedCitations,
            itineraryAt: new Date(),
          },
        },
      );
    }
    res.json({ ...body, citations: enrichedCitations });
  }),
);

router.get(
  '/conversations/:id/itinerary',
  authenticate(),
  asyncHandler(async (req, res) => {
    const conversationId = parseObjectIdParam(req.params.id);
    if (!conversationId) throw new ApiError(400, 'invalid_object_id', 'Invalid conversation id');

    const db = getDb();
    const conv = await db.collection('plannerConversations').findOne({
      _id: conversationId,
      userId: new ObjectId(req.user!.id),
    });
    if (!conv) throw new ApiError(404, 'not_found', 'Conversation not found');

    res.json({
      itinerary: conv.itinerary ?? null,
      citations: conv.itineraryCitations ?? [],
    });
  }),
);

router.get(
  '/conversations',
  authenticate(),
  asyncHandler(async (req, res) => {
    const db = getDb();
    const items = await db
      .collection('plannerConversations')
      .find({ userId: new ObjectId(req.user!.id) })
      .sort({ updatedAt: -1 })
      .limit(50)
      .toArray();
    res.json({ items });
  }),
);

router.get(
  '/conversations/:id/messages',
  authenticate(),
  asyncHandler(async (req, res) => {
    const conversationId = parseObjectIdParam(req.params.id);
    if (!conversationId) throw new ApiError(400, 'invalid_object_id', 'Invalid conversation id');

    const db = getDb();
    const conv = await db.collection('plannerConversations').findOne({
      _id: conversationId,
      userId: new ObjectId(req.user!.id),
    });
    if (!conv) throw new ApiError(404, 'not_found', 'Conversation not found');

    const items = await db
      .collection('plannerMessages')
      .find({ conversationId })
      .sort({ createdAt: 1 })
      .toArray();
    res.json({ items });
  }),
);

router.delete(
  '/conversations/:id',
  authenticate(),
  asyncHandler(async (req, res) => {
    const conversationId = parseObjectIdParam(req.params.id);
    if (!conversationId) throw new ApiError(400, 'invalid_object_id', 'Invalid conversation id');

    const db = getDb();
    const conv = await db.collection('plannerConversations').findOne({
      _id: conversationId,
      userId: new ObjectId(req.user!.id),
    });
    if (!conv) throw new ApiError(404, 'not_found', 'Conversation not found');

    await db.collection('plannerConversations').deleteOne({ _id: conversationId });
    await db.collection('plannerMessages').deleteMany({ conversationId });
    res.json({ deleted: true });
  }),
);

router.patch(
  '/conversations/:id',
  authenticate(),
  validateBody(renameSchema),
  asyncHandler(async (req, res) => {
    const conversationId = parseObjectIdParam(req.params.id);
    if (!conversationId) throw new ApiError(400, 'invalid_object_id', 'Invalid conversation id');

    const db = getDb();
    const conv = await db.collection('plannerConversations').findOne({
      _id: conversationId,
      userId: new ObjectId(req.user!.id),
    });
    if (!conv) throw new ApiError(404, 'not_found', 'Conversation not found');

    const updated = await db.collection('plannerConversations').findOneAndUpdate(
      { _id: conversationId },
      { $set: { title: req.body.title, updatedAt: new Date() } },
      { returnDocument: 'after' },
    );
    if (!updated) throw new ApiError(404, 'not_found', 'Conversation not found');
    res.json(updated);
  }),
);

async function fetchOgImage(url: string): Promise<string | null> {
  try {
    const { fetch } = await import('undici');
    const res = await fetch(url, {
      signal: AbortSignal.timeout(3000),
      redirect: 'follow',
      headers: { 'user-agent': 'Mozilla/5.0 (compatible; TravelVietBot/1.0)' },
    });
    if (!res.ok) return null;
    const ct = res.headers.get('content-type') ?? '';
    if (!ct.includes('html')) return null;
    const html = await res.text();
    const m = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i)
      ?? html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i);
    return m?.[1] ?? null;
  } catch {
    return null;
  }
}

async function fetchImages(
  sources: { title: string; url: string }[],
): Promise<{ url: string; imageUrl: string; title: string }[]> {
  const candidates = sources.slice(0, 3);
  const results = await Promise.all(
    candidates.map(async (s) => {
      const imageUrl = await fetchOgImage(s.url);
      return imageUrl ? { url: s.url, imageUrl, title: s.title } : null;
    }),
  );
  return results.filter((r): r is { url: string; imageUrl: string; title: string } => r !== null);
}

function extractDeltaAndSources(sseFrame: string): {
  delta: string;
  sources: { title: string; url: string }[];
} {
  let delta = '';
  let sources: { title: string; url: string }[] = [];
  let inSourcesEvent = false;
  for (const line of sseFrame.split('\n')) {
    if (line.startsWith('event: sources')) {
      inSourcesEvent = true;
      continue;
    }
    if (line.startsWith('event:')) {
      inSourcesEvent = false;
      continue;
    }
    if (line.startsWith('data:')) {
      try {
        const parsed = JSON.parse(line.slice(5).trim());
        if (inSourcesEvent && Array.isArray(parsed?.sources)) {
          sources = parsed.sources;
        } else if (parsed?.delta) {
          delta += parsed.delta;
        }
      } catch {
        /* non-json frame */
      }
    }
  }
  return { delta, sources };
}

export default router;