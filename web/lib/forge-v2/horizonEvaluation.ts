import { CATEGORIES, SourceReference, assertId, assertSource, instant } from "./contracts";
import { contentHash } from "./hash.server";

/** Offline research contract. H is cumulative here, unlike the serving contract's game ordinal. */
export const HORIZON_EVALUATION_VERSION = "forge-frozen-calendar-evaluation-v1";
export type CumulativeHorizon = 1 | 10 | 20;
const SKATER_KEYS = [...CATEGORIES, "PPG", "PPA", "GP"] as const;
const GOALIE_KEYS = ["SV", "SA", "GA", "W", "SO", "MIN", "GP", "GS", "RELIEF"] as const;
export type OutcomeCounts = Record<string, number | null>;
export interface CalendarGame {
  gameId: number; teamId: number; startsAt: string;
  /** Official individual counts only: exclude shootout and empty-net team bookkeeping. */
  counts: OutcomeCounts;
  sharedShutout?: boolean;
}
export interface FrozenWindow {
  horizon: CumulativeHorizon;
  /** Origin-team anchors frozen at issuance; fewer than H is an incomplete window. */
  originGameIds: number[];
  /** Explicit inclusive calendar boundary, never silently moved after a postponement. */
  endAt: string;
}
export interface FrozenHorizonForecast {
  schemaVersion: typeof HORIZON_EVALUATION_VERSION;
  evidenceClass: "fixture" | "retrospective_reconstruction" | "prospective_shadow";
  playerId: number; originTeamId: number; seasonId: number; kind: "skater" | "goalie";
  issuedAt: string; inputCutoffAt: string; modelAvailableAt: string;
  versions: { model: string; feature: string; calibration: string; schedule: string; categories: string };
  sourceManifest: SourceReference[];
  /** Every fitted dependency must declare its latest training-label window and availability. */
  trainingWindows: Array<{ endAt: string; availableAt: string }>;
  windows: FrozenWindow[];
  /** One weight per entire trajectory preserves supplied injury/role/talent persistence. */
  samples: Array<{ probability: number; eligibleGameIds: number[]; games: CalendarGame[] }>;
}
export interface FrozenForecast { forecast: FrozenHorizonForecast; sha256: string }
export interface HorizonLabel {
  playerId: number; horizon: CumulativeHorizon; endAt: string;
  coverageComplete: boolean; eligibleGameIds: number[];
  /** Completeness receipt must be available only after the full calendar window closes. */
  coverageAvailableAt: string;
  sourceManifest: SourceReference[];
  anchors: Array<{ gameId: number; startsAt: string; finalAt: string }>;
  games: Array<CalendarGame & { finalAt: string; availableAt: string }>;
}

const keys = (kind: FrozenHorizonForecast["kind"]): readonly string[] => kind === "skater" ? SKATER_KEYS : GOALIE_KEYS;
function sameIds(a: readonly number[], b: readonly number[]): boolean {
  const left = [...a].sort((x, y) => x - y), right = [...b].sort((x, y) => x - y);
  return left.length === right.length && left.every((id, i) => id === right[i]);
}
function uniqueIds(ids: number[]): void {
  ids.forEach(assertId);
  if (new Set(ids).size !== ids.length) throw new Error("Duplicate game identity");
}

