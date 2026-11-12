import { getDefaultFantasyPointsConfig } from "lib/projectionsConfig/fantasyPointsConfig";
import type { Database, Json } from "lib/supabase/database-generated.types";
import {
  METRIC_SPECS,
  MetricSpec,
  SustainabilityMetricKey,
  halfLifeWeight,
  blendWithPrior,
  betaPosterior,
  betaCredibleInterval,
  gammaPosterior,
  gammaCredibleInterval
} from "./bands";
import { WindowCode } from "./windows";
import {
  betaBinomialUsualRange,
  negativeBinomialUsualRange,
  type UsualRangeResult,
  type UsualRangeUnavailable
} from "./usualRange";
import {
  SUSTAINABILITY_TREND_BAND_MODEL_VERSION,
  buildSustainabilityConfigHash
} from "./runtimeContract";

type PlayerGameRow = Database["public"]["Views"]["player_stats_unified"]["Row"];
type PlayerSeasonTotal =
  Database["public"]["Views"]["player_totals_unified"]["Row"];

const WINDOW_SIZES: Record<WindowCode, number> = {
  l3: 3,
  l5: 5,
  l10: 10,
  l20: 20
};

const FANTASY_POINTS = getDefaultFantasyPointsConfig("skater");

export interface TrendBandRecord {
  player_id: number;
  season_id: number | null;
  snapshot_date: string;
  metric_key: SustainabilityMetricKey;
  window_code: WindowCode;
  baseline: number | null;
  ewma: number | null;
  value: number;
  ci_lower: number;
  ci_upper: number;
  n_eff: number | null;
  prior_weight: number | null;
  z_score: number | null;
  percentile: number | null;
  exposure: number | null;
  distribution: Json | null;
}

type BetaSample = {
  successes: number;
  trials: number;
  gamesAgo: number;
};

type GammaSample = {
  count: number;
  exposure: number;
  gamesAgo: number;
};

type NormalSample = {
  value: number;
  exposure: number;
  gamesAgo: number;
};

type ComputedBand = {
  ewma: number;
  value: number;
  lower: number;
  upper: number;
  nEff: number;
  distribution: Json;
};

const SEASON_WEIGHTS = [0.6, 0.3, 0.1] as const;
const Z_80 = 1.2815515655446004;

function estimateZScoreFromBand(
  value: number,
  baseline: number | null,
  lower: number,
  upper: number
): number | null {
  if (baseline == null || !Number.isFinite(baseline)) return null;
  const sd = (upper - lower) / (2 * Z_80);
  if (!Number.isFinite(sd) || sd <= 1e-9) return null;
  return Number(((value - baseline) / sd).toFixed(6));
}

function getSeasonWeights(length: number): number[] {
  if (length === 0) return [];
  const weights: number[] = [];
  for (let i = 0; i < length; i += 1) {
    weights.push(SEASON_WEIGHTS[i] ?? 0);
  }
  const total = weights.reduce((sum, v) => sum + v, 0);
  if (total === 0) {
    return Array.from({ length }, () => 1 / length);
  }
  return weights.map((w) => w / total);
}

type SeasonPair = { season: number | null; numerator: number; denominator: number };

/**
 * Matched season components: a season counts only when both its numerator and
 * its denominator are known (rule 23: no filling one side from another source).
 */
function collectSeasonPairs(
  totals: PlayerSeasonTotal[],
  getNumerator: (row: PlayerSeasonTotal) => number | null | undefined,
  getDenominator: (row: PlayerSeasonTotal) => number | null | undefined
): SeasonPair[] {
  return totals
    .map((row) => ({
      season: row.season_id ?? null,
      numerator: getNumerator(row),
      denominator: getDenominator(row)
    }))
    .filter(
      (pair): pair is SeasonPair =>
        typeof pair.numerator === "number" &&
        Number.isFinite(pair.numerator) &&
        typeof pair.denominator === "number" &&
        Number.isFinite(pair.denominator)
    )
    .sort((a, b) => (b.season ?? 0) - (a.season ?? 0));
}

