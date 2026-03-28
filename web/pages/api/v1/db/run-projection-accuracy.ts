import type { NextApiRequest, NextApiResponse } from "next";
import {
  normalizeDependencyError,
  type NormalizedDependencyError
} from "lib/cron/normalizeDependencyError";
import { withCronJobAudit } from "lib/cron/withCronJobAudit";
import { formatDurationMsToMMSS } from "lib/formatDurationMmSs";
import supabase from "lib/supabase/server";
import { requireLatestSucceededRunId } from "pages/api/v1/projections/_helpers";
import { runProjectionPreflightChecks } from "./run-projection-v2";
import {
  computeAccuracyScore,
  computeGoalieFantasyPoints,
  computeSkaterFantasyPoints
} from "lib/projections/accuracy/fantasyPoints";
import { DEFAULT_SKATER_FANTASY_POINTS } from "lib/projectionsConfig/fantasyPointsConfig";

type AccuracyResultRow = {
  as_of_date: string;
  actual_date: string;
  game_id: number | null;
  player_id: number;
  player_type: "skater" | "goalie";
  team_id: number | null;
  opponent_team_id: number | null;
  predicted_fp: number;
  actual_fp: number;
  error_abs: number;
  error_sq: number;
  accuracy: number;
  source_run_id: string;
  created_at: string;
};

type AggregateStats = {
  accuracy_avg: number;
  mae: number;
  rmse: number;
  count: number;
  accuracy_sum: number;
  error_abs_sum: number;
  error_sq_sum: number;
};

type StatAggregate = {
  count: number;
  error_abs_sum: number;
  error_sq_sum: number;
};

type StatAggregateRow = {
  date: string;
  scope: "skater" | "goalie";
  stat_key: string;
  mae: number;
  rmse: number;
  player_count: number;
  error_abs_sum: number;
  error_sq_sum: number;
  updated_at: string;
};

type RollingWindowStats = {
  days: number;
  player_count: number;
  mae: number;
  rmse: number;
};

type SkaterRoleBucketKey =
  | "TOP_LINE"
  | "MIDDLE_SIX"
  | "DEPTH_FORWARD"
  | "DEFENSE_PAIR_1"
  | "DEFENSE_PAIR_2"
  | "DEFENSE_PAIR_3"
  | "PP1"
  | "PP2"
  | "PP_UNIT_DEPTH"
  | "UNKNOWN";

type SkaterRoleBucketDiagnostics = Record<
  SkaterRoleBucketKey,
  Record<
    "g" | "a" | "pts" | "sog" | "ppp",
    { player_count: number; mae: number; rmse: number }
  >
>;

type SkaterRoleBucketIntervalCalibrationDiagnostics = Record<
  SkaterRoleBucketKey,
  Record<
    "g" | "a" | "pts" | "sog" | "ppp",
    { sample_count: number; p10_p90_in_range: number; p10_p90_hit_rate: number }
  >
>;

type SkaterStatDiagnostics = Record<
  "g" | "a" | "pts" | "sog" | "ppp",
  {
    daily: { player_count: number; mae: number; rmse: number };
    rolling_7d: RollingWindowStats;
    rolling_14d: RollingWindowStats;
    rolling_30d: RollingWindowStats;
  }
>;

type SkaterRollingDashboard = {
  generated_for_date: string;
  stat_diagnostics: SkaterStatDiagnostics;
  interval_coverage_daily: IntervalCoverageSummary;
  role_bucket_interval_calibration_daily: SkaterRoleBucketIntervalCalibrationDiagnostics;
  miss_attribution_daily: SkaterComponentMissAttributionDiagnostics;
};

type GoalieStatDiagnostics = Record<
  "saves" | "goals_against" | "win_prob" | "shutout_prob",
  {
    daily: { player_count: number; mae: number; rmse: number };
    rolling_7d: RollingWindowStats;
    rolling_30d: RollingWindowStats;
  }
>;

type CalibrationBinAccumulator = {
  count: number;
  predicted_sum: number;
  observed_sum: number;
};

type CalibrationAccumulator = {
  count: number;
  brier_sum: number;
  bins: CalibrationBinAccumulator[];
};

type ReliabilityBin = {
  bin_index: number;
  bin_start: number;
  bin_end: number;
  sample_count: number;
  avg_predicted: number;
  observed_rate: number;
};

type ProbabilityCalibrationSummary = {
  sample_count: number;
  brier_score: number;
  reliability_bins: ReliabilityBin[];
};

type IntervalCoverageSummary = Record<
  string,
  {
    sample_count: number;
    p10_p90_in_range: number;
    p10_p90_hit_rate: number;
  }
>;

type GoalieMissAttributionDiagnostics = {
  sample_count: number;
  total_abs_fp_error: number;
  total_abs_ga_error: number;
  starter_uncertainty: {
    contribution: number;
    share_of_explainable_error: number;
  };
  shots_against: {
    contribution: number;
    share_of_explainable_error: number;
  };
  save_pct: {
    contribution: number;
    share_of_explainable_error: number;
  };
  primary_driver: "STARTER" | "SHOTS_AGAINST" | "SAVE_PCT" | "MIXED";
};

type SkaterComponentMissAttributionDiagnostics = {
  sample_count: number;
  total_abs_fp_error: number;
  toi_miss: {
    contribution: number;
    share_of_explainable_error: number;
  };
  shot_rate_miss: {
    contribution: number;
    share_of_explainable_error: number;
  };
  conversion_miss: {
    contribution: number;
    share_of_explainable_error: number;
  };
  primary_driver: "TOI" | "SHOT_RATE" | "CONVERSION" | "MIXED";
};

type LaunchGateStatus = "PASS" | "FAIL";

type LaunchGateEvaluation = {
  gate_key: string;
  description: string;
  status: LaunchGateStatus;
  actual_value: number;
  threshold: { operator: "<=" | ">=" | "between"; value: number | [number, number] };
};

type GoalieLaunchGates = {
  window_days: 30;
  generated_for_date: string;
  overall_status: LaunchGateStatus;
  pass_count: number;
  fail_count: number;
  thresholds: Record<string, number | [number, number]>;
  gates: LaunchGateEvaluation[];
};

type CoverageAccumulator = {
  total: number;
  in_range: number;
};

type ErrorStats = {
  count: number;
  error_abs_sum: number;
  error_sq_sum: number;
};

type ProjectionRowForPpBucketing = {
  game_id: number | null;
  team_id: number | null;
  player_id: number | null;
  proj_toi_pp_seconds: number | null;
};

type MetricComparison = {
  sample_count: number;
  model_mae: number;
  model_rmse: number;
  baseline_mae: number;
  baseline_rmse: number;
  mae_delta_vs_baseline: number;
  rmse_delta_vs_baseline: number;
};

const DEFAULT_OFFSET_DAYS = 1;
const DEFAULT_RANGE_BUDGET_MS = 240_000;
const BATCH_SIZE = 800;
const GOALIE_LAUNCH_GATE_THRESHOLDS = {
  min_sample_count_30d: 100,
  saves_mae_max_30d: 4.5,
  goals_against_mae_max_30d: 1.4,
  starter_brier_max_30d: 0.2,
  win_brier_max_30d: 0.22,
  shutout_brier_max_30d: 0.08,
  saves_interval_hit_rate_30d_range: [0.72, 0.9] as [number, number],
  goals_allowed_interval_hit_rate_30d_range: [0.72, 0.9] as [number, number]
} as const;

