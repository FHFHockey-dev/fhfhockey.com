/**
 * FORGE Full-NHL H1–H10 predictive intervals (TJ, 2026-11-23). Pure arithmetic; storage and scheduling live in
 * h10IntervalStore.server.ts.
 *
 * Reuses the v2 uncertainty work rather than building a new model:
 * - The predictive distribution is the kernel-weighted empirical outcome distribution behind the point forecast.
 *   The weights and row filters are the ones `official-appearance-kernel-means-v1` and `goalie-start-kernel-means-v1`
 *   use for the means (as `predictJoint` does). The point forecast is the mean of exactly this distribution; an
 *   edition whose recomputed mean differs from the stored vintage refuses rather than drifting.
 * - Intervals are per target category, equal-tailed, under the v2 left-continuous CDF convention
 *   (`INTERVAL_CALCULATION`, `quantile`).
 * - Calibration is the v2 finite-sample tail padding (`fitIntervalCalibration`'s rank rule). It is fitted per class ×
 *   category × horizon on a chronological replay of the same recipe at earlier cutoffs. It uses only outcomes received
 *   by the issuing cutoff, is labelled development-only and unreviewed, and only ever widens a band.
 *
 * Every band is conditional: skaters if they appear, goalies if they start. Neither carries the probability of
 * appearing or starting, which is not modelled. Bands are marginal per category, so they must never be summed: a
 * fantasy-points band needs the joint outcome distribution under the league's scoring (`scoreJoint`). Too-thin
 * evidence is an explicit, counted gap, never a guessed band.
 */
import { CATEGORIES, Component, Instant, Interval, ScheduleGame, available, instant, unavailable } from "./contracts";
import { contentHash } from "./hash.server";
import { CandidateModel } from "./model";
import { INTERVAL_CALCULATION, quantile } from "./uncertainty";
import { GOALIE_CATEGORIES, GOALIE_RECIPE, GoalieExample, GoalieRateState, H10GoalieLog, buildGoalieTraining } from "./h10Goalies";
import { H10GameLog, H10RateState, H10_PRIORS, buildH10Model, buildH10Training } from "./h10Features";

export const H10_INTERVAL_SCHEMA = "forge-h10-interval-edition-v1";
export const H10_INTERVAL_METHOD = "forge-h10-kernel-marginal-intervals-v1";
export const H10_CALIBRATION_SCHEMA = "forge-h10-interval-calibration-v1";
export const H10_CALIBRATION_METHOD = "chronological-replay-tail-padding-v1";
export const H10_INTERVAL_LEVELS = [0.5, 0.9] as const;
/** Declared before validation; changing any value is a new method version. */
export const H10_INTERVAL_POLICY = {
  /** Kish effective sample size of the kernel weights below which a band is not defensible. */
  minimumEffectiveSupport: 30,
  /** Replay observations per class × category × horizon needed to fit a padding. */
  calibrationMinimumSupport: 40,
  /** Replay cutoffs: every `stepDays` before the issuing cutoff, at most `cutoffs` of them. */
  calibrationStepDays: 3, calibrationCutoffs: 10,
} as const;
export type IntervalClass = "skater" | "goalie";
export const H10_CONDITIONAL_ON = { skater: "official_appearance", goalie: "official_start" } as const;
const BINARY = new Set(["WIN", "SHUTOUT"]);
export const categoriesOf = (cls: IntervalClass): readonly string[] => cls === "goalie" ? GOALIE_CATEGORIES : CATEGORIES;

