import type { NextApiRequest, NextApiResponse } from "next";

import { withOperationalRouteAuth } from "lib/cron/withOperationalRouteAuth";
import {
  DEFAULT_BOUNDED_REFRESH_FUTURE_DAYS,
  DEFAULT_BOUNDED_REFRESH_PAST_DAYS,
  DEFAULT_YAHOO_GAME_KEY,
  deleteRosterScheduleRows,
  findStaleRosterScheduleRowIds,
  MAX_BOUNDED_REFRESH_DAYS,
  mapGameDateToYahooWeek,
  normalizeNhlGameToTeamRows,
  summarizeRosterScheduleChanges,
  type PersistedRosterScheduleRow,
  type ScheduleDeleteClient,
  type ScheduleWriteClient,
  type YahooMatchupWeekRow,
  upsertRosterScheduleRows,
} from "lib/rosterScheduleData";
import {
  fetchBoundedNhlSchedule,
  fetchFullSeasonNhlSchedule,
} from "lib/rosterScheduleData/source";
import type {
  FetchedNhlScheduleGame,
  RosterOptimizerTeamGameUpsert,
} from "lib/rosterScheduleData/types";

type SyncMode = "bounded" | "full";
type SyncRequest = {
  mode: SyncMode;
  gameKey: string;
  startDate: string;
  endDate: string;
};
type DatabaseError = { code?: string; details?: string; message: string };
type DatabaseResult<T> = { data: T[] | null; error: DatabaseError | null };
type DatabaseBuilder<T> = PromiseLike<DatabaseResult<T>> & {
  eq(column: string, value: unknown): DatabaseBuilder<T>;
  gte(column: string, value: unknown): DatabaseBuilder<T>;
  in(column: string, values: readonly unknown[]): DatabaseBuilder<T>;
  lte(column: string, value: unknown): DatabaseBuilder<T>;
  order(column: string, options: { ascending: boolean }): DatabaseBuilder<T>;
};
type SyncReadClient = {
  from(table: string): {
    select<T = Record<string, unknown>>(columns: string): DatabaseBuilder<T>;
  };
};

class SyncRouteError extends Error {
  readonly code: string;
  readonly status: number;
  readonly details?: string;

  constructor(args: {
    code: string;
    message: string;
    status: number;
    details?: string;
  }) {
    super(args.message);
    this.name = "SyncRouteError";
    this.code = args.code;
    this.status = args.status;
    this.details = args.details;
  }
}

function firstQueryValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function formatUtcDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function addUtcDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function parseExactDate(value: string, field: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new SyncRouteError({
      code: "INVALID_DATE",
      message: `${field} must use YYYY-MM-DD.`,
      status: 400,
    });
  }
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (
    Number.isNaN(parsed.getTime()) ||
    parsed.toISOString().slice(0, 10) !== value
  ) {
    throw new SyncRouteError({
      code: "INVALID_DATE",
      message: `${field} must be a real calendar date.`,
      status: 400,
    });
  }
  return value;
}

export function parseRosterScheduleSyncRequest(
  query: NextApiRequest["query"],
  now: Date = new Date(),
): SyncRequest {
  const rawMode = firstQueryValue(query.mode)?.trim().toLowerCase() ?? "bounded";
  if (rawMode !== "bounded" && rawMode !== "full") {
    throw new SyncRouteError({
      code: "INVALID_MODE",
      message: "mode must be either bounded or full.",
      status: 400,
    });
  }
  const gameKey =
    firstQueryValue(query.gameKey)?.trim() || DEFAULT_YAHOO_GAME_KEY;
  if (!/^[A-Za-z0-9._-]{1,40}$/.test(gameKey)) {
    throw new SyncRouteError({
      code: "INVALID_GAME_KEY",
      message: "gameKey has an invalid format.",
      status: 400,
    });
  }

  const defaultStart = formatUtcDate(
    addUtcDays(now, -DEFAULT_BOUNDED_REFRESH_PAST_DAYS),
  );
  const defaultEnd = formatUtcDate(
    addUtcDays(now, DEFAULT_BOUNDED_REFRESH_FUTURE_DAYS),
  );
  const startDate = parseExactDate(
    firstQueryValue(query.startDate) ?? defaultStart,
    "startDate",
  );
  const endDate = parseExactDate(
    firstQueryValue(query.endDate) ?? defaultEnd,
    "endDate",
  );
  if (endDate < startDate) {
    throw new SyncRouteError({
      code: "INVALID_DATE_RANGE",
      message: "endDate must be on or after startDate.",
      status: 400,
    });
  }
  const inclusiveDays =
    Math.floor(
      (Date.parse(`${endDate}T00:00:00.000Z`) -
        Date.parse(`${startDate}T00:00:00.000Z`)) /
        86_400_000,
    ) + 1;
  if (rawMode === "bounded" && inclusiveDays > MAX_BOUNDED_REFRESH_DAYS) {
    throw new SyncRouteError({
      code: "DATE_RANGE_TOO_LARGE",
      message: `A bounded refresh cannot exceed ${MAX_BOUNDED_REFRESH_DAYS} days.`,
      status: 400,
    });
  }
  return { mode: rawMode, gameKey, startDate, endDate };
}

