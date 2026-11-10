import type { NextApiRequest } from "next";

import supabase from "lib/supabase/server";

import {
  formatGoalieDeploymentBucket,
  getGoalieDeploymentBucket,
  GOALIE_ROLE_FILTER_OPTIONS,
  isGoalieReallyBadStart,
  isGoalieStealGame,
  type GoalieDeploymentBucket,
  type GoalieRoleFilter,
} from "./goalieMethodology";
import {
  isHistoricalGoalieTeamSource,
  reconcileGoaliePopulation,
  type GoalieGameSourceRow,
  type GoalieScheduleRow,
  type OfficialGoalieAppearanceRow,
  type CompletedGoalieTeamGameRow,
} from "./goaliePopulation";
import { rankNormalizedMetricValues } from "./rankingCalculator";
import { ContextualRankingsQueryError } from "./rankingTypes";

export type GoalieMatrixMetricKey =
  | "save_percentage"
  | "relative_save_percentage"
  | "gsax"
  | "gsaa_per_60"
  | "xga_per_shot_against"
  | "goalie_value_signal"
  | "high_danger_save_percentage"
  | "quality_start_pct"
  | "really_bad_start_rate"
  | "steal_rate"
  | "start_share";

export type GoalieMatrixWindow = "season" | "last5" | "last10" | "last20";
export type GoalieMatrixSortDirection = "asc" | "desc";
export type GoalieMatrixRoleFilter = GoalieRoleFilter;

export type GoalieMatrixRequest = {
  season: number;
  asOfDate: string | null;
  window: GoalieMatrixWindow;
  metric: GoalieMatrixMetricKey;
  sortDirection: GoalieMatrixSortDirection;
  role: GoalieMatrixRoleFilter;
  minStarts: number;
  minShots: number;
  team: string | null;
  search: string | null;
  page: number;
  pageSize: number;
};

type GoalieStartProjectionRow = {
  player_id: number;
  team_id: number | null;
  game_date: string | null;
  start_probability: number | null;
  projected_gsaa_per_60: number | null;
  confirmed_status: boolean | null;
  l10_start_pct: number | null;
  season_start_pct: number | null;
};

type PlayerMeta = {
  id: number;
  fullName: string | null;
  image_url: string | null;
};

type TeamMeta = {
  id: number;
  abbreviation: string | null;
  name: string | null;
};

type GoalieAggregate = {
  playerId: number;
  playerName: string | null;
  teamId: number | null;
  latestGameDate: string | null;
  gamesPlayed: number;
  gamesStarted: number;
  saves: number;
  goalsAgainst: number;
  shotsAgainst: number;
  toiSeconds: number;
  qualityStarts: number;
  reallyBadStarts: number;
  stealGames: number;
  nst5v5ToiSeconds: number;
  nst5v5Gsaa: number | null;
  nst5v5Gsax: number | null;
  nst5v5XgAgainst: number | null;
  nst5v5ShotQualityShotsAgainst: number;
  nst5v5Saves: number;
  nst5v5ShotsAgainst: number;
  nst5v5HighDangerSaves: number;
  nst5v5HighDangerShotsAgainst: number;
  unavailableMetrics: GoalieMatrixMetricKey[];
  sourceWarnings: string[];
};

type GoalieRelativeSaveContext = {
  goalieSavePercentage: number | null;
  teamWithoutGoalieSavePercentage: number | null;
  teamWithoutGoalieSaves: number;
  teamWithoutGoalieShotsAgainst: number;
  relativeSavePercentage: number | null;
  warnings: string[];
};

export type GoalieMatrixMetricCell = {
  metricKey: GoalieMatrixMetricKey;
  rawValue: number | null;
  formattedValue: string | null;
  rank: number | null;
  percentile: number | null;
  qualifiedPeerCount: number;
  lowerIsBetter: boolean;
};

export type GoalieMatrixRow = {
  entity: {
    id: number;
    name: string | null;
    position: "G";
    imageUrl: string | null;
  };
  team: {
    id: number | null;
    abbreviation: string | null;
    name: string | null;
  };
  sample: {
    gamesPlayed: number;
    gamesStarted: number;
    shotsAgainst: number;
    toiSeconds: number;
    minimumSampleMet: boolean;
    confidence: "low" | "medium" | "high";
  };
  role: {
    deploymentBucket: GoalieDeploymentBucket | null;
    deploymentLabel: string | null;
    deploymentSource:
      | "goalie_start_projections.season_start_pct"
      | "adjusted_core_start_share"
      | "selected_window_team_start_share"
      | null;
    rawStartShare: number | null;
    adjustedStartShare: number | null;
    coreStartShare: number | null;
    coreGoalieIds: number[];
    excludedTeamStarts: number;
    roleConfidence: "low" | "medium" | "high";
    roleNotes: string[];
    windowStartShare: number | null;
    startShareLast10: number | null;
    seasonStartShare: number | null;
    startProbability: number | null;
    projectedGsaaPer60: number | null;
    confirmedStatus: boolean | null;
  };
  sort: {
    metricKey: GoalieMatrixMetricKey;
    rank: number | null;
    percentile: number | null;
  };
  metrics: Record<GoalieMatrixMetricKey, GoalieMatrixMetricCell>;
  warnings: string[];
};

export type GoalieMatrixResponse = {
  success: true;
  request: GoalieMatrixRequest;
  rows: GoalieMatrixRow[];
  meta: {
    generatedAt: string;
    rowCount: number;
    totalRankedRows: number;
    page: number;
    pageSize: number;
    pageCount: number;
    snapshotDate: string | null;
    latestAvailableSnapshotDate: string | null;
    sourceTables: string[];
    methodologyVersion?: string;
    methodologyUpdatedAt?: string;
    sourceQualityFlags?: string[];
    metricColumns: Array<{
      metricKey: GoalieMatrixMetricKey;
      label: string;
      description: string;
      lowerIsBetter: boolean;
      source: string;
    }>;
    sourceWarnings: string[];
    sourcePendingMetricContracts: Array<{
      metricKey: string;
      label: string;
      status: "source_pending";
      reason: string;
      requiredFields: string[];
    }>;
  };
};

const GOALIE_QUERY_PAGE_SIZE = 1000;
const METADATA_QUERY_PAGE_SIZE = 1000;
const MAX_PAGE_SIZE = 50;
const DEFAULT_PAGE_SIZE = 10;
const GOALIE_MATRIX_RESPONSE_CACHE_TTL_MS = 30_000;
const MIN_RELATIVE_SAVE_BASELINE_SHOTS = 50;
const goalieMatrixResponseCache = new Map<
  string,
  { expiresAt: number; response: GoalieMatrixResponse }
>();

export function clearGoalieMatrixSurfaceCachesForTests() {
  goalieMatrixResponseCache.clear();
}

