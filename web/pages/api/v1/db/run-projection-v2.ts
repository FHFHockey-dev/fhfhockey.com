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
 * 2. `startDate` / `endDate` (optional)
 *    - Description: Run projections for an inclusive date range in `YYYY-MM-DD` format.
 *    - If only one is provided, it will be treated as a single-date run.
 *    - Example: `?startDate=2025-10-07&endDate=2025-10-14`
 *
 * 3. `maxDurationMs` (optional)
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
 * - To run projections for a date range:
 *   `POST /api/v1/db/run-projection-v2?startDate=2025-10-07&endDate=2025-10-14`
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
      results?: Array<{
        asOfDate: string;
        runId: string;
        gamesProcessed: number;
        playerRowsUpserted: number;
        teamRowsUpserted: number;
        goalieRowsUpserted: number;
        timedOut: boolean;
      }>;
      processedDates?: string[];
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
      results?: Array<{
        asOfDate: string;
        runId: string;
        gamesProcessed: number;
        playerRowsUpserted: number;
        teamRowsUpserted: number;
        goalieRowsUpserted: number;
        timedOut: boolean;
      }>;
      processedDates?: string[];
    };

function getParam(req: NextApiRequest, key: string): string | null {
  const v = req.query[key];
  if (typeof v === "string" && v.trim()) return v.trim();
  return null;
}

function isoDateOnly(d: string): string {
  return d.slice(0, 10);
}

function parseDateParam(value: string | null): string | null {
  return value && value.trim() ? value.trim().slice(0, 10) : null;
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

  const dateParam = parseDateParam(getParam(req, "date"));
  const startDateParam =
    parseDateParam(getParam(req, "startDate")) ??
    parseDateParam(getParam(req, "endDate")) ??
    parseDateParam(getParam(req, "endPoint"));
  const endDateParam =
    parseDateParam(getParam(req, "endDate")) ??
    parseDateParam(getParam(req, "endPoint")) ??
    parseDateParam(getParam(req, "startDate"));
  const rangeDates =
    startDateParam && endDateParam
      ? buildDateRange(startDateParam, endDateParam)
      : [];
  if (
    (startDateParam || endDateParam) &&
    (rangeDates.length === 0 ||
      (startDateParam && endDateParam && startDateParam > endDateParam))
  ) {
    return res.status(400).json({
      success: false,
      asOfDate: "",
      timedOut: false,
      maxDurationMs: formatDurationMsToMMSS(0),
      durationMs: formatDurationMsToMMSS(Date.now() - startedAt),
      error: "Invalid startDate/endDate range"
    });
  }
  const asOfDate = dateParam ?? isoDateOnly(new Date().toISOString());
  const maxDurationMs = Number(getParam(req, "maxDurationMs") ?? 270_000);
  const budgetMs = Number.isFinite(maxDurationMs) ? maxDurationMs : 270_000;
  const deadlineMs = startedAt + budgetMs;

  try {
    if (rangeDates.length > 0) {
      const results: Array<{
        asOfDate: string;
        runId: string;
        gamesProcessed: number;
        playerRowsUpserted: number;
        teamRowsUpserted: number;
        goalieRowsUpserted: number;
        timedOut: boolean;
      }> = [];
      for (const date of rangeDates) {
        if (Date.now() > deadlineMs) {
          return res.status(200).json({
            success: false,
            asOfDate: date,
            timedOut: true,
            maxDurationMs: formatDurationMsToMMSS(budgetMs),
            durationMs: formatDurationMsToMMSS(Date.now() - startedAt),
            error: "Timed out",
            results,
            processedDates: results.map((r) => r.asOfDate)
          });
        }
        const out = await runProjectionV2ForDate(date, { deadlineMs });
        results.push({
          asOfDate: date,
          runId: out.runId,
          gamesProcessed: out.gamesProcessed,
          playerRowsUpserted: out.playerRowsUpserted,
          teamRowsUpserted: out.teamRowsUpserted,
          goalieRowsUpserted: out.goalieRowsUpserted,
          timedOut: out.timedOut
        });
      }
      const last = results[results.length - 1];
      return res.status(200).json({
        success: true,
        asOfDate: last?.asOfDate ?? asOfDate,
        timedOut: false,
        maxDurationMs: formatDurationMsToMMSS(budgetMs),
        durationMs: formatDurationMsToMMSS(Date.now() - startedAt),
        runId: last?.runId ?? "",
        gamesProcessed: last?.gamesProcessed ?? 0,
        playerRowsUpserted: last?.playerRowsUpserted ?? 0,
        teamRowsUpserted: last?.teamRowsUpserted ?? 0,
        goalieRowsUpserted: last?.goalieRowsUpserted ?? 0,
        results,
        processedDates: results.map((r) => r.asOfDate)
      });
    }

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
