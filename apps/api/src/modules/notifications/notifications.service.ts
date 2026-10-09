import { ObjectId, type Document } from 'mongodb';
import { getDb } from '../../db/mongo.js';
import { emitNotification, emitNotificationRead } from '../../realtime/emitter.js';
import { logger } from '../../logger.js';

/**
 * Grouped, per-recipient notifications.
 *
 * A row is keyed `(userId, type, entityId)` and UPSERTED, so twenty people
 * reacting to one post produce one row that reads "A and 19 others", exactly
 * like Facebook — not twenty rows. The unique index on that triple is what makes
 * the upsert safe against concurrent double-taps (same reasoning as
 * `reactions.service.ts`).
 */
export const NOTIFICATION_TYPES = [
  'post_reaction',
  'comment_reaction',
  'post_comment',
  'comment_reply',
  'follow',
] as const;

export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

/** Avatars shown on a grouped row. `actorCount` carries the true total. */
const MAX_ACTORS = 4;

export interface NotificationActor {
  _id: string;
  displayName: string;
  handle: string;
  avatarUrl: string | null;
  accountType: string;
}

export interface NotificationView {
  _id: string;
  type: NotificationType;
  actors: NotificationActor[];
  actorCount: number;
  postId: string | null;
  commentId: string | null;
  readAt: string | null;
  createdAt: string;
  updatedAt: string;
}

const ACTOR_PROJECTION = { displayName: 1, handle: 1, avatarUrl: 1, accountType: 1 };

function mapActor(raw: unknown): NotificationActor | null {
  const u = (raw ?? {}) as {
    _id?: ObjectId;
    displayName?: string;
    handle?: string;
    avatarUrl?: string;
    accountType?: string;
  };
  if (!u._id) return null;
  return {
    _id: u._id.toString(),
    displayName: u.displayName ?? 'Người dùng',
    handle: u.handle ?? '',
    avatarUrl: u.avatarUrl ?? null,
    accountType: u.accountType ?? 'traveler',
  };
}

function clampInt(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? Math.trunc(n) : 0;
}

function oidOrNull(v: unknown): string | null {
  return v instanceof ObjectId ? v.toHexString() : null;
}

function iso(v: unknown): string | null {
  return v instanceof Date ? v.toISOString() : null;
}

/**
 * Row → wire shape. `actors` arrives pre-hydrated by `hydrateActors`, keeping the
 * per-row user lookups out of this function.
 */
function toView(row: Document, actors: NotificationActor[]): NotificationView {
  return {
    _id: (row._id as ObjectId).toHexString(),
    type: row.type as NotificationType,
    actors,
    actorCount: Math.max(clampInt(row.actorCount), actors.length),
    postId: oidOrNull(row.postId),
    commentId: oidOrNull(row.commentId),
    readAt: iso(row.readAt),
    createdAt: iso(row.createdAt) ?? new Date(0).toISOString(),
    updatedAt: iso(row.updatedAt) ?? iso(row.createdAt) ?? new Date(0).toISOString(),
  };
}

/**
 * One `$in` for every actor across every row, then a local join — never a lookup
 * per row. A page of 20 grouped rows can reference 80 actors and this stays at
 * one query.
 */
async function hydrateActors(rows: Document[]): Promise<Map<string, NotificationActor>> {
  const ids = new Set<string>();
  for (const row of rows) {
    for (const a of (row.actorIds as ObjectId[] | undefined) ?? []) ids.add(a.toHexString());
  }
  if (ids.size === 0) return new Map();

  const users = await getDb()
    .collection('users')
    .find(
      { _id: { $in: Array.from(ids, (id) => new ObjectId(id)) } },
      { projection: ACTOR_PROJECTION },
    )
    .toArray();

  const map = new Map<string, NotificationActor>();
  for (const u of users) {
    const actor = mapActor(u);
    if (actor) map.set(actor._id, actor);
  }
  return map;
}

function rowActors(row: Document, byId: Map<string, NotificationActor>): NotificationActor[] {
  const out: NotificationActor[] = [];
  for (const a of (row.actorIds as ObjectId[] | undefined) ?? []) {
    // A deleted user drops out rather than rendering a ghost row.
    const actor = byId.get(a.toHexString());
    if (actor) out.push(actor);
  }
  return out;
}

export interface NotifyInput {
  /** Recipient. */
  userId: ObjectId;
  actorId: ObjectId;
  type: NotificationType;
  /** Grouping key: postId for post-level rows, commentId for comment-level ones. */
  entityId: ObjectId;
  postId?: ObjectId | null;
  commentId?: ObjectId | null;
}

/**
 * Create or bump one grouped notification, then push it over the recipient's
 * socket.
 *
 * NEVER throws. Every caller invokes this after its own transaction has
 * committed, so a notification failure must not fail — or worse, roll back — an
 * action the user already completed. Failures are logged and swallowed.
 *
 * Self-actions are dropped here rather than at each call site: `setReaction` and
 * `createComment` have no self-guard of their own (only follow and messages do),
 * so centralising it is the only way to be sure all five sources agree.
 */
