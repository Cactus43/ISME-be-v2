import type { InterventionAttributes } from '../../Models/Intervention';


// ─── InterventionDTO ───────────────────────────────────────────────────────

export interface InterventionDTO {
  Id: number;

  // Identity
  Tag: string;
  BusinessTeam: string;
  Unit: string | null;

  // Classification
  InterventionType: number;
  Priority: number;
  Status: number;

  // Location & Equipment
  Location: string;
  ComponentEquipment: string;
  Size: string | null;

  // Inspection
  OperatorId: number | null;
  InspectionDate: Date;
  DeviceId: number | null;

  // Measurements
  Pressure: string | null;
  PlumeLength: string | null;
  PlumeSpec: string | null;
  SteamFlowKg: number | null;
  SteamFlowTonne: number | null;
  NominalFlow: string | null;
  PipeTemperature: string | null;

  // Steam Trap
  MalfunctioningType: string | null;
  DischargerType: string | null;
  DnDischarger: string | null;
  Service: string | null;
  SteamDischargeToClosedSystem: number | null;

  // Logistics
  Scaffolding: string | null;
  InterceptionPossibility: string | null;
  InterceptionValveStatus: number | null;
  Competence: string | null;
  NeedForInsulation: number | null;
  InsulationMaterial: string | null;
  MetalSheet: string | null;
  MetalSheetTemperature: string | null;
  TraitLength: string | null;
  Asbestos: number | null;

  // Notifications
  Notification: number | null;
  ClosureNotification: string | null;

  // Repair
  RepairDate: Date | null;
  InterventionDescription: string | null;
  PostDate: string | null;
  Reason: string | null;

  // Audit
  CreatedBy: number | null;
  UpdatedBy: number | null;
  RowVersion: number;
  DeletedAt: Date | null;
  DeletedBy: number | null;
  UpdatedAt: Date;
  CreatedAt: Date;

  // Mobile photo sync hints
  PhotoBeforeMediaId?: number | null;
  PhotoBeforeFilename?: string | null;
  PhotoAfterMediaId?: number | null;
  PhotoAfterFilename?: string | null;
}


// ─── Factory ───────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-redeclare
export const InterventionDTO = {

  FromModel(m: InterventionAttributes): InterventionDTO {
    const mediaRows = ((m as any).Media ?? []) as Array<{
      id: number;
      media_type: string;
      filename: string;
    }>;

    const photoBefore = mediaRows.find((row) => row.media_type === 'photo_before') ?? null;
    const photoAfter = mediaRows.find((row) => row.media_type === 'photo_after') ?? null;

    return {
      Id: m.id,
      Tag: m.tag,
      BusinessTeam: m.business_team,
      Unit: m.unit,
      InterventionType: m.intervention_type,
      Priority: m.priority,
      Status: m.status,
      Location: m.location,
      ComponentEquipment: m.component_equipment,
      Size: m.size,
      OperatorId: m.operator_id,
      InspectionDate: m.inspection_date,
      DeviceId: m.device_id,
      Pressure: m.pressure,
      PlumeLength: m.plume_length,
      PlumeSpec: m.plume_spec,
      SteamFlowKg: m.steam_flow_kg,
      SteamFlowTonne: m.steam_flow_tonne,
      NominalFlow: m.nominal_flow,
      PipeTemperature: m.pipe_temperature,
      MalfunctioningType: m.malfunctioning_type,
      DischargerType: m.discharger_type,
      DnDischarger: m.dn_discharger,
      Service: m.service,
      SteamDischargeToClosedSystem: m.steam_discharge_to_closed_system,
      Scaffolding: m.scaffolding,
      InterceptionPossibility: m.interception_possibility,
      InterceptionValveStatus: m.interception_valve_status,
      Competence: m.competence,
      NeedForInsulation: m.need_for_insulation,
      InsulationMaterial: m.insulation_material,
      MetalSheet: m.metal_sheet,
      MetalSheetTemperature: m.metal_sheet_temperature,
      TraitLength: m.trait_length,
      Asbestos: m.asbestos,
      Notification: m.notification,
      ClosureNotification: m.closure_notification,
      RepairDate: m.repair_date,
      InterventionDescription: m.intervention_description,
      PostDate: m.post_date,
      Reason: m.reason,
      CreatedBy: m.created_by,
      UpdatedBy: m.updated_by,
      RowVersion: Number(m.row_version ?? 0),
      DeletedAt: m.deleted_at,
      DeletedBy: m.deleted_by,
      UpdatedAt: m.updated_at,
      CreatedAt: m.created_at,
      PhotoBeforeMediaId: photoBefore?.id ?? null,
      PhotoBeforeFilename: photoBefore?.filename ?? null,
      PhotoAfterMediaId: photoAfter?.id ?? null,
      PhotoAfterFilename: photoAfter?.filename ?? null,
    };
  },
};
