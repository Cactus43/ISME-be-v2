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
    new ImagesController().RegisterRoutes(instance);
  }, { prefix: '/api/Images' });


  // ─── 404 / Error Handling ───────────────────────────────────────────────

  app.setNotFoundHandler(async () => {
    throw new NotFoundError('Route not found');
  });

  app.setErrorHandler(ErrorHandler);

  return app;
}
