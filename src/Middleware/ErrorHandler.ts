import { Request, Response, NextFunction } from 'express';
import { AppError } from '../Data/Exceptions/Index';
import { Logger } from '../Utils/Logger';
import { Config } from '../Config/Index';


// ─── Error Handler ─────────────────────────────────────────────────────────

/**
 * Global error handler middleware.
 * Must be registered LAST in the Express middleware chain.
 */
export function ErrorHandler(
  err: Error | AppError,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {

  if (err instanceof AppError) {
    if (err.StatusCode >= 500) {
      Logger.error({ err, statusCode: err.StatusCode }, err.message);
    } else {
      Logger.warn({ statusCode: err.StatusCode }, err.message);
    }

    res.status(err.StatusCode).json({ status: 'error', message: err.message });
    return;
  }

  Logger.error({ err }, 'Unhandled error');

  const statusCode = 500;
  const message = Config.Env === 'production'
    ? 'Internal Server Error'
    : err.message || 'Internal Server Error';

  res.status(statusCode).json({
    status: 'error',
    message,
    ...(Config.Env !== 'production' && { stack: err.stack }),
  });
}
