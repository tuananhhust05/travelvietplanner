import { Router } from 'express';
import { z } from 'zod';
import { ObjectId } from 'mongodb';
import { asyncHandler, ApiError } from '../../lib/http.js';
import { validateBody } from '../../lib/validate.js';
import { authenticate } from '../auth/middleware.js';
import { getDb } from '../../db/mongo.js';

const router = Router();

const itineraryStopSchema = z.object({
  name: z.string().min(1).max(200),
  note: z.string().max(500).optional(),
});

const itineraryDaySchema = z.object({
  day: z.number().int().min(1),
  title: z.string().min(1).max(200),
  stops: z.array(itineraryStopSchema),
  budget: z.string().max(100).optional(),
});

const createTripSchema = z.object({
  title: z.string().min(1).max(200),
  destination: z.string().max(200).optional(),
  startDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'startDate must be YYYY-MM-DD'),
  days: z.array(itineraryDaySchema).min(1),
  visibility: z.enum(['private', 'public']).optional(),
});

const updateVisibilitySchema = z.object({
  visibility: z.enum(['private', 'public']),
});

// POST /v1/trips — create a trip from itinerary planner
router.post(
  '/',
  authenticate(),
  validateBody(createTripSchema),
  asyncHandler(async (req, res) => {
    const { title, destination, startDate, days, visibility } = req.body as z.infer<typeof createTripSchema>;

    const start = new Date(startDate);
    const end = new Date(start);
    end.setDate(end.getDate() + (days.length - 1));
    const endDate = end.toISOString().slice(0, 10);

    const db = getDb();
    const result = await db.collection('trips').insertOne({
      userId: new ObjectId(req.user!.id),
      title,
      destination: destination ?? null,
      startDate,
      endDate,
      days,
      visibility: visibility ?? 'private',
      counts: { comments: 0 },
      createdAt: new Date(),
    });

    res.status(201).json({
      id: result.insertedId.toHexString(),
      title,
      destination: destination ?? null,
      startDate,
      endDate,
      visibility: visibility ?? 'private',
    });
  }),
);

// GET /v1/trips — list trips of authenticated user
router.get(
  '/',
  authenticate(),
  asyncHandler(async (req, res) => {
    const db = getDb();
    const trips = await db
      .collection('trips')
      .find({ userId: new ObjectId(req.user!.id) })
      .sort({ createdAt: -1 })
      .limit(50)
      .toArray();

    res.json(
      trips.map((t) => ({
        id: (t._id as ObjectId).toHexString(),
        title: t.title as string,
        destination: t.destination as string | null,
        startDate: t.startDate as string,
        endDate: t.endDate as string,
        visibility: (t.visibility as string | undefined) ?? 'private',
        dayCount: Array.isArray(t.days) ? (t.days as unknown[]).length : 0,
        commentCount: (t.counts as { comments?: number } | undefined)?.comments ?? 0,
        createdAt: t.createdAt as Date,
      })),
    );
  }),
);

// GET /v1/trips/:id — get full trip detail (owner always, others if public)
router.get(
  '/:id',
  authenticate(false),
  asyncHandler(async (req, res) => {
    const id = req.params.id as string;
    if (!ObjectId.isValid(id)) throw new ApiError(400, 'bad_id', 'Invalid trip id');

    const db = getDb();
    const trip = await db.collection('trips').findOne({ _id: new ObjectId(id) });

    if (!trip) throw new ApiError(404, 'not_found', 'Trip not found');

    const ownerId = (trip.userId as ObjectId).toHexString();
    const visibility = (trip.visibility as string | undefined) ?? 'private';
    const viewerId = req.user?.id ?? null;

    if (visibility !== 'public' && ownerId !== viewerId) {
      throw new ApiError(403, 'forbidden', 'Access denied');
    }

    // Populate the author (name, avatar, handle) so the UI can render a
    // Facebook-style author header without a second request.
    const owner = await db.collection('users').findOne(
      { _id: new ObjectId(ownerId) },
      { projection: { displayName: 1, handle: 1, avatarUrl: 1, accountType: 1 } },
    );

    res.json({
      id: (trip._id as ObjectId).toHexString(),
      userId: ownerId,
      title: trip.title,
      destination: trip.destination,
      startDate: trip.startDate,
      endDate: trip.endDate,
      days: trip.days,
      visibility,
      commentCount: (trip.counts as { comments?: number } | undefined)?.comments ?? 0,
      createdAt: trip.createdAt,
      author: owner
        ? {
            _id: ownerId,
            displayName: owner.displayName,
            handle: owner.handle,
            avatarUrl: owner.avatarUrl,
            accountType: owner.accountType,
          }
        : null,
    });
  }),
);

// PATCH /v1/trips/:id/visibility — toggle public/private
router.patch(
  '/:id/visibility',
  authenticate(),
  validateBody(updateVisibilitySchema),
  asyncHandler(async (req, res) => {
    const id = req.params.id as string;
    if (!ObjectId.isValid(id)) throw new ApiError(400, 'bad_id', 'Invalid trip id');

    const db = getDb();
    const trip = await db
      .collection('trips')
      .findOne({ _id: new ObjectId(id) }, { projection: { userId: 1 } });

    if (!trip) throw new ApiError(404, 'not_found', 'Trip not found');
    if ((trip.userId as ObjectId).toHexString() !== req.user!.id) {
      throw new ApiError(403, 'forbidden', 'Access denied');
    }

    const { visibility } = req.body as z.infer<typeof updateVisibilitySchema>;
    await db.collection('trips').updateOne(
      { _id: new ObjectId(id) },
      { $set: { visibility } },
    );

    res.json({ ok: true, visibility });
  }),
);

// DELETE /v1/trips/:id — delete a trip
router.delete(
  '/:id',
  authenticate(),
  asyncHandler(async (req, res) => {
    const id = req.params.id as string;
    if (!ObjectId.isValid(id)) throw new ApiError(400, 'bad_id', 'Invalid trip id');

    const db = getDb();
    const trip = await db.collection('trips').findOne(
      { _id: new ObjectId(id) },
      { projection: { userId: 1 } },
    );

    if (!trip) throw new ApiError(404, 'not_found', 'Trip not found');

    if ((trip.userId as ObjectId).toHexString() !== req.user!.id) {
      throw new ApiError(403, 'forbidden', 'Access denied');
    }

    await db.collection('trips').deleteOne({ _id: new ObjectId(id) });

    res.status(204).send();
  }),
);

export default router;