/** Independent validation for labels AND final samples; never repairs or rounds observations. */
export function validateCalendarGame(game: CalendarGame, kind: FrozenHorizonForecast["kind"]): void {
  assertId(game.gameId); assertId(game.teamId); instant(game.startsAt);
  const c = game.counts, expected = keys(kind);
  if (!c || Object.keys(c).length !== expected.length || expected.some(key => !Object.hasOwn(c, key))) throw new Error("Missing count fields: use explicit null");
  for (const key of expected) {
    const value = c[key];
    if (value !== null && (!Number.isFinite(value) || value < 0 || (key !== "MIN" && !Number.isSafeInteger(value)))) throw new Error("Invalid observed/sample count");
  }
  if (c.GP !== null && c.GP !== 0 && c.GP !== 1) throw new Error("Invalid game participation");
  if (c.GP === 0 && expected.some(key => c[key] !== null && c[key] !== 0)) throw new Error("Nonappearance has production");
  if (kind === "skater") {
    if (c.PPP !== null && c.G !== null && c.A !== null && c.PPP > c.G + c.A) throw new Error("PPP exceeds G+A");
    if (c.PPP !== null && c.PPG !== null && c.PPA !== null && c.PPP !== c.PPG + c.PPA) throw new Error("PPP differs from PPG+PPA");
    if (c.PPG !== null && c.G !== null && c.PPG > c.G || c.PPA !== null && c.A !== null && c.PPA > c.A) throw new Error("PP production exceeds total");
  } else {
    if (typeof game.sharedShutout !== "boolean") throw new Error("Missing shared-shutout status");
    for (const key of ["GS", "RELIEF", "W", "SO"]) if (c[key] !== null && c[key]! > 1) throw new Error("Invalid per-game goalie event");
    if (c.SA !== null && c.SV !== null && c.GA !== null && c.SA !== c.SV + c.GA) throw new Error("SA differs from saves+GA");
    if (c.GP !== null && c.GS !== null && c.RELIEF !== null && c.GP !== c.GS + c.RELIEF) throw new Error("Appearance differs from starts+relief");
    if (c.SO === 1 && (game.sharedShutout || c.GA !== 0)) throw new Error("Invalid individual shutout");
    // Relief wins and no-decision starts are legal. There is deliberately no W <= GS rule.
  }
}

function validateGames(games: CalendarGame[], eligibleIds: number[], kind: FrozenHorizonForecast["kind"]): void {
  uniqueIds(eligibleIds); uniqueIds(games.map(game => game.gameId));
  if (!sameIds(eligibleIds, games.map(game => game.gameId))) throw new Error("Eligible population coverage mismatch");
  games.forEach(game => validateCalendarGame(game, kind));
}

export function trainingWindowMature(window: { endAt: string; availableAt: string }, origin: string): boolean {
  return instant(window.endAt) < instant(window.availableAt) && instant(window.availableAt) < instant(origin);
}

export function validateFrozenForecast(frozen: FrozenForecast): void {
  const f = frozen.forecast;
  if (f.schemaVersion !== HORIZON_EVALUATION_VERSION || contentHash(f) !== frozen.sha256) throw new Error("Frozen forecast version/hash mismatch");
  [f.playerId, f.originTeamId, f.seasonId].forEach(assertId);
  if (!["skater", "goalie"].includes(f.kind) || !["fixture", "retrospective_reconstruction", "prospective_shadow"].includes(f.evidenceClass)) throw new Error("Invalid evaluation population");
  const cutoff = instant(f.inputCutoffAt), issued = instant(f.issuedAt);
  if (cutoff > issued || instant(f.modelAvailableAt) > cutoff) throw new Error("Future model/cutoff");
  if (!f.sourceManifest.length) throw new Error("Missing source provenance");
  f.sourceManifest.forEach(source => assertSource(source, f.inputCutoffAt));
  for (const key of ["model", "feature", "calibration", "schedule", "categories"] as const) if (!f.versions[key]?.trim()) throw new Error("Missing forecast version");
  if (f.trainingWindows.some(window => !trainingWindowMature(window, f.modelAvailableAt))) throw new Error("Immature training label or overlapping window");
  if (!f.windows.length || f.windows.length > 3 || new Set(f.windows.map(w => w.horizon)).size !== f.windows.length) throw new Error("Invalid evaluation horizons");
  let previous: FrozenWindow | undefined;
  for (const window of [...f.windows].sort((a, b) => a.horizon - b.horizon)) {
    uniqueIds(window.originGameIds);
    if (![1, 10, 20].includes(window.horizon) || window.originGameIds.length > window.horizon || instant(window.endAt) <= issued) throw new Error("Invalid frozen window");
    if (previous && (instant(window.endAt) < instant(previous.endAt) || previous.originGameIds.some((id, i) => id !== window.originGameIds[i]))) throw new Error("Non-nested frozen windows");
    previous = window;
  }
  if (!f.samples.length || f.samples.length > 10000) throw new Error("Unbounded or missing trajectory samples");
  let mass = 0;
  for (const sample of f.samples) {
    if (!Number.isFinite(sample.probability) || sample.probability <= 0 || sample.probability > 1) throw new Error("Invalid trajectory mass");
    mass += sample.probability;
    validateGames(sample.games, sample.eligibleGameIds, f.kind);
    if (sample.games.some(game => instant(game.startsAt) <= issued)) throw new Error("Forecast contains already-started game");
  }
  if (Math.abs(mass - 1) > 1e-10) throw new Error("Trajectory mass must sum to one");
}

