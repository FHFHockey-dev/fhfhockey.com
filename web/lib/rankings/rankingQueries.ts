import supabase from "lib/supabase/server";

import {
  getContextualRankingMetricDefinition,
  type ContextualRankingMetricDefinition,
  type ContextualRankingMetricKey,
} from "./metricDefinitions";
import {
  CONTEXTUAL_RANKINGS_METHODOLOGY_UPDATED_AT,
} from "./rankingMetadata";
import {
  buildContextualRankingRows,
  type ContextualRankingCandidate,
  type ContextualRankingRow,
} from "./rankingCalculator";
import {
  normalizeEvDeploymentBucket,
  normalizePkDeploymentBucket,
  normalizePpDeploymentBucket,
  type EvDeploymentBucket,
  type SpecialTeamsDeploymentBucket,
} from "./skaterDeploymentAggregation";
import {
  buildSkaterWindowAggregatesFromRollingRow,
  type RollingPlayerGameMetricRow,
} from "./skaterWindowAggregation";
import type {
  ContextualRankingApiRow,
  ContextualRankingsRequest,
  ContextualRankingsResponse,
} from "./rankingTypes";
import { ROLLING_RANKING_SELECT_FIELDS } from "./rollingRankingSelectFields";

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

type CandidateContext = {
  player: PlayerMeta | null;
  team: TeamMeta | null;
  evDeploymentBucket: EvDeploymentBucket | null;
  ppDeploymentBucket: SpecialTeamsDeploymentBucket | null;
  pkDeploymentBucket: SpecialTeamsDeploymentBucket | null;
};

const MAX_SNAPSHOT_DATES_TO_EVALUATE = 30;
const ROLLING_QUERY_PAGE_SIZE = 1000;
const METADATA_IN_FILTER_CHUNK_SIZE = 500;
const METADATA_QUERY_PAGE_SIZE = 1000;
const ROLLING_SNAPSHOT_CACHE_TTL_MS = 30_000;
const ROLLING_DATE_QUERY_CONCURRENCY = 6;

const rollingSnapshotRowsCache = new Map<
  string,
  { expiresAt: number; rows: RollingPlayerGameMetricRow[] }
>();

export function clearContextualRankingsQueryCachesForTests() {
  rollingSnapshotRowsCache.clear();
}

function finiteNumber(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return value;
}

