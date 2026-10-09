import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../lib/http.js';
import { validateBody } from '../../lib/validate.js';
import { authenticate, requirePermission } from '../auth/middleware.js';
import * as svc from './posts.service.js';
import {
  REACTION_TYPES,
  listReactions,
  removeReaction,
  setReaction,
  type ReactionType,
} from './reactions.service.js';

const router = Router();

const reactionSchema = z.object({ type: z.enum(REACTION_TYPES) });

/** An unknown/invalid `type` filter is ignored rather than rejected. */
function parseReactionType(value: unknown): ReactionType | undefined {
  return typeof value === 'string' && (REACTION_TYPES as readonly string[]).includes(value)
    ? (value as ReactionType)
    : undefined;
}

const createSchema = z.object({
  body: z.string().min(1).max(5000),
  lang: z.enum(['vi', 'en']).optional(),
  media: z
    .array(
      z.object({
        // Accept both absolute URLs and relative /file/... paths returned by uploads.
        url: z.string().refine((v) => /^(\/file\/|\/uploads\/|https?:\/\/)/.test(v), {
          message: 'Invalid url',
        }),
        type: z.enum(['image', 'video']),
      }),
    )
    .max(10)
    .optional(),
  placeId: z.string().optional(),
  place: z
    .object({
      name: z.string().min(1).max(200),
      lat: z.number().min(-90).max(90).optional(),
      lng: z.number().min(-180).max(180).optional(),
    })
    .optional(),
  // Province/commune picked from the boundary data. Validated server-side, so a
  // client cannot invent names.
  address: z
    .object({
      province: z.string().min(1).max(100),
      commune: z.string().min(1).max(100),
    })
    .optional(),
  visibility: z.enum(['public', 'followers']).optional(),
});

router.get(
  '/stats/provinces',
  asyncHandler(async (req, res) => {
    const limit = Math.min(Math.max(Number(req.query.limit ?? 5), 1), 20);
    res.json(await svc.getProvincePostStats(limit));
  }),
);

router.get(
  '/feed',
  authenticate(false),
  asyncHandler(async (req, res) => {
    const limit = Number(req.query.limit ?? 20);
    const before = typeof req.query.before === 'string' ? req.query.before : undefined;
    res.json(await svc.listFeed({ limit, before, viewerId: req.user?.id }));
  }),
);

router.get(
  '/me',
  authenticate(),
  asyncHandler(async (req, res) => {
    const limit = Number(req.query.limit ?? 20);
    const before = typeof req.query.before === 'string' ? req.query.before : undefined;
    res.json(await svc.listMyPosts({ userId: req.user!.id, limit, before }));
  }),
);

// Reaction routes must be declared before `/:id` — in Express 5 the `/:id`
// pattern would otherwise match first and swallow them.
router.put(
  '/:id/reactions',
  authenticate(),
  validateBody(reactionSchema),
  asyncHandler(async (req, res) => {
    res.json(
      await setReaction({
        targetType: 'post',
        targetId: String(req.params.id),
        userId: req.user!.id,
        type: req.body.type,
      }),
    );
  }),
);

router.delete(
  '/:id/reactions',
  authenticate(),
  asyncHandler(async (req, res) => {
    res.json(
      await removeReaction({
        targetType: 'post',
        targetId: String(req.params.id),
        userId: req.user!.id,
      }),
    );
  }),
);

router.get(
  '/:id/reactions',
  authenticate(false),
  asyncHandler(async (req, res) => {
    const rawLimit = Number(req.query.limit ?? 30);
    const limit = Number.isFinite(rawLimit) ? Math.min(Math.max(Math.trunc(rawLimit), 1), 50) : 30;
    res.json(
      await listReactions({
        targetType: 'post',
        targetId: String(req.params.id),
        type: parseReactionType(req.query.type),
        limit,
        before: typeof req.query.before === 'string' ? req.query.before : undefined,
        viewerId: req.user?.id,
      }),
    );
  }),
);

// Compatibility alias for older web bundles; remove once web has rolled out.
router.post(
  '/:id/like',
  authenticate(),
  asyncHandler(async (req, res) => {
    const st = await svc.toggleLikeCompat(String(req.params.id), req.user!.id);
    res.json(st); // { liked: boolean }
  }),
);

router.post(
  '/:id/save',
  authenticate(),
  asyncHandler(async (req, res) => {
    res.json(await svc.toggleSave(String(req.params.id), req.user!.id));
  }),
);

router.get(
  '/:id',
  authenticate(false),
  asyncHandler(async (req, res) => {
    res.json(await svc.getPost(String(req.params.id), req.user?.id));
  }),
);

router.post(
  '/',
  authenticate(),
  requirePermission('post:create'),
  validateBody(createSchema),
  asyncHandler(async (req, res) => {
    const result = await svc.createPost({ authorId: req.user!.id, ...req.body });
    res.status(201).json(result);
  }),
);

export default router;
