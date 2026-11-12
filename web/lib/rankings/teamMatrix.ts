import type { NextApiRequest } from "next";

import supabase from "lib/supabase/server";
import type { Database } from "lib/supabase/database-generated.types";

import {
  TEAM_ADJUSTED_STYLE_SOURCE_CONTRACTS,
  TEAM_SOURCE_PENDING_METRIC_CONTRACTS,
  TEAM_STYLE_SOURCE_CONTRACT,
  calculateTeamGameContextComponents,
  calculateRunAndGunProfile,
  calculateTeamExpectedGoalsForPercentage,
  calculateTeamLuckComponents,
  calculateTeamShotQuality,
} from "./teamStyleMethodology";
import { rankNormalizedMetricValues } from "./rankingCalculator";
import { ContextualRankingsQueryError } from "./rankingTypes";

export type TeamMatrixMetricKey =
  | "off_rating"
  | "def_rating"
  | "xgf60"
  | "xga60"
  | "xgf_percentage"
  | "shot_quality"
  | "event_rate"
  | "finishing_luck"
  | "save_luck"
  | "net_luck"
  | "pace_rating"
  | "special_rating"
  | "one_goal_game_rate"
  | "home_road_point_pct_gap"
  | "pp_opportunity_rate"
  | "penalties_taken_per_60"
  | "forward_top_load_index"
  | "defense_pair_top_load_index"
  | "pp1_pp2_usage_share";

export type TeamMatrixRequest = {
  season: number;
  asOfDate: string | null;
  metric: TeamMatrixMetricKey;
  sortDirection: "asc" | "desc";
  search: string | null;
  page: number;
  pageSize: number;
  /** Visible, user-lowerable sample floor (decision 98); below it a team shows "insufficient sample". */
  minGp?: number;
};

type TeamPowerRow = {
  team_abbreviation: string;
  date: string;
  off_rating: number | null;
  def_rating: number | null;
  pace_rating: number | null;
  xgf60: number | null;
  gf60: number | null;
  sf60: number | null;
  xga60: number | null;
  ga60: number | null;
  sa60: number | null;
  pace60: number | null;
  trend10: number | null;
  pp_tier: number | null;
  pk_tier: number | null;
  finishing_rating: number | null;
  goalie_rating: number | null;
  danger_rating: number | null;
  special_rating: number | null;
  discipline_rating: number | null;
  variance_flag: number | null;
};

type TeamGameContextRow = {
  date: string;
  team_id: number | null;
  game_id: number | null;
  home_road: string | null;
  goals_for: number | null;
  goals_against: number | null;
  point_pct: number | null;
  pp_opportunities_per_game: number | null;
  penalties_taken_per_60: number | null;
};

type GameVenueRow = {
  id: number;
  date: string;
  homeTeamId: number | null;
  awayTeamId: number | null;
};

type NstTeamRow = {
  date: string;
  team_abbreviation: string;
  gp: number | null;
  xgf: number | null;
  xga: number | null;
  gf: number | null;
  ga: number | null;
  ff: number | null;
  fa: number | null;
  cf: number | null;
  ca: number | null;
};

type TeamMeta = {
  id: number;
  abbreviation: string | null;
  name: string | null;
};

type TeamStyleAggregate = {
  teamId: number | null;
  teamAbbreviation: string;
  /** Games behind the totals: every eligible game when coverage is complete, else 0. */
  gamesCount: number;
  /** Played regular-season team-games in the window (the ledger). */
  eligibleGames: number;
  /** Ledger games with one complete NST 5v5 row. */
  coveredGames: number;
  coverageComplete: boolean;
  latestDate: string | null;
  xgf: number | null;
  xga: number | null;
  gf: number | null;
  ga: number | null;
  ff: number | null;
  fa: number | null;
  source: "nst_team_5v5";
};

/** One played regular-season team-game in the window: the eligible ledger for team style. */
export type TeamStyleLedgerGame = {
  teamId: number | null;
  teamAbbreviation: string;
  date: string;
};

type TeamGameContextAggregate = {
  teamId: number;
  gamesCount: number;
  latestDate: string | null;
  oneGoalGameRate: number | null;
  homeRoadPointPctGap: number | null;
  powerPlayOpportunityRate: number | null;
  penaltiesTakenPer60: number | null;
};

type TeamUnitToiRow = {
  [Key in
    | "team_id"
    | "game_id"
    | "game_date"
    | "snapshot_date"
    | "unit_type"
    | "unit_number"
    | "unit_share"
    | "unit_toi_seconds"
    | "team_unit_pool_toi_seconds"
    | "coverage_status"
    | "coverage_warnings"]: Database["public"]["Tables"]["team_unit_toi"]["Row"][Key];
};

type TeamUnitMetricCoverageStatus = "complete" | "partial" | "source_gap";

export type TeamUnitMetricCoverage = {
  games: number;
  latestDate: string | null;
  snapshotDate: string | null;
  status: TeamUnitMetricCoverageStatus;
  warnings: string[];
};

export type TeamUnitMetricInterpretation = {
  label: string;
  coverageQualified: boolean;
  minimumGames: number;
  reason: string;
};

type TeamUnitUsageAggregate = {
  teamId: number;
  gamesCount: number;
  latestDate: string | null;
  snapshotDate: string | null;
  forwardTopLoadIndex: number | null;
  defensePairTopLoadIndex: number | null;
  pp1Pp2UsageShare: number | null;
  coverage: {
    forwardTopLoad: TeamUnitMetricCoverage;
    defensePairTopLoad: TeamUnitMetricCoverage;
    pp1Pp2UsageShare: TeamUnitMetricCoverage;
  };
};

type RankedMetric = {
  rawValue: number | null;
  formattedValue: string | null;
  rank: number | null;
  percentile: number | null;
  qualifiedPeerCount: number;
  lowerIsBetter: boolean;
};

export type TeamMatrixRow = {
  team: {
    id: number | null;
    abbreviation: string;
    name: string | null;
  };
  record: {
    latestPowerDate: string;
    styleSnapshotDate: string | null;
    styleGames: number;
    styleCoverage?: {
      eligibleGames: number;
      coveredGames: number;
      complete: boolean;
    };
    ppTier: number | null;
    pkTier: number | null;
    trend10: number | null;
  };
  style: {
    label: string;
    descriptorType: "raw_contextual";
    displayLabel: string;
    adjustedTargetLabel: string;
    adjustedStatus: "source_pending";
    interpretation: string;
    paceAxis: string | null;
    controlAxis: string | null;
    xgForPercentage: number | null;
    eventRate: number | null;
    shotQuality: number | null;
    source: string;
    adjusted: false;
  };
  luck: {
    finishingLuck: number | null;
    saveLuck: number | null;
    netGoalsAboveExpected: number | null;
  };
  context: {
    games: number;
    latestDate: string | null;
    oneGoalGameRate: number | null;
    homeRoadPointPctGap: number | null;
    powerPlayOpportunityRate: number | null;
    penaltiesTakenPer60: number | null;
  };
  unitUsage: {
    games: number;
    latestDate: string | null;
    snapshotDate: string | null;
    forwardTopLoadIndex: number | null;
    defensePairTopLoadIndex: number | null;
    pp1Pp2UsageShare: number | null;
    coverage: TeamUnitUsageAggregate["coverage"];
    labels: {
      forwardTopLoad: TeamUnitMetricInterpretation;
      defensePairTopLoad: TeamUnitMetricInterpretation;
      pp1Pp2UsageShare: TeamUnitMetricInterpretation;
    };
  };
  sort: {
    metricKey: TeamMatrixMetricKey;
    rank: number | null;
    percentile: number | null;
  };
  metrics: Record<TeamMatrixMetricKey, RankedMetric>;
  warnings: string[];
};

