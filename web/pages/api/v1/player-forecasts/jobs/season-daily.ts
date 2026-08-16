import type { NextApiResponse } from "next";

import { collectSeasonProjectionReadiness } from "lib/fantasy-projections/readiness";
import playerForecastAdminOnly from "utils/playerForecastAdminOnlyMiddleware";

export default playerForecastAdminOnly(async (req: any, res: NextApiResponse) => {
  if (req.method !== "GET" && req.method !== "POST") {
    res.setHeader("Allow", "GET, POST");
    return res.status(405).json({ success: false, message: "Method not allowed." });
  }
  const readiness = await collectSeasonProjectionReadiness({ supabase: req.supabase });
  const holdReasons: string[] = [];
  if (!readiness.schedule?.valid) holdReasons.push("schedule_incomplete");
  if ((readiness.playerPool?.pendingIdentityReviews ?? 0) > 0) holdReasons.push("player_pool_review");
  if (!readiness.artifact?.registered) holdReasons.push("artifact_missing");
  if (!readiness.queue?.healthy) holdReasons.push("dirty_queue");
  if (!readiness.settlement?.healthy) holdReasons.push("settlement_lag");
  if (!readiness.latestValidatedRun) holdReasons.push("validated_daily_run_missing");
  return res.json({
    success: true,
    dryRun: true,
    publicationHeld: true,
    holdReasons,
    lastGoodReleaseRetained: true,
    mutationPerformed: false,
  });
});
