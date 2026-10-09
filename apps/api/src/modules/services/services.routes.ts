import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../lib/http.js';
import { validateBody } from '../../lib/validate.js';
import { authenticate } from '../auth/middleware.js';
import { validateAddressString } from '../geo/geo.service.js';
import * as svc from './services.service.js';

const router = Router();

// Uploads return relative /file/... paths, so media fields must accept those
// as well as absolute URLs (same rule as posts).
const mediaUrl = z.string().refine((v) => /^(\/file\/|\/uploads\/|https?:\/\/)/.test(v), {
  message: 'Invalid url',
});

const serviceSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(5000).optional(),
  category: z.string().max(100).optional(),
  price: z.number().min(0).optional(),
  duration: z.string().max(100).optional(),
  location: z.string().max(200).optional(),
  maxPax: z.number().int().min(1).optional(),
  coverImage: mediaUrl.optional(),
  images: z.array(mediaUrl).max(10).optional(),
  video: mediaUrl.optional(),
  status: z.enum(['active', 'paused']).optional(),
});

const updateSchema = serviceSchema.partial();

/**
 * `location` holds a composed "[street, ]commune, province" string from the
 * address picker. Checking it needs a DB round trip against the boundary data,
 * which a Zod schema cannot do, so it happens here: after schema parsing, before
 * anything is persisted. Every other field is passed through untouched so no
 * value is silently dropped.
 */
async function withValidatedLocation<T extends { location?: string }>(body: T): Promise<T> {
  if (typeof body.location !== 'string') return body;
  return { ...body, location: await validateAddressString(body.location, 'location') };
}

router.get(
  '/',
  authenticate(),
  asyncHandler(async (req, res) => {
    res.json(await svc.listServices(req.user!.id));
  }),
);

// Public discovery — must be declared before `/:id` so Express matches it first.
router.get(
  '/explore',
  authenticate(false),
  asyncHandler(async (req, res) => {
    res.json(
      await svc.listPublicServices({
        guideId: typeof req.query.guideId === 'string' ? req.query.guideId : undefined,
        category: typeof req.query.category === 'string' ? req.query.category : undefined,
        q: typeof req.query.q === 'string' ? req.query.q : undefined,
        limit: Number(req.query.limit ?? 20),
      }),
    );
  }),
);

// Public detail view. Owner-scoped fetch still works because getPublicService
// lets the owner see paused services too.
router.get(
  '/:id',
  authenticate(false),
  asyncHandler(async (req, res) => {
    res.json(await svc.getPublicService(String(req.params.id), req.user?.id));
  }),
);

router.post(
  '/',
  authenticate(),
  validateBody(serviceSchema),
  asyncHandler(async (req, res) => {
    const result = await svc.createService(req.user!.id, await withValidatedLocation(req.body));
    res.status(201).json(result);
  }),
);

router.patch(
  '/:id',
  authenticate(),
  validateBody(updateSchema),
  asyncHandler(async (req, res) => {
    const input = await withValidatedLocation(req.body);
    res.json(await svc.updateService(String(req.params.id), req.user!.id, input));
  }),
);

router.delete(
  '/:id',
  authenticate(),
  asyncHandler(async (req, res) => {
    res.json(await svc.deleteService(String(req.params.id), req.user!.id));
  }),
);

// Track a view — only logged-in users, fire-and-forget from the client.
// Owner views are silently ignored in trackServiceView.
router.post(
  '/:id/view',
  authenticate(),
  asyncHandler(async (req, res) => {
    await svc.trackServiceView(String(req.params.id), req.user!.id);
    res.json({ ok: true });
  }),
);

// Viewer list — only the guide who owns the service can access this.
router.get(
  '/:id/viewers',
  authenticate(),
  asyncHandler(async (req, res) => {
    res.json(await svc.getServiceViewers(String(req.params.id), req.user!.id));
  }),
);

export default router;