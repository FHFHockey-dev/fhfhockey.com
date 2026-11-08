/** Port of the frozen research scorer `support-conditioned-production-gap-v1`
 * (Codex task-2 `support-conditioned-ranking-v1/candidate.py`). Pure functions only:
 * no I/O, loader, clock or network. No probability, causal-luck, market-value or
 * predictive claim is returned; every trusted flag stays false.
 */
export const SUPPORT_GAP_VERSION = "support-conditioned-production-gap-v1";
export const PROCESS = ["individual_xG60", "shared_onice_xGF60", "shared_onice_xGA60"] as const;
export const SHRINK = 0.5;
export const SEASONS = [20222023, 20232024] as const;
const OUTCOME_WEIGHTS = [1 / 3, 1 / 3, 1 / 3];
const EPS = Number.EPSILON;

type Matrix = number[][];
export type Geometry = { inverse: Matrix; root: Matrix; projector: Matrix; scales: number[]; rank: number; roundoffEigenvalues: number[] };
export type TrainingBlock = {
  player_id: number; position: string; season_id: number; source_ids: number[]; dates: string[];
  qualified_process_exposure: boolean; seconds?: number | null; X?: number[] | null; Y?: number[] | null;
  teams?: (string | null)[]; positions?: (string | null)[];
};
export type PriorModel = {
  version: typeof SUPPORT_GAP_VERSION; featureNames: string[]; beta: Matrix; Cxx: Matrix; Cxy: Matrix; cohortX: number[];
  rank: number; deltaMin: number[]; deltaMax: number[]; playerWeightSums: Record<number, number>; donors: number;
  strata: number; blocks: number; sourceIds: number[]; priorLastDate: string; cutoff: string; targetId: number;
  targetBlocksExcluded: number; rejected: Record<string, number>; coefficientUncertaintyCalibrated: false;
  fittedShrinkage: number; roundoffEigenvalues: number[];
};
/** Only the fields `score` reads; the frozen fit also needs these from saved models. */
export type ScoringModel = Pick<PriorModel, "featureNames" | "beta" | "Cxx" | "cohortX" | "rank" | "deltaMin" | "deltaMax"> & { donors?: number };
export type ProcessMode = "missing_current_linear_estimate" | "measured_current_cohort_reference" | "measured_current_personal_reference" | "measured_current_estimated_reference";
export type ConditionalProcess = {
  delta: number[]; observedIndices: number[]; imputedIndices: number[]; modes: ProcessMode[];
  missingProcessCovariance: Matrix; outsidePriorSpan: boolean; outsidePriorComponentRange: boolean;
  missingVarianceIsWorkingNotCalibrated: true;
};
export type ProductionAxis = {
  value: number | null; current_seconds: number | null; expected_totals: number[] | null; raw_observed: number[] | null;
  joint_gap_covariance: Matrix | null; personal_n?: number; [key: string]: unknown;
};
export type SupportStatus = "unavailable" | "balanced_model_estimate" | "support_direction_without_baseline_concordance" | "conflicting_baseline_and_support" | "concordant_research_candidate";
export type EvidenceTier = "measured_process_personal_reference" | "provisional_estimated_or_extrapolated";
export type SupportGapResult = {
  version: typeof SUPPORT_GAP_VERSION; value: number | null; normalizedGap: number | null; productionAxis: ProductionAxis;
  trustedListEligible: false; recommendation: null; researchList: "BL" | "SH" | null; confidenceProbability: null;
  covarianceNotConditionalCalibration: true; currentProcess: (number | null)[]; status: SupportStatus; reason?: string;
  baselineNormalizedGap?: number; evidenceTier?: EvidenceTier; process?: ConditionalProcess;
  expectedBaseline?: number[]; expectedSupport?: number[]; expectedSupportUnfloored?: number[]; rawActual?: number[];
  supportAdjustment?: number[]; physicalFloorIndices?: number[]; missingProcessOutputCovariance?: Matrix;
  missingProcessNormalizedVariance?: number; missingProcessVarianceNotAddedToBaseline?: true;
  individualFinishingOrSOGGate?: false; freshProxy?: boolean; supportCorrectionZero?: boolean;
  fittingRank?: number; donorPlayers?: number;
};

const zeros = (r: number, c: number): Matrix => Array.from({ length: r }, () => new Array<number>(c).fill(0));
const dot = (a: number[], b: number[]) => a.reduce((s, v, i) => s + v * b[i], 0);
const vecMat = (v: number[], m: Matrix) => (m[0] ?? []).map((_, j) => m.reduce((s, row, i) => s + v[i] * row[j], 0));
const matMul = (a: Matrix, b: Matrix) => a.map(row => vecMat(row, b));
const transpose = (m: Matrix) => (m[0] ?? []).map((_, j) => m.map(row => row[j]));
const sub = (m: Matrix, rows: number[], cols: number[]) => rows.map(i => cols.map(j => m[i][j]));
const norm = (v: number[]) => Math.sqrt(dot(v, v));
const isDay = (v: unknown) => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(`${v}T00:00:00Z`)) && new Date(`${v}T00:00:00Z`).toISOString().slice(0, 10) === v;
const requireDay = (v: unknown) => { if (!isDay(v)) throw new Error(`Invalid isoformat string: ${String(v)}`); };

function vector(value: unknown, size: number): number[] {
  if (value == null || !Array.isArray(value) || value.some(x => typeof x === "boolean")) throw new Error("Missing/bool vector is not measured zero");
  if (value.length !== size || !value.every(x => typeof x === "number" && Number.isFinite(x))) throw new Error("Invalid finite vector");
  return value.map(Number);
}

/** Cyclic Jacobi eigendecomposition of a small symmetric matrix; values ascending, vectors as columns. */
function symmetricEigen(input: Matrix): { values: number[]; basis: Matrix } {
  const n = input.length, a = input.map(r => [...r]);
  const v = zeros(n, n).map((r, i) => { r[i] = 1; return r; });
  for (let sweep = 0; sweep < 100; sweep++) {
    let off = 0;
    for (let p = 0; p < n; p++) for (let q = p + 1; q < n; q++) off += a[p][q] * a[p][q];
    if (off === 0) break;
    for (let p = 0; p < n; p++) for (let q = p + 1; q < n; q++) {
      if (a[p][q] === 0) continue;
      const theta = (a[q][q] - a[p][p]) / (2 * a[p][q]);
      const t = Math.sign(theta || 1) / (Math.abs(theta) + Math.sqrt(theta * theta + 1));
      const c = 1 / Math.sqrt(t * t + 1), s = t * c;
      for (let k = 0; k < n; k++) {
        const akp = a[k][p], akq = a[k][q];
        a[k][p] = c * akp - s * akq; a[k][q] = s * akp + c * akq;
      }
      for (let k = 0; k < n; k++) {
        const apk = a[p][k], aqk = a[q][k];
        a[p][k] = c * apk - s * aqk; a[q][k] = s * apk + c * aqk;
      }
      for (let k = 0; k < n; k++) {
        const vkp = v[k][p], vkq = v[k][q];
        v[k][p] = c * vkp - s * vkq; v[k][q] = s * vkp + c * vkq;
      }
    }
  }
  const order = a.map((_, i) => i).sort((i, j) => a[i][i] - a[j][j]);
  return { values: order.map(i => a[i][i]), basis: v.map(row => order.map(i => row[i])) };
}