export type TeamMatrixResponse = {
  success: true;
  request: TeamMatrixRequest;
  rows: TeamMatrixRow[];
  meta: {
    generatedAt: string;
    rowCount: number;
    totalRankedRows: number;
    page: number;
    pageSize: number;
    pageCount: number;
    snapshotDate: string | null;
    latestAvailableSnapshotDate: string | null;
    styleSnapshotDate: string | null;
    sampleFloor?: {
      minGames: number;
      label: string;
    };
    sourceTables: string[];
    methodologyVersion?: string;
    methodologyUpdatedAt?: string;
    sourceQualityFlags?: string[];
    sourceWarnings: string[];
    teamStyleContract: typeof TEAM_STYLE_SOURCE_CONTRACT;
    sourcePendingMetricContracts: Array<
      (typeof TEAM_SOURCE_PENDING_METRIC_CONTRACTS)[number] |
        (typeof TEAM_ADJUSTED_STYLE_SOURCE_CONTRACTS)[number]
    >;
    metricColumns: Array<{
      metricKey: TeamMatrixMetricKey;
      label: string;
      description: string;
      lowerIsBetter: boolean;
      source: string;
    }>;
  };
};

const TEAM_QUERY_PAGE_SIZE = 1000;
const DEFAULT_PAGE_SIZE = 10;
const MAX_PAGE_SIZE = 50;
/** Default team sample floor in games (decision 98); the user can lower it with min_gp. */
export const DEFAULT_TEAM_MIN_GP = 5;
const TEAM_MATRIX_RESPONSE_CACHE_TTL_MS = 30_000;
const TEAM_UNIT_TOI_SELECT =
  "team_id,game_id,game_date,snapshot_date,unit_type,unit_number,unit_share,unit_toi_seconds,team_unit_pool_toi_seconds,coverage_status,coverage_warnings" as const;
const teamMatrixResponseCache = new Map<
  string,
  { expiresAt: number; response: TeamMatrixResponse }
>();

function emptyTeamUnitMetricCoverage(
  snapshotDate: string | null,
): TeamUnitMetricCoverage {
  return {
    games: 0,
    latestDate: null,
    snapshotDate,
    status: "source_gap",
    warnings: [],
  };
}

function emptyTeamUnitCoverage(snapshotDate: string | null) {
  return {
    forwardTopLoad: emptyTeamUnitMetricCoverage(snapshotDate),
    defensePairTopLoad: emptyTeamUnitMetricCoverage(snapshotDate),
    pp1Pp2UsageShare: emptyTeamUnitMetricCoverage(snapshotDate),
  };
}

export function clearTeamMatrixSurfaceCachesForTests() {
  teamMatrixResponseCache.clear();
}

const METRIC_COLUMNS: TeamMatrixResponse["meta"]["metricColumns"] = [
  {
    metricKey: "off_rating",
    label: "Off Rating",
    description: "Current offensive team power rating.",
    lowerIsBetter: false,
    source: "team_power_ratings_daily.off_rating",
  },
  {
    metricKey: "def_rating",
    label: "Def Rating",
    description: "Current defensive team power rating.",
    lowerIsBetter: false,
    source: "team_power_ratings_daily.def_rating",
  },
  {
    metricKey: "xgf60",
    label: "xGF/60",
    description:
      "Expected goals for per 60 from current team power ratings (built from NST xG).",
    lowerIsBetter: false,
    source: "team_power_ratings_daily.xgf60",
  },
  {
    metricKey: "xga60",
    label: "xGA/60",
    description:
      "Expected goals against per 60 from current team power ratings (built from NST xG). Lower raw values are better.",
    lowerIsBetter: true,
    source: "team_power_ratings_daily.xga60",
  },
  {
    metricKey: "xgf_percentage",
    label: "xGF% (NST)",
    description: "Raw 5v5 expected-goals share, NST xG only.",
    lowerIsBetter: false,
    source: "nst_team_5v5 xgf, xga (Natural Stat Trick 5v5)",
  },
  {
    metricKey: "shot_quality",
    label: "Shot Quality",
    description: "Raw 5v5 NST xGF per unblocked shot attempt for.",
    lowerIsBetter: false,
    source: "nst_team_5v5 xgf / ff",
  },
  {
    metricKey: "event_rate",
    label: "Event Rate",
    description: "Raw 5v5 NST xGF + xGA per team game.",
    lowerIsBetter: false,
    source: "nst_team_5v5 (xgf + xga) / games",
  },
  {
    metricKey: "finishing_luck",
    label: "Fin Luck",
    description: "5v5 goals for minus NST expected goals for.",
    lowerIsBetter: false,
    source: "nst_team_5v5 gf - xgf",
  },
  {
    metricKey: "save_luck",
    label: "Save Luck",
    description: "5v5 NST expected goals against minus goals against.",
    lowerIsBetter: false,
    source: "nst_team_5v5 xga - ga",
  },
  {
    metricKey: "net_luck",
    label: "Net Luck",
    description: "Finishing luck plus save luck (5v5, NST xG).",
    lowerIsBetter: false,
    source: "nst_team_5v5 (gf - xgf) + (xga - ga)",
  },
  {
    metricKey: "pace_rating",
    label: "Pace Rating",
    description: "Current team pace rating.",
    lowerIsBetter: false,
    source: "team_power_ratings_daily.pace_rating",
  },
  {
    metricKey: "special_rating",
    label: "Special",
    description: "Current special-teams rating component.",
    lowerIsBetter: false,
    source: "team_power_ratings_daily.special_rating",
  },
  {
    metricKey: "one_goal_game_rate",
    label: "1-Goal%",
    description: "Share of team games decided by one goal or fewer.",
    lowerIsBetter: false,
    source: "wgo_team_stats goals_for / goals_against",
  },
  {
    metricKey: "home_road_point_pct_gap",
    label: "Home Edge",
    description: "Home point-percentage minus road point-percentage.",
    lowerIsBetter: false,
    source: "wgo_team_stats.point_pct joined to games homeTeamId/awayTeamId",
  },
  {
    metricKey: "pp_opportunity_rate",
    label: "PP Opp/G",
    description: "Power-play opportunities per game.",
    lowerIsBetter: false,
    source: "wgo_team_stats.pp_opportunities_per_game",
  },
  {
    metricKey: "penalties_taken_per_60",
    label: "Pen/60",
    description: "Penalties taken per 60 minutes. Lower raw values are better.",
    lowerIsBetter: true,
    source: "wgo_team_stats.penalties_taken_per_60",
  },
  {
    metricKey: "forward_top_load_index",
    label: "Fwd Top Load",
    description:
      "Average top forward-line share of team forward pooled player-seconds.",
    lowerIsBetter: false,
    source: "team_unit_toi forward_line unit_number=1",
  },
  {
    metricKey: "defense_pair_top_load_index",
    label: "Pair Top Load",
    description:
      "Average top defense-pair share of team defense pooled player-seconds.",
    lowerIsBetter: false,
    source: "team_unit_toi defense_pair unit_number=1",
  },
  {
    metricKey: "pp1_pp2_usage_share",
    label: "PP1/PP2 Share",
    description:
      "Average share of team power-play pooled player-seconds assigned to PP1 and PP2.",
    lowerIsBetter: false,
    source: "team_unit_toi power_play unit_number in (1,2)",
  },
];

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function parseInteger(
  value: string | string[] | undefined,
  key: string,
  options: { defaultValue?: number; required?: boolean; min?: number; max?: number },
) {
  const raw = first(value);
  if (!raw) {
    if (options.required) {
      throw new ContextualRankingsQueryError(`Missing required query param: ${key}`, {
        [key]: "required",
      });
    }
    return options.defaultValue ?? null;
  }
  const parsed = Number(raw);
  if (!Number.isInteger(parsed)) {
    throw new ContextualRankingsQueryError(`Invalid query param: ${key}`, {
      [key]: "must be an integer",
    });
  }
  if (options.min != null && parsed < options.min) {
    throw new ContextualRankingsQueryError(`Invalid query param: ${key}`, {
      [key]: `must be >= ${options.min}`,
    });
  }
  if (options.max != null && parsed > options.max) {
    throw new ContextualRankingsQueryError(`Invalid query param: ${key}`, {
      [key]: `must be <= ${options.max}`,
    });
  }
  return parsed;
}

