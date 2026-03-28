import { withCronJobAudit } from "lib/cron/withCronJobAudit";
import type { NextApiRequest, NextApiResponse } from "next";

const handler = async (req: NextApiRequest, res: NextApiResponse) => {
  if (req.method !== "POST" && req.method !== "GET") {
    res.setHeader("Allow", ["GET", "POST"]);
    return res.status(405).json({ error: "Method not allowed" });
  }

  return res.status(410).json({
    success: false,
    error: "Legacy goalie-start writer has been disabled.",
    route: "/api/v1/db/update-goalie-projections",
    disposition: "DO NOT RUN",
    replacementRoute: "/api/v1/db/update-goalie-projections-v2",
    warning:
      "Use the v2 goalie-start writer instead. This legacy RPC wrapper is quarantined and no longer supported."
  });
};

export default withCronJobAudit(handler);
