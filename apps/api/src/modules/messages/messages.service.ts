import { ObjectId } from 'mongodb';
import { getDb } from '../../db/mongo.js';
import { ApiError } from '../../lib/http.js';
import { getIO } from '../../realtime/index.js';
import { fetch } from 'undici';
import dns from 'node:dns/promises';
import net from 'node:net';

export async function listConversations(userId: string) {
  const db = getDb();
  const items = await db
    .collection('conversations')
    .aggregate([
      { $match: { participantIds: new ObjectId(userId) } },
      { $sort: { lastMessageAt: -1 } },
      {
        $lookup: {
          from: 'users',
          localField: 'participantIds',
          foreignField: '_id',
          as: 'participants',
        },
      },
      {
        $project: {
          _id: 1,
          participantIds: 1,
          lastMessage: 1,
          lastMessageAt: 1,
          seqCounter: 1,
          createdAt: 1,
          updatedAt: 1,
          participants: {
            $map: {
              input: '$participants',
              as: 'p',
              in: {
                _id: '$$p._id',
                displayName: '$$p.displayName',
                handle: '$$p.handle',
                avatarUrl: '$$p.avatarUrl',
                accountType: '$$p.accountType',
              },
            },
          },
        },
      },
    ])
    .toArray();
  return { items };
}

export async function getConversation(id: string, userId: string) {
  const db = getDb();
  if (!ObjectId.isValid(id)) throw new ApiError(400, 'bad_id', 'Invalid conversation id');
  const conv = await db.collection('conversations').findOne({
    _id: new ObjectId(id),
    participantIds: new ObjectId(userId),
  });
  if (!conv) throw new ApiError(404, 'not_found', 'Conversation not found');
  return conv;
}

export async function listMessages(conversationId: string, userId: string) {
  const db = getDb();
  if (!ObjectId.isValid(conversationId)) throw new ApiError(400, 'bad_id', 'Invalid conversation id');
  const conv = await db.collection('conversations').findOne({
    _id: new ObjectId(conversationId),
    participantIds: new ObjectId(userId),
  });
  if (!conv) throw new ApiError(404, 'not_found', 'Conversation not found');
  const items = await db
    .collection('messages')
    .find({ conversationId: new ObjectId(conversationId) })
    .sort({ seq: 1 })
    .toArray();
  return { items };
}

export interface MessageAttachment {
  url: string;
  name: string;
  size: number;
  mimeType: string;
}

export interface LinkPreview {
  url: string;
  title: string;
  description?: string;
  image?: string | null;
}

export async function sendMessage(
  conversationId: string,
  userId: string,
  body: string,
  opts: { type?: string; attachments?: MessageAttachment[]; linkPreview?: LinkPreview } = {},
) {
  const db = getDb();
  if (!ObjectId.isValid(conversationId)) throw new ApiError(400, 'bad_id', 'Invalid conversation id');
  const conv = await db.collection('conversations').findOne({
    _id: new ObjectId(conversationId),
    participantIds: new ObjectId(userId),
  });
  if (!conv) throw new ApiError(404, 'not_found', 'Conversation not found');

  const type = opts.type ?? 'text';
  const attachments = opts.attachments ?? [];
  const linkPreview = opts.linkPreview ?? null;

  const now = new Date();
  const seq = (conv.seqCounter ?? 0) + 1;
  const message = {
    conversationId: new ObjectId(conversationId),
    senderId: new ObjectId(userId),
    body,
    type,
    attachments,
    linkPreview,
    seq,
    createdAt: now,
  };
  const insertResult = await db.collection('messages').insertOne(message);
  await db.collection('conversations').updateOne(
    { _id: new ObjectId(conversationId) },
    {
      $set: {
        lastMessage: body || (type === 'image' ? '[Ảnh]' : type === 'file' ? '[Tệp]' : '[Liên kết]'),
        lastMessageAt: now,
        seqCounter: seq,
        updatedAt: now,
      },
    },
  );

  // Push real-time to both participants (sender + recipient).
  const payload = {
    _id: insertResult.insertedId,
    conversationId,
    senderId: userId,
    body,
    type,
    attachments,
    linkPreview,
    seq,
    createdAt: now.toISOString(),
  };
  for (const pid of conv.participantIds) {
    getIO().to(`user:${pid.toString()}`).emit('message:new', payload);
  }
  getIO().to(`conv:${conversationId}`).emit('message:new', payload);

  // Include _id so the sender's optimistic append and the socket event share
  // the same identity — otherwise the client dedup (by _id) fails and the
  // message renders twice.
  return { _id: insertResult.insertedId, ...message };
}

const META_TAG_RE = /<meta[^>]+(?:property|name)=["'](og:title|og:description|og:image|og:url|twitter:title|twitter:description|twitter:image|description)["'][^>]*>/gi;

function extractMeta(html: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const m of html.matchAll(META_TAG_RE)) {
    const tag = m[0];
    const keyMatch = tag.match(/(?:property|name)=["']([^"']+)["']/i);
    const contentMatch = tag.match(/content=["']([^"']*)["']/i);
    if (!keyMatch || !contentMatch) continue;
    const key = keyMatch[1].toLowerCase();
    const value = contentMatch[1].trim();
    if (value && !out[key]) out[key] = value;
  }
  return out;
}

function resolveUrl(base: string, maybe: string | undefined): string | undefined {
  if (!maybe) return undefined;
  try {
    return new URL(maybe, base).toString();
  } catch {
    return undefined;
  }
}

