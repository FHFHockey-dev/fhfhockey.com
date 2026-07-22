import type { NextApiResponse } from "next";
import type { SupabaseClient } from "@supabase/supabase-js";

import { getCurrentSeason } from "lib/NHL/server";
import serviceRoleClient from "lib/supabase/server";

import {
  ingestNhlApiRawGames,
  NORMALIZATION_PARSER_FINGERPRINT,
} from "./nhlRawGamecenter.mjs";
import { summarizeNhlRawGamecenterIngestResults } from "./nhlRawGamecenterTelemetry";

type RawIngestQueryValue = string | string[] | undefined;

type RawIngestApiRequest = {
  method?: string;
  query: Record<string, RawIngestQueryValue>;
};

class InvalidRawIngestRequestError extends Error {}

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
  id?: number | string | null;
  game_id: number | string | null;
};

function getSingleQueryValue(value: RawIngestQueryValue): string | undefined {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value[0];
  return undefined;
}

function isTruthyQueryFlag(value: RawIngestQueryValue): boolean {
  const normalized = getSingleQueryValue(value)?.toLowerCase();
  return (
    normalized != null &&
    ["1", "true", "yes", "y", "all", "full"].includes(normalized)
  );
}

function getOptionalSingleQueryValue(
  value: RawIngestQueryValue,
  fieldName: string,
): string | undefined {
  if (Array.isArray(value)) {
    throw new InvalidRawIngestRequestError(
      `${fieldName} must be supplied exactly once.`,
    );
  }
  return value;
}

function parseOptionalPositiveInteger(
  value: RawIngestQueryValue,
  fieldName: string,
): number | null {
  const normalized = getOptionalSingleQueryValue(value, fieldName);
  if (normalized == null) return null;
  if (!/^[1-9]\d*$/.test(normalized)) {
    throw new InvalidRawIngestRequestError(
      `${fieldName} must be a canonical positive integer.`,
    );
  }
  const parsed = Number(normalized);
  if (!Number.isSafeInteger(parsed)) {
    throw new InvalidRawIngestRequestError(
      `${fieldName} must be a canonical positive safe integer.`,
    );
  }
  return parsed;
}

function isIsoDate(value: string | undefined): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const parsed = new Date(`${value}T00:00:00.000Z`);
  return (
    Number.isFinite(parsed.getTime()) &&
    parsed.toISOString().slice(0, 10) === value
  );
}

async function resolveSeasonId(
  query: Record<string, RawIngestQueryValue>,
): Promise<number> {
  const explicit = parseOptionalPositiveInteger(query.seasonId, "seasonId");
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
  const rows = await fetchAllRows<GameRow>(async (from, to) => {
    const effectiveTo = args.limit == null ? to : Math.min(to, args.limit - 1);
    if (effectiveTo < from) {
      return { data: [], error: null };
    }

    return args.supabase
      .from("games")
      .select("id,date,seasonId")
      .eq("seasonId", args.seasonId)
      .gte("date", args.startDate)
      .lte("date", args.endDate)
      .order("date", { ascending: true })
      .order("id", { ascending: true })
      .range(from, effectiveTo);
  });

  return rows.map((row) => Number(row.id)).filter((id) => Number.isFinite(id));
}

async function fetchAllRows<TRow>(
  fetchPage: (
    from: number,
    to: number,
  ) => Promise<{
    data: TRow[] | null;
    error: unknown;
  }>,
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

  const rows = await fetchAllRows<GameRow>(async (from, to) =>
    args.supabase
      .from("games")
      .select("id,date,startTime,seasonId")
      .eq("seasonId", args.seasonId)
      .lte("date", args.today)
      .order("date", { ascending: false })
      .order("id", { ascending: false })
      .range(from, to),
  );

  return rows.flatMap<{ id: number; date: string; startTime?: string | null }>(
    (row) => {
      const id = Number(row.id);
      const date = row.date;
      const startTime = row.startTime;

      if (!Number.isFinite(id)) return [];
      if (typeof date !== "string" || date >= args.today) {
        return [];
      }
      if (
        typeof startTime === "string" &&
        new Date(startTime) > finishedCutoff
      ) {
        return [];
      }

      return [{ id, date, startTime }];
    },
  );
}

async function fetchSeasonGameIdSet(args: {
  supabase: SupabaseClient;
  table: "nhl_api_game_payloads_raw";
  seasonColumn: "season_id";
  seasonId: number;
  endpoint?: RawGamecenterEndpoint;
}): Promise<Set<number>> {
  const rows = await fetchAllRows<GameIdRow>(async (from, to) => {
    let query: any = args.supabase
      .from(args.table)
      .select("id,game_id")
      .eq(args.seasonColumn, args.seasonId);

    if (args.endpoint != null) {
      query = query.eq("endpoint", args.endpoint);
    }

    return query.order("id", { ascending: true }).range(from, to);
  });

  return new Set(
    rows
      .map((row) => Number(row.game_id))
      .filter((gameId) => Number.isFinite(gameId)),
  );
}

