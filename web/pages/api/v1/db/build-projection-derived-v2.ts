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
  resumeFromDate: string | null;
  nextStartDate: string | null;
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
};

function getParam(req: NextApiRequest, key: string): string | null {
  const v = req.query[key];
  if (typeof v === "string" && v.trim()) return v.trim();
  return null;
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

async function handler(req: NextApiRequest, res: NextApiResponse<Result>) {
  const startedAt = Date.now();
  if (req.method !== "POST" && req.method !== "GET") {
    res.setHeader("Allow", ["GET", "POST"]);
    return res.status(405).json({
      success: false,
      startDate: "",
      endDate: "",
      chunkDays: 0,
      resumeFromDate: null,
      nextStartDate: null,
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
      errors: ["Method not allowed"]
    });
  }

  const startDate =
    getParam(req, "startDate") ?? isoDateOnly(new Date().toISOString());
  const endDate = getParam(req, "endDate") ?? startDate;
  const chunkDays = parseChunkDays(getParam(req, "chunkDays"));
  const resumeFromDate = getParam(req, "resumeFromDate")?.slice(0, 10) ?? null;
  const bypassMaxDuration = parseBooleanParam(
    getParam(req, "bypassMaxDuration")
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
  const limitedRangeDates =
    chunkDays > 0 ? fullRangeDates.slice(0, chunkDays) : fullRangeDates;
  const effectiveEndDate =
    limitedRangeDates[limitedRangeDates.length - 1] ?? effectiveStartDate;
  const chunkNextStartDate =
    chunkDays > 0 && fullRangeDates.length > limitedRangeDates.length
      ? fullRangeDates[limitedRangeDates.length] ?? null
      : null;

  const errors: string[] = [];
  let player = { gamesProcessed: 0, rowsUpserted: 0 };
  let team = { gamesProcessed: 0, rowsUpserted: 0 };
  let goalie = { gamesProcessed: 0, rowsUpserted: 0 };
  let timedOut = false;

  try {
    player = await buildPlayerGameStrengthV2ForDateRange({
      startDate: effectiveStartDate,
      endDate: effectiveEndDate,
      deadlineMs
    });
  } catch (e) {
    errors.push(`player: ${(e as any)?.message ?? String(e)}`);
  }

  try {
    team = await buildTeamGameStrengthV2ForDateRange({
      startDate: effectiveStartDate,
      endDate: effectiveEndDate,
      deadlineMs
    });
  } catch (e) {
    errors.push(`team: ${(e as any)?.message ?? String(e)}`);
  }

  try {
    goalie = await buildGoalieGameV2ForDateRange({
      startDate: effectiveStartDate,
      endDate: effectiveEndDate,
      deadlineMs
    });
  } catch (e) {
    errors.push(`goalie: ${(e as any)?.message ?? String(e)}`);
  }

  if (Date.now() > deadlineMs) timedOut = true;
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
    resumeFromDate,
    nextStartDate: timedOut ? effectiveStartDate : chunkNextStartDate,
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
    errors
  });
}

export default withCronJobAudit(handler, {
  jobName: "build-projection-derived-v2"
});
