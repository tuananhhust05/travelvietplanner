import { ObjectId, type ClientSession, type Document, type WithId } from 'mongodb';
import { getDb, getMongoClient } from '../../db/mongo.js';
import { ApiError } from '../../lib/http.js';
import { logger } from '../../logger.js';
import { queueCommentReactionEmit, queuePostReactionEmit } from '../../realtime/emitter.js';
import { notify } from '../notifications/notifications.service.js';

export const REACTION_TYPES = ['like', 'love', 'haha', 'wow', 'sad', 'angry'] as const;
export type ReactionType = (typeof REACTION_TYPES)[number];
export type ReactionCounts = Record<ReactionType, number>;
export type ReactionTargetType = 'post' | 'comment';

/** Frozen so a caller cannot mutate the shared default and poison later reads. */
export const EMPTY_COUNTS: ReactionCounts = Object.freeze({
  like: 0,
  love: 0,
  haha: 0,
  wow: 0,
  sad: 0,
  angry: 0,
}) as ReactionCounts;

export interface ReactionState {
  viewerReaction: ReactionType | null;
  counts: ReactionCounts;
  total: number;
}

export interface ReactionListItem {
  _id: string;
  type: ReactionType;
  createdAt: string;
  user: {
    _id: string;
    displayName: string;
    handle?: string;
    avatarUrl?: string;
    accountType: string;
  };
  viewerFollowing: boolean;
  isSelf: boolean;
}

const TARGET_COLLECTION: Record<ReactionTargetType, string> = {
  post: 'posts',
  comment: 'comments',
};

function isReactionType(value: unknown): value is ReactionType {
  return typeof value === 'string' && (REACTION_TYPES as readonly string[]).includes(value);
}

/**
 * The reaction type becomes part of a dotted update path
 * (`counts.reactions.<type>`), so an unvalidated value could write arbitrary
 * nested fields on the target document. Validate even though the route layer
 * already runs a zod enum.
 */
function assertReactionType(type: unknown): ReactionType {
  if (!isReactionType(type)) {
    throw new ApiError(400, 'bad_reaction_type', 'Unknown reaction type');
  }
  return type;
}

function toObjectId(id: string, code = 'bad_id', message = 'Invalid id'): ObjectId {
  if (!ObjectId.isValid(id)) throw new ApiError(400, code, message);
  return new ObjectId(id);
}

function clampInt(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.trunc(value)) : 0;
}

/** Fill in missing keys and clamp negatives — pre-migration docs may lack the shape. */
function normalizeCounts(raw: unknown): ReactionCounts {
  const src = (raw ?? {}) as Record<string, unknown>;
  const out = { ...EMPTY_COUNTS };
  for (const type of REACTION_TYPES) out[type] = clampInt(src[type]);
  return out;
}

function sumCounts(counts: ReactionCounts): number {
  let total = 0;
  for (const type of REACTION_TYPES) total += counts[type];
  return total;
}

function stateFromTarget(doc: WithId<Document> | null): { counts: ReactionCounts; total: number } {
  const raw = (doc?.counts ?? {}) as Record<string, unknown>;
  const counts = normalizeCounts(raw.reactions);
  // `reactionsTotal` is authoritative, but a document that predates the
  // migration may not have it at all — fall back to the per-type sum.
  const total =
    typeof raw.reactionsTotal === 'number' && Number.isFinite(raw.reactionsTotal)
      ? Math.max(0, Math.trunc(raw.reactionsTotal))
      : sumCounts(counts);
  return { counts, total };
}

/**
 * `visibility`/`authorId`/`status` are projected alongside `counts` because
 * every caller has to run the authorization check in
 * `readAuthorizedTarget` — fetching them here keeps it to a single read.
 *
 * `postId` only exists on comments; it is projected here so the comment branch
 * of `readAuthorizedTarget` can resolve the parent post — and so the emit path
 * gets the `post:<id>` room name off the doc it already has, with no extra read.
 */
async function readTargetDoc(
  targetType: ReactionTargetType,
  targetId: ObjectId,
): Promise<WithId<Document> | null> {
  return getDb()
    .collection(TARGET_COLLECTION[targetType])
    .findOne(
      { _id: targetId },
      { projection: { counts: 1, visibility: 1, authorId: 1, status: 1, postId: 1, targetType: 1, targetId: 1 } },
    );
}

