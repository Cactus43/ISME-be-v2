import { z } from 'zod';


// ─── Create Intervention (mobile sync) ─────────────────────────────────────

export const CREATE_INTERVENTION_SCHEMA = z.object({
  tag: z.string().min(1),
  business_team: z.string().min(1),
  unit: z.string().optional().nullable(),
  intervention_type: z.number().int().min(0).max(2).default(0),
  priority: z.number().int().min(0).max(3).default(0),
  status: z.number().int().min(0).max(3).default(0),
  location: z.string().min(1),
  component_equipment: z.string().min(1),
  size: z.string().optional().nullable(),
  operator_id: z.number().int().positive().optional().nullable(),
  inspection_date: z.string().min(1),
  device_id: z.number().int().positive().optional().nullable(),
  pressure: z.string().optional().nullable(),
  plume_length: z.string().optional().nullable(),
  plume_spec: z.union([z.string(), z.number()]).optional().nullable(),
  steam_flow_kg: z.number().optional().nullable().default(0),
  steam_flow_tonne: z.number().optional().nullable().default(0),
  nominal_flow: z.string().optional().nullable(),
  pipe_temperature: z.string().optional().nullable(),
  malfunctioning_type: z.union([z.string(), z.number()]).optional().nullable(),
  discharger_type: z.string().optional().nullable(),
  dn_discharger: z.string().optional().nullable(),
  service: z.string().optional().nullable(),
  steam_discharge_to_closed_system: z.union([z.string(), z.number()]).optional().nullable(),
  scaffolding: z.string().optional().nullable(),
  interception_possibility: z.union([z.string(), z.number()]).optional().nullable(),
  interception_valve_status: z.union([z.string(), z.number()]).optional().nullable(),
  competence: z.string().optional().nullable(),
  need_for_insulation: z.union([z.string(), z.number()]).optional().nullable(),
  insulation_material: z.string().optional().nullable(),
  metal_sheet: z.string().optional().nullable(),
  metal_sheet_temperature: z.string().optional().nullable(),
  trait_length: z.string().optional().nullable(),
  asbestos: z.union([z.string(), z.number()]).optional().nullable(),
  notification: z.number().int().optional().nullable(),
  closure_notification: z.string().optional().nullable(),
  repair_date: z.string().optional().nullable(),
  intervention_description: z.string().optional().nullable(),
  post_date: z.string().optional().nullable(),
  reason: z.string().optional().nullable(),

  // Photos sent as base64 from mobile (max ~10MB encoded)
  photo_before: z.string().max(14_000_000).optional().nullable(),
  photo_after: z.string().max(14_000_000).optional().nullable(),
});

export type CreateInterventionInput = z.infer<typeof CREATE_INTERVENTION_SCHEMA>;


// ─── Update Intervention (backoffice) ──────────────────────────────────────
// Mirrors all v1 editable fields. inspection_date, intervention_type excluded
// (read-only in v1 UI — always disabled). All other columns are optional.

export const UPDATE_INTERVENTION_SCHEMA = z.object({
  // Fieldset: Anagrafica Intervento
  tag: z.string().optional().nullable(),
  unit: z.string().optional().nullable(),
  business_team: z.string().optional().nullable(),
  location: z.string().optional().nullable(),
  competence: z.string().optional().nullable(),
  service: z.string().optional().nullable(),
  component_equipment: z.string().optional().nullable(),
  size: z.string().optional().nullable(),
  dn_discharger: z.string().optional().nullable(),
  operator_id: z.number().int().positive().optional().nullable(),
  notification: z.number().int().optional().nullable(),
  closure_notification: z.string().optional().nullable(),
  intervention_description: z.string().optional().nullable(),

  // Fieldset: Dettagli Intervento
  status: z.number().int().min(0).max(3).optional(),
  priority: z.number().int().min(0).max(3).optional(),

  // Fieldset: Dettagli di Campo
  malfunctioning_type: z.union([z.string(), z.number()]).optional().nullable(),
  discharger_type: z.string().optional().nullable(),
  plume_length: z.string().optional().nullable(),
  plume_spec: z.union([z.string(), z.number()]).optional().nullable(),
  need_for_insulation: z.union([z.string(), z.number()]).optional().nullable(),
  asbestos: z.union([z.string(), z.number()]).optional().nullable(),
  metal_sheet: z.string().optional().nullable(),
  metal_sheet_temperature: z.string().optional().nullable(),
  pipe_temperature: z.string().optional().nullable(),
  insulation_material: z.string().optional().nullable(),
  scaffolding: z.string().optional().nullable(),
  steam_discharge_to_closed_system: z.union([z.string(), z.number()]).optional().nullable(),
  trait_length: z.string().optional().nullable(),

  // Fieldset: Valvola
  interception_possibility: z.union([z.string(), z.number()]).optional().nullable(),
  interception_valve_status: z.union([z.string(), z.number()]).optional().nullable(),
  reason: z.string().optional().nullable(),

  // Fieldset: Valori Perdita
  pressure: z.string().optional().nullable(),
  nominal_flow: z.string().optional().nullable(),
  steam_flow_kg: z.number().optional().nullable(),
  steam_flow_tonne: z.number().optional().nullable(),

  // Fieldset: Tempo Intervento
  post_date: z.string().optional().nullable(),
  repair_date: z.string().optional().nullable(),
});

