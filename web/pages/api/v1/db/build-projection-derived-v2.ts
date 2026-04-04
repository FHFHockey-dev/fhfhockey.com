/**
 * API Endpoint: /api/v1/db/build-projection-derived-v2
 *
 * Description:
 * This endpoint constructs derived projection data tables, specifically focusing on player, team, and goalie game-level strength metrics.
 * It processes game data within a specified date range to generate these analytics. The resulting tables are fundamental for more complex projection models.
 * This endpoint is designed for asynchronous execution, often triggered by a cron job, and includes safeguards against long execution times.
 *
 * ---
 *
 * URL Query Parameters:
 *
 * 1. `startDate` (optional)
 *    - Description: The start date for the data processing window, in `YYYY-MM-DD` format.
 *    - If omitted, the system defaults to the current date.
 *    - Example: `?startDate=2025-10-05`
 *
 * 2. `endDate` (optional)
 *    - Description: The end date for the data processing window, in `YYYY-MM-DD` format.
 *    - If omitted, it defaults to the `startDate`, effectively processing a single day.
 *    - Example: `?startDate=2025-10-05&endDate=2025-10-12`
 *
 * 3. `maxDurationMs` (optional)
 *    - Description: The maximum allowed execution time for the job in milliseconds. This acts as a server-side timeout.
 *    - If the process exceeds this duration, it will halt and return a timeout error.
 *    - Defaults to `270000` (4.5 minutes) if not specified.
 *    - Example: `?maxDurationMs=60000`
 *
 * ---
 *
 * Usage Examples:
 *
 * - To build data for a single day (today):
 *   `GET /api/v1/db/build-projection-derived-v2`
 *
 * - To build data for a specific day:
 *   `GET /api/v1/db/build-projection-derived-v2?startDate=2025-11-20`
 *
 * - To build data for a date range with a custom timeout:
 *   `POST /api/v1/db/build-projection-derived-v2?startDate=2025-11-01&endDate=2025-11-30&maxDurationMs=180000`
 *
 * ---
 *
 * Notes:
 *
 * - The endpoint supports both `GET` and `POST` methods. There is no difference in functionality between them.
 * - The process is broken down into three main parts: player strength, team strength, and goalie game logs. Each part may fail or succeed independently.
 * - The response payload will detail the outcome of each part, including the number of games processed and rows upserted.
 * - A `207 Multi-Status` response will be returned if any part of the process encounters an error.
 */
import type { NextApiRequest, NextApiResponse } from "next";
import { withCronJobAudit } from "lib/cron/withCronJobAudit";
import { formatDurationMsToMMSS } from "lib/formatDurationMmSs";
import { getRollingForgeStageDependencyContract } from "lib/rollingForgePipeline";

import {
  buildPlayerGameStrengthV2ForDateRange,
  buildTeamGameStrengthV2ForDateRange
} from "lib/projections/derived/buildStrengthTablesV2";
import { buildGoalieGameV2ForDateRange } from "lib/projections/derived/buildGoalieGameV2";

type Result = {
  success: boolean;
  startDate: string;
  endDate: string;
  chunkDays: number;
  maxDays: number | null;
  resumeFromDate: string | null;
  nextStartDate: string | null;
  processedDates: string[];
  durationMs: string;
  timedOut: boolean;
  maxDurationMs: string;
  player: { gamesProcessed: number; rowsUpserted: number };
  team: { gamesProcessed: number; rowsUpserted: number };
  goalie: { gamesProcessed: number; rowsUpserted: number };
  observability: {
    goalieRowsProcessed: number;
    dataQualityWarnings: Array<{ code: string; message: string; detail?: string }>;
  };
  errors: string[];
  dependencyContract?: ReturnType<typeof getRollingForgeStageDependencyContract>;
};

