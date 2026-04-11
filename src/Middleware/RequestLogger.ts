import type { IncomingMessage } from 'http';
import type { FastifyReply, FastifyRequest } from 'fastify';
import type { IAuthenticatedRequest } from '../Data/Types/Http';
import { Logger } from '../Utils/Logger';


const _httpLog = Logger.child({ module: 'http' });
const REQUEST_START_TIMES = new WeakMap<IncomingMessage, number>();


// ─── Request Logger ────────────────────────────────────────────────────────

/**
 * Tracks the start time for an incoming request.
 */
export async function TrackRequestStart(req: FastifyRequest): Promise<void> {
  REQUEST_START_TIMES.set(req.raw, Date.now());
}

/**
 * Logs every completed HTTP request with method, path, status code,
 * response time, IP, and authenticated user/operator context.
 */
export async function RequestLogger(req: FastifyRequest, reply: FastifyReply): Promise<void> {
  const start = REQUEST_START_TIMES.get(req.raw) ?? Date.now();
  REQUEST_START_TIMES.delete(req.raw);

  const duration = Date.now() - start;
  const status = reply.statusCode;
  const authReq = req as IAuthenticatedRequest;
  const url = req.raw.url ?? req.url;

  const logData: Record<string, unknown> = {
    method: req.method,
    url,
    status,
    duration: `${duration}ms`,
    ip: req.ip || req.socket.remoteAddress || '-',
  };

  if (authReq.User) {
    logData.userId = authReq.User.Id;
    logData.userEmail = authReq.User.Email;
    logData.username = authReq.User.Username;
  }

  if (status >= 500) {
    _httpLog.error(logData, `${req.method} ${url} ${status} ${duration}ms`);
  } else if (status >= 400) {
    _httpLog.warn(logData, `${req.method} ${url} ${status} ${duration}ms`);
  } else {
    _httpLog.info(logData, `${req.method} ${url} ${status} ${duration}ms`);
  }
}
