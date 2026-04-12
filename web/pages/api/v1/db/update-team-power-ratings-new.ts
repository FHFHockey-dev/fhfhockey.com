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

  return res.status(200).json({
    success: true,
    operationStatus: "warning",
    message: "Alternate team power ratings writer remains disabled; no work was performed.",
    route: "/api/v1/db/update-team-power-ratings-new",
    targetTable: "team_power_ratings_daily__new",
    disposition: "DO NOT RUN",
    retentionReason:
      "Retained as a 410 quarantine stub until cron-source, inventory, and operator docs stop referencing this legacy route.",
    replacementRoute: "/api/v1/db/update-team-power-ratings",
    canonicalTable: "team_power_ratings_daily",
    warning:
      "Use the canonical team power ratings writer instead. The __new table path is quarantined and no longer supported."
  });
}

export default withCronJobAudit(handler);
