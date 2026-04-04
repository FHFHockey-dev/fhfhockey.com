import type { NextApiResponse } from "next";
import type { SupabaseClient } from "@supabase/supabase-js";

import { getCurrentSeason } from "lib/NHL/server";
import serviceRoleClient from "lib/supabase/server";

import { ingestNhlApiRawGames } from "./nhlRawGamecenter.mjs";

type RawIngestQueryValue = string | string[] | undefined;

type RawIngestApiRequest = {
  method?: string;
  query: Record<string, RawIngestQueryValue>;
};

const SUPABASE_PAGE_SIZE = 1000;
const RAW_GAMECENTER_ENDPOINTS = [
  "play-by-play",
  "boxscore",
  "landing",
  "shiftcharts",
] as const;

type RawGamecenterEndpoint = (typeof RAW_GAMECENTER_ENDPOINTS)[number];

type GameRow = {
  id: number | string | null;
  date: string | null;
  startTime?: string | null;
};

type GameIdRow = {
  game_id: number | string | null;
};

function getSingleQueryValue(value: RawIngestQueryValue): string | undefined {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value[0];
  return undefined;
}

function isTruthyQueryFlag(value: RawIngestQueryValue): boolean {
  const normalized = getSingleQueryValue(value)?.toLowerCase();
  return normalized != null && ["1", "true", "yes", "y", "all", "full"].includes(normalized);
}

function parsePositiveInteger(value: RawIngestQueryValue): number | null {
  const normalized = getSingleQueryValue(value);
  if (!normalized) return null;
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return Math.trunc(parsed);
}

function isIsoDate(value: string | undefined): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

async function resolveSeasonId(query: Record<string, RawIngestQueryValue>): Promise<number> {
  const explicit = parsePositiveInteger(query.seasonId);
  if (explicit != null) return explicit;
  const season = await getCurrentSeason();
  return season.seasonId;
}

