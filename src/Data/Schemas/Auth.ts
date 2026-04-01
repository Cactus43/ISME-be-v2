import { z } from 'zod';


// ─── Backoffice Login ──────────────────────────────────────────────────────

export const LOGIN_SCHEMA = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(1, 'Password is required'),
});

export type LoginInput = z.infer<typeof LOGIN_SCHEMA>;


// ─── Mobile Login ──────────────────────────────────────────────────────────

export const MOBILE_LOGIN_SCHEMA = z.object({
  username: z.string().min(1, 'Username is required'),
  password: z.string().min(1, 'Password is required'),
  deviceUuid: z.string().min(1, 'Device UUID is required'),
  deviceName: z.string().optional(),
  platform: z.enum(['android', 'ios', 'other']).optional().default('android'),
  osVersion: z.string().optional(),
  appVersion: z.string().optional(),
});

export type MobileLoginInput = z.infer<typeof MOBILE_LOGIN_SCHEMA>;
