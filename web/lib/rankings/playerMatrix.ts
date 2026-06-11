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
import type {
  SkaterProductionWindow,
  SkaterWindowStrengthState,
} from "./skaterWindowAggregation";

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
  peerGroupType: ContextualRankingPeerGroupType;
  sortMetric: ContextualRankingMetricKey;
  sortDirection: ContextualRankingsSortDirection;
  sampleConfidence: "all" | "medium_plus" | "high";
  page: number;
  pageSize: number;
  selectedPlayerId: number | null;
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
  methodologyVersion: string | null;
  snapshotDate: string | null;
  updatedAt: string | null;
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
    sourceTable: "rolling_player_game_metrics";
    message: string | null;
  };
};

type QueryValue = string | string[] | undefined;

const DEFAULT_PAGE_SIZE = 10;
const MAX_PAGE_SIZE = 50;
const COMPOSITE_IN_FILTER_CHUNK_SIZE = 500;
const COMPOSITE_QUERY_PAGE_SIZE = 1000;
const PAGE_SIZE_OPTIONS = [10, 25, 50] as const;
const COMPOSITE_METRIC_KEYS = ["mcm_score", "beast_tier", "results_luck_index"] as const;

type CompositeMetricKey = (typeof COMPOSITE_METRIC_KEYS)[number];
type CompositeRatingRow =
  Database["public"]["Tables"]["skater_composite_ratings"]["Row"];

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
    ? parsed ?? DEFAULT_PAGE_SIZE
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

export function parsePlayerMatrixRequest(
  query: NextApiRequest["query"],
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
  const teamId = parseInteger(query.team, "team", { min: 1 });
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
    page: parseInteger(query.page, "page", {
      defaultValue: 1,
      min: 1,
      max: 100,
    }) ?? 1,
    pageSize: parsePageSize(query.page_size),
    selectedPlayerId: parseInteger(query.selected_player, "selected_player", {
      min: 1,
    }),
  };
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

function isCompositeMetricKey(metricKey: string): metricKey is CompositeMetricKey {
  return COMPOSITE_METRIC_KEYS.includes(metricKey as CompositeMetricKey);
}

function compositeMetricValue(
  row: CompositeRatingRow | undefined,
  metricKey: CompositeMetricKey,
) {
  if (!row) return null;
  if (metricKey === "results_luck_index") return row.results_luck_index;
  return row.mcm_score;
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
  if (request.position === "F" || request.position === "D") return request.position;
  return "all_skaters";
}

function toComposite(row: CompositeRatingRow | null): PlayerMatrixComposite | null {
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
    methodologyVersion: row.methodology_version,
    snapshotDate: row.snapshot_date,
    updatedAt: row.updated_at,
  };
}