/**
 * The single post read gate for the whole API surface: published AND (public OR
 * author OR (followers AND viewer follows author)). Mirrors `authorizePostIds`
 * in `src/realtime/gateway.ts` exactly, so the REST surface and the socket
 * surface can never disagree about who sees a post.
 *
 * Throws 404 rather than returning a boolean, and never 403: a 403 would
 * confirm that an unpublished or followers-only post exists at that id. Callers
 * that only need "may this viewer read it" therefore just `await` this.
 *
 * `postDoc` must carry `status`, `visibility` and `authorId`.
 */
export async function assertPostReadable(
  postDoc: WithId<Document>,
  viewerId: ObjectId | null,
): Promise<void> {
  const notFound = new ApiError(404, 'not_found', 'Target not found');

  // Unpublished is denied to everyone, the author included — this is exactly what
  // `authorizePostIds` does (`if (post.status !== 'published') continue`). Do not
  // "helpfully" let authors react to their own drafts here: the two surfaces would
  // then disagree, and a post the socket refuses to stream would still accept
  // writes over REST.
  if (postDoc.status !== 'published') throw notFound;

  if (postDoc.visibility === 'public') return;

  // Everything below needs an identified viewer; guests stop here.
  if (!viewerId) throw notFound;

  const authorId = postDoc.authorId as ObjectId | undefined;
  // Author always reaches their own post, whatever the visibility.
  if (authorId && authorId.equals(viewerId)) return;

  if (postDoc.visibility === 'followers' && authorId) {
    const follow = await getDb()
      .collection('follows')
      .findOne({ followerId: viewerId, followeeId: authorId }, { projection: { _id: 1 } });
    if (follow) return;
  }

  // Unknown/private visibility values fall through to denial by default.
  throw notFound;
}

/**
 * Single source of truth for "may this viewer touch this target's reactions?".
 * Delegates the post gate to `assertPostReadable` so the REST surface, the
 * socket surface (`authorizePostIds`) and the comment service all run the exact
 * same rule. Denial is always 404, never 403.
 *
 * Comments carry no `visibility` of their own — access derives from the parent
 * post, so the comment branch resolves `comment.postId` and runs the same gate.
 * It returns the COMMENT document, not the post: every caller feeds the result
 * to a `$inc` that must land on the comment.
 */
async function readAuthorizedTarget(
  targetType: ReactionTargetType,
  targetId: ObjectId,
  viewerId: ObjectId | null,
): Promise<WithId<Document>> {
  const notFound = new ApiError(404, 'not_found', 'Target not found');
  const doc = await readTargetDoc(targetType, targetId);
  if (!doc) throw notFound;

  if (targetType === 'comment') {
    // A tombstone renders no reaction bar, so reacting to one is not a thing the
    // UI can do — treat it as absent rather than 403, same as everywhere else.
    if (doc.status === 'deleted') throw notFound;

    // New polymorphic comments use `targetId`; legacy comments fall back to `postId`.
    const commentTargetType = (doc.targetType as string | undefined) ?? 'post';
    const parentId = (doc.targetId as ObjectId | undefined) ?? (doc.postId as ObjectId | undefined);
    if (!parentId) throw notFound;

    if (commentTargetType === 'trip') {
      const trip = await getDb()
        .collection('trips')
        .findOne({ _id: parentId }, { projection: { _id: 1, userId: 1, visibility: 1 } });
      if (!trip) throw notFound;
      if (trip.visibility !== 'public') {
        const ownerId = trip.userId as ObjectId | undefined;
        if (!viewerId || !ownerId || !ownerId.equals(viewerId)) throw notFound;
      }
    } else {
      const post = await getDb()
        .collection('posts')
        .findOne(
          { _id: parentId },
          { projection: { _id: 1, visibility: 1, authorId: 1, status: 1 } },
        );
      if (!post) throw notFound;
      await assertPostReadable(post, viewerId);
    }

    return doc;
  }

  await assertPostReadable(doc, viewerId);
  return doc;
}

