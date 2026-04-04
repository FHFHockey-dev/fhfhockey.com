import type { NextApiRequest, NextApiResponse } from "next";

import { withCronJobAudit } from "lib/cron/withCronJobAudit";
import serviceRoleClient from "lib/supabase/server";
import {
  PLAYER_STATS_SUMMARY_PARTITION_SOURCE_URL_PREFIX,
  PLAYER_STATS_SUMMARY_STORAGE_ENDPOINT,
  refreshPlayerUnderlyingSummarySnapshotsForGameIds,
  warmPlayerStatsLandingSeasonAggregateCache,
} from "lib/underlying-stats/playerStatsSummaryRefresh";
import adminOnly from "utils/adminOnlyMiddleware";

type SummaryRefreshResponse =
  | {
      success: true;
      route: string;
      requestedGameCount: number;
      gameIds: number[];
      rowsUpserted: number;
    }
    | {
      success: false;
      error: string;
      issues?: string[];
    };

const SUPABASE_PAGE_SIZE = 1000;

type QueryValue = string | string[] | undefined;
type GameRow = {
  id: number | string | null;
  date: string | null;
  startTime?: string | null;
  type?: number | string | null;
};
type GameIdRow = {
  game_id: number | string | null;
};

function getSingleQueryValue(value: QueryValue): string | undefined {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value[0];
  return undefined;
}

function isTruthyQueryFlag(value: QueryValue): boolean {
  const normalized = getSingleQueryValue(value)?.toLowerCase();
  return normalized != null && ["1", "true", "yes", "y", "all", "full"].includes(normalized);
}

function parsePositiveInteger(value: QueryValue): number | null {
  const normalized = getSingleQueryValue(value);
  if (!normalized) return null;
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return Math.trunc(parsed);
}

function isIsoDate(value: string | undefined): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

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

async function fetchFinishedSeasonGames(args: {
  seasonId: number;
  gameType?: number | null;
}): Promise<Array<{ id: number; date: string }>> {
  const today = new Date().toISOString().slice(0, 10);
  const now = new Date();
  const finishedCutoff = new Date(now.getTime() - 8 * 60 * 60 * 1000);

  const rows = await fetchAllRows<GameRow>((from, to) =>
    ((query: any) => {
      if (args.gameType != null) {
        return query.eq("type", args.gameType);
      }

      return query;
    })(
      serviceRoleClient
      .from("games")
      .select("id,date,startTime,seasonId,type")
      .eq("seasonId", args.seasonId)
      .lte("date", today)
      .order("date", { ascending: false })
      .order("id", { ascending: false })
    ).range(from, to)
  );

  return rows
    .map((row) => ({
      id: Number(row.id),
      date: row.date,
      startTime: row.startTime,
    }))
    .filter(
      (row): row is { id: number; date: string; startTime?: string | null } =>
        Number.isFinite(row.id) &&
        typeof row.date === "string" &&
        row.date < today &&
        (typeof row.startTime !== "string" || new Date(row.startTime) <= finishedCutoff)
    );
}

