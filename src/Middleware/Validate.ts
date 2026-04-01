import { Request, Response, NextFunction } from 'express';
import { ZodSchema } from 'zod';
import { BadRequestError } from '../Data/Exceptions/Index';


// ─── Validation Middleware ─────────────────────────────────────────────────

/** Validates `req.body` against the given Zod schema. */
export function Validate(schema: ZodSchema) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    try {
      const result = schema.safeParse(req.body);

      if (!result.success) {
        const message = result.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join('; ');
        throw new BadRequestError(`Validation failed — ${message}`);
      }

      req.body = result.data;
      next();
    } catch (err) {
      next(err);
    }
  };
}

/** Validates `req.query` against the given Zod schema. */
export function ValidateQuery(schema: ZodSchema) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    try {
      const result = schema.safeParse(req.query);

      if (!result.success) {
        const message = result.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join('; ');
        throw new BadRequestError(`Query validation failed — ${message}`);
      }

      req.query = result.data;
      next();
    } catch (err) {
      next(err);
    }
  };
}
