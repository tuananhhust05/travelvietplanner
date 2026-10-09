import type { Request, Response, NextFunction } from 'express';
import { verifyAccessToken } from './jwt.js';
import { can } from './rbac.js';
import { ApiError } from '../../lib/http.js';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: { id: string; roles: string[]; orgId?: string };
    }
  }
}

export function authenticate(required = true) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const header = req.headers.authorization;
    const token = header?.startsWith('Bearer ') ? header.slice(7) : undefined;
    if (!token) {
      if (required) return next(new ApiError(401, 'unauthorized', 'Missing bearer token'));
      return next();
    }
    try {
      const claims = verifyAccessToken(token);
      req.user = { id: claims.sub, roles: claims.roles ?? [], orgId: claims.orgId };
      next();
    } catch {
      next(new ApiError(401, 'unauthorized', 'Invalid or expired token'));
    }
  };
}

export function requirePermission(permission: string) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) return next(new ApiError(401, 'unauthorized', 'Auth required'));
    if (!can(req.user.roles, permission)) {
      return next(new ApiError(403, 'forbidden', `Missing permission: ${permission}`));
    }
    next();
  };
}
