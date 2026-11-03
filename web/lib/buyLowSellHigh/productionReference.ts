/** Port of the frozen research production reference `position-exposure-reference-gap-v1`
 * (Codex task-2 `exposure-rate-candidate-v1/estimator.py`, outcomes from `blsh_prototype.py`).
 * Pure functions only: no I/O, clock or network. Its output is the production axis that
 * `supportGap.score` consumes. Joint moments are working descriptive uncertainty, not
 * calibrated probabilities. No shot count, shooting percentage or finishing gate is used.
 */
export const PRODUCTION_REFERENCE_VERSION = "position-exposure-reference-gap-v1";
export const PRODUCTION_TRACKS = ["fantasy_points", "raw_points", "wigo_game_score"] as const;
/** FHFH Standard: 3G + 2A + PPP + .2SOG + .2HIT + .25BLK. */
export const FHFH_WEIGHTS = { goals: 3, assists: 2, pp_points: 1, shots: 0.2, hits: 0.2, blocked_shots: 0.25 } as const;
export const GS_FIELDS = ["goals", "total_primary_assists", "total_secondary_assists", "shots", "blocked_shots", "penalties_drawn", "penalties",
  "total_fow", "total_fol", "sat_for", "sat_against", "es_goals_for", "pp_goals_for", "sh_goals_for", "es_goals_against", "pp_goals_against", "sh_goals_against"] as const;
const WEIGHTS = [1 / 3, 1 / 3, 1 / 3];
const EPS = Number.EPSILON;

type Matrix = number[][];
export type Measured = { value: number | null; reason: string | null };
export type HistorySummary = {
  player_id: number; position: "F" | "D"; n: number; seconds: number; rate: number[]; source_ids: number[];
  start: string; end: string; residual_per_second?: Matrix;
};
export type ProductionPrior = {
  position: "F" | "D"; donors: number; donor_ids: number[]; mu: number[]; omega: Matrix; signal: Matrix; mean_cov: Matrix;
  metric: Matrix; variance_component_eigenvalues: number[]; donor_end_dates: string[];
};
export type ProductionReference = { rate: number[]; covariance: Matrix; personal_weight: number; personal_n: number; personal_seconds: number; omega?: Matrix | null };
/** Snake-case on purpose: this is the `production_axis` record `supportGap.score` reads. */
export type ProductionAxisRecord = {
  version: typeof PRODUCTION_REFERENCE_VERSION; value: number | null; direction: string | null; trusted_list_eligible: false;
  raw_observed: (number | null)[]; confidence_probability?: null; tier: string; [key: string]: unknown;
};

const finite = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const zeros = (r: number, c: number): Matrix => Array.from({ length: r }, () => new Array<number>(c).fill(0));
const dot = (a: number[], b: number[]) => a.reduce((s, v, i) => s + v * b[i], 0);
const matVec = (m: Matrix, v: number[]) => m.map(row => dot(row, v));
const matMul = (a: Matrix, b: Matrix) => a.map(row => b[0].map((_, j) => row.reduce((s, v, k) => s + v * b[k][j], 0)));
const trace = (m: Matrix) => m.reduce((s, row, i) => s + row[i], 0);
const add = (a: Matrix, b: Matrix) => a.map((row, i) => row.map((v, j) => v + b[i][j]));
const scale = (a: Matrix, k: number) => a.map(row => row.map(v => v * k));
const symmetrize = (a: Matrix) => a.map((row, i) => row.map((v, j) => (v + a[j][i]) / 2));

/** The three per-game production tracks; a missing or invalid input leaves that track null. */
export function outcomes(stats: Record<string, number | null | undefined>): Measured[] {
  const checked = (keys: readonly string[], calculation: () => number): Measured => {
    if (keys.some(k => stats[k] == null)) return { value: null, reason: "missing_required_input" };
    if (keys.some(k => !finite(stats[k]) || (stats[k] as number) < 0)) return { value: null, reason: "invalid_count_input" };
    const value = calculation();
    return Number.isFinite(value) ? { value, reason: null } : { value: null, reason: "nonfinite_result" };
  };
  const s = (k: string) => stats[k] as number;
  const fp = checked(Object.keys(FHFH_WEIGHTS), () => Object.entries(FHFH_WEIGHTS).reduce((sum, [k, w]) => sum + s(k) * w, 0));
  let pts = checked(["goals", "assists"], () => s("goals") + s("assists"));
  if (pts.value !== null && stats.points != null && (!finite(stats.points) || Math.abs(pts.value - stats.points) > 1e-10)) pts = { value: null, reason: "inconsistent_points_primitive" };
  const gs = checked(GS_FIELDS, () =>
    0.75 * s("goals") + 0.7 * s("total_primary_assists") + 0.55 * s("total_secondary_assists") + 0.075 * s("shots") + 0.05 * s("blocked_shots") +
    0.15 * (s("penalties_drawn") - s("penalties")) + 0.01 * (s("total_fow") - s("total_fol")) + 0.05 * (s("sat_for") - s("sat_against")) +
    0.15 * (s("es_goals_for") + s("pp_goals_for") + s("sh_goals_for") - (s("es_goals_against") + s("pp_goals_against") + s("sh_goals_against"))));
  return [fp, pts, gs];
}

