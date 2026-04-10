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

export type ExportLanguage = 'it' | 'en';

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

const HeaderByLanguage: Record<ExportLanguage, Record<InterventionExportColumnKey, string>> = {
  it: {
    id: 'ID',
    tag: 'Tag',
    businessTeam: 'Business Team',
    unit: 'Unita',
    interventionType: 'Tipo Intervento',
    priority: 'Priorita',
    status: 'Stato',
    inspectionDate: 'Data Ispezione',
    repairDate: 'Data Riparazione',
    postDate: 'Post Date',
    location: 'Ubicazione',
    componentEquipment: 'Componente/Equipaggiamento',
    size: 'Misura',
    operator: 'Operatore',
    competence: 'Competenza',
    service: 'Servizio',
    pressure: 'Pressione',
    nominalFlow: 'Portata Nominale',
    steamFlowKg: 'Portata Vapore (kg/h)',
    steamFlowTonne: 'Portata Vapore (t/anno)',
    plumeLength: 'Lunghezza Pennacchio',
    plumeSpec: 'Spec Pennacchio',
    malfunctioningType: 'Tipo Malfunzionamento',
    dischargerType: 'Tipo Scaricatore',
    dnDischarger: 'DN Scaricatore',
    scaffolding: 'Ponteggio',
    interceptionPossibility: 'Possibilita Intercetto',
    interceptionValveStatus: 'Stato Valvola Intercetto',
    needForInsulation: 'Necessita Scoibentazione',
    asbestos: 'Amianto',
    steamDischargeToClosedSystem: 'Scarico Vapore in Sistema Chiuso',
    insulationMaterial: 'Materiale Isolante',
    metalSheet: 'Lamierino',
    metalSheetTemperature: 'Temperatura Lamierino',
    pipeTemperature: 'Temperatura Tubazione',
    traitLength: 'Lunghezza Tratto',
    notification: 'Notifica',
    closureNotification: 'Notifica Chiusura',
    interventionDescription: 'Descrizione Intervento',
    reason: 'Motivazione',
    createdAt: 'Creato Il',
    updatedAt: 'Aggiornato Il',
  },
  en: {
    id: 'ID',
    tag: 'Tag',
    businessTeam: 'Business Team',
    unit: 'Unit',
    interventionType: 'Intervention Type',
    priority: 'Priority',
    status: 'Status',
    inspectionDate: 'Inspection Date',
    repairDate: 'Repair Date',
    postDate: 'Post Date',
    location: 'Location',
    componentEquipment: 'Component Equipment',
    size: 'Size',
    operator: 'Operator',
    competence: 'Competence',
    service: 'Service',
    pressure: 'Pressure',
    nominalFlow: 'Nominal Flow',
    steamFlowKg: 'Steam Flow (kg/h)',
    steamFlowTonne: 'Steam Flow (t/yr)',
    plumeLength: 'Plume Length',
    plumeSpec: 'Plume Spec',
    malfunctioningType: 'Malfunctioning Type',
    dischargerType: 'Discharger Type',
    dnDischarger: 'DN Discharger',
    scaffolding: 'Scaffolding',
    interceptionPossibility: 'Interception Possibility',
    interceptionValveStatus: 'Interception Valve Status',
    needForInsulation: 'Need For Insulation',
    asbestos: 'Asbestos',
    steamDischargeToClosedSystem: 'Steam Discharge To Closed System',
    insulationMaterial: 'Insulation Material',
    metalSheet: 'Metal Sheet',
    metalSheetTemperature: 'Metal Sheet Temperature',
    pipeTemperature: 'Pipe Temperature',
    traitLength: 'Trait Length',
    notification: 'Notification',
    closureNotification: 'Closure Notification',
    interventionDescription: 'Intervention Description',
    reason: 'Reason',
    createdAt: 'Created At',
    updatedAt: 'Updated At',
  },
};

const FormatTriState = (value: number | null | undefined, language: ExportLanguage): string => {
  if (value === 1) return language === 'en' ? 'Yes' : 'Si';
  if (value === 0) return language === 'en' ? 'No' : 'No';
  return language === 'en' ? 'N/A' : 'N/D';
};

const FormatStatus = (value: number | null | undefined, language: ExportLanguage): string => {
  if (value === 0 || value === 2 || value === 3) return language === 'en' ? 'Closed' : 'Chiuso';
  return language === 'en' ? 'Open' : 'Aperto';
};

