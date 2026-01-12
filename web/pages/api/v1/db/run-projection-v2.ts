/**
 * API Endpoint: /api/v1/db/run-projection-v2
 *
 * Description:
 * This endpoint executes the version 2 projection model for a specified "as of" date. It generates daily fantasy projections
 * for players, teams, and goalies based on the underlying data prepared by other systems. This is a core process for
 * generating the site's daily fantasy advice. The endpoint is designed to be run as a scheduled task (cron job) and
 * has built-in timeout handling to ensure it doesn't overrun its execution window.
 *
 * ---
 *
 * URL Query Parameters:
 *
 * 1. `date` (optional)
 *    - Description: The "as of" date for which to run the projections, in `YYYY-MM-DD` format. This determines the set
 *      of games and player statuses to consider.
 *    - If omitted, the system defaults to the current date.
 *    - Example: `?date=2025-10-05`
 *
 * 2. `maxDurationMs` (optional)
 *    - Description: The maximum allowed execution time for the job in milliseconds.
 *    - Acts as a server-side timeout to prevent the process from running indefinitely.
 *    - Defaults to `270000` (4.5 minutes) if not specified.
 *    - Example: `?maxDurationMs=120000`
 *
 * ---
 *
 * Usage Examples:
 *
 * - To run projections for the current day:
 *   `GET /api/v1/db/run-projection-v2`
 *
 * - To run projections for a specific past or future date:
 *   `POST /api/v1/db/run-projection-v2?date=2025-11-20`
 *
 * - To run projections with a custom 2-minute timeout:
 *   `GET /api/v1/db/run-projection-v2?date=2025-12-01&maxDurationMs=120000`
 *
 * ---
 *
 * Notes:
 *
 * - Supports both `GET` and `POST` methods. Functionality is identical.
 * - A successful run will return a `runId` that can be used to trace the specific projection outputs in the database.
 * - If the process exceeds `maxDurationMs`, it will return a `timedOut: true` status in the response, along with any
 *   partial results that were completed before the timeout.
 * - Errors during execution will result in a `500 Internal Server Error` with a descriptive error message.
 */
import type { NextApiRequest, NextApiResponse } from "next";
import { withCronJobAudit } from "lib/cron/withCronJobAudit";
import { runProjectionV2ForDate } from "lib/projections/runProjectionV2";
import { formatDurationMsToMMSS } from "lib/formatDurationMmSs";

type Result =
  | {
      success: true;
      runId: string;
      asOfDate: string;
      gamesProcessed: number;
      playerRowsUpserted: number;
      teamRowsUpserted: number;
      goalieRowsUpserted: number;
      timedOut: false;
      maxDurationMs: string;
      durationMs: string;
    }
  | {
      success: false;
      asOfDate: string;
      timedOut: boolean;
      maxDurationMs: string;
      durationMs: string;
      runId?: string;
      gamesProcessed?: number;
      playerRowsUpserted?: number;
      teamRowsUpserted?: number;
      goalieRowsUpserted?: number;
      error: string;
    };

function getParam(req: NextApiRequest, key: string): string | null {
  const v = req.query[key];
  if (typeof v === "string" && v.trim()) return v.trim();
  return null;
}

function isoDateOnly(d: string): string {
  return d.slice(0, 10);
}

async function handler(req: NextApiRequest, res: NextApiResponse<Result>) {
  const startedAt = Date.now();
  if (req.method !== "POST" && req.method !== "GET") {
    res.setHeader("Allow", ["GET", "POST"]);
    return res
      .status(405)
      .json({
        success: false,
        asOfDate: "",
        timedOut: false,
        maxDurationMs: formatDurationMsToMMSS(0),
        durationMs: formatDurationMsToMMSS(Date.now() - startedAt),
        error: "Method not allowed"
      });
  }

  const asOfDate =
    getParam(req, "date") ?? isoDateOnly(new Date().toISOString());
  const maxDurationMs = Number(getParam(req, "maxDurationMs") ?? 270_000);
  const budgetMs = Number.isFinite(maxDurationMs) ? maxDurationMs : 270_000;
  const deadlineMs = startedAt + budgetMs;

  try {
    const out = await runProjectionV2ForDate(asOfDate, { deadlineMs });
    if (out.timedOut) {
      return res.status(200).json({
        success: false,
        asOfDate,
        timedOut: true,
        maxDurationMs: formatDurationMsToMMSS(budgetMs),
        durationMs: formatDurationMsToMMSS(Date.now() - startedAt),
        runId: out.runId,
        gamesProcessed: out.gamesProcessed,
        playerRowsUpserted: out.playerRowsUpserted,
        teamRowsUpserted: out.teamRowsUpserted,
        goalieRowsUpserted: out.goalieRowsUpserted,
        error: "Timed out"
      });
    }
    return res
      .status(200)
      .json({
        success: true,
        asOfDate,
        timedOut: false,
        maxDurationMs: formatDurationMsToMMSS(budgetMs),
        durationMs: formatDurationMsToMMSS(Date.now() - startedAt),
        runId: out.runId,
        gamesProcessed: out.gamesProcessed,
        playerRowsUpserted: out.playerRowsUpserted,
        teamRowsUpserted: out.teamRowsUpserted,
        goalieRowsUpserted: out.goalieRowsUpserted
      });
  } catch (e) {
    return res
      .status(500)
      .json({
        success: false,
        asOfDate,
        timedOut: false,
        maxDurationMs: formatDurationMsToMMSS(budgetMs),
        durationMs: formatDurationMsToMMSS(Date.now() - startedAt),
        error: (e as any)?.message ?? String(e)
      });
  }
}

export default withCronJobAudit(handler, { jobName: "run-projection-v2" });
