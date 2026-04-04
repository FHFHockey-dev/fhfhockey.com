import { withCronJobAudit } from "lib/cron/withCronJobAudit";
import type { NextApiRequest, NextApiResponse } from "next";

/**
 * Query params:
 * - none
 *
 * Cron-safe static URL:
 * - /api/v1/db/update-power-rankings
 */

async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST" && req.method !== "GET") {
    res.setHeader("Allow", ["POST", "GET"]);
    return res.status(405).json({ error: "Method not allowed" });
  }

  return res.status(410).json({
    success: false,
    error: "Legacy power-rankings loader has been disabled.",
    route: "/api/v1/db/update-power-rankings",
    disposition: "DO NOT RUN",
    retentionReason:
      "Retained as a 410 quarantine stub until cron-source, failed-job inventories, and benchmark artifacts stop referencing this legacy route.",
    legacySurface: true,
    legacyLoader: "lib/supabase/Upserts/fetchPowerRankings.js",
    canonicalStatus: "no supported operator route",
    canonicalDataset: "power_rankings",
    warning:
      "This legacy JS loader is quarantined and has no canonical operator status in the rolling-to-FORGE pipeline."
  });
}

export default withCronJobAudit(handler);