/** Cyclic Jacobi eigendecomposition (values ascending, vectors as columns). Same method as supportGap.ts. */
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
      for (let k = 0; k < n; k++) { const x = a[k][p], y = a[k][q]; a[k][p] = c * x - s * y; a[k][q] = s * x + c * y; }
      for (let k = 0; k < n; k++) { const x = a[p][k], y = a[q][k]; a[p][k] = c * x - s * y; a[q][k] = s * x + c * y; }
      for (let k = 0; k < n; k++) { const x = v[k][p], y = v[k][q]; v[k][p] = c * x - s * y; v[k][q] = s * x + c * y; }
    }
  }
  const order = a.map((_, i) => i).sort((i, j) => a[i][i] - a[j][j]);
  return { values: order.map(i => a[i][i]), basis: v.map(row => order.map(i => row[i])) };
}
const reconstruct = (basis: Matrix, values: number[]) => basis.map(ri => basis.map(rj => values.reduce((s, v, k) => s + ri[k] * v * rj[k], 0)));

/** Dimensionless PSD validation; no maximum-entry scale can mask a block. */
export function validCovariance(matrix: unknown, positiveDiagonal = false): boolean {
  const a = matrix as Matrix;
  if (!Array.isArray(a) || a.length !== 3 || a.some(r => !Array.isArray(r) || r.length !== 3 || !r.every(finite))) return false;
  const diag = a.map((r, i) => r[i]);
  if (diag.some(d => d < 0) || (positiveDiagonal && diag.some(d => d <= 0))) return false;
  for (let i = 0; i < 3; i++) if (diag[i] === 0 && a.some((r, k) => r[i] !== 0 || a[i][k] !== 0)) return false;
  const keep = diag.flatMap((d, i) => (d > 0 ? [i] : []));
  if (!keep.length) return true;
  const s = keep.map(i => Math.sqrt(diag[i])), r = keep.map((i, x) => keep.map((j, y) => a[i][j] / (s[x] * s[y])));
  const tolerance = 64 * EPS * keep.length;
  if (r.some((row, i) => row.some((v, j) => Math.abs(v - r[j][i]) > tolerance))) return false;
  return Math.min(...symmetricEigen(symmetrize(r)).values) >= -tolerance;
}

function asPsd(matrix: Matrix): [Matrix, number[]] {
  const a = symmetrize(matrix);
  if (a.length !== 3 || a.some(r => r.length !== 3 || !r.every(finite))) throw new Error("Invalid three-track covariance");
  const { values, basis } = symmetricEigen(a);
  return [reconstruct(basis, values.map(v => Math.max(v, 0))), values];
}

function metricInverse(a: Matrix): Matrix {
  const diag = a.map((r, i) => r[i]);
  if (diag.some(d => d <= 0) || !a.every(r => r.every(finite))) throw new Error("Unestimable covariance scale; no epsilon");
  const s = diag.map(Math.sqrt), r = a.map((row, i) => row.map((v, j) => v / (s[i] * s[j])));
  const { values, basis } = symmetricEigen(symmetrize(r));
  const tol = EPS * values.length * Math.max(Math.max(...values.map(Math.abs)), 1);
  if (Math.min(...values) < -tol * 10) throw new Error("Non-PSD supplied covariance");
  return reconstruct(basis, values.map(v => (v > tol ? 1 / v : 0))).map((row, i) => row.map((v, j) => v / (s[i] * s[j])));
}

/** The final up-to-50 records strictly before `before`, ordered by date then id. */
export function selectReference<T extends { player_id: number; date: string; id: number }>(records: T[], playerId: number, before: string): T[] {
  return records.filter(r => r.player_id === playerId && r.date < before).sort((a, b) => a.date.localeCompare(b.date) || a.id - b.id).slice(-50);
}

