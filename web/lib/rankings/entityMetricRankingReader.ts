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
import {
  RANKING_PUBLICATIONS_TABLE,
  isMissingPublicationTableError,
} from "./rankingPublications";
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
const pairedCutoffCache = new Map<string, { expiresAt: number; value: Promise<string | null> }>();
const publicationMarkerCache = new Map<
  string,
  { expiresAt: number; value: Promise<PublicationMarkers | null> }
>();

export function clearEntityMetricRankingReaderCachesForTests() {
  snapshotDateCache.clear();
  pairedCutoffCache.clear();
  publicationMarkerCache.clear();
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

type PublishedScope = {
  peerGroupType: string;
  peerGroupKey: string;
  /** True when the declared pool is re-ranked from the all-skater cohort. */
  derived: boolean;
};

const ALL_SKATER_SCOPE: PublishedScope = {
  peerGroupType: "all_skaters",
  peerGroupKey: "all",
  derived: true,
};

export const DERIVED_PEER_POOL_WARNING =
  "Ranks are re-computed inside the selected pool from the all-skater publication.";

function exactScope(request: ContextualRankingsRequest): PublishedScope {
  return {
    peerGroupType: request.peerGroupType,
    peerGroupKey: requestPeerGroupKey(request),
    derived: false,
  };
}

// Only the all-skater cohort is published. Team, position and even-strength
// deployment pools can be re-ranked from it (its rows carry team_id,
// position_group and the EV deployment bucket); PP/PK units cannot.
function canDeriveFromAllSkaters(request: ContextualRankingsRequest) {
  return (
    request.peerGroupType !== "all_skaters" &&
    !request.deployment.startsWith("PP") &&
    !request.deployment.startsWith("PK")
  );
}

function rowInDeclaredPool(
  row: EntityMetricRankingRow,
  request: ContextualRankingsRequest,
) {
  if (request.teamId != null && row.team_id !== request.teamId) return false;
  if (request.position === "F" && row.position_group !== "forward") return false;
  if (request.position === "D" && row.position_group !== "defense") return false;
  if (request.deployment !== "all" && row.deployment_bucket !== request.deployment) {
    return false;
  }
  return true;
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

// Rankings and composites publish as one pair, and the matrix joins composites
// on the exact rankings date. Serve rankings no newer than the latest composite
// date for the season and strength, so a half-finished publish keeps the last
// complete pair visible. A season/strength with no composites is not capped.
async function fetchPairedPublicationCutoff(
  request: ContextualRankingsRequest,
  cutoff: string,
) {
  const cacheKey = [request.season, cutoff, request.strength].join(":");
  const cached = pairedCutoffCache.get(cacheKey);
  const now = Date.now();
  if (cached && cached.expiresAt > now) return cached.value;

  // Cache the promise so concurrent metric lookups share one read.
  const value = (async () => {
    const { data, error } = await supabase
      .from("skater_composite_ratings")
      .select("snapshot_date")
      .eq("season_id", request.season)
      .eq("strength_state", request.strength)
      .eq("window_type", "season")
      .eq("window_size", 0)
      .eq("peer_group_type", "all_skaters")
      .lte("snapshot_date", cutoff)
      .order("snapshot_date", { ascending: false })
      .limit(1);
    if (error) throw error;
    const snapshotDate = data?.[0]?.snapshot_date;
    return typeof snapshotDate === "string" ? snapshotDate : null;
  })();
  pairedCutoffCache.set(cacheKey, {
    expiresAt: now + SNAPSHOT_DATE_CACHE_TTL_MS,
    value,
  });
  value.catch(() => pairedCutoffCache.delete(cacheKey));
  return value;
}

const MAX_PAIRING_STEPS = 8;
const PUBLICATION_MARKER_LIMIT = 200;

type PublicationMarker = {
  surface: string;
  snapshot_date: string;
  window_type: string;
  window_size: number;
  peer_group_type: string;
  peer_group_key: string;
  status: string;
};
type PublicationMarkers = {
  // Oldest marker date of any status for the season and strength: the start
  // of the marker era.
  eraStart: string;
  recent: PublicationMarker[];
};

// Completion markers for a season and strength, newest first, with the era
// start. Null when there are none or the table is not deployed yet: the
// reader then keeps the #449 date match.
async function fetchPublicationMarkers(
  request: ContextualRankingsRequest,
  cutoff: string,
) {
  const cacheKey = [request.season, cutoff, request.strength].join(":");
  const cached = publicationMarkerCache.get(cacheKey);
  const now = Date.now();
  if (cached && cached.expiresAt > now) return cached.value;

  const value = (async (): Promise<PublicationMarkers | null> => {
    const base = () =>
      supabase
        .from(RANKING_PUBLICATIONS_TABLE)
        .select("surface,snapshot_date,window_type,window_size,peer_group_type,peer_group_key,status")
        .eq("season_id", request.season)
        .eq("strength_state", request.strength)
        .lte("snapshot_date", cutoff);
    const [recent, oldest] = await Promise.all([
      base().order("snapshot_date", { ascending: false }).limit(PUBLICATION_MARKER_LIMIT),
      base().order("snapshot_date", { ascending: true }).limit(1),
    ]);
    for (const result of [recent, oldest]) {
      if (result.error) {
        if (isMissingPublicationTableError(result.error)) return null;
        throw result.error;
      }
    }
    const eraStart = (oldest.data?.[0] as PublicationMarker | undefined)?.snapshot_date;
    if (typeof eraStart !== "string") return null;
    return { eraStart, recent: (recent.data ?? []) as PublicationMarker[] };
  })();
  publicationMarkerCache.set(cacheKey, {
    expiresAt: now + SNAPSHOT_DATE_CACHE_TTL_MS,
    value,
  });
  value.catch(() => publicationMarkerCache.delete(cacheKey));
  return value;
}

function dayBefore(date: string) {
  const previous = new Date(`${date}T00:00:00.000Z`);
  previous.setUTCDate(previous.getUTCDate() - 1);
  return previous.toISOString().slice(0, 10);
}

async function fetchLatestSnapshotDate(
  request: ContextualRankingsRequest,
  scope: PublishedScope = exactScope(request),
) {
  const definition = getContextualRankingMetricDefinition(request.metric);
  if (definition?.availabilityStatus !== "available" ||
      (definition.defaultStrengthState === "5v5" && request.strength !== "5v5")) return null;
  const requestedCutoff = request.asOfDate ?? new Date().toISOString().slice(0, 10);

  // Markers are written only for the all-skater publication. Inside the
  // marker era a date is served only when its Rankings (requested window) and
  // composites (season window) are both complete and this metric has rows
  // there. Until the era has a complete pair (the first marked publish, or
  // between its Rankings and composites writes), the #449 date match runs
  // below the era start, so the last unmarked pair stays live.
  const allSkaters = scope.peerGroupType === "all_skaters" && scope.peerGroupKey === "all";
  const markers = allSkaters ? await fetchPublicationMarkers(request, requestedCutoff) : null;
  if (!markers) return fetchPairedSnapshotDate(request, scope, requestedCutoff);

  const completeDates = (surface: string, type: string, size: number) =>
    new Set(markers.recent
      .filter((marker) =>
        marker.surface === surface && marker.status === "complete" &&
        marker.window_type === type && marker.window_size === size &&
        marker.peer_group_type === "all_skaters" && marker.peer_group_key === "all")
      .map((marker) => marker.snapshot_date));
  const rankingDates = completeDates("entity_metric_rankings", windowType(request.window), windowSize(request.window));
  const compositeDates = completeDates("skater_composite_ratings", "season", 0);
  // A season and strength with no composites at all (e.g. all-strength) is
  // not paired, as under #449: its complete Rankings markers decide alone.
  const hasComposites = (await fetchPairedPublicationCutoff(request, requestedCutoff)) != null;
  const pairDates = [...rankingDates]
    .filter((date) => !hasComposites || compositeDates.has(date))
    .sort()
    .reverse()
    .slice(0, MAX_PAIRING_STEPS);
  for (const date of pairDates) {
    if ((await fetchLatestRankingDate(request, scope, date)) === date) return date;
  }
  return fetchPairedSnapshotDate(request, scope, dayBefore(markers.eraStart));
}

// #449: serve the newest date that has both rankings and composites. Step
// down until the two dates match: a rankings-only date (between two composite
// dates, or ahead of its composites) is skipped. Where no pair exists at all,
// keep the plain latest rankings date.
async function fetchPairedSnapshotDate(
  request: ContextualRankingsRequest,
  scope: PublishedScope,
  requestedCutoff: string,
) {
  let cutoff = requestedCutoff;
  for (let step = 0; step < MAX_PAIRING_STEPS; step += 1) {
    const compositeDate = await fetchPairedPublicationCutoff(request, cutoff);
    if (compositeDate == null) break;
    const rankingDate = await fetchLatestRankingDate(request, scope, compositeDate);
    if (rankingDate == null) break;
    if (rankingDate === compositeDate) return rankingDate;
    cutoff = rankingDate;
  }
  return fetchLatestRankingDate(request, scope, requestedCutoff);
}

async function fetchLatestRankingDate(
  request: ContextualRankingsRequest,
  scope: PublishedScope,
  cutoff: string,
) {
  const cacheKey = [
    request.season,
    cutoff,
    windowType(request.window),
    windowSize(request.window),
    request.strength,
    request.metric,
    scope.peerGroupType,
    scope.peerGroupKey,
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
    .eq("peer_group_type", scope.peerGroupType)
    .eq("peer_group_key", scope.peerGroupKey);
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
  scope: PublishedScope = exactScope(request),
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
      .eq("peer_group_type", scope.peerGroupType)
      .eq("peer_group_key", scope.peerGroupKey)
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

  return scope.derived
    ? rows.filter((row) => rowInDeclaredPool(row, request))
    : rows;
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
    // The pool the row was ranked in: the stored one, or the declared pool
    // re-ranked from the all-skater publication.
    peerGroup: {
      type: args.ranking.peerGroupType,
      key: args.ranking.peerGroupKey,
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
        `Mid-rank percentile ${ranking.percentile?.toFixed(1)} among qualified peers after metric directionality is applied (ties share the mid-rank).`,
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
  derivedFromAllSkaters?: boolean;
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
    window: args.request.window,
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
      sourceWarnings: args.derivedFromAllSkaters ? [DERIVED_PEER_POOL_WARNING] : [],
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
      const metricRequest = { ...request, metric: metricKey };
      let scope = exactScope(metricRequest);
      let snapshotDate = await fetchLatestSnapshotDate(metricRequest, scope);
      if (snapshotDate == null && canDeriveFromAllSkaters(metricRequest)) {
        scope = ALL_SKATER_SCOPE;
        snapshotDate = await fetchLatestSnapshotDate(metricRequest, scope);
      }
      return { metricKey, snapshotDate, scope };
    }),
  );
  const snapshotDateByMetric = new Map(
    snapshotEntries.map(({ metricKey, snapshotDate }) => [metricKey, snapshotDate] as const),
  );
  const derivedMetricKeys = new Set(
    snapshotEntries
      .filter(({ snapshotDate, scope }) => snapshotDate != null && scope.derived)
      .map(({ metricKey }) => metricKey),
  );
  const metricKeysBySnapshotScope = new Map<
    string,
    { snapshotDate: string; scope: PublishedScope; metricKeys: ContextualRankingMetricKey[] }
  >();
  for (const { metricKey, snapshotDate, scope } of snapshotEntries) {
    if (snapshotDate == null) continue;
    const groupKey = `${snapshotDate}:${scope.peerGroupType}:${scope.peerGroupKey}`;
    const existing = metricKeysBySnapshotScope.get(groupKey) ??
      { snapshotDate, scope, metricKeys: [] };
    existing.metricKeys.push(metricKey);
    metricKeysBySnapshotScope.set(groupKey, existing);
  }

  const rowsByMetric = new Map<ContextualRankingMetricKey, EntityMetricRankingRow[]>(
    uniqueMetricKeys.map((metricKey) => [metricKey, []]),
  );
  const rowGroups = await Promise.all(
    Array.from(metricKeysBySnapshotScope.values()).map(
      async ({ snapshotDate, scope, metricKeys: snapshotMetricKeys }) =>
        fetchEntityMetricRows(request, snapshotDate, snapshotMetricKeys, scope),
    ),
  );
  const allRows = rowGroups.flat();
  for (const row of allRows) {
    const metricKey = row.metric_key as ContextualRankingMetricKey;
    const metricRows = rowsByMetric.get(metricKey);
    if (metricRows) metricRows.push(row);
  }

  const buildEntries = (
    playersById: Map<number, PlayerMeta>,
    teamsById: Map<number, TeamMeta>,
  ) =>
    uniqueMetricKeys.map((metricKey) => {
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
          derivedFromAllSkaters: derivedMetricKeys.has(metricKey),
        }),
      ] as const;
    });

  // Ranking needs the full cohort, but display metadata does not. Ranks and
  // sort order never read metadata, so select the returned rows first and
  // hydrate only those players and teams.
  const unhydrated = buildEntries(new Map(), new Map());
  if (!hydrateMetadata) return new Map(unhydrated);
  const returnedRows = unhydrated.flatMap(([, surface]) => surface.rankings);
  const [playersById, teamsById] = await Promise.all([
    fetchPlayerMeta(returnedRows.map((row) => row.entity.id)),
    fetchTeamMeta(
      returnedRows
        .map((row) => row.team.id)
        .filter((id): id is number => typeof id === "number"),
    ),
  ]);

  return new Map(unhydrated.map(([metricKey, surface]) => [metricKey, {
    ...surface,
    rankings: surface.rankings.map((row) => {
      const player = playersById.get(row.entity.id);
      const team = row.team.id == null ? null : teamsById.get(row.team.id);
      return {
        ...row,
        entity: {
          ...row.entity,
          name: player?.fullName ?? null,
          position: player?.position ?? null,
          imageUrl: player?.image_url ?? null,
        },
        team: {
          ...row.team,
          abbreviation: team?.abbreviation ?? null,
          name: team?.name ?? null,
        },
      };
    }),
  }]));
}
