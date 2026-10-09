import { Router } from 'express';
import { asyncHandler } from '../../lib/http.js';
import { authenticate } from '../auth/middleware.js';
import { listUserPosts } from '../posts/posts.service.js';
import * as svc from './users.service.js';

const router = Router();

router.get(
  '/suggestions',
  authenticate(),
  asyncHandler(async (req, res) => {
    const limit = Number(req.query.limit ?? 5);
    res.json(await svc.listSuggestions({ viewerId: req.user!.id, limit }));
  }),
);

router.get(
  '/search',
  authenticate(),
  asyncHandler(async (req, res) => {
    const q = typeof req.query.q === 'string' ? req.query.q : '';
    const limit = Number(req.query.limit ?? 10);
    res.json(await svc.searchUsers({ q, viewerId: req.user!.id, limit }));
  }),
);

router.get(
  '/:handle/posts',
  authenticate(false),
  asyncHandler(async (req, res) => {
    const limit = Number(req.query.limit ?? 20);
    const before = typeof req.query.before === 'string' ? req.query.before : undefined;
    const profile = await svc.getUserProfile({ handle: String(req.params.handle) });
    res.json(
      await listUserPosts({
        userId: profile.user._id,
        limit,
        before,
        viewerId: req.user?.id,
      }),
    );
  }),
);

router.get(
  '/:handle',
  authenticate(false),
  asyncHandler(async (req, res) => {
    res.json(await svc.getUserProfile({ handle: String(req.params.handle), viewerId: req.user?.id }));
  }),
);

router.post(
  '/:id/follow',
  authenticate(),
  asyncHandler(async (req, res) => {
    res.json(await svc.toggleFollow(req.user!.id, String(req.params.id)));
  }),
);

router.delete(
  '/:id/follow',
  authenticate(),
  asyncHandler(async (req, res) => {
    res.json(await svc.toggleFollow(req.user!.id, String(req.params.id)));
  }),
);

export default router;