function parseEnum<T extends readonly string[]>(
  value: string | string[] | undefined,
  key: string,
  allowed: T,
  defaultValue: T[number],
): T[number] {
  const raw = (first(value) ?? defaultValue).toLowerCase();
  const match = allowed.find((entry) => entry.toLowerCase() === raw);
  if (!match) {
    throw new ContextualRankingsQueryError(`Invalid query param: ${key}`, {
      [key]: `must be one of ${allowed.join(", ")}`,
    });
  }
  return match;
}

function parseDate(value: string | string[] | undefined) {
  const raw = first(value);
  if (!raw) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    throw new ContextualRankingsQueryError("Invalid query param: as_of_date", {
      as_of_date: "must be YYYY-MM-DD",
    });
  }
  return raw;
}

function parseSearch(value: string | string[] | undefined) {
  const raw = first(value)?.trim();
  return raw ? raw.slice(0, 80) : null;
}

export function parseTeamMatrixRequest(
  query: NextApiRequest["query"],
): TeamMatrixRequest {
  return {
    season:
      parseInteger(query.season, "season", {
        required: true,
        min: 19000000,
        max: 21000000,
      }) ?? 0,
    asOfDate: parseDate(query.as_of_date),
    metric: parseEnum(
      query.metric,
      "metric",
      METRIC_COLUMNS.map((column) => column.metricKey) as TeamMatrixMetricKey[],
      "off_rating",
    ),
    sortDirection: parseEnum(
      query.sort_direction,
      "sort_direction",
      ["asc", "desc"] as const,
      "desc",
    ),
    search: parseSearch(query.search),
    page:
      parseInteger(query.page, "page", {
        defaultValue: 1,
        min: 1,
        max: 100,
      }) ?? 1,
    pageSize:
      parseInteger(query.page_size, "page_size", {
        defaultValue: DEFAULT_PAGE_SIZE,
        min: 1,
        max: MAX_PAGE_SIZE,
      }) ?? DEFAULT_PAGE_SIZE,
    minGp:
      parseInteger(query.min_gp, "min_gp", {
        defaultValue: DEFAULT_TEAM_MIN_GP,
        min: 0,
        max: 82,
      }) ?? DEFAULT_TEAM_MIN_GP,
  };
}

function teamRowMatchesSearch(row: TeamMatrixRow, search: string | null) {
  if (!search) return true;
  const needle = search.toLowerCase();
  return [row.team.abbreviation, row.team.name, row.style.label]
    .filter((value): value is string => typeof value === "string")
    .some((value) => value.toLowerCase().includes(needle));
}

function finite(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return value;
}

function round(value: number, decimals = 6) {
  return Number(value.toFixed(decimals));
}

function sum(values: Array<number | null | undefined>) {
  let total = 0;
  let count = 0;
  for (const value of values) {
    const number = finite(value);
    if (number == null) continue;
    total += number;
    count += 1;
  }
  return count > 0 ? round(total) : null;
}

function average(values: Array<number | null | undefined>) {
  let total = 0;
  let count = 0;
  for (const value of values) {
    const number = finite(value);
    if (number == null) continue;
    total += number;
    count += 1;
  }
  return count > 0 ? round(total / count) : null;
}

function formatMetricValue(metricKey: TeamMatrixMetricKey, value: number | null) {
  if (value == null) return null;
  if (
    metricKey === "xgf_percentage" ||
    metricKey === "one_goal_game_rate" ||
    metricKey === "forward_top_load_index" ||
    metricKey === "defense_pair_top_load_index" ||
    metricKey === "pp1_pp2_usage_share"
  ) {
    return `${value.toFixed(1)}%`;
  }
  if (metricKey === "shot_quality") return value.toFixed(3);
  if (
    metricKey === "event_rate" ||
    metricKey === "finishing_luck" ||
    metricKey === "save_luck" ||
    metricKey === "net_luck" ||
    metricKey === "xgf60" ||
    metricKey === "xga60" ||
    metricKey === "home_road_point_pct_gap" ||
    metricKey === "pp_opportunity_rate" ||
    metricKey === "penalties_taken_per_60"
  ) {
    return value.toFixed(2);
  }
  return value.toFixed(1);
}

const MIN_TEAM_UNIT_LABEL_GAMES = 3;

export function buildTeamUnitMetricInterpretation(args: {
  metricLabel: string;
  coverage: TeamUnitMetricCoverage;
}) {
  const coverageQualified =
    args.coverage.status === "complete" &&
    args.coverage.games >= MIN_TEAM_UNIT_LABEL_GAMES;
  if (coverageQualified) {
    return {
      label: `${args.metricLabel} coverage-qualified`,
      coverageQualified,
      minimumGames: MIN_TEAM_UNIT_LABEL_GAMES,
      reason: `${args.coverage.games} complete resolved games support this unit-usage label.`,
    };
  }
  return {
    label: `${args.metricLabel} coverage-limited`,
    coverageQualified,
    minimumGames: MIN_TEAM_UNIT_LABEL_GAMES,
    reason:
      args.coverage.status === "source_gap"
        ? "No resolved unit-usage games are available for this label."
        : `${args.coverage.games} resolved games with ${args.coverage.status} coverage; require ${MIN_TEAM_UNIT_LABEL_GAMES} complete games before naming a team top-load style.`,
  };
}

export const TEAM_STYLE_INSUFFICIENT_LABEL = "Insufficient data";

function deriveStyleBadge(args: {
  paceAxis: string | null;
  controlAxis: string | null;
}) {
  // Decision 102: the style label is a composite of pace and control; refuse it
  // when either input is missing instead of naming a one-axis or default style.
  if (args.paceAxis == null || args.controlAxis == null) {
    return TEAM_STYLE_INSUFFICIENT_LABEL;
  }
  if (args.paceAxis === "high_event" && args.controlAxis === "controls_play") {
    return "High-event controller";
  }
  if (args.paceAxis === "high_event" && args.controlAxis === "chasing_play") {
    return "High-event chasing";
  }
  if (args.paceAxis === "low_event" && args.controlAxis === "controls_play") {
    return "Low-event controller";
  }
  if (args.paceAxis === "low_event" && args.controlAxis === "chasing_play") {
    return "Low-event chasing";
  }
  if (args.controlAxis === "controls_play") return "Controls play";
  if (args.controlAxis === "chasing_play") return "Chasing play";
  if (args.paceAxis === "high_event") return "High-event";
  if (args.paceAxis === "low_event") return "Low-event";
  return "Balanced raw profile";
}

