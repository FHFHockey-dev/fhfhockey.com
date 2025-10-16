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

function normalizePercentage(value: number | null | undefined): number | null {
  if (value == null) return null;
  if (Number.isNaN(value)) return null;
  return value > 1 ? value / 100 : value;
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

function computeBaselinePer60(
  totals: PlayerSeasonTotal[],
  getCounts: (row: PlayerSeasonTotal) => number,
  getExposureMinutes: (row: PlayerSeasonTotal) => number
): { mu: number; exposure: number } {
  if (!totals.length) {
    return { mu: 0, exposure: 0 };
  }
  const sorted = totals
    .slice()
    .sort((a, b) => (b.season_id ?? 0) - (a.season_id ?? 0));
  const weights = getSeasonWeights(sorted.length);
  let countSum = 0;
  let exposureSum = 0;
  sorted.forEach((row, idx) => {
    const w = weights[idx];
    countSum += w * getCounts(row);
    exposureSum += w * getExposureMinutes(row);
  });
  if (exposureSum <= 0) return { mu: 0, exposure: 0 };
  return { mu: (countSum / exposureSum) * 60, exposure: exposureSum };
}

function computeBaselinePercentage(
  totals: PlayerSeasonTotal[],
  getSuccesses: (row: PlayerSeasonTotal) => number,
  getTrials: (row: PlayerSeasonTotal) => number
): { mu: number; trials: number } {
  if (!totals.length) {
    return { mu: 0, trials: 0 };
  }
  const sorted = totals
    .slice()
    .sort((a, b) => (b.season_id ?? 0) - (a.season_id ?? 0));
  const weights = getSeasonWeights(sorted.length);
  let successSum = 0;
  let trialSum = 0;
  sorted.forEach((row, idx) => {
    const w = weights[idx];
    successSum += w * getSuccesses(row);
    trialSum += w * getTrials(row);
  });
  if (trialSum <= 0) return { mu: 0, trials: 0 };
  return { mu: successSum / trialSum, trials: trialSum };
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

function collectGammaSamples(
  metric: SustainabilityMetricKey,
  rows: PlayerGameRow[]
): GammaSample[] {
  return rows
    .map((row, idx) => {
      const gamesAgo = idx;
      switch (metric) {
        case "shots_per_60": {
          const shots = row.shots ?? 0;
          const toiSeconds = row.nst_toi ?? (row.toi_per_game ?? 0) * 60;
          if (!toiSeconds || toiSeconds <= 0) return null;
          return {
            count: shots,
            exposure: toiSeconds / 60,
            gamesAgo
          };
        }
        case "icf_per_60": {
          const icf = row.nst_icf ?? 0;
          const toiSeconds = row.nst_toi ?? (row.toi_per_game ?? 0) * 60;
          if (!toiSeconds || toiSeconds <= 0) return null;
          return {
            count: icf,
            exposure: toiSeconds / 60,
            gamesAgo
          };
        }
        case "ixg_per_60": {
          const ixg = row.nst_ixg ?? 0;
          const toiSeconds = row.nst_toi ?? (row.toi_per_game ?? 0) * 60;
          if (!toiSeconds || toiSeconds <= 0) return null;
          return {
            count: ixg,
            exposure: toiSeconds / 60,
            gamesAgo
          };
        }
        case "points_per_60_5v5": {
          const pts = row.points_5v5 ?? 0;
          const toiSeconds = row.ev_time_on_ice ?? 0;
          if (!toiSeconds || toiSeconds <= 0) return null;
          return {
            count: pts,
            exposure: toiSeconds / 60,
            gamesAgo
          };
        }
        case "pp_goals_per_60": {
          const goals = row.pp_goals ?? 0;
          const toiSeconds = row.pp_toi ?? 0;
          if (!toiSeconds || toiSeconds <= 0) return null;
          return {
            count: goals,
            exposure: toiSeconds / 60,
            gamesAgo
          };
        }
        case "pp_points_per_60": {
          const pts = row.pp_points ?? 0;
          const toiSeconds = row.pp_toi ?? 0;
          if (!toiSeconds || toiSeconds <= 0) return null;
          return {
            count: pts,
            exposure: toiSeconds / 60,
            gamesAgo
          };
        }
        case "hits_per_60": {
          const hits = row.hits ?? 0;
          const toiSeconds = row.nst_toi ?? (row.toi_per_game ?? 0) * 60;
          if (!toiSeconds || toiSeconds <= 0) return null;
          return {
            count: hits,
            exposure: toiSeconds / 60,
            gamesAgo
          };
        }
        case "blocks_per_60": {
          const blocks = row.blocked_shots ?? 0;
          const toiSeconds = row.nst_toi ?? (row.toi_per_game ?? 0) * 60;
          if (!toiSeconds || toiSeconds <= 0) return null;
          return {
            count: blocks,
            exposure: toiSeconds / 60,
            gamesAgo
          };
        }
        default:
          return null;
      }
    })
    .filter((sample): sample is GammaSample => sample !== null);
}

function collectBetaSamples(
  metric: SustainabilityMetricKey,
  rows: PlayerGameRow[]
): BetaSample[] {
  return rows
    .map((row, idx) => {
      const gamesAgo = idx;
      switch (metric) {
        case "ipp": {
          const successes = row.points ?? 0;
          const trials = row.nst_oi_gf ?? 0;
          if (!trials || trials <= 0) return null;
          return { successes, trials, gamesAgo };
        }
        case "sh_pct": {
          const successes = row.goals ?? 0;
          const trials = row.shots ?? 0;
          if (!trials || trials <= 0) return null;
          return { successes, trials, gamesAgo };
        }
        case "on_ice_sh_pct": {
          const successes = row.nst_oi_gf ?? 0;
          const trials = row.nst_oi_sf ?? 0;
          if (!trials || trials <= 0) return null;
          return { successes, trials, gamesAgo };
        }
        case "on_ice_sv_pct": {
          const shotsAgainst = row.nst_oi_sa ?? 0;
          const goalsAgainst = row.nst_oi_ga ?? 0;
          if (!shotsAgainst || shotsAgainst <= 0) return null;
          const saves = shotsAgainst - (goalsAgainst ?? 0);
          return {
            successes: saves,
            trials: shotsAgainst,
            gamesAgo
          };
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
    .map((row, idx) => {
      const gamesAgo = idx;
      switch (metric) {
        case "pp_toi_pct": {
          const value = row.pp_toi_pct_per_game ?? 0;
          return { value, exposure: 1, gamesAgo };
        }
        case "pdo": {
          const value = row.nst_oi_pdo ?? null;
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

function baselineForMetric(
  metric: SustainabilityMetricKey,
  totals: PlayerSeasonTotal[]
): { baseline: number; exposure: number } {
  switch (metric) {
    case "shots_per_60": {
      const { mu, exposure } = computeBaselinePer60(
        totals,
        (row) => row.shots ?? 0,
        (row) => (row.toi_all_situations ?? 0) / 60
      );
      return { baseline: mu, exposure };
    }
    case "icf_per_60": {
      const { mu, exposure } = computeBaselinePer60(
        totals,
        (row) => row.nst_icf ?? 0,
        (row) => (row.nst_toi ?? row.toi_all_situations ?? 0) / 60
      );
      return { baseline: mu, exposure };
    }
    case "ixg_per_60": {
      const { mu, exposure } = computeBaselinePer60(
        totals,
        (row) => row.nst_ixg ?? 0,
        (row) => (row.nst_toi ?? row.toi_all_situations ?? 0) / 60
      );
      return { baseline: mu, exposure };
    }
    case "points_per_60_5v5": {
      const { mu, exposure } = computeBaselinePer60(
        totals,
        (row) => row.points_5v5 ?? 0,
        (row) => (row.toi_5v5_total ?? row.ev_time_on_ice ?? 0) / 60
      );
      return { baseline: mu, exposure };
    }
    case "pp_goals_per_60": {
      const { mu, exposure } = computeBaselinePer60(
        totals,
        (row) => row.pp_goals ?? 0,
        (row) => (row.pp_toi ?? 0) / 60
      );
      return { baseline: mu, exposure };
    }
    case "pp_points_per_60": {
      const { mu, exposure } = computeBaselinePer60(
        totals,
        (row) => row.pp_points ?? 0,
        (row) => (row.pp_toi ?? 0) / 60
      );
      return { baseline: mu, exposure };
    }
    case "hits_per_60": {
      const { mu, exposure } = computeBaselinePer60(
        totals,
        (row) => row.hits ?? 0,
        (row) => (row.toi_all_situations ?? 0) / 60
      );
      return { baseline: mu, exposure };
    }
    case "blocks_per_60": {
      const { mu, exposure } = computeBaselinePer60(
        totals,
        (row) => row.blocked_shots ?? 0,
        (row) => (row.toi_all_situations ?? 0) / 60
      );
      return { baseline: mu, exposure };
    }
    case "ipp": {
      const { mu } = computeBaselinePercentage(
        totals,
        (row) => row.points ?? 0,
        (row) => row.nst_oi_gf ?? row.es_goals_for ?? 0
      );
      return { baseline: clamp(mu), exposure: 0 };
    }
    case "sh_pct": {
      const { mu } = computeBaselinePercentage(
        totals,
        (row) => row.goals ?? 0,
        (row) => row.shots ?? 0
      );
      return { baseline: normalizePercentage(mu) ?? 0, exposure: 0 };
    }
    case "on_ice_sh_pct": {
      const { mu } = computeBaselinePercentage(
        totals,
        (row) => row.nst_oi_gf ?? 0,
        (row) => row.nst_oi_sf ?? 0
      );
      return { baseline: normalizePercentage(mu) ?? 0, exposure: 0 };
    }
    case "on_ice_sv_pct": {
      const { mu } = computeBaselinePercentage(
        totals,
        (row) => {
          const sa = row.nst_oi_ga ?? 0;
          const shotsAgainst = row.nst_oi_sa ?? 0;
          return shotsAgainst - sa;
        },
        (row) => row.nst_oi_sa ?? 0
      );
      return { baseline: normalizePercentage(mu) ?? 0, exposure: 0 };
    }
    case "pp_toi_pct": {
      const { mu } = computeBaselineNormal(
        totals,
        (row) => row.pp_toi_pct_of_team ?? 0,
        (row) => row.games_played ?? 0
      );
      return { baseline: mu, exposure: 0 };
    }
    case "pdo":
      return { baseline: 1.0, exposure: 0 };
    case "fantasy_score": {
      if (!totals.length) return { baseline: 0, exposure: 0 };
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
      if (denominator === 0) return { baseline: 0, exposure: 0 };
      return { baseline: numerator / denominator, exposure: 0 };
    }
    default:
      return { baseline: 0, exposure: 0 };
  }
}

function clamp(value: number): number {
  if (Number.isNaN(value)) return 0;
  if (!Number.isFinite(value)) return 0;
  return value;
}

function computeGammaBand(
  spec: MetricSpec,
  samples: GammaSample[],
  baseline: number,
  windowSize: number
): ComputedBand {
  const subset = samples.slice(0, windowSize);
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
  const subset = samples.slice(0, windowSize);
  let weightedSuccess = 0;
  let weightedTrials = 0;
  subset.forEach((sample) => {
    const w = halfLifeWeight(sample.gamesAgo, spec.halfLifeGames);
    weightedSuccess += sample.successes * w;
    weightedTrials += sample.trials * w;
  });
  const ewma = weightedTrials > 0 ? weightedSuccess / weightedTrials : baseline;
  const blend = blendWithPrior({
    ewmaEstimate: ewma,
    baseline,
    nEff: weightedTrials,
    priorStrength: spec.priorStrength
  });
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
    value: blend.value,
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
  const subset = samples.slice(0, windowSize);
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

  metrics.forEach((metric) => {
    const spec = METRIC_SPECS[metric];
    if (!spec) return;

    const baselineInfo = baselineForMetric(metric, totals);
    let baseline = baselineInfo.baseline;
    if (spec.distribution === "beta" || spec.distribution === "gamma") {
      baseline = clamp(baseline);
    }

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
        z_score: null,
        percentile: null,
        exposure: computed.nEff,
        distribution: computed.distribution
      });
    });
  });

  return results;
}