export type UpdateInterventionInput = z.infer<typeof UPDATE_INTERVENTION_SCHEMA>;


// ─── List Query ────────────────────────────────────────────────────────────

export const LIST_INTERVENTIONS_QUERY_SCHEMA = z.object({
  team: z.string().optional(),
  status: z.string().optional(),
  type: z.string().optional(),
  deleted: z.enum(['true', 'false']).optional().default('false'),
  page: z.string().optional().default('1'),
  limit: z.string().optional(),
  pageSize: z.string().optional(),
  search: z.string().optional(),
  sort: z.string().optional().default('created_at'),
  order: z.enum(['ASC', 'DESC', 'asc', 'desc']).optional().default('DESC'),
});

export type ListInterventionsQuery = z.infer<typeof LIST_INTERVENTIONS_QUERY_SCHEMA>;


// ─── Toggle Delete ─────────────────────────────────────────────────────────

export const TOGGLE_DELETE_SCHEMA = z.object({
  ids: z.array(z.number().int().positive()).min(1, 'At least one ID required'),
  deleted: z.boolean().optional().default(true),
});

export type ToggleDeleteInput = z.infer<typeof TOGGLE_DELETE_SCHEMA>;


// ─── Weekly Priority Tracking ─────────────────────────────────────────────

export const PRIORITY_TRACKING_QUERY_SCHEMA = z.object({
  weekStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  mode: z.enum(['planning', 'in_progress']).optional(),
});

export const MOBILE_SYNC_PULL_QUERY_SCHEMA = z.object({
  updatedAfter: z.string().optional(),
  cursor: z.string().optional(),
  syncPoint: z.string().optional(),
  limit: z.string().regex(/^\d+$/).optional(),
});

export const PRIORITY_TRACKING_UPDATE_SCHEMA = z.object({
  selection: z.boolean().optional(),
  ps9: z.boolean().optional(),
  po: z.boolean().optional(),
  workPermit: z.boolean().optional(),
  notInterceptable: z.boolean().optional(),
  rationale: z.enum([
    'Mancanza Operatore',
    'Difficolta Intercetto',
    'Mancanza materiali',
    'Permesso non aperto',
  ]).nullable().optional(),
});

export const PRIORITY_TRACKING_ADD_SCHEMA = z.object({
  interventionId: z.number().int().positive(),
})

export const APPROVAL_NOTE_UPDATE_SCHEMA = z.object({
  note: z.string().max(2000).nullable(),
})

export type PriorityTrackingQuery = z.infer<typeof PRIORITY_TRACKING_QUERY_SCHEMA>;
export type PriorityTrackingUpdateInput = z.infer<typeof PRIORITY_TRACKING_UPDATE_SCHEMA>;
export type PriorityTrackingAddInput = z.infer<typeof PRIORITY_TRACKING_ADD_SCHEMA>;
export type ApprovalNoteUpdateInput = z.infer<typeof APPROVAL_NOTE_UPDATE_SCHEMA>;
export type MobileSyncPullQuery = z.infer<typeof MOBILE_SYNC_PULL_QUERY_SCHEMA>;