/** Dimensionless PSD/rank check; no variance floor or entry-scale tolerance. */
export function covarianceGeometry(value: unknown): Geometry {
  if (value == null) throw new Error("Missing covariance");
  const a = value as Matrix;
  if (!Array.isArray(a) || !a.length || a.some(r => !Array.isArray(r) || r.length !== a.length || !r.every(x => typeof x === "number" && Number.isFinite(x)))) throw new Error("Invalid covariance shape/values");
  const n = a.length, diag = a.map((r, i) => r[i]);
  if (diag.some(d => d < 0)) throw new Error("Negative variance");
  diag.forEach((d, j) => { if (d === 0 && a.some((r, i) => r[j] !== 0 || a[j][i] !== 0)) throw new Error("Nonzero covariance with zero variance"); });
  const use = diag.flatMap((d, i) => (d > 0 ? [i] : []));
  const inverse = zeros(n, n), root = zeros(n, n), projector = zeros(n, n), scales = diag.map(Math.sqrt);
  if (!use.length) return { inverse, root, projector, scales, rank: 0, roundoffEigenvalues: [] };
  const s = use.map(i => scales[i]);
  const r = use.map((i, x) => use.map((j, y) => a[i][j] / (s[x] * s[y])));
  let tol = 64 * EPS * use.length;
  if (r.some((row, i) => row.some((v, j) => Math.abs(v - r[j][i]) > tol))) throw new Error("Asymmetric covariance");
  const { values, basis } = symmetricEigen(r.map((row, i) => row.map((v, j) => (v + r[j][i]) / 2)));
  tol *= Math.max(1, ...values.map(Math.abs));
  if (Math.min(...values) < -tol) throw new Error("Non-PSD covariance");
  const keep = values.map(v => v > tol);
  use.forEach((i, x) => use.forEach((j, y) => {
    let inv = 0, proj = 0;
    for (let k = 0; k < values.length; k++) if (keep[k]) { inv += basis[x][k] * basis[y][k] / values[k]; proj += basis[x][k] * basis[y][k]; }
    inverse[i][j] = inv / (s[x] * s[y]);
    projector[i][j] = proj;
    // The root is for conditional-residual Gram products; only numerical-rank eigenvalues vanish.
    root[i][j] = s[x] * basis[x][y] * Math.sqrt(keep[y] ? values[y] : 0);
  }));
  return { inverse, root, projector, scales, rank: keep.filter(Boolean).length, roundoffEigenvalues: values.filter((_, k) => !keep[k]) };
}

/** Fit the one frozen sensitivity rule on already-qualified disjoint five-slot blocks. */
export function fitPrior(blocks: TrainingBlock[], targetId: number, position: string, cutoff: string, featureNames: readonly string[] = PROCESS): [PriorModel | null, string | null] {
  requireDay(cutoff);
  if (position !== "F" && position !== "D") return [null, "unknown_position"];
  const p = featureNames.length;
  if (p === 0 || new Set(featureNames).size !== p) throw new Error("Feature names must be distinct");
  const groups = new Map<string, { pid: number; season: number; rows: { b: TrainingBlock; x: number[]; y: number[] }[] }>();
  const seen = new Set<number>(), seenPlayerDates = new Set<string>(), rejected: Record<string, number> = {};
  let targetExcluded = 0;
  for (const b of blocks) {
    if (b.player_id === targetId) { targetExcluded++; continue; }
    if (b.position !== position) continue;
    const ids = b.source_ids, dates = b.dates;
    if (ids.length !== 5 || dates.length !== 5 || new Set(ids).size !== 5 || new Set(dates).size !== 5 || dates.some((d, i) => i > 0 && dates[i - 1] > d)) throw new Error("Training block is not five original ordered slots");
    dates.forEach(requireDay);
    if (dates[4] >= cutoff) throw new Error("Current/future game in prior fit");
    if (!(SEASONS as readonly number[]).includes(b.season_id)) throw new Error("Unapproved training season");
    const playerDates = dates.map(d => `${b.player_id}|${d}`);
    if (ids.some(id => seen.has(id)) || playerDates.some(k => seenPlayerDates.has(k))) throw new Error("Overlapping training blocks");
    ids.forEach(id => seen.add(id)); playerDates.forEach(k => seenPlayerDates.add(k));
    if (b.qualified_process_exposure !== true) { rejected.unqualified_original_block = (rejected.unqualified_original_block ?? 0) + 1; continue; }
    const knownTeams = new Set((b.teams ?? []).filter(t => t !== null)), knownPositions = new Set((b.positions ?? []).filter(q => q !== null));
    if (knownTeams.size > 1 || [...knownPositions].some(q => q !== position)) { rejected.within_block_context_change = (rejected.within_block_context_change ?? 0) + 1; continue; }
    const seconds = b.seconds;
    if (typeof seconds !== "number" || !Number.isFinite(seconds) || seconds <= 0) throw new Error("Invalid training exposure");
    const x = vector(b.X, p), y = vector(b.Y, 3);
    if (x.some(v => v < 0) || y[0] < 0 || y[1] < 0) throw new Error("Negative process or nonnegative outcome rate");
    const key = `${b.player_id}|${b.season_id}`;
    if (!groups.has(key)) groups.set(key, { pid: b.player_id, season: b.season_id, rows: [] });
    groups.get(key)!.rows.push({ b, x, y });
  }
  const strata = [...groups.values()].filter(g => g.rows.length >= 2).sort((g, h) => g.pid - h.pid || g.season - h.season);
  const players = [...new Set(strata.map(g => g.pid))].sort((u, v) => u - v);
  if (players.length < 2) return [null, "fewer_than_two_arithmetic_donor_players"];
  const seasonsPerPlayer = new Map<number, number>();
  strata.forEach(g => seasonsPerPlayer.set(g.pid, (seasonsPerPlayer.get(g.pid) ?? 0) + 1));
  const cxx = zeros(p, p), cxy = zeros(p, 3), cohortX = new Array<number>(p).fill(0);
  const deviations: number[][] = [], usedIds: number[] = [], usedDates: string[] = [], weightSums: Record<number, number> = {};
  for (const { pid, rows } of strata) {
    const exposure = rows.map(r => r.b.seconds as number), total = exposure.reduce((s, e) => s + e, 0);
    const q = exposure.map(e => e / total);
    const muX = vecMat(q, rows.map(r => r.x)), muY = vecMat(q, rows.map(r => r.y));
    const dx = rows.map(r => r.x.map((v, j) => v - muX[j])), dy = rows.map(r => r.y.map((v, j) => v - muY[j]));
    // Exact repeated observations are constant even if normalized-weight sums rounded the mean.
    for (let j = 0; j < p; j++) if (rows.every(r => r.x[j] === rows[0].x[j])) dx.forEach(d => { d[j] = 0; });
    for (let j = 0; j < 3; j++) if (rows.every(r => r.y[j] === rows[0].y[j])) dy.forEach(d => { d[j] = 0; });
    const weights = q.map(w => w / players.length / seasonsPerPlayer.get(pid)!);
    for (let i = 0; i < rows.length; i++) for (let u = 0; u < p; u++) {
      for (let v = 0; v < p; v++) cxx[u][v] += dx[i][u] * weights[i] * dx[i][v];
      for (let v = 0; v < 3; v++) cxy[u][v] += dx[i][u] * weights[i] * dy[i][v];
    }
    muX.forEach((m, j) => { cohortX[j] += m / players.length / seasonsPerPlayer.get(pid)!; });
    deviations.push(...dx);
    weightSums[pid] = (weightSums[pid] ?? 0) + weights.reduce((s, w) => s + w, 0);
    rows.forEach(r => { usedIds.push(...r.b.source_ids); usedDates.push(...r.b.dates); });
  }
  const geometry = covarianceGeometry(cxx);
  if (geometry.rank === 0) return [null, "no_within_player_process_variation"];
  const beta = matMul(geometry.inverse, cxy).map(row => row.map(v => SHRINK * v));
  const column = (j: number) => deviations.map(d => d[j]);
  return [{
    version: SUPPORT_GAP_VERSION, featureNames: [...featureNames], beta, Cxx: cxx, Cxy: cxy, cohortX, rank: geometry.rank,
    deltaMin: featureNames.map((_, j) => Math.min(...column(j))), deltaMax: featureNames.map((_, j) => Math.max(...column(j))),
    playerWeightSums: weightSums, donors: players.length, strata: strata.length, blocks: deviations.length, sourceIds: usedIds,
    priorLastDate: usedDates.reduce((m, d) => (d > m ? d : m)), cutoff, targetId, targetBlocksExcluded: targetExcluded, rejected,
    coefficientUncertaintyCalibrated: false, fittedShrinkage: SHRINK, roundoffEigenvalues: geometry.roundoffEigenvalues,
  }, null];
}

