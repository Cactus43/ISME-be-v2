import pino from 'pino';
import { Config } from '../Config/Index';


// ─── Logger ────────────────────────────────────────────────────────────────

export const Logger = pino({
  level: Config.LogLevel,
  transport:
    Config.Env === 'development'
      ? { target: 'pino/file', options: { destination: 1 } }
      : undefined,
  formatters: {
    level: (label: string) => ({ level: label }),
  },
  timestamp: pino.stdTimeFunctions.isoTime,
  base: { service: 'isme-backend' },
});
