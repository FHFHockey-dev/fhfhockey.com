import supabase from "lib/supabase/server";
import type { Database, Json } from "lib/supabase/database-generated.types";
import { buildContextualRankingRows, type ContextualRankingRow } from "./rankingCalculator";

import {
  getContextualRankingMetricDefinition,
  type ContextualRankingMetricDefinition,
  type ContextualRankingMetricKey,
} from "./metricDefinitions";
import {
  CONTEXTUAL_RANKINGS_METHODOLOGY_UPDATED_AT,
} from "./rankingMetadata";
import type {
  ContextualRankingApiRow,
  ContextualRankingsRequest,
  ContextualRankingsResponse,
} from "./rankingTypes";

type EntityMetricRankingRow =
  Database["public"]["Tables"]["entity_metric_rankings"]["Row"];

type PlayerMeta = {
  id: number;
  fullName: string | null;
  position: string | null;
  team_id: number | null;
  image_url: string | null;
};

type TeamMeta = {
  id: number;
  abbreviation: string | null;
  name: string | null;
};

const ENTITY_RANKING_QUERY_PAGE_SIZE = 1000;
const METADATA_IN_FILTER_CHUNK_SIZE = 500;
const METADATA_QUERY_PAGE_SIZE = 1000;
const SNAPSHOT_DATE_CACHE_TTL_MS = 30_000;
const ENTITY_RANKING_SELECT_FIELDS = [
  "entity_id",
  "team_id",
  "snapshot_date",
  "metric_key",
  "peer_group_type",
  "peer_group_key",
  "position_group",
  "deployment_bucket",
  "raw_value",
  "raw_rank",
  "percentile",
  "qualified_peer_count",
  "minimum_sample_met",
  "sample_confidence",
  "games_played",
  "toi_seconds",
  "tags",
  "explanation_items",
  "updated_at",
].join(",");

const snapshotDateCache = new Map<string, { expiresAt: number; value: string | null }>();

export function clearEntityMetricRankingReaderCachesForTests() {
  snapshotDateCache.clear();
}

function finiteNumber(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return value;
}

function windowType(window: ContextualRankingsRequest["window"]) {
  if (window === "last5") return "last_5";
  if (window === "last10") return "last_10";
  if (window === "last20") return "last_20";
  return "season";
}

function windowSize(window: ContextualRankingsRequest["window"]) {
  if (window === "last5") return 5;
  if (window === "last10") return 10;
  if (window === "last20") return 20;
  return 0;
}

function requestPeerGroupKey(request: ContextualRankingsRequest) {
  if (request.teamId != null) return String(request.teamId);
  if (request.deployment !== "all") return request.deployment;
  if (request.position === "F") return "forward";
  if (request.position === "D") return "defense";
  return "all";
}

function formatMetricValue(metricKey: ContextualRankingMetricKey, value: number | null) {
  if (value == null) return null;
  if (metricKey.endsWith("_percentage")) return `${value.toFixed(1)}%`;
  if (metricKey.endsWith("_per_60")) return value.toFixed(2);
  return Number(value.toFixed(3)).toString();
}

function metricResponseMetadata(
  definition: ContextualRankingMetricDefinition | undefined,
  fallbackKey: string,
): ContextualRankingsResponse["meta"]["metric"] {
  return {
    key: definition?.metricKey ?? fallbackKey,
    displayName: definition?.displayName ?? null,
    availabilityStatus: definition?.availabilityStatus ?? null,
    higherIsBetter: definition?.higherIsBetter ?? null,
    description: definition?.description ?? null,
    formulaDescription: definition?.formulaDescription ?? null,
    applicableStrengthStates: [...(definition?.applicableStrengthStates ?? [])],
    denominatorKey: definition?.denominatorKey ?? null,
    denominatorDescription: definition?.denominatorDescription ?? null,
    sampleRequirements: definition?.sampleRequirements ?? null,
    methodologyVersion: definition?.methodologyVersion ?? null,
    methodologyUpdatedAt: definition
      ? CONTEXTUAL_RANKINGS_METHODOLOGY_UPDATED_AT
      : null,
    sourceQualityFlags: [...(definition?.sourceQualityFlags ?? [])],
  };
}