const FormatInterventionType = (value: number | null | undefined): string => {
  switch (value) {
    case 0:
      return 'Insulation';
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

function GetInterventionExportColumns(language: ExportLanguage): InterventionExportColumn[] {
  const H = HeaderByLanguage[language];
  return [
    { Key: 'id', Header: H.id, GetValue: (row) => row.id },
    { Key: 'tag', Header: H.tag, GetValue: (row) => row.tag },
    { Key: 'businessTeam', Header: H.businessTeam, GetValue: (row) => row.business_team },
    { Key: 'unit', Header: H.unit, GetValue: (row) => row.unit ?? '' },
    { Key: 'interventionType', Header: H.interventionType, GetValue: (row) => FormatInterventionType(row.intervention_type) },
    { Key: 'priority', Header: H.priority, GetValue: (row) => row.priority },
    { Key: 'status', Header: H.status, GetValue: (row) => FormatStatus(row.status, language) },
    { Key: 'inspectionDate', Header: H.inspectionDate, GetValue: (row) => FormatDate(row.inspection_date) },
    { Key: 'repairDate', Header: H.repairDate, GetValue: (row) => FormatDate(row.repair_date) },
    { Key: 'postDate', Header: H.postDate, GetValue: (row) => row.post_date ?? '' },
    { Key: 'location', Header: H.location, GetValue: (row) => row.location },
    { Key: 'componentEquipment', Header: H.componentEquipment, GetValue: (row) => row.component_equipment },
    { Key: 'size', Header: H.size, GetValue: (row) => row.size ?? '' },
    { Key: 'operator', Header: H.operator, GetValue: (row) => FormatOperator(row) },
    { Key: 'competence', Header: H.competence, GetValue: (row) => row.competence ?? '' },
    { Key: 'service', Header: H.service, GetValue: (row) => row.service ?? '' },
    { Key: 'pressure', Header: H.pressure, GetValue: (row) => row.pressure ?? '' },
    { Key: 'nominalFlow', Header: H.nominalFlow, GetValue: (row) => row.nominal_flow ?? '' },
    { Key: 'steamFlowKg', Header: H.steamFlowKg, GetValue: (row) => row.steam_flow_kg ?? '' },
    { Key: 'steamFlowTonne', Header: H.steamFlowTonne, GetValue: (row) => row.steam_flow_tonne ?? '' },
    { Key: 'plumeLength', Header: H.plumeLength, GetValue: (row) => row.plume_length ?? '' },
    { Key: 'plumeSpec', Header: H.plumeSpec, GetValue: (row) => row.plume_spec ?? '' },
    { Key: 'malfunctioningType', Header: H.malfunctioningType, GetValue: (row) => row.malfunctioning_type ?? '' },
    { Key: 'dischargerType', Header: H.dischargerType, GetValue: (row) => row.discharger_type ?? '' },
    { Key: 'dnDischarger', Header: H.dnDischarger, GetValue: (row) => row.dn_discharger ?? '' },
    { Key: 'scaffolding', Header: H.scaffolding, GetValue: (row) => row.scaffolding ?? '' },
    { Key: 'interceptionPossibility', Header: H.interceptionPossibility, GetValue: (row) => row.interception_possibility ?? '' },
    { Key: 'interceptionValveStatus', Header: H.interceptionValveStatus, GetValue: (row) => FormatTriState(row.interception_valve_status, language) },
    { Key: 'needForInsulation', Header: H.needForInsulation, GetValue: (row) => FormatTriState(row.need_for_insulation, language) },
    { Key: 'asbestos', Header: H.asbestos, GetValue: (row) => FormatTriState(row.asbestos, language) },
    { Key: 'steamDischargeToClosedSystem', Header: H.steamDischargeToClosedSystem, GetValue: (row) => FormatTriState(row.steam_discharge_to_closed_system, language) },
    { Key: 'insulationMaterial', Header: H.insulationMaterial, GetValue: (row) => row.insulation_material ?? '' },
    { Key: 'metalSheet', Header: H.metalSheet, GetValue: (row) => row.metal_sheet ?? '' },
    { Key: 'metalSheetTemperature', Header: H.metalSheetTemperature, GetValue: (row) => row.metal_sheet_temperature ?? '' },
    { Key: 'pipeTemperature', Header: H.pipeTemperature, GetValue: (row) => row.pipe_temperature ?? '' },
    { Key: 'traitLength', Header: H.traitLength, GetValue: (row) => row.trait_length ?? '' },
    { Key: 'notification', Header: H.notification, GetValue: (row) => row.notification ?? '' },
    { Key: 'closureNotification', Header: H.closureNotification, GetValue: (row) => row.closure_notification ?? '' },
    { Key: 'interventionDescription', Header: H.interventionDescription, GetValue: (row) => row.intervention_description ?? '' },
    { Key: 'reason', Header: H.reason, GetValue: (row) => row.reason ?? '' },
    { Key: 'createdAt', Header: H.createdAt, GetValue: (row) => FormatDateTime(row.created_at) },
    { Key: 'updatedAt', Header: H.updatedAt, GetValue: (row) => FormatDateTime(row.updated_at) },
  ];
}

export function ResolveInterventionExportColumns(keys?: string[], language: ExportLanguage = 'it'): InterventionExportColumn[] {
  const allColumns = GetInterventionExportColumns(language);
  if (!keys || keys.length === 0) return allColumns;

  const requested = new Set(keys);
  const selected = allColumns.filter((column) => requested.has(column.Key));
  return selected.length > 0 ? selected : allColumns;
}

function NormalizeExportCellValue(value: unknown): string | number {
  if (value == null) return '';
  if (typeof value === 'string' || typeof value === 'number') return value;
  return String(value);
}

export function BuildInterventionExportRow(row: ExportRow, columns: InterventionExportColumn[]): Array<string | number> {
  return columns.map((column) => NormalizeExportCellValue(column.GetValue(row)));
}
