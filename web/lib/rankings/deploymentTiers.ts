import type { NextApiRequest } from "next";

import supabase from "lib/supabase/server";

import {
  buildContextualRankingRows,
  type ContextualRankingRow,
} from "./rankingCalculator";
import {
  getContextualRankingMetricDefinition,
  type ContextualRankingMetricKey,
} from "./metricDefinitions";
import {
  buildContextualRankingsSurfaces,
} from "./rankingQueries";
import { ROLLING_RANKING_SELECT_FIELDS } from "./rollingRankingSelectFields";
import {
  ContextualRankingsQueryError,
  parseContextualRankingsRequest,
  type ContextualRankingApiRow,
  type ContextualRankingsPositionFilter,
  type ContextualRankingsRequest,
  type ContextualRankingsResponse,
} from "./rankingTypes";
import {
  buildSkaterWindowAggregatesFromRollingRow,
  type RollingPlayerGameMetricRow,
  type SkaterWindowStrengthState,
} from "./skaterWindowAggregation";
import {
  normalizePkDeploymentBucket,
  normalizePpDeploymentBucket,
} from "./skaterDeploymentAggregation";

type DeploymentTierBucketKey =
  | "L1"
  | "L2"
  | "L3"
  | "L4"
  | "P1"
  | "P2"
  | "P3"
  | "PP1"
  | "PP2"
  | "PP3"
  | "PK1"
  | "PK2";

type BucketSectionDefinition = {
  key: DeploymentTiersSection["key"];
  label: string;
  description: string;
  strength: SkaterWindowStrengthState;
  position: ContextualRankingsPositionFilter;
  buckets: DeploymentTierBucketKey[];
};

export type DeploymentTiersRequest = Pick<
  ContextualRankingsRequest,
  | "entity"
  | "season"
  | "asOfDate"
  | "window"
  | "position"
  | "strength"
  | "minGp"
  | "minToiSeconds"
  | "teamId"
> & {
  metricKeys: ContextualRankingMetricKey[];
};

export type DeploymentTierMetricAverage = {
  metricKey: ContextualRankingMetricKey;
  label: string;
  averagePercentile: number | null;
  qualifiedCount: number;
};

export type DeploymentTierBucket = {
  key: DeploymentTierBucketKey;
  label: string;
  playerCount: number;
  averagePercentile: number | null;
  topMetricKey: ContextualRankingMetricKey | null;
  topMetricLabel: string | null;
  topPlayer: {
    id: number;
    name: string | null;
    team: string | null;
    percentile: number | null;
  } | null;
  metricAverages: DeploymentTierMetricAverage[];
  sourceState: "available" | "partial" | "unavailable";
  message: string | null;
};

export type DeploymentTiersSection = {
  key: "ev_forwards" | "ev_defense" | "power_play" | "penalty_kill";
  label: string;
  description: string;
  strength: SkaterWindowStrengthState;
  buckets: DeploymentTierBucket[];
  sourceState: "available" | "partial" | "unavailable";
};

export type DeploymentTiersResponse = {
  success: boolean;
  request: DeploymentTiersRequest;
  sections: DeploymentTiersSection[];
  meta: {
    generatedAt: string;
    snapshotDates: string[];
    latestAvailableSnapshotDate: string | null;
    sourceTable: "rolling_player_game_metrics";
    metricKeys: ContextualRankingMetricKey[];
    message: string | null;
  };
};

const DEFAULT_TIER_METRICS: ContextualRankingMetricKey[] = [
  "points_per_60",
  "goals_per_60",
  "assists_per_60",
  "ixg_per_60",
  "sog_per_60",
  "on_ice_xgf_percentage",
];