function weightedPairs(pairs: SeasonPair[]): {
  numerator: number;
  denominator: number;
  seasons: number[];
} {
  const weights = getSeasonWeights(pairs.length);
  let numerator = 0;
  let denominator = 0;
  pairs.forEach((pair, idx) => {
    numerator += weights[idx] * pair.numerator;
    denominator += weights[idx] * pair.denominator;
  });
  return {
    numerator,
    denominator,
    seasons: pairs
      .map((pair) => pair.season)
      .filter((season): season is number => season != null)
  };
}

function computeBaselinePer60(
  totals: PlayerSeasonTotal[],
  getCounts: (row: PlayerSeasonTotal) => number | null | undefined,
  getExposureSeconds: (row: PlayerSeasonTotal) => number | null | undefined
): { mu: number; exposure: number; seasons: number[] } {
  const pooled = weightedPairs(
    collectSeasonPairs(totals, getCounts, getExposureSeconds)
  );
  const minutes = pooled.denominator / 60;
  if (minutes <= 0) return { mu: 0, exposure: 0, seasons: [] };
  return {
    mu: (pooled.numerator / minutes) * 60,
    exposure: minutes,
    seasons: pooled.seasons
  };
}

function computeBaselinePercentage(
  totals: PlayerSeasonTotal[],
  getSuccesses: (row: PlayerSeasonTotal) => number | null | undefined,
  getTrials: (row: PlayerSeasonTotal) => number | null | undefined
): { mu: number; trials: number; seasons: number[]; valid: boolean } {
  const pairs = collectSeasonPairs(totals, getSuccesses, getTrials);
  const valid = pairs.every(
    (pair) =>
      pair.numerator >= 0 &&
      pair.denominator >= 0 &&
      pair.numerator <= pair.denominator
  );
  const pooled = weightedPairs(pairs);
  if (pooled.denominator <= 0) {
    return { mu: 0, trials: 0, seasons: [], valid };
  }
  return {
    mu: pooled.numerator / pooled.denominator,
    trials: pooled.denominator,
    seasons: pooled.seasons,
    valid
  };
}

function computeBaselineNormal(
  totals: PlayerSeasonTotal[],
  getValue: (row: PlayerSeasonTotal) => number,
  getExposure: (row: PlayerSeasonTotal) => number
): { mu: number; exposure: number } {
  if (!totals.length) return { mu: 0, exposure: 0 };
  const sorted = totals
    .slice()
    .sort((a, b) => (b.season_id ?? 0) - (a.season_id ?? 0));
  const weights = getSeasonWeights(sorted.length);
  let weightedValue = 0;
  let totalExposure = 0;
  sorted.forEach((row, idx) => {
    const w = weights[idx];
    const exposure = getExposure(row);
    weightedValue += w * getValue(row) * exposure;
    totalExposure += w * exposure;
  });
  if (totalExposure <= 0) return { mu: 0, exposure: 0 };
  return { mu: weightedValue / totalExposure, exposure: totalExposure };
}

function knownNumber(value: number | null | undefined): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

/**
 * Pairs a count with exposure seconds from the same source (rule 23).
 * Unknown count or exposure: the game stays a window member but the metric is
 * unknown for it (null). Known zero exposure: a zero-opportunity member.
 */
function gammaSample(
  count: number | null | undefined,
  exposureSeconds: number | null | undefined,
  gamesAgo: number
): GammaSample | null {
  const c = knownNumber(count);
  const seconds = knownNumber(exposureSeconds);
  if (c == null || seconds == null || seconds < 0 || c < 0) return null;
  return { count: c, exposure: seconds / 60, gamesAgo };
}

