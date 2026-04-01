import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { Container } from './Infra/Container';
import { ErrorHandler } from './Middleware/ErrorHandler';
import { RequestLogger } from './Middleware/RequestLogger';
import { API_LIMITER } from './Middleware/RateLimiter';
import { NotFoundError } from './Data/Exceptions/Index';
import { ImagesController } from './Controllers/ImagesController';


// ─── Express App ───────────────────────────────────────────────────────────

const app = express();


// ─── Global Middleware ─────────────────────────────────────────────────────

app.use(helmet());
app.use(RequestLogger);
app.use(cors({
  origin: true,   // Allow ALL origins — Electron sends null/file:// origin
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(API_LIMITER);


// ─── Health Check ──────────────────────────────────────────────────────────

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});


// ─── Routes ────────────────────────────────────────────────────────────────

app.use('/api/auth', Container.AuthController.Router);
app.use('/api/interventions', Container.InterventionController.Router);
app.use('/api/media', Container.MediaController.Router);
app.use('/api/teams', Container.TeamController.Router);
app.use('/api/operators', Container.OperatorController.Router);
app.use('/api/Images', new ImagesController().Router);


// ─── 404 Catch-All ─────────────────────────────────────────────────────────

app.use((_req, _res, next) => {
  next(new NotFoundError('Route not found'));
});


// ─── Error Handler ─────────────────────────────────────────────────────────

app.use(ErrorHandler);


export { app };