export function summarizeHistory(playerId: number, position: string, values: number[][], seconds: number[], sourceIds: number[], dates: string[], cutoff: string, require50 = false): [HistorySummary | null, string | null] {
  const n = seconds.length;
  if ((position !== "F" && position !== "D") || values.length !== n || values.some(v => v.length !== 3) || n === 0 || n > 50 || (require50 && n !== 50)) return [null, "history_count_or_position"];
  if (sourceIds.length !== n || dates.length !== n || new Set(sourceIds).size !== n || new Set(dates).size !== n || dates.some((d, i) => i > 0 && dates[i - 1] > d)) throw new Error("Invalid history identity/order");
  if (dates.some(d => d >= cutoff)) throw new Error("Future/current-window event in reference");
  if (!values.every(v => v.every(finite)) || !seconds.every(finite) || seconds.some(t => t <= 0)) return [null, "missing_measurement_or_exposure"];
  if (values.some(v => v[0] < 0 || v[1] < 0)) return [null, "negative_FP_or_raw_points"];
  const total = seconds.reduce((s, t) => s + t, 0);
  const rate = [0, 1, 2].map(j => values.reduce((s, v) => s + v[j], 0) / total);
  const result: HistorySummary = { player_id: playerId, position, n, seconds: total, rate, source_ids: [...sourceIds], start: dates[0], end: dates[n - 1] };
  if (require50) {
    const blocks = Array.from({ length: 10 }, (_, b) => ({ y: [0, 1, 2].map(j => values.slice(5 * b, 5 * b + 5).reduce((s, v) => s + v[j], 0)), t: seconds.slice(5 * b, 5 * b + 5).reduce((s, x) => s + x, 0) }));
    const error = blocks.map(b => b.y.map((y, j) => y - b.t * rate[j]));
    // Ten non-overlapping blocks, one fitted personal rate: nine residual degrees of freedom.
    result.residual_per_second = [0, 1, 2].map(i => [0, 1, 2].map(j => blocks.reduce((s, b, k) => s + error[k][i] * error[k][j] / b.t, 0) / 9));
  }
  return [result, null];
}

export function fitProductionPrior(donors: HistorySummary[], position: string, targetId: number, cutoff: string): [ProductionPrior | null, string | null] {
  const used = donors.filter(d => d.player_id !== targetId && d.position === position);
  if (used.some(d => d.n !== 50 || d.end >= cutoff)) throw new Error("Donor closure not prior-only/full50");
  if (new Set(used.map(d => d.player_id)).size !== used.length) throw new Error("Duplicate donor");
  if (used.length < 2) return [null, "fewer_than_two_qualified_donors"];
  const n = used.length, mu = [0, 1, 2].map(j => used.reduce((s, d) => s + d.rate[j], 0) / n);
  const centered = used.map(d => d.rate.map((v, j) => v - mu[j]));
  const observedCov = [0, 1, 2].map(i => [0, 1, 2].map(j => centered.reduce((s, c) => s + c[i] * c[j], 0) / (n - 1)));
  const omega = [0, 1, 2].map(i => [0, 1, 2].map(j => used.reduce((s, d) => s + d.residual_per_second![i][j], 0) / n));
  const noise = [0, 1, 2].map(i => [0, 1, 2].map(j => used.reduce((s, d) => s + omega[i][j] / d.seconds, 0) / n));
  const base = add(observedCov, noise);
  if (!base.every(r => r.every(finite)) || base.some((r, i) => r[i] <= 0)) return [null, "unestimable_group_rate_scale"];
  const sd = base.map((r, i) => Math.sqrt(r[i]));
  // Constrained nonnegative signal covariance, projected in standardized units.
  const [signalStd, eigenvalues] = asPsd(observedCov.map((row, i) => row.map((v, j) => (v - noise[i][j]) / (sd[i] * sd[j]))));
  const signal = signalStd.map((row, i) => row.map((v, j) => sd[i] * v * sd[j]));
  return [{ position: position as "F" | "D", donors: n, donor_ids: used.map(d => d.player_id), mu, omega, signal, mean_cov: scale(observedCov, 1 / n),
    metric: metricInverse(base), variance_component_eigenvalues: eigenvalues, donor_end_dates: used.map(d => d.end) }, null];
}

export function personalReference(prior: ProductionPrior, personal: HistorySummary | null): ProductionReference {
  let weight: number, rate: number[], cov: Matrix;
  if (personal === null) {
    weight = 0; rate = [...prior.mu]; cov = add(prior.signal, prior.mean_cov);
  } else {
    const exposure = personal.seconds;
    const signal = Math.max(0, trace(matMul(prior.metric, prior.signal)));
    const noise = Math.max(0, trace(matMul(prior.metric, prior.omega))) / exposure;
    if (signal + noise <= 0) throw new Error("Unidentifiable scalar shrinkage; no epsilon");
    weight = signal / (signal + noise);
    rate = personal.rate.map((r, j) => weight * r + (1 - weight) * prior.mu[j]);
    cov = add(scale(add(prior.signal, prior.mean_cov), (1 - weight) ** 2), scale(prior.omega, weight ** 2 / exposure));
  }
  return { rate, covariance: symmetrize(cov), personal_weight: weight, personal_n: personal === null ? 0 : personal.n, personal_seconds: personal === null ? 0 : personal.seconds };
}