/** A kernel model's training, read once into arrays (features, values, clocks) for fast repeated prediction. */
export interface KernelTable {
  cls: IntervalClass; featureNames: readonly string[]; bandwidth: number; minimumSupport: number; categories: readonly string[];
  n: number; features: Float64Array; values: Float64Array; outcomeAt: Float64Array; gameId: Float64Array; eligible: Uint8Array;
}
function table(cls: IntervalClass, recipe: { featureNames: readonly string[]; bandwidth: number; minimumSupport: number },
  rows: ReadonlyArray<{ features: Record<string, Component<number>>; outcomeAvailableAt: string; gameId: number; eligible: boolean; value: (c: string) => number | null }>): KernelTable {
  const names = recipe.featureNames, categories = categoriesOf(cls), k = names.length, c = categories.length, n = rows.length;
  const t: KernelTable = { cls, featureNames: names, bandwidth: recipe.bandwidth, minimumSupport: recipe.minimumSupport, categories, n,
    features: new Float64Array(n * k), values: new Float64Array(n * c), outcomeAt: new Float64Array(n), gameId: new Float64Array(n), eligible: new Uint8Array(n) };
  rows.forEach((row, i) => {
    let ok = row.eligible;
    names.forEach((name, j) => {
      const f = row.features[name];
      const v = f?.state === "available" ? f.value : NaN;
      if (!Number.isFinite(v)) ok = false;
      t.features[i * k + j] = v;
    });
    categories.forEach((cat, j) => { const v = row.value(cat); t.values[i * c + j] = v === null ? NaN : v; });
    t.outcomeAt[i] = instant(row.outcomeAvailableAt); t.gameId[i] = row.gameId; t.eligible[i] = ok ? 1 : 0;
  });
  return t;
}
export function skaterKernelTable(model: CandidateModel): KernelTable {
  return table("skater", model.recipe, model.training.map(row => ({ features: row.features, outcomeAvailableAt: row.outcomeAvailableAt, gameId: row.gameId,
    eligible: row.appearance === "official_appearance", value: (cat: string) => { const m = row.values[cat as keyof typeof row.values]; return m.state === "available" ? m.value : null; } })));
}
export function goalieKernelTable(training: readonly GoalieExample[]): KernelTable {
  return table("goalie", GOALIE_RECIPE, training.map(row => ({ features: row.features, outcomeAvailableAt: row.outcomeAvailableAt, gameId: row.gameId, eligible: true,
    value: (cat: string) => row.values[cat as keyof typeof row.values] })));
}

export interface KernelPrediction {
  means: Record<string, Component<number>>;
  /** Uncalibrated equal-tail bands of the weighted empirical distribution, per category. */
  raw: Record<string, Component<Interval[]>>;
  effectiveSupport: Record<string, number>;
  support: number;
}
/** The kernel mean and the weighted empirical bands for one context, with the means' own row filters. */
export function predictKernel(t: KernelTable, context: { features: Record<string, Component<number>>; gameId: number; cutoff: Instant }): KernelPrediction {
  const k = t.featureNames.length, c = t.categories.length, at = instant(context.cutoff);
  const target = t.featureNames.map(name => { const f = context.features[name]; return f?.state === "available" && Number.isFinite(f.value) ? f.value : NaN; });
  const empty = (reason: string): KernelPrediction => ({ means: Object.fromEntries(t.categories.map(cat => [cat, unavailable(reason)])),
    raw: Object.fromEntries(t.categories.map(cat => [cat, unavailable(reason)])), effectiveSupport: Object.fromEntries(t.categories.map(cat => [cat, 0])), support: 0 });
  if (target.some(v => !Number.isFinite(v))) return empty("missing_context_feature");
  const weights = new Float64Array(t.n);
  let support = 0;
  for (let i = 0; i < t.n; i++) {
    if (!t.eligible[i] || t.outcomeAt[i] >= at || t.gameId[i] === context.gameId) continue;
    let d = 0;
    for (let j = 0; j < k; j++) { const z = (t.features[i * k + j] - target[j]) / t.bandwidth; d += z * z; }
    const w = Math.exp(-d / 2);
    if (w > 0) { weights[i] = w; support += 1; }
  }
  const means: Record<string, Component<number>> = {}, raw: Record<string, Component<Interval[]>> = {}, effectiveSupport: Record<string, number> = {};
  for (let j = 0; j < c; j++) {
    const cat = t.categories[j], mass = new Map<number, number>();
    let used = 0, sw = 0, sww = 0, swv = 0;
    for (let i = 0; i < t.n; i++) {
      const w = weights[i], v = t.values[i * c + j];
      if (!(w > 0) || Number.isNaN(v)) continue;
      used += 1; sw += w; sww += w * w; swv += w * v; mass.set(v, (mass.get(v) ?? 0) + w);
    }
    effectiveSupport[cat] = sw > 0 ? sw * sw / sww : 0;
    const minimum = t.cls === "goalie" ? support : used;
    if (minimum < t.minimumSupport || used === 0) {
      const reason = t.cls === "goalie" ? "sparse_goalie_start_history" : "sparse_category_history";
      means[cat] = unavailable(reason); raw[cat] = unavailable(reason); continue;
    }
    means[cat] = available(swv / sw);
    if (effectiveSupport[cat] < H10_INTERVAL_POLICY.minimumEffectiveSupport) { raw[cat] = unavailable("effective_support_too_thin"); continue; }
    const rows = [...mass].map(([value, w]) => ({ value, probability: w / sw }));
    raw[cat] = available(H10_INTERVAL_LEVELS.map(level => ({ level, lower: quantile(rows, (1 - level) / 2), upper: quantile(rows, (1 + level) / 2) })));
  }
  // The means' structural pins (model.ts, h10Goalies.ts); the bands come from the same rows' own values.
  if (t.cls === "skater" && means.PPP.state === "available") {
    means.PPP = means.G.state === "available" && means.A.state === "available" ? available(Math.min(means.PPP.value, means.G.value + means.A.value)) : unavailable("missing_points_constraint_inputs");
  }
  if (t.cls === "goalie" && means.SAVES.state === "available" && means.SHOTS_AGAINST.state === "available") {
    means.GOALS_ALLOWED = available(Math.max(0, means.SHOTS_AGAINST.value - means.SAVES.value));
  }
  return { means, raw, effectiveSupport, support };
}