async function loadYahooMatchupWeeks(
  client: SyncReadClient,
  gameKey: string,
): Promise<YahooMatchupWeekRow[]> {
  const { data, error } = await client
    .from("yahoo_matchup_weeks")
    .select<YahooMatchupWeekRow>(
      "id,game_key,season,week,start_date,end_date",
    )
    .eq("game_key", gameKey)
    .order("week", { ascending: true });
  if (error) throw error;
  if (!data?.length) {
    throw new SyncRouteError({
      code: "MATCHUP_WEEKS_NOT_FOUND",
      message: `No Yahoo matchup weeks exist for gameKey=${gameKey}.`,
      status: 404,
    });
  }
  return data;
}

async function resolveNhlSeasonId(args: {
  client: SyncReadClient;
  weeks: readonly YahooMatchupWeekRow[];
}): Promise<number> {
  const starts = args.weeks
    .map((week) => week.start_date)
    .filter((date): date is string => date != null)
    .sort();
  const ends = args.weeks
    .map((week) => week.end_date)
    .filter((date): date is string => date != null)
    .sort();
  const firstDate = starts[0];
  const lastDate = ends.at(-1);
  if (!firstDate || !lastDate) {
    throw new SyncRouteError({
      code: "MATCHUP_WEEK_DATES_MISSING",
      message: "Yahoo matchup weeks must include inclusive start and end dates.",
      status: 409,
    });
  }

  const { data, error } = await args.client
    .from("seasons")
    .select<{ id: number; startDate: string; endDate: string }>(
      "id,startDate,endDate",
    )
    .lte("startDate", lastDate)
    .gte("endDate", firstDate)
    .order("startDate", { ascending: false });
  if (error) throw error;
  if (data?.length !== 1) {
    throw new SyncRouteError({
      code: "NHL_SEASON_UNRESOLVED",
      message: "Yahoo matchup dates must overlap exactly one NHL season record.",
      status: 409,
      details: `overlapCount=${data?.length ?? 0}`,
    });
  }
  const seasonId = Number(data[0].id);
  if (!Number.isSafeInteger(seasonId) || seasonId <= 0) {
    throw new SyncRouteError({
      code: "NHL_SEASON_INVALID",
      message: "The matching NHL season record has an invalid id.",
      status: 409,
    });
  }
  return seasonId;
}

async function loadSeasonTeams(args: {
  client: SyncReadClient;
  seasonId: number;
}): Promise<Array<{ id: number; abbreviation: string }>> {
  const membership = await args.client
    .from("team_season")
    .select<{ teamId: number }>("teamId")
    .eq("seasonId", args.seasonId);
  if (membership.error) throw membership.error;
  const teamIds = (membership.data ?? []).map((row) => row.teamId);
  if (teamIds.length === 0) {
    throw new SyncRouteError({
      code: "SEASON_TEAMS_NOT_FOUND",
      message: `No NHL team membership exists for season ${args.seasonId}.`,
      status: 409,
    });
  }

  const teams = await args.client
    .from("teams")
    .select<{ id: number; abbreviation: string }>("id,abbreviation")
    .in("id", teamIds)
    .order("id", { ascending: true });
  if (teams.error) throw teams.error;
  if (!teams.data?.length) {
    throw new SyncRouteError({
      code: "SEASON_TEAMS_NOT_FOUND",
      message: `No NHL teams resolved for season ${args.seasonId}.`,
      status: 409,
    });
  }
  return teams.data.map((team) => ({
    id: team.id,
    abbreviation: team.abbreviation.trim(),
  }));
}

