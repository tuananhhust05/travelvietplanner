import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../lib/http.js';
import { validateBody } from '../../lib/validate.js';
import { authenticate, requirePermission } from '../auth/middleware.js';
import * as svc from './admin.service.js';

const router = Router();

const roleSchema = z.object({ role: z.string().min(1) });
const banSchema = z.object({ banned: z.boolean() });
const postStatusSchema = z.object({ status: z.enum(['published', 'hidden', 'deleted']) });
const featureSchema = z.object({ featured: z.boolean() });

router.get(
  '/users',
  authenticate(),
  requirePermission('admin:access'),
  asyncHandler(async (req, res) => {
    const q = typeof req.query.q === 'string' ? req.query.q : undefined;
    const role = typeof req.query.role === 'string' ? req.query.role : undefined;
    const page = Number(req.query.page ?? 1);
    res.json(await svc.listUsers({ q, role, page }));
  }),
);

router.patch(
  '/users/:id/role',
  authenticate(),
  requirePermission('admin:access'),
  validateBody(roleSchema),
  asyncHandler(async (req, res) => {
    await svc.setUserRole(String(req.params.id), req.body.role);
    res.json({ ok: true });
  }),
);

router.patch(
  '/users/:id/ban',
  authenticate(),
  requirePermission('admin:access'),
  validateBody(banSchema),
  asyncHandler(async (req, res) => {
    await svc.setUserBanned(String(req.params.id), req.body.banned);
    res.json({ ok: true });
  }),
);

router.delete(
  '/users/:id',
  authenticate(),
  requirePermission('admin:access'),
  asyncHandler(async (req, res) => {
    await svc.deleteUser(String(req.params.id));
    res.status(204).end();
  }),
);

router.get(
  '/posts',
  authenticate(),
  requirePermission('admin:access'),
  asyncHandler(async (req, res) => {
    const status = typeof req.query.status === 'string' ? req.query.status : undefined;
    const page = Number(req.query.page ?? 1);
    res.json(await svc.listPosts({ status, page }));
  }),
);

router.patch(
  '/posts/:id/status',
  authenticate(),
  requirePermission('admin:access'),
  validateBody(postStatusSchema),
  asyncHandler(async (req, res) => {
    await svc.setPostStatus(String(req.params.id), req.body.status);
    res.json({ ok: true });
  }),
);

router.patch(
  '/posts/:id/feature',
  authenticate(),
  requirePermission('admin:access'),
  validateBody(featureSchema),
  asyncHandler(async (req, res) => {
    await svc.setPostFeatured(String(req.params.id), req.body.featured);
    res.json({ ok: true });
  }),
);

export default router;