import type { InterventionDTO } from '../Data/Types/DTOs/InterventionDTO';


// ─── Chart Engine ──────────────────────────────────────────────────────────
// All dashboard chart computation + polynomial regression.
// Ported from front-end DashboardCharts.ts with server-side polynomial projection.


// ─── Constants ─────────────────────────────────────────────────────────────

const CO2_FACTOR = 0.19;

const STEAM_LEAK_FLOW_LOOKUP_KG: Record<number, { under05: number; halfToOne: number }> = {
  38: { under05: 7, halfToOne: 15 },
  55: { under05: 7, halfToOne: 15 },
  115: { under05: 8, halfToOne: 16 },
  365: { under05: 9, halfToOne: 17 },
  600: { under05: 9, halfToOne: 17 },
};

const STEAM_LEAK_RELATIVE_COEFFICIENTS: Record<number, [number, number, number]> = {
  38: [1.4932, 41.894, -116.56],
  55: [1.6946, 40.081, -112.74],
  115: [2.5, 32.833, -97.5],
  365: [5.8563, 2.6257, -33.949],
  600: [9.0112, -25.768, 25.782],
};

type PlumeBucket = 'under05' | 'halfToOne' | 'aboveOne' | null;

function ToNormalizedNumber(value: string | null | undefined): number | null {
  if (!value) return null;
  const parsed = Number(String(value).replace(',', '.').trim());
  return Number.isFinite(parsed) ? parsed : null;
}

function NormalizeSteamLeakPressure(pressureRaw: string | null): number | null {
  const pressure = ToNormalizedNumber(pressureRaw);
  if (pressure == null) return null;
  if (pressure === 38 || pressure === 40) return 38;
  if (pressure === 55) return 55;
  if (pressure === 115 || pressure === 125) return 115;
  if (pressure === 365) return 365;
  if (pressure === 600) return 600;
  return null;
}

function ResolvePlumeBucket(value: string | null): PlumeBucket {
  const normalized = (value ?? '').toLowerCase().replace(',', '.').replace(/\s+/g, '');
  // Missing plume is treated as x = 0.
  if (!normalized) return 'under05';

  if (normalized.startsWith('<') || normalized.includes('<0.5')) return 'under05';
  if (
    (normalized.includes('0.5') && normalized.includes('-') && normalized.includes('1')) ||
    normalized.includes('0.5mt-1mt') ||
    normalized.includes('1mt-0.5mt')
  ) return 'halfToOne';
  if (normalized.startsWith('>') || normalized.includes('>1')) return 'aboveOne';

  const numeric = ToNormalizedNumber(value);
  if (numeric == null) return null;
  if (numeric < 0.5) return 'under05';
  if (numeric < 1) return 'halfToOne';
  return 'aboveOne';
}

function ResolveRelativePlumeLengthMeters(row: InterventionDTO): number | null {
  const fromPlumeLength = ToNormalizedNumber(row.PlumeLength);
  if (fromPlumeLength != null && fromPlumeLength > 1) return fromPlumeLength;

  const fromPlumeSpec = ToNormalizedNumber(row.PlumeSpec);
  if (fromPlumeSpec != null && fromPlumeSpec > 0) return fromPlumeSpec;

  return 0;
}

function ComputeRelativeSteamLeakKg(pressure: number, plumeLengthM: number): number | null {
  const coeffs = STEAM_LEAK_RELATIVE_COEFFICIENTS[pressure];
  if (!coeffs) return null;

  const xFeet = plumeLengthM / 0.3048;
  const [a, b, c] = coeffs;
  const kg = (a * (xFeet ** 2) + b * xFeet + c) * 0.454;
  if (!Number.isFinite(kg)) return null;
  return Math.max(0, kg);
}

function GetFallbackKg(row: InterventionDTO): number {
  const kg = row.SteamFlowKg ?? 0;
  return Number.isFinite(kg) && kg > 0 ? kg : 0;
}

