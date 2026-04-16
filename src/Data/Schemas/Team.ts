import { z } from 'zod';


// ─── Create Team ───────────────────────────────────────────────────────────

export const CREATE_TEAM_SCHEMA = z.object({
  name: z.string().min(1).max(128),
  code: z.string().min(1).max(16),
  description: z.string().max(512).optional().nullable(),
  units: z.array(z.string().min(1).max(64)).optional().default([]),
});

export type CreateTeamInput = z.infer<typeof CREATE_TEAM_SCHEMA>;


// ─── Update Team ───────────────────────────────────────────────────────────

export const UPDATE_TEAM_SCHEMA = z.object({
  name: z.string().min(1).max(128).optional(),
  code: z.string().min(1).max(16).optional(),
  description: z.string().max(512).optional().nullable(),
  is_active: z.boolean().optional(),
  units: z.array(z.string().min(1).max(64)).optional(),
});

export type UpdateTeamInput = z.infer<typeof UPDATE_TEAM_SCHEMA>;