/** Includes all declared player contributions in the frozen calendar, even >H games after a trade. */
function totals(games: CalendarGame[], kind: FrozenHorizonForecast["kind"], start: string, end: string): OutcomeCounts {
  const included = games.filter(game => instant(game.startsAt) > instant(start) && instant(game.startsAt) <= instant(end));
  const sums = Object.fromEntries(keys(kind).map(key => [key, included.some(game => game.counts[key] === null)
    ? null : included.reduce((sum, game) => sum + game.counts[key]!, 0)])) as OutcomeCounts;
  if (kind === "goalie") {
    sums.SV_PCT = sums.SA !== null && sums.SA > 0 && sums.SV !== null ? sums.SV / sums.SA : null;
    sums.GAA = sums.MIN !== null && sums.MIN > 0 && sums.GA !== null ? 60 * sums.GA / sums.MIN : null;
  }
  return sums;
}

export function participationMixtureMoments(p: number, conditionalMean: number, conditionalVariance: number) {
  if (![p, conditionalMean, conditionalVariance].every(Number.isFinite) || p < 0 || p > 1 || conditionalMean < 0 || conditionalVariance < 0) throw new Error("Invalid participation moments");
  return { mean: p * conditionalMean, variance: p * conditionalVariance + p * (1 - p) * conditionalMean ** 2 };
}

type WeightedValue = { probability: number; value: number };
function quantile(rows: WeightedValue[], q: number): number {
  let mass = 0;
  for (const row of rows) { mass += row.probability; if (mass + 1e-12 >= q) return row.value; }
  return rows[rows.length - 1].value;
}
/** CRPS of the FINAL empirical distribution, including all structural zero mass. */
export function scoreDistribution(values: WeightedValue[], actual: number, count: boolean) {
  if (!values.length || !Number.isFinite(actual) || actual < 0 || count && !Number.isSafeInteger(actual)
    || values.some(row => !Number.isFinite(row.value) || row.value < 0 || count && !Number.isSafeInteger(row.value)
      || !Number.isFinite(row.probability) || row.probability <= 0 || row.probability > 1)
    || Math.abs(values.reduce((sum, row) => sum + row.probability, 0) - 1) > 1e-10) throw new Error("Invalid scoring distribution/actual");
  const rows = [...values].sort((a, b) => a.value - b.value);
  const mean = rows.reduce((sum, row) => sum + row.probability * row.value, 0);
  let cumulativeMass = 0, cumulativeValue = 0, halfPairDistance = 0;
  for (const row of rows) {
    halfPairDistance += row.probability * (row.value * cumulativeMass - cumulativeValue);
    cumulativeMass += row.probability; cumulativeValue += row.probability * row.value;
  }
  const actualMass = rows.filter(row => row.value === actual).reduce((sum, row) => sum + row.probability, 0);
  return { mean, variance: rows.reduce((sum, row) => sum + row.probability * (row.value - mean) ** 2, 0),
    absoluteError: Math.abs(mean - actual), squaredError: (mean - actual) ** 2,
    crps: Math.max(0, rows.reduce((sum, row) => sum + row.probability * Math.abs(row.value - actual), 0) - halfPairDistance),
    logScore: count && actualMass > 0 ? -Math.log(actualMass) : null,
    logScoreState: !count ? "not_applicable" : actualMass > 0 ? "finite" : "infinite",
    intervals: [0.5, 0.8, 0.95].map(level => {
      const lower = quantile(rows, (1 - level) / 2), upper = quantile(rows, (1 + level) / 2);
      return { level, lower, upper, covered: actual >= lower && actual <= upper, width: upper - lower,
        score: upper - lower + 2 / (1 - level) * (Math.max(0, lower - actual) + Math.max(0, actual - upper)) };
    }) };
}

/** Identity for paired comparisons; cache identity additionally binds every version and distribution byte. */
export function horizonComparisonKey(f: FrozenHorizonForecast): string {
  return contentHash({ schemaVersion: f.schemaVersion, playerId: f.playerId, originTeamId: f.originTeamId, seasonId: f.seasonId,
    kind: f.kind, evidenceClass: f.evidenceClass, issuedAt: f.issuedAt, inputCutoffAt: f.inputCutoffAt,
    scheduleVersion: f.versions.schedule, categoryVersion: f.versions.categories, windows: f.windows });
}
export function horizonCacheKey(frozen: FrozenForecast): string {
  validateFrozenForecast(frozen);
  return `${HORIZON_EVALUATION_VERSION}:${frozen.sha256}`;
}