function collectGammaSamples(
  metric: SustainabilityMetricKey,
  rows: PlayerGameRow[]
): GammaSample[] {
  return rows
    .map((row, gamesAgo) => {
      switch (metric) {
        // WGO counts over WGO ice time; `toi_per_game` is seconds per game.
        case "shots_per_60":
          return gammaSample(row.shots, row.toi_per_game, gamesAgo);
        case "hits_per_60":
          return gammaSample(row.hits, row.toi_per_game, gamesAgo);
        case "blocks_per_60":
          return gammaSample(row.blocked_shots, row.toi_per_game, gamesAgo);
        // NST counts over NST ice time; a game without an NST row is unknown.
        case "icf_per_60":
          return gammaSample(row.nst_icf, row.nst_toi, gamesAgo);
        case "ixg_per_60":
          return gammaSample(row.nst_ixg, row.nst_toi, gamesAgo);
        // 5v5 points over 5v5 ice time (not ES time).
        case "points_per_60_5v5":
          return gammaSample(row.points_5v5, row.toi_per_game_5v5, gamesAgo);
        case "pp_goals_per_60":
          return gammaSample(row.pp_goals, row.pp_toi, gamesAgo);
        case "pp_points_per_60":
          return gammaSample(row.pp_points, row.pp_toi, gamesAgo);
        default:
          return null;
      }
    })
    .filter((sample): sample is GammaSample => sample !== null);
}

function betaSample(
  successes: number | null | undefined,
  trials: number | null | undefined,
  gamesAgo: number
): BetaSample | null {
  const s = knownNumber(successes);
  const n = knownNumber(trials);
  // Out-of-domain games (successes > trials) are unknown, never clamped.
  if (s == null || n == null || s < 0 || n < 0 || s > n) return null;
  return { successes: s, trials: n, gamesAgo };
}

function collectBetaSamples(
  metric: SustainabilityMetricKey,
  rows: PlayerGameRow[]
): BetaSample[] {
  return rows
    .map((row, gamesAgo) => {
      switch (metric) {
        case "ipp":
          return betaSample(row.points, row.nst_oi_gf, gamesAgo);
        case "sh_pct":
          return betaSample(row.goals, row.shots, gamesAgo);
        case "on_ice_sh_pct":
          return betaSample(row.nst_oi_gf, row.nst_oi_sf, gamesAgo);
        case "on_ice_sv_pct": {
          const sa = knownNumber(row.nst_oi_sa);
          const ga = knownNumber(row.nst_oi_ga);
          if (sa == null || ga == null) return null;
          return betaSample(sa - ga, sa, gamesAgo);
        }
        default:
          return null;
      }
    })
    .filter((sample): sample is BetaSample => sample !== null);
}

function collectNormalSamples(
  metric: SustainabilityMetricKey,
  rows: PlayerGameRow[]
): NormalSample[] {
  return rows
    .map((row, gamesAgo) => {
      switch (metric) {
        case "pp_toi_pct": {
          const value = knownNumber(row.pp_toi_pct_per_game);
          if (value == null) return null;
          return { value, exposure: 1, gamesAgo };
        }
        case "pdo": {
          const value = knownNumber(row.nst_oi_pdo);
          if (value == null) return null;
          const shotsFor = row.nst_oi_sf ?? 0;
          const shotsAgainst = row.nst_oi_sa ?? 0;
          return {
            value,
            exposure: Math.max(shotsFor + shotsAgainst, 1),
            gamesAgo
          };
        }
        case "fantasy_score": {
          const parts = [
            row.goals,
            row.assists,
            row.pp_points,
            row.shots,
            row.hits,
            row.blocked_shots
          ];
          if (parts.some((part) => knownNumber(part) == null)) return null;
          const score =
            (row.goals ?? 0) * (FANTASY_POINTS.GOALS ?? 0) +
            (row.assists ?? 0) * (FANTASY_POINTS.ASSISTS ?? 0) +
            (row.pp_points ?? 0) * (FANTASY_POINTS.PP_POINTS ?? 0) +
            (row.shots ?? 0) * (FANTASY_POINTS.SHOTS_ON_GOAL ?? 0) +
            (row.hits ?? 0) * (FANTASY_POINTS.HITS ?? 0) +
            (row.blocked_shots ?? 0) * (FANTASY_POINTS.BLOCKED_SHOTS ?? 0);
          return {
            value: score,
            exposure: 1,
            gamesAgo
          };
        }
        default:
          return null;
      }
    })
    .filter((sample): sample is NormalSample => sample !== null);
}

