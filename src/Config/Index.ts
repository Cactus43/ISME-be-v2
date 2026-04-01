import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '..', '..', '.env') });


// ─── Helpers ───────────────────────────────────────────────────────────────

function _required(key: string): string {
  const value = process.env[key];
  if (!value) throw new Error(`Missing required environment variable: ${key}`);
  return value;
}

function _optional(key: string, fallback: string): string {
  return process.env[key] ?? fallback;
}


// ─── Config ────────────────────────────────────────────────────────────────

export const Config = {

  Env: _optional('NODE_ENV', 'development') as 'development' | 'production' | 'test',

  Port: parseInt(_optional('PORT', '8081'), 10),

  Db: {
    Host: _required('DB_HOST'),
    Port: parseInt(_optional('DB_PORT', '3306'), 10),
    Name: _required('DB_NAME'),
    User: _required('DB_USER'),
    Password: _required('DB_PASSWORD'),
    Pool: {
      Max: parseInt(_optional('DB_POOL_MAX', '10'), 10),
      Min: parseInt(_optional('DB_POOL_MIN', '2'), 10),
      Acquire: 30_000,
      Idle: 10_000,
    },
  },

  Jwt: {
    Secret: _required('JWT_SECRET'),
    Algorithm: _optional('JWT_ALGORITHM', 'HS512') as 'HS256' | 'HS384' | 'HS512',
    SessionMinutes: parseInt(_optional('JWT_SESSION_MINUTES', '1440'), 10),
  },

  Cors: {
    Origins: _optional('CORS_ORIGINS', 'http://localhost:3001').split(',').map(s => s.trim()),
  },

  Cookie: {
    Secure: _optional('COOKIE_SECURE', 'false') === 'true',
  },

  DataPath: path.resolve(_optional('DATA_PATH', './data')),

  LogLevel: _optional('LOG_LEVEL', 'info') as 'fatal' | 'error' | 'warn' | 'info' | 'debug' | 'trace',

} as const;