/** Duplicate-key detection across the shapes the v6 driver can surface. */
function isDuplicateKeyError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const e = err as {
    code?: unknown;
    message?: unknown;
    errorResponse?: { code?: unknown };
    writeErrors?: unknown;
  };
  if (e.code === 11000) return true;
  if (e.errorResponse && e.errorResponse.code === 11000) return true;
  if (
    Array.isArray(e.writeErrors) &&
    e.writeErrors.some((w) => (w as { code?: unknown } | null)?.code === 11000)
  ) {
    return true;
  }
  return typeof e.message === 'string' && e.message.includes('E11000');
}

/**
 * Realtime is best-effort: getIO() throws when no socket server is attached.
 *
 * Both target types broadcast into the SAME `post:<postId>` room — there are no
 * comment rooms (the gateway caps a socket at 500 rooms with oldest-first
 * eviction, so a long thread would evict the post rooms the feed depends on).
 * `roomPostId` is therefore the comment's parent post id for a comment target,
 * and the target itself for a post. It comes off the doc `readAuthorizedTarget`
 * already fetched, so this costs no extra query.
 */
function emitReactionState(
  targetType: ReactionTargetType,
  targetId: ObjectId,
  state: { counts: ReactionCounts; total: number },
  roomPostId: ObjectId | null,
  commentDoc?: WithId<Document> | null,
): void {
  try {
    if (targetType === 'comment') {
      // No parent target id means no room to broadcast into. Dropping the emit is
      // correct — the REST response still carries the authoritative counts.
      if (!roomPostId) return;
      // `commentDoc` carries `targetType` for new comments; fall back to 'post'
      // for legacy documents created before the polymorphic migration.
      const commentTargetType = (commentDoc as { targetType?: string } | null | undefined)?.targetType ?? 'post';
      queueCommentReactionEmit(commentTargetType, roomPostId.toString(), targetId.toString(), state);
      return;
    }
    queuePostReactionEmit(targetId.toString(), state);
  } catch (err) {
    logger.warn({ err, targetType, targetId: targetId.toString() }, 'reaction emit skipped');
  }
}

/** A comment broadcasts into its parent target's room; a post is its own room key. */
function roomPostIdOf(targetType: ReactionTargetType, doc: WithId<Document>): ObjectId | null {
  if (targetType !== 'comment') return doc._id;
  // New polymorphic comments use `targetId`; legacy comments fall back to `postId`.
  return (doc.targetId as ObjectId | undefined) ?? (doc.postId as ObjectId | undefined) ?? null;
}