export function evaluateHorizon(frozen: FrozenForecast, label: HorizonLabel, asOf: string) {
  validateFrozenForecast(frozen);
  const f = frozen.forecast, window = f.windows.find(w => w.horizon === label.horizon);
  if (!window || label.playerId !== f.playerId || label.endAt !== window.endAt) throw new Error("Label target/window mismatch");
  const missing = (reason: string) => ({ state: "unavailable" as const, reason, horizon: label.horizon });
  if (window.originGameIds.length !== window.horizon) return missing("incomplete_origin_schedule");
  if (!label.coverageComplete) return missing("incomplete_outcome_coverage");
  if (instant(label.coverageAvailableAt) <= instant(window.endAt) || instant(label.coverageAvailableAt) > instant(asOf)) return missing("immature_window");
  uniqueIds(label.anchors.map(game => game.gameId));
  if (!sameIds(window.originGameIds, label.anchors.map(game => game.gameId))) return missing("unresolved_origin_games");
  for (const anchor of label.anchors) {
    if (instant(anchor.startsAt) <= instant(f.issuedAt) || instant(anchor.startsAt) > instant(window.endAt)) return missing("rescheduled_outside_frozen_window");
    if (instant(anchor.finalAt) < instant(anchor.startsAt) || instant(anchor.finalAt) > instant(label.coverageAvailableAt)) return missing("immature_origin_game");
  }
  if (!label.sourceManifest.length) throw new Error("Missing outcome provenance");
  label.sourceManifest.forEach(source => assertSource(source, label.coverageAvailableAt));
  validateGames(label.games, label.eligibleGameIds, f.kind);
  for (const game of label.games) {
    if (instant(game.startsAt) <= instant(f.issuedAt) || instant(game.startsAt) > instant(window.endAt)) throw new Error("Outcome outside frozen calendar window");
    if (instant(game.finalAt) < instant(game.startsAt) || instant(game.availableAt) < instant(game.finalAt) || instant(game.availableAt) > instant(label.coverageAvailableAt)) return missing("immature_game_label");
  }
  const actual = totals(label.games, f.kind, f.issuedAt, window.endAt);
  const samples = f.samples.map(sample => ({ probability: sample.probability, values: totals(sample.games, f.kind, f.issuedAt, window.endAt) }));
  const scores: Record<string, ReturnType<typeof scoreDistribution> | null> = {};
  const missingness: Record<string, string> = {}, ratios: Record<string, { noExposureProbability: number | null; noExposureBrier: number | null; expectedRealized: number | null; ratioOfExpectedCounts: number | null }> = {};
  for (const key of Object.keys(actual)) {
    const denominator = key === "SV_PCT" ? "SA" : key === "GAA" ? "MIN" : null;
    const numerator = key === "SV_PCT" ? "SV" : key === "GAA" ? "GA" : null;
    const missingInput = samples.some(s => denominator ? s.values[denominator] === null || s.values[numerator!] === null : s.values[key] === null);
    const valid = samples.filter(s => s.values[key] !== null), mass = valid.reduce((sum, s) => sum + s.probability, 0);
    const values = valid.map(s => ({ value: s.values[key]!, probability: s.probability / mass }));
    if (denominator) {
      const pZero = missingInput ? null : samples.filter(s => s.values[denominator] === 0).reduce((sum, s) => sum + s.probability, 0);
      const denominatorMean = samples.reduce((sum, s) => sum + s.probability * (s.values[denominator] ?? 0), 0);
      const numeratorMean = samples.reduce((sum, s) => sum + s.probability * (s.values[numerator!] ?? 0), 0);
      ratios[key] = { noExposureProbability: pZero,
        noExposureBrier: pZero === null || actual[denominator] === null ? null : (pZero - Number(actual[denominator] === 0)) ** 2,
        expectedRealized: missingInput || !mass ? null : values.reduce((sum, s) => sum + s.probability * s.value, 0),
        ratioOfExpectedCounts: missingInput || denominatorMean === 0 ? null : (key === "GAA" ? 60 : 1) * numeratorMean / denominatorMean };
    }
    if (missingInput || actual[key] === null || !mass) {
      scores[key] = null; missingness[key] = missingInput ? "missing_forecast_input" : actual[key] === null ? "missing_or_undefined_actual" : "no_positive_forecast_exposure";
    } else scores[key] = scoreDistribution(values, actual[key]!, denominator === null && key !== "MIN");
  }
  const probability = samples.reduce((sum, s) => sum + s.probability * Number((s.values.GP ?? 0) > 0), 0);
  const participationKnown = actual.GP !== null && samples.every(s => s.values.GP !== null);
  const played = Number((actual.GP ?? 0) > 0), eventMass = played ? probability : 1 - probability;
  return { state: "evaluated" as const, horizon: window.horizon, actual, scores, missingness, ratios,
    participation: participationKnown ? { event: "any_appearance_in_window", probability, actual: played, brier: (probability - played) ** 2,
      logLoss: eventMass > 0 ? -Math.log(eventMass) : null, logLossState: eventMass > 0 ? "finite" : "infinite" } : null,
    structuralViolations: 0, cacheKey: horizonCacheKey(frozen), evidenceClass: f.evidenceClass, versions: f.versions,
    freshnessAtIssue: { oldestObservationAgeMs: Math.max(...f.sourceManifest.map(source => instant(f.issuedAt) - instant(source.observedAt))),
      oldestReceiptAgeMs: Math.max(...f.sourceManifest.map(source => instant(f.issuedAt) - instant(source.firstReceivedAt))) } };
}

