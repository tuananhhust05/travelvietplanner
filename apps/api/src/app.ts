import express, { type NextFunction, type Request, type RequestHandler } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { pinoHttp } from 'pino-http';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { randomUUID } from 'node:crypto';
import { config } from './config.js';
import { logger } from './logger.js';
import { notFound, errorHandler } from './lib/http.js';
import authRoutes from './modules/auth/auth.routes.js';
import postsRoutes from './modules/posts/posts.routes.js';
import plannerRoutes from './modules/planner/planner.routes.js';
import searchRoutes from './modules/search/search.routes.js';
import geoRoutes from './modules/geo/geo.routes.js';
import { rateLimit } from './lib/rateLimit.js';
import uploadsRoutes from './modules/uploads/uploads.routes.js';
import servicesRoutes from './modules/services/services.routes.js';
import listingsRoutes from './modules/listings/listings.routes.js';
import bookingsRoutes from './modules/bookings/bookings.routes.js';
import tripsRoutes from './modules/trips/trips.routes.js';
import messagesRoutes from './modules/messages/messages.routes.js';
import kbRoutes from './modules/kb/kb.routes.js';
import adminRoutes from './modules/admin/admin.routes.js';
import usersRoutes from './modules/users/users.routes.js';
import { commentsRoutes, postCommentsRoutes, tripCommentsRoutes } from './modules/comments/comments.routes.js';
import notificationsRoutes from './modules/notifications/notifications.routes.js';
import placesRoutes from './modules/places/places.routes.js';

/**
 * `rateLimit` derives its Redis key from `req.baseUrl` — the router MOUNT path,
 * not the request path. Two `keyBy: 'user'` limiters reachable under the same
 * prefix therefore share one counter. Mounting the 30/60s comment-write limiter
 * under `/v1/posts` as-is would land it in the same bucket as the existing
 * 300/60s posts limiter, so 31 feed reads would 429 the next comment.
 *
 * This gives a limiter its own key namespace instead. `baseUrl` is restored
 * before control passes downstream, so nothing else observes the substitution;
 * the swap spans a single `await` on one request object, never across requests.
 */
function scopedRateLimit(
  scope: string,
  opts: { windowSec: number; max: number; keyBy: 'ip' | 'user' },
): RequestHandler {
  const limiter = rateLimit(opts);
  return (req, res, next) => {
    const mutable = req as unknown as { baseUrl: string };
    const original = mutable.baseUrl;
    mutable.baseUrl = scope;
    const restore: NextFunction = (err?: unknown) => {
      mutable.baseUrl = original;
      next(err);
    };
    void limiter(req, res, restore);
  };
}

/**
 * Run `mw` only for requests matching `pred`. Lets a single mount point carry a
 * tight limiter on one write path without charging the prefix's reads for it.
 * `req.path` here is relative to the mount, e.g. `/<id>/comments`.
 */
function onlyWhen(pred: (req: Request) => boolean, mw: RequestHandler): RequestHandler {
  return (req, res, next) => {
    if (!pred(req)) return next();
    void mw(req, res, next);
  };
}

const COMMENTS_WRITE_PATH = /^\/[0-9a-fA-F]{24}\/comments\/?$/;
const COMMENT_REACTION_PATH = /^\/[0-9a-fA-F]{24}\/reactions\/?$/;