async function selectGameIdsForRange(args: {
  supabase: SupabaseClient;
  seasonId: number;
  startDate: string;
  endDate: string;
  limit: number | null;
}) {
  let query = args.supabase
    .from("games")
    .select("id,date,seasonId")
    .eq("seasonId", args.seasonId)
    .gte("date", args.startDate)
    .lte("date", args.endDate)
    .order("date", { ascending: true })
    .order("id", { ascending: true });

  if (args.limit != null) {
    query = query.limit(args.limit);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []).map((row) => Number(row.id)).filter((id) => Number.isFinite(id));
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

async function fetchBackfillCandidateGames(args: {
  supabase: SupabaseClient;
  seasonId: number;
  today: string;
}): Promise<Array<{ id: number; date: string }>> {
  const now = new Date();
  const finishedCutoff = new Date(now.getTime() - 8 * 60 * 60 * 1000);

  const rows = await fetchAllRows<GameRow>((from, to) =>
    args.supabase
      .from("games")
      .select("id,date,startTime,seasonId")
      .eq("seasonId", args.seasonId)
      .lte("date", args.today)
      .order("date", { ascending: false })
      .order("id", { ascending: false })
      .range(from, to)
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
        row.date < args.today &&
        (typeof row.startTime !== "string" || new Date(row.startTime) <= finishedCutoff)
    );
}

async function fetchSeasonGameIdSet(args: {
  supabase: SupabaseClient;
  table: "nhl_api_game_payloads_raw" | "nhl_api_pbp_events" | "nhl_api_shift_rows";
  seasonColumn: "season_id";
  seasonId: number;
  endpoint?: RawGamecenterEndpoint;
}): Promise<Set<number>> {
  const rows = await fetchAllRows<GameIdRow>((from, to) => {
    let query: any = args.supabase
      .from(args.table)
      .select("game_id")
      .eq(args.seasonColumn, args.seasonId);

    if (args.endpoint != null) {
      query = query.eq("endpoint", args.endpoint);
    }

    return query.range(from, to);
  });

  return new Set(
    rows
      .map((row) => Number(row.game_id))
      .filter((gameId) => Number.isFinite(gameId))
  );
}

async function selectGameIdsForBackfill(args: {
  supabase: SupabaseClient;
  seasonId: number;
  limit: number;
}) {
  const today = new Date().toISOString().slice(0, 10);

  const rawCoverageByEndpointPromises = RAW_GAMECENTER_ENDPOINTS.map(async (endpoint) => [
    endpoint,
    await fetchSeasonGameIdSet({
      supabase: args.supabase,
      table: "nhl_api_game_payloads_raw",
      seasonColumn: "season_id",
      seasonId: args.seasonId,
      endpoint,
    }),
  ] as const);

  const [
    games,
    rawCoverageByEndpointEntries,
    normalizedPbpGameIds,
    normalizedShiftGameIds,
  ] = await Promise.all([
    fetchBackfillCandidateGames({
      supabase: args.supabase,
      seasonId: args.seasonId,
      today,
    }),
    Promise.all(rawCoverageByEndpointPromises),
    fetchSeasonGameIdSet({
      supabase: args.supabase,
      table: "nhl_api_pbp_events",
      seasonColumn: "season_id",
      seasonId: args.seasonId,
    }),
    fetchSeasonGameIdSet({
      supabase: args.supabase,
      table: "nhl_api_shift_rows",
      seasonColumn: "season_id",
      seasonId: args.seasonId,
    }),
  ]);

  const rawCoverageByEndpoint = new Map(rawCoverageByEndpointEntries);
  const missingCoverageGameIds: number[] = [];

  for (const game of games) {
    const gameId = game.id;
    const hasFullCoverage =
      RAW_GAMECENTER_ENDPOINTS.every((endpoint) => rawCoverageByEndpoint.get(endpoint)?.has(gameId)) &&
      normalizedPbpGameIds.has(gameId) &&
      normalizedShiftGameIds.has(gameId);

    if (hasFullCoverage) {
      continue;
    }

    missingCoverageGameIds.push(gameId);

    if (missingCoverageGameIds.length >= args.limit) {
      break;
    }
  }

  return missingCoverageGameIds;
}

export async function resolveRequestedGameIds(
  query: Record<string, RawIngestQueryValue>,
  supabase: SupabaseClient
): Promise<{
  mode: "game" | "date_range" | "backfill_batch";
  seasonId: number;
  gameIds: number[];
}> {
  const explicitGameId = parsePositiveInteger(query.gameId);
  const startDate = getSingleQueryValue(query.startDate);
  const endDate = getSingleQueryValue(query.endDate);
  const backfill = isTruthyQueryFlag(query.backfill) || isTruthyQueryFlag(query.games);
  const limit = parsePositiveInteger(query.limit);
  const seasonId = await resolveSeasonId(query);

  if (explicitGameId != null) {
    return {
      mode: "game",
      seasonId,
      gameIds: [explicitGameId],
    };
  }

  if (isIsoDate(startDate) && isIsoDate(endDate)) {
    return {
      mode: "date_range",
      seasonId,
      gameIds: await selectGameIdsForRange({
        supabase,
        seasonId,
        startDate,
        endDate,
        limit,
      }),
    };
  }

  if (backfill) {
    return {
      mode: "backfill_batch",
      seasonId,
      gameIds: await selectGameIdsForBackfill({
        supabase,
        seasonId,
        limit: limit ?? 25,
      }),
    };
  }

  throw new Error(
    "Provide gameId, startDate+endDate, or backfill=true (optionally with seasonId and limit)."
  );
}

function sumRowsAffected(results: Array<{
  rosterCount: number;
  eventCount: number;
  shiftCount: number;
  rawEndpointsStored: number;
}>) {
  return results.reduce(
    (total, result) =>
      total +
      result.rosterCount +
      result.eventCount +
      result.shiftCount +
      result.rawEndpointsStored,
    0
  );
}

export function createNhlRawGamecenterRoute(args: {
  routeName: string;
  routeAlias: "play-by-play" | "shift-charts";
}) {
  return async function handler(req: RawIngestApiRequest, res: NextApiResponse) {
    if (req.method !== "GET" && req.method !== "POST") {
      return res.status(405).json({
        success: false,
        message: "Method not allowed",
      });
    }

    const supabase = serviceRoleClient;
    const selection = await resolveRequestedGameIds(req.query, supabase);

    if (selection.gameIds.length === 0) {
      return res.status(200).json({
        success: true,
        route: args.routeName,
        routeAlias: args.routeAlias,
        mode: selection.mode,
        seasonId: selection.seasonId,
        requestedGameCount: 0,
        rowsUpserted: 0,
        results: [],
        message: "No matching games found for the requested selection.",
      });
    }

    const results = await ingestNhlApiRawGames(supabase, selection.gameIds);
    const rowsUpserted = sumRowsAffected(results);

    return res.status(200).json({
      success: true,
      route: args.routeName,
      routeAlias: args.routeAlias,
      mode: selection.mode,
      seasonId: selection.seasonId,
      requestedGameCount: selection.gameIds.length,
      gameIds: selection.gameIds,
      rowsUpserted,
      results,
      message:
        "Raw NHL gamecenter ingestion completed. Each run stores play-by-play, boxscore, landing, and shiftcharts payloads plus normalized roster, event, and shift rows.",
    });
  };
}
