import { Router } from 'express';
import { ApiError, asyncHandler } from '../../lib/http.js';
import { authenticate } from '../auth/middleware.js';
import { listPlaces, getPlaceBySlug } from './places.service.js';

const router = Router();

router.get(
  '/',
  authenticate(false),
  asyncHandler(async (req, res) => {
    const type = typeof req.query.type === 'string' ? req.query.type.trim() : undefined;
    const province = typeof req.query.province === 'string' ? req.query.province.trim() : undefined;
    const region = typeof req.query.region === 'string' ? req.query.region.trim() : undefined;
    const limit = Math.min(parseInt(String(req.query.limit ?? '20'), 10) || 20, 100);
    const offset = parseInt(String(req.query.offset ?? '0'), 10) || 0;

    const result = await listPlaces({ type, province, region, limit, offset });
    res.json(result);
  }),
);

router.get(
  '/:slug',
  authenticate(false),
  asyncHandler(async (req, res) => {
    const slug = typeof req.params['slug'] === 'string' ? req.params['slug'] : '';
    if (!slug || !/^[a-z0-9-]+$/.test(slug)) {
      throw new ApiError(400, 'invalid_slug', 'Invalid place slug');
    }
    const place = await getPlaceBySlug(slug);
    if (!place) throw new ApiError(404, 'not_found', 'Place not found');
    res.json(place);
  }),
);

export default router;