function getWindowToiPerGame(row: EntityMetricRankingRow) {
  const toi = finiteNumber(row.toi_seconds);
  const gp = finiteNumber(row.games_played);
  if (toi == null || gp == null || gp <= 0) return null;
  return Number((toi / gp).toFixed(6));
}

function parseJsonStringArray(value: Json) {
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === "string")
    : [];
}

function deploymentFor(
  request: ContextualRankingsRequest,
  row: EntityMetricRankingRow,
): ContextualRankingApiRow["deployment"] {
  const bucket = row.deployment_bucket;
  return {
    ev:
      request.strength === "pp" || request.strength === "pk"
        ? null
        : (bucket as ContextualRankingApiRow["deployment"]["ev"]),
    pp:
      request.strength === "pp"
        ? (bucket as ContextualRankingApiRow["deployment"]["pp"])
        : null,
    pk:
      request.strength === "pk"
        ? (bucket as ContextualRankingApiRow["deployment"]["pk"])
        : null,
    confidence: bucket ? "medium" : "low",
  };
}

function sortRows(
  rows: ContextualRankingApiRow[],
  request: ContextualRankingsRequest,
) {
  const valueForSort = (row: ContextualRankingApiRow) => {
    if (request.sort === "raw_rank") return row.metric.rawRank;
    if (request.sort === "metric_value") return row.metric.value;
    if (request.sort === "gp") return row.sample.gamesPlayed;
    if (request.sort === "toi_per_game") return row.sample.toiPerGameSeconds;
    return row.metric.percentile;
  };
  const direction = request.direction === "asc" ? 1 : -1;

  return [...rows].sort((a, b) => {
    const aValue = valueForSort(a);
    const bValue = valueForSort(b);
    if (aValue == null && bValue == null) return a.entity.id - b.entity.id;
    if (aValue == null) return 1;
    if (bValue == null) return -1;
    if (aValue !== bValue) return (aValue - bValue) * direction;
    return a.entity.id - b.entity.id;
  });
}

async function fetchLatestSnapshotDate(request: ContextualRankingsRequest) {
  const definition = getContextualRankingMetricDefinition(request.metric);
  if (definition?.availabilityStatus !== "available" ||
      (definition.defaultStrengthState === "5v5" && request.strength !== "5v5")) return null;
  const cutoff = request.asOfDate ?? new Date().toISOString().slice(0, 10);
  const cacheKey = [
    request.season,
    cutoff,
    windowType(request.window),
    windowSize(request.window),
    request.strength,
    request.metric,
    request.peerGroupType,
    requestPeerGroupKey(request),
  ].join(":");
  const cached = snapshotDateCache.get(cacheKey);
  const now = Date.now();
  if (cached && cached.expiresAt > now) return cached.value;

  let query = supabase
    .from("entity_metric_rankings")
    .select("snapshot_date")
    .eq("entity_type", "skater")
    .eq("season_id", request.season)
    .eq("window_type", windowType(request.window))
    .eq("window_size", windowSize(request.window))
    .eq("strength_state", request.strength)
    .eq("metric_key", request.metric)
    .eq("peer_group_type", request.peerGroupType)
    .eq("peer_group_key", requestPeerGroupKey(request));
  query = query.lte("snapshot_date", cutoff);
  query = query.order("snapshot_date", { ascending: false });
  const { data, error } = await query.limit(1);
  if (error) throw error;
  const snapshotDate = data?.[0]?.snapshot_date;
  const value = typeof snapshotDate === "string" ? snapshotDate : null;
  snapshotDateCache.set(cacheKey, {
    expiresAt: now + SNAPSHOT_DATE_CACHE_TTL_MS,
    value,
  });
  return value;
}

async function fetchEntityMetricRows(
  request: ContextualRankingsRequest,
  snapshotDate: string,
  metricKeys: ContextualRankingMetricKey[] = [request.metric],
) {
  const rows: EntityMetricRankingRow[] = [];
  const uniqueMetricKeys = Array.from(new Set(metricKeys));
  for (let from = 0; ; from += ENTITY_RANKING_QUERY_PAGE_SIZE) {
    const query = supabase
      .from("entity_metric_rankings")
      .select(ENTITY_RANKING_SELECT_FIELDS)
      .eq("entity_type", "skater")
      .eq("season_id", request.season)
      .eq("snapshot_date", snapshotDate)
      .eq("window_type", windowType(request.window))
      .eq("window_size", windowSize(request.window))
      .eq("strength_state", request.strength)
      .in("metric_key", uniqueMetricKeys)
      .eq("peer_group_type", request.peerGroupType)
      .eq("peer_group_key", requestPeerGroupKey(request))
      .order("metric_key", { ascending: true })
      .order("entity_id", { ascending: true });
    const { data, error } = await query.range(from, from + ENTITY_RANKING_QUERY_PAGE_SIZE - 1);
    if (error) throw error;

    const page = (data ?? []) as unknown as EntityMetricRankingRow[];
    rows.push(...page);
    if (page.length < ENTITY_RANKING_QUERY_PAGE_SIZE) {
      break;
    }
  }

  return rows;
}