function metricValue(args: {
  power: TeamPowerRow;
  style: ReturnType<typeof buildStylePayload>;
  context: TeamGameContextAggregate | null;
  unitUsage: TeamUnitUsageAggregate | null;
  metricKey: TeamMatrixMetricKey;
}) {
  const { power, style, context, unitUsage, metricKey } = args;
  if (metricKey === "off_rating") return finite(power.off_rating);
  if (metricKey === "def_rating") return finite(power.def_rating);
  if (metricKey === "xgf60") return finite(power.xgf60);
  if (metricKey === "xga60") return finite(power.xga60);
  if (metricKey === "pace_rating") return finite(power.pace_rating);
  if (metricKey === "special_rating") return finite(power.special_rating);
  if (metricKey === "xgf_percentage") return style.xgForPercentage;
  if (metricKey === "shot_quality") return style.shotQuality;
  if (metricKey === "event_rate") return style.eventRate;
  if (metricKey === "finishing_luck") return style.luck.finishingLuck;
  if (metricKey === "save_luck") return style.luck.saveLuck;
  if (metricKey === "net_luck") return style.luck.netGoalsAboveExpected;
  if (metricKey === "one_goal_game_rate") return context?.oneGoalGameRate ?? null;
  if (metricKey === "home_road_point_pct_gap") {
    return context?.homeRoadPointPctGap ?? null;
  }
  if (metricKey === "pp_opportunity_rate") {
    return context?.powerPlayOpportunityRate ?? null;
  }
  if (metricKey === "penalties_taken_per_60") {
    return context?.penaltiesTakenPer60 ?? null;
  }
  if (metricKey === "forward_top_load_index") {
    return unitUsage?.forwardTopLoadIndex ?? null;
  }
  if (metricKey === "defense_pair_top_load_index") {
    return unitUsage?.defensePairTopLoadIndex ?? null;
  }
  if (metricKey === "pp1_pp2_usage_share") {
    return unitUsage?.pp1Pp2UsageShare ?? null;
  }
  return null;
}

export function rankTeamMetricValues<T extends { id: string; value: number | null }>(
  rows: T[],
  lowerIsBetter: boolean,
) {
  return rankNormalizedMetricValues(
    rows.map((row) => ({
      id: row.id,
      normalizedValue:
        row.value == null ? null : lowerIsBetter ? -row.value : row.value,
    })),
  );
}

const NST_STYLE_FIELDS = ["xgf", "xga", "gf", "ga", "ff", "fa"] as const;

function isCompleteNstStyleGame(row: NstTeamRow) {
  return (
    row.gp === 1 &&
    NST_STYLE_FIELDS.every((key) => {
      const value = finite(row[key]);
      return value != null && value >= 0;
    })
  );
}

/**
 * Team style from one qualified xG source only: Natural Stat Trick 5v5
 * (decision 6). The in-house bucket-heuristic xG is never read (decision 12),
 * so one ranked column never mixes models. NST 5v5 has no empty-net states
 * (a pulled goalie makes it 6v5), which keeps empty-net shots out (decision 7).
 *
 * Coverage (rule 13): every eligible game in the ledger needs exactly one
 * complete NST row for the same team and date. Counts and their exposure then
 * come from the same games; otherwise the totals stay unknown and the coverage
 * is reported instead of a partial sum.
 */
export function aggregateNstTeamStyleLedger(args: {
  eligibleGames: readonly TeamStyleLedgerGame[];
  nstRows: readonly NstTeamRow[];
}): Map<string, TeamStyleAggregate> {
  const nstRowsByTeamDate = new Map<string, NstTeamRow[]>();
  for (const row of args.nstRows) {
    const key = `${row.team_abbreviation}:${row.date}`;
    const current = nstRowsByTeamDate.get(key) ?? [];
    current.push(row);
    nstRowsByTeamDate.set(key, current);
  }

  const ledgerByTeam = new Map<string, { teamId: number | null; dates: Set<string> }>();
  for (const game of args.eligibleGames) {
    const entry = ledgerByTeam.get(game.teamAbbreviation) ?? {
      teamId: game.teamId,
      dates: new Set<string>(),
    };
    entry.dates.add(game.date);
    ledgerByTeam.set(game.teamAbbreviation, entry);
  }

  const aggregates = new Map<string, TeamStyleAggregate>();
  for (const [abbreviation, ledger] of ledgerByTeam) {
    const coveredRows: NstTeamRow[] = [];
    for (const date of ledger.dates) {
      const rows = nstRowsByTeamDate.get(`${abbreviation}:${date}`) ?? [];
      if (rows.length === 1 && isCompleteNstStyleGame(rows[0])) {
        coveredRows.push(rows[0]);
      }
    }
    const eligibleGames = ledger.dates.size;
    const coverageComplete = eligibleGames > 0 && coveredRows.length === eligibleGames;
    const total = (key: (typeof NST_STYLE_FIELDS)[number]) =>
      coverageComplete ? sum(coveredRows.map((row) => row[key])) : null;
    aggregates.set(abbreviation, {
      teamId: ledger.teamId,
      teamAbbreviation: abbreviation,
      gamesCount: coverageComplete ? eligibleGames : 0,
      eligibleGames,
      coveredGames: coveredRows.length,
      coverageComplete,
      latestDate: coverageComplete
        ? coveredRows.reduce<string | null>(
            (latest, row) => (latest == null || row.date > latest ? row.date : latest),
            null,
          )
        : null,
      xgf: total("xgf"),
      xga: total("xga"),
      gf: total("gf"),
      ga: total("ga"),
      ff: total("ff"),
      fa: total("fa"),
      source: "nst_team_5v5",
    });
  }
  return aggregates;
}

export function aggregateTeamGameContextRows(
  rows: readonly TeamGameContextRow[],
): Map<number, TeamGameContextAggregate> {
  const rowsByTeam = new Map<number, TeamGameContextRow[]>();
  for (const row of rows) {
    if (row.team_id == null) continue;
    const current = rowsByTeam.get(row.team_id) ?? [];
    current.push(row);
    rowsByTeam.set(row.team_id, current);
  }

  const aggregates = new Map<number, TeamGameContextAggregate>();
  for (const [teamId, teamRows] of rowsByTeam.entries()) {
    const uniqueGameIds = new Set(
      teamRows.map((row) => row.game_id ?? `${row.date}-${teamId}`),
    );
    const context = calculateTeamGameContextComponents({
      games: teamRows.map((row) => ({
        goalsFor: row.goals_for,
        goalsAgainst: row.goals_against,
        pointPct: row.point_pct,
        homeRoad: row.home_road,
        powerPlayOpportunitiesPerGame: row.pp_opportunities_per_game,
        penaltiesTakenPer60: row.penalties_taken_per_60,
      })),
    });
    aggregates.set(teamId, {
      teamId,
      gamesCount: uniqueGameIds.size,
      latestDate: teamRows.reduce<string | null>(
        (latest, row) => (latest == null || row.date > latest ? row.date : latest),
        null,
      ),
      oneGoalGameRate: context.oneGoalGameRate,
      homeRoadPointPctGap: context.homeRoadPointPctGap,
      powerPlayOpportunityRate: context.powerPlayOpportunityRate,
      penaltiesTakenPer60: context.penaltiesTakenPer60,
    });
  }

  return aggregates;
}

