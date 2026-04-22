import type { NextApiRequest, NextApiResponse } from "next";

import { withCronJobAudit } from "lib/cron/withCronJobAudit";

import { runNhlEdgeStatsSnapshot } from "./update-nhl-edge-stats";

async function handler(req: NextApiRequest, res: NextApiResponse) {
  return runNhlEdgeStatsSnapshot(req, res, {
    target: "team-detail"
  });
}

export default withCronJobAudit(handler, {
  jobName: "update-nhl-edge-teams"
});