async function fetchPlayerMeta(playerIds: number[]) {
  if (playerIds.length === 0) return new Map<number, PlayerMeta>();
  const rows: PlayerMeta[] = [];
  const uniqueIds = Array.from(new Set(playerIds));

  for (let index = 0; index < uniqueIds.length; index += METADATA_IN_FILTER_CHUNK_SIZE) {
    const chunk = uniqueIds.slice(index, index + METADATA_IN_FILTER_CHUNK_SIZE);
    for (let from = 0; ; from += METADATA_QUERY_PAGE_SIZE) {
      const { data, error } = await supabase
        .from("players")
        .select("id,fullName,position,team_id,image_url")
        .in("id", chunk)
        .range(from, from + METADATA_QUERY_PAGE_SIZE - 1);
      if (error) throw error;

      const page = (data ?? []) as PlayerMeta[];
      rows.push(...page);
      if (page.length < METADATA_QUERY_PAGE_SIZE) break;
    }
  }

  return new Map(rows.map((player) => [player.id, player]));
}

async function fetchTeamMeta(teamIds: number[]) {
  if (teamIds.length === 0) return new Map<number, TeamMeta>();
  const rows: TeamMeta[] = [];
  const uniqueIds = Array.from(new Set(teamIds));

  for (let index = 0; index < uniqueIds.length; index += METADATA_IN_FILTER_CHUNK_SIZE) {
    const chunk = uniqueIds.slice(index, index + METADATA_IN_FILTER_CHUNK_SIZE);
    for (let from = 0; ; from += METADATA_QUERY_PAGE_SIZE) {
      const { data, error } = await supabase
        .from("teams")
        .select("id,abbreviation,name")
        .in("id", chunk)
        .range(from, from + METADATA_QUERY_PAGE_SIZE - 1);
      if (error) throw error;

      const page = (data ?? []) as TeamMeta[];
      rows.push(...page);
      if (page.length < METADATA_QUERY_PAGE_SIZE) break;
    }
  }

  return new Map(rows.map((team) => [team.id, team]));
}

function latestTimestamp(rows: EntityMetricRankingRow[]) {
  let latest: string | null = null;
  let latestTime = Number.NEGATIVE_INFINITY;

  for (const row of rows) {
    if (typeof row.updated_at !== "string") continue;
    const time = Date.parse(row.updated_at);
    if (!Number.isFinite(time) || time <= latestTime) continue;
    latest = row.updated_at;
    latestTime = time;
  }

  return latest;
}

