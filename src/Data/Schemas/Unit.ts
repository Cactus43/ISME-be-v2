import { z } from 'zod';


// ─── Create Unit ───────────────────────────────────────────────────────────

export const CREATE_UNIT_SCHEMA = z.object({
  name: z.string().min(1).max(64),
  team_id: z.number().int().positive(),
  is_active: z.boolean().optional(),
});

export type CreateUnitInput = z.infer<typeof CREATE_UNIT_SCHEMA>;


// ─── Update Unit ───────────────────────────────────────────────────────────

export const UPDATE_UNIT_SCHEMA = z.object({
  name: z.string().min(1).max(64).optional(),
  team_id: z.number().int().positive().optional(),
  is_active: z.boolean().optional(),
});

export type UpdateUnitInput = z.infer<typeof UPDATE_UNIT_SCHEMA>;