const METRIC_COLUMNS: GoalieMatrixResponse["meta"]["metricColumns"] = [
  {
    metricKey: "save_percentage",
    label: "SV%",
    description: "Window save percentage from WGO goalie game logs.",
    lowerIsBetter: false,
    source: "goalie_stats_unified.saves / shots_against",
  },
  {
    metricKey: "relative_save_percentage",
    label: "Rel SV%",
    description:
      "5v5 save percentage versus other goalies on the latest verified team, over the same regular-season team-game window.",
    lowerIsBetter: false,
    source:
      "goalie_stats_unified.nst_5v5_counts_saves / shots against minus same-team other-goalie baseline",
  },
  {
    metricKey: "gsax",
    label: "GSAx",
    description: "5v5 expected goals against minus 5v5 goals against.",
    lowerIsBetter: false,
    source:
      "goalie_stats_unified.nst_5v5_counts_xg_against - nst_5v5_counts_goals_against",
  },
  {
    metricKey: "gsaa_per_60",
    label: "GSAA/60",
    description: "5v5 goals saved above average per 60.",
    lowerIsBetter: false,
    source: "goalie_stats_unified.nst_5v5_counts_gsaa / nst_5v5_counts_toi",
  },
  {
    metricKey: "xga_per_shot_against",
    label: "xGA/Shot",
    description:
      "5v5 expected goals against per 5v5 shot against; higher values indicate a tougher shot-quality workload.",
    lowerIsBetter: false,
    source:
      "goalie_stats_unified.nst_5v5_counts_xg_against / nst_5v5_counts_shots_against",
  },
  {
    metricKey: "goalie_value_signal",
    label: "Value Signal",
    description:
      "Saved-goals value signal averaging cumulative 5v5 GSAx and GSAA when both sources cover the complete window.",
    lowerIsBetter: false,
    source:
      "average of goalie_stats_unified 5v5 GSAx and nst_5v5_counts_gsaa when both are present",
  },
  {
    metricKey: "high_danger_save_percentage",
    label: "HD SV%",
    description: "5v5 high-danger save percentage from NST goalie counts.",
    lowerIsBetter: false,
    source: "goalie_stats_unified.nst_5v5_counts_hd_sv_percentage",
  },
  {
    metricKey: "quality_start_pct",
    label: "QS%",
    description: "Quality starts divided by starts.",
    lowerIsBetter: false,
    source: "goalie_stats_unified.quality_start / games_started",
  },
  {
    metricKey: "really_bad_start_rate",
    label: "RBS%",
    description:
      "Really bad starts divided by starts; lower rates are better.",
    lowerIsBetter: true,
    source:
      "goalieMethodology.isGoalieReallyBadStart over goalie_stats_unified rows",
  },
  {
    metricKey: "steal_rate",
    label: "Steal Rate",
    description: "Starts won with modern GSAx at or above the steal threshold.",
    lowerIsBetter: false,
    source: "goalieMethodology.isGoalieStealGame over goalie_stats_unified rows",
  },
  {
    metricKey: "start_share",
    label: "Start Share",
    description:
      "Role start share from a matching-team projection when available, otherwise verified starts in the latest team's regular-season game window.",
    lowerIsBetter: false,
    source:
      "matching-team goalie_start_projections.season_start_pct or verified selected-window team starts",
  },
];

export const GOALIE_SOURCE_PENDING_METRIC_CONTRACTS: GoalieMatrixResponse["meta"]["sourcePendingMetricContracts"] = [
  {
    metricKey: "under_pressure_profile",
    label: "Under Pressure",
    status: "source_pending",
    reason:
      "Pressure-quadrant source rows are not published as a stable goalie ranking input.",
    requiredFields: [
      "goalie_id",
      "game_id",
      "shot_id",
      "pressure_bucket",
      "rush_attempt_against",
      "rebound_attempt_against",
      "screen_or_traffic_label",
      "shot_result_save_or_goal",
    ],
  },
] as const;

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

function parseGoalieRole(value: string | string[] | undefined): GoalieMatrixRoleFilter {
  const raw = first(value)?.trim().toLowerCase() ?? "all";
  return GOALIE_ROLE_FILTER_OPTIONS.some((option) => option.value === raw)
    ? (raw as GoalieMatrixRoleFilter)
    : "all";
}

