/**
 * Steam flow calculation formulas.
 * Based on empirical data — plume length in feet, pressure in psig.
 * Results in kg/h then converted to t/h.
 */


// ─── Constants ─────────────────────────────────────────────────────────────

const FLOW_LOOKUP: Record<number, { under05: number; half_to_one: number }> = {
  40:  { under05: 7,  half_to_one: 15 },
  55:  { under05: 7,  half_to_one: 15 },
  125: { under05: 8,  half_to_one: 16 },
  365: { under05: 9,  half_to_one: 17 },
  600: { under05: 9,  half_to_one: 17 },
};

const POLY_COEFFICIENTS: Record<number, [number, number, number]> = {
  40:  [1.4932, 41.894, -116.56],
  55:  [1.6946, 40.081, -112.74],
  125: [2.5,    32.833, -97.5],
  365: [5.8563,  2.6257, -33.929],
  600: [9.0112, -25.768, 25.782],
};

const METERS_TO_FEET = 1 / 0.3048;
const LBS_TO_KG = 0.454;

export const SUPPORTED_PRESSURES = [40, 55, 125, 365, 600] as const;
export type SupportedPressure = (typeof SUPPORTED_PRESSURES)[number];


// ─── Private ───────────────────────────────────────────────────────────────

function _steamFlowPolynomial(pressurePsig: number, plumeLengthM: number): number {
  const coeffs = POLY_COEFFICIENTS[pressurePsig];
  if (!coeffs) throw new Error(`Unknown pressure value for polynomial: ${pressurePsig} psig`);
  const [a, b, c] = coeffs;
  const xFeet = plumeLengthM * METERS_TO_FEET;
  return (a * xFeet ** 2 + b * xFeet + c) * LBS_TO_KG;
}


// ─── Public ────────────────────────────────────────────────────────────────

export function CalculateSteamFlowKg(plumeLengthM: number, pressurePsig: number): number {
  if (plumeLengthM < 0.5) {
    const entry = FLOW_LOOKUP[pressurePsig];
    if (!entry) throw new Error(`Unknown pressure: ${pressurePsig} psig`);
    return entry.under05;
  }

  if (plumeLengthM < 1) {
    const entry = FLOW_LOOKUP[pressurePsig];
    if (!entry) throw new Error(`Unknown pressure: ${pressurePsig} psig`);
    return entry.half_to_one;
  }

  return _steamFlowPolynomial(pressurePsig, plumeLengthM);
}

export function CalculateSteamFlow(plumeLengthM: number, pressurePsig: number): { Kg: number; Tonne: number } {
  const kg = CalculateSteamFlowKg(plumeLengthM, pressurePsig);
  return {
    Kg: Math.round(kg * 1000) / 1000,
    Tonne: Math.round((kg / 1000) * 1000000) / 1000000,
  };
}

export function IsSupportedPressure(value: number): value is SupportedPressure {
  return (SUPPORTED_PRESSURES as readonly number[]).includes(value);
}