/** Missing delta components get a labelled linear estimate, never a zero fill. */
export function conditionalDelta(model: ScoringModel, current: (number | null)[], reference: (number | null)[], referenceIsPersonal: boolean[]): [ConditionalProcess | null, string | null] {
  const p = model.featureNames.length;
  if (current.length !== p || reference.length !== p || referenceIsPersonal.length !== p) throw new Error("Process dimension mismatch");
  const observed: number[] = [], delta = new Array<number>(p).fill(0), modes: ProcessMode[] = [];
  const cohort = vector(model.cohortX, p);
  for (let j = 0; j < p; j++) {
    const personal = referenceIsPersonal[j];
    if (personal !== true && personal !== false) throw new Error("Explicit personal/cohort reference mode required");
    if (current[j] === null || current[j] === undefined) { modes.push("missing_current_linear_estimate"); continue; }
    const w = vector([current[j]], 1)[0];
    if (w < 0) throw new Error("Negative process rate");
    let h: number;
    if (reference[j] === null || reference[j] === undefined) { h = cohort[j]; modes.push("measured_current_cohort_reference"); }
    else {
      h = vector([reference[j]], 1)[0];
      if (h < 0) throw new Error("Negative reference process");
      modes.push(personal ? "measured_current_personal_reference" : "measured_current_estimated_reference");
    }
    delta[j] = w - h; observed.push(j);
  }
  if (!observed.length) return [null, "no_observed_current_process"];
  const covariance = model.Cxx, g = covarianceGeometry(covariance);
  const missing = [...Array(p).keys()].filter(j => !observed.includes(j));
  const conditionalCov = zeros(p, p);
  if (missing.length) {
    const observedInverse = covarianceGeometry(sub(covariance, observed, observed)).inverse;
    const slope = matMul(sub(covariance, missing, observed), observedInverse);
    const observedDelta = observed.map(j => delta[j]);
    missing.forEach((j, m) => { delta[j] = dot(slope[m], observedDelta); });
    const observedRoot = observed.map(j => g.root[j]);
    const residualRoot = missing.map((j, m) => g.root[j].map((v, k) => v - slope[m].reduce((s, c, o) => s + c * observedRoot[o][k], 0)));
    missing.forEach((i, x) => missing.forEach((j, y) => { conditionalCov[i][j] = dot(residualRoot[x], residualRoot[y]); }));
  }
  const standardized = delta.map((d, j) => (g.scales[j] > 0 ? d / g.scales[j] : 0));
  const residual = standardized.map((v, i) => v - dot(g.projector[i], standardized));
  const tol = 256 * EPS * p * Math.max(1, norm(standardized));
  const outsidePriorSpan = norm(residual) > tol || delta.some((d, j) => g.scales[j] === 0 && d !== 0);
  const outsidePriorComponentRange = delta.some((d, j) => {
    const boundTol = 256 * EPS * Math.max(1, Math.abs(d));
    return d < model.deltaMin[j] - boundTol || d > model.deltaMax[j] + boundTol;
  });
  return [{ delta, observedIndices: observed, imputedIndices: missing, modes, missingProcessCovariance: conditionalCov, outsidePriorSpan, outsidePriorComponentRange, missingVarianceIsWorkingNotCalibrated: true }, null];
}

