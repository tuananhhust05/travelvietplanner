import { Router } from 'express';
import { z } from 'zod';
import { ApiError, asyncHandler } from '../../lib/http.js';
import { validateBody } from '../../lib/validate.js';
import { authenticate } from '../auth/middleware.js';
import * as svc from './bookings.service.js';

const router = Router();

const statusSchema = z.object({
  status: z.enum(['new', 'contacted', 'quoted', 'won', 'lost', 'spam']),
});

const createBookingSchema = z.object({
  serviceId: z.string().min(1).max(50),
  travelDate: z.string().optional(),
  pax: z.number().int().min(1).max(100).optional(),
  note: z.string().max(2000).optional(),
  contact: z
    .object({
      name: z.string().max(100).optional(),
      phone: z.string().max(50).optional(),
      email: z.string().max(200).optional(),
    })
    .optional(),
});

router.get(
  '/',
  authenticate(),
  asyncHandler(async (req, res) => {
    const status = typeof req.query.status === 'string' ? req.query.status : undefined;
    res.json(await svc.listBookings(req.user!.id, status));
  }),
);

// Only travelers can book tours — the active profile's role is baked into the
// JWT, so a guide/agency/business account cannot create bookings.
router.post(
  '/',
  authenticate(),
  validateBody(createBookingSchema),
  asyncHandler(async (req, res) => {
    if (!req.user!.roles.includes('traveler')) {
      throw new ApiError(403, 'forbidden', 'Only traveler accounts can book tours');
    }
    const result = await svc.createBooking({ fromUserId: req.user!.id, ...req.body });
    res.status(201).json(result);
  }),
);

// GET /mine?serviceId=xxx — traveler xem booking của mình
router.get(
  '/mine',
  authenticate(),
  asyncHandler(async (req, res) => {
    const serviceId = typeof req.query.serviceId === 'string' ? req.query.serviceId : undefined;
    res.json(await svc.listMyBookings(req.user!.id, serviceId));
  }),
);

// GET /:id — chi tiết một yêu cầu (guide hoặc traveler đều xem được).
// Phải khai báo sau /mine để không nuốt route đó.
router.get(
  '/:id',
  authenticate(),
  asyncHandler(async (req, res) => {
    res.json(await svc.getBooking(String(req.params.id), req.user!.id));
  }),
);

// PATCH /:id — traveler update booking của mình
const updateBookingSchema = z.object({
  travelDate: z.string().optional(),
  pax: z.number().int().min(1).max(100).optional(),
  note: z.string().max(2000).optional(),
  contact: z.object({
    name: z.string().max(100).optional(),
    phone: z.string().max(50).optional(),
    email: z.string().max(200).optional(),
  }).optional(),
});

router.patch(
  '/:id',
  authenticate(),
  validateBody(updateBookingSchema),
  asyncHandler(async (req, res) => {
    res.json(await svc.updateBooking(String(req.params.id), req.user!.id, req.body));
  }),
);

router.patch(
  '/:id/status',
  authenticate(),
  validateBody(statusSchema),
  asyncHandler(async (req, res) => {
    res.json(await svc.updateBookingStatus(String(req.params.id), req.user!.id, req.body.status));
  }),
);

export default router;