export function parseGoalieMatrixRequest(
  query: NextApiRequest["query"],
): GoalieMatrixRequest {
  return {
    season:
      parseInteger(query.season, "season", {
        required: true,
        min: 19000000,
        max: 21000000,
      }) ?? 0,
    asOfDate: parseDate(query.as_of_date),
    window: parseEnum(
      query.window,
      "window",
      ["season", "last5", "last10", "last20"] as const,
      "season",
    ),
    metric: parseEnum(
      query.metric,
      "metric",
      METRIC_COLUMNS.map((column) => column.metricKey) as GoalieMatrixMetricKey[],
      "save_percentage",
    ),
    sortDirection: parseEnum(
      query.sort_direction,
      "sort_direction",
      ["asc", "desc"] as const,
      "desc",
    ),
    role: parseGoalieRole(query.role ?? query.goalie_role),
    minStarts: parseInteger(query.min_starts, "min_starts", {
      defaultValue: 3,
      min: 0,
    }) ?? 3,
    minShots: parseInteger(query.min_shots, "min_shots", {
      defaultValue: 100,
      min: 0,
    }) ?? 100,
    team: parseSearch(query.team),
    search: parseSearch(query.search),
    page: parseInteger(query.page, "page", {
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

function goalieRowMatchesSearch(row: GoalieMatrixRow, search: string | null) {
  if (!search) return true;
  const needle = search.toLowerCase();
  return [
    row.entity.name,
    String(row.entity.id),
    row.team.abbreviation,
    row.team.name,
  ]
    .filter((value): value is string => typeof value === "string")
    .some((value) => value.toLowerCase().includes(needle));
}

function finite(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return value;
}

function nonnegative(value: unknown): number | null {
  const number = finite(value);
  return number != null && number >= 0 ? number : null;
}

function round(value: number, decimals = 6) {
  return Number(value.toFixed(decimals));
}

function windowLimit(window: GoalieMatrixWindow) {
  if (window === "last5") return 5;
  if (window === "last10") return 10;
  if (window === "last20") return 20;
  return null;
}

function formatMetricValue(metricKey: GoalieMatrixMetricKey, value: number | null) {
  if (value == null) return null;
  if (
    metricKey === "save_percentage" ||
    metricKey === "relative_save_percentage" ||
    metricKey === "quality_start_pct" ||
    metricKey === "really_bad_start_rate" ||
    metricKey === "steal_rate" ||
    metricKey === "start_share" ||
    metricKey === "high_danger_save_percentage"
  ) {
    return `${(value * 100).toFixed(1)}%`;
  }
  if (metricKey === "xga_per_shot_against") return value.toFixed(3);
  if (metricKey === "gsaa_per_60") return value.toFixed(2);
  return value.toFixed(1);
}

export function calculateGoalieXgaPerShotAgainst(args: {
  xgAgainst: number | null;
  shotsAgainst: number;
}) {
  return args.xgAgainst != null && args.shotsAgainst > 0
    ? round(args.xgAgainst / args.shotsAgainst)
    : null;
}

export function calculateGoalieValueSignal(args: {
  gsax: number | null;
  gsaa: number | null;
}) {
  const values = [args.gsax, args.gsaa].filter(
    (value): value is number => value != null,
  );
  return values.length > 0
    ? round(values.reduce((sum, value) => sum + value, 0) / values.length)
    : null;
}

export function calculateGoalieHighDangerSavePercentage(args: {
  saves: number;
  shotsAgainst: number;
}) {
  return args.shotsAgainst > 0 ? round(args.saves / args.shotsAgainst) : null;
}

export function calculateGoalieRelativeSavePercentage(args: {
  goalieSaves: number;
  goalieShotsAgainst: number;
  teamWithoutGoalieSaves: number;
  teamWithoutGoalieShotsAgainst: number;
  minBaselineShots?: number;
}) {
  const minBaselineShots =
    args.minBaselineShots ?? MIN_RELATIVE_SAVE_BASELINE_SHOTS;
  if (
    args.goalieShotsAgainst <= 0 ||
    args.teamWithoutGoalieShotsAgainst < minBaselineShots
  ) {
    return null;
  }
  return round(
    args.goalieSaves / args.goalieShotsAgainst -
      args.teamWithoutGoalieSaves / args.teamWithoutGoalieShotsAgainst,
  );
}

function metricValue(
  aggregate: GoalieAggregate,
  projection: GoalieStartProjectionRow | null,
  metricKey: GoalieMatrixMetricKey,
  roleContext?: ReturnType<typeof buildGoalieRoleContext>,
  relativeContext?: GoalieRelativeSaveContext | null,
) {
  // Relative SV% has its own matched team-game sample, separate from the
  // player's appearance window (which can span multiple teams).
  if (metricKey === "relative_save_percentage") {
    return relativeContext?.relativeSavePercentage ?? null;
  }
  if (aggregate.unavailableMetrics.includes(metricKey)) return null;
  if (metricKey === "save_percentage") {
    return aggregate.shotsAgainst > 0
      ? round(aggregate.saves / aggregate.shotsAgainst)
      : null;
  }
  if (metricKey === "quality_start_pct") {
    return aggregate.gamesStarted > 0
      ? round(aggregate.qualityStarts / aggregate.gamesStarted)
      : null;
  }
  if (metricKey === "steal_rate") {
    return aggregate.gamesStarted > 0
      ? round(aggregate.stealGames / aggregate.gamesStarted)
      : null;
  }
  if (metricKey === "really_bad_start_rate") {
    return aggregate.gamesStarted > 0
      ? round(aggregate.reallyBadStarts / aggregate.gamesStarted)
      : null;
  }
  if (metricKey === "gsax") return aggregate.nst5v5Gsax;
  if (metricKey === "xga_per_shot_against") {
    return calculateGoalieXgaPerShotAgainst({
      xgAgainst: aggregate.nst5v5XgAgainst,
      shotsAgainst: aggregate.nst5v5ShotQualityShotsAgainst,
    });
  }
  if (metricKey === "goalie_value_signal") {
    return calculateGoalieValueSignal({
      gsax: aggregate.nst5v5Gsax,
      gsaa: aggregate.nst5v5Gsaa,
    });
  }
  if (metricKey === "high_danger_save_percentage") {
    return calculateGoalieHighDangerSavePercentage({
      saves: aggregate.nst5v5HighDangerSaves,
      shotsAgainst: aggregate.nst5v5HighDangerShotsAgainst,
    });
  }
  if (metricKey === "gsaa_per_60") {
    return aggregate.nst5v5Gsaa != null && aggregate.nst5v5ToiSeconds > 0
      ? round((aggregate.nst5v5Gsaa / aggregate.nst5v5ToiSeconds) * 3600)
      : null;
  }
  if (metricKey === "start_share") {
    return (
      finite(projection?.season_start_pct) ??
      roleContext?.adjustedStartShare ??
      roleContext?.rawStartShare ??
      null
    );
  }
  return null;
}

function sampleConfidence(args: {
  starts: number;
  shots: number;
  minStarts: number;
  minShots: number;
}) {
  if (args.starts < args.minStarts || args.shots < args.minShots) return "low";
  const startMultiple = args.minStarts > 0 ? args.starts / args.minStarts : 2;
  const shotMultiple = args.minShots > 0 ? args.shots / args.minShots : 2;
  const sampleMultiple = Math.min(startMultiple, shotMultiple);
  if (sampleMultiple >= 2) return "high";
  return "medium";
}

function roleMatchesFilter(
  bucket: GoalieDeploymentBucket | null,
  filter: GoalieMatrixRoleFilter,
) {
  return filter === "all" || bucket === filter;
}

export function aggregateGoalieGameRows(
  rows: readonly GoalieGameSourceRow[],
  window: GoalieMatrixWindow,
): GoalieAggregate[] {
  const rowsByGoalie = new Map<number, GoalieGameSourceRow[]>();
  for (const row of rows) {
    const current = rowsByGoalie.get(row.player_id) ?? [];
    current.push(row);
    rowsByGoalie.set(row.player_id, current);
  }

  const limit = windowLimit(window);
  const aggregates: GoalieAggregate[] = [];
  for (const [playerId, goalieRows] of rowsByGoalie.entries()) {
    const selectedRows = [...goalieRows]
      .sort((a, b) => b.date.localeCompare(a.date) || (b.game_id ?? 0) - (a.game_id ?? 0))
      .slice(0, limit ?? undefined);
    const latestRow = selectedRows[0] ?? null;
    let gamesPlayed = 0;
    let gamesStarted = 0;
    let saves = 0;
    let goalsAgainst = 0;
    let shotsAgainst = 0;
    let toiSeconds = 0;
    let qualityStarts = 0;
    let reallyBadStarts = 0;
    let stealGames = 0;
    let nst5v5ToiSeconds = 0;
    let nst5v5Gsaa = 0;
    let nst5v5GsaaRows = 0;
    let nst5v5Gsax = 0;
    let nst5v5GsaxRows = 0;
    let nst5v5XgAgainst = 0;
    let nst5v5XgAgainstRows = 0;
    let nst5v5ShotQualityShotsAgainst = 0;
    let nst5v5Saves = 0;
    let nst5v5ShotsAgainst = 0;
    let nst5v5HighDangerSaves = 0;
    let nst5v5HighDangerShotsAgainst = 0;
    const warnings = new Set<string>(selectedRows.flatMap((row) => row.populationWarnings ?? []));
    const unavailableMetrics = new Set<GoalieMatrixMetricKey>();
    const markUnavailable = (metrics: GoalieMatrixMetricKey[], warning: string) => {
      metrics.forEach((metric) => unavailableMetrics.add(metric));
      warnings.add(warning);
    };

    // Values describe the entire selected window. Keep an incomplete metric
    // unavailable until a separate covered-sample contract can describe it.
    for (const row of selectedRows) {
      if (row.relativeSavePopulationComplete === false) {
        markUnavailable(["relative_save_percentage"], "partial_goalie_relative_population");
      }
      const starts = nonnegative(row.games_started);
      const officialSaves = nonnegative(row.saves);
      const officialShots = nonnegative(row.shots_against);
      gamesPlayed += nonnegative(row.games_played) ?? 0;
      gamesStarted += starts ?? 0;
      saves += officialSaves ?? 0;
      goalsAgainst += nonnegative(row.goals_against) ?? 0;
      shotsAgainst += officialShots ?? 0;
      toiSeconds += nonnegative(row.time_on_ice) ?? 0;
      if (
        officialSaves == null ||
        officialShots == null ||
        officialSaves > officialShots
      ) {
        markUnavailable(["save_percentage"], "partial_wgo_save_source");
      }

      const gsaa = finite(row.nst_5v5_counts_gsaa);
      const nstToi = nonnegative(row.nst_5v5_counts_toi);
      if (gsaa != null && nstToi != null && (nstToi > 0 || gsaa === 0)) {
        nst5v5Gsaa += gsaa;
        nst5v5ToiSeconds += nstToi;
        nst5v5GsaaRows += 1;
      } else {
        markUnavailable(
          ["gsaa_per_60", "goalie_value_signal"],
          "partial_nst_5v5_gsaa_source",
        );
      }

      const xgAgainst = nonnegative(row.nst_5v5_counts_xg_against);
      const nstGoalsAgainst = nonnegative(row.nst_5v5_counts_goals_against);
      const nstShotsAgainst = nonnegative(row.nst_5v5_counts_shots_against);
      if (xgAgainst != null && nstShotsAgainst != null) {
        nst5v5XgAgainst += xgAgainst;
        nst5v5ShotQualityShotsAgainst += nstShotsAgainst;
        nst5v5XgAgainstRows += 1;
      } else {
        markUnavailable(
          ["xga_per_shot_against"],
          "partial_nst_5v5_shot_quality_source",
        );
      }

      const nstSaves = nonnegative(row.nst_5v5_counts_saves);
      if (nstSaves != null && nstShotsAgainst != null && nstSaves <= nstShotsAgainst) {
        nst5v5Saves += nstSaves;
        nst5v5ShotsAgainst += nstShotsAgainst;
      } else {
        markUnavailable(
          ["relative_save_percentage"],
          "partial_nst_5v5_relative_save_source",
        );
      }

      const highDangerSaves = nonnegative(row.nst_5v5_counts_hd_saves);
      const highDangerShots = nonnegative(row.nst_5v5_counts_hd_shots_against);
      if (
        highDangerSaves != null &&
        highDangerShots != null &&
        highDangerSaves <= highDangerShots
      ) {
        nst5v5HighDangerSaves += highDangerSaves;
        nst5v5HighDangerShotsAgainst += highDangerShots;
      } else {
        markUnavailable(
          ["high_danger_save_percentage"],
          "partial_nst_5v5_high_danger_source",
        );
      }

      const gsax =
        xgAgainst != null && nstGoalsAgainst != null
          ? xgAgainst - nstGoalsAgainst
          : null;
      if (gsax != null) {
        nst5v5Gsax += gsax;
        nst5v5GsaxRows += 1;
      } else {
        markUnavailable(
          ["gsax", "goalie_value_signal"],
          "partial_nst_5v5_gsax_source",
        );
      }

      if (starts == null) {
        markUnavailable(
          ["quality_start_pct", "really_bad_start_rate", "steal_rate"],
          "partial_goalie_start_source",
        );
      } else if (starts > 0) {
        const qualityStart = nonnegative(row.quality_start);
        if (qualityStart != null && qualityStart <= starts) {
          qualityStarts += qualityStart;
        } else {
          markUnavailable(["quality_start_pct"], "partial_quality_start_source");
        }
        const wins = nonnegative(row.wins);
        if (wins == null) {
          markUnavailable(["steal_rate"], "partial_goalie_steal_source");
        }
        if (gsax == null) {
          markUnavailable(
            ["really_bad_start_rate", "steal_rate"],
            "partial_nst_5v5_start_quality_source",
          );
        } else {
          const methodologyGame = {
            goalieId: row.player_id,
            date: row.date,
            started: true,
            shotsAgainst: officialShots,
            saves: officialSaves,
            goalsAgainst: nstGoalsAgainst,
            goalsSavedAboveExpected: gsax,
            won: wins != null && wins > 0,
          };
          if (isGoalieReallyBadStart(methodologyGame)) reallyBadStarts += 1;
          if (isGoalieStealGame(methodologyGame)) stealGames += 1;
        }
      }
    }

    aggregates.push({
      playerId,
      playerName: latestRow?.player_name ?? null,
      teamId: isHistoricalGoalieTeamSource(latestRow?.team_id_source)
        ? latestRow?.team_id ?? null
        : null,
      latestGameDate: latestRow?.date ?? null,
      gamesPlayed,
      gamesStarted,
      saves,
      goalsAgainst,
      shotsAgainst,
      toiSeconds,
      qualityStarts,
      reallyBadStarts,
      stealGames,
      nst5v5ToiSeconds,
      nst5v5Gsaa: nst5v5GsaaRows > 0 ? round(nst5v5Gsaa) : null,
      nst5v5Gsax: nst5v5GsaxRows > 0 ? round(nst5v5Gsax) : null,
      nst5v5XgAgainst:
        nst5v5XgAgainstRows > 0 ? round(nst5v5XgAgainst) : null,
      nst5v5ShotQualityShotsAgainst,
      nst5v5Saves,
      nst5v5ShotsAgainst,
      nst5v5HighDangerSaves,
      nst5v5HighDangerShotsAgainst,
      unavailableMetrics: [...unavailableMetrics],
      sourceWarnings: [
        ...warnings,
        ...(isHistoricalGoalieTeamSource(latestRow?.team_id_source) && latestRow?.team_id != null
          ? []
          : ["partial_goalie_team_attribution"]),
      ],
    });
  }

  return aggregates;
}

export function buildGoalieRelativeSaveContexts(
  aggregates: readonly GoalieAggregate[],
) {
  const teamTotals = new Map<
    number,
    { saves: number; shotsAgainst: number; incompleteGoalieIds: number[] }
  >();
  for (const aggregate of aggregates) {
    if (aggregate.teamId == null) continue;
    const current = teamTotals.get(aggregate.teamId) ?? {
      saves: 0,
      shotsAgainst: 0,
      incompleteGoalieIds: [],
    };
    if (aggregate.unavailableMetrics.includes("relative_save_percentage")) {
      current.incompleteGoalieIds.push(aggregate.playerId);
    }
    current.saves += aggregate.nst5v5Saves;
    current.shotsAgainst += aggregate.nst5v5ShotsAgainst;
    teamTotals.set(aggregate.teamId, current);
  }

  const contexts = new Map<number, GoalieRelativeSaveContext>();
  for (const aggregate of aggregates) {
    const teamTotal =
      aggregate.teamId == null ? null : teamTotals.get(aggregate.teamId) ?? null;
    const teamWithoutGoalieSaves =
      teamTotal == null ? 0 : teamTotal.saves - aggregate.nst5v5Saves;
    const teamWithoutGoalieShotsAgainst =
      teamTotal == null
        ? 0
        : teamTotal.shotsAgainst - aggregate.nst5v5ShotsAgainst;
    const ownSourceComplete = !aggregate.unavailableMetrics.includes(
      "relative_save_percentage",
    );
    const baselineSourceComplete = !teamTotal?.incompleteGoalieIds.some(
      (playerId) => playerId !== aggregate.playerId,
    );
    const relativeSavePercentage =
      ownSourceComplete && baselineSourceComplete
        ? calculateGoalieRelativeSavePercentage({
            goalieSaves: aggregate.nst5v5Saves,
            goalieShotsAgainst: aggregate.nst5v5ShotsAgainst,
            teamWithoutGoalieSaves,
            teamWithoutGoalieShotsAgainst,
          })
        : null;
    const warnings = [
      ownSourceComplete ? null : "partial_nst_5v5_relative_save_source",
      baselineSourceComplete ? null : "partial_team_without_goalie_5v5_save_source",
      aggregate.nst5v5ShotsAgainst <= 0 ? "missing_goalie_5v5_save_sample" : null,
      teamWithoutGoalieShotsAgainst < MIN_RELATIVE_SAVE_BASELINE_SHOTS
        ? "low_team_without_goalie_5v5_save_sample"
        : null,
    ].filter((warning): warning is string => typeof warning === "string");

    contexts.set(aggregate.playerId, {
      goalieSavePercentage:
        ownSourceComplete && aggregate.nst5v5ShotsAgainst > 0
          ? round(aggregate.nst5v5Saves / aggregate.nst5v5ShotsAgainst)
          : null,
      teamWithoutGoalieSavePercentage:
        baselineSourceComplete && teamWithoutGoalieShotsAgainst > 0
          ? round(teamWithoutGoalieSaves / teamWithoutGoalieShotsAgainst)
          : null,
      teamWithoutGoalieSaves,
      teamWithoutGoalieShotsAgainst,
      relativeSavePercentage,
      warnings,
    });
  }
  return contexts;
}

type GoalieTeamWorkloadContext = {
  teamStarts: number;
  startsByGoalie: Map<number, number>;
  coreGoalieIds: number[];
  coreStarts: number;
};

function buildTeamWorkloadContexts(aggregates: readonly GoalieAggregate[]) {
  const byTeamId = new Map<number, GoalieAggregate[]>();
  for (const aggregate of aggregates) {
    if (aggregate.teamId == null) continue;
    const current = byTeamId.get(aggregate.teamId) ?? [];
    current.push(aggregate);
    byTeamId.set(aggregate.teamId, current);
  }

  const contexts = new Map<number, GoalieTeamWorkloadContext>();
  for (const [teamId, teamGoalies] of byTeamId.entries()) {
    const coreGoalies = [...teamGoalies]
      .filter((goalie) => goalie.gamesStarted > 0)
      .sort((a, b) => b.gamesStarted - a.gamesStarted || a.playerId - b.playerId)
      .slice(0, 2);
    contexts.set(teamId, {
      teamStarts: teamGoalies.reduce((sum, goalie) => sum + goalie.gamesStarted, 0),
      startsByGoalie: new Map(teamGoalies.map((goalie) => [goalie.playerId, goalie.gamesStarted])),
      coreGoalieIds: coreGoalies.map((goalie) => goalie.playerId),
      coreStarts: coreGoalies.reduce((sum, goalie) => sum + goalie.gamesStarted, 0),
    });
  }
  return contexts;
}

function buildGoalieTeamContexts(
  rows: readonly GoalieGameSourceRow[],
  games: readonly GoalieScheduleRow[],
  window: GoalieMatrixWindow,
) {
  const gamesByTeam = new Map<number, GoalieScheduleRow[]>();
  const rowsByTeamGame = new Map<string, GoalieGameSourceRow[]>();
  for (const game of games) {
    for (const teamId of [game.homeTeamId, game.awayTeamId]) {
      if (teamId == null) continue;
      const current = gamesByTeam.get(teamId) ?? [];
      current.push(game);
      gamesByTeam.set(teamId, current);
    }
  }
  for (const row of rows) {
    if (row.team_id == null) continue;
    const key = `${row.team_id}:${row.game_id ?? row.date}`;
    const current = rowsByTeamGame.get(key) ?? [];
    current.push(row);
    rowsByTeamGame.set(key, current);
  }

  const workloads = new Map<number, GoalieTeamWorkloadContext>();
  const relativeSaves = new Map<number, Map<number, GoalieRelativeSaveContext>>();
  const warnings = new Map<number, string[]>();
  for (const [teamId, teamGames] of gamesByTeam) {
    const selectedGames = [...teamGames]
      .sort((a, b) => b.date.localeCompare(a.date) || a.id - b.id)
      .slice(0, windowLimit(window) ?? undefined);
    const selectedRows: GoalieGameSourceRow[] = [];
    let complete = true;
    for (const game of selectedGames) {
      const appearances = rowsByTeamGame.get(`${teamId}:${game.id}`) ?? [];
      // Official appearance identity is player/game. Missing games, unknown
      // historical teams and conflicting starts cannot establish a denominator.
      if (
        appearances.length === 0 ||
        new Set(appearances.map((row) => row.player_id)).size !== appearances.length ||
        appearances.some((row) =>
          !isHistoricalGoalieTeamSource(row.team_id_source) ||
          (row.games_started !== 0 && row.games_started !== 1),
        ) ||
        appearances.reduce((sum, row) => sum + (row.games_started ?? 0), 0) !== 1
      ) {
        complete = false;
      }
      selectedRows.push(...appearances);
    }
    if (!complete) {
      warnings.set(teamId, ["partial_goalie_team_game_coverage"]);
      continue;
    }
    // Filter by the team's calendar first, then pool all its appearances. Do
    // not combine each goalie's independent last-N games or reassign old stints.
    const teamAggregates = aggregateGoalieGameRows(selectedRows, "season");
    const workload = buildTeamWorkloadContexts(teamAggregates).get(teamId);
    if (workload) workloads.set(teamId, workload);
    relativeSaves.set(teamId, buildGoalieRelativeSaveContexts(teamAggregates));
  }
  return { workloads, relativeSaves, warnings };
}

function buildGoalieRoleContext(args: {
  aggregate: GoalieAggregate;
  projection: GoalieStartProjectionRow | null;
  workloadContexts: Map<number, GoalieTeamWorkloadContext>;
}) {
  const workloadContext =
    args.aggregate.teamId == null
      ? null
      : args.workloadContexts.get(args.aggregate.teamId) ?? null;
  const teamStarts = workloadContext?.teamStarts ?? null;
  const goalieTeamStarts = workloadContext?.startsByGoalie.get(args.aggregate.playerId) ?? 0;
  const rawStartShare = teamStarts != null && teamStarts > 0
    ? round(goalieTeamStarts / teamStarts)
    : null;
  const isCoreGoalie = Boolean(
    workloadContext?.coreGoalieIds.includes(args.aggregate.playerId),
  );
  const coreStartShare =
    workloadContext != null && workloadContext.coreStarts > 0 && isCoreGoalie
      ? round(goalieTeamStarts / workloadContext.coreStarts)
      : null;
  // Top-two membership alone is not evidence of an emergency replacement or
  // an absent starter. Keep core share descriptive; exclude no team starts.
  const adjustedStartShare = null;
  const projectedSeasonShare = finite(args.projection?.season_start_pct);
  const roleShare = projectedSeasonShare ?? rawStartShare;
  const deploymentBucket = getGoalieDeploymentBucket(roleShare);
  const roleConfidence: GoalieMatrixRow["role"]["roleConfidence"] =
    projectedSeasonShare != null
      ? args.projection?.confirmed_status === true
        ? "high"
        : "medium"
      : workloadContext != null && workloadContext.coreGoalieIds.length >= 2
        ? isCoreGoalie
          ? "medium"
          : "low"
        : "low";
  const roleNotes = [
    teamStarts == null
      ? "Verified team-game start denominator unavailable."
      : `Raw window share uses ${goalieTeamStarts} starts out of ${teamStarts} starts on the latest verified team, over the same regular-season team-game window.`,
    "Player performance uses the selected appearance window across teams; team workload and relative SV% use the latest verified team's game window.",
    "Core share is descriptive only. No team starts are excluded without verified absence and emergency-replacement evidence.",
    projectedSeasonShare != null
      ? "Matching-team projected season start share is available and remains the primary role source."
      : "Matching-team projected season start share is unavailable; role uses verified selected-window team workload.",
  ];

  return {
    deploymentBucket,
    deploymentLabel: formatGoalieDeploymentBucket(deploymentBucket),
    deploymentSource:
      projectedSeasonShare != null
        ? "goalie_start_projections.season_start_pct" as const
        : rawStartShare != null
          ? "selected_window_team_start_share" as const
          : null,
    rawStartShare,
    adjustedStartShare,
    coreStartShare,
    coreGoalieIds: workloadContext?.coreGoalieIds ?? [],
    excludedTeamStarts: 0,
    roleConfidence,
    roleNotes,
    windowStartShare: rawStartShare,
  };
}

export function buildGoalieRoleContextForTests(args: {
  aggregate: GoalieAggregate;
  projection: GoalieStartProjectionRow | null;
  aggregates: readonly GoalieAggregate[];
}) {
  return buildGoalieRoleContext({
    aggregate: args.aggregate,
    projection: args.projection,
    workloadContexts: buildTeamWorkloadContexts(args.aggregates),
  });
}

export function rankGoalieMetricValues<T extends { id: number; value: number | null }>(
  rows: T[],
  lowerIsBetter = false,
) {
  return rankNormalizedMetricValues(
    rows.map((row) => ({
      id: row.id,
      normalizedValue:
        row.value == null ? null : lowerIsBetter ? -row.value : row.value,
    })),
  );
}

async function fetchAllGoalieGameRows(request: GoalieMatrixRequest) {
  const rows: GoalieGameSourceRow[] = [];
  for (let from = 0;; from += GOALIE_QUERY_PAGE_SIZE) {
    let query = supabase
      .from("goalie_stats_unified" as any)
      .select(
        [
          "player_id",
          "date",
          "season_id",
          "team_id",
          "team_id_source",
          "player_name",
          "games_played",
          "games_started",
          "wins",
          "saves",
          "goals_against",
          "shots_against",
          "time_on_ice",
          "quality_start",
          "nst_5v5_counts_toi",
          "nst_5v5_counts_xg_against",
          "nst_5v5_counts_goals_against",
          "nst_5v5_counts_gsaa",
          "nst_5v5_counts_saves",
          "nst_5v5_counts_shots_against",
          "nst_5v5_counts_hd_saves",
          "nst_5v5_counts_hd_shots_against",
          "nst_5v5_counts_hd_sv_percentage",
        ].join(","),
      )
      .eq("season_id", request.season)
      .order("date", { ascending: false })
      .order("player_id", { ascending: true })
      .range(from, from + GOALIE_QUERY_PAGE_SIZE - 1);
    if (request.asOfDate != null) {
      query = query.lte("date", request.asOfDate);
    }
    const { data, error } = await query;
    if (error) {
      throw new Error(`Unable to load goalie ranking source rows: ${error.message}`);
    }
    rows.push(...((data ?? []) as unknown as GoalieGameSourceRow[]));
    if ((data ?? []).length < GOALIE_QUERY_PAGE_SIZE) break;
  }
  return rows;
}

async function fetchGoalieTeamGames(season: number, through: string | null) {
  if (through == null) return [];
  const rows: GoalieScheduleRow[] = [];
  for (let from = 0;; from += GOALIE_QUERY_PAGE_SIZE) {
    const { data, error } = await supabase
      .from("games")
      .select("id,date,seasonId,type,homeTeamId,awayTeamId")
      .eq("seasonId", season)
      .lte("date", through)
      .order("date", { ascending: false })
      .order("id", { ascending: true })
      .range(from, from + GOALIE_QUERY_PAGE_SIZE - 1);
    if (error) throw new Error(`Unable to load goalie team games: ${error.message}`);
    rows.push(...((data ?? []) as unknown as GoalieScheduleRow[]));
    if ((data ?? []).length < GOALIE_QUERY_PAGE_SIZE) break;
  }
  return rows;
}

function resolveGoalieTeamFilterIds(team: string | null, teams: readonly TeamMeta[]) {
  if (team == null || team.trim() === "") return null;
  const normalized = team.trim().toLowerCase();
  if (/^\d+$/.test(normalized)) return [Number(normalized)];
  return teams.filter((row) =>
    row.abbreviation?.toLowerCase() === normalized || row.name?.toLowerCase() === normalized,
  ).map((row) => row.id);
}

async function fetchOfficialGoalieAppearances(request: GoalieMatrixRequest, through: string) {
  const rows: OfficialGoalieAppearanceRow[] = [];
  for (let from = 0; from < 10_000; from += GOALIE_QUERY_PAGE_SIZE) {
    const { data, error } = await supabase.from("wgo_goalie_stats")
      .select("goalie_id,goalie_name,game_id,date,season_id,team_abbreviation,home_road,games_played,games_started,wins,saves,shots_against,goals_against,time_on_ice,quality_start")
      .eq("season_id", request.season).lte("date", through)
      .order("date", { ascending: false }).order("game_id", { ascending: true })
      .order("goalie_id", { ascending: true })
      .range(from, from + GOALIE_QUERY_PAGE_SIZE - 1);
    if (error) throw new Error(`Unable to load official goalie appearances: ${error.message}`);
    rows.push(...((data ?? []) as unknown as OfficialGoalieAppearanceRow[]));
    if ((data ?? []).length < GOALIE_QUERY_PAGE_SIZE) return rows;
  }
  throw new Error("Official goalie appearance read exceeded its 10,000-row safety bound.");
}

async function fetchCompletedGoalieTeamGames(request: GoalieMatrixRequest, through: string) {
  const rows: CompletedGoalieTeamGameRow[] = [];
  for (let from = 0; from < 5_000; from += GOALIE_QUERY_PAGE_SIZE) {
    const { data, error } = await supabase.from("wgo_team_stats")
      .select("game_id,date,season_id,team_id")
      .eq("season_id", request.season).lte("date", through)
      .order("date", { ascending: false }).order("game_id", { ascending: true })
      .order("team_id", { ascending: true })
      .range(from, from + GOALIE_QUERY_PAGE_SIZE - 1);
    if (error) throw new Error(`Unable to load completed goalie team games: ${error.message}`);
    rows.push(...((data ?? []) as unknown as CompletedGoalieTeamGameRow[]));
    if ((data ?? []).length < GOALIE_QUERY_PAGE_SIZE) return rows;
  }
  throw new Error("Completed goalie team-game read exceeded its 5,000-row safety bound.");
}

async function fetchLatestStartProjections(args: {
  season: number;
  asOfDate: string | null;
}) {
  const rows: GoalieStartProjectionRow[] = [];
  for (let from = 0;; from += GOALIE_QUERY_PAGE_SIZE) {
    let query = supabase
      .from("goalie_start_projections" as any)
      .select(
        [
          "player_id",
          "team_id",
          "game_date",
          "start_probability",
          "projected_gsaa_per_60",
          "confirmed_status",
          "l10_start_pct",
          "season_start_pct",
        ].join(","),
      )
      .gte("game_date", `${String(args.season).slice(0, 4)}-07-01`)
      .order("game_date", { ascending: false })
      .order("game_id", { ascending: true })
      .order("player_id", { ascending: true })
      .range(from, from + GOALIE_QUERY_PAGE_SIZE - 1);
    if (args.asOfDate != null) {
      query = query.lte("game_date", args.asOfDate);
    }
    const { data, error } = await query;
    if (error) {
      throw new Error(`Unable to load goalie start projections: ${error.message}`);
    }
    rows.push(...((data ?? []) as unknown as GoalieStartProjectionRow[]));
    if ((data ?? []).length < GOALIE_QUERY_PAGE_SIZE) break;
  }

  const latestByPlayer = new Map<number, GoalieStartProjectionRow>();
  for (const row of rows) {
    if (!latestByPlayer.has(row.player_id)) latestByPlayer.set(row.player_id, row);
  }
  return latestByPlayer;
}

async function fetchPlayerMeta(playerIds: number[]) {
  if (playerIds.length === 0) return new Map<number, PlayerMeta>();
  const rows: PlayerMeta[] = [];
  for (let from = 0; from < playerIds.length; from += METADATA_QUERY_PAGE_SIZE) {
    const chunk = playerIds.slice(from, from + METADATA_QUERY_PAGE_SIZE);
    const { data, error } = await supabase
      .from("players")
      .select("id,fullName,image_url")
      .in("id", chunk);
    if (error) throw new Error(`Unable to load goalie metadata: ${error.message}`);
    rows.push(...((data ?? []) as PlayerMeta[]));
  }
  return new Map(rows.map((row) => [row.id, row]));
}

async function fetchTeamMeta(teamIds: number[] | null) {
  if (teamIds?.length === 0) return new Map<number, TeamMeta>();
  let query = supabase.from("teams").select("id,abbreviation,name");
  if (teamIds != null) query = query.in("id", Array.from(new Set(teamIds)));
  const { data, error } = await query;
  if (error) throw new Error(`Unable to load goalie team metadata: ${error.message}`);
  return new Map(((data ?? []) as TeamMeta[]).map((row) => [row.id, row]));
}

export async function buildGoalieMatrixSurface(
  request: GoalieMatrixRequest,
): Promise<GoalieMatrixResponse> {
  const cacheKey = JSON.stringify(request);
  const now = Date.now();
  const cached = goalieMatrixResponseCache.get(cacheKey);
  if (cached && cached.expiresAt > now) return cached.response;

  const through = request.asOfDate ?? new Date().toISOString().slice(0, 10);
  const [unifiedRows, officialRows, scheduledGames, completedTeamGames, teamsById] = await Promise.all([
    fetchAllGoalieGameRows({ ...request, asOfDate: through }),
    fetchOfficialGoalieAppearances(request, through),
    fetchGoalieTeamGames(request.season, through),
    fetchCompletedGoalieTeamGames(request, through),
    fetchTeamMeta(null),
  ]);
  const population = reconcileGoaliePopulation({
    season: request.season, through, official: officialRows, unified: unifiedRows,
    games: scheduledGames, completedTeamGames, teams: teamsById,
  });
  const gameRows = population.rows;
  const teamGames = population.teamGames;
  const latestAvailableSnapshotDate = population.latestObservationDate;
  const filterTeamIds = resolveGoalieTeamFilterIds(request.team, [...teamsById.values()]);
  // Team is a cohort filter on the latest verified team. Fetching only that
  // team's logs first would relabel departed goalies and truncate traded ones.
  const aggregates = aggregateGoalieGameRows(gameRows, request.window).filter(
    (aggregate) => filterTeamIds == null ||
      (aggregate.teamId != null && filterTeamIds.includes(aggregate.teamId)),
  );
  const playerIds = aggregates.map((aggregate) => aggregate.playerId);
  const [projectionByPlayerId, playersById] = await Promise.all([
    aggregates.length ? fetchLatestStartProjections({
      season: request.season,
      asOfDate: request.asOfDate ?? latestAvailableSnapshotDate ?? through,
    }) : Promise.resolve(new Map<number, GoalieStartProjectionRow>()),
    fetchPlayerMeta(playerIds),
  ]);
  const teamContexts = buildGoalieTeamContexts(gameRows, teamGames, request.window);
  const workloadContexts = teamContexts.workloads;
  const relativeSaveContexts = new Map<number, GoalieRelativeSaveContext>();
  for (const aggregate of aggregates) {
    const context = aggregate.teamId == null ? null
      : teamContexts.relativeSaves.get(aggregate.teamId)?.get(aggregate.playerId);
    if (context) relativeSaveContexts.set(aggregate.playerId, context);
  }

  const mismatchedProjectionIds = new Set<number>();
  for (const aggregate of aggregates) {
    const projection = projectionByPlayerId.get(aggregate.playerId);
    if (projection && (aggregate.teamId == null || projection.team_id !== aggregate.teamId)) {
      projectionByPlayerId.delete(aggregate.playerId);
      mismatchedProjectionIds.add(aggregate.playerId);
    }
  }

  const valuesByMetric = new Map<
    GoalieMatrixMetricKey,
    Map<number, { value: number | null; ranks: ReturnType<typeof rankGoalieMetricValues> }>
  >();
  for (const column of METRIC_COLUMNS) {
    const values = new Map<number, { value: number | null; ranks: ReturnType<typeof rankGoalieMetricValues> }>();
    const rankInput = aggregates
      .filter(
        (aggregate) => {
          const projection = projectionByPlayerId.get(aggregate.playerId) ?? null;
          const roleContext = buildGoalieRoleContext({
            aggregate,
            projection,
            workloadContexts,
          });
          return (
            aggregate.gamesStarted >= request.minStarts &&
            aggregate.shotsAgainst >= request.minShots &&
            roleMatchesFilter(roleContext.deploymentBucket, request.role)
          );
        },
      )
      .map((aggregate) => {
        const projection = projectionByPlayerId.get(aggregate.playerId) ?? null;
        const roleContext = buildGoalieRoleContext({
          aggregate,
          projection,
          workloadContexts,
        });
          return {
            id: aggregate.playerId,
            value: metricValue(
              aggregate,
              projection,
              column.metricKey,
              roleContext,
              relativeSaveContexts.get(aggregate.playerId) ?? null,
            ),
          };
      });
    const ranks = rankGoalieMetricValues(rankInput, column.lowerIsBetter);
    for (const aggregate of aggregates) {
      const projection = projectionByPlayerId.get(aggregate.playerId) ?? null;
      const roleContext = buildGoalieRoleContext({
        aggregate,
        projection,
        workloadContexts,
      });
      values.set(aggregate.playerId, {
        value: metricValue(
          aggregate,
          projection,
          column.metricKey,
          roleContext,
          relativeSaveContexts.get(aggregate.playerId) ?? null,
        ),
        ranks,
      });
    }
    valuesByMetric.set(column.metricKey, values);
  }

  const rows = aggregates.map((aggregate): GoalieMatrixRow => {
    const player = playersById.get(aggregate.playerId);
    const projection = projectionByPlayerId.get(aggregate.playerId) ?? null;
    const roleContext = buildGoalieRoleContext({
      aggregate,
      projection,
      workloadContexts,
    });
    const teamId = aggregate.teamId ?? projection?.team_id ?? null;
    const team = teamId == null ? null : teamsById.get(teamId) ?? null;
    const relativeSaveContext =
      relativeSaveContexts.get(aggregate.playerId) ?? null;
    const minimumSampleMet =
      aggregate.gamesStarted >= request.minStarts &&
      aggregate.shotsAgainst >= request.minShots;
    const metrics = Object.fromEntries(
      METRIC_COLUMNS.map((column) => {
        const value = valuesByMetric.get(column.metricKey)?.get(aggregate.playerId);
        const rank = value?.ranks.get(aggregate.playerId) ?? null;
        return [
          column.metricKey,
          {
            metricKey: column.metricKey,
            rawValue: value?.value ?? null,
            formattedValue: formatMetricValue(column.metricKey, value?.value ?? null),
            rank: rank?.rank ?? null,
            percentile: rank?.percentile ?? null,
            qualifiedPeerCount: rank?.qualifiedPeerCount ?? 0,
            lowerIsBetter: column.lowerIsBetter,
          },
        ];
      }),
    ) as Record<GoalieMatrixMetricKey, GoalieMatrixMetricCell>;
    const sortCell = metrics[request.metric];
    return {
      entity: {
        id: aggregate.playerId,
        name: player?.fullName ?? aggregate.playerName,
        position: "G",
        imageUrl: player?.image_url ?? null,
      },
      team: {
        id: teamId,
        abbreviation: team?.abbreviation ?? null,
        name: team?.name ?? null,
      },
      sample: {
        gamesPlayed: aggregate.gamesPlayed,
        gamesStarted: aggregate.gamesStarted,
        shotsAgainst: aggregate.shotsAgainst,
        toiSeconds: aggregate.toiSeconds,
        minimumSampleMet,
        confidence: sampleConfidence({
          starts: aggregate.gamesStarted,
          shots: aggregate.shotsAgainst,
          minStarts: request.minStarts,
          minShots: request.minShots,
        }),
      },
      role: {
        deploymentBucket: roleContext.deploymentBucket,
        deploymentLabel: roleContext.deploymentLabel,
        deploymentSource: roleContext.deploymentSource,
        rawStartShare: roleContext.rawStartShare,
        adjustedStartShare: roleContext.adjustedStartShare,
        coreStartShare: roleContext.coreStartShare,
        coreGoalieIds: roleContext.coreGoalieIds,
        excludedTeamStarts: roleContext.excludedTeamStarts,
        roleConfidence: roleContext.roleConfidence,
        roleNotes: [
          ...roleContext.roleNotes,
          ...(mismatchedProjectionIds.has(aggregate.playerId)
            ? ["Projection for a different or unverified team was ignored."] : []),
        ],
        windowStartShare: roleContext.windowStartShare,
        startShareLast10: finite(projection?.l10_start_pct),
        seasonStartShare: finite(projection?.season_start_pct),
        startProbability: finite(projection?.start_probability),
        projectedGsaaPer60: finite(projection?.projected_gsaa_per_60),
        confirmedStatus: projection?.confirmed_status ?? null,
      },
      sort: {
        metricKey: request.metric,
        rank: sortCell.rank,
        percentile: sortCell.percentile,
      },
      metrics,
      warnings: [
        ...aggregate.sourceWarnings.filter((warning) => warning !== "partial_nst_5v5_relative_save_source"),
        ...(relativeSaveContext?.warnings ?? []),
        ...(roleContext.roleConfidence === "low" ? ["low_role_confidence"] : []),
        ...(aggregate.teamId == null ? []
          : teamContexts.warnings.get(aggregate.teamId) ??
            (workloadContexts.has(aggregate.teamId) ? [] : ["partial_goalie_team_game_coverage"])),
        ...(mismatchedProjectionIds.has(aggregate.playerId) ? ["mismatched_team_start_projection"] : []),
        ...(minimumSampleMet ? [] : ["sample_below_minimum"]),
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
        ? bCell.rank - aCell.rank || a.entity.id - b.entity.id
        : aCell.rank - bCell.rank || a.entity.id - b.entity.id;
    }
    const aValue = aCell.rawValue;
    const bValue = bCell.rawValue;
    if (aValue == null && bValue == null) return a.entity.id - b.entity.id;
    if (aValue == null) return 1;
    if (bValue == null) return -1;
    return request.sortDirection === "asc"
      ? aValue - bValue || a.entity.id - b.entity.id
      : bValue - aValue || a.entity.id - b.entity.id;
  });

  const filteredRows = rows.filter(
    (row) =>
      roleMatchesFilter(row.role.deploymentBucket, request.role) &&
      goalieRowMatchesSearch(row, request.search),
  );
  const totalRankedRows = filteredRows.length;
  const pageCount = Math.max(1, Math.ceil(totalRankedRows / request.pageSize));
  const start = (request.page - 1) * request.pageSize;
  const pageRows = filteredRows.slice(start, start + request.pageSize);
  const sourceWarnings = Array.from(
    new Set([...population.sourceWarnings, ...rows.flatMap((row) => row.warnings).filter((warning) => warning.startsWith("partial_"))]),
  );

  const response: GoalieMatrixResponse = {
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
      snapshotDate: request.asOfDate ?? latestAvailableSnapshotDate,
      latestAvailableSnapshotDate,
      sourceTables: [
        "goalie_stats_unified",
        "wgo_goalie_stats",
        "wgo_team_stats",
        "nst_gamelog_goalie_*",
        "goalie_start_projections",
        "games",
      ],
      methodologyVersion: "goalie_rankings_v4_official_appearance_population",
      methodologyUpdatedAt: "2026-11-09",
      sourceQualityFlags: sourceWarnings.length
        ? ["partial_source_coverage"]
        : [],
      metricColumns: METRIC_COLUMNS,
      sourceWarnings,
      sourcePendingMetricContracts: GOALIE_SOURCE_PENDING_METRIC_CONTRACTS,
    },
  };
  goalieMatrixResponseCache.set(cacheKey, {
    expiresAt: now + GOALIE_MATRIX_RESPONSE_CACHE_TTL_MS,
    response,
  });
  return response;
}
