import type { FastifyRequest } from 'fastify';
import { ZodSchema } from 'zod';
import { BadRequestError } from '../Data/Exceptions/Index';


// ─── Validation Middleware ─────────────────────────────────────────────────

/** Validates `req.body` against the given Zod schema. */
export function Validate(schema: ZodSchema) {
  return async (req: FastifyRequest): Promise<void> => {
    const result = schema.safeParse(req.body);

    if (!result.success) {
      const message = result.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join('; ');
      throw new BadRequestError(`Validation failed — ${message}`);
    }

    ;(req as FastifyRequest & { body: unknown }).body = result.data;
  };
}

/** Validates `req.query` against the given Zod schema. */
export function ValidateQuery(schema: ZodSchema) {
  return async (req: FastifyRequest): Promise<void> => {
    const result = schema.safeParse(req.query);

    if (!result.success) {
      const message = result.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join('; ');
      throw new BadRequestError(`Query validation failed — ${message}`);
    }

    ;(req as FastifyRequest & { query: unknown }).query = result.data;
  };
}