/** One current support-conditioned gap; never a trusted or automatic trade flag. */
export function score(model: ScoringModel | null, production: ProductionAxis, currentProcess: (number | null)[], referenceProcess: (number | null)[], referenceIsPersonal: boolean[], fresh: boolean): SupportGapResult {
  const result: SupportGapResult = {
    version: SUPPORT_GAP_VERSION, value: null, normalizedGap: null, productionAxis: structuredClone(production),
    trustedListEligible: false, recommendation: null, researchList: null, confidenceProbability: null,
    covarianceNotConditionalCalibration: true, currentProcess: [...currentProcess], status: "unavailable",
  };
  if (model === null) return { ...result, reason: "unestimable_prior_sensitivity" };
  const t = production.current_seconds;
  if (production.value == null || typeof t !== "number" || !Number.isFinite(t) || t <= 0) return { ...result, reason: "no_measured_current_production_or_exposure" };
  let expected: number[], actual: number[], v: Matrix;
  try {
    expected = vector(production.expected_totals, 3); actual = vector(production.raw_observed, 3);
    v = production.joint_gap_covariance as Matrix;
    covarianceGeometry(v);
    if (v.length !== 3 || v.some((r, i) => r[i] <= 0)) throw new Error("Unusable baseline scale");
  } catch {
    return { ...result, reason: "missing_invalid_baseline_inputs" };
  }
  if (expected[0] < 0 || expected[1] < 0 || actual[0] < 0 || actual[1] < 0) throw new Error("Invalid FP/points; signed GS remains valid");
  const [process, reason] = conditionalDelta(model, currentProcess, referenceProcess, referenceIsPersonal);
  if (!process) return { ...result, reason: reason! };
  const beta = model.beta;
  if (beta.length !== model.featureNames.length || beta.some(r => r.length !== 3 || !r.every(Number.isFinite))) throw new Error("Invalid coefficient matrix");
  const hours = t / 3600;
  const adjustment = vecMat(process.delta, beta).map(x => hours * x);
  const supportUnfloored = expected.map((e, i) => e + adjustment[i]);
  const floors = [0, 1].filter(i => supportUnfloored[i] < 0);
  const support = supportUnfloored.map((s, i) => (i < 2 ? Math.max(s, 0) : s));
  const scales = v.map((r, i) => Math.sqrt(r[i]));
  const r = v.map((row, i) => row.map((x, j) => x / (scales[i] * scales[j])));
  const denominator = dot(vecMat(OUTCOME_WEIGHTS, r), OUTCOME_WEIGHTS);
  if (denominator <= 0) return { ...result, reason: "unusable_aggregate_scale" };
  const a = OUTCOME_WEIGHTS.map((w, i) => w / scales[i] / Math.sqrt(denominator));
  const d = dot(a, support.map((s, i) => s - actual[i]));
  const originalD = dot(a, expected.map((e, i) => e - actual[i]));
  const variance = matMul(matMul(transpose(beta), process.missingProcessCovariance), beta).map(row => row.map(x => hours * hours * x));
  covarianceGeometry(variance);
  const sign = (x: number) => (x > 0 ? 1 : x < 0 ? -1 : 0);
  const concordant = sign(d) !== 0 && sign(d) === sign(originalD);
  const measured = !process.imputedIndices.length && process.modes.every(m => m === "measured_current_personal_reference") &&
    (production.personal_n ?? 0) > 0 && !floors.length && !process.outsidePriorSpan && !process.outsidePriorComponentRange;
  const status: SupportStatus = sign(d) === 0 ? "balanced_model_estimate" : sign(originalD) === 0 ? "support_direction_without_baseline_concordance" : !concordant ? "conflicting_baseline_and_support" : "concordant_research_candidate";
  return {
    ...result, value: 100 * d / (1 + Math.abs(d)), normalizedGap: d, baselineNormalizedGap: originalD, status,
    evidenceTier: measured ? "measured_process_personal_reference" : "provisional_estimated_or_extrapolated", process,
    expectedBaseline: expected, expectedSupport: support, expectedSupportUnfloored: supportUnfloored, rawActual: actual,
    supportAdjustment: adjustment, physicalFloorIndices: floors, missingProcessOutputCovariance: variance,
    missingProcessNormalizedVariance: dot(vecMat(a, variance), a), missingProcessVarianceNotAddedToBaseline: true,
    individualFinishingOrSOGGate: false, freshProxy: Boolean(fresh), supportCorrectionZero: adjustment.every(x => x === 0),
    fittingRank: model.rank, donorPlayers: model.donors, researchList: fresh && concordant ? (d > 0 ? "BL" : "SH") : null,
  };
}

export type RankedRecord = { playerId: number; snapshotDate: string; candidate: SupportGapResult };
/** Two directional research lists; records outside them are kept by the caller, never given a neutral score. */
export function rankTwoLists(records: RankedRecord[]): { BL: RankedRecord[]; SH: RankedRecord[] } {
  const keys = records.map(r => `${r.playerId}|${r.snapshotDate}`);
  if (new Set(keys).size !== keys.length) throw new Error("Duplicate ranking origin");
  const lists: { BL: RankedRecord[]; SH: RankedRecord[] } = { BL: [], SH: [] };
  for (const r of records) {
    const s = r.candidate;
    if (s.trustedListEligible !== false) throw new Error("Research trust contract changed");
    if (s.researchList === "BL" || s.researchList === "SH") {
      if (s.value === null || !s.freshProxy || s.status !== "concordant_research_candidate") throw new Error("Invalid directional list member");
      lists[s.researchList].push(r);
    }
  }
  const order = (x: RankedRecord, y: RankedRecord) =>
    Number(x.candidate.evidenceTier !== "measured_process_personal_reference") - Number(y.candidate.evidenceTier !== "measured_process_personal_reference") ||
    Math.abs(y.candidate.value!) - Math.abs(x.candidate.value!) || x.playerId - y.playerId || x.snapshotDate.localeCompare(y.snapshotDate);
  lists.BL.sort(order); lists.SH.sort(order);
  return lists;
}

/* ---------------------------------------------------------------------------
 * Explanation layer (v3, after two independent reviews). Reads a finished score;
 * never changes it. Recorded values, provider-model-relative values, model
 * sensitivities and imputed estimates stay apart; context readings are hypotheses
 * only. No item identifies luck, market value or a forecast.
 *
 * Integrity rules:
 * - Attribution is bound to the scoring call: `scoreAndAttribute` freezes the result and
 *   records a snapshot of the scoring model and its per-feature contributions, and
 *   `explainSupportGap` only uses that record (never a model supplied later).
 * - The scored identity is read from the production axis the score consumed
 *   (player_id, current_source_ids, reference_source_ids). Context is used only when it
 *   matches those games and, where recorded, the scored goals and assists.
 * - Rates use the exposure of the scope they describe (all situations, ES or PP).
 * - Current/reference comparisons need the same scope, provider and field; a known
 *   revision mismatch withholds the delta, an unknown revision is flagged as unverified,
 *   and a window that mixes revisions game by game withholds the delta.
 * - Non-finite or negative counts/exposures are rejected with a reason, never used;
 *   ES and PP seconds are each checked against the total, and their sum when both exist.
 * ------------------------------------------------------------------------- */
export const SUPPORT_GAP_EXPLANATION_VERSION = "support-gap-explanation-v3.2";
export const TRACKS = ["fantasy_points", "goals_plus_assists", "wigo_game_score"] as const;
/** measured: recorded values; provider_model_relative: recorded minus a provider's xG model;
 * reference_gap: recorded versus the reference estimate; model_sensitivity: frozen fitted correction;
 * imputed_estimate: missing value estimated; floor_adjustment: zero floor. */
export type EvidenceKind = "measured" | "provider_model_relative" | "reference_gap" | "model_sensitivity" | "imputed_estimate" | "floor_adjustment";
export type ReferenceKind = "personal" | "cohort" | "estimated" | "imputed_current";
export type Scope = "all_situations" | "even_strength" | "power_play" | "unknown";
/** Where a window total came from. `revision: null` means the provider revision is not known.
 * `gameRevisions`, when known, lists each game's revision in window order; a `mixed:` label
 * or more than one distinct game revision marks a mixed window. */
export type Provenance = { provider: string; field: string; revision: string | null; gameRevisions?: string[] };
type EvidenceField = "goals" | "assists" | "shots" | "ixG" | "onIceGoals" | "onIceXG";
/** Window totals over exactly the games in `identity`. A field must be `null` unless every
 * game has it; `null` means unavailable, never zero. Scopes and provenance describe each total. */
