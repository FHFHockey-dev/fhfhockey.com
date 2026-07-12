import type { NextApiRequest } from "next";

import supabase from "lib/supabase/server";
import type { Database } from "lib/supabase/database-generated.types";

import {
  getContextualRankingMetricDefinition,
  type ContextualRankingMetricKey,
} from "./metricDefinitions";
import {
  MATRIX_METRIC_GROUPS,
  getDefaultMatrixMetricColumns,
  getMatrixMetricColumn,
  getMatrixMetricColumns,
  type MatrixMetricColumnDefinition,
  type MatrixMetricGroup,
} from "./matrixMetricRegistry";
import { buildEntityMetricRankingSurfaces } from "./entityMetricRankingReader";
import { buildContextualRankingsSurfaces } from "./rankingQueries";
import type {
  ContextualRankingApiRow,
  ContextualRankingsDeploymentFilter,
  ContextualRankingsPositionFilter,
  ContextualRankingsRequest,
  ContextualRankingsSortDirection,
} from "./rankingTypes";
import { ContextualRankingsQueryError } from "./rankingTypes";
import type {
  ContextualRankingPeerGroupType,
  RankingPeerGroupWarning,
  RankingSampleConfidence,
} from "./rankingCalculator";
import { rankNormalizedMetricValues } from "./rankingCalculator";
import type {
  SkaterProductionWindow,
  SkaterWindowStrengthState,
} from "./skaterWindowAggregation";
import { CONTEXTUAL_RANKINGS_METHODOLOGY_UPDATED_AT } from "./rankingMetadata";
import {
  resolveTeamToken,
  type ResolvedTeamToken,
} from "./teamTokenResolver";

export type PlayerMatrixRequest = {
  entity: "skaters";
  season: number;
  asOfDate: string | null;
  window: SkaterProductionWindow;
  position: ContextualRankingsPositionFilter;
  deployment: ContextualRankingsDeploymentFilter;
  strength: SkaterWindowStrengthState;
  minGp: number | null;
  minToiSeconds: number | null;
  teamId: number | null;
  search: string | null;
  peerGroupType: ContextualRankingPeerGroupType;
  sortMetric: ContextualRankingMetricKey;
  sortDirection: ContextualRankingsSortDirection;
  sampleConfidence: "all" | "medium_plus" | "high";
  page: number;
  pageSize: number;
  selectedPlayerId: number | null;
  rankingSourcePreference: "fallback" | "entity_metric_rankings";
};

export type PlayerMatrixMetricCell = {
  metricKey: ContextualRankingMetricKey;
  shortLabel: string;
  fullLabel: string;
  groupKey: string;
  rawValue: number | null;
  formattedValue: string | null;
  rank: number | null;
  percentile: number | null;
  qualifiedPeerCount: number;
  lowerIsBetter: boolean;
  availabilityState: "available" | "planned" | "unavailable";
  availabilityReason: string | null;
  sampleConfidence: RankingSampleConfidence;
  sourceQualityFlags: string[];
  denominatorKey: string | null;
  denominatorDescription: string | null;
  methodologyVersion: string | null;
  snapshotDate: string | null;
  warnings: RankingPeerGroupWarning[];
  rankScopes?: PlayerMatrixRankScopes;
};

export type PlayerMatrixComposite = {
  offenseRating: number | null;
  defenseRating: number | null;
  mcmScore: number | null;
  beastTier: string | null;
  shootFirstScore: number | null;
  passFirstScore: number | null;
  playDriverScore: number | null;
  resultsLuckIndex: number | null;
  resultsLuckUnavailableReason: string | null;
  methodologyVersion: string | null;
  snapshotDate: string | null;
  updatedAt: string | null;
};

export type PlayerMatrixRankScope = {
  rank: number | null;
  percentile: number | null;
  qualifiedPeerCount: number;
  peerGroupKey: string | null;
};

export type PlayerMatrixRankScopes = {
  overall: PlayerMatrixRankScope | null;
  deployment: PlayerMatrixRankScope | null;
};

export type PlayerMatrixRow = {
  entity: ContextualRankingApiRow["entity"];
  team: ContextualRankingApiRow["team"];
  deployment: ContextualRankingApiRow["deployment"];
  sample: ContextualRankingApiRow["sample"];
  peerGroup: ContextualRankingApiRow["peerGroup"];
  tags: string[];
  warnings: RankingPeerGroupWarning[];
  sort: {
    metricKey: ContextualRankingMetricKey;
    rank: number | null;
    percentile: number | null;
    rankScopes?: PlayerMatrixRankScopes;
  };
  composite: PlayerMatrixComposite | null;
  metrics: Record<string, PlayerMatrixMetricCell>;
};

export type PlayerMatrixResponse = {
  success: boolean;
  request: PlayerMatrixRequest;
  rows: PlayerMatrixRow[];
  selectedPlayerId: number | null;
  meta: {
    generatedAt: string;
    rowCount: number;
    totalRankedRows: number;
    page: number;
    pageSize: number;
    pageCount: number;
    sortMetric: ContextualRankingMetricKey;
    sortDirection: ContextualRankingsSortDirection;
    metricGroups: MatrixMetricGroup[];
    metricColumns: MatrixMetricColumnDefinition[];
    plannedMetrics: MatrixMetricColumnDefinition[];
    unavailableMetrics: Array<{
      metricKey: string;
      label: string;
      reason: string;
    }>;
    colorScaleBands: Array<{
      label: string;
      min: number;
      max: number;
      tone: string;
    }>;
    activePeerGroupDescription: string;
    snapshotDate: string | null;
    latestAvailableSnapshotDate: string | null;
    snapshotUpdatedAt: string | null;
    snapshotSelectionReason: string | null;
    sourceTable: "rolling_player_game_metrics" | "entity_metric_rankings";
    sourceTables?: Array<
      | "rolling_player_game_metrics"
      | "entity_metric_rankings"
      | "skater_composite_ratings"
    >;
    rankingSource?:
      | "fallback_rolling_player_game_metrics"
      | "entity_metric_rankings";
    rankingSourcePreference?: PlayerMatrixRequest["rankingSourcePreference"];
    rankingSourceFallbackReason?: string | null;
    methodologyVersion?: string | null;
    methodologyUpdatedAt?: string | null;
    sourceQualityFlags?: string[];
    sourceWarnings?: string[];
    compositeSourceTable?: "skater_composite_ratings";
    message: string | null;
  };
};

