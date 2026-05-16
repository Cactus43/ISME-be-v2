import { z } from 'zod';


// ─── Create Operator ───────────────────────────────────────────────────────

export const CREATE_OPERATOR_SCHEMA = z.object({
  firstname: z.string().min(1).max(255),
  lastname: z.string().min(1).max(255),
  email: z.string().email().optional().nullable(),
  username: z.string().min(1).max(128),
  password: z.string().min(4),
  team_id: z.number().int().positive().optional().nullable(),
  is_active: z.boolean().optional(),
});

export type CreateOperatorInput = z.infer<typeof CREATE_OPERATOR_SCHEMA>;


// ─── Update Operator ───────────────────────────────────────────────────────

export const UPDATE_OPERATOR_SCHEMA = z.object({
  firstname: z.string().min(1).max(255).optional(),
  lastname: z.string().min(1).max(255).optional(),
  email: z.string().email().optional().nullable(),
  username: z.string().min(1).max(128).optional(),
  password: z.string().min(4).optional(),
  team_id: z.number().int().positive().optional().nullable(),
  is_active: z.boolean().optional(),
});

export type UpdateOperatorInput = z.infer<typeof UPDATE_OPERATOR_SCHEMA>;