type MetricBaseline = {
  baseline: number;
  /** Evidence: minutes (per-60), trials (percentages), or 0 (normal). */
  exposure: number;
  seasons: number[];
  valid: boolean;
};

function per60Baseline(
  totals: PlayerSeasonTotal[],
  getCounts: (row: PlayerSeasonTotal) => number | null | undefined,
  getExposureSeconds: (row: PlayerSeasonTotal) => number | null | undefined
): MetricBaseline {
  const { mu, exposure, seasons } = computeBaselinePer60(
    totals,
    getCounts,
    getExposureSeconds
  );
  return { baseline: mu, exposure, seasons, valid: true };
}

function percentageBaseline(
  totals: PlayerSeasonTotal[],
  getSuccesses: (row: PlayerSeasonTotal) => number | null | undefined,
  getTrials: (row: PlayerSeasonTotal) => number | null | undefined
): MetricBaseline {
  const { mu, trials, seasons, valid } = computeBaselinePercentage(
    totals,
    getSuccesses,
    getTrials
  );
  return { baseline: mu, exposure: trials, seasons, valid };
}

function baselineForMetric(
  metric: SustainabilityMetricKey,
  totals: PlayerSeasonTotal[]
): MetricBaseline {
  switch (metric) {
    case "shots_per_60":
      return per60Baseline(totals, (row) => row.shots, (row) => row.toi_all_situations);
    case "icf_per_60":
      return per60Baseline(totals, (row) => row.nst_icf, (row) => row.nst_toi);
    case "ixg_per_60":
      return per60Baseline(totals, (row) => row.nst_ixg, (row) => row.nst_toi);
    case "points_per_60_5v5":
      return per60Baseline(totals, (row) => row.points_5v5, (row) => row.toi_5v5_total);
    case "pp_goals_per_60":
      return per60Baseline(totals, (row) => row.pp_goals, (row) => row.pp_toi);
    case "pp_points_per_60":
      return per60Baseline(totals, (row) => row.pp_points, (row) => row.pp_toi);
    case "hits_per_60":
      return per60Baseline(totals, (row) => row.hits, (row) => row.toi_all_situations);
    case "blocks_per_60":
      return per60Baseline(
        totals,
        (row) => row.blocked_shots,
        (row) => row.toi_all_situations
      );
    // IPP: points over on-ice goals for, matched seasons only (no ES GF).
    case "ipp":
      return percentageBaseline(totals, (row) => row.points, (row) => row.nst_oi_gf);
    case "sh_pct":
      return percentageBaseline(totals, (row) => row.goals, (row) => row.shots);
    case "on_ice_sh_pct":
      return percentageBaseline(totals, (row) => row.nst_oi_gf, (row) => row.nst_oi_sf);
    case "on_ice_sv_pct":
      return percentageBaseline(
        totals,
        (row) =>
          row.nst_oi_sa != null && row.nst_oi_ga != null
            ? row.nst_oi_sa - row.nst_oi_ga
            : null,
        (row) => row.nst_oi_sa
      );
    case "pp_toi_pct": {
      const { mu } = computeBaselineNormal(
        totals,
        (row) => row.pp_toi_pct_of_team ?? 0,
        (row) => row.games_played ?? 0
      );
      return { baseline: mu, exposure: 0, seasons: [], valid: true };
    }
    case "pdo":
      return { baseline: 1.0, exposure: 0, seasons: [], valid: true };
    case "fantasy_score": {
      if (!totals.length) return { baseline: 0, exposure: 0, seasons: [], valid: true };
      const sorted = totals
        .slice()
        .sort((a, b) => (b.season_id ?? 0) - (a.season_id ?? 0));
      const weights = getSeasonWeights(sorted.length);
      let numerator = 0;
      let denominator = 0;
      sorted.forEach((row, idx) => {
        const w = weights[idx];
        const games = row.games_played ?? 0;
        if (!games) return;
        const score =
          (row.goals ?? 0) * (FANTASY_POINTS.GOALS ?? 0) +
          (row.assists ?? 0) * (FANTASY_POINTS.ASSISTS ?? 0) +
          (row.pp_points ?? 0) * (FANTASY_POINTS.PP_POINTS ?? 0) +
          (row.shots ?? 0) * (FANTASY_POINTS.SHOTS_ON_GOAL ?? 0) +
          (row.hits ?? 0) * (FANTASY_POINTS.HITS ?? 0) +
          (row.blocked_shots ?? 0) * (FANTASY_POINTS.BLOCKED_SHOTS ?? 0);
        numerator += w * (score / games);
        denominator += w;
      });
      if (denominator === 0) return { baseline: 0, exposure: 0, seasons: [], valid: true };
      return { baseline: numerator / denominator, exposure: 0, seasons: [], valid: true };
    }
    default:
      return { baseline: 0, exposure: 0, seasons: [], valid: true };
  }
}

