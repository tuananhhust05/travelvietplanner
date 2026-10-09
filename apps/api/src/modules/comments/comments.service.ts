import { ObjectId, type ClientSession, type Document } from 'mongodb';
import { getDb, getMongoClient } from '../../db/mongo.js';
import { ApiError } from '../../lib/http.js';
import { logger } from '../../logger.js';
import { emitCommentDeleted, emitCommentNew } from '../../realtime/emitter.js';
import { notify } from '../notifications/notifications.service.js';
import {
  EMPTY_COUNTS,
  REACTION_TYPES,
  assertPostReadable,
  type ReactionCounts,
  type ReactionType,
} from '../posts/reactions.service.js';

const MAX_DEPTH = 200;

export type CommentTargetType = 'post' | 'trip';

export interface CommentAttachment {
  kind: 'image' | 'sticker';
  url?: string;
  stickerId?: string;
}

export interface CommentAuthor {
  _id: string;
  displayName: string;
  handle: string;
  avatarUrl: string | null;
  accountType: string;
}

export interface CommentView {
  _id: string;
  targetType: CommentTargetType;
  targetId: string;
  /** @deprecated wire compat — equals targetId when targetType==='post' */
  postId: string;
  parentId: string | null;
  rootId: string;
  depth: number;
  body: string;
  attachments: CommentAttachment[];
  status: 'visible' | 'deleted';
  createdAt: string;
  editedAt: string | null;
  author: CommentAuthor | null;
  reactions: ReactionCounts;
  reactionsTotal: number;
  viewerReaction: ReactionType | null;
  replyCount: number;
  viewerCanDelete: boolean;
}

function clampInt(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.trunc(value)) : 0;
}

function normalizeCounts(raw: unknown): ReactionCounts {
  const src = (raw ?? {}) as Record<string, unknown>;
  const out = { ...EMPTY_COUNTS };
  for (const type of REACTION_TYPES) out[type] = clampInt(src[type]);
  return out;
}

function isReactionType(value: unknown): value is ReactionType {
  return typeof value === 'string' && (REACTION_TYPES as readonly string[]).includes(value);
}

function sanitizeAttachments(input: CommentAttachment[] | undefined): CommentAttachment[] {
  if (!Array.isArray(input)) return [];
  return input.map((a) =>
    a.kind === 'sticker'
      ? { kind: 'sticker' as const, stickerId: String(a.stickerId ?? '') }
      : { kind: 'image' as const, url: String(a.url ?? '') },
  );
}

export function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const AUTHOR_PROJECT = {
  _id: '$author._id',
  displayName: '$author.displayName',
  handle: '$author.handle',
  avatarUrl: '$author.avatarUrl',
  accountType: '$author.accountType',
};

const COMMENT_PROJECT: Document = {
  _id: 1,
  targetType: 1,
  targetId: 1,
  parentId: 1,
  rootId: 1,
  depth: 1,
  body: 1,
  attachments: 1,
  status: 1,
  createdAt: 1,
  editedAt: 1,
  counts: 1,
  authorId: 1,
  author: AUTHOR_PROJECT,
};

