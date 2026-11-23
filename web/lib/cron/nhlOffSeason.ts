import type { NextApiRequest, NextApiResponse } from "next";
import type { SupabaseClient } from "@supabase/supabase-js";
import serviceRoleClient from "lib/supabase/server";
import type { Database } from "lib/supabase/database-generated.types";

// Game-data crons pause between seasons: from a few days after the last game
// (so the final's data still lands) until the next season's first scheduled
// game, preseason included. Before the NHL publishes the next schedule there is
// no next season to resume at, so jobs stay paused until update-seasons and
// update-games (which keep running) record it.
export const NHL_OFF_SEASON_GRACE_DAYS = 3;
const WINDOW_CACHE_MS = 10 * 60 * 1000;
// The season lookup is five small reads. A database stall must not hold a job
// in this gate (2026-11-23 10:20Z: 159 s, then Vercel's 240 s kill): past this
// bound the window is unknown and the job runs, as on any lookup failure.
export const NHL_SEASON_WINDOW_TIMEOUT_MS = 5_000;
const NHL_TIME_ZONE = "America/New_York";

export type NhlSeasonSpan = {
  seasonId: number;
  startDate: string;
  endDate: string;
  firstGameDate: string | null;
  lastGameDate: string | null;
};

export type NhlSeasonWindow =
  | { state: "in_season"; today: string; seasonId: number; activeFrom: string; activeUntil: string }
  | {
      state: "off_season";
      today: string;
      lastSeasonId: number | null;
      lastActiveUntil: string | null;
      nextSeasonId: number | null;
      resumesOn: string | null;
    }
  | { state: "unknown"; today: string; reason: string };

const DATE_PREFIX = /^(\d{4}-\d{2}-\d{2})/;

function calendarDate(value: string | null | undefined): string | null {
  const match = typeof value === "string" ? DATE_PREFIX.exec(value) : null;
  return match ? match[1] : null;
}

function addDays(date: string, days: number): string {
  const next = new Date(`${date}T00:00:00.000Z`);
  next.setUTCDate(next.getUTCDate() + days);
  return next.toISOString().slice(0, 10);
}

