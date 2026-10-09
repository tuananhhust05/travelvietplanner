import { Router, type Request } from 'express';
import { ObjectId } from 'mongodb';
import { z } from 'zod';
import { ApiError, asyncHandler } from '../../lib/http.js';
import { validateBody } from '../../lib/validate.js';
import { authenticate } from '../auth/middleware.js';
import {
  REACTION_TYPES,
  listReactions,
  removeReaction,
  setReaction,
  type ReactionType,
} from '../posts/reactions.service.js';
import {
  createComment,
  deleteComment,
  listComments,
  listReplies,
  type CommentAttachment,
  type CommentTargetType,
} from './comments.service.js';
import { isValidStickerId } from './stickers.js';

const OBJECT_ID_RE = /^[0-9a-fA-F]{24}$/;

function pathOid(raw: unknown, message: string): ObjectId {
  if (typeof raw !== 'string' || !OBJECT_ID_RE.test(raw)) {
    throw new ApiError(400, 'bad_id', message);
  }
  return new ObjectId(raw);
}

function pathIdString(raw: unknown, message: string): string {
  return pathOid(raw, message).toHexString();
}

function viewerOid(req: Request): ObjectId | null {
  const id = req.user?.id;
  return typeof id === 'string' && OBJECT_ID_RE.test(id) ? new ObjectId(id) : null;
}

function actorOid(req: Request): ObjectId {
  const id = req.user?.id;
  if (typeof id !== 'string' || !OBJECT_ID_RE.test(id)) {
    throw new ApiError(401, 'unauthorized', 'Auth required');
  }
  return new ObjectId(id);
}

function parseLimit(raw: unknown, fallback: number): number {
  const n = Number(raw ?? fallback);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(Math.max(Math.trunc(n), 1), 50);
}

function queryString(raw: unknown): string | undefined {
  return typeof raw === 'string' && raw.length > 0 ? raw : undefined;
}

function parseReactionType(value: unknown): ReactionType | undefined {
  return typeof value === 'string' && (REACTION_TYPES as readonly string[]).includes(value)
    ? (value as ReactionType)
    : undefined;
}

const reactionSchema = z.object({ type: z.enum(REACTION_TYPES) });

const imageAttachmentSchema = z.object({
  kind: z.literal('image'),
  url: z.string().refine((v) => /^(\/file\/|\/uploads\/|https?:\/\/)/.test(v), {
    message: 'Invalid url',
  }),
});

const stickerAttachmentSchema = z.object({
  kind: z.literal('sticker'),
  stickerId: z.string().refine(isValidStickerId, { message: 'Unknown stickerId' }),
});

const attachmentSchema = z.discriminatedUnion('kind', [
  imageAttachmentSchema,
  stickerAttachmentSchema,
]);

const createCommentSchema = z
  .object({
    body: z.string().trim().max(5000).optional(),
    parentId: z.string().regex(OBJECT_ID_RE, 'Invalid parentId').nullish(),
    attachments: z.array(attachmentSchema).max(4).optional(),
  })
  .refine((v) => (v.body ?? '').length > 0 || (v.attachments?.length ?? 0) > 0, {
    message: 'A comment needs a body or at least one attachment',
    path: ['body'],
  });

function toAttachments(raw: unknown): CommentAttachment[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((a: { kind: string; url?: string; stickerId?: string }) =>
    a.kind === 'sticker'
      ? { kind: 'sticker' as const, stickerId: String(a.stickerId) }
      : { kind: 'image' as const, url: String(a.url) },
  );
}

// ---------------------------------------------------------------------------
// Mounted on `/v1/posts` — handles POST/GET /:id/comments for posts
// ---------------------------------------------------------------------------
export const postCommentsRoutes = Router();

