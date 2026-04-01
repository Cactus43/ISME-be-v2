import { Request, Response, NextFunction } from 'express';
import type { IAuthenticatedRequest } from '../Data/Types/Express';
import { Logger } from '../Utils/Logger';


const _httpLog = Logger.child({ module: 'http' });


// ─── Request Logger ────────────────────────────────────────────────────────

/**
 * Logs every incoming HTTP request with method, path, status code,
 * response time, IP, and authenticated user/operator context.
 */
export function RequestLogger(req: Request, res: Response, next: NextFunction): void {
  const start = Date.now();
  const { method, originalUrl } = req;
  const ip = req.ip || req.socket.remoteAddress || '-';

  res.on('finish', () => {
    const duration = Date.now() - start;
    const status = res.statusCode;
    const authReq = req as IAuthenticatedRequest;

    const logData: Record<string, unknown> = {
      method,
      url: originalUrl,
      status,
      duration: `${duration}ms`,
      ip,
    };

    // Attach auth context if present
    if (authReq.User) {
      logData.userId = authReq.User.Id;
      logData.userEmail = authReq.User.Email;
      logData.username = authReq.User.Username;
    }

    if (status >= 500) {
      _httpLog.error(logData, `${method} ${originalUrl} ${status} ${duration}ms`);
    } else if (status >= 400) {
      _httpLog.warn(logData, `${method} ${originalUrl} ${status} ${duration}ms`);
    } else {
      _httpLog.info(logData, `${method} ${originalUrl} ${status} ${duration}ms`);
    }
  });

  next();
}