function clamp(value: number): number {
  if (Number.isNaN(value)) return 0;
  if (!Number.isFinite(value)) return 0;
  return value;
}

/** Window membership is fixed first: the newest N games, whatever they hold. */
function inWindow<T extends { gamesAgo: number }>(
  samples: T[],
  windowSize: number
): T[] {
  return samples.filter((sample) => sample.gamesAgo < windowSize);
}

function computeGammaBand(
  spec: MetricSpec,
  samples: GammaSample[],
  baseline: number,
  windowSize: number
): ComputedBand {
  const subset = inWindow(samples, windowSize);
  let weightedCounts = 0;
  let weightedExposure = 0;
  subset.forEach((sample) => {
    const w = halfLifeWeight(sample.gamesAgo, spec.halfLifeGames);
    weightedCounts += sample.count * w;
    weightedExposure += sample.exposure * w;
  });
  const ewmaPer60 =
    weightedExposure > 0 ? (weightedCounts / weightedExposure) * 60 : baseline;
  const blend = blendWithPrior({
    ewmaEstimate: ewmaPer60,
    baseline,
    nEff: weightedExposure,
    priorStrength: spec.priorStrength
  });
  const baselineRatePerMinute = baseline / 60;
  const shape0 = baselineRatePerMinute * spec.priorStrength + 1e-3;
  const rate0 = spec.priorStrength + 1e-3;
  const { shape, rate } = gammaPosterior(
    shape0,
    rate0,
    weightedCounts,
    weightedExposure
  );
  const credible = gammaCredibleInterval(shape, rate, 0.8);
  const distribution: Json = { shape, rate };
  return {
    ewma: ewmaPer60,
    value: blend.value,
    lower: credible.lower * 60,
    upper: credible.upper * 60,
    nEff: weightedExposure,
    distribution
  };
}

function computeBetaBand(
  spec: MetricSpec,
  samples: BetaSample[],
  baseline: number,
  windowSize: number
): ComputedBand {
  const subset = inWindow(samples, windowSize);
  let weightedSuccess = 0;
  let weightedTrials = 0;
  subset.forEach((sample) => {
    const w = halfLifeWeight(sample.gamesAgo, spec.halfLifeGames);
    weightedSuccess += sample.successes * w;
    weightedTrials += sample.trials * w;
  });
  const ewma = weightedTrials > 0 ? weightedSuccess / weightedTrials : baseline;
  const alpha0 = baseline * spec.priorStrength + 0.5;
  const beta0 = (1 - baseline) * spec.priorStrength + 0.5;
  const { alpha, beta } = betaPosterior(
    alpha0,
    beta0,
    weightedSuccess,
    weightedTrials
  );
  const credible = betaCredibleInterval(alpha, beta, 0.8);
  const distribution: Json = { alpha, beta };
  return {
    ewma,
    // One prior for the point value and its interval: the posterior mean.
    value: credible.mean,
    lower: credible.lower,
    upper: credible.upper,
    nEff: weightedTrials,
    distribution
  };
}