const MAX_HTML_BYTES = 300_000;
const MAX_REDIRECTS = 3;

/** True for loopback, private, link-local and CGNAT space. */
function isBlockedIp(ip: string): boolean {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split('.').map(Number);
    if (a === 0 || a === 10 || a === 127) return true;
    if (a === 169 && b === 254) return true; // link-local incl. cloud metadata
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && (b === 168 || b === 0)) return true;
    if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
    return a >= 224; // multicast / reserved
  }
  const low = ip.toLowerCase();
  const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(low);
  if (mapped) return isBlockedIp(mapped[1]);
  if (low === '::' || low === '::1') return true;
  return /^(fe80|fc|fd)/.test(low);
}

/**
 * Rejects hosts that resolve into the Docker network or cloud metadata. Must run
 * before every hop: a public host can 30x us straight at mongodb:27017.
 */
async function assertPublicHost(hostname: string) {
  const host = hostname.replace(/^\[|\]$/g, '');
  if (net.isIP(host)) {
    if (isBlockedIp(host)) {
      throw new ApiError(400, 'blocked_host', 'URL points to a non-public address');
    }
    return;
  }
  let records: Array<{ address: string }>;
  try {
    records = await dns.lookup(host, { all: true });
  } catch {
    throw new ApiError(400, 'bad_url', 'Could not resolve host');
  }
  if (records.length === 0 || records.some((r) => isBlockedIp(r.address))) {
    throw new ApiError(400, 'blocked_host', 'URL points to a non-public address');
  }
}

/** Streams at most MAX_HTML_BYTES so a huge body can't exhaust the container. */
async function readCapped(body: ReadableStream<Uint8Array> | null): Promise<string> {
  if (!body) return '';
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let out = '';
  let seen = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;
      const room = MAX_HTML_BYTES - seen;
      if (value.byteLength >= room) {
        out += decoder.decode(value.subarray(0, room));
        break;
      }
      seen += value.byteLength;
      out += decoder.decode(value, { stream: true });
    }
  } finally {
    void reader.cancel().catch(() => {});
  }
  return out;
}

export async function getLinkPreview(rawUrl: string) {
  let target: URL;
  try {
    target = new URL(rawUrl);
  } catch {
    throw new ApiError(400, 'bad_url', 'Invalid URL');
  }
  if (!['http:', 'https:'].includes(target.protocol)) {
    throw new ApiError(400, 'bad_url', 'Only http/https URLs are supported');
  }

  let html = '';
  for (let hop = 0; ; hop++) {
    if (hop > MAX_REDIRECTS) throw new ApiError(502, 'too_many_redirects', 'Too many redirects');
    await assertPublicHost(target.hostname);

    const res = await fetch(target.toString(), {
      redirect: 'manual',
      headers: {
        'user-agent':
          'Mozilla/5.0 (compatible; TravelVietPlanerBot/1.0; +https://waki.autos)',
        accept: 'text/html,application/xhtml+xml',
      },
      signal: AbortSignal.timeout(6000),
    });

    if (res.status >= 300 && res.status < 400) {
      const location = res.headers.get('location');
      void res.body?.cancel().catch(() => {});
      if (!location) throw new ApiError(502, 'fetch_failed', 'Redirect without a location');
      let next: URL;
      try {
        next = new URL(location, target);
      } catch {
        throw new ApiError(502, 'fetch_failed', 'Invalid redirect target');
      }
      if (!['http:', 'https:'].includes(next.protocol)) {
        throw new ApiError(400, 'bad_url', 'Redirect left http/https');
      }
      target = next;
      continue;
    }

    if (!res.ok) throw new ApiError(502, 'fetch_failed', `Failed to fetch URL (${res.status})`);
    if (!(res.headers.get('content-type') ?? '').includes('text/html')) {
      void res.body?.cancel().catch(() => {});
      throw new ApiError(422, 'not_html', 'URL does not point to an HTML page');
    }
    html = await readCapped(res.body as ReadableStream<Uint8Array> | null);
    break;
  }

  const meta = extractMeta(html);
  const title =
    meta['og:title'] ||
    meta['twitter:title'] ||
    html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1]?.trim() ||
    target.hostname;
  const description =
    meta['og:description'] || meta['twitter:description'] || meta['description'] || '';
  const image = resolveUrl(target.toString(), meta['og:image'] || meta['twitter:image']);

  return {
    url: target.toString(),
    title: title.slice(0, 200),
    description: description.slice(0, 300),
    image: image && /^https?:\/\//i.test(image) ? image : null,
  };
}

export async function createConversation(userId: string, otherUserId: string) {
  const db = getDb();
  if (!ObjectId.isValid(otherUserId)) throw new ApiError(400, 'bad_id', 'Invalid user id');
  const me = new ObjectId(userId);
  const other = new ObjectId(otherUserId);
  if (me.equals(other)) throw new ApiError(400, 'bad_request', 'Cannot message yourself');

  const existing = await db.collection('conversations').findOne({
    participantIds: { $all: [me, other], $size: 2 },
  });
  if (existing) return existing;

  const now = new Date();
  const conv = {
    participantIds: [me, other],
    lastMessage: null,
    lastMessageAt: now,
    seqCounter: 0,
    createdAt: now,
    updatedAt: now,
  };
  const r = await db.collection('conversations').insertOne(conv);
  return { _id: r.insertedId, ...conv };
}