export interface RollingCase { candidate: FrozenForecast; comparators: Record<string, FrozenForecast>; labels: HorizonLabel[] }

/** Separate horizon summaries; undefined ratios and unavailable heads have explicit denominators. */
export function summarizeHorizonEvaluations(rows: Array<ReturnType<typeof evaluateHorizon>>) {
  const average = (values: number[]) => values.length ? values.reduce((a, b) => a + b, 0) / values.length : null;
  return ([1, 10, 20] as const).map(horizon => {
    const requested = rows.filter(row => row.horizon === horizon);
    const graded = requested.filter(row => row.state === "evaluated");
    if (new Set(graded.map(row => row.evidenceClass)).size > 1) throw new Error("Mixed evaluation evidence classes");
    const heads = [...new Set(graded.flatMap(row => Object.keys(row.scores)))];
    const probabilities = graded.flatMap(row => row.participation ? [row.participation] : []);
    return { horizon, requested: requested.length, evaluated: graded.length,
      unavailable: requested.flatMap(row => row.state === "unavailable" ? [row.reason] : []),
      metrics: Object.fromEntries(heads.map(head => {
        const scores = graded.flatMap(row => row.scores[head] ? [row.scores[head]!] : []);
        const infinite = scores.filter(score => score.logScoreState === "infinite").length;
        return [head, { count: scores.length, missing: requested.length - scores.length,
          mae: average(scores.map(score => score.absoluteError)), rmse: scores.length ? Math.sqrt(average(scores.map(score => score.squaredError))!) : null,
          crps: average(scores.map(score => score.crps)), infiniteLogScores: infinite,
          logScore: infinite ? null : average(scores.flatMap(score => score.logScore === null ? [] : [score.logScore])),
          intervals: [0.5, 0.8, 0.95].map(level => {
            const bands = scores.flatMap(score => score.intervals.filter(band => band.level === level));
            return { level, count: bands.length, coverage: average(bands.map(band => Number(band.covered))), width: average(bands.map(band => band.width)), score: average(bands.map(band => band.score)) };
          }) }];
      })),
      participation: { event: "any_appearance_in_window", count: probabilities.length, missing: requested.length - probabilities.length,
        brier: average(probabilities.map(row => row.brier)), infiniteLogLosses: probabilities.filter(row => row.logLossState === "infinite").length,
        logLoss: probabilities.some(row => row.logLossState === "infinite") ? null : average(probabilities.flatMap(row => row.logLoss === null ? [] : [row.logLoss])),
        reliability: Array.from({ length: 10 }, (_, bin) => {
          const members = probabilities.filter(row => Math.min(9, Math.floor(row.probability * 10)) === bin);
          return { bin, count: members.length, predicted: average(members.map(row => row.probability)), observed: average(members.map(row => row.actual)) };
        }) } };
  });
}