/** Bands are ordered, nested (50% inside 90%), finite and inside the target's support. */
export function intervalsValid(intervals: readonly Interval[], category: string): boolean {
  if (intervals.length !== 2 || intervals[0].level !== 0.5 || intervals[1].level !== 0.9) return false;
  const [half, ninety] = intervals, top = BINARY.has(category) ? 1 : Infinity;
  return intervals.every(i => Number.isFinite(i.lower) && Number.isFinite(i.upper) && i.lower <= i.upper && i.lower >= 0 && i.upper <= top)
    && ninety.lower <= half.lower && ninety.upper >= half.upper;
}

export interface IntervalObservation {
  cls: IntervalClass; category: string; horizon: number; cutoff: Instant; outcomeAvailableAt: Instant;
  playerId: number; gameId: number; actual: number; mean: number; raw: Interval[]; sparseHistory: boolean;
}
export interface IntervalCalibration {
  schemaVersion: typeof H10_CALIBRATION_SCHEMA; method: typeof H10_CALIBRATION_METHOD; calculationVersion: typeof INTERVAL_CALCULATION;
  policy: typeof H10_INTERVAL_POLICY; evidence: "development_only_unreviewed";
  fittedAt: Instant; availableAt: Instant; dependencyAvailableAt: Instant | null; cutoffs: Instant[]; observations: number; sampleSha256: string;
  /** `${class}:${category}:H${horizon}` → replay support and the padding per level (absent when too thin). */
  cells: Record<string, { n: number; padding: Array<{ level: 0.5 | 0.9; lower: number; upper: number }> | null }>;
  /** Monitoring only (never switches a method): goalie replay scores per cell and level, in-sample for the candidate. */
  goalieMonitor: Record<string, { level: 0.5 | 0.9; n: number; starts: number; candidateScore: number | null; baselineScore: number }[]>;
  version: string;
}
export const cellKey = (cls: IntervalClass, category: string, horizon: number) => `${cls}:${category}:H${horizon}`;

