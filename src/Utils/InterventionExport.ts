import type { InterventionAttributes } from '../Data/Models/Intervention';

export type InterventionExportColumnKey =
  | 'id'
  | 'tag'
  | 'businessTeam'
  | 'unit'
  | 'interventionType'
  | 'priority'
  | 'status'
  | 'inspectionDate'
  | 'repairDate'
  | 'postDate'
  | 'location'
  | 'componentEquipment'
  | 'size'
  | 'operator'
  | 'competence'
  | 'service'
  | 'pressure'
  | 'nominalFlow'
  | 'steamFlowKg'
  | 'steamFlowTonne'
  | 'plumeLength'
  | 'plumeSpec'
  | 'malfunctioningType'
  | 'dischargerType'
  | 'dnDischarger'
  | 'scaffolding'
  | 'interceptionPossibility'
  | 'interceptionValveStatus'
  | 'needForInsulation'
  | 'asbestos'
  | 'steamDischargeToClosedSystem'
  | 'insulationMaterial'
  | 'metalSheet'
  | 'metalSheetTemperature'
  | 'pipeTemperature'
  | 'traitLength'
  | 'notification'
  | 'closureNotification'
  | 'interventionDescription'
  | 'reason'
  | 'createdAt'
  | 'updatedAt';

type ExportRow = InterventionAttributes & {
  Operator?: { firstname?: string | null; lastname?: string | null } | null;
};

interface InterventionExportColumn {
  Key: InterventionExportColumnKey;
  Header: string;
  GetValue: (row: ExportRow) => string | number;
}

const FormatDate = (value: Date | string | null | undefined): string => {
  if (!value) return '';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toISOString().slice(0, 10);
};

const FormatDateTime = (value: Date | string | null | undefined): string => {
  if (!value) return '';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toISOString().slice(0, 19).replace('T', ' ');
};

const FormatTriState = (value: number | null | undefined): string => {
  if (value === 1) return 'Si';
  if (value === 0) return 'No';
  return 'N/A';
};

const FormatStatus = (value: number | null | undefined): string => {
  if (value === 0 || value === 2 || value === 3) return 'Chiuso';
  return 'Aperto';
};

const FormatInterventionType = (value: number | null | undefined): string => {
  switch (value) {
    case 0:
      return 'Insulation Report';
    case 1:
      return 'Steam Leak';
    case 2:
      return 'Steam Trap';
    default:
      return value == null ? '' : String(value);
  }
};

const FormatOperator = (row: ExportRow): string => {
  const firstname = row.Operator?.firstname?.trim() ?? '';
  const lastname = row.Operator?.lastname?.trim() ?? '';
  return `${firstname} ${lastname}`.trim();
};