function computeNormalBand(
  spec: MetricSpec,
  samples: NormalSample[],
  baseline: number,
  windowSize: number
): ComputedBand {
  const subset = inWindow(samples, windowSize);
  let weightedSum = 0;
  let weightedSquares = 0;
  let totalWeight = 0;
  subset.forEach((sample) => {
    const w = halfLifeWeight(sample.gamesAgo, spec.halfLifeGames);
    weightedSum += sample.value * w;
    weightedSquares += sample.value * sample.value * w;
    totalWeight += w;
  });
  const ewma = totalWeight > 0 ? weightedSum / totalWeight : baseline;
  const blend = blendWithPrior({
    ewmaEstimate: ewma,
    baseline,
    nEff: totalWeight,
    priorStrength: spec.priorStrength
  });
  const mean = blend.value;
  const variance =
    totalWeight > 0
      ? Math.max(weightedSquares / totalWeight - ewma * ewma, 1e-4)
      : 1;
  const std = Math.sqrt(variance);
  const zRadius = 1.28155; // ~80% interval
  const scale = Math.max(Math.sqrt(totalWeight), 1);
  const margin = (std * zRadius) / scale;
  const distribution: Json = {
    mean,
    std,
    samples: subset.length
  };
  return {
    ewma,
    value: mean,
    lower: mean - margin,
    upper: mean + margin,
    nEff: totalWeight,
    distribution
  };
}

function computeUsualRange(args: {
  metric: SustainabilityMetricKey;
  spec: MetricSpec;
  preWindow: MetricBaseline;
  gamma: GammaSample[] | null;
  beta: BetaSample[] | null;
  windowSize: number;
  gamesInWindow: number;
}): UsualRangeResult {
  const unavailable = (
    reason: UsualRangeUnavailable["reason"],
    gamesCovered: number
  ): UsualRangeUnavailable => ({
    basis: "pre_window_baseline_predictive",
    unavailable: true,
    reason,
    gamesInWindow: args.gamesInWindow,
    gamesCovered
  });

  if (args.spec.distribution === "gamma" && args.gamma) {
    const subset = inWindow(args.gamma, args.windowSize);
    return negativeBinomialUsualRange({
      baselinePer60: args.preWindow.baseline,
      baselineMinutes: args.preWindow.exposure,
      count: subset.reduce((sum, sample) => sum + sample.count, 0),
      minutes: subset.reduce((sum, sample) => sum + sample.exposure, 0),
      continuous: args.metric === "ixg_per_60",
      gamesInWindow: args.gamesInWindow,
      gamesCovered: subset.length,
      baselineSeasons: args.preWindow.seasons
    });
  }
  if (args.spec.distribution === "beta" && args.beta) {
    const subset = inWindow(args.beta, args.windowSize);
    if (!args.preWindow.valid) {
      return unavailable("invalid_baseline", subset.length);
    }
    return betaBinomialUsualRange({
      baseline: args.preWindow.baseline,
      baselineTrials: args.preWindow.exposure,
      successes: subset.reduce((sum, sample) => sum + sample.successes, 0),
      trials: subset.reduce((sum, sample) => sum + sample.trials, 0),
      gamesInWindow: args.gamesInWindow,
      gamesCovered: subset.length,
      baselineSeasons: args.preWindow.seasons
    });
  }
  return unavailable("no_baseline_dispersion", 0);
}

