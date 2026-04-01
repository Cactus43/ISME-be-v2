/**
 * Data normalization rules for intervention fields.
 * Extracted from v1 hardcoded if/else chains.
 */


// ─── Field normalizers ─────────────────────────────────────────────────────

export function NormalizeCompetence(value: string | null | undefined): string {
  if (!value || value === '-') return 'N/A';
  if (value.includes('STR')) return 'Strumentazione (STR)';
  if (value.includes('MA')) return 'Machinery (MA)';
  if (value.includes('MT')) return 'Metal Trade (MT)';
  return value;
}

export function NormalizeMalfunctioningType(value: string | number | null | undefined): string {
  if (!value) return 'N/A';
  const s = String(value).toLowerCase().trim();
  if (s === 'perdita' || s === 'in perdita' || s === '1') return 'In perdita';
  if (s === 'bloccato' || s === '0') return 'Bloccato';
  return String(value);
}

export function NormalizeDischargerType(value: string | null | undefined): string {
  if (!value) return 'N/A';
  return value;
}

export function NormalizeService(value: string | null | undefined): string {
  if (!value) return 'N/A';
  return value;
}

export function NormalizeSize(value: string | null | undefined): string {
  if (!value) return 'N/A';
  if (value === '"?"') return '?';
  return value;
}

export function NormalizeBooleanField(value: string | number | null | undefined): number {
  if (value === null || value === undefined) return -1;
  if (value === 'Si' || value === 1) return 1;
  if (value === 'No' || value === 0) return 0;
  return -1;
}

export function NormalizeInsulationMaterial(value: string | null | undefined): string {
  if (!value) return 'N/A';
  return value;
}

export function NormalizeMetalSheet(value: string | null | undefined): string {
  if (!value) return 'N/A';
  const s = String(value).toLowerCase().trim();
  if (s === 'assente') return 'Assente';
  if (s === 'danneggiato') return 'Danneggiato';
  return String(value);
}

export function NormalizePlumeLength(value: string | null | undefined): string | null {
  if (!value) return null;
  if (value === '1 mt - 0.5 mt') return '0.5 mt - 1 mt';
  if (value === '> 1.0 mt (Specificare)') return '> 1 mt';
  return value;
}

export function NormalizeScaffolding(value: string | null | undefined): string {
  if (!value) return '';
  if (value === 'undefined mt') return '';
  return value;
}

export function NormalizeInterceptionPossibility(value: string | number | null | undefined): string {
  if (!value && value !== 0) return 'N/A';
  if (value === 1) return 'Si';
  if (value === 0) return 'No';
  return String(value);
}


// ─── Aggregate normalizer ──────────────────────────────────────────────────

export function NormalizeInterventionData(data: Record<string, unknown>): Record<string, unknown> {
  if ('competence' in data) data.competence = NormalizeCompetence(data.competence as string);
  if ('malfunctioning_type' in data) data.malfunctioning_type = NormalizeMalfunctioningType(data.malfunctioning_type as string);
  if ('discharger_type' in data) data.discharger_type = NormalizeDischargerType(data.discharger_type as string);
  if ('service' in data) data.service = NormalizeService(data.service as string);
  if ('size' in data) data.size = NormalizeSize(data.size as string);
  if ('need_for_insulation' in data) data.need_for_insulation = NormalizeBooleanField(data.need_for_insulation as string);
  if ('asbestos' in data) data.asbestos = NormalizeBooleanField(data.asbestos as string);
  if ('insulation_material' in data) data.insulation_material = NormalizeInsulationMaterial(data.insulation_material as string);
  if ('metal_sheet' in data) data.metal_sheet = NormalizeMetalSheet(data.metal_sheet as string);
  if ('plume_length' in data) data.plume_length = NormalizePlumeLength(data.plume_length as string);
  if ('scaffolding' in data) data.scaffolding = NormalizeScaffolding(data.scaffolding as string);
  if ('steam_discharge_to_closed_system' in data) data.steam_discharge_to_closed_system = NormalizeBooleanField(data.steam_discharge_to_closed_system as string);
  if ('interception_valve_status' in data) data.interception_valve_status = NormalizeBooleanField(data.interception_valve_status as string);
  if ('interception_possibility' in data) data.interception_possibility = NormalizeInterceptionPossibility(data.interception_possibility as string | number);
  if ('plume_spec' in data && !data.plume_spec) data.plume_spec = 0;

  return data;
}