export function productionGap(reference: ProductionReference, observed: (number | null)[], seconds: number | null): ProductionAxisRecord {
  const out: ProductionAxisRecord = { version: PRODUCTION_REFERENCE_VERSION, value: null, direction: null, trusted_list_eligible: false,
    raw_observed: [...observed], confidence_probability: null, meaning: "retrospective production at recorded TOI versus a prior rate reference",
    causal_luck: null, forecast: false, finishing_gate: false, weights: [...WEIGHTS], tier: "" };
  if (seconds === null || !Number.isFinite(seconds) || seconds <= 0) return { ...out, tier: "unestimated_current_exposure" };
  if (!validCovariance(reference.covariance) || !validCovariance(reference.omega)) return { ...out, tier: "unestimated_joint_uncertainty" };
  const rates = reference.rate;
  if (!Array.isArray(rates) || rates.length !== 3 || !rates.every(finite)) return { ...out, tier: "unestimated_reference_rates" };
  if (observed.some(x => x !== null && (typeof x !== "number" || !Number.isFinite(x)))) throw new Error("Invalid observed numeric value; only None denotes missing");
  if (observed.length !== 3 || observed.slice(0, 2).some(x => x !== null && x < 0)) throw new Error("Invalid current production");
  const omega = reference.omega as Matrix;
  const expected = rates.map(r => r * seconds);
  const v = add(scale(reference.covariance, seconds ** 2), scale(omega, seconds));
  if (v.some((r, i) => r[i] <= 0)) return { ...out, tier: "unestimated_joint_uncertainty" };
  metricInverse(v); // Reject invalid covariance without a variance floor.
  const missing = observed.flatMap((x, i) => (x === null ? [i] : []));
  const referenceRateSE = reference.covariance.map((r, i) => Math.sqrt(Math.max(r[i], 0)));
  if (missing.length) {
    // A reference estimate is meaningful without a measured current total; a measured gap is not.
    return { ...out, tier: "prior_reference_only_missing_current", missing_indices: missing, expected_totals: expected, reference_rate: [...rates],
      reference_rate_SE: referenceRateSE, joint_gap_covariance: v, personal_weight: reference.personal_weight, personal_n: reference.personal_n, current_seconds: seconds };
  }
  const y = observed as number[], delta = expected.map((e, i) => e - y[i]);
  const sd = v.map((r, i) => Math.sqrt(r[i])), r = v.map((row, i) => row.map((x, j) => x / (sd[i] * sd[j])));
  const denominator = dot(matVec(r, WEIGHTS), WEIGHTS);
  if (denominator <= 0) return { ...out, tier: "unestimated_aggregate_uncertainty" };
  const a = WEIGHTS.map((w, i) => w / sd[i] / Math.sqrt(denominator)), d = dot(a, delta);
  const n = reference.personal_n;
  return { ...out, value: 100 * d / (1 + Math.abs(d)), normalized_gap: d, tier: n === 0 ? "cohort_reference" : n < 50 ? "sparse_personal_shrunk" : "full_personal_shrunk",
    direction: n > 0 ? (d > 0 ? "buy_low_evidence" : d < 0 ? "sell_high_evidence" : "balanced_observed_gap") : null,
    expected_totals: expected, gap_means: delta, missing_indices: [], reference_rate: [...rates], reference_rate_SE: referenceRateSE,
    joint_gap_scale: sd, joint_gap_covariance: v, uncertainty_not_calibrated: true, personal_weight: reference.personal_weight, personal_n: n,
    current_seconds: seconds, role_adjustment: "none; current TOI is observed opportunity, not a coaching-role claim" };
}

export function scoreProduction(prior: ProductionPrior | null, personal: HistorySummary | null, observed: (number | null)[], seconds: number | null): ProductionAxisRecord {
  if (prior === null) return { version: PRODUCTION_REFERENCE_VERSION, value: null, direction: null, tier: "unestimated_position_prior", raw_observed: [...observed], trusted_list_eligible: false };
  const reference = { ...personalReference(prior, personal), omega: prior.omega };
  return { ...productionGap(reference, observed, seconds), cohort_donors: prior.donors, cohort_position: prior.position };
}