export async function notify(input: NotifyInput): Promise<void> {
  try {
    if (input.userId.equals(input.actorId)) return;

    const db = getDb();
    const now = new Date();
    const key = { userId: input.userId, type: input.type, entityId: input.entityId };

    // Drop the actor from the list first so a repeat actor moves to the front
    // instead of appearing twice. `$pull` and `$push` on one field cannot share
    // one update document, hence two calls.
    //
    // `modifiedCount` doubles as "was this actor already here?", which is what
    // decides whether `actorCount` grows. It is a heuristic, not a truth: an actor
    // who fell off the far end of the `$slice` cap reads as new and inflates the
    // count. Tolerated — the count is display text ("A and 3 others"), and the
    // alternative is an unbounded actor array on a hot row.
    const pulled = await db
      .collection('notifications')
      .updateOne(key, { $pull: { actorIds: input.actorId } } as Document);
    const isNewActor = pulled.modifiedCount === 0;

    const row = await db.collection('notifications').findOneAndUpdate(
      key,
      {
        // Newest actor first, capped: an old row must not grow without bound.
        $push: {
          actorIds: { $each: [input.actorId], $position: 0, $slice: MAX_ACTORS },
        },
        // Any new activity makes the row unread again, which is what surfaces it
        // in the bell badge a second time.
        $set: {
          readAt: null,
          updatedAt: now,
          postId: input.postId ?? null,
          commentId: input.commentId ?? null,
        },
        // Only a distinct actor increases the total; a re-reaction must not.
        ...(isNewActor ? { $inc: { actorCount: 1 } } : {}),
        $setOnInsert: { createdAt: now },
      } as Document,
      { upsert: true, returnDocument: 'after' },
    );
    // Driver v6: findOneAndUpdate resolves to the document itself, no `.value`.
    if (!row) return;

    const byId = await hydrateActors([row]);
    const view = toView(row, rowActors(row, byId));
    const unreadCount = await countUnread(input.userId);

    emitNotification(input.userId.toHexString(), view, unreadCount);
  } catch (err) {
    logger.warn({ err, type: input.type }, 'failed to record notification');
  }
}

/** The bell badge. Computed per request, matching the repo's counter convention. */
export async function countUnread(userId: ObjectId): Promise<number> {
  return getDb().collection('notifications').countDocuments({ userId, readAt: null });
}

/** `<updatedAtMs>_<id>` — `updatedAt` alone is not unique across a bump storm. */
function parseCursor(raw: string | undefined): { at: Date; id: ObjectId } | null {
  if (!raw) return null;
  const [ms, id] = raw.split('_');
  if (!/^\d+$/.test(ms ?? '') || !/^[0-9a-fA-F]{24}$/.test(id ?? '')) return null;
  return { at: new Date(Number(ms)), id: new ObjectId(id) };
}

export async function listNotifications(
  userId: ObjectId,
  opts: { limit: number; before?: string; unreadOnly?: boolean },
): Promise<{ items: NotificationView[]; nextCursor: string | null; unreadCount: number }> {
  const db = getDb();
  const limit = Math.min(Math.max(Math.trunc(opts.limit) || 20, 1), 50);

  const filter: Document = { userId };
  if (opts.unreadOnly) filter.readAt = null;

  // Sorted by `updatedAt` so a bumped row returns to the top. The cursor is
  // therefore only as stable as the sort key: a row bumped mid-pagination can
  // move above the cursor and be missed. Acceptable for a notification feed, and
  // the client re-fetches page 1 on every socket push anyway.
  const cursor = parseCursor(opts.before);
  if (cursor) {
    filter.$or = [
      { updatedAt: { $lt: cursor.at } },
      { updatedAt: cursor.at, _id: { $lt: cursor.id } },
    ];
  }

  const rows = await db
    .collection('notifications')
    .find(filter)
    .sort({ updatedAt: -1, _id: -1 })
    // One extra row decides `nextCursor` without a second count query.
    .limit(limit + 1)
    .toArray();

  const page = rows.slice(0, limit);
  const byId = await hydrateActors(page);
  const last = page[page.length - 1];

  return {
    items: page.map((row) => toView(row, rowActors(row, byId))),
    nextCursor:
      rows.length > limit && last
        ? `${(last.updatedAt as Date).getTime()}_${(last._id as ObjectId).toHexString()}`
        : null,
    unreadCount: await countUnread(userId),
  };
}

/**
 * Mark one row read. Scoped by `userId` in the filter, so a guessed id belonging
 * to somebody else is a no-op rather than a leak — and the 404 is indistinguishable
 * from "does not exist", which is the point.
 */
export async function markRead(
  userId: ObjectId,
  notificationId: ObjectId,
): Promise<{ ok: true; unreadCount: number }> {
  await getDb()
    .collection('notifications')
    .updateOne({ _id: notificationId, userId, readAt: null }, { $set: { readAt: new Date() } });

  const unreadCount = await countUnread(userId);
  // Keeps a second tab's badge honest.
  emitNotificationRead(userId.toHexString(), unreadCount);
  return { ok: true, unreadCount };
}

export async function markAllRead(userId: ObjectId): Promise<{ ok: true; unreadCount: number }> {
  await getDb()
    .collection('notifications')
    .updateMany({ userId, readAt: null }, { $set: { readAt: new Date() } });

  emitNotificationRead(userId.toHexString(), 0);
  return { ok: true, unreadCount: 0 };
}