export function aggregateTeamUnitToiRows(
  rows: readonly TeamUnitToiRow[],
): Map<number, TeamUnitUsageAggregate> {
  type TeamGameUsage = {
    gameId: number;
    gameDate: string | null;
    snapshotDate: string | null;
    forwardTopShare: number | null;
    defenseTopShare: number | null;
    ppTopTwoSeconds: number;
    ppPoolSeconds: number | null;
    forwardCoverageStatus: TeamUnitMetricCoverageStatus | null;
    defenseCoverageStatus: TeamUnitMetricCoverageStatus | null;
    ppCoverageStatuses: TeamUnitMetricCoverageStatus[];
    forwardCoverageWarnings: string[];
    defenseCoverageWarnings: string[];
    ppCoverageWarnings: string[];
  };

  const collectWarnings = (warnings: TeamUnitToiRow["coverage_warnings"]) =>
    Array.isArray(warnings)
      ? warnings.filter((warning): warning is string => typeof warning === "string")
      : [];

  const usageByTeamGame = new Map<number, Map<number, TeamGameUsage>>();
  for (const row of rows) {
    const teamGames = usageByTeamGame.get(row.team_id) ?? new Map();
    const usage =
      teamGames.get(row.game_id) ??
      ({
        gameId: row.game_id,
        gameDate: row.game_date,
        snapshotDate: row.snapshot_date,
        forwardTopShare: null,
        defenseTopShare: null,
        ppTopTwoSeconds: 0,
        ppPoolSeconds: null,
        forwardCoverageStatus: null,
        defenseCoverageStatus: null,
        ppCoverageStatuses: [],
        forwardCoverageWarnings: [],
        defenseCoverageWarnings: [],
        ppCoverageWarnings: [],
      } satisfies TeamGameUsage);

    if (row.game_date != null) usage.gameDate = row.game_date;
    usage.snapshotDate = row.snapshot_date;
    const coverageWarnings = collectWarnings(row.coverage_warnings);

    if (row.unit_type === "forward_line" && row.unit_number === 1) {
      usage.forwardTopShare =
        row.unit_share == null ? null : round(row.unit_share * 100);
      usage.forwardCoverageStatus = row.coverage_status;
      usage.forwardCoverageWarnings.push(...coverageWarnings);
    }
    if (row.unit_type === "defense_pair" && row.unit_number === 1) {
      usage.defenseTopShare =
        row.unit_share == null ? null : round(row.unit_share * 100);
      usage.defenseCoverageStatus = row.coverage_status;
      usage.defenseCoverageWarnings.push(...coverageWarnings);
    }
    if (row.unit_type === "power_play") {
      const poolSeconds = finite(row.team_unit_pool_toi_seconds);
      if (poolSeconds != null && poolSeconds > 0) usage.ppPoolSeconds = poolSeconds;
      const unitSeconds = finite(row.unit_toi_seconds);
      if (row.unit_number <= 2 && unitSeconds != null) {
        usage.ppTopTwoSeconds += unitSeconds;
      }
      usage.ppCoverageStatuses.push(row.coverage_status);
      usage.ppCoverageWarnings.push(...coverageWarnings);
    }

    teamGames.set(row.game_id, usage);
    usageByTeamGame.set(row.team_id, teamGames);
  }

  const buildCoverage = (args: {
    games: TeamGameUsage[];
    values: Array<number | null>;
    statuses: (game: TeamGameUsage) => TeamUnitMetricCoverageStatus[];
    warnings: (game: TeamGameUsage) => string[];
  }): TeamUnitMetricCoverage => {
    const gamesWithValue = args.games.filter((game, index) => args.values[index] != null);
    const statuses = args.games.flatMap(args.statuses);
    const warnings = Array.from(new Set(args.games.flatMap(args.warnings))).sort();
    const hasPartialStatus = statuses.some((status) => status !== "complete");
    const status: TeamUnitMetricCoverageStatus =
      gamesWithValue.length === 0
        ? "source_gap"
        : gamesWithValue.length < args.games.length || hasPartialStatus
          ? "partial"
          : "complete";
    return {
      games: gamesWithValue.length,
      latestDate: gamesWithValue.reduce<string | null>(
        (latest, game) =>
          game.gameDate == null || (latest != null && game.gameDate <= latest)
            ? latest
            : game.gameDate,
        null,
      ),
      snapshotDate: gamesWithValue.reduce<string | null>(
        (latest, game) =>
          game.snapshotDate == null ||
          (latest != null && game.snapshotDate <= latest)
            ? latest
            : game.snapshotDate,
        null,
      ),
      status,
      warnings,
    };
  };

  const aggregates = new Map<number, TeamUnitUsageAggregate>();
  for (const [teamId, teamGames] of usageByTeamGame.entries()) {
    const games = Array.from(teamGames.values());
    const forwardShares = games.map((game) => game.forwardTopShare);
    const defenseShares = games.map((game) => game.defenseTopShare);
    const ppShares = games.map((game) =>
      game.ppPoolSeconds == null || game.ppPoolSeconds <= 0
        ? null
        : round((game.ppTopTwoSeconds / game.ppPoolSeconds) * 100),
    );
    aggregates.set(teamId, {
      teamId,
      gamesCount: games.length,
      latestDate: games.reduce<string | null>(
        (latest, game) =>
          game.gameDate == null || (latest != null && game.gameDate <= latest)
            ? latest
            : game.gameDate,
        null,
      ),
      snapshotDate: games.reduce<string | null>(
        (latest, game) =>
          game.snapshotDate == null || (latest != null && game.snapshotDate <= latest)
            ? latest
            : game.snapshotDate,
        null,
      ),
      forwardTopLoadIndex: average(forwardShares),
      defensePairTopLoadIndex: average(defenseShares),
      pp1Pp2UsageShare: average(ppShares),
      coverage: {
        forwardTopLoad: buildCoverage({
          games,
          values: forwardShares,
          statuses: (game) =>
            game.forwardCoverageStatus == null ? [] : [game.forwardCoverageStatus],
          warnings: (game) => game.forwardCoverageWarnings,
        }),
        defensePairTopLoad: buildCoverage({
          games,
          values: defenseShares,
          statuses: (game) =>
            game.defenseCoverageStatus == null ? [] : [game.defenseCoverageStatus],
          warnings: (game) => game.defenseCoverageWarnings,
        }),
        pp1Pp2UsageShare: buildCoverage({
          games,
          values: ppShares,
          statuses: (game) => game.ppCoverageStatuses,
          warnings: (game) => game.ppCoverageWarnings,
        }),
      },
    });
  }

  return aggregates;
}

function buildStylePayload(args: {
  aggregate: TeamStyleAggregate | null;
  source: TeamStyleAggregate["source"] | "none";
  leagueAverageEventRate: number | null;
}) {
  const aggregate = args.aggregate;
  const xgForPercentage = calculateTeamExpectedGoalsForPercentage({
    xgFor: aggregate?.xgf ?? null,
    xgAgainst: aggregate?.xga ?? null,
  });
  const shotQuality = calculateTeamShotQuality({
    xgFor: aggregate?.xgf ?? null,
    fenwickFor: aggregate?.ff ?? null,
  });
  const profile = calculateRunAndGunProfile({
    xgFor: aggregate?.xgf ?? null,
    xgAgainst: aggregate?.xga ?? null,
    gamesCount: aggregate?.gamesCount ?? null,
    leagueAverageEventRate: args.leagueAverageEventRate,
  });
  const luck = calculateTeamLuckComponents({
    goalsFor: aggregate?.gf ?? null,
    goalsAgainst: aggregate?.ga ?? null,
    xgFor: aggregate?.xgf ?? null,
    xgAgainst: aggregate?.xga ?? null,
  });
  return {
    label: deriveStyleBadge({
      paceAxis: profile.paceAxis,
      controlAxis: profile.controlAxis,
    }),
    paceAxis: profile.paceAxis,
    controlAxis: profile.controlAxis,
    xgForPercentage,
    eventRate: profile.eventRate,
    shotQuality,
    source: args.source,
    adjusted: false as const,
    luck,
  };
}

type TeamEventWindow = { startDate: string; endDate: string };