export const INTERVENTION_EXPORT_COLUMNS: InterventionExportColumn[] = [
  { Key: 'id', Header: 'ID', GetValue: (row) => row.id },
  { Key: 'tag', Header: 'Tag', GetValue: (row) => row.tag },
  { Key: 'businessTeam', Header: 'Business Team', GetValue: (row) => row.business_team },
  { Key: 'unit', Header: 'Unit', GetValue: (row) => row.unit ?? '' },
  { Key: 'interventionType', Header: 'Intervention Type', GetValue: (row) => FormatInterventionType(row.intervention_type) },
  { Key: 'priority', Header: 'Priority', GetValue: (row) => row.priority },
  { Key: 'status', Header: 'Status', GetValue: (row) => FormatStatus(row.status) },
  { Key: 'inspectionDate', Header: 'Inspection Date', GetValue: (row) => FormatDate(row.inspection_date) },
  { Key: 'repairDate', Header: 'Repair Date', GetValue: (row) => FormatDate(row.repair_date) },
  { Key: 'postDate', Header: 'Post Date', GetValue: (row) => row.post_date ?? '' },
  { Key: 'location', Header: 'Location', GetValue: (row) => row.location },
  { Key: 'componentEquipment', Header: 'Component Equipment', GetValue: (row) => row.component_equipment },
  { Key: 'size', Header: 'Size', GetValue: (row) => row.size ?? '' },
  { Key: 'operator', Header: 'Operator', GetValue: (row) => FormatOperator(row) },
  { Key: 'competence', Header: 'Competence', GetValue: (row) => row.competence ?? '' },
  { Key: 'service', Header: 'Service', GetValue: (row) => row.service ?? '' },
  { Key: 'pressure', Header: 'Pressure', GetValue: (row) => row.pressure ?? '' },
  { Key: 'nominalFlow', Header: 'Nominal Flow', GetValue: (row) => row.nominal_flow ?? '' },
  { Key: 'steamFlowKg', Header: 'Steam Flow (kg/h)', GetValue: (row) => row.steam_flow_kg ?? '' },
  { Key: 'steamFlowTonne', Header: 'Steam Flow (t/yr)', GetValue: (row) => row.steam_flow_tonne ?? '' },
  { Key: 'plumeLength', Header: 'Plume Length', GetValue: (row) => row.plume_length ?? '' },
  { Key: 'plumeSpec', Header: 'Plume Spec', GetValue: (row) => row.plume_spec ?? '' },
  { Key: 'malfunctioningType', Header: 'Malfunctioning Type', GetValue: (row) => row.malfunctioning_type ?? '' },
  { Key: 'dischargerType', Header: 'Discharger Type', GetValue: (row) => row.discharger_type ?? '' },
  { Key: 'dnDischarger', Header: 'DN Discharger', GetValue: (row) => row.dn_discharger ?? '' },
  { Key: 'scaffolding', Header: 'Scaffolding', GetValue: (row) => row.scaffolding ?? '' },
  { Key: 'interceptionPossibility', Header: 'Interception Possibility', GetValue: (row) => row.interception_possibility ?? '' },
  { Key: 'interceptionValveStatus', Header: 'Interception Valve Status', GetValue: (row) => FormatTriState(row.interception_valve_status) },
  { Key: 'needForInsulation', Header: 'Need For Insulation', GetValue: (row) => FormatTriState(row.need_for_insulation) },
  { Key: 'asbestos', Header: 'Asbestos', GetValue: (row) => FormatTriState(row.asbestos) },
  { Key: 'steamDischargeToClosedSystem', Header: 'Steam Discharge To Closed System', GetValue: (row) => FormatTriState(row.steam_discharge_to_closed_system) },
  { Key: 'insulationMaterial', Header: 'Insulation Material', GetValue: (row) => row.insulation_material ?? '' },
  { Key: 'metalSheet', Header: 'Metal Sheet', GetValue: (row) => row.metal_sheet ?? '' },
  { Key: 'metalSheetTemperature', Header: 'Metal Sheet Temperature', GetValue: (row) => row.metal_sheet_temperature ?? '' },
  { Key: 'pipeTemperature', Header: 'Pipe Temperature', GetValue: (row) => row.pipe_temperature ?? '' },
  { Key: 'traitLength', Header: 'Trait Length', GetValue: (row) => row.trait_length ?? '' },
  { Key: 'notification', Header: 'Notification', GetValue: (row) => row.notification ?? '' },
  { Key: 'closureNotification', Header: 'Closure Notification', GetValue: (row) => row.closure_notification ?? '' },
  { Key: 'interventionDescription', Header: 'Intervention Description', GetValue: (row) => row.intervention_description ?? '' },
  { Key: 'reason', Header: 'Reason', GetValue: (row) => row.reason ?? '' },
  { Key: 'createdAt', Header: 'Created At', GetValue: (row) => FormatDateTime(row.created_at) },
  { Key: 'updatedAt', Header: 'Updated At', GetValue: (row) => FormatDateTime(row.updated_at) },
];

export function ResolveInterventionExportColumns(keys?: string[]): InterventionExportColumn[] {
  if (!keys || keys.length === 0) return INTERVENTION_EXPORT_COLUMNS;

  const requested = new Set(keys);
  const selected = INTERVENTION_EXPORT_COLUMNS.filter((column) => requested.has(column.Key));
  return selected.length > 0 ? selected : INTERVENTION_EXPORT_COLUMNS;
}

function NormalizeExportCellValue(value: unknown): string | number {
  if (value == null) return '';
  if (typeof value === 'string' || typeof value === 'number') return value;
  return String(value);
}

export function BuildInterventionExportRow(row: ExportRow, columns: InterventionExportColumn[]): Array<string | number> {
  return columns.map((column) => NormalizeExportCellValue(column.GetValue(row)));
}