function isoDateOnly(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function parseNumber(value: string | string[] | undefined): number | null {
  if (!value) return null;
  const v = Array.isArray(value) ? value[0] : value;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function parseDateParam(value: string | string[] | undefined): string | null {
  if (!value) return null;
  const v = Array.isArray(value) ? value[0] : value;
  const trimmed = v.trim();
  return trimmed ? trimmed.slice(0, 10) : null;
}

function parseBooleanParam(value: string | string[] | undefined): boolean {
  if (!value) return false;
  const rawValue = Array.isArray(value) ? value[0] : value;
  const normalized = rawValue.trim().toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "yes";
}

function addDays(dateStr: string, delta: number): string {
  const d = new Date(`${dateStr}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + delta);
  return isoDateOnly(d);
}

function buildDateRange(start: string, end: string): string[] {
  const out: string[] = [];
  const startDate = new Date(`${start}T00:00:00.000Z`);
  const endDate = new Date(`${end}T00:00:00.000Z`);
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime()))
    return out;
  for (let d = startDate; d <= endDate; d.setUTCDate(d.getUTCDate() + 1)) {
    out.push(isoDateOnly(d));
  }
  return out;
}

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    out.push(items.slice(i, i + size));
  }
  return out;
}

function computeAggregate(rows: AccuracyResultRow[]): AggregateStats {
  const count = rows.length;
  if (count === 0) {
    return {
      accuracy_avg: 0,
      mae: 0,
      rmse: 0,
      count: 0,
      accuracy_sum: 0,
      error_abs_sum: 0,
      error_sq_sum: 0
    };
  }
  const accuracy_sum = rows.reduce((acc, r) => acc + r.accuracy, 0);
  const error_abs_sum = rows.reduce((acc, r) => acc + r.error_abs, 0);
  const error_sq_sum = rows.reduce((acc, r) => acc + r.error_sq, 0);
  return {
    accuracy_avg: accuracy_sum / count,
    mae: error_abs_sum / count,
    rmse: Math.sqrt(error_sq_sum / count),
    count,
    accuracy_sum,
    error_abs_sum,
    error_sq_sum
  };
}

function updateStatAggregate(
  map: Map<string, StatAggregate>,
  key: string,
  predicted: number,
  actual: number
) {
  const pred = Number.isFinite(predicted) ? predicted : 0;
  const act = Number.isFinite(actual) ? actual : 0;
  const errorAbs = Math.abs(pred - act);
  const errorSq = Math.pow(pred - act, 2);
  const existing = map.get(key) ?? { count: 0, error_abs_sum: 0, error_sq_sum: 0 };
  existing.count += 1;
  existing.error_abs_sum += errorAbs;
  existing.error_sq_sum += errorSq;
  map.set(key, existing);
}

function initSkaterRoleBucketDiagnosticsMap() {
  return new Map<SkaterRoleBucketKey, Map<string, StatAggregate>>();
}

function getSkaterRoleBucketMap(
  map: Map<SkaterRoleBucketKey, Map<string, StatAggregate>>,
  bucket: SkaterRoleBucketKey
) {
  const existing = map.get(bucket);
  if (existing) return existing;
  const next = new Map<string, StatAggregate>();
  map.set(bucket, next);
  return next;
}

function buildPpUnitBucketByPlayer(rows: ProjectionRowForPpBucketing[]) {
  const out = new Map<string, "PP1" | "PP2" | "PP_UNIT_DEPTH">();
  const grouped = new Map<string, Array<{ playerId: number; ppToi: number }>>();
  for (const row of rows) {
    const gameId = Number(row.game_id);
    const teamId = Number(row.team_id);
    const playerId = Number(row.player_id);
    if (!Number.isFinite(gameId) || !Number.isFinite(teamId) || !Number.isFinite(playerId)) {
      continue;
    }
    const key = `${gameId}:${teamId}`;
    const list = grouped.get(key) ?? [];
    list.push({
      playerId,
      ppToi: Math.max(0, Number(row.proj_toi_pp_seconds ?? 0))
    });
    grouped.set(key, list);
  }
  for (const [groupKey, list] of grouped.entries()) {
    const sorted = list.sort((a, b) => b.ppToi - a.ppToi);
    sorted.forEach((entry, idx) => {
      const bucket = idx < 5 ? "PP1" : idx < 10 ? "PP2" : "PP_UNIT_DEPTH";
      out.set(`${groupKey}:${entry.playerId}`, bucket);
    });
  }
  return out;
}

function inferRoleBuckets(args: {
  uncertainty: any;
  gameId: number;
  teamId: number | null;
  playerId: number;
  ppUnitBucketByPlayer: Map<string, "PP1" | "PP2" | "PP_UNIT_DEPTH">;
}): SkaterRoleBucketKey[] {
  const buckets: SkaterRoleBucketKey[] = [];
  const selection = args?.uncertainty?.model?.skater_selection ?? {};
  const esRole =
    typeof selection.es_role === "string" ? selection.es_role.toUpperCase() : null;
  if (esRole === "L1") buckets.push("TOP_LINE");
  else if (esRole === "L2" || esRole === "L3") buckets.push("MIDDLE_SIX");
  else if (esRole === "L4") buckets.push("DEPTH_FORWARD");
  else if (esRole === "D1") buckets.push("DEFENSE_PAIR_1");
  else if (esRole === "D2") buckets.push("DEFENSE_PAIR_2");
  else if (esRole === "D3") buckets.push("DEFENSE_PAIR_3");

  if (args.teamId != null) {
    const ppBucket =
      args.ppUnitBucketByPlayer.get(`${args.gameId}:${args.teamId}:${args.playerId}`) ?? null;
    if (ppBucket === "PP1" || ppBucket === "PP2" || ppBucket === "PP_UNIT_DEPTH") {
      buckets.push(ppBucket);
    }
  }

  if (buckets.length === 0) buckets.push("UNKNOWN");
  return Array.from(new Set(buckets));
}

function finalizeSkaterRoleBucketDiagnostics(
  map: Map<SkaterRoleBucketKey, Map<string, StatAggregate>>
): SkaterRoleBucketDiagnostics {
  const buckets: SkaterRoleBucketKey[] = [
    "TOP_LINE",
    "MIDDLE_SIX",
    "DEPTH_FORWARD",
    "DEFENSE_PAIR_1",
    "DEFENSE_PAIR_2",
    "DEFENSE_PAIR_3",
    "PP1",
    "PP2",
    "PP_UNIT_DEPTH",
    "UNKNOWN"
  ];
  const statKeys: Array<"g" | "a" | "pts" | "sog" | "ppp"> = [
    "g",
    "a",
    "pts",
    "sog",
    "ppp"
  ];
  const out = {} as SkaterRoleBucketDiagnostics;
  for (const bucket of buckets) {
    const bucketMap = map.get(bucket) ?? new Map<string, StatAggregate>();
    out[bucket] = {
      g: { player_count: 0, mae: 0, rmse: 0 },
      a: { player_count: 0, mae: 0, rmse: 0 },
      pts: { player_count: 0, mae: 0, rmse: 0 },
      sog: { player_count: 0, mae: 0, rmse: 0 },
      ppp: { player_count: 0, mae: 0, rmse: 0 }
    };
    for (const statKey of statKeys) {
      const agg = bucketMap.get(statKey) ?? { count: 0, error_abs_sum: 0, error_sq_sum: 0 };
      out[bucket][statKey] = {
        player_count: agg.count,
        mae: agg.count > 0 ? round4(agg.error_abs_sum / agg.count) : 0,
        rmse: agg.count > 0 ? round4(Math.sqrt(agg.error_sq_sum / agg.count)) : 0
      };
    }
  }
  return out;
}

function initSkaterRoleBucketCoverageMap() {
  return new Map<SkaterRoleBucketKey, Map<string, CoverageAccumulator>>();
}

function getSkaterRoleBucketCoverageStatMap(
  map: Map<SkaterRoleBucketKey, Map<string, CoverageAccumulator>>,
  bucket: SkaterRoleBucketKey
) {
  const existing = map.get(bucket);
  if (existing) return existing;
  const next = new Map<string, CoverageAccumulator>();
  map.set(bucket, next);
  return next;
}

function finalizeSkaterRoleBucketIntervalCalibrationDiagnostics(
  map: Map<SkaterRoleBucketKey, Map<string, CoverageAccumulator>>
): SkaterRoleBucketIntervalCalibrationDiagnostics {
  const buckets: SkaterRoleBucketKey[] = [
    "TOP_LINE",
    "MIDDLE_SIX",
    "DEPTH_FORWARD",
    "DEFENSE_PAIR_1",
    "DEFENSE_PAIR_2",
    "DEFENSE_PAIR_3",
    "PP1",
    "PP2",
    "PP_UNIT_DEPTH",
    "UNKNOWN"
  ];
  const statKeys: Array<"g" | "a" | "pts" | "sog" | "ppp"> = [
    "g",
    "a",
    "pts",
    "sog",
    "ppp"
  ];
  const out = {} as SkaterRoleBucketIntervalCalibrationDiagnostics;
  for (const bucket of buckets) {
    const coverageMap = map.get(bucket) ?? new Map<string, CoverageAccumulator>();
    const bucketCoverage = toIntervalCoverageSummary(finalizeCoverage(coverageMap));
    out[bucket] = {
      g: bucketCoverage.g ?? { sample_count: 0, p10_p90_in_range: 0, p10_p90_hit_rate: 0 },
      a: bucketCoverage.a ?? { sample_count: 0, p10_p90_in_range: 0, p10_p90_hit_rate: 0 },
      pts: bucketCoverage.pts ?? {
        sample_count: 0,
        p10_p90_in_range: 0,
        p10_p90_hit_rate: 0
      },
      sog: bucketCoverage.sog ?? {
        sample_count: 0,
        p10_p90_in_range: 0,
        p10_p90_hit_rate: 0
      },
      ppp: bucketCoverage.ppp ?? {
        sample_count: 0,
        p10_p90_in_range: 0,
        p10_p90_hit_rate: 0
      }
    };
    for (const statKey of statKeys) {
      const statCoverage = out[bucket][statKey];
      out[bucket][statKey] = {
        sample_count: statCoverage.sample_count,
        p10_p90_in_range: statCoverage.p10_p90_in_range,
        p10_p90_hit_rate: round4(statCoverage.p10_p90_hit_rate)
      };
    }
  }
  return out;
}

function finalizeStatAggregates(
  map: Map<string, StatAggregate>,
  date: string,
  scope: "skater" | "goalie"
): StatAggregateRow[] {
  return Array.from(map.entries()).map(([statKey, agg]) => {
    const mae = agg.count > 0 ? agg.error_abs_sum / agg.count : 0;
    const rmse = agg.count > 0 ? Math.sqrt(agg.error_sq_sum / agg.count) : 0;
    return {
      date,
      scope,
      stat_key: statKey,
      mae,
      rmse,
      player_count: agg.count,
      error_abs_sum: agg.error_abs_sum,
      error_sq_sum: agg.error_sq_sum,
      updated_at: new Date().toISOString()
    };
  });
}

function updateCoverage(
  map: Map<string, CoverageAccumulator>,
  statKey: string,
  actual: number,
  interval: { p10?: number; p90?: number } | null | undefined
) {
  if (!interval) return;
  const p10 = interval.p10;
  const p90 = interval.p90;
  if (!Number.isFinite(actual) || !Number.isFinite(p10) || !Number.isFinite(p90)) return;
  const existing = map.get(statKey) ?? { total: 0, in_range: 0 };
  existing.total += 1;
  if (actual >= (p10 as number) && actual <= (p90 as number)) {
    existing.in_range += 1;
  }
  map.set(statKey, existing);
}

function finalizeCoverage(map: Map<string, CoverageAccumulator>) {
  const out: Record<string, { total: number; in_range: number; coverage: number }> = {};
  for (const [key, value] of map.entries()) {
    out[key] = {
      total: value.total,
      in_range: value.in_range,
      coverage: value.total > 0 ? value.in_range / value.total : 0
    };
  }
  return out;
}

function toIntervalCoverageSummary(
  coverage: Record<string, { total: number; in_range: number; coverage: number }>
): IntervalCoverageSummary {
  const out: IntervalCoverageSummary = {};
  for (const [key, value] of Object.entries(coverage)) {
    out[key] = {
      sample_count: value.total,
      p10_p90_in_range: value.in_range,
      p10_p90_hit_rate: round4(value.coverage)
    };
  }
  return out;
}

function initMissAttributionAccumulator() {
  return {
    sampleCount: 0,
    totalAbsFpError: 0,
    totalAbsGaError: 0,
    starterContribution: 0,
    shotsAgainstContribution: 0,
    savePctContribution: 0
  };
}

function finalizeMissAttributionDiagnostics(acc: {
  sampleCount: number;
  totalAbsFpError: number;
  totalAbsGaError: number;
  starterContribution: number;
  shotsAgainstContribution: number;
  savePctContribution: number;
}): GoalieMissAttributionDiagnostics {
  const explainable =
    acc.starterContribution + acc.shotsAgainstContribution + acc.savePctContribution;
  const starterShare = explainable > 0 ? acc.starterContribution / explainable : 0;
  const saShare = explainable > 0 ? acc.shotsAgainstContribution / explainable : 0;
  const svShare = explainable > 0 ? acc.savePctContribution / explainable : 0;
  const top = Math.max(starterShare, saShare, svShare);
  const countTop = [starterShare, saShare, svShare].filter((v) => top - v < 0.05).length;
  const primary =
    countTop > 1
      ? "MIXED"
      : top === starterShare
        ? "STARTER"
        : top === saShare
          ? "SHOTS_AGAINST"
          : "SAVE_PCT";

  return {
    sample_count: acc.sampleCount,
    total_abs_fp_error: round4(acc.totalAbsFpError),
    total_abs_ga_error: round4(acc.totalAbsGaError),
    starter_uncertainty: {
      contribution: round4(acc.starterContribution),
      share_of_explainable_error: round4(starterShare)
    },
    shots_against: {
      contribution: round4(acc.shotsAgainstContribution),
      share_of_explainable_error: round4(saShare)
    },
    save_pct: {
      contribution: round4(acc.savePctContribution),
      share_of_explainable_error: round4(svShare)
    },
    primary_driver: primary
  };
}

function initSkaterMissAttributionAccumulator() {
  return {
    sampleCount: 0,
    totalAbsFpError: 0,
    toiContribution: 0,
    shotRateContribution: 0,
    conversionContribution: 0
  };
}

function finalizeSkaterMissAttributionDiagnostics(acc: {
  sampleCount: number;
  totalAbsFpError: number;
  toiContribution: number;
  shotRateContribution: number;
  conversionContribution: number;
}): SkaterComponentMissAttributionDiagnostics {
  const explainable =
    acc.toiContribution + acc.shotRateContribution + acc.conversionContribution;
  const toiShare = explainable > 0 ? acc.toiContribution / explainable : 0;
  const shotRateShare = explainable > 0 ? acc.shotRateContribution / explainable : 0;
  const conversionShare = explainable > 0 ? acc.conversionContribution / explainable : 0;
  const top = Math.max(toiShare, shotRateShare, conversionShare);
  const tied = [toiShare, shotRateShare, conversionShare].filter((v) => top - v < 0.05).length;
  const primary =
    tied > 1
      ? "MIXED"
      : top === toiShare
        ? "TOI"
        : top === shotRateShare
          ? "SHOT_RATE"
          : "CONVERSION";

  return {
    sample_count: acc.sampleCount,
    total_abs_fp_error: round4(acc.totalAbsFpError),
    toi_miss: {
      contribution: round4(acc.toiContribution),
      share_of_explainable_error: round4(toiShare)
    },
    shot_rate_miss: {
      contribution: round4(acc.shotRateContribution),
      share_of_explainable_error: round4(shotRateShare)
    },
    conversion_miss: {
      contribution: round4(acc.conversionContribution),
      share_of_explainable_error: round4(conversionShare)
    },
    primary_driver: primary
  };
}

function buildGoalieLaunchGates(args: {
  actualDate: string;
  goalieStatDiagnostics: GoalieStatDiagnostics;
  goalieProbabilityCalibration: {
    starter_probability: ProbabilityCalibrationSummary;
    win_probability: ProbabilityCalibrationSummary;
    shutout_probability: ProbabilityCalibrationSummary;
  };
  goalieIntervalCoverageDiagnostics: IntervalCoverageSummary;
}): GoalieLaunchGates {
  const t = GOALIE_LAUNCH_GATE_THRESHOLDS;
  const evaluations: LaunchGateEvaluation[] = [];
  const addGate = (gate: LaunchGateEvaluation) => evaluations.push(gate);

  const sampleCount = args.goalieStatDiagnostics.saves.rolling_30d.player_count;
  addGate({
    gate_key: "min_sample_count_30d",
    description: "Minimum goalie sample in last 30 days",
    status: sampleCount >= t.min_sample_count_30d ? "PASS" : "FAIL",
    actual_value: sampleCount,
    threshold: { operator: ">=", value: t.min_sample_count_30d }
  });

  const savesMae30 = args.goalieStatDiagnostics.saves.rolling_30d.mae;
  addGate({
    gate_key: "saves_mae_max_30d",
    description: "30d MAE on goalie saves projection",
    status: savesMae30 <= t.saves_mae_max_30d ? "PASS" : "FAIL",
    actual_value: savesMae30,
    threshold: { operator: "<=", value: t.saves_mae_max_30d }
  });

  const gaMae30 = args.goalieStatDiagnostics.goals_against.rolling_30d.mae;
  addGate({
    gate_key: "goals_against_mae_max_30d",
    description: "30d MAE on goalie goals-against projection",
    status: gaMae30 <= t.goals_against_mae_max_30d ? "PASS" : "FAIL",
    actual_value: gaMae30,
    threshold: { operator: "<=", value: t.goals_against_mae_max_30d }
  });

  const starterBrier = args.goalieProbabilityCalibration.starter_probability.brier_score;
  addGate({
    gate_key: "starter_brier_max_30d",
    description: "Starter probability Brier score over 30d window",
    status: starterBrier <= t.starter_brier_max_30d ? "PASS" : "FAIL",
    actual_value: starterBrier,
    threshold: { operator: "<=", value: t.starter_brier_max_30d }
  });

  const winBrier = args.goalieProbabilityCalibration.win_probability.brier_score;
  addGate({
    gate_key: "win_brier_max_30d",
    description: "Win probability Brier score over 30d window",
    status: winBrier <= t.win_brier_max_30d ? "PASS" : "FAIL",
    actual_value: winBrier,
    threshold: { operator: "<=", value: t.win_brier_max_30d }
  });

  const shutoutBrier = args.goalieProbabilityCalibration.shutout_probability.brier_score;
  addGate({
    gate_key: "shutout_brier_max_30d",
    description: "Shutout probability Brier score over 30d window",
    status: shutoutBrier <= t.shutout_brier_max_30d ? "PASS" : "FAIL",
    actual_value: shutoutBrier,
    threshold: { operator: "<=", value: t.shutout_brier_max_30d }
  });

  const savesCoverage = args.goalieIntervalCoverageDiagnostics.saves?.p10_p90_hit_rate ?? 0;
  addGate({
    gate_key: "saves_interval_hit_rate_30d_range",
    description: "P10/P90 interval hit-rate for saves in acceptable calibration band",
    status:
      savesCoverage >= t.saves_interval_hit_rate_30d_range[0] &&
      savesCoverage <= t.saves_interval_hit_rate_30d_range[1]
        ? "PASS"
        : "FAIL",
    actual_value: savesCoverage,
    threshold: { operator: "between", value: t.saves_interval_hit_rate_30d_range }
  });

  const goalsCoverage =
    args.goalieIntervalCoverageDiagnostics.goals_allowed?.p10_p90_hit_rate ?? 0;
  addGate({
    gate_key: "goals_allowed_interval_hit_rate_30d_range",
    description:
      "P10/P90 interval hit-rate for goals allowed in acceptable calibration band",
    status:
      goalsCoverage >= t.goals_allowed_interval_hit_rate_30d_range[0] &&
      goalsCoverage <= t.goals_allowed_interval_hit_rate_30d_range[1]
        ? "PASS"
        : "FAIL",
    actual_value: goalsCoverage,
    threshold: { operator: "between", value: t.goals_allowed_interval_hit_rate_30d_range }
  });

  const passCount = evaluations.filter((g) => g.status === "PASS").length;
  const failCount = evaluations.length - passCount;
  return {
    window_days: 30,
    generated_for_date: args.actualDate,
    overall_status: failCount === 0 ? "PASS" : "FAIL",
    pass_count: passCount,
    fail_count: failCount,
    thresholds: {
      ...t
    },
    gates: evaluations
  };
}

function initErrorStats(): ErrorStats {
  return {
    count: 0,
    error_abs_sum: 0,
    error_sq_sum: 0
  };
}

function updateErrorStats(stats: ErrorStats, predicted: number, actual: number) {
  const p = Number.isFinite(predicted) ? predicted : 0;
  const a = Number.isFinite(actual) ? actual : 0;
  const err = p - a;
  stats.count += 1;
  stats.error_abs_sum += Math.abs(err);
  stats.error_sq_sum += err * err;
}

function finalizeMetricComparison(
  model: ErrorStats,
  baseline: ErrorStats
): MetricComparison {
  const modelCount = Math.max(1, model.count);
  const baselineCount = Math.max(1, baseline.count);
  const modelMae = model.error_abs_sum / modelCount;
  const modelRmse = Math.sqrt(model.error_sq_sum / modelCount);
  const baselineMae = baseline.error_abs_sum / baselineCount;
  const baselineRmse = Math.sqrt(baseline.error_sq_sum / baselineCount);
  return {
    sample_count: Math.min(model.count, baseline.count),
    model_mae: Number(modelMae.toFixed(4)),
    model_rmse: Number(modelRmse.toFixed(4)),
    baseline_mae: Number(baselineMae.toFixed(4)),
    baseline_rmse: Number(baselineRmse.toFixed(4)),
    mae_delta_vs_baseline: Number((modelMae - baselineMae).toFixed(4)),
    rmse_delta_vs_baseline: Number((modelRmse - baselineRmse).toFixed(4))
  };
}

function round4(n: number): number {
  return Number(n.toFixed(4));
}

function initRollingWindow(days: number): RollingWindowStats {
  return {
    days,
    player_count: 0,
    mae: 0,
    rmse: 0
  };
}

function aggregateRollingWindow(
  rows: Array<{
    error_abs_sum: number | null;
    error_sq_sum: number | null;
    player_count: number | null;
  }>,
  days: number
): RollingWindowStats {
  let count = 0;
  let errAbs = 0;
  let errSq = 0;
  for (const row of rows) {
    const c = Math.max(0, Number(row.player_count ?? 0));
    const abs = Math.max(0, Number(row.error_abs_sum ?? 0));
    const sq = Math.max(0, Number(row.error_sq_sum ?? 0));
    count += c;
    errAbs += abs;
    errSq += sq;
  }
  if (count <= 0) return initRollingWindow(days);
  return {
    days,
    player_count: count,
    mae: round4(errAbs / count),
    rmse: round4(Math.sqrt(errSq / count))
  };
}

function initCalibrationAccumulator(binCount = 10): CalibrationAccumulator {
  return {
    count: 0,
    brier_sum: 0,
    bins: Array.from({ length: binCount }, () => ({
      count: 0,
      predicted_sum: 0,
      observed_sum: 0
    }))
  };
}

function updateCalibrationAccumulator(
  acc: CalibrationAccumulator,
  predicted: number,
  observed: number
) {
  const p = Math.max(0, Math.min(1, Number.isFinite(predicted) ? predicted : 0));
  const o = Math.max(0, Math.min(1, Number.isFinite(observed) ? observed : 0));
  acc.count += 1;
  acc.brier_sum += (p - o) ** 2;

  const binCount = acc.bins.length;
  const rawIdx = Math.floor(p * binCount);
  const idx = Math.max(0, Math.min(binCount - 1, rawIdx));
  const bin = acc.bins[idx];
  bin.count += 1;
  bin.predicted_sum += p;
  bin.observed_sum += o;
}

function finalizeCalibrationAccumulator(
  acc: CalibrationAccumulator
): ProbabilityCalibrationSummary {
  const binCount = acc.bins.length;
  return {
    sample_count: acc.count,
    brier_score: acc.count > 0 ? round4(acc.brier_sum / acc.count) : 0,
    reliability_bins: acc.bins.map((bin, idx) => {
      const binStart = idx / binCount;
      const binEnd = (idx + 1) / binCount;
      return {
        bin_index: idx,
        bin_start: round4(binStart),
        bin_end: round4(binEnd),
        sample_count: bin.count,
        avg_predicted:
          bin.count > 0 ? round4(bin.predicted_sum / bin.count) : 0,
        observed_rate:
          bin.count > 0 ? round4(bin.observed_sum / bin.count) : 0
      };
    })
  };
}

async function fetchGoalieStatDiagnostics(
  actualDate: string,
  dailyGoalieStatRows: StatAggregateRow[]
): Promise<GoalieStatDiagnostics> {
  const statKeyByDiagnosticKey = {
    saves: "saves",
    goals_against: "goals_against",
    win_prob: "win_prob",
    shutout_prob: "shutout_prob"
  } as const;
  const diagnostics = {
    saves: {
      daily: { player_count: 0, mae: 0, rmse: 0 },
      rolling_7d: initRollingWindow(7),
      rolling_30d: initRollingWindow(30)
    },
    goals_against: {
      daily: { player_count: 0, mae: 0, rmse: 0 },
      rolling_7d: initRollingWindow(7),
      rolling_30d: initRollingWindow(30)
    },
    win_prob: {
      daily: { player_count: 0, mae: 0, rmse: 0 },
      rolling_7d: initRollingWindow(7),
      rolling_30d: initRollingWindow(30)
    },
    shutout_prob: {
      daily: { player_count: 0, mae: 0, rmse: 0 },
      rolling_7d: initRollingWindow(7),
      rolling_30d: initRollingWindow(30)
    }
  } satisfies GoalieStatDiagnostics;

  for (const [diagnosticKey, statKey] of Object.entries(statKeyByDiagnosticKey) as Array<
    [keyof GoalieStatDiagnostics, string]
  >) {
    const dailyRow = dailyGoalieStatRows.find((r) => r.stat_key === statKey);
    diagnostics[diagnosticKey].daily = {
      player_count: Math.max(0, Number(dailyRow?.player_count ?? 0)),
      mae: round4(Number(dailyRow?.mae ?? 0)),
      rmse: round4(Number(dailyRow?.rmse ?? 0))
    };
  }

  if (!supabase) return diagnostics;

  const statKeys = Object.values(statKeyByDiagnosticKey);
  const windowStart30d = addDays(actualDate, -29);
  const { data, error } = await supabase
    .from("forge_projection_accuracy_stat_daily")
    .select("date,stat_key,error_abs_sum,error_sq_sum,player_count")
    .eq("scope", "goalie")
    .in("stat_key", statKeys)
    .gte("date", windowStart30d)
    .lte("date", actualDate)
    .order("date", { ascending: false });
  if (error) throw error;

  const rows = (data ?? []) as Array<{
    date: string | null;
    stat_key: string | null;
    error_abs_sum: number | null;
    error_sq_sum: number | null;
    player_count: number | null;
  }>;

  for (const [diagnosticKey, statKey] of Object.entries(statKeyByDiagnosticKey) as Array<
    [keyof GoalieStatDiagnostics, string]
  >) {
    const statRows = rows.filter((r) => r.stat_key === statKey);
    const rows7d = statRows.filter((r) => {
      const d = r.date;
      if (!d) return false;
      return d >= addDays(actualDate, -6) && d <= actualDate;
    });
    diagnostics[diagnosticKey].rolling_7d = aggregateRollingWindow(rows7d, 7);
    diagnostics[diagnosticKey].rolling_30d = aggregateRollingWindow(statRows, 30);
  }

  return diagnostics;
}

async function fetchSkaterStatDiagnostics(
  actualDate: string,
  dailySkaterStatRows: StatAggregateRow[]
): Promise<SkaterStatDiagnostics> {
  const statKeyByDiagnosticKey = {
    g: "goals",
    a: "assists",
    pts: "points",
    sog: "shots",
    ppp: "pp_points"
  } as const;
  const diagnostics = {
    g: {
      daily: { player_count: 0, mae: 0, rmse: 0 },
      rolling_7d: initRollingWindow(7),
      rolling_14d: initRollingWindow(14),
      rolling_30d: initRollingWindow(30)
    },
    a: {
      daily: { player_count: 0, mae: 0, rmse: 0 },
      rolling_7d: initRollingWindow(7),
      rolling_14d: initRollingWindow(14),
      rolling_30d: initRollingWindow(30)
    },
    pts: {
      daily: { player_count: 0, mae: 0, rmse: 0 },
      rolling_7d: initRollingWindow(7),
      rolling_14d: initRollingWindow(14),
      rolling_30d: initRollingWindow(30)
    },
    sog: {
      daily: { player_count: 0, mae: 0, rmse: 0 },
      rolling_7d: initRollingWindow(7),
      rolling_14d: initRollingWindow(14),
      rolling_30d: initRollingWindow(30)
    },
    ppp: {
      daily: { player_count: 0, mae: 0, rmse: 0 },
      rolling_7d: initRollingWindow(7),
      rolling_14d: initRollingWindow(14),
      rolling_30d: initRollingWindow(30)
    }
  } satisfies SkaterStatDiagnostics;

  for (const [diagnosticKey, statKey] of Object.entries(statKeyByDiagnosticKey) as Array<
    [keyof SkaterStatDiagnostics, string]
  >) {
    const dailyRow = dailySkaterStatRows.find((r) => r.stat_key === statKey);
    diagnostics[diagnosticKey].daily = {
      player_count: Math.max(0, Number(dailyRow?.player_count ?? 0)),
      mae: round4(Number(dailyRow?.mae ?? 0)),
      rmse: round4(Number(dailyRow?.rmse ?? 0))
    };
  }

  if (!supabase) return diagnostics;

  const statKeys = Object.values(statKeyByDiagnosticKey);
  const windowStart30d = addDays(actualDate, -29);
  const { data, error } = await supabase
    .from("forge_projection_accuracy_stat_daily")
    .select("date,stat_key,error_abs_sum,error_sq_sum,player_count")
    .eq("scope", "skater")
    .in("stat_key", statKeys)
    .gte("date", windowStart30d)
    .lte("date", actualDate)
    .order("date", { ascending: false });
  if (error) throw error;

  const rows = (data ?? []) as Array<{
    date: string | null;
    stat_key: string | null;
    error_abs_sum: number | null;
    error_sq_sum: number | null;
    player_count: number | null;
  }>;

  for (const [diagnosticKey, statKey] of Object.entries(statKeyByDiagnosticKey) as Array<
    [keyof SkaterStatDiagnostics, string]
  >) {
    const statRows = rows.filter((r) => r.stat_key === statKey);
    const rows7d = statRows.filter((r) => {
      const d = r.date;
      if (!d) return false;
      return d >= addDays(actualDate, -6) && d <= actualDate;
    });
    const rows14d = statRows.filter((r) => {
      const d = r.date;
      if (!d) return false;
      return d >= addDays(actualDate, -13) && d <= actualDate;
    });
    diagnostics[diagnosticKey].rolling_7d = aggregateRollingWindow(rows7d, 7);
    diagnostics[diagnosticKey].rolling_14d = aggregateRollingWindow(rows14d, 14);
    diagnostics[diagnosticKey].rolling_30d = aggregateRollingWindow(statRows, 30);
  }

  return diagnostics;
}

async function updateRunCalibrationMetrics(
  runId: string,
  actualDate: string,
  calibration: Record<string, any>
) {
  if (!supabase) return;
  const { data, error } = await supabase
    .from("forge_runs")
    .select("metrics")
    .eq("run_id", runId)
    .maybeSingle();
  if (error) throw error;
  const metrics = (data as any)?.metrics ?? {};
  const existing = metrics.accuracy_calibration ?? {};
  const updated = {
    ...metrics,
    accuracy_calibration: {
      ...existing,
      [actualDate]: {
        ...calibration,
        updated_at: new Date().toISOString()
      }
    }
  };
  const { error: updateErr } = await supabase
    .from("forge_runs")
    .update({ metrics: updated, updated_at: new Date().toISOString() })
    .eq("run_id", runId);
  if (updateErr) throw updateErr;
}

async function persistGoalieCalibrationSnapshots(args: {
  runId: string;
  actualDate: string;
  projectionDate: string;
  skaterRoleBucketDiagnostics: SkaterRoleBucketDiagnostics;
  skaterRoleBucketIntervalCalibrationDiagnostics: SkaterRoleBucketIntervalCalibrationDiagnostics;
  skaterMissAttributionDiagnostics: SkaterComponentMissAttributionDiagnostics;
  skaterRollingDashboard: SkaterRollingDashboard;
  goalieStatDiagnostics: GoalieStatDiagnostics;
  goalieProbabilityCalibration: {
    starter_probability: ProbabilityCalibrationSummary;
    win_probability: ProbabilityCalibrationSummary;
    shutout_probability: ProbabilityCalibrationSummary;
  };
  goalieIntervalCoverageDiagnostics: IntervalCoverageSummary;
  goalieMissAttributionDiagnostics: GoalieMissAttributionDiagnostics;
  goalieLaunchGates: GoalieLaunchGates;
}) {
  if (!supabase) return;
  const rows = [
    {
      date: args.actualDate,
      projection_date: args.projectionDate,
      scope: "skater_role_bucket_diagnostics",
      source_run_id: args.runId,
      metrics: args.skaterRoleBucketDiagnostics,
      updated_at: new Date().toISOString()
    },
    {
      date: args.actualDate,
      projection_date: args.projectionDate,
      scope: "skater_miss_attribution",
      source_run_id: args.runId,
      metrics: args.skaterMissAttributionDiagnostics,
      updated_at: new Date().toISOString()
    },
    {
      date: args.actualDate,
      projection_date: args.projectionDate,
      scope: "skater_role_bucket_interval_calibration",
      source_run_id: args.runId,
      metrics: args.skaterRoleBucketIntervalCalibrationDiagnostics,
      updated_at: new Date().toISOString()
    },
    {
      date: args.actualDate,
      projection_date: args.projectionDate,
      scope: "skater_rolling_dashboard",
      source_run_id: args.runId,
      metrics: args.skaterRollingDashboard,
      updated_at: new Date().toISOString()
    },
    {
      date: args.actualDate,
      projection_date: args.projectionDate,
      scope: "goalie_probability_calibration",
      source_run_id: args.runId,
      metrics: args.goalieProbabilityCalibration,
      updated_at: new Date().toISOString()
    },
    {
      date: args.actualDate,
      projection_date: args.projectionDate,
      scope: "goalie_interval_coverage",
      source_run_id: args.runId,
      metrics: args.goalieIntervalCoverageDiagnostics,
      updated_at: new Date().toISOString()
    },
    {
      date: args.actualDate,
      projection_date: args.projectionDate,
      scope: "goalie_stat_diagnostics",
      source_run_id: args.runId,
      metrics: args.goalieStatDiagnostics,
      updated_at: new Date().toISOString()
    },
    {
      date: args.actualDate,
      projection_date: args.projectionDate,
      scope: "goalie_calibration_summary",
      source_run_id: args.runId,
      metrics: {
        probability: args.goalieProbabilityCalibration,
        intervals: args.goalieIntervalCoverageDiagnostics,
        stats: args.goalieStatDiagnostics,
        miss_attribution: args.goalieMissAttributionDiagnostics
      },
      updated_at: new Date().toISOString()
    },
    {
      date: args.actualDate,
      projection_date: args.projectionDate,
      scope: "goalie_miss_attribution",
      source_run_id: args.runId,
      metrics: args.goalieMissAttributionDiagnostics,
      updated_at: new Date().toISOString()
    },
    {
      date: args.actualDate,
      projection_date: args.projectionDate,
      scope: "goalie_launch_gates",
      source_run_id: args.runId,
      metrics: args.goalieLaunchGates,
      updated_at: new Date().toISOString()
    }
  ];
  const { error } = await (supabase as any)
    .from("forge_projection_calibration_daily")
    .upsert(rows, { onConflict: "date,scope" });
  if (error) throw error;
}

async function fetchGameDates(gameIds: number[]): Promise<Map<number, string>> {
  if (!supabase || gameIds.length === 0) return new Map();
  const dateByGameId = new Map<number, string>();
  for (const batch of chunk(gameIds, BATCH_SIZE)) {
    const { data, error } = await supabase
      .from("games")
      .select("id,date")
      .in("id", batch);
    if (error) throw error;
    for (const row of data ?? []) {
      const id = (row as any).id as number;
      const date = (row as any).date as string;
      if (id != null && date) dateByGameId.set(id, date);
    }
  }
  return dateByGameId;
}

async function fetchSkaterActualsByPlayerDate(opts: {
  actualDate: string;
  playerIds: number[];
}): Promise<Map<string, any>> {
  const map = new Map<string, any>();
  if (!supabase || opts.playerIds.length === 0) return map;
  for (const batch of chunk(opts.playerIds, BATCH_SIZE)) {
    const { data, error } = await supabase
      .from("wgo_skater_stats")
      .select(
        "game_id,player_id,goals,assists,pp_points,shots,hits,blocked_shots,date,toi_per_game,ev_time_on_ice,pp_toi,sh_time_on_ice"
      )
      .eq("date", opts.actualDate)
      .in("player_id", batch);
    if (error) throw error;
    for (const row of data ?? []) {
      const gameId = (row as any).game_id as number | null;
      const playerId = (row as any).player_id as number | null;
      if (gameId == null || playerId == null) continue;
      map.set(`${gameId}:${playerId}`, row);
    }
  }
  return map;
}

async function fetchGoalieActualsByDate(
  actualDate: string,
  goalieIds: number[]
): Promise<Map<number, any>> {
  const map = new Map<number, any>();
  if (!supabase || goalieIds.length === 0) return map;
  for (const batch of chunk(goalieIds, BATCH_SIZE)) {
    const { data, error } = await supabase
      .from("goalie_stats_unified")
      .select("player_id,goals_against,saves,wins,shutouts,date")
      .eq("date", actualDate)
      .in("player_id", batch);
    if (error) throw error;
    for (const row of data ?? []) {
      const playerId = (row as any).player_id as number | null;
      if (playerId == null) continue;
      map.set(playerId, row);
    }
  }
  return map;
}

async function fetchGoalieActualsFallbackByDate(
  actualDate: string,
  goalieIds: number[]
): Promise<Map<number, any>> {
  const map = new Map<number, any>();
  if (!supabase || goalieIds.length === 0) return map;
  for (const batch of chunk(goalieIds, BATCH_SIZE)) {
    const { data, error } = await supabase
      .from("forge_goalie_game")
      .select("goalie_id,goals_allowed,saves,game_date")
      .eq("game_date", actualDate)
      .in("goalie_id", batch);
    if (error) throw error;
    for (const row of data ?? []) {
      const goalieId = (row as any).goalie_id as number | null;
      if (goalieId == null) continue;
      map.set(goalieId, row);
    }
  }
  return map;
}

async function fetchGoalieActualCount(actualDate: string): Promise<number> {
  if (!supabase) return 0;
  const { count, error } = await supabase
    .from("goalie_stats_unified")
    .select("player_id", { count: "exact", head: true })
    .eq("date", actualDate);
  if (error) throw error;
  return count ?? 0;
}

async function fetchLatestRunningTotals(scope: string, actualDate: string) {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("forge_projection_accuracy_daily")
    .select(
      "running_accuracy_sum,running_error_abs_sum,running_error_sq_sum,running_player_count"
    )
    .eq("scope", scope)
    .lt("date", actualDate)
    .order("date", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return (data as any) ?? null;
}

async function runAccuracyForDate(
  actualDate: string,
  offsetDays: number
): Promise<{
  asOfDate: string;
  actualDate: string;
  runId: string;
  skaterRows: number;
  goalieRows: number;
  totalRows: number;
  goalieMatchDiagnostics: {
    goalieProjectionCount: number;
    goalieActualCount: number;
    goalieMatchedByPlayer: number;
    goalieActualFallbackCount: number;
  };
  goalieHoldoutComparison: {
    baseline_definition: string;
    saves: MetricComparison;
    goals_against: MetricComparison;
  };
  goalieStatDiagnostics: GoalieStatDiagnostics;
  goalieProbabilityCalibration: {
    starter_probability: ProbabilityCalibrationSummary;
    win_probability: ProbabilityCalibrationSummary;
    shutout_probability: ProbabilityCalibrationSummary;
  };
  goalieIntervalCoverageDiagnostics: IntervalCoverageSummary;
  goalieMissAttributionDiagnostics: GoalieMissAttributionDiagnostics;
  goalieLaunchGates: GoalieLaunchGates;
  skaterRoleBucketDiagnostics: SkaterRoleBucketDiagnostics;
  skaterRoleBucketIntervalCalibrationDiagnostics: SkaterRoleBucketIntervalCalibrationDiagnostics;
  skaterMissAttributionDiagnostics: SkaterComponentMissAttributionDiagnostics;
  skaterRollingDashboard: SkaterRollingDashboard;
  durationMs: string;
}> {
  const startedAt = Date.now();
  const projectionDate = addDays(actualDate, -offsetDays);
  const runId = await requireLatestSucceededRunId(projectionDate);
  const { data: projections, error: projErr } = await supabase
    .from("forge_player_projections")
    .select(
      "game_id,player_id,team_id,opponent_team_id,proj_goals_es,proj_goals_pp,proj_goals_pk,proj_assists_es,proj_assists_pp,proj_assists_pk,proj_shots_es,proj_shots_pp,proj_shots_pk,proj_toi_es_seconds,proj_toi_pp_seconds,proj_toi_pk_seconds,proj_hits,proj_blocks,uncertainty"
    )
    .eq("run_id", runId)
    .eq("as_of_date", projectionDate)
    .eq("horizon_games", 1);
  if (projErr) throw projErr;

  const playerProjections = (projections ?? []) as any[];
  const gameIds = Array.from(
    new Set(
      playerProjections
        .map((p) => Number(p.game_id))
        .filter((n) => Number.isFinite(n))
    )
  );
  const gameDatesById = await fetchGameDates(gameIds);
  const validGameIds = new Set(
    Array.from(gameDatesById.entries())
      .filter(([, date]) => date === actualDate)
      .map(([id]) => id)
  );
  const projectedPlayerIds = Array.from(
    new Set(
      playerProjections
        .map((p) => Number(p.player_id))
        .filter((n) => Number.isFinite(n))
    )
  );
  const skaterActuals = await fetchSkaterActualsByPlayerDate({
    actualDate,
    playerIds: projectedPlayerIds
  });

  const skaterResults: AccuracyResultRow[] = [];
  const skaterStatAggregates = new Map<string, StatAggregate>();
  const skaterRoleBucketAggregates = initSkaterRoleBucketDiagnosticsMap();
  const skaterCoverage = new Map<string, CoverageAccumulator>();
  const skaterMissAttribution = initSkaterMissAttributionAccumulator();
  const skaterRoleBucketCoverage = initSkaterRoleBucketCoverageMap();
  const ppUnitBucketByPlayer = buildPpUnitBucketByPlayer(
    playerProjections as ProjectionRowForPpBucketing[]
  );
  for (const row of playerProjections) {
    const gameId = Number(row.game_id);
    if (!validGameIds.has(gameId)) continue;
    const playerId = Number(row.player_id);
    if (!Number.isFinite(playerId)) continue;

    const actual = skaterActuals.get(`${gameId}:${playerId}`);
    if (!actual) continue;

    const predictedGoals =
      (row.proj_goals_es ?? 0) +
      (row.proj_goals_pp ?? 0) +
      (row.proj_goals_pk ?? 0);
    const predictedAssists =
      (row.proj_assists_es ?? 0) +
      (row.proj_assists_pp ?? 0) +
      (row.proj_assists_pk ?? 0);
    const predictedShots =
      (row.proj_shots_es ?? 0) +
      (row.proj_shots_pp ?? 0) +
      (row.proj_shots_pk ?? 0);
    const predictedHits = row.proj_hits ?? 0;
    const predictedBlocks = row.proj_blocks ?? 0;

    updateStatAggregate(
      skaterStatAggregates,
      "goals",
      predictedGoals,
      actual.goals ?? 0
    );
    updateStatAggregate(
      skaterStatAggregates,
      "assists",
      predictedAssists,
      actual.assists ?? 0
    );
    updateStatAggregate(
      skaterStatAggregates,
      "points",
      predictedGoals + predictedAssists,
      (actual.goals ?? 0) + (actual.assists ?? 0)
    );
    updateStatAggregate(
      skaterStatAggregates,
      "pp_points",
      (row.proj_goals_pp ?? 0) + (row.proj_assists_pp ?? 0),
      actual.pp_points ?? 0
    );
    updateStatAggregate(
      skaterStatAggregates,
      "shots",
      predictedShots,
      actual.shots ?? 0
    );
    updateStatAggregate(
      skaterStatAggregates,
      "hits",
      predictedHits,
      actual.hits ?? 0
    );
    updateStatAggregate(
      skaterStatAggregates,
      "blocks",
      predictedBlocks,
      actual.blocked_shots ?? 0
    );
    const roleBuckets = inferRoleBuckets({
      uncertainty: row.uncertainty,
      gameId,
      teamId: Number.isFinite(row.team_id) ? Number(row.team_id) : null,
      playerId,
      ppUnitBucketByPlayer
    });
    const roleBucketStats = [
      { key: "g", predicted: predictedGoals, actual: actual.goals ?? 0 },
      { key: "a", predicted: predictedAssists, actual: actual.assists ?? 0 },
      {
        key: "pts",
        predicted: predictedGoals + predictedAssists,
        actual: (actual.goals ?? 0) + (actual.assists ?? 0)
      },
      { key: "sog", predicted: predictedShots, actual: actual.shots ?? 0 },
      {
        key: "ppp",
        predicted: (row.proj_goals_pp ?? 0) + (row.proj_assists_pp ?? 0),
        actual: actual.pp_points ?? 0
      }
    ];
    for (const bucket of roleBuckets) {
      const bucketMap = getSkaterRoleBucketMap(skaterRoleBucketAggregates, bucket);
      for (const stat of roleBucketStats) {
        updateStatAggregate(bucketMap, stat.key, stat.predicted, stat.actual);
      }
    }

    const skaterUncertainty = row.uncertainty ?? {};
    updateCoverage(skaterCoverage, "g", actual.goals ?? 0, skaterUncertainty.g);
    updateCoverage(skaterCoverage, "a", actual.assists ?? 0, skaterUncertainty.a);
    updateCoverage(
      skaterCoverage,
      "pts",
      (actual.goals ?? 0) + (actual.assists ?? 0),
      skaterUncertainty.pts
    );
    updateCoverage(skaterCoverage, "sog", actual.shots ?? 0, skaterUncertainty.sog);
    updateCoverage(
      skaterCoverage,
      "ppp",
      actual.pp_points ?? 0,
      skaterUncertainty.ppp
    );
    for (const bucket of roleBuckets) {
      const coverageMap = getSkaterRoleBucketCoverageStatMap(
        skaterRoleBucketCoverage,
        bucket
      );
      updateCoverage(coverageMap, "g", actual.goals ?? 0, skaterUncertainty.g);
      updateCoverage(coverageMap, "a", actual.assists ?? 0, skaterUncertainty.a);
      updateCoverage(
        coverageMap,
        "pts",
        (actual.goals ?? 0) + (actual.assists ?? 0),
        skaterUncertainty.pts
      );
      updateCoverage(coverageMap, "sog", actual.shots ?? 0, skaterUncertainty.sog);
      updateCoverage(coverageMap, "ppp", actual.pp_points ?? 0, skaterUncertainty.ppp);
    }

    const predicted = computeSkaterFantasyPoints({
      goals: predictedGoals,
      assists: predictedAssists,
      ppPoints: (row.proj_goals_pp ?? 0) + (row.proj_assists_pp ?? 0),
      shots: predictedShots,
      hits: predictedHits,
      blockedShots: predictedBlocks
    });

    const actualFp = computeSkaterFantasyPoints({
      goals: actual.goals ?? 0,
      assists: actual.assists ?? 0,
      ppPoints: actual.pp_points ?? 0,
      shots: actual.shots ?? 0,
      hits: actual.hits ?? 0,
      blockedShots: actual.blocked_shots ?? 0
    });

    const errorAbs = Math.abs(predicted - actualFp);
    const errorSq = Math.pow(predicted - actualFp, 2);
    const predToiSecondsRaw =
      Number(row.proj_toi_es_seconds ?? 0) +
      Number(row.proj_toi_pp_seconds ?? 0) +
      Number(row.proj_toi_pk_seconds ?? 0);
    const predictedToiSeconds = Number.isFinite(predToiSecondsRaw)
      ? Math.max(1, predToiSecondsRaw)
      : 1;
    const actualEv = Number(actual.ev_time_on_ice ?? 0);
    const actualPp = Number(actual.pp_toi ?? 0);
    const actualSh = Number(actual.sh_time_on_ice ?? 0);
    const actualToiField = Number(actual.toi_per_game ?? 0);
    const componentsToiRaw = actualEv + actualPp + actualSh;
    const sourceToiRaw = componentsToiRaw > 0 ? componentsToiRaw : actualToiField;
    const actualToiSeconds =
      sourceToiRaw > 0
        ? sourceToiRaw <= 80
          ? sourceToiRaw * 60
          : sourceToiRaw
        : predictedToiSeconds;
    const safeActualToiSeconds = Math.max(1, actualToiSeconds);
    const predictedShotsSafe = Math.max(0, predictedShots);
    const actualShotsSafe = Math.max(0, Number(actual.shots ?? 0));
    const predictedScoringFp =
      DEFAULT_SKATER_FANTASY_POINTS.GOALS * predictedGoals +
      DEFAULT_SKATER_FANTASY_POINTS.ASSISTS * predictedAssists +
      DEFAULT_SKATER_FANTASY_POINTS.PP_POINTS *
        ((row.proj_goals_pp ?? 0) + (row.proj_assists_pp ?? 0));
    const actualScoringFp =
      DEFAULT_SKATER_FANTASY_POINTS.GOALS * Number(actual.goals ?? 0) +
      DEFAULT_SKATER_FANTASY_POINTS.ASSISTS * Number(actual.assists ?? 0) +
      DEFAULT_SKATER_FANTASY_POINTS.PP_POINTS * Number(actual.pp_points ?? 0);
    const predictedShotRate = predictedShotsSafe / predictedToiSeconds;
    const actualShotRate = actualShotsSafe / safeActualToiSeconds;
    const predictedFpPerShot =
      DEFAULT_SKATER_FANTASY_POINTS.SHOTS_ON_GOAL +
      predictedScoringFp / Math.max(0.1, predictedShotsSafe);
    const actualFpPerShot =
      DEFAULT_SKATER_FANTASY_POINTS.SHOTS_ON_GOAL +
      actualScoringFp / Math.max(0.1, actualShotsSafe);
    const fpBase = predictedToiSeconds * predictedShotRate * predictedFpPerShot;
    const fpToiAdjusted =
      safeActualToiSeconds * predictedShotRate * predictedFpPerShot;
    const fpShotRateAdjusted =
      safeActualToiSeconds * actualShotRate * predictedFpPerShot;
    const fpConversionAdjusted =
      safeActualToiSeconds * actualShotRate * actualFpPerShot;
    skaterMissAttribution.sampleCount += 1;
    skaterMissAttribution.totalAbsFpError += errorAbs;
    skaterMissAttribution.toiContribution += Math.abs(fpToiAdjusted - fpBase);
    skaterMissAttribution.shotRateContribution += Math.abs(
      fpShotRateAdjusted - fpToiAdjusted
    );
    skaterMissAttribution.conversionContribution += Math.abs(
      fpConversionAdjusted - fpShotRateAdjusted
    );
    skaterResults.push({
      as_of_date: projectionDate,
      actual_date: actualDate,
      game_id: gameId,
      player_id: playerId,
      player_type: "skater",
      team_id: row.team_id ?? null,
      opponent_team_id: row.opponent_team_id ?? null,
      predicted_fp: predicted,
      actual_fp: actualFp,
      error_abs: errorAbs,
      error_sq: errorSq,
      accuracy: computeAccuracyScore(predicted, actualFp),
      source_run_id: runId,
      created_at: new Date().toISOString()
    });
  }

  const { data: goalieProjections, error: goalieErr } = await supabase
    .from("forge_goalie_projections")
    .select(
      "game_id,goalie_id,team_id,opponent_team_id,starter_probability,proj_shots_against,proj_saves,proj_goals_allowed,proj_win_prob,proj_shutout_prob,uncertainty"
    )
    .eq("run_id", runId)
    .eq("as_of_date", projectionDate)
    .eq("horizon_games", 1);
  if (goalieErr) throw goalieErr;

  const goalieProjectionRows = (goalieProjections ?? []) as any[];
  const goalieIds = Array.from(
    new Set(
      goalieProjectionRows
        .map((g) => Number(g.goalie_id))
        .filter((n) => Number.isFinite(n))
    )
  );
  const goalieActuals = await fetchGoalieActualsByDate(actualDate, goalieIds);
  const goalieActualsFallback = await fetchGoalieActualsFallbackByDate(
    actualDate,
    goalieIds
  );
  const goalieResults: AccuracyResultRow[] = [];
  const goalieStatAggregates = new Map<string, StatAggregate>();
  const goalieCoverage = new Map<string, CoverageAccumulator>();
  const savesModelStats = initErrorStats();
  const savesBaselineStats = initErrorStats();
  const goalsAgainstModelStats = initErrorStats();
  const goalsAgainstBaselineStats = initErrorStats();
  const goalieActualCount = await fetchGoalieActualCount(actualDate);
  const starterProbabilityCalibration = initCalibrationAccumulator();
  const winProbabilityCalibration = initCalibrationAccumulator();
  const shutoutProbabilityCalibration = initCalibrationAccumulator();
  const missAttribution = initMissAttributionAccumulator();

  for (const row of goalieProjectionRows) {
    const playerId = Number(row.goalie_id);
    if (!Number.isFinite(playerId)) continue;
    const actual =
      goalieActuals.get(playerId) ??
      (goalieActualsFallback.has(playerId)
        ? {
            saves: goalieActualsFallback.get(playerId)?.saves ?? 0,
            goals_against: goalieActualsFallback.get(playerId)?.goals_allowed ?? 0,
            wins: 0,
            shutouts: 0
          }
        : null);
    updateCalibrationAccumulator(
      starterProbabilityCalibration,
      Number(row.starter_probability ?? 0),
      actual ? 1 : 0
    );
    if (!actual) continue;

    const projectedWins = row.proj_win_prob ?? 0;
    const projectedShutouts = row.proj_shutout_prob ?? 0;
    updateCalibrationAccumulator(
      winProbabilityCalibration,
      Number(projectedWins),
      (actual.wins ?? 0) > 0 ? 1 : 0
    );
    updateCalibrationAccumulator(
      shutoutProbabilityCalibration,
      Number(projectedShutouts),
      (actual.shutouts ?? 0) > 0 ? 1 : 0
    );
    const projectedSaves = row.proj_saves ?? 0;
    const projectedGoalsAgainst = row.proj_goals_allowed ?? 0;
    const projectedShotsAgainst =
      row.proj_shots_against ?? Math.max(0, projectedSaves + projectedGoalsAgainst);
    const baselineSavePct = 0.9;
    const baselineGoalsAgainst = projectedShotsAgainst * (1 - baselineSavePct);
    const baselineSaves = Math.max(0, projectedShotsAgainst - baselineGoalsAgainst);

    updateStatAggregate(
      goalieStatAggregates,
      "saves",
      projectedSaves,
      actual.saves ?? 0
    );
    updateStatAggregate(
      goalieStatAggregates,
      "goals_against",
      projectedGoalsAgainst,
      actual.goals_against ?? 0
    );
    updateStatAggregate(
      goalieStatAggregates,
      "win_prob",
      projectedWins,
      actual.wins ?? 0
    );
    updateStatAggregate(
      goalieStatAggregates,
      "shutout_prob",
      projectedShutouts,
      actual.shutouts ?? 0
    );
    updateErrorStats(savesModelStats, projectedSaves, actual.saves ?? 0);
    updateErrorStats(savesBaselineStats, baselineSaves, actual.saves ?? 0);
    updateErrorStats(
      goalsAgainstModelStats,
      projectedGoalsAgainst,
      actual.goals_against ?? 0
    );
    updateErrorStats(
      goalsAgainstBaselineStats,
      baselineGoalsAgainst,
      actual.goals_against ?? 0
    );

    const goalieUncertainty = row.uncertainty ?? {};
    const actualShotsAgainst =
      (actual.saves ?? 0) + (actual.goals_against ?? 0);
    updateCoverage(
      goalieCoverage,
      "shots_against",
      actualShotsAgainst,
      goalieUncertainty.shots_against
    );
    updateCoverage(
      goalieCoverage,
      "goals_allowed",
      actual.goals_against ?? 0,
      goalieUncertainty.goals_allowed
    );
    updateCoverage(
      goalieCoverage,
      "saves",
      actual.saves ?? 0,
      goalieUncertainty.saves
    );

    const predicted = computeGoalieFantasyPoints({
      saves: projectedSaves,
      goalsAgainst: projectedGoalsAgainst,
      wins: projectedWins,
      shutouts: projectedShutouts
    });

    const actualFp = computeGoalieFantasyPoints({
      saves: actual.saves ?? 0,
      goalsAgainst: actual.goals_against ?? 0,
      wins: actual.wins ?? 0,
      shutouts: actual.shutouts ?? 0
    });

    const errorAbs = Math.abs(predicted - actualFp);
    const errorSq = Math.pow(predicted - actualFp, 2);
    const modeledSavePctFromMeta = Number((row.uncertainty as any)?.model?.save_pct);
    const modeledSavePct =
      Number.isFinite(modeledSavePctFromMeta)
        ? Math.max(0, Math.min(1, modeledSavePctFromMeta))
        : projectedShotsAgainst > 0
          ? Math.max(0, Math.min(1, projectedSaves / projectedShotsAgainst))
          : 0.9;
    const actualSavePct =
      actualShotsAgainst > 0
        ? Math.max(0, Math.min(1, (actual.saves ?? 0) / actualShotsAgainst))
        : modeledSavePct;
    const starterProb = Math.max(0, Math.min(1, Number(row.starter_probability ?? 0)));
    const gaErrorAbs = Math.abs(projectedGoalsAgainst - (actual.goals_against ?? 0));
    missAttribution.sampleCount += 1;
    missAttribution.totalAbsFpError += errorAbs;
    missAttribution.totalAbsGaError += gaErrorAbs;
    missAttribution.starterContribution += (1 - starterProb) * gaErrorAbs;
    missAttribution.shotsAgainstContribution += Math.abs(
      (projectedShotsAgainst - actualShotsAgainst) * (1 - modeledSavePct)
    );
    missAttribution.savePctContribution += Math.abs(
      actualShotsAgainst * (modeledSavePct - actualSavePct)
    );
    goalieResults.push({
      as_of_date: projectionDate,
      actual_date: actualDate,
      game_id: row.game_id ?? null,
      player_id: playerId,
      player_type: "goalie",
      team_id: row.team_id ?? null,
      opponent_team_id: row.opponent_team_id ?? null,
      predicted_fp: predicted,
      actual_fp: actualFp,
      error_abs: errorAbs,
      error_sq: errorSq,
      accuracy: computeAccuracyScore(predicted, actualFp),
      source_run_id: runId,
      created_at: new Date().toISOString()
    });
  }

  const allResults = [...skaterResults, ...goalieResults];
  if (allResults.length > 0) {
    for (const batch of chunk(allResults, BATCH_SIZE)) {
      const { error } = await supabase
        .from("forge_projection_results")
        .upsert(batch, {
          onConflict: "as_of_date,actual_date,player_id,game_id,player_type"
        });
      if (error) throw error;
    }
  }

  const overallAgg = computeAggregate(allResults);
  const skaterAgg = computeAggregate(skaterResults);
  const goalieAgg = computeAggregate(goalieResults);

  const dailyRows = [
    { scope: "overall", agg: overallAgg },
    { scope: "skater", agg: skaterAgg },
    { scope: "goalie", agg: goalieAgg }
  ];

  const dailyUpserts = [];
  for (const { scope, agg } of dailyRows) {
    const prev = await fetchLatestRunningTotals(scope, actualDate);
    const runningAccuracySum = (prev?.running_accuracy_sum ?? 0) + agg.accuracy_sum;
    const runningErrorAbsSum =
      (prev?.running_error_abs_sum ?? 0) + agg.error_abs_sum;
    const runningErrorSqSum =
      (prev?.running_error_sq_sum ?? 0) + agg.error_sq_sum;
    const runningPlayerCount = (prev?.running_player_count ?? 0) + agg.count;

    dailyUpserts.push({
      date: actualDate,
      scope,
      accuracy_avg: agg.accuracy_avg,
      mae: agg.mae,
      rmse: agg.rmse,
      player_count: agg.count,
      accuracy_sum: agg.accuracy_sum,
      error_abs_sum: agg.error_abs_sum,
      error_sq_sum: agg.error_sq_sum,
      running_accuracy_sum: runningAccuracySum,
      running_error_abs_sum: runningErrorAbsSum,
      running_error_sq_sum: runningErrorSqSum,
      running_player_count: runningPlayerCount,
      running_accuracy_avg:
        runningPlayerCount > 0 ? runningAccuracySum / runningPlayerCount : 0,
      running_mae:
        runningPlayerCount > 0 ? runningErrorAbsSum / runningPlayerCount : 0,
      running_rmse:
        runningPlayerCount > 0
          ? Math.sqrt(runningErrorSqSum / runningPlayerCount)
          : 0,
      updated_at: new Date().toISOString()
    });
  }

  if (dailyUpserts.length > 0) {
    const { error } = await supabase
      .from("forge_projection_accuracy_daily")
      .upsert(dailyUpserts, { onConflict: "date,scope" });
    if (error) throw error;
  }

  const perPlayerByKey = new Map<
    string,
    { rows: AccuracyResultRow[]; player_id: number; player_type: string }
  >();
  for (const r of allResults) {
    const key = `${r.player_type}:${r.player_id}`;
    const existing = perPlayerByKey.get(key) ?? {
      rows: [],
      player_id: r.player_id,
      player_type: r.player_type
    };
    existing.rows.push(r);
    perPlayerByKey.set(key, existing);
  }

  const playerUpserts = Array.from(perPlayerByKey.values()).map((entry) => {
    const agg = computeAggregate(entry.rows);
    return {
      date: actualDate,
      player_id: entry.player_id,
      player_type: entry.player_type,
      accuracy_avg: agg.accuracy_avg,
      mae: agg.mae,
      rmse: agg.rmse,
      games_count: agg.count,
      updated_at: new Date().toISOString()
    };
  });

  if (playerUpserts.length > 0) {
    const { error } = await supabase
      .from("forge_projection_accuracy_player")
      .upsert(playerUpserts, { onConflict: "date,player_id,player_type" });
    if (error) throw error;
  }

  const statDailyRows = [
    ...finalizeStatAggregates(skaterStatAggregates, actualDate, "skater"),
    ...finalizeStatAggregates(goalieStatAggregates, actualDate, "goalie")
  ];
  if (statDailyRows.length > 0) {
    const { error } = await supabase
      .from("forge_projection_accuracy_stat_daily")
      .upsert(statDailyRows, { onConflict: "date,scope,stat_key" });
    if (error) throw error;
  }
  const dailyGoalieStatRows = statDailyRows.filter((r) => r.scope === "goalie");
  const dailySkaterStatRows = statDailyRows.filter((r) => r.scope === "skater");
  const goalieStatDiagnostics = await fetchGoalieStatDiagnostics(
    actualDate,
    dailyGoalieStatRows
  );
  const skaterStatDiagnostics = await fetchSkaterStatDiagnostics(
    actualDate,
    dailySkaterStatRows
  );

  const skaterCoverageSummary = finalizeCoverage(skaterCoverage);
  const skaterRoleBucketDiagnostics = finalizeSkaterRoleBucketDiagnostics(
    skaterRoleBucketAggregates
  );
  const skaterRoleBucketIntervalCalibrationDiagnostics =
    finalizeSkaterRoleBucketIntervalCalibrationDiagnostics(skaterRoleBucketCoverage);
  const skaterMissAttributionDiagnostics =
    finalizeSkaterMissAttributionDiagnostics(skaterMissAttribution);
  const skaterIntervalCoverageDiagnostics =
    toIntervalCoverageSummary(skaterCoverageSummary);
  const skaterRollingDashboard: SkaterRollingDashboard = {
    generated_for_date: actualDate,
    stat_diagnostics: skaterStatDiagnostics,
    interval_coverage_daily: skaterIntervalCoverageDiagnostics,
    role_bucket_interval_calibration_daily:
      skaterRoleBucketIntervalCalibrationDiagnostics,
    miss_attribution_daily: skaterMissAttributionDiagnostics
  };
  const goalieCoverageSummary = finalizeCoverage(goalieCoverage);
  const goalieIntervalCoverageDiagnostics =
    toIntervalCoverageSummary(goalieCoverageSummary);

  const goalieProbabilityCalibration = {
    starter_probability: finalizeCalibrationAccumulator(starterProbabilityCalibration),
    win_probability: finalizeCalibrationAccumulator(winProbabilityCalibration),
    shutout_probability: finalizeCalibrationAccumulator(shutoutProbabilityCalibration)
  };
  const goalieMissAttributionDiagnostics =
    finalizeMissAttributionDiagnostics(missAttribution);
  const goalieLaunchGates = buildGoalieLaunchGates({
    actualDate,
    goalieStatDiagnostics,
    goalieProbabilityCalibration,
    goalieIntervalCoverageDiagnostics
  });

  const calibrationSummary = {
    actual_date: actualDate,
    projection_date: projectionDate,
    skater: skaterCoverageSummary,
    skater_role_bucket_diagnostics: skaterRoleBucketDiagnostics,
    skater_role_bucket_interval_calibration_diagnostics:
      skaterRoleBucketIntervalCalibrationDiagnostics,
    skater_miss_attribution_diagnostics: skaterMissAttributionDiagnostics,
    skater_rolling_dashboard: skaterRollingDashboard,
    goalie: goalieCoverageSummary,
    goalie_interval_coverage_diagnostics: goalieIntervalCoverageDiagnostics,
    goalie_stat_diagnostics: goalieStatDiagnostics,
    goalie_probability_calibration: goalieProbabilityCalibration,
    goalie_miss_attribution_diagnostics: goalieMissAttributionDiagnostics,
    goalie_launch_gates: goalieLaunchGates
  };
  await updateRunCalibrationMetrics(runId, actualDate, calibrationSummary);
  await persistGoalieCalibrationSnapshots({
    runId,
    actualDate,
    projectionDate,
    skaterRoleBucketDiagnostics,
    skaterRoleBucketIntervalCalibrationDiagnostics,
    skaterMissAttributionDiagnostics,
    skaterRollingDashboard,
    goalieStatDiagnostics,
    goalieProbabilityCalibration,
    goalieIntervalCoverageDiagnostics,
    goalieMissAttributionDiagnostics,
    goalieLaunchGates
  });

  const goalieMatchedByPlayer = goalieProjectionRows.filter((row) => {
    const goalieId = Number(row.goalie_id);
    return goalieActuals.has(goalieId) || goalieActualsFallback.has(goalieId);
  }).length;

  return {
    asOfDate: projectionDate,
    actualDate,
    runId,
    skaterRows: skaterResults.length,
    goalieRows: goalieResults.length,
    totalRows: allResults.length,
    goalieMatchDiagnostics: {
      goalieProjectionCount: goalieProjectionRows.length,
      goalieActualCount,
      goalieMatchedByPlayer,
      goalieActualFallbackCount: goalieActualsFallback.size
    },
    goalieHoldoutComparison: {
      baseline_definition: "fixed_save_pct_0.900_using_projected_shots_against",
      saves: finalizeMetricComparison(savesModelStats, savesBaselineStats),
      goals_against: finalizeMetricComparison(
        goalsAgainstModelStats,
        goalsAgainstBaselineStats
      )
    },
    goalieStatDiagnostics,
    goalieProbabilityCalibration,
    goalieIntervalCoverageDiagnostics,
    goalieMissAttributionDiagnostics,
    goalieLaunchGates,
    skaterRoleBucketDiagnostics,
    skaterRoleBucketIntervalCalibrationDiagnostics,
    skaterMissAttributionDiagnostics,
    skaterRollingDashboard,
    durationMs: formatDurationMsToMMSS(Date.now() - startedAt)
  };
}

export default withCronJobAudit(async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const startedAt = Date.now();
  if (req.method !== "POST" && req.method !== "GET") {
    res.setHeader("Allow", ["GET", "POST"]);
    return res.status(405).json({ error: "Method not allowed" });
  }
  if (!supabase) {
    return res.status(500).json({ error: "Supabase server client not available" });
  }

  try {
    const requestedDate = parseDateParam(req.query.date);
    const offsetDays =
      parseNumber(req.query.projectionOffsetDays) ?? DEFAULT_OFFSET_DAYS;
    const bypassPreflight = parseBooleanParam(req.query.bypassPreflight);
    const startDateParam =
      parseDateParam(req.query.startDate) ??
      parseDateParam(req.query.endDate) ??
      parseDateParam(req.query.endPoint);
    const endDateParam =
      parseDateParam(req.query.endDate) ??
      parseDateParam(req.query.endPoint) ??
      parseDateParam(req.query.startDate);
    const rangeDates =
      startDateParam && endDateParam
        ? buildDateRange(startDateParam, endDateParam)
        : [];

    if (
      (startDateParam || endDateParam) &&
      (rangeDates.length === 0 ||
        (startDateParam && endDateParam && startDateParam > endDateParam))
    ) {
      return res.status(400).json({
        success: false,
        error: "Invalid startDate/endDate range",
        durationMs: formatDurationMsToMMSS(Date.now() - startedAt)
      });
    }

    if (rangeDates.length > 0) {
      const maxDurationMs =
        parseNumber(req.query.maxDurationMs) ?? DEFAULT_RANGE_BUDGET_MS;
      const budgetMs = Number.isFinite(maxDurationMs)
        ? maxDurationMs
        : DEFAULT_RANGE_BUDGET_MS;
      const deadlineMs = Date.now() + budgetMs;
      const results = [];
      const errors: Array<{ date: string; message: string }> = [];
      let nextStartDate: string | null = null;
      for (const date of rangeDates) {
        if (Date.now() > deadlineMs) {
          return res.status(200).json({
            success: false,
            error: "Timed out",
            processedDates: results.map((r) => r.actualDate),
            results,
            rowsUpserted: results.reduce((acc, row) => acc + row.totalRows, 0),
            failedRows: errors.length,
            errors,
            nextStartDate: date,
            durationMs: formatDurationMsToMMSS(Date.now() - startedAt)
          });
        }
        try {
          const projectionDate = addDays(date, -offsetDays);
          const preflight = await runProjectionPreflightChecks(
            projectionDate,
            bypassPreflight
          );
          if (preflight.status === "FAIL") {
            return res.status(422).json({
              success: false,
              actualDate: date,
              projectionDate,
              preflight,
              error:
                "Projection freshness checks failed for the requested accuracy window. Resolve upstream dependencies or use bypassPreflight=true to override.",
              durationMs: formatDurationMsToMMSS(Date.now() - startedAt)
            });
          }
          results.push(await runAccuracyForDate(date, offsetDays));
        } catch (error) {
          errors.push({
            date,
            message: (error as any)?.message ?? String(error)
          });
          if (nextStartDate == null) nextStartDate = date;
        }
      }
      return res.status(200).json({
        success: errors.length === 0,
        processedDates: results.map((r) => r.actualDate),
        results,
        rowsUpserted: results.reduce((acc, row) => acc + row.totalRows, 0),
        failedRows: errors.length,
        errors,
        nextStartDate,
        durationMs: formatDurationMsToMMSS(Date.now() - startedAt)
      });
    }

    const actualDate = requestedDate ?? addDays(isoDateOnly(new Date()), -1);
    const projectionDate = addDays(actualDate, -offsetDays);
    const preflight = await runProjectionPreflightChecks(
      projectionDate,
      bypassPreflight
    );
    if (preflight.status === "FAIL") {
      return res.status(422).json({
        success: false,
        actualDate,
        projectionDate,
        preflight,
        error:
          "Projection freshness checks failed. Resolve upstream dependencies or use bypassPreflight=true to override.",
        durationMs: formatDurationMsToMMSS(Date.now() - startedAt)
      });
    }
    const result = await runAccuracyForDate(actualDate, offsetDays);
    return res.status(200).json({
      success: true,
      asOfDate: result.asOfDate,
      actualDate: result.actualDate,
      preflight,
      runId: result.runId,
      skaterRows: result.skaterRows,
      goalieRows: result.goalieRows,
      totalRows: result.totalRows,
      goalieMatchDiagnostics: result.goalieMatchDiagnostics,
      goalieHoldoutComparison: result.goalieHoldoutComparison,
      goalieStatDiagnostics: result.goalieStatDiagnostics,
      goalieProbabilityCalibration: result.goalieProbabilityCalibration,
      goalieIntervalCoverageDiagnostics:
        result.goalieIntervalCoverageDiagnostics,
      goalieMissAttributionDiagnostics: result.goalieMissAttributionDiagnostics,
      goalieLaunchGates: result.goalieLaunchGates,
      skaterRoleBucketIntervalCalibrationDiagnostics:
        result.skaterRoleBucketIntervalCalibrationDiagnostics,
      skaterMissAttributionDiagnostics: result.skaterMissAttributionDiagnostics,
      skaterRollingDashboard: result.skaterRollingDashboard,
      rowsUpserted: result.totalRows,
      failedRows: 0,
      durationMs: formatDurationMsToMMSS(Date.now() - startedAt)
    });
  } catch (e) {
    const dependencyError = normalizeDependencyError(e);
    return res.status(500).json({
      success: false,
      error: dependencyError.message,
      dependencyError,
      durationMs: formatDurationMsToMMSS(Date.now() - startedAt)
    });
  }
}, { jobName: "run-projection-accuracy" });