export async function setReaction(o: {
  targetType: ReactionTargetType;
  targetId: string;
  userId: string;
  type: ReactionType;
}): Promise<ReactionState> {
  const db = getDb();
  const client = getMongoClient();
  const type = assertReactionType(o.type);
  const targetId = toObjectId(o.targetId, 'bad_id', 'Invalid target id');
  const userId = toObjectId(o.userId, 'bad_id', 'Invalid user id');
  const collName = TARGET_COLLECTION[o.targetType];

  // Authorization, not just existence: reacting mutates denormalized counters on
  // the target, so a viewer who cannot read the post must not be able to write it.
  // For a comment target this returns the COMMENT doc, so the $inc below lands on
  // the comment; its `postId` is what names the broadcast room.
  const target = await readAuthorizedTarget(o.targetType, targetId, userId);
  const roomPostId = roomPostIdOf(o.targetType, target);

  const now = new Date();
  /**
   * Whether this call actually moved anything. Read after the commit to decide
   * whether to notify. Assigned INSIDE the transaction body because both
   * `withTransaction` and the duplicate-key path below can re-run it — the last
   * attempt is the one that committed, so the last write wins.
   */
  let changed = false;
  const applyOnce = async (): Promise<void> => {
    const session: ClientSession = client.startSession();
    try {
      await session.withTransaction(async () => {
        changed = false;
        // Driver v6: findOneAndUpdate resolves to the document itself (or null
        // when the upsert inserted a new one). There is no `.value` wrapper.
        const prev = await db.collection('reactions').findOneAndUpdate(
          { targetType: o.targetType, targetId, userId },
          { $set: { type, updatedAt: now }, $setOnInsert: { createdAt: now } },
          { upsert: true, returnDocument: 'before', session },
        );

        // Same reaction re-sent: the write above was a no-op, counters must not move.
        if (prev && prev.type === type) return;
        changed = true;

        // Invariant: sum(counts.reactions.*) must stay equal to reactionsTotal.
        // We can only decrement an old bucket when the previous type was a real
        // reaction type; a hand-edited garbage type has no bucket to give back,
        // so the total moves with the new bucket instead. Both branches shift
        // sum and total by the same amount.
        const inc: Record<string, number> = { [`counts.reactions.${type}`]: 1 };
        if (prev && isReactionType(prev.type)) {
          inc[`counts.reactions.${prev.type}`] = -1;
        } else {
          if (prev) {
            logger.warn(
              { targetId: targetId.toString(), prevType: prev.type },
              'reaction had an unknown previous type; treating as a fresh reaction for counters',
            );
          }
          inc['counts.reactionsTotal'] = 1;
        }
        await db.collection(collName).updateOne({ _id: targetId }, { $inc: inc }, { session });
      });
    } finally {
      await session.endSession();
    }
  };

  try {
    await applyOnce();
  } catch (err) {
    // A concurrent first-time reaction from the same user (double-tap, two tabs)
    // makes both upserts try to insert, and one loses on the unique index.
    // MongoDB's server-side upsert retry does NOT apply inside a transaction and
    // E11000 is not labelled TransientTransactionError, so withTransaction will
    // not retry it for us. Retrying once is enough: the winner's document is now
    // committed, so the second attempt takes the update path instead of insert.
    if (!isDuplicateKeyError(err)) throw err;
    logger.warn(
      { targetId: targetId.toString(), userId: userId.toString() },
      'reaction upsert hit duplicate key inside transaction; retrying once',
    );
    await applyOnce();
  }

  const state = stateFromTarget(await readTargetDoc(o.targetType, targetId));
  emitReactionState(o.targetType, targetId, state, roomPostId, o.targetType === 'comment' ? target : null);

  // AFTER the commit, and only when something actually moved: re-sending the same
  // reaction must not re-notify. `notify` drops self-actions and swallows its own
  // failures, so neither check nor a try/catch belongs here.
  //
  // Awaited rather than fired-and-forgotten: the row must exist before this
  // request's response reaches the client, or a client that refetches on the
  // response would read a list that does not yet contain it.
  const recipientId = target.authorId as ObjectId | undefined;
  if (changed && recipientId) {
    await notify({
      userId: recipientId,
      actorId: userId,
      type: o.targetType === 'comment' ? 'comment_reaction' : 'post_reaction',
      // Grouping key is the thing reacted to, so all six reaction types on one
      // post collapse into a single row.
      entityId: targetId,
      postId: roomPostId,
      commentId: o.targetType === 'comment' ? targetId : null,
    });
  }

  return { viewerReaction: type, ...state };
}

export async function removeReaction(o: {
  targetType: ReactionTargetType;
  targetId: string;
  userId: string;
}): Promise<ReactionState> {
  const db = getDb();
  const client = getMongoClient();
  const targetId = toObjectId(o.targetId, 'bad_id', 'Invalid target id');
  const userId = toObjectId(o.userId, 'bad_id', 'Invalid user id');
  const collName = TARGET_COLLECTION[o.targetType];

  // Same authorization as the write path above — see readAuthorizedTarget.
  const target = await readAuthorizedTarget(o.targetType, targetId, userId);
  const roomPostId = roomPostIdOf(o.targetType, target);

  let changed = false;
  const session: ClientSession = client.startSession();
  try {
    await session.withTransaction(async () => {
      const prev = await db
        .collection('reactions')
        .findOneAndDelete({ targetType: o.targetType, targetId, userId }, { session });
      // Nothing to remove is a valid no-op, not an error.
      if (!prev) return;

      // Invariant: sum(counts.reactions.*) must stay equal to reactionsTotal.
      // With an unknown stored type there is no bucket to decrement, so
      // decrementing the total alone would push the two apart. Leave both
      // untouched instead: the doc is gone and the counters keep matching.
      if (!isReactionType(prev.type)) {
        logger.warn(
          { targetId: targetId.toString(), prevType: prev.type },
          'removed reaction had an unknown type; counters left untouched to stay consistent',
        );
        return;
      }

      const inc: Record<string, number> = {
        'counts.reactionsTotal': -1,
        [`counts.reactions.${prev.type}`]: -1,
      };
      await db.collection(collName).updateOne({ _id: targetId }, { $inc: inc }, { session });
      changed = true;
    });
  } finally {
    await session.endSession();
  }

  const state = stateFromTarget(await readTargetDoc(o.targetType, targetId));
  if (changed) emitReactionState(o.targetType, targetId, state, roomPostId, o.targetType === 'comment' ? target : null);
  return { viewerReaction: null, ...state };
}