function mapAuthor(raw: unknown): CommentAuthor | null {
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

function toCommentView(
  row: Document,
  o: { viewerId: ObjectId | null; targetAuthorId: ObjectId | null; viewerReaction: ReactionType | null },
): CommentView {
  const id = row._id as ObjectId;
  const counts = (row.counts ?? {}) as Record<string, unknown>;
  const reactions = normalizeCounts(counts.reactions);
  const status = row.status === 'deleted' ? 'deleted' : 'visible';
  const authorId = row.authorId as ObjectId | undefined;
  const createdAt = row.createdAt instanceof Date ? row.createdAt : id.getTimestamp();
  const parentId = row.parentId as ObjectId | null | undefined;
  const rootId = row.rootId as ObjectId | undefined;
  const targetType: CommentTargetType =
    row.targetType === 'trip' ? 'trip' : 'post';
  const targetId = (row.targetId as ObjectId).toString();

  const canDelete = Boolean(
    o.viewerId &&
      status === 'visible' &&
      ((authorId && authorId.equals(o.viewerId)) ||
        (o.targetAuthorId && o.targetAuthorId.equals(o.viewerId))),
  );

  return {
    _id: id.toString(),
    targetType,
    targetId,
    postId: targetId,
    parentId: parentId ? parentId.toString() : null,
    rootId: (rootId ?? id).toString(),
    depth: clampInt(row.depth),
    body: status === 'deleted' ? '' : typeof row.body === 'string' ? row.body : '',
    attachments: status === 'deleted' ? [] : sanitizeAttachments(row.attachments as CommentAttachment[]),
    status,
    createdAt: createdAt.toISOString(),
    editedAt: row.editedAt instanceof Date ? row.editedAt.toISOString() : null,
    author: status === 'deleted' ? null : mapAuthor(row.author),
    reactions,
    reactionsTotal:
      typeof counts.reactionsTotal === 'number' && Number.isFinite(counts.reactionsTotal)
        ? Math.max(0, Math.trunc(counts.reactionsTotal))
        : REACTION_TYPES.reduce((sum, t) => sum + reactions[t], 0),
    viewerReaction: status === 'deleted' ? null : o.viewerReaction,
    replyCount: clampInt(counts.replies),
    viewerCanDelete: canDelete,
  };
}

async function loadViewerReactions(
  ids: ObjectId[],
  viewerId: ObjectId | null,
): Promise<Map<string, ReactionType>> {
  const out = new Map<string, ReactionType>();
  if (!viewerId || ids.length === 0) return out;
  const rows = await getDb()
    .collection('reactions')
    .find(
      { targetType: 'comment', targetId: { $in: ids }, userId: viewerId },
      { projection: { targetId: 1, type: 1 } },
    )
    .toArray();
  for (const r of rows) {
    if (isReactionType(r.type)) out.set((r.targetId as ObjectId).toString(), r.type);
  }
  return out;
}

/**
 * Resolve the target (post or trip), check visibility, return owner + comment count.
 * Posts use the existing assertPostReadable gate.
 * Trips: public trips are readable by anyone; private trips only by their owner.
 */
async function readTargetOrThrow(
  targetType: CommentTargetType,
  targetId: ObjectId,
  viewerId: ObjectId | null,
  session?: ClientSession,
): Promise<{ authorId: ObjectId | null; commentCount: number }> {
  const db = getDb();

  if (targetType === 'post') {
    const post = await db.collection('posts').findOne(
      { _id: targetId },
      {
        projection: { _id: 1, authorId: 1, visibility: 1, status: 1, 'counts.comments': 1 },
        ...(session ? { session } : {}),
      },
    );
    if (!post) throw new ApiError(404, 'not_found', 'Post not found');
    await assertPostReadable(post, viewerId);
    return {
      authorId: (post.authorId as ObjectId | undefined) ?? null,
      commentCount: clampInt((post.counts as { comments?: unknown } | undefined)?.comments),
    };
  }

  const trip = await db.collection('trips').findOne(
    { _id: targetId },
    {
      projection: { _id: 1, userId: 1, visibility: 1, 'counts.comments': 1 },
      ...(session ? { session } : {}),
    },
  );
  if (!trip) throw new ApiError(404, 'not_found', 'Trip not found');
  if (trip.visibility !== 'public') {
    const ownerId = trip.userId as ObjectId | undefined;
    if (!viewerId || !ownerId || !ownerId.equals(viewerId)) {
      throw new ApiError(403, 'forbidden', 'Trip is not public');
    }
  }
  return {
    authorId: (trip.userId as ObjectId | undefined) ?? null,
    commentCount: clampInt((trip.counts as { comments?: unknown } | undefined)?.comments),
  };
}

function safeEmit(what: string, fn: () => void): void {
  try {
    fn();
  } catch (err) {
    logger.warn({ err }, `${what} emit skipped`);
  }
}

async function toPage(
  rows: Document[],
  o: { viewerId: ObjectId | null; targetAuthorId: ObjectId | null },
): Promise<CommentView[]> {
  const ids = rows.map((r) => r._id as ObjectId);
  const viewerReactions = await loadViewerReactions(ids, o.viewerId);
  return rows.map((r) =>
    toCommentView(r, {
      viewerId: o.viewerId,
      targetAuthorId: o.targetAuthorId,
      viewerReaction: viewerReactions.get((r._id as ObjectId).toString()) ?? null,
    }),
  );
}

async function adjustTargetCount(
  db: ReturnType<typeof getDb>,
  targetType: CommentTargetType,
  targetId: ObjectId,
  delta: 1 | -1,
  session: ClientSession,
): Promise<number> {
  const collection = targetType === 'post' ? 'posts' : 'trips';
  const updated = await db.collection(collection).findOneAndUpdate(
    { _id: targetId },
    { $inc: { 'counts.comments': delta } },
    { returnDocument: 'after', projection: { 'counts.comments': 1 }, session },
  );
  return clampInt((updated?.counts as { comments?: unknown } | undefined)?.comments);
}

export async function createComment(input: {
  targetType: CommentTargetType;
  targetId: ObjectId;
  parentId: ObjectId | null;
  authorId: ObjectId;
  body: string;
  attachments: CommentAttachment[];
}): Promise<CommentView> {
  const db = getDb();
  const client = getMongoClient();
  const now = new Date();
  const attachments = sanitizeAttachments(input.attachments);

  const target = await readTargetOrThrow(input.targetType, input.targetId, input.authorId);

  const commentId = new ObjectId();
  let doc: Document | null = null;
  let targetCommentCount = 0;

  const session: ClientSession = client.startSession();
  try {
    await session.withTransaction(async () => {
      let parentId: ObjectId | null = null;
      let rootId = commentId;
      let path = `/${commentId.toHexString()}/`;
      let depth = 0;

      if (input.parentId) {
        const parent = await db.collection('comments').findOne(
          { _id: input.parentId },
          { projection: { targetType: 1, targetId: 1, rootId: 1, path: 1, depth: 1, status: 1 }, session },
        );
        if (!parent) throw new ApiError(404, 'not_found', 'Parent comment not found');
        if (
          (parent.targetType as string) !== input.targetType ||
          !(parent.targetId as ObjectId).equals(input.targetId)
        ) {
          throw new ApiError(404, 'not_found', 'Parent comment not found');
        }
        if (parent.status === 'deleted') {
          throw new ApiError(404, 'not_found', 'Parent comment not found');
        }

        parentId = input.parentId;
        rootId = (parent.rootId as ObjectId | undefined) ?? input.parentId;
        depth = clampInt(parent.depth) + 1;
        if (depth > MAX_DEPTH) {
          throw new ApiError(422, 'too_deep', 'Reply nesting limit reached');
        }
        const parentPath =
          typeof parent.path === 'string' && parent.path.length > 0
            ? parent.path
            : `/${input.parentId.toHexString()}/`;
        path = `${parentPath}${commentId.toHexString()}/`;
      }

      doc = {
        _id: commentId,
        targetType: input.targetType,
        targetId: input.targetId,
        parentId,
        rootId,
        path,
        depth,
        authorId: input.authorId,
        body: input.body,
        attachments,
        counts: {
          reactions: { ...EMPTY_COUNTS },
          reactionsTotal: 0,
          replies: 0,
        },
        status: 'visible' as const,
        createdAt: now,
        updatedAt: now,
      };
      await db.collection('comments').insertOne(doc, { session });

      targetCommentCount = await adjustTargetCount(db, input.targetType, input.targetId, 1, session);

      if (parentId) {
        await db
          .collection('comments')
          .updateOne({ _id: parentId }, { $inc: { 'counts.replies': 1 } }, { session });
      }
    });
  } finally {
    await session.endSession();
  }

  const author = await db
    .collection('users')
    .findOne(
      { _id: input.authorId },
      { projection: { displayName: 1, handle: 1, avatarUrl: 1, accountType: 1 } },
    );

  const view = toCommentView(
    { ...(doc as unknown as Document), author },
    {
      viewerId: input.authorId,
      targetAuthorId: target.authorId,
      viewerReaction: null,
    },
  );

  safeEmit('comment:new', () =>
    emitCommentNew(input.targetType, input.targetId.toString(), view, targetCommentCount),
  );

  // Notifications: post_comment to the post author, comment_reply to the parent
  // author. The double-notify guard (reply on your own post) is enforced by
  // skipping post_comment when the commenter is also the post author — handled
  // centrally by notify() for self-actions, but the entityId difference means
  // both would fire independently. Explicitly skip post_comment when replyRecipient
  // equals postAuthor to avoid two bell rows for one action.
  if (input.targetType === 'post') {
    const postAuthorId = target.authorId as ObjectId | null;
    if (postAuthorId && !postAuthorId.equals(input.authorId)) {
      let replyRecipientId: ObjectId | null = null;
      if (input.parentId) {
        const parentDoc = await db
          .collection('comments')
          .findOne({ _id: input.parentId }, { projection: { authorId: 1 } });
        replyRecipientId = (parentDoc?.authorId as ObjectId | undefined) ?? null;
      }

      if (replyRecipientId && !replyRecipientId.equals(input.authorId)) {
        await notify({
          userId: replyRecipientId,
          actorId: input.authorId,
          type: 'comment_reply',
          entityId: commentId,
          postId: input.targetId,
          commentId,
        });
      }

      // Skip post_comment when reply recipient is the post author — they already
      // get comment_reply, and two rows for one action is confusing.
      const skipPostComment =
        replyRecipientId !== null && replyRecipientId.equals(postAuthorId);
      if (!skipPostComment) {
        await notify({
          userId: postAuthorId,
          actorId: input.authorId,
          type: 'post_comment',
          entityId: input.targetId,
          postId: input.targetId,
          commentId,
        });
      }
    }
  }

  return view;
}

export async function listComments(
  targetType: CommentTargetType,
  targetId: ObjectId,
  opts: { viewerId: ObjectId | null; limit: number; before?: string },
): Promise<{ items: CommentView[]; nextCursor: string | null; total: number }> {
  const db = getDb();
  const limit = Number.isFinite(opts.limit) ? Math.min(Math.max(Math.trunc(opts.limit), 1), 50) : 20;

  const target = await readTargetOrThrow(targetType, targetId, opts.viewerId);

  const match: Record<string, unknown> = { targetType, targetId, parentId: null };
  if (opts.before && /^[0-9a-fA-F]{24}$/.test(opts.before)) {
    match._id = { $lt: new ObjectId(opts.before) };
  }

  const rows = await db
    .collection('comments')
    .aggregate([
      { $match: match },
      { $sort: { _id: -1 } },
      { $limit: limit },
      { $lookup: { from: 'users', localField: 'authorId', foreignField: '_id', as: 'author' } },
      { $unwind: { path: '$author', preserveNullAndEmptyArrays: true } },
      { $project: COMMENT_PROJECT },
    ])
    .toArray();

  const items = await toPage(rows, {
    viewerId: opts.viewerId,
    targetAuthorId: target.authorId,
  });

  const nextCursor = items.length === limit ? items[items.length - 1]._id : null;
  return { items, nextCursor, total: target.commentCount };
}

export async function listReplies(
  commentId: ObjectId,
  opts: { viewerId: ObjectId | null; limit: number; after?: string },
): Promise<{ items: CommentView[]; nextCursor: string | null }> {
  const db = getDb();
  const limit = Number.isFinite(opts.limit) ? Math.min(Math.max(Math.trunc(opts.limit), 1), 50) : 10;

  const parent = await db
    .collection('comments')
    .findOne({ _id: commentId }, { projection: { targetType: 1, targetId: 1, status: 1 } });
  if (!parent) throw new ApiError(404, 'not_found', 'Comment not found');

  const target = await readTargetOrThrow(
    (parent.targetType as CommentTargetType | undefined) ?? 'post',
    parent.targetId as ObjectId,
    opts.viewerId,
  );

  const match: Record<string, unknown> = { parentId: commentId };
  if (opts.after && /^[0-9a-fA-F]{24}$/.test(opts.after)) {
    match._id = { $gt: new ObjectId(opts.after) };
  }

  const rows = await db
    .collection('comments')
    .aggregate([
      { $match: match },
      { $sort: { _id: 1 } },
      { $limit: limit },
      { $lookup: { from: 'users', localField: 'authorId', foreignField: '_id', as: 'author' } },
      { $unwind: { path: '$author', preserveNullAndEmptyArrays: true } },
      { $project: COMMENT_PROJECT },
    ])
    .toArray();

  const items = await toPage(rows, {
    viewerId: opts.viewerId,
    targetAuthorId: target.authorId,
  });

  const nextCursor = items.length === limit ? items[items.length - 1]._id : null;
  return { items, nextCursor };
}

export async function deleteComment(
  commentId: ObjectId,
  actorId: ObjectId,
): Promise<{ ok: true }> {
  const db = getDb();
  const client = getMongoClient();

  const comment = await db
    .collection('comments')
    .findOne(
      { _id: commentId },
      { projection: { targetType: 1, targetId: 1, parentId: 1, authorId: 1, status: 1 } },
    );
  if (!comment) throw new ApiError(404, 'not_found', 'Comment not found');

  const targetType: CommentTargetType =
    comment.targetType === 'trip' ? 'trip' : 'post';
  const targetId = comment.targetId as ObjectId;
  const collection = targetType === 'post' ? 'posts' : 'trips';
  const ownerField = targetType === 'post' ? 'authorId' : 'userId';

  const targetDoc = await db
    .collection(collection)
    .findOne({ _id: targetId }, { projection: { [ownerField]: 1 } });

  const authorId = comment.authorId as ObjectId | undefined;
  const targetAuthorId = (targetDoc?.[ownerField] as ObjectId | undefined) ?? null;
  const isAuthor = Boolean(authorId && authorId.equals(actorId));
  const isTargetOwner = Boolean(targetAuthorId && targetAuthorId.equals(actorId));
  if (!isAuthor && !isTargetOwner) {
    throw new ApiError(403, 'forbidden', 'Not allowed to delete this comment');
  }

  if (comment.status === 'deleted') return { ok: true };

  const parentId = (comment.parentId as ObjectId | null) ?? null;
  let changed = false;
  let targetCommentCount = 0;

  const session: ClientSession = client.startSession();
  try {
    await session.withTransaction(async () => {
      const updated = await db.collection('comments').findOneAndUpdate(
        { _id: commentId, status: 'visible' },
        { $set: { status: 'deleted', body: '', attachments: [], updatedAt: new Date() } },
        { returnDocument: 'after', projection: { _id: 1 }, session },
      );
      if (!updated) return;
      changed = true;

      targetCommentCount = await adjustTargetCount(db, targetType, targetId, -1, session);

      if (parentId) {
        await db
          .collection('comments')
          .updateOne({ _id: parentId }, { $inc: { 'counts.replies': -1 } }, { session });
      }
    });
  } finally {
    await session.endSession();
  }

  if (changed) {
    safeEmit('comment:deleted', () =>
      emitCommentDeleted(
        targetType,
        targetId.toString(),
        commentId.toString(),
        parentId ? parentId.toString() : null,
        targetCommentCount,
      ),
    );
  }

  return { ok: true };
}
