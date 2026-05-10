import type { NextApiRequest, NextApiResponse } from "next";
import { withCronJobAudit } from "lib/cron/withCronJobAudit";
import { CronTimedResponse, withCronJobTiming } from "lib/cron/timingContract";
import supabase from "lib/supabase/server";
import { formatDurationMsToMMSS } from "lib/formatDurationMmSs";
import {
  parseQueryBoolean,
  parseQueryPositiveInt,
  parseQueryString
} from "lib/api/queryParams";
import { getRollingForgeStageDependencyContract } from "lib/rollingForgePipeline";

import { fetchPbpGame, upsertPbpGameAndPlays } from "lib/projections/ingest/pbp";
import {
  upsertShiftTotalsForGame,
  upsertShiftTotalsForGameFromPbp
} from "lib/projections/ingest/shifts";

type Result = {
  success: boolean;
  startDate: string;
  endDate: string;
  chunkDays: number;
  resumeFromDate: string | null;
  nextStartDate: string | null;
  durationMs: string;
  timedOut: boolean;
  maxDurationMs: string;
  gamesTotal: number;
  gamesProcessed: number;
  pbpGamesUpserted: number;
  pbpPlaysUpserted: number;
  shiftRowsUpserted: number;
  rowsUpserted: number;
  failedRows: number;
  skipped: number;
  skipReasons: {
    alreadyHadPbpAndShifts: number;
    alreadyHadPbpOnly: number;
    alreadyHadShiftTotalsOnly: number;
    gamecenterFeedUnavailable: number;
  };
  debug?: {
    sampled: Array<{
      gameId: number;
      date: string;
      pbpExists: boolean;
      shiftTotalsExist: boolean;
      action: "skipped" | "ingested";
    }>;
  };
  maxGames: number | null;
  nextGameId: number | null;
  lastCompletedGameId: number | null;
  errors: Array<{
    gameId: number;
    date: string;
    stage:
      | "list_games"
      | "precheck_pbp"
      | "precheck_shifts"
      | "fetch_pbp"
      | "upsert_pbp"
      | "upsert_shifts";
    message: string;
  }>;
  dependencyContract?: ReturnType<typeof getRollingForgeStageDependencyContract>;
};

function assertSupabase() {
  if (!supabase) throw new Error("Supabase server client not available");
}

function getParam(req: NextApiRequest, key: string): string | undefined {
  const queryValue = parseQueryString(req.query[key]);
  if (queryValue) return queryValue.trim();

  const body = req.body;
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return undefined;
  }

  const value = (body as Record<string, unknown>)[key];
  if (typeof value === "string" && value.trim()) return value.trim();
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  return undefined;
}

function parseBooleanParam(value: string | null): boolean {
  if (!value) return false;
  const normalized = value.trim().toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "yes";
}

function isoDateOnly(d: string): string {
  return d.slice(0, 10);
}

function parseChunkDays(value: string | null): number {
  const n = Number(value ?? 0);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.max(1, Math.floor(n));
}

function buildDateRange(start: string, end: string): string[] {
  const out: string[] = [];
  const startDate = new Date(`${start}T00:00:00.000Z`);
  const endDate = new Date(`${end}T00:00:00.000Z`);
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime()))
    return out;
  for (let d = startDate; d <= endDate; d.setUTCDate(d.getUTCDate() + 1)) {
    out.push(isoDateOnly(d.toISOString()));
  }
  return out;
}

function isUnavailableGamecenterFeedError(error: unknown): boolean {
  const message = (error as any)?.message ?? String(error);
  return (
    typeof message === "string" &&
    message.includes("HTTP 404 Not Found") &&
    message.includes("/gamecenter/")
  );
}

async function hasPbp(gameId: number): Promise<boolean> {
  assertSupabase();
  const { data, error } = await supabase
    .from("pbp_games")
    .select("id")
    .eq("id", gameId)
    .maybeSingle();
  if (error) throw error;
  return Boolean(data?.id);
}

async function hasShiftTotals(gameId: number): Promise<boolean> {
  assertSupabase();
  const { count, error } = await supabase
    .from("shift_charts")
    .select("id", { count: "exact", head: true })
    .eq("game_id", gameId);
  if (error) throw error;
  return (count ?? 0) > 0;
}

async function listGamesInRange(startDate: string, endDate: string) {
  assertSupabase();
  const { data, error } = await supabase
    .from("games")
    .select("id,date")
    .gte("date", startDate)
    .lte("date", endDate)
    .order("date", { ascending: true });
  if (error) throw error;
  return (data ?? []) as Array<{ id: number; date: string }>;
}

