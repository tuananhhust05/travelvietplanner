import type { Request, Response, NextFunction } from 'express';
import { getRedis } from '../db/redis.js';
import { verifyAccessToken } from '../modules/auth/jwt.js';
import { ApiError } from './http.js';

interface Options {
  windowSec: number;
  max: number;
  keyBy: 'ip' | 'user';
}

/**
 * Resolve the acting user id without relying on `authenticate()` having run.
 *
 * Limiters are mounted on the router (app.ts) while `authenticate()` runs
 * *inside* it, so `req.user` is still undefined here. Verifying the bearer
 * token ourselves is what makes `keyBy: 'user'` an actual per-account bucket
 * instead of silently degrading to per-IP — which both lumped every user
 * behind a NAT into one bucket and let an IP-rotating attacker bypass the
 * per-account write limits entirely.
 *
 * Any failure (missing/malformed/expired/forged token) resolves to null so the
 * caller falls back to IP. This never throws.
 */
function resolveUserId(req: Request): string | null {
  try {
    if (req.user?.id) return req.user.id;
    const header = req.headers.authorization;
    if (typeof header !== 'string') return null;
    const [scheme, token] = header.split(' ');
    if (!token || scheme?.toLowerCase() !== 'bearer') return null;
    const claims = verifyAccessToken(token.trim());
    return typeof claims.sub === 'string' && claims.sub.length > 0 ? claims.sub : null;
  } catch {
    // Unverifiable token is not an error here — the router's authenticate()
    // owns rejecting it. We just cannot attribute the request to an account.
    return null;
  }
}

// Fixed-window counter in Redis. Values overridable via systemConfig later.
export function rateLimit(opts: Options) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const redis = getRedis();
      // `keyBy: 'ip'` behavior is unchanged. For 'user' we tag the identity kind
      // so an IP-fallback bucket can never collide with a real user-id bucket.
      let id = req.ip;
      if (opts.keyBy === 'user') {
        const userId = resolveUserId(req);
        id = userId ? `u:${userId}` : `ip:${req.ip}`;
      }
      const bucket = Math.floor(Date.now() / 1000 / opts.windowSec);
      const key = `rl:${opts.keyBy}:${req.baseUrl}:${id}:${bucket}`;
      const count = await redis.incr(key);
      if (count === 1) await redis.expire(key, opts.windowSec);
      res.setHeader('RateLimit-Limit', String(opts.max));
      res.setHeader('RateLimit-Remaining', String(Math.max(0, opts.max - count)));
      if (count > opts.max) {
        return next(new ApiError(429, 'rate_limited', 'Too many requests'));
      }
      next();
    } catch {
      // Fail-open on limiter infra error rather than blocking traffic.
      next();
    }
  };
}