export type WindowEvidence = {
  identity: { playerId: number; sourceIds: number[] } | null;
  appearances: number | null; seconds: number | null; esSeconds: number | null; ppSeconds: number | null;
  goals: number | null; assists: number | null; shots: number | null; ixG: number | null;
  onIceGF: number | null; onIceXGF: number | null;
  scopes: Record<EvidenceField, Scope>;
  provenance: Record<EvidenceField, Provenance | null>;
};
/** The game identities the score was computed from, as recorded on its production axis. */
export type ScoredIdentity = { playerId: number; currentSourceIds: number[]; referenceSourceIds: number[] };
export type CoverageNote = { component: string; state: "available" | "partial" | "unavailable" | "estimated"; reason: string; count?: number };
export type ExplanationContext = { current: WindowEvidence | null; reference: WindowEvidence | null; coverage?: CoverageNote[] };
export type GapComponent = { id: string; kind: EvidenceKind; value: number; note: string; processDelta?: number; mode?: ProcessMode; referenceKind?: ReferenceKind };
export type TrackExplanation = {
  track: (typeof TRACKS)[number]; actual: number; expectedBaseline: number; expectedSupport: number; gap: number;
  components: GapComponent[]; reconciliationResidual: number;
  /** The track's share of the score: normalizedGap = Σ normalizedContribution over tracks. */
  normalizedWeight: number; normalizedContribution: number; baselineNormalizedContribution: number;
};
export type Comparison = {
  metric: string; kind: EvidenceKind; units: string; current: number | null; reference: number | null; delta: number | null;
  status: "available" | "unavailable"; reason: string | null; referenceReason: string | null; deltaReason: string | null;
  revisionVerified: boolean | null;
};
/** The number is a recorded comparison; its reading is only a hypothesis and it is not a score input. */
export type ContextSignal = Comparison & { scoreInput: false; interpretation: "hypothesis"; hypotheses: string[]; scale?: { value: number; units: string; assumption: string } };
export type Attribution = { modelFingerprint: string; model: ScoringModel; featureNames: string[]; beta: Matrix; contributions: number[][] };
export type SupportGapExplanation = {
  version: typeof SUPPORT_GAP_EXPLANATION_VERSION; scoreVersion: typeof SUPPORT_GAP_VERSION;
  status: SupportStatus; value: number | null; normalizedGap: number | null; baselineNormalizedGap: number | null;
  gapSign: "buy_low_evidence" | "sell_high_evidence" | "balanced" | null; researchList: "BL" | "SH" | null;
  scoreWindow: { seconds: number | null; appearances: number | null; identity: ScoredIdentity | null; currentContextVerified: boolean; referenceContextVerified: boolean };
  tracks: TrackExplanation[]; normalizedReconciliationResidual: number | null; opportunity: Comparison[]; context: ContextSignal[];
  confidence: {
    evidenceTier: EvidenceTier | null; freshProxy: boolean | null; currentSeconds: number | null; personalN: number | null;
    personalWeight: number | null; donorPlayers: number | null; missingProcessNormalizedVariance: number | null;
    imputedProcesses: string[]; outsidePriorSpan: boolean | null; outsidePriorComponentRange: boolean | null;
    physicalFloors: string[]; calibratedProbability: null;
  };
  coverage: CoverageNote[];
  claims: { luckIdentified: false; marketValue: false; forecast: false; trusted: false };
};

const PROCESS_NOTES: Record<string, string> = {
  individual_xG60: "Change in the player's own expected goals per 60 versus their reference, times the frozen sensitivity.",
  shared_onice_xGF60: "Change in on-ice expected goals for per 60 versus the reference, times the frozen sensitivity.",
  shared_onice_xGA60: "Change in on-ice expected goals against per 60 versus the reference, times the frozen sensitivity.",
};
const REFERENCE_KIND: Record<ProcessMode, ReferenceKind> = {
  measured_current_personal_reference: "personal", measured_current_cohort_reference: "cohort",
  measured_current_estimated_reference: "estimated", missing_current_linear_estimate: "imputed_current",
};
const finiteNumber = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const sameIds = (a: number[], b: number[]) => a.length === b.length && a.every((v, i) => v === b[i]);

/* ---- attribution bound to the scoring call ---- */
const ATTRIBUTIONS = new WeakMap<SupportGapResult, Attribution>();
const deepFreeze = <T,>(o: T): T => { if (o && typeof o === "object") { Object.values(o).forEach(deepFreeze); Object.freeze(o); } return o; };
const fingerprint = (m: ScoringModel) => JSON.stringify([m.featureNames, m.beta, m.Cxx, m.cohortX, m.deltaMin, m.deltaMax, m.rank]);

/** Score with the unchanged `score`, freeze the result, and record the scoring model and its per-feature contributions with it. */
export function scoreAndAttribute(model: ScoringModel | null, production: ProductionAxis, currentProcess: (number | null)[], referenceProcess: (number | null)[], referenceIsPersonal: boolean[], fresh: boolean): SupportGapResult {
  const result = score(model, production, currentProcess, referenceProcess, referenceIsPersonal, fresh);
  if (model && result.value !== null && result.process) {
    const snapshot: ScoringModel = structuredClone({ featureNames: model.featureNames, beta: model.beta, Cxx: model.Cxx, cohortX: model.cohortX,
      rank: model.rank, deltaMin: model.deltaMin, deltaMax: model.deltaMax, donors: model.donors });
    const hours = (production.current_seconds as number) / 3600;
    ATTRIBUTIONS.set(result, deepFreeze({ modelFingerprint: fingerprint(snapshot), model: snapshot, featureNames: snapshot.featureNames, beta: snapshot.beta,
      contributions: snapshot.featureNames.map((_, j) => TRACKS.map((__, t) => hours * result.process!.delta[j] * snapshot.beta[j][t])) }));
  }
  // Freezing prevents relabelling modes, deltas or exposure after the attribution was recorded.
  return deepFreeze(result);
}
/** The attribution recorded when this exact result was scored, or null. */
export function attributionOf(result: SupportGapResult): Attribution | null { return ATTRIBUTIONS.get(result) ?? null; }

/** Returns a reason when the record does not match the result; never throws. */
function attributionProblem(result: SupportGapResult, a: Attribution): string | null {
  const process = result.process!, p = a.featureNames.length;
  let problem: string | null = null;
  const bad = (why: string) => { problem ??= why; };
  if (!p || new Set(a.featureNames).size !== p || process.modes.length !== p || process.delta.length !== p) bad("feature names/order");
  if (a.beta.length !== p || a.beta.some(r => r.length !== 3 || !r.every(finiteNumber))) bad("invalid coefficients");
  if (a.model.featureNames !== a.featureNames || a.model.beta !== a.beta || a.modelFingerprint !== fingerprint(a.model)) bad("model fingerprint");
  if (problem) return problem;
  const hours = (result.productionAxis.current_seconds as number) / 3600;
  TRACKS.forEach((_, t) => {
    let sum = 0;
    for (let j = 0; j < p; j++) {
      const expected = hours * process.delta[j] * a.beta[j][t], got = a.contributions[j]?.[t];
      if (!finiteNumber(got) || Math.abs(got - expected) > 1e-12 * Math.max(1, Math.abs(expected))) bad("per-feature contribution");
      sum += got;
    }
    if (Math.abs(sum - result.supportAdjustment![t]) > 1e-9 * Math.max(1, Math.abs(result.supportAdjustment![t]))) bad("support adjustment");
  });
  return problem;
}

