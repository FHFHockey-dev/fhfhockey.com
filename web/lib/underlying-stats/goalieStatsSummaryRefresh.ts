import type { SupabaseClient } from "@supabase/supabase-js";

import type { Json } from "lib/supabase/database-generated.types";
import serviceRoleClient from "lib/supabase/server";

import {
  buildPlayerStatsLandingSummarySnapshotsForGameIds,
  type PlayerStatsLandingSummarySnapshotRow,
} from "./playerStatsLandingServer";
import {
  PLAYER_STATS_SUMMARY_PARTITION_SOURCE_URL_PREFIX,
  PLAYER_STATS_SUMMARY_STORAGE_ENDPOINT,
  warmPlayerStatsLandingSeasonAggregateCache,
} from "./playerStatsSummaryRefresh";

const SUPABASE_PAGE_SIZE = 1000;

export const GOALIE_STATS_SUMMARY_TABLE =
  "goalie_underlying_summary_partitions";
export const GOALIE_STATS_SUMMARY_SOURCE_URL_PREFIX =
  "derived://underlying-goalie-summary-v1/";

const SHARED_GOALIE_STATS_SUMMARY_SOURCE_URL_PREFIX =
  `${PLAYER_STATS_SUMMARY_PARTITION_SOURCE_URL_PREFIX}goalies/`;

type GameIdRow = {
  game_id: number | string | null;
};

type SharedGoalieSummarySnapshotRow = Pick<
  PlayerStatsLandingSummarySnapshotRow,
  | "game_id"
  | "endpoint"
  | "season_id"
  | "game_date"
  | "source_url"
  | "payload_hash"
  | "payload"
  | "fetched_at"
>;

type GoalieSummaryPartitionRow = {
  game_id: number;
  season_id: number;
  game_date: string;
  strength: string;
  score_state: string;
  endpoint: string;
  source_url: string;
  shared_source_url: string;
  payload_hash: string;
  payload: Json;
  fetched_at: string;
  updated_at: string;
};

async function fetchAllRows<TRow>(
  fetchPage: (from: number, to: number) => PromiseLike<{
    data: unknown[] | null;
    error: unknown;
  }>
): Promise<TRow[]> {
  const rows: TRow[] = [];

  for (let from = 0; ; from += SUPABASE_PAGE_SIZE) {
    const to = from + SUPABASE_PAGE_SIZE - 1;
    const { data, error } = await fetchPage(from, to);
    if (error) throw error;

    const pageRows = (data ?? []) as TRow[];

    if (!pageRows.length) {
      break;
    }

    rows.push(...pageRows);

    if (pageRows.length < SUPABASE_PAGE_SIZE) {
      break;
    }
  }

  return rows;
}

function parseSharedGoalieSummarySourceUrl(sourceUrl: string) {
  if (!sourceUrl.startsWith(SHARED_GOALIE_STATS_SUMMARY_SOURCE_URL_PREFIX)) {
    return null;
  }

  const parts = sourceUrl
    .slice(SHARED_GOALIE_STATS_SUMMARY_SOURCE_URL_PREFIX.length)
    .split("/")
    .filter(Boolean);

  if (parts.length < 2 || parts.length > 3) {
    return null;
  }

  const gameId = Number(parts.at(-1));
  if (!Number.isFinite(gameId)) {
    return null;
  }

  return {
    gameId,
    strength: parts[0] ?? "allStrengths",
    scoreState: parts.length === 3 ? parts[1] ?? "allScores" : "allScores",
  };
}

function buildGoalieSummarySourceUrl(args: {
  gameId: number;
  strength: string;
  scoreState: string;
}) {
  return `${GOALIE_STATS_SUMMARY_SOURCE_URL_PREFIX}${args.strength}/${args.scoreState}/${args.gameId}`;
}

function mapSharedSnapshotToGoaliePartition(
  row: SharedGoalieSummarySnapshotRow
): GoalieSummaryPartitionRow | null {
  const parsed = parseSharedGoalieSummarySourceUrl(row.source_url);
  if (!parsed) {
    return null;
  }

  const seasonId = Number(row.season_id);
  const fetchedAt = row.fetched_at;
  const gameDate = row.game_date;
  const payloadHash = row.payload_hash;

  if (
    !Number.isFinite(seasonId) ||
    typeof fetchedAt !== "string" ||
    typeof gameDate !== "string" ||
    typeof payloadHash !== "string"
  ) {
    return null;
  }

  return {
    game_id: parsed.gameId,
    season_id: seasonId,
    game_date: gameDate,
    strength: parsed.strength,
    score_state: parsed.scoreState,
    endpoint: PLAYER_STATS_SUMMARY_STORAGE_ENDPOINT,
    source_url: buildGoalieSummarySourceUrl(parsed),
    shared_source_url: row.source_url,
    payload_hash: payloadHash,
    payload: row.payload as Json,
    fetched_at: fetchedAt,
    updated_at: new Date().toISOString(),
  };
}

function dedupeGoalieSummaryPartitions(rows: readonly GoalieSummaryPartitionRow[]) {
  const rowsByKey = new Map<string, GoalieSummaryPartitionRow>();

  for (const row of rows) {
    const key = `${row.game_id}:${row.strength}:${row.score_state}`;
    if (!rowsByKey.has(key)) {
      rowsByKey.set(key, row);
    }
  }

  return [...rowsByKey.values()];
}