function GetNominalSteamFlowKg(row: InterventionDTO): number {
  // Steam trap nominal flow is fixed: 0.01 T/h = 10 kg/h.
  if (row.InterventionType === 2) return 10;

  if (row.InterventionType !== 1) return GetFallbackKg(row);

  const bucket = ResolvePlumeBucket(row.PlumeLength);
  const pressure = NormalizeSteamLeakPressure(row.Pressure);
  const lookup = pressure == null ? null : STEAM_LEAK_FLOW_LOOKUP_KG[pressure];

  if (bucket === 'under05' && lookup) return lookup.under05;
  if (bucket === 'halfToOne' && lookup) return lookup.halfToOne;

  if (bucket === 'aboveOne' && pressure != null) {
    const plumeLengthM = ResolveRelativePlumeLengthMeters(row);
    if (plumeLengthM != null) {
      const relativeKg = ComputeRelativeSteamLeakKg(pressure, plumeLengthM);
      if (relativeKg != null) return relativeKg;
    }
  }

  // For plume > 1 m, keep relative-formula value from persisted flow.
  return GetFallbackKg(row);
}

function GetNominalSteamFlowTonne(row: InterventionDTO): number {
  return GetNominalSteamFlowKg(row) / 1000;
}


// ─── Output Types ──────────────────────────────────────────────────────────

export interface PriorityStats {
  Name: string;
  Value: number;
  Color: string;
}

export interface StatusStats {
  Name: string;
  Value: number;
  Color: string;
}

export interface HistogramCandle {
  Date: string;
  Leaks: number;
  ResolvedLeakage: number;
  Interventions: number;
  CO2: number;
  ResolvedLeakageCO2: number;
}

export interface TrendDataPoint {
  Label: string;
  DateMs: number;
  Loc?: number;
  Gain?: number;
  CO2?: number;
  ResolvedLeakageCO2?: number;
  Crl?: number;
  DeltaTime?: number;
  CO2Emitted?: number;
  SparedCO2?: number;
  // Polynomial projection values
  CrlProjection?: number;
  LocProjection?: number;
  GainProjection?: number;
  CO2Projection?: number;
  ResolvedLeakageCO2Projection?: number;
  DeltaTimeProjection?: number;
  CO2EmittedProjection?: number;
  SparedCO2Projection?: number;
}

export interface LOCResult {
  Data: TrendDataPoint[];
  AvgRepairDays: number;
  AvgRepairProfit: number;
}

export interface HistogramResult {
  Data: HistogramCandle[];
  AverageLeakage: number;
  ResolvedLeakageByIntervention: number;
}

export interface ChartBundle {
  Priority: PriorityStats[];
  Status: StatusStats[];
  Histogram: HistogramResult;
  LOC: LOCResult;
  RL: TrendDataPoint[];
  CO2: TrendDataPoint[];
  TM: TrendDataPoint[];
  CO2E: TrendDataPoint[];
  AvailableYears: number[];
  Summary: { Total: number; Open: number; Closed: number };
}


// ─── Priority Colors ────────────────────────────────────────────────────────

const PRIORITY_COLORS: Record<number, string> = {
  1: '#dc2626',
  2: '#f59e0b',
  3: '#059669',
};


// ─── Main Computation ──────────────────────────────────────────────────────

export function ComputeChartBundle(
  rows: InterventionDTO[],
  steamPrice: number,
  timeFrame: 'day' | 'week' | 'month' | 'year',
): ChartBundle {
  // Summary counts
  let open = 0;
  let closed = 0;
  for (const r of rows) {
    if (r.Status === 1) open++;
    else closed++;
  }

  // Available years from inspection dates
  const yearSet = new Set<number>();
  for (const r of rows) {
    if (r.InspectionDate) yearSet.add(new Date(r.InspectionDate).getFullYear());
  }
  const availableYears = [...yearSet].sort();

  return {
    Priority: ComputePriorityStats(rows),
    Status: ComputeStatusStats(rows),
    Histogram: ComputeHistogramData(rows),
    LOC: ComputeLOCData(rows, steamPrice, timeFrame),
    RL: ComputeRLData(rows, steamPrice, timeFrame),
    CO2: ComputeCO2Data(rows, timeFrame),
    TM: ComputeTMData(rows, timeFrame),
    CO2E: ComputeCO2ETrendData(rows, timeFrame),
    AvailableYears: availableYears,
    Summary: { Total: rows.length, Open: open, Closed: closed },
  };
}


// ─── Priority Distribution ─────────────────────────────────────────────────