export function nhlCalendarDate(now: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: NHL_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

function activeSpan(season: NhlSeasonSpan) {
  const starts = [calendarDate(season.firstGameDate), calendarDate(season.startDate)]
    .filter((date): date is string => date != null)
    .sort();
  const ends = [calendarDate(season.lastGameDate), calendarDate(season.endDate)]
    .filter((date): date is string => date != null)
    .sort();
  if (!starts.length || !ends.length) return null;
  return {
    seasonId: season.seasonId,
    activeFrom: starts[0],
    activeUntil: addDays(ends[ends.length - 1], NHL_OFF_SEASON_GRACE_DAYS),
  };
}

export function resolveNhlSeasonWindow(
  seasons: NhlSeasonSpan[],
  now: Date = new Date(),
): NhlSeasonWindow {
  const today = nhlCalendarDate(now);
  const spans = seasons
    .map(activeSpan)
    .filter((span): span is NonNullable<typeof span> => span != null)
    .sort((a, b) => a.activeFrom.localeCompare(b.activeFrom));
  if (!spans.length) {
    return { state: "unknown", today, reason: "no_season_dates" };
  }

  const current = spans.find(
    (span) => span.activeFrom <= today && today <= span.activeUntil,
  );
  if (current) return { state: "in_season", today, ...current };

  const last = [...spans].reverse().find((span) => span.activeUntil < today);
  const next = spans.find((span) => span.activeFrom > today);
  return {
    state: "off_season",
    today,
    lastSeasonId: last?.seasonId ?? null,
    lastActiveUntil: last?.activeUntil ?? null,
    nextSeasonId: next?.seasonId ?? null,
    resumesOn: next?.activeFrom ?? null,
  };
}

async function gameDate(
  client: SupabaseClient<Database>,
  seasonId: number,
  ascending: boolean,
): Promise<string | null> {
  const { data, error } = await client
    .from("games")
    .select("date")
    .eq("seasonId", seasonId)
    .order("date", { ascending })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data?.date ?? null;
}

export async function loadNhlSeasonWindow(
  client: SupabaseClient<Database> = serviceRoleClient,
  now: Date = new Date(),
): Promise<NhlSeasonWindow> {
  try {
    // The two newest seasons cover both "current plus next" (once the next
    // schedule is published) and "current plus previous" (before then).
    const { data, error } = await client
      .from("seasons")
      .select("id,startDate,endDate")
      .order("id", { ascending: false })
      .limit(2);
    if (error) throw error;
    const spans = await Promise.all(
      (data ?? []).map(async (row) => ({
        seasonId: row.id,
        startDate: row.startDate,
        endDate: row.endDate,
        firstGameDate: await gameDate(client, row.id, true),
        lastGameDate: await gameDate(client, row.id, false),
      })),
    );
    return resolveNhlSeasonWindow(spans, now);
  } catch (error) {
    return { state: "unknown", today: nhlCalendarDate(now), reason: lookupErrorReason(error) };
  }
}

// A PostgrestError is a plain object, not an Error: String() of it is "[object Object]".
function lookupErrorReason(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (error && typeof error === "object") {
    const { message, code } = error as { message?: unknown; code?: unknown };
    if (typeof message === "string" && message) {
      return typeof code === "string" && code ? `${message} (${code})` : message;
    }
    try {
      return JSON.stringify(error);
    } catch {
      return "unreadable lookup error";
    }
  }
  return String(error);
}

async function boundedSeasonWindow(
  loadWindow: () => Promise<NhlSeasonWindow>,
  timeoutMs: number,
): Promise<NhlSeasonWindow> {
  const lookup = loadWindow();
  // An abandoned lookup may still settle; its result goes nowhere.
  lookup.catch(() => undefined);
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<NhlSeasonWindow>((resolve) => {
    timer = setTimeout(() => resolve({
      state: "unknown",
      today: nhlCalendarDate(new Date()),
      reason: `season window lookup timed out after ${timeoutMs} ms`,
    }), timeoutMs);
  });
  try {
    return await Promise.race([
      lookup.catch((error: unknown): NhlSeasonWindow => ({
        state: "unknown",
        today: nhlCalendarDate(new Date()),
        reason: lookupErrorReason(error),
      })),
      timeout,
    ]);
  } finally {
    clearTimeout(timer);
  }
}

let cachedWindow: { loadedAt: number; window: NhlSeasonWindow } | null = null;

async function cachedNhlSeasonWindow(): Promise<NhlSeasonWindow> {
  const nowMs = Date.now();
  if (cachedWindow && nowMs - cachedWindow.loadedAt < WINDOW_CACHE_MS) {
    return cachedWindow.window;
  }
  const window = await loadNhlSeasonWindow();
  // Keep a failed lookup out of the cache so the next run retries it.
  cachedWindow = window.state === "unknown" ? null : { loadedAt: nowMs, window };
  return window;
}

export function resetNhlSeasonWindowCache() {
  cachedWindow = null;
}

// Canonical cron classification: a route whose request passed through
// withNhlOffSeasonSkip writes NHL game data that pauses between seasons. The
// gate marks the response object it was handed, so an audit wrapper on either
// side of it (or around a handler that calls a gated worker) can record it
// without guessing from route names, imports or row counts. withCronJobAudit
// reads the same registered symbol (see cronClassificationOf there).
export const NHL_SEASONAL_GAME_DATA = "nhl_seasonal_game_data";
export type CronClassification = typeof NHL_SEASONAL_GAME_DATA;
export const CRON_CLASSIFICATION_KEY = Symbol.for("fhfh.cron.classification");
// When the request entered this gate, stamped on it before the season lookup.
// A route that budgets its own runtime counts from it, so a slow lookup is spent
// from that budget. adminOnly's cron path and withCronJobAudit await nothing
// before their handler, so behind them this is the request's arrival.
export const GATE_ENTERED_AT_KEY = Symbol.for("fhfh.cron.gateEnteredAt");

function ignoresOffSeason(req: NextApiRequest): boolean {
  const value = req.query?.ignoreOffSeason;
  const flag = Array.isArray(value) ? value[0] : value;
  return flag === "1" || flag === "true";
}

/**
 * Skips an NHL game-data cron between seasons with a 200 "skipped" receipt.
 * Add `ignoreOffSeason=true` to run anyway. When the season dates cannot be
 * read within `timeoutMs` (default NHL_SEASON_WINDOW_TIMEOUT_MS), the job runs
 * as before rather than being skipped on a guess.
 */
export function withNhlOffSeasonSkip<
  Req extends NextApiRequest,
  Res extends NextApiResponse,
>(
  handler: (req: Req, res: Res) => unknown,
  options: { loadWindow?: () => Promise<NhlSeasonWindow>; timeoutMs?: number } = {},
): (req: Req, res: Res) => Promise<unknown> {
  const loadWindow = options.loadWindow ?? cachedNhlSeasonWindow;
  const timeoutMs = options.timeoutMs ?? NHL_SEASON_WINDOW_TIMEOUT_MS;
  return async (req, res) => {
    (req as unknown as Record<symbol, number>)[GATE_ENTERED_AT_KEY] = Date.now();
    (res as unknown as Record<symbol, CronClassification>)[CRON_CLASSIFICATION_KEY] =
      NHL_SEASONAL_GAME_DATA;
    if (!ignoresOffSeason(req)) {
      const window = await boundedSeasonWindow(loadWindow, timeoutMs);
      if (window.state === "unknown") {
        console.warn("[nhl-off-season] season window unavailable; running job", {
          reason: window.reason,
        });
      } else if (window.state === "off_season") {
        const ended = window.lastSeasonId
          ? `Season ${window.lastSeasonId} ended (window closed ${window.lastActiveUntil}). `
          : "";
        const resumes = window.resumesOn
          ? `Jobs resume ${window.resumesOn} for season ${window.nextSeasonId}.`
          : "The next season's schedule is not published yet.";
        return res.status(200).json({
          success: true,
          skipped: true,
          outcome: "skipped",
          reason: "nhl_off_season",
          message: `Skipped: NHL off-season. ${ended}${resumes} Add ignoreOffSeason=true to run anyway.`,
          seasonWindow: window,
        });
      }
    }
    return handler(req, res);
  };
}