function toApiRow(args: {
  request: ContextualRankingsRequest;
  row: EntityMetricRankingRow;
  ranking: ContextualRankingRow;
  player: PlayerMeta | null;
  team: TeamMeta | null;
}): ContextualRankingApiRow {
  const metricKey = args.row.metric_key as ContextualRankingMetricKey;
  const { ranking } = args;
  const gamesPlayed = finiteNumber(ranking.gamesPlayed);
  const toiSeconds = finiteNumber(ranking.toiSeconds);
  const minimumSampleMet = ranking.minimumSampleMet;
  return {
    entity: {
      id: args.row.entity_id,
      name: args.player?.fullName ?? null,
      position: args.player?.position ?? null,
      positionGroup: args.row.position_group as ContextualRankingApiRow["entity"]["positionGroup"],
      imageUrl: args.player?.image_url ?? null,
    },
    team: {
      id: args.row.team_id,
      abbreviation: args.team?.abbreviation ?? null,
      name: args.team?.name ?? null,
    },
    deployment: deploymentFor(args.request, args.row),
    sample: {
      gamesPlayed,
      toiSeconds,
      toiPerGameSeconds: getWindowToiPerGame(args.row),
      confidence: ranking.sampleConfidence,
      minimumSampleMet,
    },
    metric: {
      key: metricKey,
      value: ranking.calculatedRawValue,
      formattedValue: formatMetricValue(metricKey, ranking.calculatedRawValue),
      rawRank: ranking.rawRank,
      percentile: ranking.percentile,
      qualifiedPeerCount: ranking.qualifiedPeerCount,
    },
    peerGroup: {
      type: args.row.peer_group_type as ContextualRankingApiRow["peerGroup"]["type"],
      key: args.row.peer_group_key,
    },
    tags: [
      ...parseJsonStringArray(args.row.tags).filter(tag => tag !== "low-sample"),
      ...(minimumSampleMet ? [] : ["low-sample"]),
    ],
    warnings: ranking.warnings,
    explanationItems: ranking.rawRank == null
      ? [minimumSampleMet
        ? "Metric unavailable; rank and percentile unavailable."
        : "Sample unavailable or below selected minimums; rank and percentile unavailable."]
      : [
        `Rank ${ranking.rawRank} of ${ranking.qualifiedPeerCount} in ${ranking.peerGroupType}:${ranking.peerGroupKey}.`,
        `Better than ${ranking.percentile?.toFixed(1)}% of other qualified peers after metric directionality is applied.`,
      ],
  };
}

function buildEntityMetricRankingSurfaceFromRows(args: {
  request: ContextualRankingsRequest;
  rows: EntityMetricRankingRow[];
  playersById: Map<number, PlayerMeta>;
  teamsById: Map<number, TeamMeta>;
  generatedAt: string;
  snapshotDate: string | null;
}): ContextualRankingsResponse {
  const definition = getContextualRankingMetricDefinition(args.request.metric);
  const metricSupported = definition?.availabilityStatus === "available" &&
    (definition.defaultStrengthState !== "5v5" || args.request.strength === "5v5");
  if (args.snapshotDate == null) {
    return {
      success: true,
      request: args.request,
      rankings: [],
      meta: {
        generatedAt: args.generatedAt,
        snapshotDate: null,
        snapshotUpdatedAt: null,
        latestAvailableSnapshotDate: null,
        snapshotSelectionReason: metricSupported ? "no_snapshot" : "metric_unavailable",
      sourceTable: "entity_metric_rankings",
      metric: metricResponseMetadata(definition, args.request.metric),
      unavailable: true,
      rowCount: 0,
      limit: args.request.limit,
      methodologyVersion: definition?.methodologyVersion ?? null,
      methodologyUpdatedAt: definition
        ? CONTEXTUAL_RANKINGS_METHODOLOGY_UPDATED_AT
        : null,
      sourceQualityFlags: [...(definition?.sourceQualityFlags ?? [])],
      sourceWarnings: [],
      message: metricSupported
        ? "No entity_metric_rankings snapshot rows matched the request."
        : "Requested metric is not available at the selected strength.",
    },
  };
  }

  const entityIdFilter =
    args.request.entityIds == null ? null : new Set(args.request.entityIds);
  // Stored ranks belong to the publishing minimums. Rank the full snapshot
  // under this request's minimums before restricting displayed entities/rows.
  const rankedById = new Map(buildContextualRankingRows({
    metricKey: args.request.metric,
    peerGroupType: args.request.peerGroupType,
    minGp: args.request.minGp ?? undefined,
    minToiSeconds: args.request.minToiSeconds ?? undefined,
    candidates: args.rows.map(row => ({
      entityId: row.entity_id,
      teamId: row.team_id,
      metricKey: args.request.metric,
      rawValue: finiteNumber(row.raw_value),
      gamesPlayed: finiteNumber(row.games_played),
      toiSeconds: finiteNumber(row.toi_seconds),
      positionGroup: row.position_group as ContextualRankingRow["positionGroup"],
      deploymentBucket: row.deployment_bucket,
    })),
  }).map(row => [row.entityId, row]));
  const sortedApiRows = sortRows(
    args.rows.flatMap((row) => {
      const ranking = rankedById.get(row.entity_id);
      if (!ranking) return [];
      return [toApiRow({
        request: args.request,
        row,
        ranking,
        player: args.playersById.get(row.entity_id) ?? null,
        team:
          row.team_id == null ? null : args.teamsById.get(row.team_id) ?? null,
      })];
    }).filter(
      (row) => entityIdFilter == null || entityIdFilter.has(row.entity.id),
    ),
    args.request,
  );
  const apiRows =
    args.request.limit == null
      ? sortedApiRows
      : sortedApiRows.slice(0, args.request.limit);

  return {
    success: true,
    request: args.request,
    rankings: apiRows,
    meta: {
      generatedAt: args.generatedAt,
      snapshotDate: args.snapshotDate,
      snapshotUpdatedAt: latestTimestamp(args.rows),
      latestAvailableSnapshotDate: args.snapshotDate,
      snapshotSelectionReason: "latest_available",
      sourceTable: "entity_metric_rankings",
      metric: metricResponseMetadata(definition, args.request.metric),
      unavailable: args.rows.length === 0,
      rowCount: apiRows.length,
      limit: args.request.limit,
      methodologyVersion: definition?.methodologyVersion ?? null,
      methodologyUpdatedAt: definition
        ? CONTEXTUAL_RANKINGS_METHODOLOGY_UPDATED_AT
        : null,
      sourceQualityFlags: [...(definition?.sourceQualityFlags ?? [])],
      sourceWarnings: [],
      message:
        args.rows.length === 0
          ? "No entity_metric_rankings rows matched the selected snapshot."
          : apiRows.length === 0
            ? "No ranking rows matched the request."
            : null,
    },
  };
}

