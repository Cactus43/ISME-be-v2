import type { FastifyReply, FastifyRequest } from 'fastify';
import { AppError } from '../Data/Exceptions/Index';
import { Logger } from '../Utils/Logger';
import { Config } from '../Config/Index';


// ─── Error Handler ─────────────────────────────────────────────────────────

/**
 * Global error handler.
 */
export function ErrorHandler(
  err: Error | AppError,
  _req: FastifyRequest,
  reply: FastifyReply,
): void {

  if (err instanceof AppError) {
    if (err.StatusCode >= 500) {
      Logger.error({ err, statusCode: err.StatusCode }, err.message);
    } else {
      Logger.warn({ statusCode: err.StatusCode }, err.message);
    }

    reply.status(err.StatusCode).send({ status: 'error', message: err.message });
    return;
  }

  Logger.error({ err }, 'Unhandled error');

  const statusCode = 500;
  const message = Config.Env === 'production'
    ? 'Internal Server Error'
    : err.message || 'Internal Server Error';

  reply.status(statusCode).send({
    status: 'error',
    message,
    ...(Config.Env !== 'production' && { stack: err.stack }),
  });
}
