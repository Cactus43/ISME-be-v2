import { BadRequestError } from '../Data/Exceptions/Index';


// ─── ParseId ───────────────────────────────────────────────────────────────

/**
 * Parse and validate a route parameter as a positive integer.
 * Throws BadRequestError if the value is not a valid integer > 0.
 */
export function ParseId(value: string | string[] | undefined, paramName = 'id'): number {
  const raw = Array.isArray(value) ? value[0] : value;
  const num = Number(raw);
  if (!Number.isInteger(num) || num <= 0) {
    throw new BadRequestError(`Invalid ${paramName}: must be a positive integer`);
  }
  return num;
}