/** Fit the padding from replay observations whose outcome was received by `asOf` (the issuing cutoff). */
export function fitH10IntervalCalibration(observations: readonly IntervalObservation[], asOf: Instant, cutoffs: readonly Instant[]): IntervalCalibration {
  const at = instant(asOf);
  const rows = observations.filter(o => instant(o.outcomeAvailableAt) <= at && instant(o.cutoff) < at).sort((a, b) =>
    a.cls.localeCompare(b.cls) || a.category.localeCompare(b.category) || a.horizon - b.horizon || instant(a.cutoff) - instant(b.cutoff) || a.playerId - b.playerId || a.gameId - b.gameId);
  const groups = new Map<string, IntervalObservation[]>();
  for (const o of rows) { const key = cellKey(o.cls, o.category, o.horizon), group = groups.get(key); if (group) group.push(o); else groups.set(key, [o]); }
  const cells: IntervalCalibration["cells"] = {};
  for (const cls of ["skater", "goalie"] as const) for (const category of categoriesOf(cls)) for (let horizon = 1; horizon <= 10; horizon++) {
    const key = cellKey(cls, category, horizon), group = groups.get(key) ?? [];
    if (group.length < H10_INTERVAL_POLICY.calibrationMinimumSupport) { cells[key] = { n: group.length, padding: null }; continue; }
    // v2 rank rule (fitIntervalCalibration): pad each tail by the finite-sample (1+L)/2 quantile of its shortfall.
    const padding = H10_INTERVAL_LEVELS.map(level => {
      const rank = Math.ceil((group.length + 1) * (1 + level) / 2);
      if (rank > group.length) return null;
      const band = (o: IntervalObservation) => o.raw.find(i => i.level === level)!;
      const lower = group.map(o => Math.max(0, band(o).lower - o.actual)).sort((a, b) => a - b)[rank - 1];
      const upper = group.map(o => Math.max(0, o.actual - band(o).upper)).sort((a, b) => a - b)[rank - 1];
      return { level, lower, upper };
    });
    cells[key] = { n: group.length, padding: padding.some(p => p === null) ? null : padding as Array<{ level: 0.5 | 0.9; lower: number; upper: number }> };
  }
  const goalieMonitor: IntervalCalibration["goalieMonitor"] = {};
  for (const [key, group] of groups) {
    if (!key.startsWith("goalie:")) continue;
    const cell = cells[key];
    goalieMonitor[key] = H10_INTERVAL_LEVELS.map(level => {
      let candidate = 0, baseline = 0, scored = 0;
      for (const o of group) {
        const base = baselineBands(o.category, o.mean);
        if (base.state === "available") baseline += intervalScore(base.value.find(b => b.level === level)!, o.actual);
        if (cell?.padding) {
          const p = cell.padding.find(x => x.level === level)!, r = o.raw.find(b => b.level === level)!;
          candidate += intervalScore({ level, lower: Math.max(0, r.lower - p.lower), upper: Math.min(BINARY.has(o.category) ? 1 : Infinity, r.upper + p.upper) }, o.actual); scored += 1;
        }
      }
      return { level, n: group.length, starts: new Set(group.map(o => `${o.playerId}:${o.gameId}`)).size,
        candidateScore: scored ? Number((candidate / scored).toFixed(6)) : null, baselineScore: Number((baseline / group.length).toFixed(6)) };
    });
  }
  const body: Omit<IntervalCalibration, "version"> = { schemaVersion: H10_CALIBRATION_SCHEMA, method: H10_CALIBRATION_METHOD, calculationVersion: INTERVAL_CALCULATION, policy: H10_INTERVAL_POLICY,
    evidence: "development_only_unreviewed" as const, fittedAt: asOf, availableAt: asOf,
    dependencyAvailableAt: rows.length ? new Date(rows.reduce((max, o) => Math.max(max, instant(o.outcomeAvailableAt)), -Infinity)).toISOString() : null,
    cutoffs: [...cutoffs], observations: rows.length, sampleSha256: contentHash(rows.map(o => [o.cls, o.category, o.horizon, o.cutoff, o.playerId, o.gameId, o.actual, o.raw])), cells, goalieMonitor };
  return { ...body, version: contentHash(body) };
}

