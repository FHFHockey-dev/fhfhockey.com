import supabase from "lib/supabase/server";
import type { Database, Json } from "lib/supabase/database-generated.types";

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

function warningsFor(row: EntityMetricRankingRow) {
  const warnings: ContextualRankingApiRow["warnings"] = [];
  if (!row.minimum_sample_met) warnings.push("sample_below_minimum");
  if (row.qualified_peer_count === 0) warnings.push("empty_peer_group");
  if (row.qualified_peer_count > 0 && row.qualified_peer_count < 3) {
    warnings.push("small_peer_group");
  }
  return warnings;
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
  const cacheKey = [
    request.season,
    request.asOfDate ?? "",
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
  if (request.asOfDate != null) {
    query = query.lte("snapshot_date", request.asOfDate);
  }
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
  const canApplyDatabaseLimit =
    uniqueMetricKeys.length === 1 &&
    request.limit != null &&
    request.entityIds == null &&
    request.sort !== "toi_per_game";

  for (let from = 0; ; from += ENTITY_RANKING_QUERY_PAGE_SIZE) {
    let query = supabase
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
      .eq("peer_group_key", requestPeerGroupKey(request));
    if (request.entityIds != null) {
      query = query.in("entity_id", request.entityIds);
    }
    if (canApplyDatabaseLimit) {
      const ascending = request.direction === "asc";
      if (request.sort === "raw_rank") {
        query = query
          .order("raw_rank", { ascending, nullsFirst: false })
          .order("entity_id", { ascending: true });
      } else if (request.sort === "metric_value") {
        query = query
          .order("raw_value", { ascending, nullsFirst: false })
          .order("entity_id", { ascending: true });
      } else if (request.sort === "gp") {
        query = query
          .order("games_played", { ascending, nullsFirst: false })
          .order("entity_id", { ascending: true });
      } else {
        query = query
          .order("percentile", { ascending, nullsFirst: false })
          .order("entity_id", { ascending: true });
      }
    }
    const { data, error } = canApplyDatabaseLimit
      ? await query.limit(request.limit ?? ENTITY_RANKING_QUERY_PAGE_SIZE)
      : await query.range(from, from + ENTITY_RANKING_QUERY_PAGE_SIZE - 1);
    if (error) throw error;

    const page = (data ?? []) as unknown as EntityMetricRankingRow[];
    rows.push(...page);
    if (canApplyDatabaseLimit || page.length < ENTITY_RANKING_QUERY_PAGE_SIZE) {
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
  player: PlayerMeta | null;
  team: TeamMeta | null;
}): ContextualRankingApiRow {
  const metricKey = args.row.metric_key as ContextualRankingMetricKey;
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
      gamesPlayed: args.row.games_played,
      toiSeconds: args.row.toi_seconds,
      toiPerGameSeconds: getWindowToiPerGame(args.row),
      confidence: args.row.sample_confidence as ContextualRankingApiRow["sample"]["confidence"],
      minimumSampleMet: args.row.minimum_sample_met,
    },
    metric: {
      key: metricKey,
      value: args.row.raw_value,
      formattedValue: formatMetricValue(metricKey, args.row.raw_value),
      rawRank: args.row.raw_rank,
      percentile: args.row.percentile,
      qualifiedPeerCount: args.row.qualified_peer_count,
    },
    peerGroup: {
      type: args.row.peer_group_type as ContextualRankingApiRow["peerGroup"]["type"],
      key: args.row.peer_group_key,
    },
    tags: parseJsonStringArray(args.row.tags),
    warnings: warningsFor(args.row),
    explanationItems: parseJsonStringArray(args.row.explanation_items),
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
        snapshotSelectionReason: "no_snapshot",
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
      message: "No entity_metric_rankings snapshot rows matched the request.",
    },
  };
  }

  const entityIdFilter =
    args.request.entityIds == null ? null : new Set(args.request.entityIds);
  const sortedApiRows = sortRows(
    args.rows.map((row) =>
      toApiRow({
        request: args.request,
        row,
        player: args.playersById.get(row.entity_id) ?? null,
        team:
          row.team_id == null ? null : args.teamsById.get(row.team_id) ?? null,
      }),
    ).filter(
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
  const snapshotEntries =
    uniqueMetricKeys.length <= 1
      ? await Promise.all(
          uniqueMetricKeys.map(async (metricKey) => {
            const snapshotDate = await fetchLatestSnapshotDate({
              ...request,
              metric: metricKey,
            });
            return [metricKey, snapshotDate] as const;
          }),
        )
      : uniqueMetricKeys.map((metricKey) => [
          metricKey,
          null,
        ] as const);
  const snapshotDateByMetric = new Map(snapshotEntries);
  if (uniqueMetricKeys.length > 1) {
    const batchSnapshotDate = await fetchLatestSnapshotDate({
      ...request,
      metric: uniqueMetricKeys.includes(request.metric)
        ? request.metric
        : uniqueMetricKeys[0],
    });
    for (const metricKey of uniqueMetricKeys) {
      snapshotDateByMetric.set(metricKey, batchSnapshotDate);
    }
  }
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
