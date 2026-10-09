import type { Request, Response, NextFunction } from 'express';
import { ZodSchema } from 'zod';
import { ApiError } from './http.js';

export function validateBody<T>(schema: ZodSchema<T>) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      return next(new ApiError(422, 'validation_error', 'Invalid request body', result.error.flatten()));
    }
    req.body = result.data;
    next();
  };
}

export function validateQuery<T>(schema: ZodSchema<T>) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.query);
    if (!result.success) {
      return next(new ApiError(422, 'validation_error', 'Invalid query params', result.error.flatten()));
    }
    (req as Request & { validatedQuery: T }).validatedQuery = result.data;
    next();
  };
}