async function fetchSharedGoalieSummarySnapshotsByGameIds(args: {
  supabase: SupabaseClient;
  gameIds: readonly number[];
}): Promise<SharedGoalieSummarySnapshotRow[]> {
  if (args.gameIds.length === 0) {
    return [];
  }

  const databaseClient = args.supabase as any;
  const rows = await fetchAllRows<{
    game_id: number | string | null;
    endpoint: string | null;
    season_id: number | string | null;
    game_date: string | null;
    source_url: string | null;
    payload_hash: string | null;
    payload: Json;
    fetched_at: string | null;
  }>(async (from, to) =>
    databaseClient
      .from("nhl_api_game_payloads_raw")
      .select(
        "game_id,endpoint,season_id,game_date,source_url,payload_hash,payload,fetched_at"
      )
      .eq("endpoint", PLAYER_STATS_SUMMARY_STORAGE_ENDPOINT)
      .like("source_url", `${SHARED_GOALIE_STATS_SUMMARY_SOURCE_URL_PREFIX}%`)
      .in("game_id", [...args.gameIds])
      .order("game_id", { ascending: true })
      .order("fetched_at", { ascending: false })
      .range(from, to)
  );

  return rows.flatMap<SharedGoalieSummarySnapshotRow>((row) => {
    const gameId = Number(row.game_id);
    const seasonId = Number(row.season_id);

    if (
      !Number.isFinite(gameId) ||
      !Number.isFinite(seasonId) ||
      typeof row.endpoint !== "string" ||
      typeof row.game_date !== "string" ||
      typeof row.source_url !== "string" ||
      typeof row.payload_hash !== "string" ||
      typeof row.fetched_at !== "string"
    ) {
      return [];
    }

    return [
      {
        game_id: gameId,
        endpoint: row.endpoint,
        season_id: seasonId,
        game_date: row.game_date,
        source_url: row.source_url,
        payload_hash: row.payload_hash,
        payload: row.payload,
        fetched_at: row.fetched_at,
      },
    ];
  });
}

async function upsertGoalieSummaryPartitions(args: {
  supabase: SupabaseClient;
  rows: readonly GoalieSummaryPartitionRow[];
}) {
  const databaseClient = args.supabase as any;
  let count = 0;

  for (let index = 0; index < args.rows.length; index += 100) {
    const batch = args.rows.slice(index, index + 100);
    const { error } = await databaseClient
      .from(GOALIE_STATS_SUMMARY_TABLE)
      .upsert(batch, {
        onConflict: "game_id,strength,score_state",
      });

    if (error) {
      throw error;
    }

    count += batch.length;
  }

  return count;
}

export async function fetchSeasonGoalieSummaryGameIdSet(args: {
  supabase?: SupabaseClient;
  seasonId: number;
}): Promise<Set<number>> {
  const databaseClient = (args.supabase ?? serviceRoleClient) as any;
  const rows = await fetchAllRows<GameIdRow>((from, to) =>
    databaseClient
      .from(GOALIE_STATS_SUMMARY_TABLE)
      .select("game_id")
      .eq("season_id", args.seasonId)
      .range(from, to)
  );

  return new Set(
    rows
      .map((row) => Number(row.game_id))
      .filter((gameId) => Number.isFinite(gameId))
  );
}

export async function warmGoalieStatsLandingSeasonAggregateCache(args: {
  seasonId: number;
  gameType?: number | null;
  supabase?: SupabaseClient;
}) {
  await warmPlayerStatsLandingSeasonAggregateCache({
    seasonId: args.seasonId,
    gameType: args.gameType,
    supabase: args.supabase,
    statModes: ["goalies"],
  });
}

export async function refreshGoalieUnderlyingSummarySnapshotsForGameIds(args: {
  gameIds: readonly number[];
  seasonId?: number | null;
  requestedGameType?: number | null;
  shouldWarmLandingCache?: boolean;
  preferSharedSnapshotSeed?: boolean;
  supabase?: SupabaseClient;
}) {
  const supabase = args.supabase ?? serviceRoleClient;
  const sharedGoalieSnapshots = args.preferSharedSnapshotSeed === false
    ? []
    : await fetchSharedGoalieSummarySnapshotsByGameIds({
        supabase,
        gameIds: args.gameIds,
      });
  const seededGameIds = new Set(sharedGoalieSnapshots.map((row) => row.game_id));
  const rawBuildGameIds =
    args.preferSharedSnapshotSeed === false
      ? [...args.gameIds]
      : args.gameIds.filter((gameId) => !seededGameIds.has(gameId));
  const rawBuiltGoalieSnapshots =
    rawBuildGameIds.length === 0
      ? []
      : (await buildPlayerStatsLandingSummarySnapshotsForGameIds(
          rawBuildGameIds,
          supabase
        )).filter((row) =>
          row.source_url.startsWith(SHARED_GOALIE_STATS_SUMMARY_SOURCE_URL_PREFIX)
        );
  const upsertRows = dedupeGoalieSummaryPartitions(
    [...sharedGoalieSnapshots, ...rawBuiltGoalieSnapshots]
      .map((row) => mapSharedSnapshotToGoaliePartition(row))
      .filter((row): row is GoalieSummaryPartitionRow => row != null)
  );
  const rowsUpserted = await upsertGoalieSummaryPartitions({
    supabase,
    rows: upsertRows,
  });

  if (args.shouldWarmLandingCache && args.seasonId != null) {
    await warmGoalieStatsLandingSeasonAggregateCache({
      seasonId: args.seasonId,
      gameType: args.requestedGameType,
      supabase,
    });
  }

  return {
    rowsUpserted,
    seededGameIds: [...seededGameIds],
    rawBuildGameIds,
  };
}