async function fetchTeamSeasonWindow(
  request: TeamMatrixRequest,
): Promise<TeamEventWindow> {
  const { data, error } = await supabase
    .from("seasons")
    .select("startDate,regularSeasonEndDate")
    .eq("id", request.season)
    .maybeSingle();
  if (error) throw new Error(`Unable to load team season bounds: ${error.message}`);

  const dateOnly = (value: unknown) => {
    if (typeof value !== "string") return null;
    const date = value.slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
    const parsed = new Date(`${date}T00:00:00.000Z`);
    return Number.isFinite(parsed.getTime()) &&
      parsed.toISOString().slice(0, 10) === date
      ? date
      : null;
  };
  const startDate = dateOnly(data?.startDate);
  const seasonEndDate = dateOnly(data?.regularSeasonEndDate);
  if (startDate == null || seasonEndDate == null || startDate > seasonEndDate) {
    throw new ContextualRankingsQueryError(
      "No valid regular-season date bounds available for requested season",
    );
  }
  return {
    startDate,
    endDate:
      request.asOfDate != null && request.asOfDate < seasonEndDate
        ? request.asOfDate
        : seasonEndDate,
  };
}

async function fetchLatestPowerDate(window: TeamEventWindow) {
  const { data, error } = await supabase
    .from("team_power_ratings_daily")
    .select("date")
    .gte("date", window.startDate)
    .lte("date", window.endDate)
    .order("date", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`Unable to load team power date: ${error.message}`);
  return data?.date ?? null;
}

async function fetchTeamPowerRows(date: string) {
  const { data, error } = await supabase
    .from("team_power_ratings_daily")
    .select(
      [
        "team_abbreviation",
        "date",
        "off_rating",
        "def_rating",
        "pace_rating",
        "xgf60",
        "gf60",
        "sf60",
        "xga60",
        "ga60",
        "sa60",
        "pace60",
        "trend10",
        "pp_tier",
        "pk_tier",
        "finishing_rating",
        "goalie_rating",
        "danger_rating",
        "special_rating",
        "discipline_rating",
        "variance_flag",
      ].join(","),
    )
    .eq("date", date)
    .order("off_rating", { ascending: false });
  if (error) throw new Error(`Unable to load team power rows: ${error.message}`);
  return (data ?? []) as unknown as TeamPowerRow[];
}

async function fetchTeamMeta() {
  const { data, error } = await supabase
    .from("teams")
    .select("id,abbreviation,name");
  if (error) throw new Error(`Unable to load team metadata: ${error.message}`);
  const rows = (data ?? []) as TeamMeta[];
  return {
    byId: new Map(rows.map((row) => [row.id, row])),
    byAbbreviation: new Map(
      rows
        .filter((row) => row.abbreviation != null)
        .map((row) => [row.abbreviation as string, row]),
    ),
  };
}

async function fetchNstTeamRows(window: TeamEventWindow, abbreviations: string[]) {
  // The season-total table is all-strength and has no historical cutoff.
  // This dedicated table is written by the counts5v5 path; legacy rows may
  // still have situation="all", so do not infer strength from that field.
  const rows: NstTeamRow[] = [];
  for (let from = 0;; from += TEAM_QUERY_PAGE_SIZE) {
    const { data, error } = await supabase
      .from("nst_team_5v5")
      .select("date,team_abbreviation,gp,xgf,xga,gf,ga,ff,fa,cf,ca")
      .in("team_abbreviation", abbreviations)
      .gte("date", window.startDate)
      .lte("date", window.endDate)
      .order("date", { ascending: false })
      .order("team_abbreviation", { ascending: true })
      .range(from, from + TEAM_QUERY_PAGE_SIZE - 1);
    if (error) throw new Error(`Unable to load NST 5v5 team rows: ${error.message}`);
    rows.push(...((data ?? []) as unknown as NstTeamRow[]));
    if ((data ?? []).length < TEAM_QUERY_PAGE_SIZE) break;
  }
  return rows;
}

async function fetchTeamGameContextRows(
  request: TeamMatrixRequest,
  window: TeamEventWindow,
) {
  const rows: TeamGameContextRow[] = [];
  for (let from = 0;; from += TEAM_QUERY_PAGE_SIZE) {
    let query = supabase
      .from("wgo_team_stats")
      .select(
        [
          "date",
          "team_id",
          "game_id",
          "goals_for",
          "goals_against",
          "point_pct",
          "pp_opportunities_per_game",
          "penalties_taken_per_60",
        ].join(","),
      )
      .eq("season_id", request.season)
      .order("date", { ascending: false })
      .order("id", { ascending: true })
      .range(from, from + TEAM_QUERY_PAGE_SIZE - 1);
    query = query.gte("date", window.startDate).lte("date", window.endDate);
    const { data, error } = await query;
    if (error) {
      throw new Error(`Unable to load team game context rows: ${error.message}`);
    }
    rows.push(...((data ?? []) as unknown as TeamGameContextRow[]));
    if ((data ?? []).length < TEAM_QUERY_PAGE_SIZE) break;
  }

  return rows;
}

async function fetchRegularSeasonGames(
  request: TeamMatrixRequest,
  window: TeamEventWindow,
) {
  const rows: GameVenueRow[] = [];
  for (let from = 0;; from += TEAM_QUERY_PAGE_SIZE) {
    const { data, error } = await supabase
      .from("games")
      .select("id,date,homeTeamId,awayTeamId")
      .eq("seasonId", request.season)
      .eq("type", 2)
      .gte("date", window.startDate)
      .lte("date", window.endDate)
      .order("date", { ascending: false })
      .order("id", { ascending: true })
      .range(from, from + TEAM_QUERY_PAGE_SIZE - 1);
    if (error) throw new Error(`Unable to load regular-season games: ${error.message}`);
    rows.push(...((data ?? []) as unknown as GameVenueRow[]));
    if ((data ?? []).length < TEAM_QUERY_PAGE_SIZE) break;
  }
  return new Map(rows.map((row) => [Number(row.id), row]));
}

async function fetchLatestTeamUnitToiSnapshotDate(request: TeamMatrixRequest) {
  let query = supabase
    .from("team_unit_toi")
    .select("snapshot_date")
    .eq("season_id", request.season)
    .order("snapshot_date", { ascending: false })
    .limit(1);
  if (request.asOfDate != null) {
    query = query.lte("snapshot_date", request.asOfDate);
  }
  const { data, error } = await query.maybeSingle();
  if (error) throw new Error(`Unable to load team unit-TOI snapshot: ${error.message}`);
  return data?.snapshot_date ?? null;
}

async function fetchTeamUnitToiRows(
  request: TeamMatrixRequest,
  window: TeamEventWindow,
) {
  const snapshotDate = await fetchLatestTeamUnitToiSnapshotDate(request);
  if (snapshotDate == null) {
    return { snapshotDate: null, rows: [] as TeamUnitToiRow[] };
  }

  const rows: TeamUnitToiRow[] = [];
  for (let from = 0;; from += TEAM_QUERY_PAGE_SIZE) {
    let query = supabase
      .from("team_unit_toi")
      .select(TEAM_UNIT_TOI_SELECT)
      .eq("season_id", request.season)
      .eq("snapshot_date", snapshotDate)
      .order("game_date", { ascending: false })
      .order("id", { ascending: true })
      .range(from, from + TEAM_QUERY_PAGE_SIZE - 1);
    query = query.gte("game_date", window.startDate).lte("game_date", window.endDate);
    const { data, error } = await query;
    if (error) throw new Error(`Unable to load team unit-TOI rows: ${error.message}`);
    rows.push(...((data ?? []) as TeamUnitToiRow[]));
    if ((data ?? []).length < TEAM_QUERY_PAGE_SIZE) break;
  }

  return { snapshotDate, rows };
}

