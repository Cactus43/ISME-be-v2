import type { FastifyReply, FastifyRequest } from 'fastify';


// ─── Rate Limiters ─────────────────────────────────────────────────────────

type RateLimiterOptions = {
  WindowMs: number;
  Max: number;
  Message: string;
  Skip?: (req: FastifyRequest) => boolean;
};

type RateLimitEntry = {
  Count: number;
  ResetAt: number;
};

const RATE_LIMIT_STORE = new Map<string, RateLimitEntry>();

function IsMediaFileRequest(req: FastifyRequest): boolean {
  if (req.method !== 'GET') {
    return false;
  }

  const path = req.raw.url?.split('?')[0] ?? req.url;
  return /^\/api\/media\/\d+\/file$/.test(path) || path.startsWith('/api/Images/');
}

function CleanupExpiredEntries(now: number): void {
  for (const [key, value] of RATE_LIMIT_STORE.entries()) {
    if (value.ResetAt <= now) {
      RATE_LIMIT_STORE.delete(key);
    }
  }
}

function SetRateLimitHeaders(reply: FastifyReply, max: number, remaining: number, resetAt: number): void {
  reply.header('RateLimit-Limit', max);
  reply.header('RateLimit-Remaining', Math.max(remaining, 0));
  reply.header('RateLimit-Reset', Math.max(Math.ceil((resetAt - Date.now()) / 1000), 0));
}

function CreateRateLimiter(options: RateLimiterOptions) {
  return async (req: FastifyRequest, reply: FastifyReply): Promise<void> => {
    if (options.Skip?.(req)) {
      return;
    }

    const now = Date.now();
    if (RATE_LIMIT_STORE.size > 5000) {
      CleanupExpiredEntries(now);
    }

    const key = `${req.ip}:${options.WindowMs}:${options.Max}:${req.url}`;
    const current = RATE_LIMIT_STORE.get(key);

    if (!current || current.ResetAt <= now) {
      const resetAt = now + options.WindowMs;
      RATE_LIMIT_STORE.set(key, { Count: 1, ResetAt: resetAt });
      SetRateLimitHeaders(reply, options.Max, options.Max - 1, resetAt);
      return;
    }

    current.Count += 1;
    SetRateLimitHeaders(reply, options.Max, options.Max - current.Count, current.ResetAt);

    if (current.Count > options.Max) {
      reply.status(429).send({ status: 'error', message: options.Message });
    }
  };
}

/** General API limiter: 100 requests per minute per IP. */
export const API_LIMITER = CreateRateLimiter({
  WindowMs: 60 * 1000,
  Max: 100,
  Skip: IsMediaFileRequest,
  Message: 'Too many requests, please try again later',
});

/** Auth limiter: 10 requests per minute per IP. */
export const AUTH_LIMITER = CreateRateLimiter({
  WindowMs: 60 * 1000,
  Max: 10,
  Message: 'Too many login attempts, please try again later',
});
