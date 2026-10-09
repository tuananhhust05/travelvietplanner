import { Router, type Request } from 'express';
import { ObjectId } from 'mongodb';
import { ApiError, asyncHandler } from '../../lib/http.js';
import { authenticate } from '../auth/middleware.js';
import {
  countUnread,
  listNotifications,
  markAllRead,
  markRead,
} from './notifications.service.js';

/** Strict 24-hex — `ObjectId.isValid` accepts any 12-char string. */
const OBJECT_ID_RE = /^[0-9a-fA-F]{24}$/;

/** Malformed id is a client error at the edge; absence is the service's concern. */
function pathOid(raw: unknown, message: string): ObjectId {
  if (typeof raw !== 'string' || !OBJECT_ID_RE.test(raw)) {
    throw new ApiError(400, 'bad_id', message);
  }
  return new ObjectId(raw);
}

/**
 * Every route here is `authenticate()`, so a missing token already 401'd. This
 * only guards a signed token whose `sub` is not an ObjectId — 401 rather than a
 * 500 from the driver.
 */
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

/**
 * Mounted on `/v1/notifications`.
 *
 * A notification list is inherently private, so there is no `authenticate(false)`
 * route in here — unlike comments and reactions, there is nothing a guest may read.
 *
 * ORDER MATTERS: the static paths are declared before `/:id/read` so a literal
 * segment can never be captured as an id. There is deliberately no bare `/:id`.
 */
const notificationsRoutes = Router();

notificationsRoutes.get(
  '/',
  authenticate(),
  asyncHandler(async (req, res) => {
    res.json(
      await listNotifications(actorOid(req), {
        limit: parseLimit(req.query.limit, 20),
        before: queryString(req.query.before),
        // Matches the page's "Chưa đọc" filter. Any other value reads as false.
        unreadOnly: req.query.filter === 'unread',
      }),
    );
  }),
);

/**
 * Just the badge number. The bell needs this on every page load and must not pay
 * for a full page of rows plus the actor hydration to get it.
 */
notificationsRoutes.get(
  '/unread-count',
  authenticate(),
  asyncHandler(async (req, res) => {
    res.json({ unreadCount: await countUnread(actorOid(req)) });
  }),
);

notificationsRoutes.post(
  '/read-all',
  authenticate(),
  asyncHandler(async (req, res) => {
    res.json(await markAllRead(actorOid(req)));
  }),
);

// `/:id/read` last — see the ORDER MATTERS note above.
notificationsRoutes.post(
  '/:id/read',
  authenticate(),
  asyncHandler(async (req, res) => {
    const id = pathOid(req.params.id, 'Invalid notification id');
    // The service scopes the update by userId, so somebody else's id is a no-op
    // rather than a leak — and an already-read row returns the same 200.
    res.json(await markRead(actorOid(req), id));
  }),
);

export default notificationsRoutes;