function ComputePriorityStats(rows: InterventionDTO[]): PriorityStats[] {
  const counts: Record<number, number> = {};
  for (const r of rows) {
    counts[r.Priority] = (counts[r.Priority] || 0) + 1;
  }
  return Object.entries(counts)
    .map(([k, v]) => ({
      Name: k,
      Value: v,
      Color: PRIORITY_COLORS[Number(k)] ?? '#6b7280',
    }))
    .sort((a, b) => Number(a.Name) - Number(b.Name));
}


// ─── Status Distribution ───────────────────────────────────────────────────
// V1 mapping: 0 = Chiuso, 1 = Aperto

function ComputeStatusStats(rows: InterventionDTO[]): StatusStats[] {
  let open = 0;
  let closed = 0;
  for (const r of rows) {
    if (r.Status === 1) open++;
    else closed++;
  }
  return [
    { Name: 'Aperti', Value: open, Color: 'red' },
    { Name: 'Chiusi', Value: closed, Color: 'green' },
  ].filter((d) => d.Value > 0);
}


// ─── Histogram Data ────────────────────────────────────────────────────────

function ComputeHistogramData(rows: InterventionDTO[]): HistogramResult {
  const withRepair = rows
    .filter((r) => r.RepairDate)
    .sort((a, b) => new Date(a.RepairDate!).getTime() - new Date(b.RepairDate!).getTime());

  const grouped: Record<string, InterventionDTO[]> = {};
  for (const r of withRepair) {
    const key = new Date(r.RepairDate!).toLocaleDateString('it-IT', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
    (grouped[key] ??= []).push(r);
  }

  let cumulativeInterventions = 0;
  const totalLeaks = rows.length;
  const data: HistogramCandle[] = [];

  for (const [date, group] of Object.entries(grouped)) {
    const count = group.length;
    cumulativeInterventions += count;
    const remaining = totalLeaks - cumulativeInterventions;
    const resolvedKg = group.reduce((s, r) => s + GetNominalSteamFlowKg(r), 0);

    data.push({
      Date: date,
      Leaks: remaining,
      ResolvedLeakage: resolvedKg,
      Interventions: cumulativeInterventions,
      CO2: remaining * CO2_FACTOR,
      ResolvedLeakageCO2: resolvedKg * CO2_FACTOR,
    });
  }

  const totalResolved = withRepair.reduce((s, r) => s + GetNominalSteamFlowKg(r), 0);
  const avg = withRepair.length > 0 ? totalResolved / withRepair.length : 0;

  return {
    Data: data,
    AverageLeakage: avg,
    ResolvedLeakageByIntervention: totalResolved,
  };
}


// ─── LOC Trend ─────────────────────────────────────────────────────────────

function ComputeLOCData(
  rows: InterventionDTO[],
  steamPrice: number,
  timeFrame: 'day' | 'week' | 'month' | 'year',
): LOCResult {
  const totalLoc = rows.reduce((acc, r) => acc + (GetNominalSteamFlowTonne(r) * steamPrice * 24 * 365), 0);

  const withRepair = rows
    .filter((r) => r.RepairDate && r.InspectionDate)
    .sort((a, b) => new Date(a.RepairDate!).getTime() - new Date(b.RepairDate!).getTime());

  if (!withRepair.length) return { Data: [], AvgRepairDays: 0, AvgRepairProfit: 0 };

  let totalDays = 0;
  let totalProfit = 0;
  let cumulativeGain = 0;
  let remainingLoc = totalLoc;

  const points: TrendDataPoint[] = [];

  for (const r of withRepair) {
    const inspDate = new Date(r.InspectionDate);
    const repDate = new Date(r.RepairDate!);
    const deltaDays = Math.max(0, (repDate.getTime() - inspDate.getTime()) / 86400000);
    totalDays += deltaDays;

    const flowTonne = GetNominalSteamFlowTonne(r);
    const annualValue = flowTonne * steamPrice * 24 * 365;
    remainingLoc -= annualValue;
    cumulativeGain += annualValue;
    totalProfit += flowTonne * steamPrice * deltaDays * 24;

    points.push({
      Label: FormatDate(repDate, timeFrame),
      DateMs: repDate.getTime(),
      Loc: Math.round(remainingLoc),
      Gain: Math.round(cumulativeGain),
    });
  }

  const aggregated = AggregateByTimeFrame(points, timeFrame);

  // Polynomial regression (degree 2) for LOC and Gain projection
  ApplyProjection(aggregated, 'Loc', 'LocProjection', timeFrame);
  ApplyProjection(aggregated, 'Gain', 'GainProjection', timeFrame);

  return {
    Data: aggregated,
    AvgRepairDays: Math.round(totalDays / withRepair.length),
    AvgRepairProfit: Math.round(totalProfit / withRepair.length),
  };
}


// ─── RL Trend + Polynomial Projection ──────────────────────────────────────

function ComputeRLData(
  rows: InterventionDTO[],
  steamPrice: number,
  timeFrame: 'day' | 'week' | 'month' | 'year',
): TrendDataPoint[] {
  const withRepair = rows
    .filter((r) => r.RepairDate && r.InspectionDate)
    .sort((a, b) => new Date(a.RepairDate!).getTime() - new Date(b.RepairDate!).getTime());

  if (!withRepair.length) return [];

  let crl = 0;
  const points: TrendDataPoint[] = [];

  for (const r of withRepair) {
    const inspDate = new Date(r.InspectionDate);
    const repDate = new Date(r.RepairDate!);
    const deltaHours = Math.max(0, (repDate.getTime() - inspDate.getTime()) / 3600000);
    const flowTonne = GetNominalSteamFlowTonne(r);
    crl += flowTonne * steamPrice * deltaHours;

    points.push({
      Label: FormatDate(repDate, timeFrame),
      DateMs: repDate.getTime(),
      Crl: Math.round(crl),
    });
  }

  const aggregated = AggregateByTimeFrame(points, timeFrame);

  // Polynomial regression (degree 2 — quadratic) for projection
  ApplyProjection(aggregated, 'Crl', 'CrlProjection', timeFrame);

  return aggregated;
}


// ─── CO2 Trend ─────────────────────────────────────────────────────────────

function ComputeCO2Data(
  rows: InterventionDTO[],
  timeFrame: 'day' | 'week' | 'month' | 'year',
): TrendDataPoint[] {
  // Compute histogram first, then extract CO2 columns
  const histogram = ComputeHistogramData(rows);
  if (!histogram.Data.length) return [];

  const aggregated: TrendDataPoint[] = histogram.Data.map((h) => ({
    Label: h.Date,
    DateMs: ParseItalianDate(h.Date),
    CO2: Math.round(h.CO2 * 100) / 100,
    ResolvedLeakageCO2: Math.round(h.ResolvedLeakageCO2 * 100) / 100,
  }));

  // Polynomial regression (degree 2) for CO2 and ResolvedLeakageCO2 projection
  ApplyProjection(aggregated, 'CO2', 'CO2Projection', timeFrame);
  ApplyProjection(aggregated, 'ResolvedLeakageCO2', 'ResolvedLeakageCO2Projection', timeFrame);

  return aggregated;
}


// ─── TM Trend ──────────────────────────────────────────────────────────────

function ComputeTMData(
  rows: InterventionDTO[],
  timeFrame: 'day' | 'week' | 'month' | 'year',
): TrendDataPoint[] {
  const withRepair = rows
    .filter((r) => r.RepairDate && r.InspectionDate)
    .sort((a, b) => new Date(a.RepairDate!).getTime() - new Date(b.RepairDate!).getTime());

  if (!withRepair.length) return [];

  const points: TrendDataPoint[] = withRepair.map((r) => {
    const inspDate = new Date(r.InspectionDate);
    const repDate = new Date(r.RepairDate!);
    const deltaDays = Math.max(0, (repDate.getTime() - inspDate.getTime()) / 86400000);
    return {
      Label: FormatDate(repDate, timeFrame),
      DateMs: repDate.getTime(),
      DeltaTime: Math.round(deltaDays),
    };
  });

  const aggregated = AggregateByTimeFrame(points, timeFrame);

  // Polynomial regression (degree 2) for DeltaTime projection
  ApplyProjection(aggregated, 'DeltaTime', 'DeltaTimeProjection', timeFrame);

  return aggregated;
}


// ─── CO2-E Trend ───────────────────────────────────────────────────────────

function ComputeCO2ETrendData(
  rows: InterventionDTO[],
  timeFrame: 'day' | 'week' | 'month' | 'year',
): TrendDataPoint[] {
  const sorted = [...rows].sort(
    (a, b) => new Date(a.InspectionDate).getTime() - new Date(b.InspectionDate).getTime(),
  );

  if (!sorted.length) return [];

  let cumulativeCO2 = 0;
  let cumulativeSpared = 0;
  const points: TrendDataPoint[] = [];

  for (const r of sorted) {
    const flowKg = GetNominalSteamFlowKg(r);
    // V1 logic: status 0 = Chiuso (closed), status 1 = Aperto (open)
    const isClosed = r.Status === 0;

    if (isClosed) {
      cumulativeSpared += flowKg * CO2_FACTOR;
    } else {
      cumulativeCO2 += flowKg * CO2_FACTOR;
    }

    const d = new Date(r.InspectionDate);
    points.push({
      Label: FormatDate(d, timeFrame),
      DateMs: d.getTime(),
      CO2Emitted: Math.round(cumulativeCO2 * 100) / 100,
      SparedCO2: Math.round(cumulativeSpared * 100) / 100,
    });
  }

  const aggregated = AggregateByTimeFrame(points, timeFrame);

  // Polynomial regression (degree 2) for CO2Emitted and SparedCO2 projection
  ApplyProjection(aggregated, 'CO2Emitted', 'CO2EmittedProjection', timeFrame);
  ApplyProjection(aggregated, 'SparedCO2', 'SparedCO2Projection', timeFrame);

  return aggregated;
}


// ─── Reusable Projection Helper ─────────────────────────────────────────────
// Applies polynomial regression (degree 2) to a specific field in aggregated data,
// writes fitted values to projField, and appends ~30% forward projection points.

function ApplyProjection(
  aggregated: TrendDataPoint[],
  dataField: keyof TrendDataPoint,
  projField: keyof TrendDataPoint,
  timeFrame: 'day' | 'week' | 'month' | 'year',
): void {
  // Identify points that have actual data for this field (excludes future points from prior projections)
  const realIndices: number[] = [];
  for (let i = 0; i < aggregated.length; i++) {
    if (aggregated[i][dataField] != null) realIndices.push(i);
  }
  if (realIndices.length < 3) return;

  // Polynomial regression (degree 2 — quadratic), matching v1 approach
  const xs = realIndices.map((_, j) => j);
  const ys = realIndices.map((idx) => aggregated[idx][dataField] as number);
  const coefficients = PolyFit(xs, ys, 2);

  // v1 behaviour: projection only on FUTURE points, not overlaid on historical data.
  // Bridge: set projection on the LAST real point using its ACTUAL value so the
  // dashed line begins exactly where the solid line ends (no mid-air gap).
  const lastRealJ = realIndices.length - 1;
  (aggregated[realIndices[lastRealJ]] as any)[projField] = aggregated[realIndices[lastRealJ]][dataField] as number;

  // Forward projection: exactly 7 points (v1 spec)
  const lastRealIdx = realIndices[realIndices.length - 1];
  const lastDateMs = aggregated[lastRealIdx].DateMs;
  const projCount = 7;

  let avgStep = 30 * 86400000; // default: 1 month in ms
  if (realIndices.length >= 2) {
    const firstDateMs = aggregated[realIndices[0]].DateMs;
    avgStep = (lastDateMs - firstDateMs) / (realIndices.length - 1);
  }

  for (let j = 1; j <= projCount; j++) {
    const futureX = realIndices.length - 1 + j;
    const futureDateMs = lastDateMs + avgStep * j;
    const rawValue = Math.round(PolyEval(coefficients, futureX));

    // Stop projecting once the polynomial crosses zero — emitting 0-clamped points
    // creates artificial vertical drops and flat lines on the chart
    if (rawValue <= 0) break;

    // Check if a future point at this DateMs already exists (from a prior ApplyProjection call)
    const tolerance = avgStep * 0.1;
    const existing = aggregated.find((p) => Math.abs(p.DateMs - futureDateMs) < tolerance && p[dataField] == null);
    if (existing) {
      (existing as any)[projField] = rawValue;
    } else {
      const point: TrendDataPoint = {
        Label: FormatDate(new Date(futureDateMs), timeFrame),
        DateMs: futureDateMs,
      };
      (point as any)[projField] = rawValue;
      aggregated.push(point);
    }
  }
}


// ─── Polynomial Regression (Least Squares) ─────────────────────────────────
// Fits a polynomial of given degree to (xs, ys) data using normal equations.
// Returns coefficients [a0, a1, a2, ...] such that y = a0 + a1*x + a2*x^2 + ...

function PolyFit(xs: number[], ys: number[], degree: number): number[] {
  const n = xs.length;
  const size = degree + 1;

  // Build Vandermonde matrix (normal equations: A^T * A * c = A^T * y)
  // Compute A^T * A (symmetric matrix)
  const ata: number[][] = Array.from({ length: size }, () => new Array(size).fill(0));
  const aty: number[] = new Array(size).fill(0);

  for (let i = 0; i < n; i++) {
    const xPows: number[] = new Array(2 * degree + 1);
    xPows[0] = 1;
    for (let p = 1; p <= 2 * degree; p++) {
      xPows[p] = xPows[p - 1] * xs[i];
    }

    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        ata[r][c] += xPows[r + c];
      }
      aty[r] += xPows[r] * ys[i];
    }
  }

  // Solve via Gaussian elimination with partial pivoting
  return GaussianSolve(ata, aty);
}

