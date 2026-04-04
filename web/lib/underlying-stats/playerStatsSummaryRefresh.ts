import type { SupabaseClient } from "@supabase/supabase-js";

import serviceRoleClient from "lib/supabase/server";

import { createDefaultLandingFilterState } from "./playerStatsFilters";
import {
  buildPlayerStatsLandingAggregationFromState,
  buildPlayerStatsLandingSummarySnapshotsForGameIds,
  buildPlayerStatsLandingSummarySnapshotsFromPayloadRows,
  invalidatePlayerStatsSeasonAggregateCache,
  PLAYER_STATS_SUMMARY_PARTITION_SOURCE_URL_PREFIX,
  PLAYER_STATS_SUMMARY_SOURCE_URL_PREFIX,
  PLAYER_STATS_SUMMARY_STORAGE_ENDPOINT,
} from "./playerStatsLandingServer";

const SUPABASE_PAGE_SIZE = 1000;

type GameIdRow = {
  game_id: number | string | null;
};

type SummaryPayloadRow = {
  game_id: number;
  payload: unknown;
  fetched_at: string | null;
  source_url: string | null;
};

async function fetchAllRows<TRow>(
  fetchPage: (from: number, to: number) => Promise<{
    data: TRow[] | null;
    error: unknown;
  }>
): Promise<TRow[]> {
  const rows: TRow[] = [];

  for (let from = 0; ; from += SUPABASE_PAGE_SIZE) {
    const to = from + SUPABASE_PAGE_SIZE - 1;
    const { data, error } = await fetchPage(from, to);
    if (error) throw error;

    if (!data?.length) {
      break;
    }

    rows.push(...data);

    if (data.length < SUPABASE_PAGE_SIZE) {
      break;
    }
  }

  return rows;
}

async function fetchSummaryPayloadRowsByGameIds(args: {
  supabase: SupabaseClient;
  gameIds: readonly number[];
  sourceUrlPrefix: string;
}): Promise<SummaryPayloadRow[]> {
  if (args.gameIds.length === 0) {
    return [];
  }

  const rows = await fetchAllRows<{
    game_id: number | string | null;
    payload: unknown;
    fetched_at: string | null;
    source_url: string | null;
  }>((from, to) =>
    args.supabase
      .from("nhl_api_game_payloads_raw")
      .select("game_id,payload,fetched_at,source_url")
      .eq("endpoint", PLAYER_STATS_SUMMARY_STORAGE_ENDPOINT)
      .like("source_url", `${args.sourceUrlPrefix}%`)
      .in("game_id", [...args.gameIds])
      .order("game_id", { ascending: true })
      .order("fetched_at", { ascending: false })
      .range(from, to)
  );

  return rows
    .filter(
      (
        row
      ): row is {
        game_id: number;
        payload: unknown;
        fetched_at: string | null;
        source_url: string | null;
      } => Number.isFinite(Number(row.game_id))
    )
    .map((row) => ({
      ...row,
      game_id: Number(row.game_id),
    }));
}

function resolveSeasonTypeFromGameType(gameType: number | null | undefined) {
  if (gameType === 1) {
    return "preSeason" as const;
  }

  if (gameType === 3) {
    return "playoffs" as const;
  }

  return "regularSeason" as const;
}

export async function warmPlayerStatsLandingSeasonAggregateCache(args: {
  seasonId: number;
  gameType?: number | null;
  supabase?: SupabaseClient;
}) {
  const defaultLandingState = createDefaultLandingFilterState();
  const warmedState = {
    ...defaultLandingState,
    primary: {
      ...defaultLandingState.primary,
      seasonRange: {
        fromSeasonId: args.seasonId,
        throughSeasonId: args.seasonId,
      },
      seasonType: resolveSeasonTypeFromGameType(args.gameType ?? 2),
    },
  };

  await buildPlayerStatsLandingAggregationFromState(
    warmedState,
    args.supabase ?? serviceRoleClient
  );
}

