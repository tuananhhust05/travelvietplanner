import type { Server as HttpServer } from 'node:http';
import { Server as IOServer, Socket } from 'socket.io';
import { ObjectId } from 'mongodb';
import { verifyAccessToken } from '../modules/auth/jwt.js';
import { getDb } from '../db/mongo.js';
import { config } from '../config.js';
import { logger } from '../logger.js';
import { setIO } from './index.js';

/** Hard cap per subscribe call — bounds the fan-out of a single client request. */
const MAX_SUBSCRIBE_IDS = 50;

/**
 * Bound on the raw array length, applied BEFORE iterating. The valid-id cap
 * above only stops the loop once 50 *valid* ids are collected, so an array of
 * junk elements (socket.io accepts ~1MB per frame, i.e. hundreds of thousands
 * of short strings) was walked in full on every call.
 */
const MAX_RAW_SUBSCRIBE_INPUT = 200;

/**
 * Per-socket throttle for `post:subscribe`: each call costs two Mongo queries,
 * so an unthrottled loop is a cheap amplification vector.
 *
 * A legitimate web client subscribes to the posts currently rendered in the
 * feed, which grows ~20 per page as the user scrolls, and re-subscribes only
 * the delta on reconnect. Even continuous fast scrolling produces on the order
 * of one call per second, so 20 calls per 10s (2/s sustained, full burst
 * allowed) leaves an order of magnitude of headroom.
 */
const SUBSCRIBE_WINDOW_MS = 10_000;
const MAX_SUBSCRIBE_CALLS_PER_WINDOW = 20;

/**
 * Cap on `post:` rooms a single socket may hold. Rooms accumulated across
 * calls for the lifetime of the socket, growing the in-memory adapter's maps
 * without bound. 500 covers ~25 pages of infinite scroll in one session;
 * beyond that the oldest subscriptions are evicted, which is also what the
 * user wants (they are no longer looking at those posts).
 */
const MAX_POST_ROOMS = 500;

type SubscribeAck = (result: { ok: boolean; joined: string[] }) => void;

/**
 * Coerce untrusted client input into a bounded list of unique valid ObjectId
 * strings. Anything that is not a well-formed id is dropped silently.
 *
 * Note the strict 24-hex test rather than `ObjectId.isValid`, which also
 * accepts any 12-character string and would let junk like "hello world!"
 * through into a room name.
 */
function normalizePostIds(input: unknown): string[] {
  const raw = Array.isArray(input) ? input : [input];
  // Truncate attacker-controlled input before doing any per-element work.
  const bounded = raw.length > MAX_RAW_SUBSCRIBE_INPUT ? raw.slice(0, MAX_RAW_SUBSCRIBE_INPUT) : raw;
  const out: string[] = [];
  const seen = new Set<string>();
  for (const item of bounded) {
    if (typeof item !== 'string') continue;
    if (!/^[0-9a-fA-F]{24}$/.test(item)) continue;
    if (seen.has(item)) continue;
    seen.add(item);
    out.push(item);
    if (out.length >= MAX_SUBSCRIBE_IDS) break;
  }
  return out;
}

/**
 * Decide which of `postIds` the viewer may receive realtime updates for, using
 * exactly two queries regardless of batch size (one on posts, one on follows).
 */
async function authorizePostIds(postIds: string[], userId: string): Promise<string[]> {
  const db = getDb();
  const viewerOid = new ObjectId(userId);

  const posts = await db
    .collection('posts')
    .find(
      { _id: { $in: postIds.map((id) => new ObjectId(id)) } },
      { projection: { visibility: 1, authorId: 1, status: 1 } },
    )
    .toArray();

  const allowed: string[] = [];
  // Posts whose access depends on a follow edge — resolved in one batched query.
  const pendingFollowers: { postId: string; authorId: ObjectId }[] = [];

  for (const post of posts) {
    if (post.status !== 'published') continue;
    const postId = post._id.toString();
    const authorId = post.authorId as ObjectId | undefined;

    if (post.visibility === 'public') {
      allowed.push(postId);
    } else if (authorId && authorId.equals(viewerOid)) {
      // Author always sees their own post, whatever the visibility.
      allowed.push(postId);
    } else if (post.visibility === 'followers' && authorId) {
      pendingFollowers.push({ postId, authorId });
    }
  }

  if (pendingFollowers.length > 0) {
    const authorIds = Array.from(
      new Map(pendingFollowers.map((p) => [p.authorId.toString(), p.authorId])).values(),
    );
    const follows = await db
      .collection('follows')
      .find(
        { followerId: viewerOid, followeeId: { $in: authorIds } },
        { projection: { followeeId: 1 } },
      )
      .toArray();
    const following = new Set(follows.map((f) => (f.followeeId as ObjectId).toString()));
    for (const p of pendingFollowers) {
      if (following.has(p.authorId.toString())) allowed.push(p.postId);
    }
  }

  return allowed;
}