export function computeTrendBandsForPlayer({
  playerId,
  snapshotDate,
  seasonId,
  metrics,
  rows,
  totals,
  windows
}: {
  playerId: number;
  snapshotDate: string;
  seasonId: number | null;
  metrics: SustainabilityMetricKey[];
  rows: PlayerGameRow[];
  totals: PlayerSeasonTotal[];
  windows: WindowCode[];
}): TrendBandRecord[] {
  if (!rows.length) return [];
  const useWindows = windows.filter((w) => WINDOW_SIZES[w] != null);
  const results: TrendBandRecord[] = [];
  // Decision 34: the usual range's baseline uses only completed seasons
  // before the snapshot's season, never the judged games.
  const preWindowTotals = totals.filter(
    (row) =>
      seasonId != null && row.season_id != null && row.season_id < seasonId
  );

  metrics.forEach((metric) => {
    const spec = METRIC_SPECS[metric];
    if (!spec) return;

    const baselineInfo = baselineForMetric(metric, totals);
    // An out-of-domain baseline (e.g. IPP above 1) is unknown: no band.
    if (!baselineInfo.valid) return;
    let baseline = baselineInfo.baseline;
    if (spec.distribution === "beta" || spec.distribution === "gamma") {
      baseline = clamp(baseline);
    }
    const preWindow = baselineForMetric(metric, preWindowTotals);

    let samplesGamma: GammaSample[] | null = null;
    let samplesBeta: BetaSample[] | null = null;
    let samplesNormal: NormalSample[] | null = null;

    switch (spec.distribution) {
      case "gamma":
        samplesGamma = collectGammaSamples(metric, rows);
        if (!samplesGamma.length) return;
        break;
      case "beta":
        samplesBeta = collectBetaSamples(metric, rows);
        if (!samplesBeta.length) return;
        break;
      default:
        samplesNormal = collectNormalSamples(metric, rows);
        if (!samplesNormal.length) return;
        break;
    }

    useWindows.forEach((windowCode) => {
      const windowSize = WINDOW_SIZES[windowCode];
      if (windowSize <= 0) return;
      const covered = inWindow<{ gamesAgo: number }>(
        samplesGamma ?? samplesBeta ?? samplesNormal ?? [],
        windowSize
      ).length;
      // No known value in the window's games: unknown, not the baseline.
      if (covered === 0) return;
      const gamesInWindow = Math.min(windowSize, rows.length);
      let computed:
        | ReturnType<typeof computeGammaBand>
        | ReturnType<typeof computeBetaBand>
        | ReturnType<typeof computeNormalBand>
        | null = null;

      if (spec.distribution === "gamma" && samplesGamma) {
        computed = computeGammaBand(spec, samplesGamma, baseline, windowSize);
      } else if (spec.distribution === "beta" && samplesBeta) {
        computed = computeBetaBand(spec, samplesBeta, baseline, windowSize);
      } else if (samplesNormal) {
        computed = computeNormalBand(spec, samplesNormal, baseline, windowSize);
      }

      if (!computed) return;

      const usualRange = computeUsualRange({
        metric,
        spec,
        preWindow,
        gamma: samplesGamma,
        beta: samplesBeta,
        windowSize,
        gamesInWindow
      });

      results.push({
        player_id: playerId,
        season_id: seasonId,
        snapshot_date: snapshotDate,
        metric_key: metric,
        window_code: windowCode,
        baseline,
        ewma: computed.ewma,
        value: computed.value,
        ci_lower: computed.lower,
        ci_upper: computed.upper,
        n_eff: computed.nEff,
        prior_weight: spec.priorStrength,
        z_score: estimateZScoreFromBand(
          computed.value,
          baseline,
          computed.lower,
          computed.upper
        ),
        // The old percentile was the value's position inside its own
        // interval (about 50 by construction); tails now live in usualRange.
        percentile: null,
        exposure: computed.nEff,
        distribution: {
          ...(computed.distribution as Record<string, unknown>),
          modelVersion: SUSTAINABILITY_TREND_BAND_MODEL_VERSION,
          configHash: buildSustainabilityConfigHash({
            metric,
            windowCode,
            distribution: spec.distribution,
            halfLifeGames: spec.halfLifeGames,
            priorStrength: spec.priorStrength
          }),
          window: { gamesInWindow, gamesCovered: covered },
          usualRange: usualRange as unknown as Json,
          warnings:
            covered < gamesInWindow ? ["partial_window_coverage"] : [],
          fallbackFlags: {}
        }
      });
    });
  });

  return results;
}