async function fetchCompletedNormalizationGameIdSet(args: {
  supabase: SupabaseClient;
  seasonId: number;
}): Promise<Set<number>> {
  const rows = await fetchAllRows<GameIdRow>(async (from, to) =>
    args.supabase
      .from("nhl_api_game_normalization_status")
      .select("game_id")
      .eq("season_id", args.seasonId)
      .eq("status", "complete")
      .eq("parser_fingerprint", NORMALIZATION_PARSER_FINGERPRINT)
      .gt("observed_roster_rows", 0)
      .gt("observed_event_rows", 0)
      .gt("observed_shift_rows", 0)
      .order("game_id", { ascending: true })
      .range(from, to),
  );

  return new Set(
    rows
      .map((row) => Number(row.game_id))
      .filter((gameId) => Number.isFinite(gameId)),
  );
}

async function selectGameIdsForBackfill(args: {
  supabase: SupabaseClient;
  seasonId: number;
  limit: number;
}) {
  const today = new Date().toISOString().slice(0, 10);

  const rawCoverageByEndpointPromises = RAW_GAMECENTER_ENDPOINTS.map(
    async (endpoint) =>
      [
        endpoint,
        await fetchSeasonGameIdSet({
          supabase: args.supabase,
          table: "nhl_api_game_payloads_raw",
          seasonColumn: "season_id",
          seasonId: args.seasonId,
          endpoint,
        }),
      ] as const,
  );

  const [games, rawCoverageByEndpointEntries, completedNormalizationGameIds] =
    await Promise.all([
      fetchBackfillCandidateGames({
        supabase: args.supabase,
        seasonId: args.seasonId,
        today,
      }),
      Promise.all(rawCoverageByEndpointPromises),
      fetchCompletedNormalizationGameIdSet({
        supabase: args.supabase,
        seasonId: args.seasonId,
      }),
    ]);

  const rawCoverageByEndpoint = new Map(rawCoverageByEndpointEntries);
  const missingCoverageGameIds: number[] = [];

  for (const game of games) {
    const gameId = game.id;
    const hasFullCoverage =
      RAW_GAMECENTER_ENDPOINTS.every((endpoint) =>
        rawCoverageByEndpoint.get(endpoint)?.has(gameId),
      ) && completedNormalizationGameIds.has(gameId);

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
  supabase: SupabaseClient,
): Promise<{
  mode: "game" | "date_range" | "backfill_batch";
  seasonId: number;
  gameIds: number[];
}> {
  const explicitGameId = parseOptionalPositiveInteger(query.gameId, "gameId");
  const startDate = getOptionalSingleQueryValue(query.startDate, "startDate");
  const endDate = getOptionalSingleQueryValue(query.endDate, "endDate");
  const backfill =
    isTruthyQueryFlag(query.backfill) || isTruthyQueryFlag(query.games);
  const limit = parseOptionalPositiveInteger(query.limit, "limit");
  const hasDateRangeInput = startDate != null || endDate != null;

  if (
    hasDateRangeInput &&
    (!isIsoDate(startDate) || !isIsoDate(endDate) || startDate > endDate)
  ) {
    throw new InvalidRawIngestRequestError(
      "startDate and endDate must be real YYYY-MM-DD dates in nondecreasing order.",
    );
  }

  const seasonId = await resolveSeasonId(query);

  if (explicitGameId != null) {
    return {
      mode: "game",
      seasonId,
      gameIds: [explicitGameId],
    };
  }

  if (hasDateRangeInput && isIsoDate(startDate) && isIsoDate(endDate)) {
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
    "Provide gameId, startDate+endDate, or backfill=true (optionally with seasonId and limit).",
  );
}

export function createNhlRawGamecenterRoute(args: {
  routeName: string;
  routeAlias: "play-by-play" | "shift-charts";
}) {
  return async function handler(
    req: RawIngestApiRequest,
    res: NextApiResponse,
  ) {
    if (req.method !== "GET" && req.method !== "POST") {
      return res.status(405).json({
        success: false,
        message: "Method not allowed",
      });
    }

    const supabase = serviceRoleClient;
    let selection: Awaited<ReturnType<typeof resolveRequestedGameIds>>;
    try {
      selection = await resolveRequestedGameIds(req.query, supabase);
    } catch (error) {
      if (error instanceof InvalidRawIngestRequestError) {
        return res.status(400).json({
          success: false,
          message: error.message,
          rowsUpserted: 0,
          rowsVerified: 0,
        });
      }
      throw error;
    }

    if (selection.gameIds.length === 0) {
      return res.status(200).json({
        success: true,
        route: args.routeName,
        routeAlias: args.routeAlias,
        mode: selection.mode,
        seasonId: selection.seasonId,
        requestedGameCount: 0,
        rowsUpserted: 0,
        rowsVerified: 0,
        results: [],
        message: "No matching games found for the requested selection.",
      });
    }

    const results = await ingestNhlApiRawGames(supabase, selection.gameIds);
    const { rowsUpserted, rowsVerified } =
      summarizeNhlRawGamecenterIngestResults(results);

    return res.status(200).json({
      success: true,
      route: args.routeName,
      routeAlias: args.routeAlias,
      mode: selection.mode,
      seasonId: selection.seasonId,
      requestedGameCount: selection.gameIds.length,
      gameIds: selection.gameIds,
      rowsUpserted,
      rowsVerified,
      results,
      message:
        "Raw NHL gamecenter ingestion completed. rowsVerified includes immutable snapshot identities and normalized scope cardinality; rowsUpserted includes only proven non-idempotent normalized inserts.",
    });
  };
}