type QueryValue = string | string[] | undefined;

const DEFAULT_PAGE_SIZE = 10;
const MAX_PAGE_SIZE = 50;
const COMPOSITE_IN_FILTER_CHUNK_SIZE = 500;
const COMPOSITE_QUERY_PAGE_SIZE = 1000;
const PLAYER_MATRIX_RESPONSE_CACHE_TTL_MS = 30_000;
const PAGE_SIZE_OPTIONS = [10, 25, 50] as const;
const COMPOSITE_METRIC_KEYS = [
  "offense_rating",
  "defense_rating",
  "mcm_score",
  "beast_tier",
  "results_luck_index",
] as const;

const playerMatrixResponseCache = new Map<
  string,
  { expiresAt: number; response: PlayerMatrixResponse }
>();

export function clearPlayerMatrixSurfaceCachesForTests() {
  playerMatrixResponseCache.clear();
}

type CompositeMetricKey = (typeof COMPOSITE_METRIC_KEYS)[number];
type CompositeRatingRow =
  Database["public"]["Tables"]["skater_composite_ratings"]["Row"];

function recordValue(value: unknown): Record<string, unknown> | null {
  return value != null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === "string")
    : [];
}

export function getResultsLuckUnavailableReasonForComposite(
  row: Pick<CompositeRatingRow, "components_json" | "results_luck_index"> | null,
) {
  if (row == null) return "Composite rating row is not published for this player/context.";
  if (row.results_luck_index != null) return null;

  const components = recordValue(row.components_json);
  const resultsLuck = recordValue(components?.resultsLuck);
  const baselineProvenance = recordValue(resultsLuck?.baselineProvenance);
  const warnings = stringArray(baselineProvenance?.warnings);
  const storedReason =
    typeof resultsLuck?.reason === "string" ? resultsLuck.reason : null;

  if (warnings.includes("season_window_has_no_non_overlapping_baseline")) {
    return "Results Luck unavailable: season windows do not have a selected-window-excluded baseline.";
  }
  if (warnings.includes("baseline_window_not_excluded")) {
    return "Results Luck unavailable: selected-window-excluded baseline was not verified.";
  }
  if (warnings.includes("baseline_not_persisted")) {
    return "Results Luck unavailable: baseline provenance was not persisted.";
  }
  if (baselineProvenance?.baselineWindowExcluded === false) {
    return "Results Luck unavailable: selected-window-excluded baseline was not verified.";
  }
  return (
    storedReason ??
    "Results Luck unavailable: verified selected-window-excluded source values were unavailable or failed the publish gate."
  );
}

type AllStrengthToiRow = Pick<
  Database["public"]["Tables"]["rolling_player_game_metrics"]["Row"],
  | "player_id"
  | "game_date"
  | "updated_at"
  | "games_played"
  | "season_games_played"
  | "toi_seconds_avg_season"
  | "toi_seconds_total_last5"
  | "toi_seconds_total_last10"
  | "toi_seconds_total_last20"
>;

export const MATRIX_COLOR_SCALE_BANDS = [
  { label: "0-19", min: 0, max: 19.999, tone: "poor" },
  { label: "20-39", min: 20, max: 39.999, tone: "weak" },
  { label: "40-59", min: 40, max: 59.999, tone: "neutral" },
  { label: "60-79", min: 60, max: 79.999, tone: "positive" },
  { label: "80-89", min: 80, max: 89.999, tone: "strong" },
  { label: "90-94", min: 90, max: 94.999, tone: "elite" },
  { label: "95-100", min: 95, max: 100, tone: "peak" },
];

export function defaultMatrixSortMetric(
  columns = getDefaultMatrixMetricColumns({ strength: "5v5" }),
): ContextualRankingMetricKey {
  return (
    columns.find((column) => column.metricKey === "points_per_60")?.metricKey ??
    columns.find((column) => column.metricKey === "goals_per_60")?.metricKey ??
    columns[0]?.metricKey ??
    "points_per_60"
  );
}

function first(value: QueryValue): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}