/** Widen a raw band by its cell's padding, clamp to the target's support, and refuse a band that is not nested. */
export function calibrate(raw: Component<Interval[]>, calibration: IntervalCalibration | null, cls: IntervalClass, category: string, horizon: number): Component<Interval[]> {
  if (raw.state !== "available") return raw;
  if (!calibration) return unavailable("calibration_unavailable");
  const cell = calibration.cells[cellKey(cls, category, horizon)];
  if (!cell?.padding) return unavailable("calibration_support_too_thin");
  const top = BINARY.has(category) ? 1 : Infinity;
  const out = raw.value.map(i => { const p = cell.padding!.find(x => x.level === i.level)!; return { level: i.level, lower: Math.max(0, i.lower - p.lower), upper: Math.min(top, i.upper + p.upper) }; });
  return intervalsValid(out, category) ? available(out) : unavailable("non_nested_calibrated_intervals");
}

export type BandMethod = "kernel_calibrated" | "poisson_baseline" | "bernoulli_baseline";
/** The labelled simple baseline: equal-tail left-CDF quantiles of a Poisson (counts) or Bernoulli (WIN, SHUTOUT) with
 * the stored point forecast as its mean. */
export function baselineBands(category: string, mean: number): Component<Interval[]> {
  if (!Number.isFinite(mean) || mean < 0 || BINARY.has(category) && mean > 1) return unavailable("baseline_mean_invalid");
  const q = (p: number) => {
    if (BINARY.has(category)) return p <= 1 - mean ? 0 : 1;
    let k = 0, term = Math.exp(-mean), cdf = term;
    while (cdf + 1e-12 < p && k < 10000) { k += 1; term *= mean / k; cdf += term; }
    return k;
  };
  const bands = H10_INTERVAL_LEVELS.map(level => ({ level, lower: q((1 - level) / 2), upper: q((1 + level) / 2) }));
  return intervalsValid(bands, category) ? available(bands) : unavailable("baseline_band_invalid");
}
export const baselineMethod = (category: string): BandMethod => BINARY.has(category) ? "bernoulli_baseline" : "poisson_baseline";
/** Winkler interval score of one band for one outcome (lower is better). */
export const intervalScore = (band: Interval, actual: number) =>
  band.upper - band.lower + (2 / (1 - band.level)) * (Math.max(0, band.lower - actual) + Math.max(0, actual - band.upper));

/** Goalie band policy (TJ, 2026-11-24, by pop-up). Goalie 50% at H1–H10 and goalie 90% at H8–H10 use the labelled
 * baseline. Goalie 90% at H1–H7 uses the calibrated kernel band only in cells the predeclared reliability rule
 * selected, and only when that band contains the 50% band; otherwise the baseline for both levels. Skaters use the
 * calibrated kernel band at both levels. The cell list is fixed per policy version: a new cutoff is monitored (the
 * nightly calibration record carries the replay scores) but never switches a method, and past editions are never
 * rewritten. The rule was written down before any scoring (see INTERVALS.md). */
export const GOALIE_BAND_POLICY = {
  version: "forge-h10-goalie-band-policy-v1",
  rule: {
    candidateCells: "goalie 90% at H1-H7, per category x horizon",
    minimumDistinctStarts: 150,
    criterion: "one-sided 95% bootstrap upper bound (95th percentile of resampled means) of the mean paired interval-score difference, candidate minus baseline, per distinct start, below 0",
    bootstrap: { resamples: 2000, seed: 20261124, unit: "distinct goalie start (player, game)" },
    selectionWindow: { first: "2026-10-24T09:00:00.000Z", last: "2026-11-20T09:00:00.000Z", stepDays: 3, outcomesReceivedBy: "2026-11-21T09:00:00.000Z" },
    holdout: { cutoffs: ["2026-11-21T09:00:00.000Z", "2026-11-22T09:00:00.000Z", "2026-11-23T09:00:00.000Z"], note: "outcomes after the selection data; daily cutoffs" },
  },
  /** Cells selected by the rule on the selection window (scripts/forge-h10-interval-validation.ts --select). */
  candidate90: ["SAVES:H2", "SAVES:H4"] as readonly string[],
} as const;

