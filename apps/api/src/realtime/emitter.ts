import { getIO } from './index.js';
import { logger } from '../logger.js';
import type { ReactionCounts } from '../modules/posts/reactions.service.js';

const FLUSH_INTERVAL_MS = 1000;

interface ReactionState {
  counts: ReactionCounts;
  total: number;
}

interface BufferedEmit {
  room: string;
  event: string;
  payload: unknown;
}

/**
 * Coalescing buffer keyed `'<event>:<id>'`. Only put events here whose payload
 * is an ABSOLUTE snapshot. Distinct-content events (comment:new) must NOT go
 * through here — overwriting by key would silently drop one of two comments
 * landing in the same interval.
 */
const buffer = new Map<string, BufferedEmit>();

let timer: NodeJS.Timeout | null = null;
let warnedNoIO = false;

function tryGetIO(context: string, dropped: number): ReturnType<typeof getIO> | null {
  try {
    return getIO();
  } catch {
    if (!warnedNoIO) {
      warnedNoIO = true;
      logger.warn(
        { context, dropped },
        'socket.io not initialized; skipping realtime emits in this process',
      );
    }
    return null;
  }
}

function emitNow(room: string, event: string, payload: unknown): void {
  const io = tryGetIO(event, 1);
  if (!io) return;
  try {
    io.to(room).emit(event, payload);
  } catch (err) {
    logger.warn({ err, room, event }, 'failed to emit realtime event');
  }
}

function flush(): void {
  if (buffer.size === 0) return;
  const pending = Array.from(buffer.values());
  buffer.clear();
  const io = tryGetIO('flush', pending.length);
  if (!io) return;
  for (const { room, event, payload } of pending) {
    try {
      io.to(room).emit(event, payload);
    } catch (err) {
      logger.warn({ err, room, event }, 'failed to emit realtime event');
    }
  }
}

function ensureTimer(): void {
  if (timer) return;
  timer = setInterval(flush, FLUSH_INTERVAL_MS);
  timer.unref();
}

function queue(key: string, emit: BufferedEmit): void {
  buffer.set(key, emit);
  ensureTimer();
}

export function queuePostReactionEmit(postId: string, state: ReactionState): void {
  if (!postId) return;
  queue(`post:reaction:${postId}`, {
    room: `post:${postId}`,
    event: 'post:reaction',
    payload: { postId, counts: state.counts, total: state.total },
  });
}

/**
 * Queue a comment reaction snapshot. Broadcast to the target room.
 * `targetType` is 'post' or 'trip'; the room is `<targetType>:<targetId>`.
 */
export function queueCommentReactionEmit(
  targetType: string,
  targetId: string,
  commentId: string,
  state: ReactionState,
): void {
  if (!targetId || !commentId) return;
  const room = `${targetType}:${targetId}`;
  queue(`comment:reaction:${commentId}`, {
    room,
    event: 'comment:reaction',
    payload: { targetType, targetId, commentId, counts: state.counts, total: state.total },
  });
}

/**
 * Broadcast a newly created comment. UNCOALESCED.
 * Room is `<targetType>:<targetId>` (e.g. `post:<id>` or `trip:<id>`).
 */
export function emitCommentNew(
  targetType: string,
  targetId: string,
  comment: unknown,
  targetCommentCount: number,
): void {
  if (!targetId) return;
  emitNow(`${targetType}:${targetId}`, 'comment:new', {
    targetType,
    targetId,
    comment,
    postCommentCount: targetCommentCount,
  });
}

export function emitNotification(
  userId: string,
  notification: unknown,
  unreadCount: number,
): void {
  if (!userId) return;
  emitNow(`user:${userId}`, 'notification:new', { notification, unreadCount });
}

export function emitNotificationRead(userId: string, unreadCount: number): void {
  if (!userId) return;
  emitNow(`user:${userId}`, 'notification:read', { unreadCount });
}

/**
 * Broadcast a soft-deleted comment. Uncoalesced.
 * Room is `<targetType>:<targetId>`.
 */
export function emitCommentDeleted(
  targetType: string,
  targetId: string,
  commentId: string,
  parentId: string | null | undefined,
  targetCommentCount: number,
): void {
  if (!targetId || !commentId) return;
  emitNow(`${targetType}:${targetId}`, 'comment:deleted', {
    targetType,
    targetId,
    commentId,
    parentId: parentId ?? null,
    postCommentCount: targetCommentCount,
  });
}