/* ---- window validation, exposure by scope, provenance compatibility ---- */
type Rate = { value: number | null; reason: string | null; provenance?: (Provenance | null)[]; scope?: Scope };
const COUNT_FIELDS = ["appearances", "seconds", "esSeconds", "ppSeconds", "goals", "assists", "shots", "ixG", "onIceGF", "onIceXGF"] as const;

/** Reject non-finite or negative values. Invalid exposure or appearances invalidate the whole window. */
function cleanWindow(w: WindowEvidence | null, label: string, coverage: CoverageNote[]): WindowEvidence | null {
  if (!w) return null;
  const out = { ...w };
  for (const k of COUNT_FIELDS) {
    const v = w[k];
    if (v !== null && (!finiteNumber(v) || v < 0 || (k === "appearances" && !Number.isInteger(v)))) {
      coverage.push({ component: `${label}_window`, state: "unavailable", reason: `invalid_${k}` });
      if (k === "seconds" || k === "appearances") return null;
      out[k] = null;
    }
  }
  // ES and PP seconds are parts of the total (SH makes up the rest); allow one second of rounding per game.
  // Each known part is checked on its own, then their sum when both exist.
  const limit = out.seconds === null ? null : out.seconds + (out.appearances ?? 0);
  if (limit !== null && [out.esSeconds, out.ppSeconds, out.esSeconds !== null && out.ppSeconds !== null ? out.esSeconds + out.ppSeconds : null].some(v => v !== null && v > limit)) {
    coverage.push({ component: `${label}_window`, state: "unavailable", reason: "exposure_components_exceed_total" });
    return null;
  }
  return out;
}
function exposure(w: WindowEvidence, scope: Scope): Rate {
  const seconds = scope === "all_situations" ? w.seconds : scope === "even_strength" ? w.esSeconds : scope === "power_play" ? w.ppSeconds : null;
  if (scope === "unknown") return { value: null, reason: "unknown_scope_no_exposure" };
  if (seconds === null) return { value: null, reason: `${scope}_TOI_missing` };
  if (seconds <= 0) return { value: null, reason: `no_${scope}_ice_time` };
  return { value: seconds, reason: null };
}
function perGame(w: WindowEvidence | null, value: number | null, missing: string): Rate {
  if (!w) return { value: null, reason: "window_not_supplied" };
  if (w.appearances === null) return { value: null, reason: "appearances_missing" };
  if (w.appearances <= 0) return { value: null, reason: "no_appearances" };
  return value === null ? { value: null, reason: missing } : { value: value / w.appearances, reason: null };
}
/** A per-60 rate (or difference of two totals) in one declared scope with known provenance. */
function scopedPer60(w: WindowEvidence | null, fields: EvidenceField[], totals: (number | null)[], combine: (v: number[]) => number, missing: string): Rate {
  if (!w) return { value: null, reason: "window_not_supplied" };
  if (totals.some(v => v === null)) return { value: null, reason: missing };
  const scopes = fields.map(f => w.scopes[f]), provenance = fields.map(f => w.provenance[f]);
  if (provenance.some(p => !p || !p.provider || !p.field)) return { value: null, reason: "provenance_unknown" };
  if (scopes.some(s => s !== scopes[0])) return { value: null, reason: "operands_scope_mismatch" };
  const e = exposure(w, scopes[0]);
  if (e.value === null) return { value: null, reason: e.reason };
  return { value: (3600 * combine(totals as number[])) / e.value, reason: null, provenance, scope: scopes[0] };
}
function compatible(c: Rate, r: Rate): { ok: boolean; reason: string | null; revisionVerified: boolean | null } {
  if (c.value === null || r.value === null) return { ok: false, reason: null, revisionVerified: null };
  if (c.scope !== r.scope) return { ok: false, reason: "current_reference_scope_mismatch", revisionVerified: null };
  const pc = c.provenance ?? [], pr = r.provenance ?? [];
  if (pc.length !== pr.length || pc.some((p, i) => p!.provider !== pr[i]!.provider || p!.field !== pr[i]!.field)) return { ok: false, reason: "current_reference_source_mismatch", revisionVerified: null };
  if (pc.some((p, i) => p!.revision !== null && pr[i]!.revision !== null && p!.revision !== pr[i]!.revision)) return { ok: false, reason: "current_reference_revision_mismatch", revisionVerified: null };
  // Equal `mixed:` labels can hide opposite game-by-game compositions, so mixed windows are not compared.
  const mixed = (p: Provenance | null) => !!p && (p.revision?.startsWith("mixed:") || new Set(p.gameRevisions ?? []).size > 1);
  if ([...pc, ...pr].some(mixed)) return { ok: false, reason: "current_reference_mixed_revision_composition", revisionVerified: null };
  return { ok: true, reason: null, revisionVerified: pc.every((p, i) => p!.revision !== null && p!.revision === pr[i]!.revision) };
}
function compare(metric: string, units: string, kind: EvidenceKind, current: Rate, reference: Rate, checkSources: boolean): Comparison {
  const fit = checkSources ? compatible(current, reference) : { ok: current.value !== null && reference.value !== null, reason: null, revisionVerified: null };
  return { metric, kind, units, current: current.value, reference: reference.value, delta: fit.ok ? current.value! - reference.value! : null,
    status: current.value === null ? "unavailable" : "available", reason: current.reason, referenceReason: reference.reason,
    deltaReason: fit.ok ? null : fit.reason ?? (reference.value === null ? "no_reference_value" : current.value === null ? "no_current_value" : null), revisionVerified: fit.revisionVerified };
}
/** Assists per goal scored by a teammate while the player was on ice (own goals cannot be assisted). */
function teammateGoalAssistRate(w: WindowEvidence | null): Rate {
  if (!w) return { value: null, reason: "window_not_supplied" };
  if (w.assists === null || w.onIceGF === null || w.goals === null) return { value: null, reason: "assists_goals_or_on_ice_goals_missing" };
  const fields: EvidenceField[] = ["assists", "goals", "onIceGoals"], provenance = fields.map(f => w.provenance[f]);
  if (provenance.some(p => !p || !p.provider || !p.field)) return { value: null, reason: "provenance_unknown" };
  if (fields.some(f => w.scopes[f] !== w.scopes.onIceGoals) || w.scopes.onIceGoals === "unknown") return { value: null, reason: "operands_scope_mismatch" };
  const teammateGoals = w.onIceGF - w.goals;
  if (teammateGoals < 0 || w.assists > teammateGoals) return { value: null, reason: "assists_exceed_teammate_on_ice_goals_data_conflict" };
  if (teammateGoals === 0) return { value: null, reason: "no_teammate_on_ice_goals_ratio_undefined" };
  return { value: w.assists / teammateGoals, reason: null, provenance, scope: w.scopes.onIceGoals };
}