/** The bands an edition issues for one category, with the method behind each band. */
export function chooseBands(cls: IntervalClass, category: string, horizon: number, candidate: Component<Interval[]>, point: Component<number>,
  policy: { candidate90: readonly string[] } = GOALIE_BAND_POLICY): { intervals: Component<Interval[]>; methods: Partial<Record<"0.5" | "0.9", BandMethod>> } {
  if (cls === "skater") return candidate.state === "available" ? { intervals: candidate, methods: { "0.5": "kernel_calibrated", "0.9": "kernel_calibrated" } } : { intervals: candidate, methods: {} };
  if (point.state !== "available") return { intervals: unavailable(`no_valid_band:point_${point.reason}`), methods: {} };
  const base = baselineBands(category, point.value), method = baselineMethod(category);
  if (base.state !== "available") return { intervals: unavailable(`no_valid_band:${base.reason}`), methods: {} };
  const [half, ninety] = base.value;
  if (horizon <= 7 && policy.candidate90.includes(`${category}:H${horizon}`) && candidate.state === "available") {
    const c90 = candidate.value.find(b => b.level === 0.9)!;
    if (intervalsValid([half, c90], category)) return { intervals: available([half, c90]), methods: { "0.5": method, "0.9": "kernel_calibrated" } };
  }
  return { intervals: available([half, ninety]), methods: { "0.5": method, "0.9": method } };
}

/** Replay cutoffs before the issuing cutoff: every `stepDays`, at most `cutoffs` of them. */
export function calibrationCutoffs(asOf: Instant): Instant[] {
  const step = H10_INTERVAL_POLICY.calibrationStepDays * 86400000;
  return Array.from({ length: H10_INTERVAL_POLICY.calibrationCutoffs }, (_, i) => new Date(instant(asOf) - (i + 1) * step).toISOString()).reverse();
}

/** Each team's next ten regular-season games after `cutoff`: gameId → (team → horizon). */
export function horizonsAfter(schedule: readonly ScheduleGame[], cutoff: Instant): Map<number, Map<number, number>> {
  const at = instant(cutoff), byTeam = new Map<number, ScheduleGame[]>();
  for (const g of schedule) {
    if (g.gameType !== "regular" || !g.scheduledStartAt || instant(g.scheduledStartAt) <= at) continue;
    for (const team of [g.homeTeamId, g.awayTeamId]) { const games = byTeam.get(team); if (games) games.push(g); else byTeam.set(team, [g]); }
  }
  const out = new Map<number, Map<number, number>>();
  for (const [team, games] of byTeam) {
    games.sort((a, b) => instant(a.scheduledStartAt!) - instant(b.scheduledStartAt!) || a.gameId - b.gameId).slice(0, 10).forEach((g, i) => {
      const m = out.get(g.gameId) ?? new Map<number, number>(); m.set(team, i + 1); out.set(g.gameId, m);
    });
  }
  return out;
}

/** The recipe replayed at one earlier cutoff: models and rate state from rows received by the cutoff, scored on
 * realized appearances (skaters) and starts (goalies) received by `until`. Conditional by construction. */
