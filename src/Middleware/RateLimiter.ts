import rateLimit from 'express-rate-limit';


// ─── Rate Limiters ─────────────────────────────────────────────────────────

/** General API limiter: 100 requests per minute per IP. */
export const API_LIMITER = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { status: 'error', message: 'Too many requests, please try again later' },
});

/** Auth limiter: 10 requests per minute per IP. */
export const AUTH_LIMITER = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { status: 'error', message: 'Too many login attempts, please try again later' },
});