async function loadExistingScheduleRows(
  client: SyncReadClient,
  gameKey: string,
): Promise<PersistedRosterScheduleRow[]> {
  const { data, error } = await client
    .from("roster_optimizer_team_games")
    .select<PersistedRosterScheduleRow>(
      "id,game_key,source_game_id,team_id,game_date,week,game_status,schedule_status,mapping_status,is_countable",
    )
    .eq("game_key", gameKey);
  if (error) throw error;
  return data ?? [];
}

function buildScheduleRows(args: {
  fetchedAt: string;
  fetchedGames: readonly FetchedNhlScheduleGame[];
  gameKey: string;
  mode: SyncMode;
  seasonId: number;
  teams: readonly { id: number }[];
  weeks: readonly YahooMatchupWeekRow[];
  yahooSeason: string;
}): {
  ignored: Array<{
    awayTeamId: number;
    homeTeamId: number;
    reason: "season_mismatch" | "unknown_team";
    sourceGameId: number;
  }>;
  ignoredGames: number;
  mappedGames: number;
  rows: RosterOptimizerTeamGameUpsert[];
  unmapped: Array<{ gameDate: string; reason: string; sourceGameId: number }>;
} {
  const knownTeams = new Set(args.teams.map((team) => team.id));
  const rows: RosterOptimizerTeamGameUpsert[] = [];
  const ignored: Array<{
    awayTeamId: number;
    homeTeamId: number;
    reason: "season_mismatch" | "unknown_team";
    sourceGameId: number;
  }> = [];
  const unmapped: Array<{
    gameDate: string;
    reason: string;
    sourceGameId: number;
  }> = [];
  let ignoredGames = 0;
  let mappedGames = 0;

  for (const entry of args.fetchedGames) {
    const game = entry.game;
    if (game.season !== args.seasonId) {
      ignored.push({
        awayTeamId: game.awayTeam.id,
        homeTeamId: game.homeTeam.id,
        reason: "season_mismatch",
        sourceGameId: game.id,
      });
      ignoredGames += 1;
      continue;
    }
    if (
      !knownTeams.has(game.homeTeam.id) ||
      !knownTeams.has(game.awayTeam.id)
    ) {
      ignored.push({
        awayTeamId: game.awayTeam.id,
        homeTeamId: game.homeTeam.id,
        reason: "unknown_team",
        sourceGameId: game.id,
      });
      ignoredGames += 1;
      continue;
    }
    const mapping = mapGameDateToYahooWeek(game.gameDate, args.weeks);
    if (mapping.status === "mapped") {
      mappedGames += 1;
    } else {
      unmapped.push({
        sourceGameId: game.id,
        gameDate: game.gameDate,
        reason: mapping.reason,
      });
    }
    const teamRows = normalizeNhlGameToTeamRows({
      fetchedAt: args.fetchedAt,
      game,
      gameKey: args.gameKey,
      mapping,
      sourceUrl: entry.sourceUrl,
      yahooSeason: args.yahooSeason,
    });
    rows.push(
      ...teamRows.map((row) => ({
        ...row,
        source_metadata: { ...row.source_metadata, syncMode: args.mode },
      })),
    );
  }

  return { ignored, ignoredGames, mappedGames, rows, unmapped };
}