async function upsertSummarySnapshots(args: {
  supabase: SupabaseClient;
  rows: Awaited<ReturnType<typeof buildPlayerStatsLandingSummarySnapshotsForGameIds>>;
}) {
  let count = 0;

  for (let index = 0; index < args.rows.length; index += 100) {
    const batch = args.rows.slice(index, index + 100);
    const { error } = await args.supabase
      .from("nhl_api_game_payloads_raw")
      .upsert(batch, {
        onConflict: "game_id,endpoint,payload_hash",
        ignoreDuplicates: true,
      });

    if (error) {
      throw error;
    }

    count += batch.length;
  }

  return count;
}

export async function fetchSeasonSummaryGameIdSet(args: {
  supabase?: SupabaseClient;
  seasonId: number;
  sourceUrlPrefix?: string;
}): Promise<Set<number>> {
  const supabase = args.supabase ?? serviceRoleClient;
  const rows = await fetchAllRows<GameIdRow>((from, to) => {
    let query: any = supabase
      .from("nhl_api_game_payloads_raw")
      .select("game_id")
      .eq("season_id", args.seasonId)
      .eq("endpoint", PLAYER_STATS_SUMMARY_STORAGE_ENDPOINT);

    if (args.sourceUrlPrefix) {
      query = query.like("source_url", `${args.sourceUrlPrefix}%`);
    }

    return query.range(from, to);
  });

  return new Set(
    rows
      .map((row) => Number(row.game_id))
      .filter((gameId) => Number.isFinite(gameId))
  );
}

export async function refreshPlayerUnderlyingSummarySnapshotsForGameIds(args: {
  gameIds: readonly number[];
  seasonId?: number | null;
  requestedGameType?: number | null;
  shouldWarmLandingCache?: boolean;
  shouldMigrateLegacySummaries?: boolean;
  supabase?: SupabaseClient;
}) {
  const supabase = args.supabase ?? serviceRoleClient;
  const legacyPayloadRows = args.shouldMigrateLegacySummaries
    ? await fetchSummaryPayloadRowsByGameIds({
        supabase,
        gameIds: args.gameIds,
        sourceUrlPrefix: PLAYER_STATS_SUMMARY_SOURCE_URL_PREFIX,
      })
    : [];
  const migratedSnapshots = args.shouldMigrateLegacySummaries
    ? buildPlayerStatsLandingSummarySnapshotsFromPayloadRows(legacyPayloadRows)
    : [];
  const migratedGameIds = new Set(migratedSnapshots.map((row) => row.game_id));
  const rawBuildGameIds = args.shouldMigrateLegacySummaries
    ? args.gameIds.filter((gameId) => !migratedGameIds.has(gameId))
    : [...args.gameIds];
  const rawBuiltSnapshots =
    rawBuildGameIds.length === 0
      ? []
      : await buildPlayerStatsLandingSummarySnapshotsForGameIds(
          rawBuildGameIds,
          supabase
        );
  const snapshots = [...migratedSnapshots, ...rawBuiltSnapshots];
  const rowsUpserted = await upsertSummarySnapshots({
    supabase,
    rows: snapshots,
  });

  if (rowsUpserted > 0) {
    invalidatePlayerStatsSeasonAggregateCache();
  }

  if (args.shouldWarmLandingCache && args.seasonId != null) {
    await warmPlayerStatsLandingSeasonAggregateCache({
      seasonId: args.seasonId,
      gameType: args.requestedGameType,
      supabase,
    });
  }

  return {
    rowsUpserted,
    migratedGameIds: [...migratedGameIds],
    rawBuildGameIds,
  };
}

export {
  PLAYER_STATS_SUMMARY_PARTITION_SOURCE_URL_PREFIX,
  PLAYER_STATS_SUMMARY_SOURCE_URL_PREFIX,
  PLAYER_STATS_SUMMARY_STORAGE_ENDPOINT,
};