function parseInteger(
  value: QueryValue,
  key: string,
  options: {
    defaultValue?: number;
    required?: boolean;
    min?: number;
    max?: number;
  },
) {
  const raw = first(value);
  if (!raw) {
    if (options.required) {
      throw new ContextualRankingsQueryError(
        `Missing required query param: ${key}`,
        {
          [key]: "required",
        },
      );
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
  value: QueryValue,
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

function parseDate(value: QueryValue) {
  const raw = first(value);
  if (!raw) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    throw new ContextualRankingsQueryError("Invalid query param: as_of_date", {
      as_of_date: "must be YYYY-MM-DD",
    });
  }
  return raw;
}

function parseSearch(value: QueryValue) {
  const raw = first(value)?.trim();
  return raw ? raw.slice(0, 80) : null;
}

function parseRankingSourcePreference(
  value: QueryValue,
): PlayerMatrixRequest["rankingSourcePreference"] {
  const raw = first(value)?.toLowerCase();
  return raw === "fallback" || raw === "rolling_player_game_metrics"
    ? "fallback"
    : "entity_metric_rankings";
}

function parseMetric(value: QueryValue, fallback: ContextualRankingMetricKey) {
  const raw = first(value) ?? fallback;
  const definition = getContextualRankingMetricDefinition(raw);
  if (!definition) {
    throw new ContextualRankingsQueryError("Invalid query param: sort_metric", {
      sort_metric: "unknown metric key",
    });
  }
  return definition.metricKey as ContextualRankingMetricKey;
}

function parsePageSize(value: QueryValue) {
  const parsed = parseInteger(value, "page_size", {
    defaultValue: DEFAULT_PAGE_SIZE,
    min: 1,
    max: MAX_PAGE_SIZE,
  });
  return PAGE_SIZE_OPTIONS.includes(parsed as any)
    ? (parsed ?? DEFAULT_PAGE_SIZE)
    : DEFAULT_PAGE_SIZE;
}

function derivePeerGroupType(args: {
  teamId: number | null;
  deployment: ContextualRankingsDeploymentFilter;
  position: ContextualRankingsPositionFilter;
}): ContextualRankingPeerGroupType {
  if (args.teamId != null) return "team";
  if (args.deployment !== "all") return "deployment";
  if (args.position !== "all") return "position";
  return "all_skaters";
}

function activePeerGroupDescription(request: PlayerMatrixRequest) {
  if (request.teamId != null) return `team ${request.teamId}`;
  if (request.deployment !== "all") return `${request.deployment} deployment`;
  if (request.position === "F") return "forwards";
  if (request.position === "D") return "defensemen";
  return "all skaters";
}

function unresolvedTeamError(token: string) {
  return new ContextualRankingsQueryError(`No team matched ${token}`, {
    team: "must be a numeric id, team abbreviation, or team name",
  });
}

export function parsePlayerMatrixRequest(
  query: NextApiRequest["query"],
  options: { resolvedTeamToken?: ResolvedTeamToken | null } = {},
): PlayerMatrixRequest {
  const position = parseEnum(
    query.position,
    "position",
    ["all", "F", "D"] as const,
    "all",
  );
  const deployment = parseEnum(
    query.deployment,
    "deployment",
    [
      "all",
      "L1",
      "L2",
      "L3",
      "L4",
      "P1",
      "P2",
      "P3",
      "PP1",
      "PP2",
      "PP3",
      "PK1",
      "PK2",
    ] as const,
    "all",
  );
  const teamId =
    options.resolvedTeamToken != null
      ? options.resolvedTeamToken.teamId
      : parseInteger(query.team, "team", { min: 1 });
  const defaultSortMetric = defaultMatrixSortMetric();

  return {
    entity: parseEnum(query.entity, "entity", ["skaters"] as const, "skaters"),
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
    position,
    deployment,
    strength: parseEnum(
      query.strength,
      "strength",
      ["all", "5v5", "ev", "pp", "pk"] as const,
      "5v5",
    ),
    minGp: parseInteger(query.min_gp, "min_gp", { min: 0 }),
    minToiSeconds: parseInteger(query.min_toi, "min_toi", { min: 0 }),
    teamId,
    search: parseSearch(query.search),
    peerGroupType: derivePeerGroupType({ teamId, deployment, position }),
    sortMetric: parseMetric(query.sort_metric, defaultSortMetric),
    sortDirection: parseEnum(
      query.sort_direction,
      "sort_direction",
      ["asc", "desc"] as const,
      "desc",
    ),
    sampleConfidence: parseEnum(
      query.sample_confidence,
      "sample_confidence",
      ["all", "medium_plus", "high"] as const,
      "all",
    ),
    page:
      parseInteger(query.page, "page", {
        defaultValue: 1,
        min: 1,
        max: 100,
      }) ?? 1,
    pageSize: parsePageSize(query.page_size),
    selectedPlayerId: parseInteger(query.selected_player, "selected_player", {
      min: 1,
    }),
    rankingSourcePreference: parseRankingSourcePreference(query.ranking_source),
  };
}

export async function parsePlayerMatrixRequestWithResolvedTeam(
  query: NextApiRequest["query"],
) {
  const rawTeam = first(query.team)?.trim() ?? "";
  const resolvedTeamToken = await resolveTeamToken(rawTeam);
  if (rawTeam !== "" && resolvedTeamToken == null) {
    throw unresolvedTeamError(rawTeam);
  }
  return parsePlayerMatrixRequest(query, { resolvedTeamToken });
}

function rowMatchesSearch(row: ContextualRankingApiRow, search: string | null) {
  if (!search) return true;
  const needle = search.toLowerCase();
  return [
    row.entity.name,
    row.entity.position,
    row.team.abbreviation,
    row.team.name,
    ...row.tags,
  ]
    .filter((value): value is string => typeof value === "string")
    .some((value) => value.toLowerCase().includes(needle));
}

function contextualRequestForMetric(args: {
  request: PlayerMatrixRequest;
  metric: ContextualRankingMetricKey;
  entityIds?: number[] | null;
  limit?: number | null;
}): ContextualRankingsRequest {
  return {
    entity: "skaters",
    season: args.request.season,
    asOfDate: args.request.asOfDate,
    window: args.request.window,
    position: args.request.position,
    deployment: args.request.deployment,
    strength: args.request.strength,
    metric: args.metric,
    minGp: args.request.minGp,
    minToiSeconds: args.request.minToiSeconds,
    teamId: args.request.teamId,
    peerGroupType: args.request.peerGroupType,
    sort: "percentile",
    direction: args.request.sortDirection,
    limit: args.limit ?? null,
    entityIds: args.entityIds ?? null,
  };
}

function isCompositeMetricKey(
  metricKey: string,
): metricKey is CompositeMetricKey {
  return COMPOSITE_METRIC_KEYS.includes(metricKey as CompositeMetricKey);
}

function compositeMetricValue(
  row: CompositeRatingRow | undefined,
  metricKey: CompositeMetricKey,
) {
  if (!row) return null;
  if (metricKey === "offense_rating") {
    return row.offense_rating_overall ?? row.offense_rating_deployment ?? null;
  }
  if (metricKey === "defense_rating") {
    return row.defense_rating_overall ?? row.defense_rating_deployment ?? null;
  }
  if (metricKey === "results_luck_index") return row.results_luck_index ?? null;
  return row.mcm_score ?? null;
}

function matrixCompositeWindowType(window: SkaterProductionWindow) {
  if (window === "last5") return "last_5";
  if (window === "last10") return "last_10";
  if (window === "last20") return "last_20";
  return "season";
}

function matrixCompositeWindowSize(window: SkaterProductionWindow) {
  if (window === "last5") return 5;
  if (window === "last10") return 10;
  if (window === "last20") return 20;
  return 0;
}

function matrixCompositePeerGroupKey(request: PlayerMatrixRequest) {
  if (request.teamId != null) return String(request.teamId);
  if (request.deployment !== "all") return request.deployment;
  if (request.position === "F" || request.position === "D")
    return request.position;
  return "all_skaters";
}

function toComposite(
  row: CompositeRatingRow | null,
): PlayerMatrixComposite | null {
  if (!row) return null;
  return {
    offenseRating: row.offense_rating_overall ?? row.offense_rating_deployment,
    defenseRating: row.defense_rating_overall ?? row.defense_rating_deployment,
    mcmScore: row.mcm_score,
    beastTier: row.beast_tier,
    shootFirstScore: row.shoot_first_score,
    passFirstScore: row.pass_first_score,
    playDriverScore: row.play_driver_score,
    resultsLuckIndex: row.results_luck_index,
    resultsLuckUnavailableReason: getResultsLuckUnavailableReasonForComposite(row),
    methodologyVersion: row.methodology_version,
    snapshotDate: row.snapshot_date,
    updatedAt: row.updated_at,
  };
}

function finiteNumber(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return value;
}

function windowSize(window: SkaterProductionWindow) {
  if (window === "last5") return 5;
  if (window === "last10") return 10;
  if (window === "last20") return 20;
  return null;
}

function allStrengthsToiPerGame(
  row: AllStrengthToiRow,
  window: SkaterProductionWindow,
) {
  const seasonGames =
    finiteNumber(row.season_games_played) ?? finiteNumber(row.games_played);
  if (window === "season") {
    return finiteNumber(row.toi_seconds_avg_season);
  }

  const size = windowSize(window);
  const gamesPlayed =
    seasonGames == null || size == null ? null : Math.min(seasonGames, size);
  const field = `toi_seconds_total_${window}` as
    | "toi_seconds_total_last5"
    | "toi_seconds_total_last10"
    | "toi_seconds_total_last20";
  const toi = finiteNumber(row[field]);
  if (toi == null || gamesPlayed == null || gamesPlayed <= 0) return null;
  return Number((toi / gamesPlayed).toFixed(6));
}

function isNewerAllStrengthToiRow(
  candidate: AllStrengthToiRow,
  current: AllStrengthToiRow,
) {
  const candidateDate =
    typeof candidate.game_date === "string" ? candidate.game_date : "";
  const currentDate =
    typeof current.game_date === "string" ? current.game_date : "";
  if (candidateDate !== currentDate) return candidateDate > currentDate;

  const candidateUpdatedAt =
    typeof candidate.updated_at === "string" ? candidate.updated_at : "";
  const currentUpdatedAt =
    typeof current.updated_at === "string" ? current.updated_at : "";
  return candidateUpdatedAt > currentUpdatedAt;
}

async function fetchAllStrengthsToiByPlayerId(args: {
  request: PlayerMatrixRequest;
  snapshotDate: string | null;
  playerIds: number[];
}) {
  if (args.snapshotDate == null || args.playerIds.length === 0) {
    return new Map<number, number | null>();
  }

  const rows: AllStrengthToiRow[] = [];
  const uniquePlayerIds = Array.from(new Set(args.playerIds));
  const selectFields = [
    "player_id",
    "game_date",
    "updated_at",
    "games_played",
    "season_games_played",
    "toi_seconds_avg_season",
    "toi_seconds_total_last5",
    "toi_seconds_total_last10",
    "toi_seconds_total_last20",
  ].join(",");

  for (
    let index = 0;
    index < uniquePlayerIds.length;
    index += COMPOSITE_IN_FILTER_CHUNK_SIZE
  ) {
    const chunk = uniquePlayerIds.slice(
      index,
      index + COMPOSITE_IN_FILTER_CHUNK_SIZE,
    );
    for (let from = 0; ; from += COMPOSITE_QUERY_PAGE_SIZE) {
      const { data, error } = await supabase
        .from("rolling_player_game_metrics")
        .select(selectFields)
        .eq("season", args.request.season)
        .eq("strength_state", "all")
        .lte("game_date", args.snapshotDate)
        .in("player_id", chunk)
        .order("game_date", { ascending: false })
        .range(from, from + COMPOSITE_QUERY_PAGE_SIZE - 1);
      if (error) throw error;

      const page = (data ?? []) as unknown as AllStrengthToiRow[];
      rows.push(...page);
      if (page.length < COMPOSITE_QUERY_PAGE_SIZE) break;
    }
  }

  const latestRowsByPlayerId = new Map<number, AllStrengthToiRow>();
  for (const row of rows) {
    if (typeof row.player_id !== "number") continue;
    const current = latestRowsByPlayerId.get(row.player_id);
    if (!current || isNewerAllStrengthToiRow(row, current)) {
      latestRowsByPlayerId.set(row.player_id, row);
    }
  }

  return new Map(
    Array.from(latestRowsByPlayerId.entries()).map(([playerId, row]) => [
      playerId,
      allStrengthsToiPerGame(row, args.request.window),
    ]),
  );
}

async function fetchCompositeRatingsByPlayerId(args: {
  request: PlayerMatrixRequest;
  snapshotDate: string | null;
  playerIds: number[];
}) {
  if (args.snapshotDate == null || args.playerIds.length === 0) {
    return new Map<number, CompositeRatingRow>();
  }

  const rows: CompositeRatingRow[] = [];
  const uniquePlayerIds = Array.from(new Set(args.playerIds));
  const selectFields = [
    "player_id",
    "peer_group_type",
    "peer_group_key",
    "position_group",
    "deployment_bucket",
    "snapshot_date",
    "updated_at",
    "offense_rating_overall",
    "offense_rating_deployment",
    "defense_rating_overall",
    "defense_rating_deployment",
    "mcm_score",
    "beast_tier",
    "shoot_first_score",
    "pass_first_score",
    "play_driver_score",
    "results_luck_index",
    "methodology_version",
  ].join(",");

  for (
    let index = 0;
    index < uniquePlayerIds.length;
    index += COMPOSITE_IN_FILTER_CHUNK_SIZE
  ) {
    const chunk = uniquePlayerIds.slice(
      index,
      index + COMPOSITE_IN_FILTER_CHUNK_SIZE,
    );
    for (let from = 0; ; from += COMPOSITE_QUERY_PAGE_SIZE) {
      const { data, error } = await supabase
        .from("skater_composite_ratings")
        .select(selectFields)
        .eq("season_id", args.request.season)
        .eq("snapshot_date", args.snapshotDate)
        .eq("window_type", matrixCompositeWindowType(args.request.window))
        .eq("window_size", matrixCompositeWindowSize(args.request.window))
        .eq("strength_state", args.request.strength)
        .eq("peer_group_type", args.request.peerGroupType)
        .eq("peer_group_key", matrixCompositePeerGroupKey(args.request))
        .in("player_id", chunk)
        .range(from, from + COMPOSITE_QUERY_PAGE_SIZE - 1);
      if (error) throw error;

      const page = (data ?? []) as unknown as CompositeRatingRow[];
      rows.push(...page);
      if (page.length < COMPOSITE_QUERY_PAGE_SIZE) break;
    }
  }

  return new Map(rows.map((row) => [row.player_id, row]));
}

function metricUnavailableReason(args: {
  column: MatrixMetricColumnDefinition;
  request: PlayerMatrixRequest;
}) {
  if (!args.column.definition) return "Metric definition is missing.";
  if (args.column.availabilityState !== "available") {
    return args.column.plannedReason ?? "Metric is planned and not live yet.";
  }
  if (
    !args.column.definition.applicableStrengthStates.includes(
      args.request.strength,
    )
  ) {
    return `Metric is not available for ${args.request.strength.toUpperCase()} strength.`;
  }
  return null;
}

function cellFromRow(args: {
  column: MatrixMetricColumnDefinition;
  row: ContextualRankingApiRow | null;
  snapshotDate: string | null;
  unavailableReason: string | null;
  rankScopes: PlayerMatrixRankScopes;
}): PlayerMatrixMetricCell {
  return {
    metricKey: args.column.metricKey,
    shortLabel: args.column.shortLabel,
    fullLabel: args.column.fullLabel,
    groupKey: args.column.groupKey,
    rawValue: args.row?.metric.value ?? null,
    formattedValue: args.row?.metric.formattedValue ?? null,
    rank: args.row?.metric.rawRank ?? null,
    percentile: args.row?.metric.percentile ?? null,
    qualifiedPeerCount: args.row?.metric.qualifiedPeerCount ?? 0,
    lowerIsBetter: args.column.lowerIsBetter,
    availabilityState: args.unavailableReason
      ? args.column.availabilityState === "planned"
        ? "planned"
        : "unavailable"
      : "available",
    availabilityReason: args.unavailableReason,
    sampleConfidence: args.row?.sample.confidence ?? "low",
    sourceQualityFlags: [...args.column.sourceQualityFlags],
    denominatorKey: args.column.denominatorKey,
    denominatorDescription: args.column.denominatorDescription,
    methodologyVersion: args.column.methodologyVersion,
    snapshotDate: args.snapshotDate,
    warnings: args.row?.warnings ?? [],
    rankScopes: args.rankScopes,
  };
}

function cellFromCompositeRow(args: {
  column: MatrixMetricColumnDefinition;
  composite: CompositeRatingRow | null;
  totalRows: number;
  unavailableReason: string | null;
  rankScopes: PlayerMatrixRankScopes;
}): PlayerMatrixMetricCell {
  const metricKey = args.column.metricKey as CompositeMetricKey;
  const rawValue = compositeMetricValue(args.composite ?? undefined, metricKey);
  const percentile =
    args.column.metricKey === "results_luck_index"
      ? rawValue == null
        ? null
        : Math.max(0, Math.min(100, rawValue))
      : args.column.metricKey === "beast_tier"
        ? rawValue
        : rawValue;
  const formattedValue =
    args.column.metricKey === "beast_tier"
      ? (args.composite?.beast_tier ?? null)
      : rawValue == null
        ? null
        : rawValue.toFixed(1);
  const missingReason =
    args.unavailableReason ??
    (args.composite == null
      ? "Composite rating row is not published for this player/context."
      : args.column.metricKey === "results_luck_index"
        ? getResultsLuckUnavailableReasonForComposite(args.composite)
      : formattedValue == null
        ? "Composite metric is not available for this player/context."
        : null);

  return {
    metricKey: args.column.metricKey,
    shortLabel: args.column.shortLabel,
    fullLabel: args.column.fullLabel,
    groupKey: args.column.groupKey,
    rawValue,
    formattedValue,
    rank: null,
    percentile,
    qualifiedPeerCount: args.totalRows,
    lowerIsBetter: args.column.lowerIsBetter,
    availabilityState: missingReason ? "unavailable" : "available",
    availabilityReason: missingReason,
    sampleConfidence: args.composite ? "high" : "low",
    sourceQualityFlags: [...args.column.sourceQualityFlags],
    denominatorKey: args.column.denominatorKey,
    denominatorDescription: args.column.denominatorDescription,
    methodologyVersion:
      args.composite?.methodology_version ?? args.column.methodologyVersion,
    snapshotDate: args.composite?.snapshot_date ?? null,
    warnings: [],
    rankScopes: args.rankScopes,
  };
}

function toRowMap(rows: ContextualRankingApiRow[]) {
  return new Map(rows.map((row) => [row.entity.id, row]));
}

function rankScopeFromRow(
  row: ContextualRankingApiRow | null,
): PlayerMatrixRankScope | null {
  if (!row) return null;
  return {
    rank: row.metric.rawRank,
    percentile: row.metric.percentile,
    qualifiedPeerCount: row.metric.qualifiedPeerCount,
    peerGroupKey: row.peerGroup.key,
  };
}

function emptyRankScopes(): PlayerMatrixRankScopes {
  return {
    overall: null,
    deployment: null,
  };
}

function rankScopesFor(args: {
  overallRow: ContextualRankingApiRow | null;
  deploymentRow: ContextualRankingApiRow | null;
}): PlayerMatrixRankScopes {
  return {
    overall: rankScopeFromRow(args.overallRow),
    deployment: rankScopeFromRow(args.deploymentRow),
  };
}

function sampleConfidenceMatches(
  confidence: RankingSampleConfidence,
  filter: PlayerMatrixRequest["sampleConfidence"],
) {
  if (filter === "all") return true;
  if (filter === "high") return confidence === "high";
  return confidence === "high" || confidence === "medium";
}

export async function buildPlayerMatrixSurface(
  request: PlayerMatrixRequest,
): Promise<PlayerMatrixResponse> {
  const cacheKey = JSON.stringify(request);
  const now = Date.now();
  const cached = playerMatrixResponseCache.get(cacheKey);
  if (cached && cached.expiresAt > now) return cached.response;

  const generatedAt = new Date().toISOString();
  const allColumns = getMatrixMetricColumns();
  const plannedMetrics = allColumns.filter(
    (column) =>
      column.availabilityState !== "available" || !column.defaultVisible,
  );
  const metricColumns = getDefaultMatrixMetricColumns({
    strength: request.strength,
  });
  const sortColumn =
    getMatrixMetricColumn(request.sortMetric) ?? metricColumns[0] ?? null;
  const sortMetric =
    sortColumn?.definition?.availabilityStatus === "available" &&
    sortColumn.definition.applicableStrengthStates.includes(request.strength)
      ? sortColumn.metricKey
      : defaultMatrixSortMetric(metricColumns);
  const sortUsesComposite = isCompositeMetricKey(sortMetric);
  const sortDefinition = getContextualRankingMetricDefinition(sortMetric);
  const baseSortMetric = sortUsesComposite ? "points_per_60" : sortMetric;
  const surfaceMetricKeys = Array.from(
    new Set([
      baseSortMetric,
      ...metricColumns.flatMap((column) =>
        metricUnavailableReason({ column, request }) ||
        isCompositeMetricKey(column.metricKey)
          ? []
          : [column.metricKey],
      ),
    ]),
  );
  const baseContextualRequest = contextualRequestForMetric({
    request: {
      ...request,
      sortMetric: baseSortMetric,
    },
    metric: baseSortMetric,
    limit: null,
  });
  let rankingSource:
    | "fallback_rolling_player_game_metrics"
    | "entity_metric_rankings" = "fallback_rolling_player_game_metrics";
  let rankingSourceFallbackReason: string | null = null;
  let rankingSurfacesByMetric =
    request.rankingSourcePreference === "entity_metric_rankings"
      ? await buildEntityMetricRankingSurfaces(
          baseContextualRequest,
          [baseSortMetric],
          { hydrateMetadata: request.search != null },
        )
      : await buildContextualRankingsSurfaces(
          baseContextualRequest,
          [baseSortMetric],
        );
  const preferredSortSurface = rankingSurfacesByMetric.get(baseSortMetric);
  if (request.rankingSourcePreference === "entity_metric_rankings") {
    if (
      preferredSortSurface &&
      !preferredSortSurface.meta.unavailable &&
      preferredSortSurface.rankings.length > 0
    ) {
      rankingSource = "entity_metric_rankings";
    } else {
      rankingSourceFallbackReason =
        preferredSortSurface?.meta.message ??
        "entity_metric_rankings did not contain rows for the requested sort context.";
      rankingSurfacesByMetric = await buildContextualRankingsSurfaces(
        baseContextualRequest,
        [baseSortMetric],
      );
    }
  }
  const sortSurface = rankingSurfacesByMetric.get(baseSortMetric);
  if (!sortSurface) {
    throw new Error(`Ranking surface unavailable for ${baseSortMetric}`);
  }
  let sortedRows = sortSurface.rankings.filter((row) =>
    sampleConfidenceMatches(row.sample.confidence, request.sampleConfidence),
  );
  const compositeSortRowsByPlayerId = sortUsesComposite
    ? await fetchCompositeRatingsByPlayerId({
        request,
        snapshotDate: sortSurface.meta.snapshotDate,
        playerIds: sortedRows.map((row) => row.entity.id),
      })
    : new Map<number, CompositeRatingRow>();
  if (sortUsesComposite) {
    const direction = request.sortDirection === "asc" ? 1 : -1;
    sortedRows = [...sortedRows].sort((left, right) => {
      const leftValue = compositeMetricValue(
        compositeSortRowsByPlayerId.get(left.entity.id),
        sortMetric,
      );
      const rightValue = compositeMetricValue(
        compositeSortRowsByPlayerId.get(right.entity.id),
        sortMetric,
      );
      if (leftValue == null && rightValue == null)
        return left.entity.id - right.entity.id;
      if (leftValue == null) return 1;
      if (rightValue == null) return -1;
      if (leftValue !== rightValue) return (leftValue - rightValue) * direction;
      return left.entity.id - right.entity.id;
    });
  }
  const compositeSortRanksByPlayerId = sortUsesComposite
    ? rankNormalizedMetricValues(
        sortedRows.map((row) => {
          const value = compositeMetricValue(
            compositeSortRowsByPlayerId.get(row.entity.id),
            sortMetric,
          );
          return {
            id: row.entity.id,
            normalizedValue:
              value == null
                ? null
                : request.sortDirection === "asc"
                  ? -value
                  : value,
          };
        }),
      )
    : new Map();
  sortedRows = sortedRows.filter((row) =>
    rowMatchesSearch(row, request.search),
  );
  const start = (request.page - 1) * request.pageSize;
  const pageRows = sortedRows.slice(start, start + request.pageSize);
  const pagePlayerIds = pageRows.map((row) => row.entity.id);
  const overallPeerRequest: PlayerMatrixRequest = {
    ...request,
    deployment: "all",
    peerGroupType: derivePeerGroupType({
      teamId: request.teamId,
      deployment: "all",
      position: request.position,
    }),
    sortMetric: baseSortMetric,
  };
  const deploymentPeerRequest: PlayerMatrixRequest = {
    ...request,
    deployment: "all",
    peerGroupType: "deployment",
    sortMetric: baseSortMetric,
  };
  const buildSelectedRankingSurfaces =
    rankingSource === "entity_metric_rankings"
      ? buildEntityMetricRankingSurfaces
      : buildContextualRankingsSurfaces;
  const currentSurfacesPromise = buildSelectedRankingSurfaces(
    contextualRequestForMetric({
      request,
      metric: baseSortMetric,
      entityIds: pagePlayerIds,
      limit: null,
    }),
    surfaceMetricKeys,
  );
  const overallMatchesCurrent =
    overallPeerRequest.deployment === request.deployment &&
    overallPeerRequest.peerGroupType === request.peerGroupType &&
    overallPeerRequest.position === request.position &&
    overallPeerRequest.teamId === request.teamId;
  const overallSurfacesPromise = overallMatchesCurrent
    ? currentSurfacesPromise
    : buildSelectedRankingSurfaces(
        contextualRequestForMetric({
          request: overallPeerRequest,
          metric: baseSortMetric,
          entityIds: pagePlayerIds,
          limit: null,
        }),
        surfaceMetricKeys,
      );
  const deploymentSurfacesPromise = buildSelectedRankingSurfaces(
    contextualRequestForMetric({
      request: deploymentPeerRequest,
      metric: baseSortMetric,
      entityIds: pagePlayerIds,
      limit: null,
    }),
    surfaceMetricKeys,
  );
  const [
    currentSurfacesByMetric,
    overallSurfacesByMetric,
    deploymentSurfacesByMetric,
  ] = await Promise.all([
    currentSurfacesPromise,
    overallSurfacesPromise,
    deploymentSurfacesPromise,
  ]);
  const compositeRowsByPlayerId = sortUsesComposite
    ? new Map(
        pageRows.flatMap((row) => {
          const composite = compositeSortRowsByPlayerId.get(row.entity.id);
          return composite ? [[row.entity.id, composite] as const] : [];
        }),
      )
    : await fetchCompositeRatingsByPlayerId({
        request,
        snapshotDate: sortSurface.meta.snapshotDate,
        playerIds: pagePlayerIds,
      });
  const allStrengthsToiByPlayerId = await fetchAllStrengthsToiByPlayerId({
    request,
    snapshotDate: sortSurface.meta.snapshotDate,
    playerIds: pagePlayerIds,
  });
  const metricSurfaces = await Promise.all(
    metricColumns.map(async (column) => {
      const reason = metricUnavailableReason({ column, request });
      if (reason) return { column, reason, surface: null };
      if (isCompositeMetricKey(column.metricKey)) {
        return { column, reason: null, surface: null };
      }
      return {
        column,
        reason: null,
        surface: currentSurfacesByMetric.get(column.metricKey) ?? null,
      };
    }),
  );

  const metricRowsByKey = new Map(
    metricSurfaces.map((entry) => [
      entry.column.metricKey,
      entry.surface
        ? toRowMap(entry.surface.rankings)
        : new Map<number, ContextualRankingApiRow>(),
    ]),
  );
  const overallRowsByKey = new Map(
    metricSurfaces.map((entry) => [
      entry.column.metricKey,
      overallSurfacesByMetric.get(entry.column.metricKey)?.rankings
        ? toRowMap(
            overallSurfacesByMetric.get(entry.column.metricKey)?.rankings ?? [],
          )
        : new Map<number, ContextualRankingApiRow>(),
    ]),
  );
  const deploymentRowsByKey = new Map(
    metricSurfaces.map((entry) => [
      entry.column.metricKey,
      deploymentSurfacesByMetric.get(entry.column.metricKey)?.rankings
        ? toRowMap(
            deploymentSurfacesByMetric.get(entry.column.metricKey)?.rankings ??
              [],
          )
        : new Map<number, ContextualRankingApiRow>(),
    ]),
  );
  const snapshotByMetric = new Map(
    metricSurfaces.map((entry) => [
      entry.column.metricKey,
      entry.surface?.meta.snapshotDate ?? null,
    ]),
  );
  const unavailableMetrics = [
    ...(sortMetric !== request.sortMetric
      ? [
          {
            metricKey: request.sortMetric,
            label: sortColumn?.fullLabel ?? request.sortMetric,
            reason:
              sortColumn == null
                ? "Sort metric is not part of the matrix registry."
                : (metricUnavailableReason({ column: sortColumn, request }) ??
                  "Sort metric could not be used for this context."),
          },
        ]
      : []),
    ...metricSurfaces.flatMap((entry) =>
      entry.reason
        ? [
            {
              metricKey: entry.column.metricKey,
              label: entry.column.fullLabel,
              reason: entry.reason,
            },
          ]
        : entry.surface?.meta.unavailable
          ? [
              {
                metricKey: entry.column.metricKey,
                label: entry.column.fullLabel,
                reason:
                  entry.surface.meta.message ??
                  "Metric has no calculable values for the current filters.",
              },
            ]
          : [],
    ),
  ];

  const rows = pageRows.map((baseRow) => {
    const metrics: Record<string, PlayerMatrixMetricCell> = {};
    const composite = compositeRowsByPlayerId.get(baseRow.entity.id) ?? null;
    const displayBaseRow =
      metricRowsByKey.get(baseSortMetric)?.get(baseRow.entity.id) ?? baseRow;
    for (const entry of metricSurfaces) {
      if (isCompositeMetricKey(entry.column.metricKey)) {
        metrics[entry.column.metricKey] = cellFromCompositeRow({
          column: entry.column,
          composite,
          totalRows: sortedRows.length,
          unavailableReason: entry.reason,
          rankScopes: emptyRankScopes(),
        });
        continue;
      }
      const metricRow =
        metricRowsByKey.get(entry.column.metricKey)?.get(baseRow.entity.id) ??
        null;
      const overallRow =
        overallRowsByKey.get(entry.column.metricKey)?.get(baseRow.entity.id) ??
        metricRow;
      const deploymentRow =
        deploymentRowsByKey
          .get(entry.column.metricKey)
          ?.get(baseRow.entity.id) ?? null;
      const unavailableReason =
        entry.reason ??
        (entry.surface?.meta.unavailable
          ? (entry.surface.meta.message ??
            "Metric has no calculable values for this player in the current filters.")
          : metricRow == null
            ? "Metric row was not returned for this player in the current filters."
            : null);
      metrics[entry.column.metricKey] = cellFromRow({
        column: entry.column,
        row: metricRow,
        snapshotDate: snapshotByMetric.get(entry.column.metricKey) ?? null,
        unavailableReason,
        rankScopes: rankScopesFor({ overallRow, deploymentRow }),
      });
    }
    const sortOverallRow =
      overallRowsByKey.get(sortMetric)?.get(baseRow.entity.id) ??
      (sortUsesComposite ? null : baseRow);
    const sortDeploymentRow =
      deploymentRowsByKey.get(sortMetric)?.get(baseRow.entity.id) ?? null;
    const sortOverallScope = sortUsesComposite
      ? {
          rank:
            compositeSortRanksByPlayerId.get(baseRow.entity.id)?.rank ?? null,
          percentile: compositeMetricValue(composite ?? undefined, sortMetric),
          qualifiedPeerCount:
            compositeSortRanksByPlayerId.get(baseRow.entity.id)
              ?.qualifiedPeerCount ?? 0,
          peerGroupKey: matrixCompositePeerGroupKey(request),
        }
      : rankScopeFromRow(sortOverallRow);

    return {
      entity: displayBaseRow.entity,
      team: displayBaseRow.team,
      deployment: displayBaseRow.deployment,
      sample: {
        ...displayBaseRow.sample,
        allStrengthsToiPerGameSeconds:
          allStrengthsToiByPlayerId.get(baseRow.entity.id) ??
          (request.strength === "all"
            ? displayBaseRow.sample.toiPerGameSeconds
            : null),
      },
      peerGroup: displayBaseRow.peerGroup,
      tags: displayBaseRow.tags,
      warnings: displayBaseRow.warnings,
      sort: {
        metricKey: sortMetric,
        rank: sortUsesComposite
          ? (compositeSortRanksByPlayerId.get(baseRow.entity.id)?.rank ?? null)
          : baseRow.metric.rawRank,
        percentile: sortUsesComposite
          ? compositeMetricValue(composite ?? undefined, sortMetric)
          : baseRow.metric.percentile,
        rankScopes: {
          overall: sortOverallScope,
          deployment: sortUsesComposite
            ? null
            : rankScopeFromRow(sortDeploymentRow),
        },
      },
      composite: toComposite(composite),
      metrics,
    };
  });

  const selectedPlayerId =
    request.selectedPlayerId != null &&
    rows.some((row) => row.entity.id === request.selectedPlayerId)
      ? request.selectedPlayerId
      : (rows[0]?.entity.id ?? null);

  const response: PlayerMatrixResponse = {
    success: true,
    request: {
      ...request,
      sortMetric,
    },
    rows,
    selectedPlayerId,
    meta: {
      generatedAt,
      rowCount: rows.length,
      totalRankedRows: sortedRows.length,
      page: request.page,
      pageSize: request.pageSize,
      pageCount: Math.max(1, Math.ceil(sortedRows.length / request.pageSize)),
      sortMetric,
      sortDirection: request.sortDirection,
      metricGroups: MATRIX_METRIC_GROUPS,
      metricColumns,
      plannedMetrics,
      unavailableMetrics,
      colorScaleBands: MATRIX_COLOR_SCALE_BANDS,
      activePeerGroupDescription: activePeerGroupDescription(request),
      snapshotDate: sortSurface.meta.snapshotDate,
      latestAvailableSnapshotDate: sortSurface.meta.latestAvailableSnapshotDate,
      snapshotUpdatedAt: sortSurface.meta.snapshotUpdatedAt,
      snapshotSelectionReason: sortSurface.meta.snapshotSelectionReason,
      sourceTable:
        rankingSource === "entity_metric_rankings"
          ? "entity_metric_rankings"
          : "rolling_player_game_metrics",
      sourceTables: [
        rankingSource === "entity_metric_rankings"
          ? "entity_metric_rankings"
          : "rolling_player_game_metrics",
        "skater_composite_ratings",
      ],
      rankingSource,
      rankingSourcePreference: request.rankingSourcePreference,
      rankingSourceFallbackReason,
      methodologyVersion:
        sortDefinition?.methodologyVersion ?? sortColumn?.methodologyVersion ?? null,
      methodologyUpdatedAt: sortDefinition
        ? CONTEXTUAL_RANKINGS_METHODOLOGY_UPDATED_AT
        : null,
      sourceQualityFlags: Array.from(
        new Set([
          ...(sortDefinition?.sourceQualityFlags ?? []),
          ...metricColumns.flatMap((column) => column.sourceQualityFlags),
        ]),
      ),
      sourceWarnings: [
        ...(rankingSourceFallbackReason ? [rankingSourceFallbackReason] : []),
      ],
      compositeSourceTable: "skater_composite_ratings",
      message:
        sortSurface.meta.message ??
        (rows.length === 0 ? "No players matched the matrix filters." : null),
    },
  };
  playerMatrixResponseCache.set(cacheKey, {
    expiresAt: now + PLAYER_MATRIX_RESPONSE_CACHE_TTL_MS,
    response,
  });
  return response;
}