export async function updateRosterOptimizerScheduleHandler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  try {
    const request = parseRosterScheduleSyncRequest(req.query);
    const serviceClient = (req as NextApiRequest & { supabase: unknown })
      .supabase;
    const readClient = serviceClient as SyncReadClient;
    const weeks = await loadYahooMatchupWeeks(readClient, request.gameKey);
    const yahooSeasons = new Set(weeks.map((week) => week.season));
    if (yahooSeasons.size !== 1) {
      throw new SyncRouteError({
        code: "YAHOO_SEASON_AMBIGUOUS",
        message: "A Yahoo game key must resolve to exactly one season.",
        status: 409,
      });
    }
    const yahooSeason = [...yahooSeasons][0];
    const seasonId = await resolveNhlSeasonId({ client: readClient, weeks });
    const teams = await loadSeasonTeams({ client: readClient, seasonId });
    const sourceResult =
      request.mode === "full"
        ? await fetchFullSeasonNhlSchedule({ seasonId, teams })
        : await fetchBoundedNhlSchedule({
            startDate: request.startDate,
            endDate: request.endDate,
          });
    const fetchedAt = new Date().toISOString();
    const normalized = buildScheduleRows({
      fetchedAt,
      fetchedGames: sourceResult.games,
      gameKey: request.gameKey,
      mode: request.mode,
      seasonId,
      teams,
      weeks,
      yahooSeason,
    });
    const existingRows = await loadExistingScheduleRows(
      readClient,
      request.gameKey,
    );
    const changes = summarizeRosterScheduleChanges({
      existing: existingRows,
      incoming: normalized.rows,
    });
    const rowsUpserted = await upsertRosterScheduleRows({
      client: serviceClient as ScheduleWriteClient,
      rows: normalized.rows,
    });
    const staleRowIds =
      request.mode === "full" && sourceResult.complete
        ? findStaleRosterScheduleRowIds({
            existing: existingRows,
            incoming: normalized.rows,
          })
        : [];
    const rowsDeleted = await deleteRosterScheduleRows({
      client: serviceClient as ScheduleDeleteClient,
      rowIds: staleRowIds,
    });

    if (normalized.unmapped.length > 0) {
      console.warn("Roster optimizer schedule contains unmapped games.", {
        gameKey: request.gameKey,
        unmappedCount: normalized.unmapped.length,
        sample: normalized.unmapped.slice(0, 20),
      });
    }
    if (normalized.ignored.length > 0) {
      console.warn("Roster optimizer schedule ignored source games.", {
        gameKey: request.gameKey,
        ignoredCount: normalized.ignored.length,
        sample: normalized.ignored.slice(0, 20),
      });
    }
    if (changes.rescheduledRows > 0) {
      console.info("Roster optimizer schedule reconciled rescheduled games.", {
        gameKey: request.gameKey,
        rescheduledRows: changes.rescheduledRows,
        sourceGameIds: changes.rescheduledSourceGameIds.slice(0, 20),
      });
    }
    if (rowsDeleted > 0) {
      console.info("Roster optimizer schedule removed stale cache rows.", {
        gameKey: request.gameKey,
        rowsDeleted,
      });
    }
    if (request.mode === "full" && !sourceResult.complete) {
      console.warn(
        "Roster optimizer schedule skipped stale-row deletion because the source refresh was incomplete.",
        {
          gameKey: request.gameKey,
          warningCount: sourceResult.warnings.length,
        },
      );
    }
    return res.status(200).json({
      success: true,
      data: {
        mode: request.mode,
        gameKey: request.gameKey,
        yahooSeason,
        sourceSeasonId: seasonId,
        refreshRange:
          request.mode === "bounded"
            ? { startDate: request.startDate, endDate: request.endDate }
            : null,
        fetchedAt,
        gamesFetched: sourceResult.games.length,
        mappedGames: normalized.mappedGames,
        unmappedGames: normalized.unmapped.length,
        ignoredGames: normalized.ignoredGames,
        rowsUpserted,
        rowsDeleted,
        changes,
        reconciliation:
          request.mode === "bounded"
            ? { status: "not_applicable", staleRowsFound: 0 }
            : sourceResult.complete
              ? { status: "complete", staleRowsFound: staleRowIds.length }
              : {
                  status: "skipped_incomplete_source",
                  staleRowsFound: 0,
                },
        warnings: sourceResult.warnings,
        ignored: normalized.ignored.slice(0, 50),
        ignoredTruncated: normalized.ignored.length > 50,
        unmapped: normalized.unmapped.slice(0, 50),
        unmappedTruncated: normalized.unmapped.length > 50,
      },
    });
  } catch (error: unknown) {
    const routeError =
      error instanceof SyncRouteError
        ? error
        : new SyncRouteError({
            code: "SCHEDULE_SYNC_FAILED",
            message:
              error instanceof Error
                ? error.message
                : "Roster optimizer schedule synchronization failed.",
            status: 500,
            details:
              typeof error === "object" && error != null && "details" in error
                ? String(error.details)
                : undefined,
          });
    return res.status(routeError.status).json({
      success: false,
      error: {
        code: routeError.code,
        message: routeError.message,
        ...(routeError.details ? { details: routeError.details } : {}),
      },
    });
  }
}

export default withOperationalRouteAuth(
  updateRosterOptimizerScheduleHandler,
  {
    methods: ["POST"],
    audit: {
      jobName: "update-roster-optimizer-schedule",
      includeFinalAuditReceipt: true,
    },
  },
);
