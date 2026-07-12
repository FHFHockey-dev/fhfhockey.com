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

type TeamUnderlyingRow = {
  game_date: string;
  team_id: number;
  xgf: number;
  xga: number;
  gf: number;
  ga: number;
  ff: number;
  fa: number;
  cf: number;
  ca: number;
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
  homeTeamId: number | null;
  awayTeamId: number | null;
};

type NstTeamRow = {
  team_abbreviation: string;
  team_name: string | null;
  gp: number | null;
  xgf: number | null;
  xga: number | null;
  gf: number | null;
  ga: number | null;
  ff: number | null;
  fa: number | null;
  cf: number | null;
  ca: number | null;
  pdo: number | null;
  situation: string | null;
};

type TeamMeta = {
  id: number;
  abbreviation: string | null;
  name: string | null;
};

type TeamStyleAggregate = {
  teamId: number | null;
  teamAbbreviation: string;
  gamesCount: number;
  latestDate: string | null;
  xgf: number | null;
  xga: number | null;
  gf: number | null;
  ga: number | null;
  ff: number | null;
  fa: number | null;
  cf: number | null;
  ca: number | null;
  source: "team_underlying_stats_summary" | "nst_team_stats" | "none";
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
    description: "Expected goals for per 60 from current team power ratings.",
    lowerIsBetter: false,
    source: "team_power_ratings_daily.xgf60",
  },
  {
    metricKey: "xga60",
    label: "xGA/60",
    description: "Expected goals against per 60. Lower raw values are better.",
    lowerIsBetter: true,
    source: "team_power_ratings_daily.xga60",
  },
  {
    metricKey: "xgf_percentage",
    label: "xGF%",
    description: "Raw five-on-five expected-goals control share.",
    lowerIsBetter: false,
    source: "team_underlying_stats_summary fiveOnFive allScores",
  },
  {
    metricKey: "shot_quality",
    label: "Shot Quality",
    description: "Raw xGF per Fenwick-for attempt.",
    lowerIsBetter: false,
    source: "teamStyleMethodology.calculateTeamShotQuality",
  },
  {
    metricKey: "event_rate",
    label: "Event Rate",
    description: "Raw five-on-five xG event rate per team game.",
    lowerIsBetter: false,
    source: "teamStyleMethodology.calculateRunAndGunProfile",
  },
  {
    metricKey: "finishing_luck",
    label: "Fin Luck",
    description: "Goals for above expected goals for.",
    lowerIsBetter: false,
    source: "teamStyleMethodology.calculateTeamLuckComponents",
  },
  {
    metricKey: "save_luck",
    label: "Save Luck",
    description: "Expected goals against minus goals against.",
    lowerIsBetter: false,
    source: "teamStyleMethodology.calculateTeamLuckComponents",
  },
  {
    metricKey: "net_luck",
    label: "Net Luck",
    description: "Finishing luck plus save luck.",
    lowerIsBetter: false,
    source: "teamStyleMethodology.calculateTeamLuckComponents",
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

function deriveStyleBadge(args: {
  paceAxis: string | null;
  controlAxis: string | null;
}) {
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

export function aggregateTeamStyleRows(args: {
  rows: readonly TeamUnderlyingRow[];
  teamsById: Map<number, TeamMeta>;
}): Map<string, TeamStyleAggregate> {
  const rowsByTeam = new Map<number, TeamUnderlyingRow[]>();
  for (const row of args.rows) {
    const current = rowsByTeam.get(row.team_id) ?? [];
    current.push(row);
    rowsByTeam.set(row.team_id, current);
  }

  const aggregates = new Map<string, TeamStyleAggregate>();
  for (const [teamId, rows] of rowsByTeam.entries()) {
    const team = args.teamsById.get(teamId);
    if (!team?.abbreviation) continue;
    const uniqueGameIds = new Set(rows.map((row) => `${row.game_date}-${row.team_id}`));
    aggregates.set(team.abbreviation, {
      teamId,
      teamAbbreviation: team.abbreviation,
      gamesCount: uniqueGameIds.size,
      latestDate: rows.reduce<string | null>(
        (latest, row) =>
          latest == null || row.game_date > latest ? row.game_date : latest,
        null,
      ),
      xgf: sum(rows.map((row) => row.xgf)),
      xga: sum(rows.map((row) => row.xga)),
      gf: sum(rows.map((row) => row.gf)),
      ga: sum(rows.map((row) => row.ga)),
      ff: sum(rows.map((row) => row.ff)),
      fa: sum(rows.map((row) => row.fa)),
      cf: sum(rows.map((row) => row.cf)),
      ca: sum(rows.map((row) => row.ca)),
      source: "team_underlying_stats_summary",
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

function styleAggregateFromNst(row: NstTeamRow): TeamStyleAggregate {
  return {
    teamId: null,
    teamAbbreviation: row.team_abbreviation,
    gamesCount: finite(row.gp) ?? 0,
    latestDate: null,
    xgf: finite(row.xgf),
    xga: finite(row.xga),
    gf: finite(row.gf),
    ga: finite(row.ga),
    ff: finite(row.ff),
    fa: finite(row.fa),
    cf: finite(row.cf),
    ca: finite(row.ca),
    source: "nst_team_stats",
  };
}

function buildStylePayload(args: {
  aggregate: TeamStyleAggregate | null;
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
    source: aggregate?.source ?? "none",
    adjusted: false as const,
    luck,
  };
}

async function fetchLatestPowerDate(asOfDate: string | null) {
  let query = supabase
    .from("team_power_ratings_daily")
    .select("date")
    .order("date", { ascending: false })
    .limit(1);
  if (asOfDate != null) query = query.lte("date", asOfDate);
  const { data, error } = await query.maybeSingle();
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

async function fetchUnderlyingStyleRows(request: TeamMatrixRequest) {
  const rows: TeamUnderlyingRow[] = [];
  for (let from = 0;; from += TEAM_QUERY_PAGE_SIZE) {
    let query = supabase
      .from("team_underlying_stats_summary")
      .select("game_date,team_id,xgf,xga,gf,ga,ff,fa,cf,ca")
      .eq("season_id", request.season)
      .eq("strength", "fiveOnFive")
      .eq("score_state", "allScores")
      .order("game_date", { ascending: false })
      .range(from, from + TEAM_QUERY_PAGE_SIZE - 1);
    if (request.asOfDate != null) query = query.lte("game_date", request.asOfDate);
    const { data, error } = await query;
    if (error) {
      throw new Error(`Unable to load team style source rows: ${error.message}`);
    }
    rows.push(...((data ?? []) as unknown as TeamUnderlyingRow[]));
    if ((data ?? []).length < TEAM_QUERY_PAGE_SIZE) break;
  }
  return rows;
}

async function fetchNstTeamRows(season: number) {
  const { data, error } = await supabase
    .from("nst_team_stats")
    .select("team_abbreviation,team_name,gp,xgf,xga,gf,ga,ff,fa,cf,ca,pdo,situation")
    .eq("season", season)
    .eq("situation", "all");
  if (error) throw new Error(`Unable to load NST team rows: ${error.message}`);
  return (data ?? []) as unknown as NstTeamRow[];
}

async function fetchTeamGameContextRows(request: TeamMatrixRequest) {
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
      .range(from, from + TEAM_QUERY_PAGE_SIZE - 1);
    if (request.asOfDate != null) query = query.lte("date", request.asOfDate);
    const { data, error } = await query;
    if (error) {
      throw new Error(`Unable to load team game context rows: ${error.message}`);
    }
    rows.push(...((data ?? []) as unknown as TeamGameContextRow[]));
    if ((data ?? []).length < TEAM_QUERY_PAGE_SIZE) break;
  }

  const gameIds = Array.from(
    new Set(
      rows
        .map((row) => finite(row.game_id))
        .filter((gameId): gameId is number => gameId != null),
    ),
  );
  const venuesByGameId = await fetchGameVenueRows(gameIds);
  return rows.map((row) => {
    const gameId = finite(row.game_id);
    const venue = gameId == null ? null : venuesByGameId.get(gameId) ?? null;
    const homeRoad =
      venue == null || row.team_id == null
        ? null
        : row.team_id === venue.homeTeamId
          ? "home"
          : row.team_id === venue.awayTeamId
            ? "road"
            : null;
    return { ...row, home_road: homeRoad };
  });
}

async function fetchGameVenueRows(gameIds: number[]) {
  const rows: GameVenueRow[] = [];
  for (let index = 0; index < gameIds.length; index += TEAM_QUERY_PAGE_SIZE) {
    const chunk = gameIds.slice(index, index + TEAM_QUERY_PAGE_SIZE);
    if (chunk.length === 0) continue;
    const { data, error } = await supabase
      .from("games")
      .select("id,homeTeamId,awayTeamId")
      .in("id", chunk);
    if (error) throw new Error(`Unable to load game venue rows: ${error.message}`);
    rows.push(...((data ?? []) as unknown as GameVenueRow[]));
  }
  return new Map(rows.map((row) => [Number(row.id), row]));
}

async function fetchLatestTeamUnitToiSnapshotDate(season: number) {
  const { data, error } = await supabase
    .from("team_unit_toi")
    .select("snapshot_date")
    .eq("season_id", season)
    .order("snapshot_date", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`Unable to load team unit-TOI snapshot: ${error.message}`);
  return data?.snapshot_date ?? null;
}

async function fetchTeamUnitToiRows(request: TeamMatrixRequest) {
  const snapshotDate = await fetchLatestTeamUnitToiSnapshotDate(request.season);
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
      .range(from, from + TEAM_QUERY_PAGE_SIZE - 1);
    if (request.asOfDate != null) query = query.lte("game_date", request.asOfDate);
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

  const latestPowerDate = await fetchLatestPowerDate(request.asOfDate);
  if (latestPowerDate == null) {
    throw new ContextualRankingsQueryError("No team power snapshot available");
  }
  const [powerRows, teamMeta, underlyingRows, nstRows, gameContextRows, unitToi] =
    await Promise.all([
      fetchTeamPowerRows(latestPowerDate),
      fetchTeamMeta(),
      fetchUnderlyingStyleRows(request),
      fetchNstTeamRows(request.season),
      fetchTeamGameContextRows(request),
      fetchTeamUnitToiRows(request),
    ]);
  const styleByAbbreviation = aggregateTeamStyleRows({
    rows: underlyingRows,
    teamsById: teamMeta.byId,
  });
  const contextByTeamId = aggregateTeamGameContextRows(gameContextRows);
  const unitUsageByTeamId = aggregateTeamUnitToiRows(unitToi.rows);
  for (const row of nstRows) {
    if (!styleByAbbreviation.has(row.team_abbreviation)) {
      styleByAbbreviation.set(row.team_abbreviation, styleAggregateFromNst(row));
    }
  }

  const eventRates = Array.from(styleByAbbreviation.values())
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
    ...(unitToi.rows.length > 0
      ? [
          "team unit-usage metrics use pooled player-seconds; forward/defense overlap coverage is partial when raw shifts cannot resolve complete 5v5 position groups",
        ]
      : ["team_unit_toi source rows are unavailable for team usage metrics"]),
  ];

  const baseRows = powerRows.map((power) => {
    const aggregate = styleByAbbreviation.get(power.team_abbreviation) ?? null;
    const team = teamMeta.byAbbreviation.get(power.team_abbreviation);
    const context = team?.id == null ? null : contextByTeamId.get(team.id) ?? null;
    const unitUsage = team?.id == null ? null : unitUsageByTeamId.get(team.id) ?? null;
    const style = buildStylePayload({ aggregate, leagueAverageEventRate });
    return { power, aggregate, style, context, unitUsage };
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

  const rows = baseRows.map(({ power, aggregate, style, context, unitUsage }): TeamMatrixRow => {
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
        games: context?.gamesCount ?? 0,
        latestDate: context?.latestDate ?? null,
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
        ...(aggregate?.source === "nst_team_stats"
          ? ["team_style_using_season_level_nst_fallback"]
          : []),
        ...(context == null ? ["team_game_context_source_missing"] : []),
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
      sourceTables: [
        "team_power_ratings_daily",
        "team_underlying_stats_summary",
        "nst_team_stats",
        "wgo_team_stats",
        "games",
        "team_unit_toi",
      ],
      methodologyVersion: "team_rankings_v1_team_unit_toi_v1",
      methodologyUpdatedAt: "2026-06-24",
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
