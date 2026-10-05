import type { SupabaseClient } from "@supabase/supabase-js";

import serviceRoleClient from "lib/supabase/server";
import type { Json } from "lib/supabase/database-generated.types";
import { fetchAllSupabasePages } from "lib/supabase/pagination";

import {
  createDefaultLandingFilterState,
  getDefaultLandingSortState,
} from "./playerStatsFilters";
import {
  buildPlayerStatsLandingAggregationFromState,
  buildPlayerStatsLandingSummarySnapshotsForGameIds,
  buildPlayerStatsLandingSummarySnapshotsFromPayloadRows,
  invalidatePlayerStatsSeasonAggregateCache,
  PLAYER_STATS_SUMMARY_PARTITION_SOURCE_URL_PREFIX,
  PLAYER_STATS_SUMMARY_SOURCE_URL_PREFIX,
  PLAYER_STATS_SUMMARY_STORAGE_ENDPOINT,
} from "./playerStatsLandingServer";
import type { PlayerStatsMode } from "./playerStatsTypes";

type GameIdRow = {
  game_id: number | string | null;
};

type SummaryPayloadRow = {
  game_id: number;
  payload: Json;
  fetched_at: string;
  source_url: string;
};

export class PlayerStatsSummaryWriteBusyError extends Error {
  readonly code = "P0001";
  readonly stage = "persist_player_summaries";
  readonly endpoint = PLAYER_STATS_SUMMARY_STORAGE_ENDPOINT;

  constructor(readonly gameIds: number[], readonly attempts: number) {
    super("NHL_NORMALIZATION_WRITER_BUSY");
    this.name = "PlayerStatsSummaryWriteBusyError";
  }
}

async function fetchAllRows<TRow>(
  fetchPage: (from: number, to: number) => PromiseLike<{
    data: unknown[] | null;
    error: unknown;
  }>
): Promise<TRow[]> {
  return fetchAllSupabasePages<TRow>(({ from, to }) => fetchPage(from, to) as any);
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
    payload: Json;
    fetched_at: string | null;
    source_url: string | null;
  }>(async (from, to) =>
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

  return rows.flatMap<SummaryPayloadRow>((row) => {
    const gameId = Number(row.game_id);
    const sourceUrl = row.source_url;
    const fetchedAt = row.fetched_at;

    if (
      !Number.isFinite(gameId) ||
      typeof sourceUrl !== "string" ||
      typeof fetchedAt !== "string"
    ) {
      return [];
    }

    return [
      {
        ...row,
        game_id: gameId,
        fetched_at: fetchedAt,
        source_url: sourceUrl,
      },
    ];
  });
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
  statModes?: readonly PlayerStatsMode[];
}) {
  const defaultLandingState = createDefaultLandingFilterState();
  const statModes = [
    ...new Set(args.statModes ?? [defaultLandingState.primary.statMode]),
  ];

  for (const statMode of statModes) {
    const warmedState = {
      ...defaultLandingState,
      primary: {
        ...defaultLandingState.primary,
        seasonRange: {
          fromSeasonId: args.seasonId,
          throughSeasonId: args.seasonId,
        },
        seasonType: resolveSeasonTypeFromGameType(args.gameType ?? 2),
        statMode,
      },
      view: {
        ...defaultLandingState.view,
        sort: getDefaultLandingSortState(
          statMode,
          defaultLandingState.primary.displayMode
        ),
      },
    };

    await buildPlayerStatsLandingAggregationFromState(
      warmedState,
      args.supabase ?? serviceRoleClient
    );
  }
}

async function upsertSummarySnapshots(args: {
  supabase: SupabaseClient;
  rows: Awaited<ReturnType<typeof buildPlayerStatsLandingSummarySnapshotsForGameIds>>;
}) {
  let count = 0;
  let busyRetries = 0;

  for (let index = 0; index < args.rows.length; index += 100) {
    const batch = args.rows.slice(index, index + 100);
    let attempts = 0;
    while (true) {
      attempts += 1;
      const { error } = await args.supabase
        .from("nhl_api_game_payloads_raw")
        .upsert(batch, {
          onConflict: "game_id,endpoint,payload_hash",
          ignoreDuplicates: true,
        });

      if (!error) break;
      if (error.code !== "P0001" || error.message !== "NHL_NORMALIZATION_WRITER_BUSY") {
        throw error;
      }
      if (busyRetries === 1) {
        throw new PlayerStatsSummaryWriteBusyError(
          [...new Set(batch.map((row) => row.game_id))], attempts,
        );
      }
      // The BEFORE-statement guard aborted this write. Retry the same immutable
      // batch once across this refresh; never rebuild or replay completed batches.
      busyRetries += 1;
      await new Promise((resolve) => setTimeout(resolve, 500));
    }

    count += batch.length;
  }

  return { count, busyRetries };
}

export async function fetchSeasonSummaryGameIdSet(args: {
  supabase?: SupabaseClient;
  seasonId: number;
  sourceUrlPrefix?: string;
}): Promise<Set<number>> {
  const supabase = args.supabase ?? serviceRoleClient;
  const rows = await fetchAllRows<GameIdRow>(async (from, to) => {
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
  const summaryWrite = await upsertSummarySnapshots({
    supabase,
    rows: snapshots,
  });
  const rowsUpserted = summaryWrite.count;

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
    summaryWriteBusyRetries: summaryWrite.busyRetries,
    migratedGameIds: [...migratedGameIds],
    rawBuildGameIds,
  };
}

export {
  PLAYER_STATS_SUMMARY_PARTITION_SOURCE_URL_PREFIX,
  PLAYER_STATS_SUMMARY_SOURCE_URL_PREFIX,
  PLAYER_STATS_SUMMARY_STORAGE_ENDPOINT,
};