export function createApp() {
  const app = express();
  app.set('trust proxy', 1);

  app.use(
    pinoHttp({
      logger,
      genReqId: (req: IncomingMessage, res: ServerResponse) => {
        const id = (req.headers['x-request-id'] as string) ?? randomUUID();
        res.setHeader('x-request-id', id);
        return id;
      },
    }),
  );
  app.use(helmet());
  app.use(
    cors({
      origin: config.corsOrigins,
      credentials: true,
    }),
  );
  app.use(express.json({ limit: '1mb' }));
  app.use(cookieParser());

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', service: 'api', time: new Date().toISOString() });
  });

  // Auth endpoints get a stricter limiter. /auth/me is polled on every page load
  // and shares this bucket with /auth/switch-profile, so keep the cap generous
  // enough that normal navigation + profile switching never trips 429.
  app.use('/v1/auth', rateLimit({ windowSec: 900, max: 200, keyBy: 'ip' }), authRoutes);
  app.use('/v1/posts', rateLimit({ windowSec: 60, max: 300, keyBy: 'user' }), postsRoutes);

  // Comment creation, mounted on the same `/v1/posts` prefix and AFTER
  // postsRoutes. Safe: Express `/:id` matches exactly one segment, so
  // postsRoutes' `/:id` cannot swallow `/:id/comments`. The limiter is narrowed
  // to the write path so the 30/60s cap cannot be spent by GET traffic, and it
  // carries its own key scope so it does not share a bucket with the 300/60s
  // limiter above.
  app.use(
    '/v1/posts',
    onlyWhen(
      (req) => req.method === 'POST' && COMMENTS_WRITE_PATH.test(req.path),
      scopedRateLimit('/v1/posts/:id/comments', { windowSec: 60, max: 30, keyBy: 'user' }),
    ),
    postCommentsRoutes,
  );

  // Reaction writes get the tighter 60/60s cap; the prefix keeps the repo's
  // standard 300/60s for reads and deletes. Two limiters on one prefix, so the
  // reaction one needs its own key scope.
  app.use(
    '/v1/comments',
    rateLimit({ windowSec: 60, max: 300, keyBy: 'user' }),
    onlyWhen(
      (req) =>
        (req.method === 'PUT' || req.method === 'DELETE') && COMMENT_REACTION_PATH.test(req.path),
      scopedRateLimit('/v1/comments/:id/reactions', { windowSec: 60, max: 60, keyBy: 'user' }),
    ),
    commentsRoutes,
  );

  app.use('/v1/planner', plannerRoutes);
  app.use('/v1/search', rateLimit({ windowSec: 60, max: 120, keyBy: 'ip' }), searchRoutes);
  app.use('/v1/geo', rateLimit({ windowSec: 60, max: 120, keyBy: 'ip' }), geoRoutes);

  // Uploads had NO limiter. Comment image attachments turn that into an open
  // 25 MB write amplifier against host disk (`/data/uploads`), with no quota and
  // no cleanup behind it. `/v1/uploads` is a unique baseUrl, so the plain
  // limiter's key cannot collide with anything.
  app.use('/v1/uploads', rateLimit({ windowSec: 300, max: 40, keyBy: 'user' }), uploadsRoutes);
  app.use('/v1/services', rateLimit({ windowSec: 60, max: 300, keyBy: 'user' }), servicesRoutes);
  app.use('/v1/listings', rateLimit({ windowSec: 60, max: 300, keyBy: 'user' }), listingsRoutes);
  app.use('/v1/bookings', rateLimit({ windowSec: 60, max: 300, keyBy: 'user' }), bookingsRoutes);
  app.use('/v1/trips', rateLimit({ windowSec: 60, max: 300, keyBy: 'user' }), tripsRoutes);
  app.use(
    '/v1/trips',
    onlyWhen(
      (req) => req.method === 'POST' && COMMENTS_WRITE_PATH.test(req.path),
      scopedRateLimit('/v1/trips/:id/comments', { windowSec: 60, max: 30, keyBy: 'user' }),
    ),
    tripCommentsRoutes,
  );
  app.use('/v1/conversations', rateLimit({ windowSec: 60, max: 300, keyBy: 'user' }), messagesRoutes);
  app.use('/v1/kb', rateLimit({ windowSec: 60, max: 300, keyBy: 'user' }), kbRoutes);
  app.use('/v1/admin', rateLimit({ windowSec: 60, max: 300, keyBy: 'user' }), adminRoutes);
  app.use('/v1/users', rateLimit({ windowSec: 60, max: 300, keyBy: 'user' }), usersRoutes);

  // `/v1/notifications` is a unique baseUrl, so the plain limiter's Redis key
  // cannot collide with anything and no scoping is needed. The cap is the repo
  // standard rather than something tighter: the bell reads `/unread-count` on
  // every page load, and realtime pushes mean the page also refetches on each
  // incoming notification — a stingy limit here would 429 normal browsing.
  app.use(
    '/v1/notifications',
    rateLimit({ windowSec: 60, max: 300, keyBy: 'user' }),
    notificationsRoutes,
  );
  app.use('/v1/places', rateLimit({ windowSec: 60, max: 120, keyBy: 'ip' }), placesRoutes);

  app.use(notFound);
  app.use(errorHandler);
  return app;
}