function getParam(req: NextApiRequest, key: string): string | undefined {
  const queryValue = req.query[key];
  if (typeof queryValue === "string" && queryValue.trim()) {
    return queryValue.trim();
  }

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

function parsePositiveInt(value: string | undefined): number | null {
  const parsed = Number(value ?? 0);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return Math.max(1, Math.floor(parsed));
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

async function handler(req: NextApiRequest, res: NextApiResponse<Result>) {
  const startedAt = Date.now();
  const dependencyContract = getRollingForgeStageDependencyContract(
    "projection_derived_build"
  );
  if (req.method !== "POST" && req.method !== "GET") {
    res.setHeader("Allow", ["GET", "POST"]);
    return res.status(405).json({
      success: false,
      startDate: "",
      endDate: "",
      chunkDays: 0,
      maxDays: null,
      resumeFromDate: null,
      nextStartDate: null,
      processedDates: [],
      durationMs: formatDurationMsToMMSS(Date.now() - startedAt),
      timedOut: false,
      maxDurationMs: formatDurationMsToMMSS(0),
      player: { gamesProcessed: 0, rowsUpserted: 0 },
      team: { gamesProcessed: 0, rowsUpserted: 0 },
      goalie: { gamesProcessed: 0, rowsUpserted: 0 },
      observability: {
        goalieRowsProcessed: 0,
        dataQualityWarnings: []
      },
      errors: ["Method not allowed"],
      dependencyContract
    });
  }

  const startDate =
    getParam(req, "startDate") ?? isoDateOnly(new Date().toISOString());
  const endDate = getParam(req, "endDate") ?? startDate;
  const chunkDays = parseChunkDays(getParam(req, "chunkDays") ?? null);
  const explicitMaxDays = parsePositiveInt(getParam(req, "maxDays"));
  const maxDays =
    explicitMaxDays ??
    (chunkDays === 0 && getParam(req, "resumeFromDate") == null ? 3 : null);
  const resumeFromDate = getParam(req, "resumeFromDate")?.slice(0, 10) ?? null;
  const bypassMaxDuration = parseBooleanParam(
    getParam(req, "bypassMaxDuration") ?? null
  );
  const maxDurationMs = Number(getParam(req, "maxDurationMs") ?? 270_000);
  const budgetMs =
    Number.isFinite(maxDurationMs) && maxDurationMs > 0 ? maxDurationMs : 270_000;
  const deadlineMs = bypassMaxDuration ? Number.POSITIVE_INFINITY : startedAt + budgetMs;
  const effectiveStartDate =
    resumeFromDate && resumeFromDate >= startDate && resumeFromDate <= endDate
      ? resumeFromDate
      : startDate;
  const fullRangeDates = buildDateRange(effectiveStartDate, endDate);
  const chunkLimitedRangeDates =
    chunkDays > 0 ? fullRangeDates.slice(0, chunkDays) : fullRangeDates;
  const limitedRangeDates =
    maxDays != null
      ? chunkLimitedRangeDates.slice(0, maxDays)
      : chunkLimitedRangeDates;
  const effectiveEndDate =
    limitedRangeDates[limitedRangeDates.length - 1] ?? effectiveStartDate;
  const chunkNextStartDate =
    fullRangeDates.length > limitedRangeDates.length
      ? fullRangeDates[limitedRangeDates.length] ?? null
      : null;

  const errors: string[] = [];
  let player = { gamesProcessed: 0, rowsUpserted: 0 };
  let team = { gamesProcessed: 0, rowsUpserted: 0 };
  let goalie = { gamesProcessed: 0, rowsUpserted: 0 };
  let timedOut = false;
  const processedDates: string[] = [];
  let nextStartDate = chunkNextStartDate;

  for (const date of limitedRangeDates) {
    if (Date.now() > deadlineMs) {
      timedOut = true;
      nextStartDate = date;
      break;
    }

    try {
      const playerResult = await buildPlayerGameStrengthV2ForDateRange({
        startDate: date,
        endDate: date,
        deadlineMs
      });
      player.gamesProcessed += playerResult.gamesProcessed;
      player.rowsUpserted += playerResult.rowsUpserted;
    } catch (e) {
      errors.push(`${date} player: ${(e as any)?.message ?? String(e)}`);
    }

    if (Date.now() > deadlineMs) {
      timedOut = true;
      nextStartDate = date;
      break;
    }

    try {
      const teamResult = await buildTeamGameStrengthV2ForDateRange({
        startDate: date,
        endDate: date,
        deadlineMs
      });
      team.gamesProcessed += teamResult.gamesProcessed;
      team.rowsUpserted += teamResult.rowsUpserted;
    } catch (e) {
      errors.push(`${date} team: ${(e as any)?.message ?? String(e)}`);
    }

    if (Date.now() > deadlineMs) {
      timedOut = true;
      nextStartDate = date;
      break;
    }

    try {
      const goalieResult = await buildGoalieGameV2ForDateRange({
        startDate: date,
        endDate: date,
        deadlineMs
      });
      goalie.gamesProcessed += goalieResult.gamesProcessed;
      goalie.rowsUpserted += goalieResult.rowsUpserted;
    } catch (e) {
      errors.push(`${date} goalie: ${(e as any)?.message ?? String(e)}`);
    }

    processedDates.push(date);

    if (Date.now() > deadlineMs) {
      timedOut = true;
      nextStartDate = limitedRangeDates[processedDates.length] ?? chunkNextStartDate;
      break;
    }
  }

  const dataQualityWarnings: Array<{
    code: string;
    message: string;
    detail?: string;
  }> = [];
  if (errors.some((e) => e.startsWith("goalie:"))) {
    dataQualityWarnings.push({
      code: "goalie_derived_failed",
      message: "Goalie derived build failed.",
      detail: errors.filter((e) => e.startsWith("goalie:")).join(" | ")
    });
  }
  if (
    goalie.gamesProcessed === 0 &&
    (player.gamesProcessed > 0 || team.gamesProcessed > 0)
  ) {
    dataQualityWarnings.push({
      code: "goalie_games_missing",
      message:
        "Player/team derived jobs processed games but goalie derived processed none."
    });
  }
  if (goalie.gamesProcessed > 0 && goalie.rowsUpserted === 0) {
    dataQualityWarnings.push({
      code: "goalie_rows_zero",
      message: "Goalie derived processed games but wrote zero rows."
    });
  }

  return res.status(errors.length ? 207 : 200).json({
    success: errors.length === 0 && !timedOut,
    startDate: effectiveStartDate,
    endDate: effectiveEndDate,
    chunkDays,
    maxDays,
    resumeFromDate,
    nextStartDate,
    processedDates,
    durationMs: formatDurationMsToMMSS(Date.now() - startedAt),
    timedOut,
    maxDurationMs: bypassMaxDuration
      ? "bypassed"
      : formatDurationMsToMMSS(budgetMs),
    player,
    team,
    goalie,
    observability: {
      goalieRowsProcessed: goalie.rowsUpserted,
      dataQualityWarnings
    },
    errors,
    dependencyContract
  });
}

export default withCronJobAudit(handler, {
  jobName: "build-projection-derived-v2"
});