async function fetchSeasonGameIdSet(args: {
  table: "nhl_api_pbp_events" | "nhl_api_shift_rows" | "nhl_api_game_payloads_raw";
  seasonId: number;
  endpoint?: string;
  sourceUrlPrefix?: string;
}): Promise<Set<number>> {
  const rows = await fetchAllRows<GameIdRow>((from, to) => {
    let query: any = serviceRoleClient
      .from(args.table)
      .select("game_id")
      .eq("season_id", args.seasonId);

    if (args.endpoint) {
      query = query.eq("endpoint", args.endpoint);
    }

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

async function fetchSummaryPayloadRowsByGameIds(args: {
  gameIds: readonly number[];
  sourceUrlPrefix: string;
}) {
  if (args.gameIds.length === 0) {
    return [];
  }

  const rows = await fetchAllRows<{
    game_id: number | string | null;
    payload: unknown;
    fetched_at: string | null;
    source_url: string | null;
  }>((from, to) =>
    serviceRoleClient
      .from("nhl_api_game_payloads_raw")
      .select("game_id,payload,fetched_at,source_url")
      .eq("endpoint", PLAYER_STATS_SUMMARY_STORAGE_ENDPOINT)
      .like("source_url", `${args.sourceUrlPrefix}%`)
      .in("game_id", [...args.gameIds])
      .order("game_id", { ascending: true })
      .order("fetched_at", { ascending: false })
      .range(from, to)
  );

  return rows.filter(
    (
      row
    ): row is {
      game_id: number;
      payload: unknown;
      fetched_at: string | null;
      source_url: string | null;
    } => Number.isFinite(Number(row.game_id))
  ).map((row) => ({
    ...row,
    game_id: Number(row.game_id),
  }));
}

async function resolveSummaryRequestedGameIds(query: NextApiRequest["query"]) {
  const explicitGameId = parsePositiveInteger(query.gameId);
  const startDate = getSingleQueryValue(query.startDate);
  const endDate = getSingleQueryValue(query.endDate);
  const backfill = isTruthyQueryFlag(query.backfill) || isTruthyQueryFlag(query.games);
  const limit = parsePositiveInteger(query.limit) ?? 10;
  const seasonId = parsePositiveInteger(query.seasonId);
  const requestedGameType = parsePositiveInteger(query.gameType);

  if (explicitGameId != null) {
    return {
      mode: "game" as const,
      seasonId,
      requestedGameType,
      gameIds: [explicitGameId],
    };
  }

  if (seasonId == null) {
    throw new Error("seasonId is required for summary refresh range/backfill requests.");
  }

  if (isIsoDate(startDate) && isIsoDate(endDate)) {
    const rows = await serviceRoleClient
      .from("games")
      .select("id,date")
      .eq("seasonId", seasonId)
      .gte("date", startDate)
      .lte("date", endDate)
      .order("date", { ascending: true })
      .order("id", { ascending: true });

    if (rows.error) {
      throw rows.error;
    }

    return {
      mode: "date_range" as const,
      seasonId,
      requestedGameType,
      gameIds: (rows.data ?? [])
        .map((row) => Number(row.id))
        .filter((gameId) => Number.isFinite(gameId)),
    };
  }

  if (!backfill) {
    throw new Error(
      "Provide gameId, startDate+endDate, or backfill=true (with seasonId) for summary refresh."
    );
  }

  const [games, summaryGameIds] = await Promise.all([
    fetchFinishedSeasonGames({
      seasonId,
      gameType: requestedGameType ?? 2,
    }),
    fetchSeasonGameIdSet({
      table: "nhl_api_game_payloads_raw",
      seasonId,
      endpoint: PLAYER_STATS_SUMMARY_STORAGE_ENDPOINT,
      sourceUrlPrefix: PLAYER_STATS_SUMMARY_PARTITION_SOURCE_URL_PREFIX,
    }),
  ]);

  const gameIds: number[] = [];

  for (const game of games) {
    const gameId = game.id;
    const missingSummary = !summaryGameIds.has(gameId);

    if (!missingSummary) {
      continue;
    }

    gameIds.push(gameId);

    if (gameIds.length >= limit) {
      break;
    }
  }

  return {
    mode: "backfill_batch" as const,
    seasonId,
    requestedGameType,
    gameIds,
  };
}

async function handler(
  req: NextApiRequest,
  res: NextApiResponse<SummaryRefreshResponse>
) {
  if (req.method !== "POST" && req.method !== "GET") {
    res.setHeader("Allow", ["POST", "GET"]);
    return res.status(405).json({
      success: false,
      error: "Method not allowed",
    });
  }

  try {
    const resolved = await resolveSummaryRequestedGameIds(req.query);
    const shouldWarmLandingCache =
      isTruthyQueryFlag(req.query.warmLandingCache) ||
      (resolved.mode === "backfill_batch" &&
        resolved.seasonId != null &&
        resolved.gameIds.length === 0);
    const summaryRefresh = await refreshPlayerUnderlyingSummarySnapshotsForGameIds({
      gameIds: resolved.gameIds,
      seasonId: resolved.seasonId,
      requestedGameType: resolved.requestedGameType,
      shouldMigrateLegacySummaries: resolved.mode === "backfill_batch",
      shouldWarmLandingCache: false,
      supabase: serviceRoleClient,
    });

    if (shouldWarmLandingCache && resolved.seasonId != null) {
      await warmPlayerStatsLandingSeasonAggregateCache({
        seasonId: resolved.seasonId,
        gameType: resolved.requestedGameType,
        supabase: serviceRoleClient,
      });
    }

    return res.status(200).json({
      success: true,
      route: "/api/v1/db/update-player-underlying-summaries",
      requestedGameCount: resolved.gameIds.length,
      gameIds: resolved.gameIds,
      rowsUpserted: summaryRefresh.rowsUpserted,
    });
  } catch (error) {
    const message = (() => {
      if (error instanceof Error) {
        return error.message;
      }

      if (error && typeof error === "object") {
        try {
          return JSON.stringify(error);
        } catch {}
      }

      if (typeof error === "string") {
        return error;
      }

      return "Unable to refresh player underlying summaries.";
    })();
    return res.status(500).json({
      success: false,
      error: message,
      issues: [message],
    });
  }
}

export default withCronJobAudit(adminOnly(handler), {
  jobName: "/api/v1/db/update-player-underlying-summaries",
});
