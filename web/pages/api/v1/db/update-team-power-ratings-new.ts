import { withCronJobAudit } from "lib/cron/withCronJobAudit";
import type { NextApiRequest, NextApiResponse } from "next";

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
    error: "Alternate team power ratings writer has been disabled.",
    route: "/api/v1/db/update-team-power-ratings-new",
    targetTable: "team_power_ratings_daily__new",
    disposition: "DO NOT RUN",
    replacementRoute: "/api/v1/db/update-team-power-ratings",
    canonicalTable: "team_power_ratings_daily",
    warning:
      "Use the canonical team power ratings writer instead. The __new table path is quarantined and no longer supported."
  });
}

export default withCronJobAudit(handler);
