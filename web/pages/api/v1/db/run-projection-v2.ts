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