export async function buildEntityMetricRankingSurfaces(
  request: ContextualRankingsRequest,
  metricKeys: ContextualRankingMetricKey[],
  options: { hydrateMetadata?: boolean } = {},
): Promise<Map<ContextualRankingMetricKey, ContextualRankingsResponse>> {
  const hydrateMetadata = options.hydrateMetadata ?? true;
  const uniqueMetricKeys = Array.from(new Set(metricKeys));
  const generatedAt = new Date().toISOString();
  const snapshotEntries = await Promise.all(
    uniqueMetricKeys.map(async (metricKey) => {
      const snapshotDate = await fetchLatestSnapshotDate({ ...request, metric: metricKey });
      return [metricKey, snapshotDate] as const;
    }),
  );
  const snapshotDateByMetric = new Map(snapshotEntries);
  const metricKeysBySnapshotDate = new Map<string, ContextualRankingMetricKey[]>();

  for (const [metricKey, snapshotDate] of snapshotDateByMetric) {
    if (snapshotDate == null) continue;
    const existing = metricKeysBySnapshotDate.get(snapshotDate) ?? [];
    existing.push(metricKey);
    metricKeysBySnapshotDate.set(snapshotDate, existing);
  }

  const rowsByMetric = new Map<ContextualRankingMetricKey, EntityMetricRankingRow[]>(
    uniqueMetricKeys.map((metricKey) => [metricKey, []]),
  );
  const rowGroups = await Promise.all(
    Array.from(metricKeysBySnapshotDate.entries()).map(
      async ([snapshotDate, snapshotMetricKeys]) =>
        fetchEntityMetricRows(request, snapshotDate, snapshotMetricKeys),
    ),
  );
  const allRows = rowGroups.flat();
  for (const row of allRows) {
    const metricKey = row.metric_key as ContextualRankingMetricKey;
    const metricRows = rowsByMetric.get(metricKey);
    if (metricRows) metricRows.push(row);
  }

  const playerIds = allRows.map((row) => row.entity_id);
  const teamIds = allRows
    .map((row) => row.team_id)
    .filter((id): id is number => typeof id === "number");
  const [playersById, teamsById] = await Promise.all([
    hydrateMetadata ? fetchPlayerMeta(playerIds) : new Map<number, PlayerMeta>(),
    hydrateMetadata ? fetchTeamMeta(teamIds) : new Map<number, TeamMeta>(),
  ]);

  const entries = uniqueMetricKeys.map((metricKey) => {
    const metricRequest = { ...request, metric: metricKey };
    return [
      metricKey,
      buildEntityMetricRankingSurfaceFromRows({
        request: metricRequest,
        rows: rowsByMetric.get(metricKey) ?? [],
        playersById,
        teamsById,
        generatedAt,
        snapshotDate: snapshotDateByMetric.get(metricKey) ?? null,
      }),
    ] as const;
  });

  return new Map(entries);
}