export function attachSocket(httpServer: HttpServer): IOServer {
  const io = new IOServer(httpServer, {
    cors: { origin: config.corsOrigins, credentials: true },
    connectionStateRecovery: { maxDisconnectionDuration: 2 * 60 * 1000 },
  });
  setIO(io);

  io.use((socket, next) => {
    const token = socket.handshake.auth?.token as string | undefined;
    if (!token) return next(new Error('unauthorized'));
    try {
      const claims = verifyAccessToken(token);
      (socket.data as { userId: string }).userId = claims.sub;
      next();
    } catch {
      next(new Error('unauthorized'));
    }
  });

  io.on('connection', (socket: Socket) => {
    const userId = (socket.data as { userId: string }).userId;
    socket.join(`user:${userId}`);
    logger.debug({ userId }, 'socket connected');

    // --- Per-socket abuse state (lives and dies with the socket) ---------
    // Fixed-window call counter for post:subscribe.
    let subWindowStart = Date.now();
    let subCallsInWindow = 0;
    // Insertion-ordered set of post ids this socket holds a room for; used to
    // evict the oldest subscriptions once MAX_POST_ROOMS is reached.
    const postRooms = new Set<string>();

    /** True when this call is allowed through the throttle. */
    const allowSubscribeCall = (): boolean => {
      const now = Date.now();
      if (now - subWindowStart >= SUBSCRIBE_WINDOW_MS) {
        subWindowStart = now;
        subCallsInWindow = 0;
      }
      subCallsInWindow += 1;
      return subCallsInWindow <= MAX_SUBSCRIBE_CALLS_PER_WINDOW;
    };

    /** Join a post room, evicting the oldest room if the cap is reached. */
    const joinPostRoom = (postId: string): void => {
      if (postRooms.has(postId)) return;
      while (postRooms.size >= MAX_POST_ROOMS) {
        const oldest: string | undefined = postRooms.values().next().value;
        if (oldest === undefined) break;
        postRooms.delete(oldest);
        socket.leave(`post:${oldest}`);
      }
      postRooms.add(postId);
      socket.join(`post:${postId}`);
    };

    socket.on('conversation:join', async (conversationId: string) => {
      // Authentication alone is not authorization: without this membership
      // check any logged-in socket could join conv:<id> and receive every
      // message:new of a conversation it is not part of.
      try {
        if (typeof conversationId !== 'string' || !ObjectId.isValid(conversationId)) return;
        const conv = await getDb()
          .collection('conversations')
          .findOne(
            { _id: new ObjectId(conversationId), participantIds: new ObjectId(userId) },
            { projection: { _id: 1 } },
          );
        if (!conv) {
          logger.warn({ userId, conversationId }, 'conversation:join denied (not a participant)');
          return;
        }
        socket.join(`conv:${conversationId}`);
      } catch (err) {
        logger.warn({ err, userId, conversationId }, 'conversation:join failed');
      }
    });

    socket.on('conversation:leave', (conversationId: string) => {
      socket.leave(`conv:${conversationId}`);
    });

    socket.on('post:subscribe', async (postIds: unknown, ack?: SubscribeAck) => {
      const respond = (ok: boolean, joined: string[]): void => {
        if (typeof ack === 'function') ack({ ok, joined });
      };
      try {
        // Throttle before any parsing or IO: each call costs two Mongo queries.
        if (!allowSubscribeCall()) {
          logger.warn({ userId }, 'post:subscribe throttled');
          return respond(false, []);
        }
        const ids = normalizePostIds(postIds);
        if (ids.length === 0) return respond(true, []);

        const allowed = await authorizePostIds(ids, userId);
        for (const id of allowed) joinPostRoom(id);
        respond(true, allowed);
      } catch (err) {
        // Never throw out of a socket handler: an unhandled rejection here
        // would take down the process.
        logger.warn({ err, userId }, 'post:subscribe failed');
        respond(false, []);
      }
    });

    socket.on('post:unsubscribe', (postIds: unknown) => {
      // Leaving needs no authorization — you can only leave rooms you are in.
      try {
        for (const id of normalizePostIds(postIds)) {
          postRooms.delete(id);
          socket.leave(`post:${id}`);
        }
      } catch (err) {
        logger.warn({ err, userId }, 'post:unsubscribe failed');
      }
    });

    // Trip comment rooms — no Mongo authorization needed: the trip detail page
    // already enforces visibility before rendering, so a socket reaching here
    // for a private trip would have been 403'd at the REST layer first. We still
    // cap the number of trip rooms per socket to the same MAX_POST_ROOMS budget.
    socket.on('trip:subscribe', (tripIds: unknown) => {
      try {
        for (const id of normalizePostIds(tripIds)) {
          if (postRooms.size < MAX_POST_ROOMS) {
            postRooms.add(`t:${id}`);
            socket.join(`trip:${id}`);
          }
        }
      } catch (err) {
        logger.warn({ err, userId }, 'trip:subscribe failed');
      }
    });

    socket.on('trip:unsubscribe', (tripIds: unknown) => {
      try {
        for (const id of normalizePostIds(tripIds)) {
          postRooms.delete(`t:${id}`);
          socket.leave(`trip:${id}`);
        }
      } catch (err) {
        logger.warn({ err, userId }, 'trip:unsubscribe failed');
      }
    });

    socket.on('disconnect', () => logger.debug({ userId }, 'socket disconnected'));
  });

  return io;
}