/** All-situations context goals/assists must match the scored split when recorded, never exceed the scored G+A, and sum to it when both are present. */
function outcomesDisagree(c: WindowEvidence, scoredGA: number | null, scoredGoals: number | null, scoredAssists: number | null): boolean {
  const goals = c.scopes.goals === "all_situations" ? c.goals : null, assists = c.scopes.assists === "all_situations" ? c.assists : null;
  const off = (a: number, b: number) => Math.abs(a - b) > 1e-9;
  if (goals !== null && scoredGoals !== null && off(goals, scoredGoals)) return true;
  if (assists !== null && scoredAssists !== null && off(assists, scoredAssists)) return true;
  if (scoredGA === null) return false;
  if ((goals !== null && goals > scoredGA + 1e-9) || (assists !== null && assists > scoredGA + 1e-9)) return true;
  return goals !== null && assists !== null && off(goals + assists, scoredGA);
}

/** Explain a result produced by `scoreAndAttribute`. */
export function explainSupportGap(result: SupportGapResult, context: ExplanationContext): SupportGapExplanation {
  const coverage: CoverageNote[] = [...(context.coverage ?? [])];
  const p = result.productionAxis;
  const scoreSeconds = finiteNumber(p.current_seconds) ? p.current_seconds : null;
  const scoreAppearances = finiteNumber(p.current_recorded_slots) ? p.current_recorded_slots : null;
  const tracks: TrackExplanation[] = [];
  let normalizedReconciliationResidual: number | null = null;
  const attribution = attributionOf(result);
  if (result.value === null || !result.process) {
    coverage.push({ component: "score", state: "unavailable", reason: result.reason ?? "score_not_available" });
  } else if (!attribution) {
    coverage.push({ component: "score_components", state: "unavailable", reason: "explanation_attribution_missing" });
  } else if (attributionProblem(result, attribution)) {
    coverage.push({ component: "score_components", state: "unavailable", reason: `attribution_integrity_failed:${attributionProblem(result, attribution)}` });
  } else {
    const process = result.process;
    // Same normalization as `score`, recomputed read-only so each track's share is visible.
    const v = p.joint_gap_covariance as Matrix, sd = v.map((row, i) => Math.sqrt(row[i]));
    const r = v.map((row, i) => row.map((x, j) => x / (sd[i] * sd[j])));
    const weights = OUTCOME_WEIGHTS.map((w, i) => w / sd[i] / Math.sqrt(dot(vecMat(OUTCOME_WEIGHTS, r), OUTCOME_WEIGHTS)));
    const personalN = finiteNumber(p.personal_n) ? p.personal_n : null, personalWeight = finiteNumber(p.personal_weight) ? p.personal_weight : null;
    const personalReason = typeof p.personal_reason === "string" ? p.personal_reason : null;
    const referenceNote = personalN === null ? "Personal-history size is not recorded; the reference blend is unknown." :
      personalN === 0 ? (personalReason && personalReason !== "no_personal_history_cohort"
        ? `Personal production history exists but was not usable (${personalReason}); the reference is the position cohort's rate.`
        : "No personal production history: the reference is the position cohort's rate.") :
      `Reference rate blends the player's ${personalN} recorded games (weight ${personalWeight === null ? "unknown" : personalWeight.toFixed(2)}) with the position cohort.`;
    TRACKS.forEach((track, t) => {
      const actual = result.rawActual![t], baseline = result.expectedBaseline![t], support = result.expectedSupport![t];
      const components: GapComponent[] = [{ id: "production_vs_reference", kind: "reference_gap", value: baseline - actual,
        note: `Reference production at the score window's total ice time minus recorded production. ${referenceNote} Power-play share, role and linemates are not modelled separately.` }];
      attribution.featureNames.forEach((feature, j) => {
        const mode = process.modes[j];
        components.push({ id: `process:${feature}`, kind: mode === "missing_current_linear_estimate" ? "imputed_estimate" : "model_sensitivity",
          value: attribution.contributions[j][t], processDelta: process.delta[j], mode, referenceKind: REFERENCE_KIND[mode],
          note: `${PROCESS_NOTES[feature] ?? feature}${mode === "missing_current_linear_estimate" ? " Current value missing; delta estimated from the observed ones." : mode === "measured_current_personal_reference" ? "" : " Reference is not the player's own measured history."}` });
      });
      const floor = support - result.expectedSupportUnfloored![t];
      if (floor !== 0) components.push({ id: "physical_floor", kind: "floor_adjustment", value: floor, note: "Expected production was raised to zero; counts cannot be negative." });
      const gap = support - actual;
      tracks.push({ track, actual, expectedBaseline: baseline, expectedSupport: support, gap, components,
        reconciliationResidual: gap - components.reduce((s, c) => s + c.value, 0),
        normalizedWeight: weights[t], normalizedContribution: weights[t] * gap, baselineNormalizedContribution: weights[t] * (baseline - actual) });
    });
    normalizedReconciliationResidual = (result.normalizedGap as number) - tracks.reduce((s, t) => s + t.normalizedContribution, 0);
    process.modes.forEach((mode, j) => {
      const component = `process:${attribution.featureNames[j]}`;
      if (mode === "missing_current_linear_estimate") coverage.push({ component, state: "estimated", reason: "current_process_missing_linear_estimate" });
      else if (mode === "measured_current_cohort_reference") coverage.push({ component, state: "estimated", reason: "no_personal_reference_cohort_mean_used" });
      else if (mode === "measured_current_estimated_reference") coverage.push({ component, state: "estimated", reason: "reference_estimated_not_personal_measured" });
    });
  }

  // Context must describe exactly the scored games, as recorded on the production axis the score consumed.
  const ids = (v: unknown) => (Array.isArray(v) && v.every(x => Number.isSafeInteger(x)) ? (v as number[]) : null);
  const axisCurrent = ids(p.current_source_ids), axisReference = ids(p.reference_source_ids);
  const scored: ScoredIdentity | null = Number.isSafeInteger(p.player_id) && axisCurrent && axisReference
    ? { playerId: p.player_id as number, currentSourceIds: axisCurrent, referenceSourceIds: axisReference } : null;
  const scoredGoals = finiteNumber(p.current_goals) ? p.current_goals : null, scoredAssists = finiteNumber(p.current_assists) ? p.current_assists : null;
  const withhold = (label: string, reason: string) => { coverage.push({ component: `${label}_window_context`, state: "unavailable", reason }); return null; };
  let c = cleanWindow(context.current, "current", coverage), r = cleanWindow(context.reference, "reference", coverage);
  if (!context.current) c = withhold("current", "current_window_not_supplied");
  else if (!scored) c = withhold("current", "scored_identity_not_recorded");
  else if (!c) c = withhold("current", "current_window_invalid");
  else if (!c.identity) c = withhold("current", "window_identity_missing");
  else if (c.identity.playerId !== scored.playerId || !sameIds(c.identity.sourceIds, scored.currentSourceIds))
    c = withhold("current", "context_identity_differs_from_scored_window");
  else if (c.appearances !== c.identity.sourceIds.length || (scoreAppearances !== null && c.appearances !== scoreAppearances) ||
    (scoreSeconds !== null && (c.seconds === null || Math.abs(c.seconds - scoreSeconds) > 1e-6 * Math.max(1, scoreSeconds))))
    c = withhold("current", "context_window_mismatch_with_scored_window");
  else if (outcomesDisagree(c, result.rawActual?.[1] ?? null, scoredGoals, scoredAssists))
    c = withhold("current", "context_outcomes_disagree_with_scored_totals");
  if (!context.reference) r = withhold("reference", "reference_window_not_supplied");
  else if (!scored) r = withhold("reference", "scored_identity_not_recorded");
  else if (!r) r = withhold("reference", "reference_window_invalid");
  else if (!r.identity) r = withhold("reference", "window_identity_missing");
  else if (r.identity.playerId !== scored.playerId || !sameIds(r.identity.sourceIds, scored.referenceSourceIds) || r.appearances !== r.identity.sourceIds.length)
    r = withhold("reference", "context_identity_differs_from_scored_reference");

  const total = (w: WindowEvidence | null, k: "seconds" | "esSeconds" | "ppSeconds", missing: string) => perGame(w, w ? w[k] : null, missing);
  const opportunity = [
    compare("total_TOI_per_game", "seconds/appearance", "measured", total(c, "seconds", "TOI_missing"), total(r, "seconds", "TOI_missing"), false),
    compare("ES_TOI_per_game", "seconds/appearance", "measured", total(c, "esSeconds", "ES_TOI_missing"), total(r, "esSeconds", "ES_TOI_missing"), false),
    compare("PP_TOI_per_game", "seconds/appearance", "measured", total(c, "ppSeconds", "PP_TOI_missing"), total(r, "ppSeconds", "PP_TOI_missing"), false),
  ];
  const signal = (base: Comparison, hypotheses: string[], scale?: ContextSignal["scale"]): ContextSignal =>
    ({ ...base, scoreInput: false, interpretation: "hypothesis", hypotheses, ...(scale && base.status === "available" ? { scale } : {}) });
  const finishing = (w: WindowEvidence | null) => scopedPer60(w, ["goals", "ixG"], [w?.goals ?? null, w?.ixG ?? null], ([g, x]) => g - x, "goals_or_individual_xG_missing");
  const onIce = (w: WindowEvidence | null) => scopedPer60(w, ["onIceGoals", "onIceXG"], [w?.onIceGF ?? null, w?.onIceXGF ?? null], ([g, x]) => g - x, "on_ice_goals_or_xGF_missing");
  const shots = (w: WindowEvidence | null) => scopedPer60(w, ["shots"], [w?.shots ?? null], ([s]) => s, "shots_missing");
  const fc = finishing(c), ixG = c?.ixG ?? null, ixGExposure = c ? exposure(c, c.scopes.ixG).value : null;
  const signals: ContextSignal[] = [
    signal(compare("goals_minus_individual_xG_per_60", "goals/60 minus provider xG/60, per 60 of the operands' scope", "provider_model_relative", fc, finishing(r), true),
      ["goals and xG drawn from different sources or game states", "empty-net goals or the goaltending faced", "short-window finishing variance", "shot quality the provider's xG model does not capture", "a real change in finishing ability"],
      fc.value !== null && ixG !== null && ixG > 0 && ixGExposure !== null ? { value: (3600 * Math.sqrt(ixG)) / ixGExposure, units: "goals/60 of the same scope",
        assumption: "Upper-bound spread if window goals were Poisson with mean equal to provider xG; per-shot variance is smaller, and it ignores the reference's own uncertainty." } : undefined),
    signal(compare("on_ice_goals_minus_xGF_per_60", "on-ice goals/60 minus provider xGF/60, per 60 of the operands' scope", "provider_model_relative", onIce(c), onIce(r), true),
      ["goals and xGF drawn from different sources or game states", "the player's own finishing", "teammates' finishing variance", "opposing goaltending", "linemate or role change"]),
    signal(compare("assists_per_teammate_on_ice_goal", "assists / (on-ice goals for − own goals)", "measured", teammateGoalAssistRate(c), teammateGoalAssistRate(r), true),
      ["assists and on-ice goals drawn from different game states", "variance on few goals", "role or linemate change", "a real change in playmaking"]),
    signal(compare("shots_per_60", "shots/60 of the shots' scope", "measured", shots(c), shots(r), true),
      ["deployment change", "a real change in shot volume (process, not a finishing signal)"]),
  ];
  if (c) for (const item of [...opportunity, ...signals]) if (item.status === "unavailable") coverage.push({ component: item.metric, state: "unavailable", reason: item.reason! });
  if (fc.value !== null && ixG === 0) coverage.push({ component: "goals_minus_individual_xG_per_60", state: "partial", reason: "spread_undefined_zero_xG" });
  if (r) for (const item of [...opportunity, ...signals]) if (item.reference === null) coverage.push({ component: `reference:${item.metric}`, state: "unavailable", reason: item.referenceReason! });
  for (const item of signals) {
    if (item.current !== null && item.reference !== null && item.delta === null) coverage.push({ component: `delta:${item.metric}`, state: "unavailable", reason: item.deltaReason! });
    if (item.delta !== null && item.revisionVerified === false) coverage.push({ component: `delta:${item.metric}`, state: "partial", reason: "provider_revision_unverified" });
  }

  const seen = new Set<string>();
  const uniqueCoverage = coverage.filter(n => { const k = JSON.stringify([n.component, n.state, n.reason, n.count ?? null]); return !seen.has(k) && !!seen.add(k); });
  const d = result.normalizedGap, process = result.process;
  return {
    version: SUPPORT_GAP_EXPLANATION_VERSION, scoreVersion: SUPPORT_GAP_VERSION, status: result.status, value: result.value,
    normalizedGap: d, baselineNormalizedGap: result.baselineNormalizedGap ?? null,
    gapSign: d === null ? null : d > 0 ? "buy_low_evidence" : d < 0 ? "sell_high_evidence" : "balanced", researchList: result.researchList,
    scoreWindow: { seconds: scoreSeconds, appearances: scoreAppearances, identity: scored, currentContextVerified: c !== null, referenceContextVerified: r !== null },
    tracks, normalizedReconciliationResidual, opportunity, context: signals,
    confidence: {
      evidenceTier: result.evidenceTier ?? null, freshProxy: result.freshProxy ?? null, currentSeconds: scoreSeconds,
      personalN: finiteNumber(p.personal_n) ? p.personal_n : null, personalWeight: finiteNumber(p.personal_weight) ? p.personal_weight : null,
      donorPlayers: result.donorPlayers ?? null, missingProcessNormalizedVariance: result.missingProcessNormalizedVariance ?? null,
      imputedProcesses: process && attribution ? process.imputedIndices.map(j => attribution.featureNames[j]) : [],
      outsidePriorSpan: process?.outsidePriorSpan ?? null, outsidePriorComponentRange: process?.outsidePriorComponentRange ?? null,
      physicalFloors: (result.physicalFloorIndices ?? []).map(i => TRACKS[i]), calibratedProbability: null,
    },
    coverage: uniqueCoverage, claims: { luckIdentified: false, marketValue: false, forecast: false, trusted: false },
  };
}