async function handler(
  req: NextApiRequest,
  res: NextApiResponse<CronTimedResponse<Result>>
) {
  const startedAt = Date.now();
  const dependencyContract = getRollingForgeStageDependencyContract(
    "projection_input_ingest"
  );
  const withTiming = (body: Result, endedAt = Date.now()) =>
    withCronJobTiming(body, startedAt, endedAt);
  if (req.method !== "POST" && req.method !== "GET") {
    res.setHeader("Allow", ["GET", "POST"]);
    return res.status(405).json(withTiming({
      success: false,
      startDate: "",
      endDate: "",
      chunkDays: 0,
      resumeFromDate: null,
      nextStartDate: null,
      durationMs: formatDurationMsToMMSS(Date.now() - startedAt),
      timedOut: false,
      maxDurationMs: formatDurationMsToMMSS(0),
      gamesTotal: 0,
      gamesProcessed: 0,
      pbpGamesUpserted: 0,
      pbpPlaysUpserted: 0,
      shiftRowsUpserted: 0,
      rowsUpserted: 0,
      failedRows: 0,
      skipped: 0,
      skipReasons: {
        alreadyHadPbpAndShifts: 0,
        alreadyHadPbpOnly: 0,
        alreadyHadShiftTotalsOnly: 0,
        gamecenterFeedUnavailable: 0
      },
      maxGames: null,
      nextGameId: null,
      lastCompletedGameId: null,
      errors: [
        {
          gameId: -1 as any,
          date: "",
          stage: "list_games",
          message: "Method not allowed"
        }
      ],
      dependencyContract
    }));
  }

  const startDate = getParam(req, "startDate") ?? isoDateOnly(new Date().toISOString());
  const endDate = getParam(req, "endDate") ?? startDate;
  const fullRequestedRange = buildDateRange(startDate, endDate);
  if (fullRequestedRange.length === 0) {
    return res.status(400).json(withTiming({
      success: false,
      startDate,
      endDate,
      chunkDays: 0,
      resumeFromDate: null,
      nextStartDate: null,
      durationMs: formatDurationMsToMMSS(Date.now() - startedAt),
      timedOut: false,
      maxDurationMs: formatDurationMsToMMSS(0),
      gamesTotal: 0,
      gamesProcessed: 0,
      pbpGamesUpserted: 0,
      pbpPlaysUpserted: 0,
      shiftRowsUpserted: 0,
      rowsUpserted: 0,
      failedRows: 0,
      skipped: 0,
      skipReasons: {
        alreadyHadPbpAndShifts: 0,
        alreadyHadPbpOnly: 0,
        alreadyHadShiftTotalsOnly: 0,
        gamecenterFeedUnavailable: 0
      },
      maxGames: null,
      nextGameId: null,
      lastCompletedGameId: null,
      errors: [
        {
          gameId: -1 as any,
          date: "",
          stage: "list_games",
          message: "Invalid startDate/endDate range"
        }
      ],
      dependencyContract
    }));
  }
  const chunkDays = parseChunkDays(getParam(req, "chunkDays") ?? null);
  const resumeFromDate = getParam(req, "resumeFromDate")?.slice(0, 10) ?? null;
  const force = parseQueryBoolean(getParam(req, "force")) ?? false;
  const debug = parseQueryBoolean(getParam(req, "debug")) ?? false;
  const debugLimit = Number(getParam(req, "debugLimit") ?? 50);
  const explicitMaxGames = parseQueryPositiveInt(getParam(req, "maxGames"));
  const maxGames =
    explicitMaxGames ??
    (chunkDays === 0 && resumeFromDate == null && !force ? 6 : null);
  const bypassMaxDuration = parseBooleanParam(
    getParam(req, "bypassMaxDuration") ?? null
  );
  const maxDurationMs = Number(getParam(req, "maxDurationMs") ?? 270_000); // safety: 4.5 minutes
  const budgetMs =
    Number.isFinite(maxDurationMs) && maxDurationMs > 0 ? maxDurationMs : 270_000;
  const deadlineMs = bypassMaxDuration ? Number.POSITIVE_INFINITY : startedAt + budgetMs;

  const effectiveStartDate =
    resumeFromDate && resumeFromDate >= startDate && resumeFromDate <= endDate
      ? resumeFromDate
      : startDate;
  const fullRangeDates = buildDateRange(effectiveStartDate, endDate);
  const limitedRangeDates =
    chunkDays > 0 ? fullRangeDates.slice(0, chunkDays) : fullRangeDates;
  const effectiveEndDate =
    limitedRangeDates[limitedRangeDates.length - 1] ?? effectiveStartDate;
  const chunkNextStartDate =
    chunkDays > 0 && fullRangeDates.length > limitedRangeDates.length
      ? fullRangeDates[limitedRangeDates.length] ?? null
      : null;

  const allGames = await listGamesInRange(effectiveStartDate, effectiveEndDate);
  const games =
    typeof maxGames === "number" && maxGames > 0
      ? allGames.slice(0, maxGames)
      : allGames;
  const nextGameId =
    typeof maxGames === "number" &&
    maxGames > 0 &&
    allGames.length > games.length
      ? allGames[games.length]?.id ?? null
      : null;

  const result: Result = {
    success: true,
    startDate: effectiveStartDate,
    endDate: effectiveEndDate,
    chunkDays,
    resumeFromDate,
    nextStartDate: chunkNextStartDate,
    durationMs: formatDurationMsToMMSS(0),
    timedOut: false,
    maxDurationMs: bypassMaxDuration
      ? "bypassed"
      : formatDurationMsToMMSS(budgetMs),
    gamesTotal: allGames.length,
    gamesProcessed: 0,
    pbpGamesUpserted: 0,
    pbpPlaysUpserted: 0,
    shiftRowsUpserted: 0,
    rowsUpserted: 0,
    failedRows: 0,
    skipped: 0,
    skipReasons: {
      alreadyHadPbpAndShifts: 0,
      alreadyHadPbpOnly: 0,
      alreadyHadShiftTotalsOnly: 0,
      gamecenterFeedUnavailable: 0
    },
    maxGames,
    nextGameId,
    lastCompletedGameId: null,
    ...(debug
      ? {
          debug: {
            sampled: []
          }
        }
      : {}),
    errors: [],
    dependencyContract
  };

  for (const g of games) {
    if (Date.now() > deadlineMs) {
      result.success = false;
      result.timedOut = true;
      result.nextStartDate = g.date;
      result.nextGameId = g.id;
      break;
    }
    let stage:
      | "precheck_pbp"
      | "precheck_shifts"
      | "fetch_pbp"
      | "upsert_pbp"
      | "upsert_shifts" = "precheck_pbp";
    try {
      const gameId = g.id;
      stage = "precheck_pbp";
      const pbpExists = force ? false : await hasPbp(gameId);
      stage = "precheck_shifts";
      const shiftsExist = force ? false : await hasShiftTotals(gameId);

      if (pbpExists && shiftsExist) {
        result.skipped += 1;
        result.skipReasons.alreadyHadPbpAndShifts += 1;
        if (
          debug &&
          result.debug &&
          result.debug.sampled.length < (Number.isFinite(debugLimit) ? debugLimit : 50)
        ) {
          result.debug.sampled.push({
            gameId,
            date: g.date,
            pbpExists,
            shiftTotalsExist: shiftsExist,
            action: "skipped"
          });
        }
        continue;
      }

      if (pbpExists && !shiftsExist) result.skipReasons.alreadyHadPbpOnly += 1;
      if (!pbpExists && shiftsExist) result.skipReasons.alreadyHadShiftTotalsOnly += 1;

      let sharedPbp: Awaited<ReturnType<typeof fetchPbpGame>> | null = null;
      let pbpPlaysUpserted = 0;
      if (!pbpExists || !shiftsExist) {
        stage = "fetch_pbp";
        sharedPbp = await fetchPbpGame(gameId);
      }

      if (!pbpExists && sharedPbp) {
        stage = "upsert_pbp";
        const up = await upsertPbpGameAndPlays(sharedPbp);
        result.pbpGamesUpserted += 1;
        pbpPlaysUpserted = up.playsUpserted;
        result.pbpPlaysUpserted += pbpPlaysUpserted;
        result.rowsUpserted += 1 + pbpPlaysUpserted;
      }

      if (!shiftsExist) {
        stage = "upsert_shifts";
        const up = sharedPbp
          ? await upsertShiftTotalsForGameFromPbp(gameId, sharedPbp)
          : await upsertShiftTotalsForGame(gameId);
        result.shiftRowsUpserted += up.rowsUpserted;
        result.rowsUpserted += up.rowsUpserted;
      }

      result.gamesProcessed += 1;
      result.lastCompletedGameId = gameId;

      if (
        debug &&
        result.debug &&
        result.debug.sampled.length < (Number.isFinite(debugLimit) ? debugLimit : 50)
      ) {
        result.debug.sampled.push({
          gameId,
          date: g.date,
          pbpExists,
          shiftTotalsExist: shiftsExist,
          action: "ingested"
        });
      }
    } catch (e) {
      if (stage === "fetch_pbp" && isUnavailableGamecenterFeedError(e)) {
        result.skipped += 1;
        result.skipReasons.gamecenterFeedUnavailable += 1;
        result.lastCompletedGameId = g.id;
        if (
          debug &&
          result.debug &&
          result.debug.sampled.length < (Number.isFinite(debugLimit) ? debugLimit : 50)
        ) {
          result.debug.sampled.push({
            gameId: g.id,
            date: g.date,
            pbpExists: false,
            shiftTotalsExist: false,
            action: "skipped"
          });
        }
        continue;
      }

      result.success = false;
      result.errors.push({
        gameId: g.id,
        date: g.date,
        stage,
        message: (e as any)?.message ?? String(e)
      });
      result.failedRows = result.errors.length;
      if (result.nextGameId == null) {
        result.nextGameId = g.id;
      }
    }
  }

  result.failedRows = result.errors.length;
  result.durationMs = formatDurationMsToMMSS(Date.now() - startedAt);
  return res.status(200).json(withTiming(result));
}

export default withCronJobAudit(handler, {
  jobName: "ingest-projection-inputs"
});