export function replayAtCutoff(input: { logs: readonly H10GameLog[]; goalieLogs: readonly H10GoalieLog[]; schedule: readonly ScheduleGame[]; seasonId: number;
  cutoff: Instant; until: Instant; maximumTrainingExamples: number;
  /** Realized outcomes that got no raw band (thin effective support, sparse history): counted, never scored. */
  onRefusal?: (cls: IntervalClass, category: string, horizon: number, reason: string) => void }): IntervalObservation[] {
  const { cutoff, seasonId } = input, at = instant(cutoff), until = instant(input.until), horizons = horizonsAfter(input.schedule, cutoff), out: IntervalObservation[] = [];
  const model = buildH10Model(buildH10Training(input.logs, seasonId, cutoff, input.maximumTrainingExamples).training, cutoff);
  if (model) {
    const t = skaterKernelTable(model), state = H10RateState.from(input.logs, seasonId, cutoff);
    for (const row of input.logs) {
      const horizon = horizons.get(row.gameId)?.get(row.teamId);
      if (!horizon || row.seasonId !== seasonId || instant(row.gameStartAt) <= at || instant(row.source.firstReceivedAt) > until) continue;
      const p = predictKernel(t, { features: state.features(row.playerId, row.opponentId, row.home), gameId: row.gameId, cutoff });
      const sparse = (state.players.get(row.playerId)?.games ?? 0) < H10_PRIORS.shrinkGames;
      for (const category of CATEGORIES) {
        const actual = row.values[category], raw = p.raw[category], mean = p.means[category];
        if (actual === null) continue;
        if (raw.state !== "available" || mean.state !== "available") { input.onRefusal?.("skater", category, horizon, raw.state === "available" ? "mean_unavailable" : raw.reason); continue; }
        out.push({ cls: "skater", category, horizon, cutoff, outcomeAvailableAt: row.source.firstReceivedAt, playerId: row.playerId, gameId: row.gameId, actual, mean: mean.value, raw: raw.value, sparseHistory: sparse });
      }
    }
  }
  const goalieTraining = buildGoalieTraining(input.logs, input.goalieLogs, seasonId, cutoff, input.maximumTrainingExamples).training;
  if (goalieTraining.length >= GOALIE_RECIPE.minimumSupport) {
    const t = goalieKernelTable(goalieTraining), state = GoalieRateState.from(input.logs, input.goalieLogs, seasonId, cutoff);
    for (const row of input.goalieLogs) {
      const horizon = horizons.get(row.gameId)?.get(row.teamId);
      if (!horizon || !row.started || row.seasonId !== seasonId || instant(row.gameStartAt) <= at || instant(row.source.firstReceivedAt) > until) continue;
      const p = predictKernel(t, { features: state.features(row.playerId, row.teamId, row.opponentId, row.home), gameId: row.gameId, cutoff });
      const sparse = (state.goalies.get(row.playerId)?.starts ?? 0) < 8;
      for (const category of GOALIE_CATEGORIES) {
        const actual = row.values[category], raw = p.raw[category], mean = p.means[category];
        if (actual === null) continue;
        if (raw.state !== "available" || mean.state !== "available") { input.onRefusal?.("goalie", category, horizon, raw.state === "available" ? "mean_unavailable" : raw.reason); continue; }
        out.push({ cls: "goalie", category, horizon, cutoff, outcomeAvailableAt: row.source.firstReceivedAt, playerId: row.playerId, gameId: row.gameId, actual, mean: mean.value, raw: raw.value, sparseHistory: sparse });
      }
    }
  }
  return out;
}

/** The calibration available at an issuing cutoff: replay the recipe at its earlier cutoffs, fit on what had arrived. */
export function calibrationAt(input: { logs: readonly H10GameLog[]; goalieLogs: readonly H10GoalieLog[]; schedule: readonly ScheduleGame[]; seasonId: number;
  asOf: Instant; maximumTrainingExamples: number }): IntervalCalibration {
  const cutoffs = calibrationCutoffs(input.asOf);
  const observations = cutoffs.flatMap(cutoff => replayAtCutoff({ ...input, cutoff, until: input.asOf }));
  return fitH10IntervalCalibration(observations, input.asOf, cutoffs);
}

export interface IntervalEdition {
  schemaVersion: typeof H10_INTERVAL_SCHEMA; id: string; vintageId: string; vintageOutputHash: string;
  playerClass: IntervalClass; playerId: number; gameId: number; teamId: number; horizon: number; targetVersion: string; conditioning: string;
  /** The bands are conditional on this event; its probability is not part of the edition. */
  conditionalOn: (typeof H10_CONDITIONAL_ON)[IntervalClass];
  combination: "marginal_per_category_not_summable";
  inputCutoffAt: Instant; generatedAt: Instant; modelVersion: string; featureVersion: string;
  method: { id: typeof H10_INTERVAL_METHOD; calculationVersion: typeof INTERVAL_CALCULATION; policy: typeof H10_INTERVAL_POLICY };
  calibration: { id: string; version: string; availableAt: Instant; evidence: "development_only_unreviewed" } | null;
  support: number;
  /** Which method issued each band, per category and level; the candidate bands are kept for monitoring. */
  bandPolicy: typeof GOALIE_BAND_POLICY.version;
  categories: Record<string, { point: Component<number>; intervals: Component<Interval[]>; methods: Partial<Record<"0.5" | "0.9", BandMethod>>;
    candidateIntervals: Component<Interval[]>; rawIntervals: Component<Interval[]>; effectiveSupport: number }>;
  limitations: string[];
}
export interface IssuedVintage {
  id: string; outputHash: string; playerId: number; gameId: number; teamId: number; horizon: number; targetVersion: string; conditioning: string;
  inputCutoffAt: Instant; modelVersion: string; featureVersion: string; means: Record<string, Component<number>>;
}