function PolyEval(coefficients: number[], x: number): number {
  let result = 0;
  let xPow = 1;
  for (const c of coefficients) {
    result += c * xPow;
    xPow *= x;
  }
  return result;
}

function GaussianSolve(A: number[][], b: number[]): number[] {
  const n = A.length;
  // Augmented matrix
  const M = A.map((row, i) => [...row, b[i]]);

  for (let col = 0; col < n; col++) {
    // Partial pivoting
    let maxRow = col;
    let maxVal = Math.abs(M[col][col]);
    for (let row = col + 1; row < n; row++) {
      if (Math.abs(M[row][col]) > maxVal) {
        maxVal = Math.abs(M[row][col]);
        maxRow = row;
      }
    }
    if (maxRow !== col) {
      [M[col], M[maxRow]] = [M[maxRow], M[col]];
    }

    // Eliminate below
    const pivot = M[col][col];
    if (Math.abs(pivot) < 1e-12) continue; // singular — skip

    for (let row = col + 1; row < n; row++) {
      const factor = M[row][col] / pivot;
      for (let j = col; j <= n; j++) {
        M[row][j] -= factor * M[col][j];
      }
    }
  }

  // Back substitution
  const x = new Array(n).fill(0);
  for (let i = n - 1; i >= 0; i--) {
    let sum = M[i][n];
    for (let j = i + 1; j < n; j++) {
      sum -= M[i][j] * x[j];
    }
    x[i] = Math.abs(M[i][i]) > 1e-12 ? sum / M[i][i] : 0;
  }

  return x;
}


// ─── Helpers ────────────────────────────────────────────────────────────────

function FormatDate(d: Date, timeFrame: 'day' | 'week' | 'month' | 'year'): string {
  if (timeFrame === 'year') {
    return String(d.getFullYear());
  }
  if (timeFrame === 'month') {
    return d.toLocaleDateString('it-IT', { month: 'short', year: '2-digit' });
  }
  if (timeFrame === 'week') {
    const weekStart = new Date(d);
    weekStart.setDate(d.getDate() - d.getDay() + 1);
    return weekStart.toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit' });
  }
  return d.toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: '2-digit' });
}

function ParseItalianDate(str: string): number {
  const [d, m, y] = str.split('/');
  return new Date(Number(y), Number(m) - 1, Number(d)).getTime();
}

function AggregateByTimeFrame(
  points: TrendDataPoint[],
  _timeFrame: 'day' | 'week' | 'month' | 'year',
): TrendDataPoint[] {
  // Group by label and take the last value for each bucket
  const grouped: Record<string, TrendDataPoint> = {};
  for (const p of points) {
    grouped[p.Label] = p;
  }
  return Object.values(grouped);
}