const DEFAULT_PRIMARY_METRIC = "points_per_60" satisfies ContextualRankingMetricKey;
const ROLLING_QUERY_PAGE_SIZE = 1000;
const METADATA_IN_FILTER_CHUNK_SIZE = 500;
const METADATA_QUERY_PAGE_SIZE = 1000;
const MAX_SNAPSHOT_DATES_TO_EVALUATE = 30;
const ROLLING_DATE_QUERY_CONCURRENCY = 10;
const ROLLING_SNAPSHOT_CACHE_TTL_MS = 30_000;
const SPECIAL_TEAMS_MIN_TOI_SECONDS = 0;

const directRollingSnapshotRowsCache = new Map<
  string,
  {
    expiresAt: number;
    rows: RollingPlayerGameMetricRow[];
    snapshotDate: string | null;
  }
>();

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

function first(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value[0];
  return value;
}

function parseMetricList(value: string | string[] | undefined) {
  const parts = (Array.isArray(value) ? value : value ? [value] : [])
    .flatMap((entry) => entry.split(","))
    .map((entry) => entry.trim())
    .filter(Boolean);
  if (parts.length === 0) return DEFAULT_TIER_METRICS;

  const metricKeys: ContextualRankingMetricKey[] = [];
  const invalid: string[] = [];
  for (const part of parts) {
    const definition = getContextualRankingMetricDefinition(part);
    if (!definition) {
      invalid.push(part);
      continue;
    }
    if (!metricKeys.includes(definition.metricKey as ContextualRankingMetricKey)) {
      metricKeys.push(definition.metricKey as ContextualRankingMetricKey);
    }
  }
  if (invalid.length > 0) {
    throw new ContextualRankingsQueryError("Invalid query param: metrics", {
      metrics: `unknown metric keys: ${invalid.join(", ")}`,
    });
  }
  return metricKeys.length > 0 ? metricKeys : DEFAULT_TIER_METRICS;
}