function latestStyleDate(aggregates: Iterable<TeamStyleAggregate>) {
  let latest: string | null = null;
  for (const aggregate of aggregates) {
    if (aggregate.latestDate == null) continue;
    if (latest == null || aggregate.latestDate > latest) latest = aggregate.latestDate;
  }
  return latest;
}

export async function buildTeamMatrixSurface(
  request: TeamMatrixRequest,
): Promise<TeamMatrixResponse> {
  const cacheKey = JSON.stringify(request);
  const now = Date.now();
  const cached = teamMatrixResponseCache.get(cacheKey);
  if (cached && cached.expiresAt > now) return cached.response;

  const seasonWindow = await fetchTeamSeasonWindow(request);
  const latestPowerDate = await fetchLatestPowerDate(seasonWindow);
  if (latestPowerDate == null) {
    throw new ContextualRankingsQueryError("No team power snapshot available");
  }
  // All event-backed components stop at the selected power snapshot, even
  // when a more recent source row exists.
  const eventWindow = { ...seasonWindow, endDate: latestPowerDate };
  const minGp = request.minGp ?? DEFAULT_TEAM_MIN_GP;
  const [powerRows, teamMeta, gameContextRows, unitToi, gamesById] =
    await Promise.all([
      fetchTeamPowerRows(latestPowerDate),
      fetchTeamMeta(),
      fetchTeamGameContextRows(request, eventWindow),
      fetchTeamUnitToiRows(request, eventWindow),
      fetchRegularSeasonGames(request, eventWindow),
    ]);
  const belongsToTeamGame = (
    gameId: number | null | undefined,
    teamId: number | null,
  ) => {
    const game = gameId == null ? null : gamesById.get(gameId);
    return game != null && teamId != null &&
      (game.homeTeamId === teamId || game.awayTeamId === teamId);
  };
  const qualifiedContextRows = gameContextRows.filter((row) =>
    belongsToTeamGame(row.game_id, row.team_id),
  );
  const contextByTeamId = aggregateTeamGameContextRows(
    qualifiedContextRows.map((row) => ({
      ...row,
      home_road:
        gamesById.get(row.game_id!)?.homeTeamId === row.team_id ? "home" : "road",
    })),
  );
  const qualifiedUnitRows = unitToi.rows.filter((row) =>
    belongsToTeamGame(row.game_id, row.team_id),
  );
  const unitUsageByTeamId = aggregateTeamUnitToiRows(qualifiedUnitRows);

  // Every ranked team reads the same NST 5v5 source: no per-team fallback.
  const styleTeams = Array.from(new Set(powerRows.map((row) => row.team_abbreviation)));
  const nstRows = styleTeams.length > 0
    ? await fetchNstTeamRows(eventWindow, styleTeams)
    : [];
  // Eligible ledger: regular-season team-games in the window with evidence that
  // they were played (a final WGO result row, or an NST row with a game played).
  const resultTeamGames = new Set(
    qualifiedContextRows
      .filter((row) => finite(row.goals_for) != null && finite(row.goals_against) != null)
      .map((row) => `${row.game_id}:${row.team_id}`),
  );
  const nstPlayedTeamDates = new Set(
    nstRows
      .filter((row) => row.gp != null && row.gp >= 1)
      .map((row) => `${row.team_abbreviation}:${row.date}`),
  );
  const eligibleGames: TeamStyleLedgerGame[] = [];
  for (const game of gamesById.values()) {
    for (const teamId of [game.homeTeamId, game.awayTeamId]) {
      const abbreviation =
        teamId == null ? null : teamMeta.byId.get(teamId)?.abbreviation;
      if (!abbreviation) continue;
      if (
        resultTeamGames.has(`${game.id}:${teamId}`) ||
        nstPlayedTeamDates.has(`${abbreviation}:${game.date}`)
      ) {
        eligibleGames.push({ teamId, teamAbbreviation: abbreviation, date: game.date });
      }
    }
  }
  const styleByAbbreviation = aggregateNstTeamStyleLedger({ eligibleGames, nstRows });
  const styleQualified = (aggregate: TeamStyleAggregate | null) =>
    aggregate != null &&
    aggregate.coverageComplete &&
    aggregate.gamesCount >= minGp;

  const eventRates = Array.from(styleByAbbreviation.values())
    .filter(styleQualified)
    .map((aggregate) => {
      if (
        aggregate.xgf == null ||
        aggregate.xga == null ||
        aggregate.gamesCount <= 0
      ) {
        return null;
      }
      return (aggregate.xgf + aggregate.xga) / aggregate.gamesCount;
    })
    .filter((value): value is number => value != null && Number.isFinite(value));
  const leagueAverageEventRate =
    eventRates.length > 0
      ? round(eventRates.reduce((total, value) => total + value, 0) / eventRates.length)
      : null;
  const styleSnapshotDate = latestStyleDate(styleByAbbreviation.values());
  const unitUsageSnapshotDate = unitToi.snapshotDate;
  const sourceWarnings = [
    ...(styleSnapshotDate != null && styleSnapshotDate !== latestPowerDate
      ? [
          `team style source snapshot ${styleSnapshotDate} differs from team power snapshot ${latestPowerDate}`,
        ]
      : []),
    "team style is raw/contextual, not score- or venue-adjusted",
    "team xG, shot quality, event rate and luck use Natural Stat Trick (NST) 5v5 xG only; the in-house bucket-heuristic xG is hidden",
    "team style needs NST 5v5 rows for every played game in the window; otherwise it is shown as unavailable with its coverage",
    `teams below ${minGp} games show insufficient sample for style and game-context columns`,
    `team event sources use regular-season dates ${eventWindow.startDate} through ${eventWindow.endDate}`,
    "team power ratings retain their source strength context; only team style inputs are verified as 5v5",
    ...(qualifiedUnitRows.length > 0
      ? [
          "team unit-usage metrics use pooled player-seconds of observed units; units can share players and are not disjoint lineup slots; forward/defense coverage is partial when raw shifts cannot resolve complete 5v5 position groups",
        ]
      : ["team_unit_toi source rows are unavailable for team usage metrics"]),
  ];

  const baseRows = powerRows.map((power) => {
    const aggregate = styleByAbbreviation.get(power.team_abbreviation) ?? null;
    const team = teamMeta.byAbbreviation.get(power.team_abbreviation);
    const rawContext = team?.id == null ? null : contextByTeamId.get(team.id) ?? null;
    const contextQualified =
      rawContext != null && rawContext.gamesCount >= minGp;
    const context = contextQualified ? rawContext : null;
    const unitUsage = team?.id == null ? null : unitUsageByTeamId.get(team.id) ?? null;
    const style = buildStylePayload({
      aggregate: styleQualified(aggregate) ? aggregate : null,
      source: aggregate?.source ?? "none",
      leagueAverageEventRate,
    });
    return { power, aggregate, style, context, rawContext, unitUsage };
  });

  const rankMaps = new Map<
    TeamMatrixMetricKey,
    ReturnType<typeof rankTeamMetricValues>
  >();
  for (const column of METRIC_COLUMNS) {
    rankMaps.set(
      column.metricKey,
      rankTeamMetricValues(
        baseRows.map((row) => ({
          id: row.power.team_abbreviation,
          value: metricValue({
            power: row.power,
            style: row.style,
            context: row.context,
            unitUsage: row.unitUsage,
            metricKey: column.metricKey,
          }),
        })),
        column.lowerIsBetter,
      ),
    );
  }

  const rows = baseRows.map(({ power, aggregate, style, context, rawContext, unitUsage }): TeamMatrixRow => {
    const team = teamMeta.byAbbreviation.get(power.team_abbreviation);
    const metrics = Object.fromEntries(
      METRIC_COLUMNS.map((column) => {
        const value = metricValue({
          power,
          style,
          context,
          unitUsage,
          metricKey: column.metricKey,
        });
        const rank = rankMaps.get(column.metricKey)?.get(power.team_abbreviation);
        return [
          column.metricKey,
          {
            rawValue: value,
            formattedValue: formatMetricValue(column.metricKey, value),
            rank: rank?.rank ?? null,
            percentile: rank?.percentile ?? null,
            qualifiedPeerCount: rank?.qualifiedPeerCount ?? 0,
            lowerIsBetter: column.lowerIsBetter,
          },
        ];
      }),
    ) as Record<TeamMatrixMetricKey, RankedMetric>;
    const sortCell = metrics[request.metric];
    return {
      team: {
        id: team?.id ?? aggregate?.teamId ?? null,
        abbreviation: power.team_abbreviation,
        name: team?.name ?? null,
      },
      record: {
        latestPowerDate,
        styleSnapshotDate: aggregate?.latestDate ?? null,
        styleGames: aggregate?.gamesCount ?? 0,
        styleCoverage: {
          eligibleGames: aggregate?.eligibleGames ?? 0,
          coveredGames: aggregate?.coveredGames ?? 0,
          complete: aggregate?.coverageComplete ?? false,
        },
        ppTier: finite(power.pp_tier),
        pkTier: finite(power.pk_tier),
        trend10: finite(power.trend10),
      },
      style: {
        label: style.label,
        descriptorType: "raw_contextual",
        displayLabel: `${style.label} (raw/contextual)`,
        adjustedTargetLabel: TEAM_STYLE_SOURCE_CONTRACT.adjustedTargetLabel,
        adjustedStatus: "source_pending",
        interpretation:
          "Environment descriptor from current raw/contextual 5v5 inputs; not a coach/system claim.",
        paceAxis: style.paceAxis,
        controlAxis: style.controlAxis,
        xgForPercentage: style.xgForPercentage,
        eventRate: style.eventRate,
        shotQuality: style.shotQuality,
        source: style.source,
        adjusted: false,
      },
      luck: style.luck,
      context: {
        games: rawContext?.gamesCount ?? 0,
        latestDate: rawContext?.latestDate ?? null,
        oneGoalGameRate: context?.oneGoalGameRate ?? null,
        homeRoadPointPctGap: context?.homeRoadPointPctGap ?? null,
        powerPlayOpportunityRate: context?.powerPlayOpportunityRate ?? null,
        penaltiesTakenPer60: context?.penaltiesTakenPer60 ?? null,
      },
      unitUsage: {
        games: unitUsage?.gamesCount ?? 0,
        latestDate: unitUsage?.latestDate ?? null,
        snapshotDate: unitUsage?.snapshotDate ?? unitUsageSnapshotDate,
        forwardTopLoadIndex: unitUsage?.forwardTopLoadIndex ?? null,
        defensePairTopLoadIndex: unitUsage?.defensePairTopLoadIndex ?? null,
        pp1Pp2UsageShare: unitUsage?.pp1Pp2UsageShare ?? null,
        coverage: unitUsage?.coverage ?? emptyTeamUnitCoverage(unitUsageSnapshotDate),
        labels: (() => {
          const coverage =
            unitUsage?.coverage ?? emptyTeamUnitCoverage(unitUsageSnapshotDate);
          return {
            forwardTopLoad: buildTeamUnitMetricInterpretation({
              metricLabel: "Forward top load",
              coverage: coverage.forwardTopLoad,
            }),
            defensePairTopLoad: buildTeamUnitMetricInterpretation({
              metricLabel: "Defense pair top load",
              coverage: coverage.defensePairTopLoad,
            }),
            pp1Pp2UsageShare: buildTeamUnitMetricInterpretation({
              metricLabel: "PP1/PP2 usage share",
              coverage: coverage.pp1Pp2UsageShare,
            }),
          };
        })(),
      },
      sort: {
        metricKey: request.metric,
        rank: sortCell.rank,
        percentile: sortCell.percentile,
      },
      metrics,
      warnings: [
        ...(aggregate == null ? ["team_style_source_missing"] : []),
        ...(aggregate != null && !aggregate.coverageComplete
          ? [`nst_5v5_coverage_incomplete:${aggregate.coveredGames}/${aggregate.eligibleGames}`]
          : []),
        ...(aggregate?.coverageComplete && aggregate.gamesCount < minGp
          ? [`insufficient_sample:${aggregate.gamesCount}<${minGp}`]
          : []),
        ...(rawContext == null ? ["team_game_context_source_missing"] : []),
        ...(rawContext != null && rawContext.gamesCount < minGp
          ? [`insufficient_context_sample:${rawContext.gamesCount}<${minGp}`]
          : []),
        ...(unitUsage == null ? ["team_unit_toi_source_missing"] : []),
        "raw_contextual_team_style",
      ],
    };
  });

  rows.sort((a, b) => {
    const aCell = a.metrics[request.metric];
    const bCell = b.metrics[request.metric];
    if (aCell.rank != null && bCell.rank == null) return -1;
    if (aCell.rank == null && bCell.rank != null) return 1;
    if (aCell.rank != null && bCell.rank != null) {
      return request.sortDirection === "asc"
        ? bCell.rank - aCell.rank || a.team.abbreviation.localeCompare(b.team.abbreviation)
        : aCell.rank - bCell.rank || a.team.abbreviation.localeCompare(b.team.abbreviation);
    }
    return a.team.abbreviation.localeCompare(b.team.abbreviation);
  });

  const filteredRows = rows.filter((row) =>
    teamRowMatchesSearch(row, request.search),
  );
  const totalRankedRows = filteredRows.length;
  const pageCount = Math.max(1, Math.ceil(totalRankedRows / request.pageSize));
  const start = (request.page - 1) * request.pageSize;
  const pageRows = filteredRows.slice(start, start + request.pageSize);

  const response: TeamMatrixResponse = {
    success: true,
    request,
    rows: pageRows,
    meta: {
      generatedAt: new Date().toISOString(),
      rowCount: pageRows.length,
      totalRankedRows,
      page: request.page,
      pageSize: request.pageSize,
      pageCount,
      snapshotDate: latestPowerDate,
      latestAvailableSnapshotDate: latestPowerDate,
      styleSnapshotDate,
      sampleFloor: {
        minGames: minGp,
        label: `Min ${minGp} GP; teams below show insufficient sample`,
      },
      sourceTables: [
        "seasons",
        "team_power_ratings_daily",
        "nst_team_5v5",
        "wgo_team_stats",
        "games",
        "team_unit_toi",
      ],
      methodologyVersion: "team_rankings_v3_nst_5v5_ledger",
      methodologyUpdatedAt: "2026-11-11",
      sourceQualityFlags: [
        "raw_contextual_team_style",
        "team_unit_toi_partial_forward_defense_coverage",
      ],
      sourceWarnings,
      teamStyleContract: TEAM_STYLE_SOURCE_CONTRACT,
      sourcePendingMetricContracts: [
        ...TEAM_SOURCE_PENDING_METRIC_CONTRACTS,
        ...TEAM_ADJUSTED_STYLE_SOURCE_CONTRACTS,
      ],
      metricColumns: METRIC_COLUMNS,
    },
  };
  teamMatrixResponseCache.set(cacheKey, {
    expiresAt: now + TEAM_MATRIX_RESPONSE_CACHE_TTL_MS,
    response,
  });
  return response;
}
