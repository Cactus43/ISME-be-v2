import Fastify, { type FastifyInstance } from 'fastify';
import Cookie from '@fastify/cookie';
import Cors from '@fastify/cors';
import Helmet from '@fastify/helmet';
import Multipart from '@fastify/multipart';
import { Container } from './Infra/Container';
import { ErrorHandler } from './Middleware/ErrorHandler';
import { RequestLogger, TrackRequestStart } from './Middleware/RequestLogger';
import { API_LIMITER } from './Middleware/RateLimiter';
import { PrototypePollutionGuard } from './Middleware/PrototypePollutionGuard';
import { NotFoundError } from './Data/Exceptions/Index';
import { ImagesController } from './Controllers/ImagesController';


// ─── Fastify App ───────────────────────────────────────────────────────────

export async function BuildApp(): Promise<FastifyInstance> {
  const app = Fastify({
    logger: false,
    trustProxy: true,
    bodyLimit: 10 * 1024 * 1024,
  });


  // ─── Global Plugins ──────────────────────────────────────────────────────

  await app.register(Helmet);
  await app.register(Cors, {
    origin: true,
    credentials: true,
  });
  await app.register(Cookie);
  await app.register(Multipart, {
    limits: { fileSize: 10 * 1024 * 1024 },
  });

  app.addHook('onRequest', TrackRequestStart);
  app.addHook('onRequest', API_LIMITER);
  app.addHook('preValidation', PrototypePollutionGuard);
  app.addHook('onResponse', RequestLogger);


  // ─── Error / 404 Handling ──────────────────────────────────────────────
  // Must be registered BEFORE any `app.register(...)` that declares routes.
  // In Fastify 5 a custom error handler is encapsulated per plugin scope and
  // only applies to plugins registered after setErrorHandler() is called.
  // Registering it here ensures that all AppError subclasses thrown by any
  // controller are mapped to their real HTTP status (404, 400, 409, ...).

  app.setNotFoundHandler(async () => {
    throw new NotFoundError('Route not found');
  });

  app.setErrorHandler(ErrorHandler);


  // ─── Health Check ───────────────────────────────────────────────────────

  app.get('/health', async () => ({ status: 'ok', timestamp: new Date().toISOString() }));


  // ─── Routes ─────────────────────────────────────────────────────────────

  await app.register(async (instance) => {
    Container.AuthController.RegisterRoutes(instance);
  }, { prefix: '/api/auth' });

  await app.register(async (instance) => {
    Container.InterventionController.RegisterRoutes(instance);
  }, { prefix: '/api/interventions' });

  await app.register(async (instance) => {
    Container.MediaController.RegisterRoutes(instance);
  }, { prefix: '/api/media' });

  await app.register(async (instance) => {
    Container.TeamController.RegisterRoutes(instance);
  }, { prefix: '/api/teams' });

  await app.register(async (instance) => {
    Container.OperatorController.RegisterRoutes(instance);
  }, { prefix: '/api/operators' });

  await app.register(async (instance) => {
    Container.UnitController.RegisterRoutes(instance);
  }, { prefix: '/api/units' });

  await app.register(async (instance) => {
    new ImagesController().RegisterRoutes(instance);
  }, { prefix: '/api/Images' });


  return app;
}