async function fetchCompositeRatingsByPlayerId(args: {
  request: PlayerMatrixRequest;
  snapshotDate: string | null;
  playerIds: number[];
}) {
  if (
    args.snapshotDate == null ||
    args.playerIds.length === 0
  ) {
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
    const chunk = uniquePlayerIds.slice(index, index + COMPOSITE_IN_FILTER_CHUNK_SIZE);
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

  return new Map(
    rows.map((row) => [row.player_id, row]),
  );
}

function metricUnavailableReason(args: {
  column: MatrixMetricColumnDefinition;
  request: PlayerMatrixRequest;
}) {
  if (!args.column.definition) return "Metric definition is missing.";
  if (args.column.availabilityState !== "available") {
    return args.column.plannedReason ?? "Metric is planned and not live yet.";
  }
  if (!args.column.definition.applicableStrengthStates.includes(args.request.strength)) {
    return `Metric is not available for ${args.request.strength.toUpperCase()} strength.`;
  }
  return null;
}

function cellFromRow(args: {
  column: MatrixMetricColumnDefinition;
  row: ContextualRankingApiRow | null;
  snapshotDate: string | null;
  unavailableReason: string | null;
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
  };
}

function cellFromCompositeRow(args: {
  column: MatrixMetricColumnDefinition;
  composite: CompositeRatingRow | null;
  totalRows: number;
  unavailableReason: string | null;
}): PlayerMatrixMetricCell {
  const mcmScore = args.composite?.mcm_score ?? null;
  const resultsLuckIndex = args.composite?.results_luck_index ?? null;
  const rawValue =
    args.column.metricKey === "results_luck_index"
      ? resultsLuckIndex
      : args.column.metricKey === "mcm_score"
        ? mcmScore
        : null;
  const percentile =
    args.column.metricKey === "results_luck_index"
      ? resultsLuckIndex == null
        ? null
        : Math.max(0, Math.min(100, resultsLuckIndex))
      : mcmScore;
  const formattedValue =
    args.column.metricKey === "beast_tier"
      ? args.composite?.beast_tier ?? null
      : rawValue == null
        ? null
        : rawValue.toFixed(1);
  const missingReason =
    args.unavailableReason ??
    (args.composite == null
      ? "Composite rating row is not published for this player/context."
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
    methodologyVersion: args.composite?.methodology_version ?? args.column.methodologyVersion,
    snapshotDate: args.composite?.snapshot_date ?? null,
    warnings: [],
  };
}

function toRowMap(rows: ContextualRankingApiRow[]) {
  return new Map(rows.map((row) => [row.entity.id, row]));
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
  const generatedAt = new Date().toISOString();
  const allColumns = getMatrixMetricColumns();
  const plannedMetrics = allColumns.filter(
    (column) => column.availabilityState !== "available" || !column.defaultVisible,
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
  const rankingSurfacesByMetric = await buildContextualRankingsSurfaces(
    contextualRequestForMetric({
      request: {
        ...request,
        sortMetric: baseSortMetric,
      },
      metric: baseSortMetric,
      limit: null,
    }),
    surfaceMetricKeys,
  );
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
      if (leftValue == null && rightValue == null) return left.entity.id - right.entity.id;
      if (leftValue == null) return 1;
      if (rightValue == null) return -1;
      if (leftValue !== rightValue) return (leftValue - rightValue) * direction;
      return left.entity.id - right.entity.id;
    });
  }
  const sortRankByPlayerId = new Map(
    sortedRows.map((row, index) => [row.entity.id, index + 1]),
  );
  const start = (request.page - 1) * request.pageSize;
  const pageRows = sortedRows.slice(start, start + request.pageSize);
  const pagePlayerIds = pageRows.map((row) => row.entity.id);
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
        surface: rankingSurfacesByMetric.get(column.metricKey) ?? null,
      };
    }),
  );

  const metricRowsByKey = new Map(
    metricSurfaces.map((entry) => [
      entry.column.metricKey,
      entry.surface ? toRowMap(entry.surface.rankings) : new Map<number, ContextualRankingApiRow>(),
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
                : metricUnavailableReason({ column: sortColumn, request }) ??
                  "Sort metric could not be used for this context.",
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
    for (const entry of metricSurfaces) {
      if (isCompositeMetricKey(entry.column.metricKey)) {
        metrics[entry.column.metricKey] = cellFromCompositeRow({
          column: entry.column,
          composite,
          totalRows: sortedRows.length,
          unavailableReason: entry.reason,
        });
        continue;
      }
      const metricRow =
        metricRowsByKey.get(entry.column.metricKey)?.get(baseRow.entity.id) ??
        null;
      const unavailableReason =
        entry.reason ??
        (entry.surface?.meta.unavailable
          ? entry.surface.meta.message ??
            "Metric has no calculable values for this player in the current filters."
          : metricRow == null
            ? "Metric row was not returned for this player in the current filters."
            : null);
      metrics[entry.column.metricKey] = cellFromRow({
        column: entry.column,
        row: metricRow,
        snapshotDate: snapshotByMetric.get(entry.column.metricKey) ?? null,
        unavailableReason,
      });
    }

    return {
      entity: baseRow.entity,
      team: baseRow.team,
      deployment: baseRow.deployment,
      sample: baseRow.sample,
      peerGroup: baseRow.peerGroup,
      tags: baseRow.tags,
      warnings: baseRow.warnings,
      sort: {
        metricKey: sortMetric,
        rank: sortUsesComposite
          ? sortRankByPlayerId.get(baseRow.entity.id) ?? null
          : baseRow.metric.rawRank,
        percentile: sortUsesComposite
          ? compositeMetricValue(composite ?? undefined, sortMetric)
          : baseRow.metric.percentile,
      },
      composite: toComposite(composite),
      metrics,
    };
  });

  const selectedPlayerId =
    request.selectedPlayerId != null &&
    rows.some((row) => row.entity.id === request.selectedPlayerId)
      ? request.selectedPlayerId
      : rows[0]?.entity.id ?? null;

  return {
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
      sourceTable: "rolling_player_game_metrics",
      message:
        sortSurface.meta.message ??
        (rows.length === 0 ? "No players matched the matrix filters." : null),
    },
  };
}