/** Frozen artifacts only: no fit, network, consumer writes, or candidate promotion occurs here. */
export function evaluateRollingOrigins(cases: RollingCase[], asOf: string) {
  instant(asOf);
  const seen = new Set<string>();
  return [...cases].sort((a, b) => instant(a.candidate.forecast.issuedAt) - instant(b.candidate.forecast.issuedAt)).map(entry => {
    validateFrozenForecast(entry.candidate);
    const key = horizonComparisonKey(entry.candidate.forecast);
    if (seen.has(key)) throw new Error("Duplicate forecast-time population member");
    seen.add(key);
    if (!sameIds(entry.labels.map(l => l.horizon), entry.candidate.forecast.windows.map(w => w.horizon))) throw new Error("Missing or duplicate horizon labels");
    for (const comparator of Object.values(entry.comparators)) {
      validateFrozenForecast(comparator);
      if (horizonComparisonKey(comparator.forecast) !== key) throw new Error("Unpaired comparator window/population");
    }
    return { playerId: entry.candidate.forecast.playerId, issuedAt: entry.candidate.forecast.issuedAt, comparisonKey: key,
      horizons: entry.labels.map(label => ({ candidate: evaluateHorizon(entry.candidate, label, asOf),
        comparators: Object.fromEntries(Object.entries(entry.comparators).map(([name, forecast]) => [name, evaluateHorizon(forecast, label, asOf)])) })) };
  });
}

/** Paired calendar-block bootstrap; every player at an origin stays in the same block.
 * Block length must cover the longest actual frozen target span. This remains an approximate
 * dependence diagnostic; report block-length sensitivity and do not interpret tiny block counts. */
export function pairedCalendarBlocks(cases: RollingCase[], asOf: string, comparator: string, category: string,
  horizon: CumulativeHorizon, blockDays: number, repetitions = 1000, seed = 7) {
  if (!Number.isSafeInteger(blockDays) || blockDays < 1 || !Number.isSafeInteger(repetitions) || repetitions < 100 || repetitions > 10000) throw new Error("Invalid block bootstrap bounds");
  const dayMs = 86400000, maximumSpan = Math.max(0, ...cases.flatMap(entry => entry.candidate.forecast.windows
    .filter(window => window.horizon === horizon).map(window => (instant(window.endAt) - instant(entry.candidate.forecast.issuedAt)) / dayMs)));
  if (blockDays < Math.ceil(maximumSpan)) throw new Error("Block shorter than overlapping target windows");
  const reports = evaluateRollingOrigins(cases, asOf), groups = new Map<number, number[]>();
  const origin = reports.length ? instant(reports[0].issuedAt) : 0;
  let requested = 0;
  for (const report of reports) {
    const row = report.horizons.find(item => item.candidate.horizon === horizon);
    if (!row) continue;
    requested++;
    const candidate = row.candidate, baseline = row.comparators[comparator];
    if (candidate.state !== "evaluated" || baseline?.state !== "evaluated") continue;
    const a = candidate.scores[category], b = baseline.scores[category];
    if (!a || !b) continue;
    const key = Math.floor((instant(report.issuedAt) - origin) / (dayMs * blockDays));
    const block = groups.get(key) ?? []; block.push(b.crps - a.crps); groups.set(key, block);
  }
  const blocks = [...groups.values()], count = blocks.reduce((sum, block) => sum + block.length, 0);
  const improvement = count ? blocks.flat().reduce((sum, value) => sum + value, 0) / count : null;
  const metadata = { comparator, category, horizon, metric: "CRPS_baseline_minus_candidate", requested, paired: count,
    blocks: blocks.length, blockDays, repetitions, seed, improvement };
  if (blocks.length < 2) return { ...metadata, interval95: null, limitation: "insufficient_calendar_blocks" };
  let state = seed >>> 0;
  const draw = () => { state = (Math.imul(state, 1664525) + 1013904223) >>> 0; return state / 4294967296; };
  const differences = Array.from({ length: repetitions }, () => {
    let sum = 0, n = 0;
    for (let i = 0; i < blocks.length; i++) { const block = blocks[Math.floor(draw() * blocks.length)]; sum += block.reduce((a, b) => a + b, 0); n += block.length; }
    return sum / n;
  }).sort((a, b) => a - b);
  return { ...metadata, interval95: [differences[Math.floor(0.025 * (repetitions - 1))], differences[Math.floor(0.975 * (repetitions - 1))]],
    limitation: "approximate_calendar_block_bootstrap_requires_block_length_sensitivity" };
}