/** One vintage's interval edition. The recomputed mean must reproduce the stored point forecast, or every band refuses. */
export function buildIntervalEdition(input: { cls: IntervalClass; vintage: IssuedVintage; prediction: KernelPrediction | null; modelVersion: string | null;
  calibration: { id: string; value: IntervalCalibration } | null; generatedAt: Instant }): IntervalEdition {
  const { cls, vintage: v, prediction } = input, categories: IntervalEdition["categories"] = {};
  const modelMismatch = input.modelVersion !== v.modelVersion;
  const calibrationLate = input.calibration && instant(input.calibration.value.availableAt) > instant(v.inputCutoffAt);
  for (const category of categoriesOf(cls)) {
    const point = v.means[category] ?? unavailable("point_forecast_missing");
    let raw: Component<Interval[]>;
    if (!prediction) raw = unavailable("model_unavailable_at_cutoff");
    else if (modelMismatch) raw = unavailable("model_version_mismatch");
    else if (point.state !== "available") raw = unavailable(`point_forecast_unavailable:${point.reason}`);
    else {
      const mean = prediction.means[category];
      raw = mean.state !== "available" || Math.abs(mean.value - point.value) > 1e-9 ? unavailable("point_forecast_mismatch") : prediction.raw[category];
    }
    const candidate = calibrationLate ? unavailable("calibration_not_available_at_cutoff") : calibrate(raw, input.calibration?.value ?? null, cls, category, v.horizon);
    const chosen = chooseBands(cls, category, v.horizon, candidate, point);
    categories[category] = { point, intervals: chosen.intervals, methods: chosen.methods, candidateIntervals: candidate, rawIntervals: raw,
      effectiveSupport: Number((prediction?.effectiveSupport[category] ?? 0).toFixed(6)) };
  }
  return {
    schemaVersion: H10_INTERVAL_SCHEMA, id: `h10-interval:${v.id}`, vintageId: v.id, vintageOutputHash: v.outputHash,
    playerClass: cls, playerId: v.playerId, gameId: v.gameId, teamId: v.teamId, horizon: v.horizon, targetVersion: v.targetVersion, conditioning: v.conditioning,
    conditionalOn: H10_CONDITIONAL_ON[cls], combination: "marginal_per_category_not_summable",
    inputCutoffAt: v.inputCutoffAt, generatedAt: input.generatedAt, modelVersion: v.modelVersion, featureVersion: v.featureVersion,
    method: { id: H10_INTERVAL_METHOD, calculationVersion: INTERVAL_CALCULATION, policy: H10_INTERVAL_POLICY },
    calibration: input.calibration ? { id: input.calibration.id, version: input.calibration.value.version, availableAt: input.calibration.value.availableAt, evidence: "development_only_unreviewed" } : null,
    support: prediction?.support ?? 0, bandPolicy: GOALIE_BAND_POLICY.version, categories,
    limitations: ["conditional_on_" + H10_CONDITIONAL_ON[cls], cls === "goalie" ? "start_probability_not_modelled" : "participation_not_modelled",
      "marginal_bands_not_summable_use_joint_scoring", "calibration_development_only_unreviewed", "predeclared_recipe_unreviewed",
      ...(cls === "goalie" ? ["goalie_bands_follow_policy_baseline_where_candidate_not_reliable"] : [])],
  };
}

/** An edition's open coverage gaps: categories without a calibrated band, by reason. */
export const editionGaps = (edition: IntervalEdition) => Object.entries(edition.categories).filter(([, c]) => c.intervals.state !== "available")
  .map(([category, c]) => ({ category, reason: (c.intervals as { reason: string }).reason }));