function latestTimestamp(rows: RollingPlayerGameMetricRow[]) {
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

function toPositionGroup(position: string | null | undefined) {
  const normalized = position?.toUpperCase();
  if (normalized === "D") return "defense" as const;
  if (
    normalized === "C" ||
    normalized === "LW" ||
    normalized === "RW" ||
    normalized === "L" ||
    normalized === "R" ||
    normalized === "F"
  ) {
    return "forward" as const;
  }
  return null;
}

function selectedDeploymentBucket(args: {
  request: ContextualRankingsRequest;
  ev: EvDeploymentBucket | null;
  pp: SpecialTeamsDeploymentBucket | null;
  pk: SpecialTeamsDeploymentBucket | null;
}): string | null {
  if (args.request.deployment.startsWith("PP")) return args.pp;
  if (args.request.deployment.startsWith("PK")) return args.pk;
  return args.ev;
}

function passesDeploymentFilter(args: {
  request: ContextualRankingsRequest;
  ev: EvDeploymentBucket | null;
  pp: SpecialTeamsDeploymentBucket | null;
  pk: SpecialTeamsDeploymentBucket | null;
}) {
  if (args.request.deployment === "all") return true;
  return (
    args.request.deployment === args.ev ||
    args.request.deployment === args.pp ||
    args.request.deployment === args.pk
  );
}

function getWindowToiPerGame(row: ContextualRankingRow) {
  const toi = finiteNumber(row.toiSeconds);
  const gp = finiteNumber(row.gamesPlayed);
  if (toi == null || gp == null || gp <= 0) return null;
  return Number((toi / gp).toFixed(6));
}

function formatMetricValue(metricKey: ContextualRankingMetricKey, value: number | null) {
  if (value == null) return null;
  if (metricKey.endsWith("_percentage")) return `${value.toFixed(1)}%`;
  if (metricKey.endsWith("_per_60")) return value.toFixed(2);
  return Number(value.toFixed(3)).toString();
}

function explanationItems(row: ContextualRankingRow) {
  const items = [
    row.rawRank == null
      ? "Unranked because the row is unavailable or below the minimum sample."
      : `Rank ${row.rawRank} of ${row.qualifiedPeerCount} in ${row.peerGroupType}:${row.peerGroupKey}.`,
  ];
  if (row.percentile != null) {
    items.push(
      `Peer percentile ${row.percentile.toFixed(1)}%; higher is better after metric directionality is applied.`,
    );
  }
  if (!row.minimumSampleMet) {
    items.push("Minimum GP or TOI sample was not met before ranking.");
  }
  return items;
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

function hasCalculableMetricValue(rows: ContextualRankingRow[]) {
  return rows.some((row) => row.calculatedRawValue != null);
}

function snapshotSelectionMessage(args: {
  selectedSnapshotDate: string | null;
  latestAvailableSnapshotDate: string | null;
  metricKey: ContextualRankingMetricKey;
}) {
  if (
    args.selectedSnapshotDate == null ||
    args.latestAvailableSnapshotDate == null ||
    args.selectedSnapshotDate === args.latestAvailableSnapshotDate
  ) {
    return null;
  }

  return `Using latest calculable ${args.metricKey} snapshot (${args.selectedSnapshotDate}); latest available snapshot ${args.latestAvailableSnapshotDate} has no calculable values for this metric/filter.`;
}

async function resolveRollingSnapshotDates(
  request: ContextualRankingsRequest,
): Promise<string[]> {
  const requestedCutoff =
    request.asOfDate ?? new Date().toISOString().slice(0, 10);
  const latestRolling = await supabase
    .from("rolling_player_game_metrics")
    .select("game_date")
    .eq("season", request.season)
    .eq("strength_state", request.strength)
    .lte("game_date", requestedCutoff)
    .order("game_date", { ascending: false })
    .limit(1);
  if (latestRolling.error) throw latestRolling.error;

  const latestRollingDate = latestRolling.data?.[0]?.game_date;
  if (typeof latestRollingDate !== "string") return [];

  const { data, error } = await supabase
    .from("games")
    .select("date")
    .eq("seasonId", request.season)
    .lte("date", latestRollingDate)
    .order("date", { ascending: false })
    .limit(200);
  if (error) throw error;

  const dates: string[] = [];
  const seen = new Set<string>();
  for (const row of data ?? []) {
    const gameDate = row.date;
    if (typeof gameDate !== "string" || seen.has(gameDate)) continue;
    seen.add(gameDate);
    dates.push(gameDate);
    if (dates.length >= MAX_SNAPSHOT_DATES_TO_EVALUATE) break;
  }

  return dates;
}

async function fetchRollingRowsForSnapshot(
  request: ContextualRankingsRequest,
  snapshotDate: string,
  candidateSnapshotDates: string[],
): Promise<RollingPlayerGameMetricRow[]> {
  const datesToFetch = candidateSnapshotDates.filter(
    (date) => date <= snapshotDate,
  );
  if (datesToFetch.length === 0) return [];
  const cacheKey = [
    request.season,
    request.strength,
    snapshotDate,
    datesToFetch.join("|"),
  ].join(":");
  const cached = rollingSnapshotRowsCache.get(cacheKey);
  const now = Date.now();
  if (cached && cached.expiresAt > now) {
    return cached.rows.filter(
      (row) => request.teamId == null || row.team_id === request.teamId,
    );
  }

  const rows: RollingPlayerGameMetricRow[] = [];

  for (
    let index = 0;
    index < datesToFetch.length;
    index += ROLLING_DATE_QUERY_CONCURRENCY
  ) {
    const dateChunk = datesToFetch.slice(
      index,
      index + ROLLING_DATE_QUERY_CONCURRENCY,
    );
    const chunkRows = await Promise.all(
      dateChunk.map((gameDate) =>
        fetchRollingRowsForGameDate(request, gameDate),
      ),
    );
    rows.push(...chunkRows.flat());
  }

  const latestByPlayerId = new Map<number, RollingPlayerGameMetricRow>();
  for (const row of rows) {
    if (typeof row.player_id !== "number") continue;
    const current = latestByPlayerId.get(row.player_id);
    if (!current || isNewerRollingRow(row, current)) {
      latestByPlayerId.set(row.player_id, row);
    }
  }

  const latestRows = Array.from(latestByPlayerId.values());
  rollingSnapshotRowsCache.set(cacheKey, {
    expiresAt: now + ROLLING_SNAPSHOT_CACHE_TTL_MS,
    rows: latestRows,
  });

  return latestRows.filter(
    (row) => request.teamId == null || row.team_id === request.teamId,
  );
}

async function fetchRollingRowsForGameDate(
  request: ContextualRankingsRequest,
  gameDate: string,
) {
  const rows: RollingPlayerGameMetricRow[] = [];

  for (let from = 0; ; from += ROLLING_QUERY_PAGE_SIZE) {
    const { data, error } = await supabase
      .from("rolling_player_game_metrics")
      .select(ROLLING_RANKING_SELECT_FIELDS.join(","))
      .eq("season", request.season)
      .eq("strength_state", request.strength)
      .eq("game_date", gameDate)
      .range(from, from + ROLLING_QUERY_PAGE_SIZE - 1);
    if (error) throw error;

    const page = (data ?? []) as unknown as RollingPlayerGameMetricRow[];
    rows.push(...page);
    if (page.length < ROLLING_QUERY_PAGE_SIZE) break;
  }

  return rows;
}

function isNewerRollingRow(
  candidate: RollingPlayerGameMetricRow,
  current: RollingPlayerGameMetricRow,
) {
  const candidateDate = typeof candidate.game_date === "string" ? candidate.game_date : "";
  const currentDate = typeof current.game_date === "string" ? current.game_date : "";
  if (candidateDate !== currentDate) return candidateDate > currentDate;

  const candidateUpdatedAt =
    typeof candidate.updated_at === "string" ? candidate.updated_at : "";
  const currentUpdatedAt =
    typeof current.updated_at === "string" ? current.updated_at : "";
  return candidateUpdatedAt > currentUpdatedAt;
}

async function buildRankedSnapshot(
  request: ContextualRankingsRequest,
  snapshotDate: string,
  candidateSnapshotDates: string[],
  metricKeys: ContextualRankingMetricKey[] = [request.metric],
) {
  const rows = await fetchRollingRowsForSnapshot(
    request,
    snapshotDate,
    candidateSnapshotDates,
  );
  const playerIds = rows
    .map((row) => row.player_id)
    .filter((id): id is number => typeof id === "number");
  const teamIds = rows
    .map((row) => row.team_id)
    .filter((id): id is number => typeof id === "number");
  const [playersById, teamsById] = await Promise.all([
    fetchPlayerMeta(Array.from(new Set(playerIds))),
    fetchTeamMeta(Array.from(new Set(teamIds))),
  ]);
  const { candidates, contextByEntityId } = buildCandidates({
    rows,
    request,
    playersById,
    teamsById,
    metricKeys,
  });
  const rankedRowsByMetric = new Map(
    metricKeys.map((metricKey) => [
      metricKey,
      buildContextualRankingRows({
        candidates,
        metricKey,
        peerGroupType: request.peerGroupType,
        minGp: request.minGp ?? undefined,
        minToiSeconds: request.minToiSeconds ?? undefined,
      }),
    ]),
  );

  return {
    rows,
    snapshotDate,
    snapshotUpdatedAt: latestTimestamp(rows),
    candidates,
    contextByEntityId,
    rankedRows: rankedRowsByMetric.get(request.metric) ?? [],
    rankedRowsByMetric,
  };
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

function buildCandidates(args: {
  rows: RollingPlayerGameMetricRow[];
  request: ContextualRankingsRequest;
  playersById: Map<number, PlayerMeta>;
  teamsById: Map<number, TeamMeta>;
  metricKeys?: ContextualRankingMetricKey[];
}) {
  const candidates: ContextualRankingCandidate[] = [];
  const contextByEntityId = new Map<number, CandidateContext>();
  const metricKeys = args.metricKeys ?? [args.request.metric];

  for (const row of args.rows) {
    if (typeof row.player_id !== "number") continue;
    const player = args.playersById.get(row.player_id) ?? null;
    const positionGroup = toPositionGroup(player?.position ?? null);
    if (args.request.position === "F" && positionGroup !== "forward") continue;
    if (args.request.position === "D" && positionGroup !== "defense") continue;

    const evDeploymentBucket = normalizeEvDeploymentBucket({
      lineComboGroup: row.line_combo_group,
      lineComboSlot: row.line_combo_slot,
    });
    const ppDeploymentBucket = normalizePpDeploymentBucket(row.pp_unit);
    const pkDeploymentBucket = normalizePkDeploymentBucket(
      args.request.strength === "pk" ? row.toi_seconds_avg_season : null,
    );
    if (
      !passesDeploymentFilter({
        request: args.request,
        ev: evDeploymentBucket,
        pp: ppDeploymentBucket,
        pk: pkDeploymentBucket,
      })
    ) {
      continue;
    }

    const aggregates = buildSkaterWindowAggregatesFromRollingRow(row, {
      windows: [args.request.window],
      metricKeys,
    });
    if (aggregates.length === 0) continue;

    const deploymentBucket = selectedDeploymentBucket({
      request: args.request,
      ev: evDeploymentBucket,
      pp: ppDeploymentBucket,
      pk: pkDeploymentBucket,
    });

    for (const aggregate of aggregates) {
      candidates.push({
        entityId: aggregate.playerId,
        teamId: aggregate.teamId,
        metricKey: aggregate.metricKey,
        rawValue: aggregate.rawValue,
        numerator: aggregate.numerator,
        denominator: aggregate.denominator,
        gamesPlayed: aggregate.gamesPlayed,
        toiSeconds: aggregate.toiSeconds,
        positionGroup,
        deploymentBucket,
      });
    }
    contextByEntityId.set(row.player_id, {
      player,
      team: row.team_id == null ? null : args.teamsById.get(row.team_id) ?? null,
      evDeploymentBucket,
      ppDeploymentBucket,
      pkDeploymentBucket,
    });
  }

  return { candidates, contextByEntityId };
}

function toApiRow(args: {
  row: ContextualRankingRow;
  context: CandidateContext | null;
}): ContextualRankingApiRow {
  const toiPerGameSeconds = getWindowToiPerGame(args.row);
  return {
    entity: {
      id: args.row.entityId,
      name: args.context?.player?.fullName ?? null,
      position: args.context?.player?.position ?? null,
      positionGroup: args.row.positionGroup ?? null,
      imageUrl: args.context?.player?.image_url ?? null,
    },
    team: {
      id: args.row.teamId,
      abbreviation: args.context?.team?.abbreviation ?? null,
      name: args.context?.team?.name ?? null,
    },
    deployment: {
      ev: args.context?.evDeploymentBucket ?? null,
      pp: args.context?.ppDeploymentBucket ?? null,
      pk: args.context?.pkDeploymentBucket ?? null,
      confidence: args.context?.evDeploymentBucket ? "medium" : "low",
    },
    sample: {
      gamesPlayed: args.row.gamesPlayed ?? null,
      toiSeconds: args.row.toiSeconds ?? null,
      toiPerGameSeconds,
      confidence: args.row.sampleConfidence,
      minimumSampleMet: args.row.minimumSampleMet,
    },
    metric: {
      key: args.row.metricKey,
      value: args.row.calculatedRawValue,
      formattedValue: formatMetricValue(
        args.row.metricKey,
        args.row.calculatedRawValue,
      ),
      rawRank: args.row.rawRank,
      percentile: args.row.percentile,
      qualifiedPeerCount: args.row.qualifiedPeerCount,
    },
    peerGroup: {
      type: args.row.peerGroupType,
      key: args.row.peerGroupKey,
    },
    tags: [
      ...(args.row.minimumSampleMet ? [] : ["low-sample"]),
      ...(args.context?.evDeploymentBucket ? [args.context.evDeploymentBucket] : []),
      ...(args.context?.ppDeploymentBucket ? [args.context.ppDeploymentBucket] : []),
    ],
    warnings: args.row.warnings,
    explanationItems: explanationItems(args.row),
  };
}

type RankedSnapshotResult = Awaited<ReturnType<typeof buildRankedSnapshot>>;

type RankedSnapshotResolution = {
  uniqueMetricKeys: ContextualRankingMetricKey[];
  availableMetricKeys: ContextualRankingMetricKey[];
  unavailableMetricKeys: ContextualRankingMetricKey[];
  latestAvailableSnapshotDate: string | null;
  latestEvaluatedSnapshot: RankedSnapshotResult | null;
  selectedSnapshotsByMetric: Map<ContextualRankingMetricKey, RankedSnapshotResult>;
};

export type ContextualRankingSnapshotMetricRows = {
  request: ContextualRankingsRequest;
  metricKey: ContextualRankingMetricKey;
  rankedRows: ContextualRankingRow[];
  snapshotDate: string | null;
  snapshotUpdatedAt: string | null;
  latestAvailableSnapshotDate: string | null;
  snapshotSelectionReason:
    | "latest_available"
    | "latest_calculable_metric"
    | "metric_unavailable"
    | "no_snapshot";
  unavailable: boolean;
  message: string | null;
};

async function resolveRankedSnapshotsForMetrics(
  request: ContextualRankingsRequest,
  metricKeys: ContextualRankingMetricKey[],
): Promise<RankedSnapshotResolution> {
  const uniqueMetricKeys = Array.from(new Set(metricKeys));
  const availableMetricKeys: ContextualRankingMetricKey[] = [];
  const unavailableMetricKeys: ContextualRankingMetricKey[] = [];

  for (const metricKey of uniqueMetricKeys) {
    const metricDefinition = getContextualRankingMetricDefinition(metricKey);
    if (!metricDefinition || metricDefinition.availabilityStatus !== "available") {
      unavailableMetricKeys.push(metricKey);
      continue;
    }
    availableMetricKeys.push(metricKey);
  }

  if (availableMetricKeys.length === 0) {
    return {
      uniqueMetricKeys,
      availableMetricKeys,
      unavailableMetricKeys,
      latestAvailableSnapshotDate: null,
      latestEvaluatedSnapshot: null,
      selectedSnapshotsByMetric: new Map(),
    };
  }

  const snapshotDates = await resolveRollingSnapshotDates(request);
  const latestAvailableSnapshotDate = snapshotDates[0] ?? null;
  let latestEvaluatedSnapshot: RankedSnapshotResult | null = null;
  const selectedSnapshotsByMetric = new Map<
    ContextualRankingMetricKey,
    RankedSnapshotResult
  >();
  const unresolvedMetricKeys = new Set(availableMetricKeys);

  for (const [index, snapshotDate] of snapshotDates.entries()) {
    const evaluatedSnapshot = await buildRankedSnapshot(
      { ...request, metric: availableMetricKeys[0] },
      snapshotDate,
      snapshotDates.slice(index),
      availableMetricKeys,
    );
    latestEvaluatedSnapshot ??= evaluatedSnapshot;

    for (const metricKey of unresolvedMetricKeys) {
      if (
        hasCalculableMetricValue(
          evaluatedSnapshot.rankedRowsByMetric.get(metricKey) ?? [],
        )
      ) {
        selectedSnapshotsByMetric.set(metricKey, evaluatedSnapshot);
      }
    }
    for (const metricKey of selectedSnapshotsByMetric.keys()) {
      unresolvedMetricKeys.delete(metricKey);
    }
    if (unresolvedMetricKeys.size === 0) break;
  }

  return {
    uniqueMetricKeys,
    availableMetricKeys,
    unavailableMetricKeys,
    latestAvailableSnapshotDate,
    latestEvaluatedSnapshot,
    selectedSnapshotsByMetric,
  };
}

function unavailableMetricResponse(args: {
  request: ContextualRankingsRequest;
  definition: ContextualRankingMetricDefinition | undefined;
  generatedAt: string;
}): ContextualRankingsResponse {
  return {
    success: true,
    request: args.request,
    rankings: [],
    meta: {
      generatedAt: args.generatedAt,
      snapshotDate: null,
      snapshotUpdatedAt: null,
      latestAvailableSnapshotDate: null,
      snapshotSelectionReason: "metric_unavailable",
      sourceTable: "rolling_player_game_metrics",
      metric: metricResponseMetadata(args.definition, args.request.metric),
      unavailable: true,
      rowCount: 0,
      limit: args.request.limit,
      message: args.definition
        ? "Requested metric is not available from current verified data."
        : "Requested metric is unknown.",
    },
  };
}

function metricResponseFromSnapshot(args: {
  request: ContextualRankingsRequest;
  definition: ContextualRankingMetricDefinition;
  generatedAt: string;
  latestAvailableSnapshotDate: string | null;
  latestEvaluatedSnapshot: RankedSnapshotResult | null;
  selectedSnapshot: RankedSnapshotResult | null;
}): ContextualRankingsResponse {
  const fallbackSnapshot =
    args.selectedSnapshot ?? args.latestEvaluatedSnapshot;
  const snapshotDate = fallbackSnapshot?.snapshotDate ?? null;
  const snapshotUpdatedAt = fallbackSnapshot?.snapshotUpdatedAt ?? null;
  const candidates =
    fallbackSnapshot?.candidates.filter(
      (candidate) => candidate.metricKey === args.request.metric,
    ) ?? [];
  const rankedRows =
    fallbackSnapshot?.rankedRowsByMetric.get(args.request.metric) ?? [];
  const contextByEntityId =
    fallbackSnapshot?.contextByEntityId ??
    new Map<number, CandidateContext>();
  const snapshotSelectionReason =
    args.selectedSnapshot == null
      ? args.latestAvailableSnapshotDate == null
        ? "no_snapshot"
        : "latest_available"
      : args.selectedSnapshot.snapshotDate === args.latestAvailableSnapshotDate
        ? "latest_available"
        : "latest_calculable_metric";

  if (candidates.length > 0 && args.selectedSnapshot == null) {
    return {
      success: true,
      request: args.request,
      rankings: [],
      meta: {
        generatedAt: args.generatedAt,
        snapshotDate,
        snapshotUpdatedAt,
        latestAvailableSnapshotDate: args.latestAvailableSnapshotDate,
        snapshotSelectionReason,
        sourceTable: "rolling_player_game_metrics",
        metric: metricResponseMetadata(args.definition, args.request.metric),
        unavailable: true,
        rowCount: 0,
        limit: args.request.limit,
        message:
          "Requested metric has no calculable values for the current filters.",
      },
    };
  }

  const entityIdFilter =
    args.request.entityIds == null ? null : new Set(args.request.entityIds);
  const sortedApiRows = sortRows(
    rankedRows.map((row) =>
      toApiRow({
        row,
        context: contextByEntityId.get(row.entityId) ?? null,
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
      snapshotDate,
      snapshotUpdatedAt,
      latestAvailableSnapshotDate: args.latestAvailableSnapshotDate,
      snapshotSelectionReason,
      sourceTable: "rolling_player_game_metrics",
      metric: metricResponseMetadata(args.definition, args.request.metric),
      unavailable: false,
      rowCount: apiRows.length,
      limit: args.request.limit,
      message:
        snapshotSelectionMessage({
          selectedSnapshotDate: snapshotDate,
          latestAvailableSnapshotDate: args.latestAvailableSnapshotDate,
          metricKey: args.request.metric,
        }) ??
        (apiRows.length === 0 ? "No ranking rows matched the request." : null),
    },
  };
}

export async function buildContextualRankingsSurfaces(
  request: ContextualRankingsRequest,
  metricKeys: ContextualRankingMetricKey[],
): Promise<Map<ContextualRankingMetricKey, ContextualRankingsResponse>> {
  const generatedAt = new Date().toISOString();
  const resolution = await resolveRankedSnapshotsForMetrics(request, metricKeys);
  const responses = new Map<
    ContextualRankingMetricKey,
    ContextualRankingsResponse
  >();

  for (const metricKey of resolution.unavailableMetricKeys) {
    const metricRequest = { ...request, metric: metricKey };
    const metricDefinition = getContextualRankingMetricDefinition(metricKey);
    responses.set(
      metricKey,
      unavailableMetricResponse({
        request: metricRequest,
        definition: metricDefinition,
        generatedAt,
      }),
    );
  }

  for (const metricKey of resolution.availableMetricKeys) {
    const metricDefinition = getContextualRankingMetricDefinition(metricKey);
    if (!metricDefinition || metricDefinition.availabilityStatus !== "available") {
      continue;
    }
    responses.set(
      metricKey,
      metricResponseFromSnapshot({
        request: { ...request, metric: metricKey },
        definition: metricDefinition,
        generatedAt,
        latestAvailableSnapshotDate: resolution.latestAvailableSnapshotDate,
        latestEvaluatedSnapshot: resolution.latestEvaluatedSnapshot,
        selectedSnapshot: resolution.selectedSnapshotsByMetric.get(metricKey) ?? null,
      }),
    );
  }

  return responses;
}

export async function buildContextualRankingSnapshotRowsByMetric(
  request: ContextualRankingsRequest,
  metricKeys: ContextualRankingMetricKey[],
): Promise<Map<ContextualRankingMetricKey, ContextualRankingSnapshotMetricRows>> {
  const resolution = await resolveRankedSnapshotsForMetrics(request, metricKeys);
  const snapshots = new Map<
    ContextualRankingMetricKey,
    ContextualRankingSnapshotMetricRows
  >();

  for (const metricKey of resolution.uniqueMetricKeys) {
    const metricRequest = { ...request, metric: metricKey };
    const metricDefinition = getContextualRankingMetricDefinition(metricKey);

    if (!metricDefinition || metricDefinition.availabilityStatus !== "available") {
      snapshots.set(metricKey, {
        request: metricRequest,
        metricKey,
        rankedRows: [],
        snapshotDate: null,
        snapshotUpdatedAt: null,
        latestAvailableSnapshotDate: null,
        snapshotSelectionReason: "metric_unavailable",
        unavailable: true,
        message: metricDefinition
          ? "Requested metric is not available from current verified data."
          : "Requested metric is unknown.",
      });
      continue;
    }

    const selectedSnapshot =
      resolution.selectedSnapshotsByMetric.get(metricKey) ?? null;
    const fallbackSnapshot =
      selectedSnapshot ?? resolution.latestEvaluatedSnapshot;
    const candidates =
      fallbackSnapshot?.candidates.filter(
        (candidate) => candidate.metricKey === metricKey,
      ) ?? [];
    const snapshotSelectionReason =
      selectedSnapshot == null
        ? resolution.latestAvailableSnapshotDate == null
          ? "no_snapshot"
          : "latest_available"
        : selectedSnapshot.snapshotDate === resolution.latestAvailableSnapshotDate
          ? "latest_available"
          : "latest_calculable_metric";

    if (candidates.length > 0 && selectedSnapshot == null) {
      snapshots.set(metricKey, {
        request: metricRequest,
        metricKey,
        rankedRows: [],
        snapshotDate: fallbackSnapshot?.snapshotDate ?? null,
        snapshotUpdatedAt: fallbackSnapshot?.snapshotUpdatedAt ?? null,
        latestAvailableSnapshotDate: resolution.latestAvailableSnapshotDate,
        snapshotSelectionReason,
        unavailable: true,
        message:
          "Requested metric has no calculable values for the current filters.",
      });
      continue;
    }

    snapshots.set(metricKey, {
      request: metricRequest,
      metricKey,
      rankedRows: fallbackSnapshot?.rankedRowsByMetric.get(metricKey) ?? [],
      snapshotDate: fallbackSnapshot?.snapshotDate ?? null,
      snapshotUpdatedAt: fallbackSnapshot?.snapshotUpdatedAt ?? null,
      latestAvailableSnapshotDate: resolution.latestAvailableSnapshotDate,
      snapshotSelectionReason,
      unavailable: false,
      message:
        snapshotSelectionMessage({
          selectedSnapshotDate: fallbackSnapshot?.snapshotDate ?? null,
          latestAvailableSnapshotDate: resolution.latestAvailableSnapshotDate,
          metricKey,
        }) ?? null,
    });
  }

  return snapshots;
}

export async function buildContextualRankingsSurface(
  request: ContextualRankingsRequest,
): Promise<ContextualRankingsResponse> {
  const surfaces = await buildContextualRankingsSurfaces(request, [
    request.metric,
  ]);
  return (
    surfaces.get(request.metric) ??
    unavailableMetricResponse({
      request,
      definition: getContextualRankingMetricDefinition(request.metric),
      generatedAt: new Date().toISOString(),
    })
  );
}
