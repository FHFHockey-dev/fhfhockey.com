import type { NextApiRequest, NextApiResponse } from "next";
import { withCronJobAudit } from "lib/cron/withCronJobAudit";
import { runProjectionV2ForDate } from "lib/projections/runProjectionV2";

type Result =
  | {
      success: true;
      runId: string;
      asOfDate: string;
      gamesProcessed: number;
      playerRowsUpserted: number;
      teamRowsUpserted: number;
      goalieRowsUpserted: number;
    }
  | { success: false; error: string };

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
    return res.status(405).json({ success: false, error: "Method not allowed" });
  }

  const asOfDate = getParam(req, "date") ?? isoDateOnly(new Date().toISOString());

  try {
    const out = await runProjectionV2ForDate(asOfDate);
    return res
      .status(200)
      .json({ success: true, asOfDate, durationMs: Date.now() - startedAt, ...out });
  } catch (e) {
    return res
      .status(500)
      .json({ success: false, error: (e as any)?.message ?? String(e) });
  }
}

export default withCronJobAudit(handler, { jobName: "run-projection-v2" });
