import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../lib/http.js';
import { validateBody } from '../../lib/validate.js';
import { authenticate } from '../auth/middleware.js';
import { validateAddressString } from '../geo/geo.service.js';
import * as svc from './listings.service.js';

const router = Router();

const listingSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(5000).optional(),
  category: z.enum(['hotel', 'restaurant', 'attraction', 'cafe', 'resort', 'spa', 'shopping', 'transport', 'other']).optional(),
  type: z.string().max(100).optional(),
  price: z.number().min(0).optional(),
  phone: z.string().max(50).optional(),
  website: z.string().max(300).optional(),
  openingHours: z.string().max(100).optional(),
  images: z.array(z.string()).max(20).optional(),
  location: z.string().max(300).optional(),
  status: z.enum(['active', 'paused']).optional(),
});

const updateSchema = listingSchema.partial();

async function withValidatedLocation<T extends { location?: string }>(body: T): Promise<T> {
  if (typeof body.location !== 'string') return body;
  return { ...body, location: await validateAddressString(body.location, 'location') };
}

router.get(
  '/',
  authenticate(),
  asyncHandler(async (req, res) => {
    res.json(await svc.listListings(req.user!.id));
  }),
);

router.get(
  '/:id',
  authenticate(),
  asyncHandler(async (req, res) => {
    res.json(await svc.getListing(String(req.params.id), req.user!.id));
  }),
);

router.post(
  '/',
  authenticate(),
  validateBody(listingSchema),
  asyncHandler(async (req, res) => {
    const result = await svc.createListing(req.user!.id, await withValidatedLocation(req.body));
    res.status(201).json(result);
  }),
);

router.patch(
  '/:id',
  authenticate(),
  validateBody(updateSchema),
  asyncHandler(async (req, res) => {
    const input = await withValidatedLocation(req.body);
    res.json(await svc.updateListing(String(req.params.id), req.user!.id, input));
  }),
);

router.delete(
  '/:id',
  authenticate(),
  asyncHandler(async (req, res) => {
    res.json(await svc.deleteListing(String(req.params.id), req.user!.id));
  }),
);

export default router;
