import { Router } from 'express';
import { ApiError, asyncHandler } from '../../lib/http.js';
import { authenticate } from '../auth/middleware.js';
import { listCommunes, listProvinces, resolveAddress } from './geo.service.js';

const router = Router();

/** All province names, for the first level of an address picker. */
router.get(
  '/provinces',
  authenticate(false),
  asyncHandler(async (_req, res) => {
    res.json({ items: await listProvinces() });
  }),
);

/** Commune names within a province, for the second level of an address picker. */
router.get(
  '/communes',
  authenticate(false),
  asyncHandler(async (req, res) => {
    const province = typeof req.query.province === 'string' ? req.query.province.trim() : '';
    if (!province) {
      throw new ApiError(400, 'missing_province', 'province query param is required');
    }
    res.json({ items: await listCommunes(province) });
  }),
);

/**
 * Reverse-geocode a coordinate to a Vietnam admin address (commune + province).
 * Backed by the local `admin_boundaries` collection, so the client never has to
 * fall back to showing raw coordinates.
 */
router.get(
  '/resolve',
  authenticate(false),
  asyncHandler(async (req, res) => {
    const lat = Number(req.query.lat);
    const lng = Number(req.query.lng);
    if (!Number.isFinite(lat) || lat < -90 || lat > 90) {
      throw new ApiError(400, 'invalid_lat', 'lat must be a number between -90 and 90');
    }
    if (!Number.isFinite(lng) || lng < -180 || lng > 180) {
      throw new ApiError(400, 'invalid_lng', 'lng must be a number between -180 and 180');
    }
    const address = await resolveAddress(lat, lng);
    res.json({ address });
  }),
);

export default router;
