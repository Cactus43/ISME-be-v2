import type { FastifyRequest } from 'fastify';
import { BadRequestError } from '../Data/Exceptions/Index';


const BLOCKED_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

function FindUnsafePath(value: unknown, path: string[] = []): string | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i += 1) {
      const result = FindUnsafePath(value[i], [...path, `[${i}]`]);
      if (result) return result;
    }

    return null;
  }

  for (const key of Object.keys(value)) {
    if (BLOCKED_KEYS.has(key)) {
      return [...path, key].join('.');
    }

    const nested = FindUnsafePath((value as Record<string, unknown>)[key], [...path, key]);
    if (nested) {
      return nested;
    }
  }

  return null;
}


/**
 * Blocks payloads that attempt prototype pollution through reserved object keys.
 */
export async function PrototypePollutionGuard(req: FastifyRequest): Promise<void> {
  const bodyPath = FindUnsafePath(req.body, ['body']);
  if (bodyPath) {
    throw new BadRequestError(`Blocked unsafe key in request payload at ${bodyPath}`);
  }

  const queryPath = FindUnsafePath(req.query as unknown, ['query']);
  if (queryPath) {
    throw new BadRequestError(`Blocked unsafe key in request payload at ${queryPath}`);
  }

  const paramsPath = FindUnsafePath(req.params as unknown, ['params']);
  if (paramsPath) {
    throw new BadRequestError(`Blocked unsafe key in request payload at ${paramsPath}`);
  }
}