postCommentsRoutes.post(
  '/:id/comments',
  authenticate(),
  validateBody(createCommentSchema),
  asyncHandler(async (req, res) => {
    const postId = pathOid(req.params.id, 'Invalid post id');
    const parentRaw = req.body.parentId as string | null | undefined;
    const result = await createComment({
      targetType: 'post',
      targetId: postId,
      parentId: parentRaw ? new ObjectId(parentRaw) : null,
      authorId: actorOid(req),
      body: typeof req.body.body === 'string' ? req.body.body : '',
      attachments: toAttachments(req.body.attachments),
    });
    res.status(201).json(result);
  }),
);

postCommentsRoutes.get(
  '/:id/comments',
  authenticate(false),
  asyncHandler(async (req, res) => {
    const postId = pathOid(req.params.id, 'Invalid post id');
    res.json(
      await listComments('post', postId, {
        viewerId: viewerOid(req),
        limit: parseLimit(req.query.limit, 20),
        before: queryString(req.query.before),
      }),
    );
  }),
);

// ---------------------------------------------------------------------------
// Mounted on `/v1/trips` — handles POST/GET /:id/comments for trips
// ---------------------------------------------------------------------------
export const tripCommentsRoutes = Router();

tripCommentsRoutes.post(
  '/:id/comments',
  authenticate(),
  validateBody(createCommentSchema),
  asyncHandler(async (req, res) => {
    const tripId = pathOid(req.params.id, 'Invalid trip id');
    const parentRaw = req.body.parentId as string | null | undefined;
    const result = await createComment({
      targetType: 'trip',
      targetId: tripId,
      parentId: parentRaw ? new ObjectId(parentRaw) : null,
      authorId: actorOid(req),
      body: typeof req.body.body === 'string' ? req.body.body : '',
      attachments: toAttachments(req.body.attachments),
    });
    res.status(201).json(result);
  }),
);

tripCommentsRoutes.get(
  '/:id/comments',
  authenticate(false),
  asyncHandler(async (req, res) => {
    const tripId = pathOid(req.params.id, 'Invalid trip id');
    res.json(
      await listComments('trip', tripId, {
        viewerId: viewerOid(req),
        limit: parseLimit(req.query.limit, 20),
        before: queryString(req.query.before),
      }),
    );
  }),
);

// ---------------------------------------------------------------------------
// Mounted on `/v1/comments` — shared for all comment types
// ---------------------------------------------------------------------------
export const commentsRoutes = Router();

commentsRoutes.put(
  '/:id/reactions',
  authenticate(),
  validateBody(reactionSchema),
  asyncHandler(async (req, res) => {
    res.json(
      await setReaction({
        targetType: 'comment',
        targetId: pathIdString(req.params.id, 'Invalid comment id'),
        userId: req.user!.id,
        type: req.body.type,
      }),
    );
  }),
);

commentsRoutes.delete(
  '/:id/reactions',
  authenticate(),
  asyncHandler(async (req, res) => {
    res.json(
      await removeReaction({
        targetType: 'comment',
        targetId: pathIdString(req.params.id, 'Invalid comment id'),
        userId: req.user!.id,
      }),
    );
  }),
);

commentsRoutes.get(
  '/:id/reactions',
  authenticate(false),
  asyncHandler(async (req, res) => {
    res.json(
      await listReactions({
        targetType: 'comment',
        targetId: pathIdString(req.params.id, 'Invalid comment id'),
        type: parseReactionType(req.query.type),
        limit: parseLimit(req.query.limit, 30),
        before: queryString(req.query.before),
        viewerId: req.user?.id,
      }),
    );
  }),
);

commentsRoutes.get(
  '/:id/replies',
  authenticate(false),
  asyncHandler(async (req, res) => {
    const commentId = pathOid(req.params.id, 'Invalid comment id');
    res.json(
      await listReplies(commentId, {
        viewerId: viewerOid(req),
        limit: parseLimit(req.query.limit, 10),
        after: queryString(req.query.after),
      }),
    );
  }),
);

commentsRoutes.delete(
  '/:id',
  authenticate(),
  asyncHandler(async (req, res) => {
    const commentId = pathOid(req.params.id, 'Invalid comment id');
    res.json(await deleteComment(commentId, actorOid(req)));
  }),
);
