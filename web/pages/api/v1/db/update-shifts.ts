import type { NextApiRequest, NextApiResponse } from "next";
import { withCronJobAudit } from "lib/cron/withCronJobAudit";
import adminOnly from "utils/adminOnlyMiddleware";
import { delegatedShiftChartsHandler } from "./shift-charts";

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === "GET") {
    req.method = "POST";
  }

  return delegatedShiftChartsHandler(req, res);
}

export default withCronJobAudit(adminOnly(handler), {
  jobName: "update-shift-charts",
});