function round(value: number | null, decimals = 1) {
  if (value == null || !Number.isFinite(value)) return null;
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function average(values: number[]) {
  if (values.length === 0) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function sourceStateFromBuckets(buckets: DeploymentTierBucket[]) {
  const states = new Set(buckets.map((bucket) => bucket.sourceState));
  if (states.has("available") && !states.has("partial") && !states.has("unavailable")) {
    return "available" as const;
  }
  if (states.has("available") || states.has("partial")) return "partial" as const;
  return "unavailable" as const;
}

function sectionDefinitions(request: DeploymentTiersRequest): BucketSectionDefinition[] {
  const includeForwards = request.position === "all" || request.position === "F";
  const includeDefense = request.position === "all" || request.position === "D";
  const position = request.position;

  return [
    ...(includeForwards
      ? [
          {
            key: "ev_forwards" as const,
            label: "EV Forward Lines",
            description: "L1-L4 buckets from verified line-combination context.",
            strength: "5v5" as const,
            position: "F" as const,
            buckets: ["L1", "L2", "L3", "L4"] as DeploymentTierBucketKey[],
          },
        ]
      : []),
    ...(includeDefense
      ? [
          {
            key: "ev_defense" as const,
            label: "EV Defense Pairs",
            description: "P1-P3 buckets from verified pair context.",
            strength: "5v5" as const,
            position: "D" as const,
            buckets: ["P1", "P2", "P3"] as DeploymentTierBucketKey[],
          },
        ]
      : []),
    {
      key: "power_play",
      label: "Power Play Units",
      description: "PP1-PP3 buckets from verified PP unit labels in the true PP rolling snapshot.",
      strength: "pp",
      position,
      buckets: ["PP1", "PP2", "PP3"],
    },
    {
      key: "penalty_kill",
      label: "Penalty Kill Usage",
      description: "PK1-PK2 buckets from conservative PK TOI usage in the true PK rolling snapshot.",
      strength: "pk",
      position,
      buckets: ["PK1", "PK2"],
    },
  ];
}

function metricAverage(args: {
  metricKey: ContextualRankingMetricKey;
  rows: ContextualRankingApiRow[];
}): DeploymentTierMetricAverage {
  const definition = getContextualRankingMetricDefinition(args.metricKey);
  const values = args.rows
    .map((row) => row.metric.percentile)
    .filter((value): value is number => value != null && Number.isFinite(value));
  return {
    metricKey: args.metricKey,
    label: definition?.displayName ?? args.metricKey,
    averagePercentile: round(average(values)),
    qualifiedCount: values.length,
  };
}

function topPlayer(rows: ContextualRankingApiRow[]) {
  const row = rows.find((entry) => entry.metric.percentile != null) ?? rows[0] ?? null;
  if (!row) return null;
  return {
    id: row.entity.id,
    name: row.entity.name,
    team: row.team.abbreviation ?? row.team.name,
    percentile: row.metric.percentile == null ? null : round(row.metric.percentile),
  };
}

function emptyBucket(bucket: DeploymentTierBucketKey, message: string): DeploymentTierBucket {
  return {
    key: bucket,
    label: bucket,
    playerCount: 0,
    averagePercentile: null,
    topMetricKey: null,
    topMetricLabel: null,
    topPlayer: null,
    metricAverages: [],
    sourceState: "unavailable",
    message,
  };
}

function bucketFromRows(args: {
  bucket: DeploymentTierBucketKey;
  metricAverages: DeploymentTierMetricAverage[];
  metricKeys: ContextualRankingMetricKey[];
  primaryRows: ContextualRankingApiRow[];
}): DeploymentTierBucket {
  const playerIds = new Set(args.primaryRows.map((row) => row.entity.id));
  const rankedAverages = args.metricAverages.filter(
    (entry) => entry.averagePercentile != null,
  );
  const topMetric = [...rankedAverages].sort((left, right) => {
    return (right.averagePercentile ?? -1) - (left.averagePercentile ?? -1);
  })[0] ?? null;
  const bucketAverage = average(
    rankedAverages
      .map((entry) => entry.averagePercentile)
      .filter((value): value is number => value != null),
  );
  const availableMetricCount = rankedAverages.length;
  const sourceState =
    playerIds.size === 0
      ? "unavailable"
      : availableMetricCount >= Math.min(3, args.metricKeys.length)
        ? "available"
        : "partial";

  return {
    key: args.bucket,
    label: args.bucket,
    playerCount: playerIds.size,
    averagePercentile: round(bucketAverage),
    topMetricKey: topMetric?.metricKey ?? null,
    topMetricLabel: topMetric?.label ?? null,
    topPlayer: topPlayer(args.primaryRows),
    metricAverages: args.metricAverages,
    sourceState,
    message:
      playerIds.size === 0
        ? "No qualified players matched this deployment bucket."
        : sourceState === "partial"
          ? "Some metrics were unavailable for this bucket/context."
          : null,
  };
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

function getWindowToiPerGame(row: ContextualRankingRow) {
  if (
    typeof row.toiSeconds !== "number" ||
    !Number.isFinite(row.toiSeconds) ||
    typeof row.gamesPlayed !== "number" ||
    !Number.isFinite(row.gamesPlayed) ||
    row.gamesPlayed <= 0
  ) {
    return null;
  }
  return Number((row.toiSeconds / row.gamesPlayed).toFixed(6));
}

function formatMetricValue(metricKey: ContextualRankingMetricKey, value: number | null) {
  if (value == null) return null;
  if (metricKey.endsWith("_percentage")) return `${value.toFixed(1)}%`;
  if (metricKey.endsWith("_per_60")) return value.toFixed(2);
  return Number(value.toFixed(3)).toString();
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

async function resolveLatestRollingDate(args: {
  request: DeploymentTiersRequest;
  strength: SkaterWindowStrengthState;
}) {
  const cutoff = args.request.asOfDate ?? new Date().toISOString().slice(0, 10);
  const { data, error } = await supabase
    .from("rolling_player_game_metrics")
    .select("game_date")
    .eq("season", args.request.season)
    .eq("strength_state", args.strength)
    .lte("game_date", cutoff)
    .order("game_date", { ascending: false })
    .limit(1);
  if (error) throw error;
  const gameDate = data?.[0]?.game_date;
  return typeof gameDate === "string" ? gameDate : null;
}

async function resolveRollingSnapshotDates(args: {
  request: DeploymentTiersRequest;
  strength: SkaterWindowStrengthState;
}) {
  const latestRollingDate = await resolveLatestRollingDate(args);
  if (!latestRollingDate) return [];

  const { data, error } = await supabase
    .from("games")
    .select("date")
    .eq("seasonId", args.request.season)
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

async function fetchRollingRowsForExactSnapshot(args: {
  request: DeploymentTiersRequest;
  strength: SkaterWindowStrengthState;
  snapshotDate: string;
}) {
  const rows: RollingPlayerGameMetricRow[] = [];

  for (let from = 0; ; from += ROLLING_QUERY_PAGE_SIZE) {
    let query = supabase
      .from("rolling_player_game_metrics")
      .select(ROLLING_RANKING_SELECT_FIELDS.join(","))
      .eq("season", args.request.season)
      .eq("strength_state", args.strength)
      .eq("game_date", args.snapshotDate)
      .range(from, from + ROLLING_QUERY_PAGE_SIZE - 1);
    if (args.request.teamId != null) {
      query = query.eq("team_id", args.request.teamId);
    }
    const { data, error } = await query;
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

async function fetchLatestRollingRowsForSnapshot(args: {
  request: DeploymentTiersRequest;
  strength: SkaterWindowStrengthState;
}) {
  const snapshotDates = await resolveRollingSnapshotDates(args);
  const cacheKey = [
    args.request.season,
    args.strength,
    args.request.teamId ?? "all",
    snapshotDates.join("|"),
  ].join(":");
  const cached = directRollingSnapshotRowsCache.get(cacheKey);
  const now = Date.now();
  if (cached && cached.expiresAt > now) {
    return {
      snapshotDate: cached.snapshotDate,
      rows: cached.rows,
    };
  }

  const rows: RollingPlayerGameMetricRow[] = [];

  for (
    let index = 0;
    index < snapshotDates.length;
    index += ROLLING_DATE_QUERY_CONCURRENCY
  ) {
    const dateChunk = snapshotDates.slice(index, index + ROLLING_DATE_QUERY_CONCURRENCY);
    const chunkRows = await Promise.all(
      dateChunk.map((snapshotDate) =>
        fetchRollingRowsForExactSnapshot({
          request: args.request,
          strength: args.strength,
          snapshotDate,
        }),
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
  const result = {
    snapshotDate: snapshotDates[0] ?? null,
    rows: latestRows,
  };
  directRollingSnapshotRowsCache.set(cacheKey, {
    expiresAt: now + ROLLING_SNAPSHOT_CACHE_TTL_MS,
    ...result,
  });

  return result;
}

function specialTeamsBucket(args: {
  section: BucketSectionDefinition;
  row: RollingPlayerGameMetricRow;
}) {
  if (args.section.key === "power_play") {
    return normalizePpDeploymentBucket(args.row.pp_unit);
  }
  if (args.section.key === "penalty_kill") {
    return normalizePkDeploymentBucket(args.row.toi_seconds_avg_season);
  }
  return null;
}

function toApiRow(args: {
  row: ContextualRankingRow;
  player: PlayerMeta | null;
  team: TeamMeta | null;
  bucket: DeploymentTierBucketKey | null;
}): ContextualRankingApiRow {
  return {
    entity: {
      id: args.row.entityId,
      name: args.player?.fullName ?? null,
      position: args.player?.position ?? null,
      positionGroup: args.row.positionGroup ?? null,
      imageUrl: args.player?.image_url ?? null,
    },
    team: {
      id: args.row.teamId,
      abbreviation: args.team?.abbreviation ?? null,
      name: args.team?.name ?? null,
    },
    deployment: {
      ev: null,
      pp: args.bucket?.startsWith("PP") ? args.bucket as any : null,
      pk: args.bucket?.startsWith("PK") ? args.bucket as any : null,
      confidence: args.row.sampleConfidence,
    },
    sample: {
      gamesPlayed: args.row.gamesPlayed ?? null,
      toiSeconds: args.row.toiSeconds ?? null,
      toiPerGameSeconds: getWindowToiPerGame(args.row),
      confidence: args.row.sampleConfidence,
      minimumSampleMet: args.row.minimumSampleMet,
    },
    metric: {
      key: args.row.metricKey,
      value: args.row.calculatedRawValue,
      formattedValue: formatMetricValue(args.row.metricKey, args.row.calculatedRawValue),
      rawRank: args.row.rawRank,
      percentile: args.row.percentile,
      qualifiedPeerCount: args.row.qualifiedPeerCount,
    },
    peerGroup: {
      type: args.row.peerGroupType,
      key: args.row.peerGroupKey,
    },
    tags: args.bucket ? [args.bucket] : [],
    warnings: args.row.warnings,
    explanationItems: [],
  };
}

async function buildDirectSpecialTeamsSection(args: {
  request: DeploymentTiersRequest;
  section: BucketSectionDefinition;
  metricKeys: ContextualRankingMetricKey[];
  primaryMetric: ContextualRankingMetricKey;
}) {
  const strength: SkaterWindowStrengthState =
    args.section.key === "power_play" ? "pp" : "pk";
  const snapshot = await fetchLatestRollingRowsForSnapshot({
    request: args.request,
    strength,
  });
  const snapshotDate = snapshot.snapshotDate;
  if (!snapshotDate) {
    return {
      section: {
        key: args.section.key,
        label: args.section.label,
        description: args.section.description,
        strength: args.section.strength,
        buckets: args.section.buckets.map((bucket) =>
          emptyBucket(bucket, "No rolling snapshot is available for this strength."),
        ),
        sourceState: "unavailable" as const,
      },
      snapshotDate: null,
      latestAvailableSnapshotDate: null,
    };
  }

  const rows = snapshot.rows;
  const playerIds = rows
    .map((row) => row.player_id)
    .filter((id): id is number => typeof id === "number");
  const teamIds = rows
    .map((row) => row.team_id)
    .filter((id): id is number => typeof id === "number");
  const [playersById, teamsById] = await Promise.all([
    fetchPlayerMeta(playerIds),
    fetchTeamMeta(teamIds),
  ]);

  const bucketByPlayerId = new Map<number, DeploymentTierBucketKey>();
  const candidates = rows.flatMap((row) => {
    if (typeof row.player_id !== "number") return [];
    const player = playersById.get(row.player_id) ?? null;
    const positionGroup = toPositionGroup(player?.position);
    if (args.request.position === "F" && positionGroup !== "forward") return [];
    if (args.request.position === "D" && positionGroup !== "defense") return [];
    const bucket = specialTeamsBucket({ section: args.section, row });
    if (!bucket || !args.section.buckets.includes(bucket as DeploymentTierBucketKey)) {
      return [];
    }
    bucketByPlayerId.set(row.player_id, bucket as DeploymentTierBucketKey);
    return buildSkaterWindowAggregatesFromRollingRow(row, {
      windows: [args.request.window],
      metricKeys: args.metricKeys,
    }).map((aggregate) => ({
      entityId: aggregate.playerId,
      teamId: aggregate.teamId,
      metricKey: aggregate.metricKey,
      rawValue: aggregate.rawValue,
      numerator: aggregate.numerator,
      denominator: aggregate.denominator,
      gamesPlayed: aggregate.gamesPlayed,
      toiSeconds: aggregate.toiSeconds,
      positionGroup,
      deploymentBucket: bucket,
    }));
  });

  const rowsByMetric = new Map(
    args.metricKeys.map((metricKey) => {
      const rankedRows = buildContextualRankingRows({
        candidates,
        metricKey,
        peerGroupType: args.request.position === "all" ? "all_skaters" : "position",
        minGp: args.request.minGp ?? undefined,
        minToiSeconds: SPECIAL_TEAMS_MIN_TOI_SECONDS,
      });
      return [
        metricKey,
        rankedRows
          .map((row) =>
            toApiRow({
              row,
              player: playersById.get(row.entityId) ?? null,
              team: row.teamId == null ? null : teamsById.get(row.teamId) ?? null,
              bucket: bucketByPlayerId.get(row.entityId) ?? null,
            }),
          )
          .sort((left, right) => {
            const leftValue = left.metric.percentile ?? -1;
            const rightValue = right.metric.percentile ?? -1;
            if (leftValue !== rightValue) return rightValue - leftValue;
            return left.entity.id - right.entity.id;
          }),
      ] as const;
    }),
  );

  const buckets = args.section.buckets.map((bucket) => {
    const metricAverages = args.metricKeys.map((metricKey) =>
      metricAverage({
        metricKey,
        rows: (rowsByMetric.get(metricKey) ?? []).filter(
          (row) => rowBucketForSection(args.section, row) === bucket,
        ),
      }),
    );
    const primaryRows = (rowsByMetric.get(args.primaryMetric) ?? []).filter(
      (row) => rowBucketForSection(args.section, row) === bucket,
    );
    return bucketFromRows({
      bucket,
      metricAverages,
      metricKeys: args.metricKeys,
      primaryRows,
    });
  });

  return {
    section: {
      key: args.section.key,
      label: args.section.label,
      description: args.section.description,
      strength,
      buckets,
      sourceState: sourceStateFromBuckets(buckets),
    },
    snapshotDate,
    latestAvailableSnapshotDate: snapshotDate,
  };
}

function sectionPeerGroupType(section: BucketSectionDefinition) {
  if (section.strength === "5v5") return "deployment" as const;
  if (section.position === "F" || section.position === "D") return "position" as const;
  return "all_skaters" as const;
}

function sectionRequest(args: {
  base: DeploymentTiersRequest;
  section: BucketSectionDefinition;
  primaryMetric: ContextualRankingMetricKey;
}): ContextualRankingsRequest {
  return {
    entity: "skaters",
    season: args.base.season,
    asOfDate: args.base.asOfDate,
    window: args.base.window,
    position: args.section.position,
    deployment: "all",
    strength: args.section.strength,
    metric: args.primaryMetric,
    minGp: args.base.minGp,
    minToiSeconds: args.base.minToiSeconds,
    teamId: args.base.teamId,
    peerGroupType: sectionPeerGroupType(args.section),
    sort: "percentile",
    direction: "desc",
    limit: null,
    entityIds: null,
  };
}

function rowBucketForSection(
  section: BucketSectionDefinition,
  row: ContextualRankingApiRow,
) {
  if (section.key === "power_play") return row.deployment.pp;
  if (section.key === "penalty_kill") return row.deployment.pk;
  return row.deployment.ev;
}

function mergeLatestDate(current: string | null, next: string | null) {
  if (current == null) return next;
  if (next == null) return current;
  return next > current ? next : current;
}

export function parseDeploymentTiersRequest(
  query: NextApiRequest["query"],
): DeploymentTiersRequest {
  const base = parseContextualRankingsRequest({
    ...query,
    metric: first(query.metric) ?? DEFAULT_PRIMARY_METRIC,
    deployment: "all",
    peer_group: "all_skaters",
    limit: "1",
  });
  return {
    entity: base.entity,
    season: base.season,
    asOfDate: base.asOfDate,
    window: base.window,
    position: base.position,
    strength: base.strength,
    minGp: base.minGp,
    minToiSeconds: base.minToiSeconds,
    teamId: base.teamId,
    metricKeys: parseMetricList(query.metrics),
  };
}

export async function buildDeploymentTiersSurface(
  request: DeploymentTiersRequest,
): Promise<DeploymentTiersResponse> {
  const generatedAt = new Date().toISOString();
  const metricKeys = Array.from(new Set(request.metricKeys));
  const primaryMetric = metricKeys.includes(DEFAULT_PRIMARY_METRIC)
    ? DEFAULT_PRIMARY_METRIC
    : metricKeys[0] ?? DEFAULT_PRIMARY_METRIC;
  const snapshotDates = new Set<string>();
  let latestAvailableSnapshotDate: string | null = null;

  const definitions = sectionDefinitions(request);
  const contextualDefinitions = definitions.filter(
    (section) => section.key === "ev_forwards" || section.key === "ev_defense",
  );
  const specialTeamsDefinitions = definitions.filter(
    (section) => section.key === "power_play" || section.key === "penalty_kill",
  );
  const surfacesPromise: Promise<Map<ContextualRankingMetricKey, ContextualRankingsResponse>> =
    contextualDefinitions.length === 0
      ? Promise.resolve(new Map<ContextualRankingMetricKey, ContextualRankingsResponse>())
      : buildContextualRankingsSurfaces(
          sectionRequest({
            base: request,
            section: {
              key: "ev_forwards",
              label: "5v5 Deployment Snapshot",
              description: "Shared 5v5 deployment snapshot.",
              strength: "5v5",
              position: request.position,
              buckets: [],
            },
            primaryMetric,
          }),
          metricKeys,
        );
  const directSpecialTeamsPromise = Promise.all(
    specialTeamsDefinitions.map((section) =>
      buildDirectSpecialTeamsSection({
        request,
        section,
        metricKeys,
        primaryMetric,
      }),
    ),
  );
  const [surfaces, directSpecialTeams] = await Promise.all([
    surfacesPromise,
    directSpecialTeamsPromise,
  ]);
  const contextualSections = contextualDefinitions.map((section) => {
    const buckets: DeploymentTierBucket[] = [];
    for (const bucket of section.buckets) {
      const metricAverages = metricKeys.map((metricKey) => {
        const surface = surfaces.get(metricKey);
        if (surface?.meta.snapshotDate) snapshotDates.add(surface.meta.snapshotDate);
        latestAvailableSnapshotDate = mergeLatestDate(
          latestAvailableSnapshotDate,
          surface?.meta.latestAvailableSnapshotDate ?? null,
        );
        return metricAverage({
          metricKey,
          rows: surface?.meta.unavailable
            ? []
            : (surface?.rankings ?? []).filter(
                (row) => rowBucketForSection(section, row) === bucket,
              ),
        });
      });
      const primaryRows = (surfaces.get(primaryMetric)?.rankings ?? []).filter(
        (row) => rowBucketForSection(section, row) === bucket,
      );
      buckets.push(bucketFromRows({
        bucket,
        metricAverages,
        metricKeys,
        primaryRows,
      }));
    }

    return {
      key: section.key,
      label: section.label,
      description: section.description,
      strength: section.strength,
      buckets,
      sourceState: sourceStateFromBuckets(buckets),
    };
  });
  for (const result of directSpecialTeams) {
    if (result.snapshotDate) snapshotDates.add(result.snapshotDate);
    latestAvailableSnapshotDate = mergeLatestDate(
      latestAvailableSnapshotDate,
      result.latestAvailableSnapshotDate,
    );
  }
  const sections = [
    ...contextualSections,
    ...directSpecialTeams.map((result) => result.section),
  ];

  return {
    success: true,
    request,
    sections,
    meta: {
      generatedAt,
      snapshotDates: Array.from(snapshotDates).sort(),
      latestAvailableSnapshotDate,
      sourceTable: "rolling_player_game_metrics",
      metricKeys,
      message:
        sections.length === 0
          ? "No deployment sections are available for this request."
          : null,
    },
  };
}