export async function listReactions(o: {
  targetType: ReactionTargetType;
  targetId: string;
  type?: ReactionType;
  limit: number;
  before?: string;
  viewerId?: string;
}): Promise<{
  items: ReactionListItem[];
  nextCursor: string | null;
  counts: ReactionCounts;
  total: number;
}> {
  const db = getDb();
  const targetId = toObjectId(o.targetId, 'bad_id', 'Invalid target id');
  const limit = Number.isFinite(o.limit) ? Math.min(Math.max(Math.trunc(o.limit), 1), 50) : 30;
  const viewerOid = o.viewerId && ObjectId.isValid(o.viewerId) ? new ObjectId(o.viewerId) : null;

  // This route runs under `authenticate(false)`, so `viewerOid` may be null.
  // Without this gate a guest could read the reactor list (displayName, handle,
  // avatarUrl, accountType) of a followers-only post or an unpublished draft,
  // and could distinguish "draft exists" from "no such post" via 404 vs 200.
  const targetDoc = await readAuthorizedTarget(o.targetType, targetId, viewerOid);
  const { counts, total } = stateFromTarget(targetDoc);

  const match: Record<string, unknown> = { targetType: o.targetType, targetId };
  if (isReactionType(o.type)) match.type = o.type;
  if (o.before && ObjectId.isValid(o.before)) match._id = { $lt: new ObjectId(o.before) };

  const pipeline: Document[] = [
    { $match: match },
    { $sort: { _id: -1 } },
    { $limit: limit },
    { $lookup: { from: 'users', localField: 'userId', foreignField: '_id', as: 'user' } },
    { $unwind: { path: '$user', preserveNullAndEmptyArrays: true } },
  ];

  if (viewerOid) {
    pipeline.push({
      $lookup: {
        from: 'follows',
        let: { uid: '$user._id' },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [{ $eq: ['$followerId', viewerOid] }, { $eq: ['$followeeId', '$$uid'] }],
              },
            },
          },
          { $limit: 1 },
          { $project: { _id: 1 } },
        ],
        as: '_f',
      },
    });
  }

  pipeline.push({
    $project: {
      _id: 1,
      type: 1,
      createdAt: 1,
      userId: 1,
      user: {
        _id: '$user._id',
        displayName: '$user.displayName',
        handle: '$user.handle',
        avatarUrl: '$user.avatarUrl',
        accountType: '$user.accountType',
      },
      // A bare `false` in $project means "exclude the field", so wrap it.
      viewerFollowing: viewerOid ? { $gt: [{ $size: '$_f' }, 0] } : { $literal: false },
    },
  });

  const rows = await db.collection('reactions').aggregate(pipeline).toArray();

  const items: ReactionListItem[] = rows.map((r) => {
    const u = (r.user ?? {}) as {
      _id?: ObjectId;
      displayName?: string;
      handle?: string;
      avatarUrl?: string;
      accountType?: string;
    };
    const rid = r._id as ObjectId;
    const uid = (u._id ?? (r.userId as ObjectId | undefined) ?? rid) as ObjectId;
    const uidStr = uid.toString();
    return {
      _id: rid.toString(),
      type: isReactionType(r.type) ? r.type : 'like',
      createdAt: (r.createdAt instanceof Date ? r.createdAt : rid.getTimestamp()).toISOString(),
      user: {
        _id: uidStr,
        displayName: u.displayName ?? 'Người dùng',
        ...(u.handle ? { handle: u.handle } : {}),
        ...(u.avatarUrl ? { avatarUrl: u.avatarUrl } : {}),
        accountType: u.accountType ?? 'traveler',
      },
      viewerFollowing: r.viewerFollowing === true,
      isSelf: viewerOid ? uidStr === viewerOid.toString() : false,
    };
  });

  // A short page means the cursor is exhausted; only hand back a cursor when a
  // full page came out so infinite scroll does not fire a pointless last fetch.
  const nextCursor = items.length === limit ? items[items.length - 1]._id : null;
  return { items, nextCursor, counts, total };
}
