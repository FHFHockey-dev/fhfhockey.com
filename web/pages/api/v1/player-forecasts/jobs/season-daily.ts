import type { NextApiResponse } from "next";

import { collectSeasonProjectionReadiness } from "lib/fantasy-projections/readiness";
import {
  drainSeasonProjectionJobs,
  enqueueDailySeasonProjectionJobs,
} from "lib/fantasy-projections/seasonJobs";
import { playerForecastErrorMessage } from "lib/player-forecasts/runtimeSafety";
import playerForecastAdminOnly from "utils/playerForecastAdminOnlyMiddleware";

function first(value: string | string[] | undefined): string | null {
  return Array.isArray(value) ? value[0] ?? null : value ?? null;
}

export default playerForecastAdminOnly(async (req: any, res: NextApiResponse) => {
  if (req.method !== "GET" && req.method !== "POST") {
    res.setHeader("Allow", "GET, POST");
    return res.status(405).json({ success: false, message: "Method not allowed." });
  }
  const readiness = await collectSeasonProjectionReadiness({ supabase: req.supabase });
  const holdReasons: string[] = [];
  if (!readiness.schedule?.valid) holdReasons.push("schedule_incomplete");
  if ((readiness.playerPool?.pendingIdentityReviews ?? 0) > 0) holdReasons.push("player_pool_review");
  if (!readiness.rosterIntegrity?.healthy) holdReasons.push("roster_integrity");
  if (!readiness.artifact?.registered) holdReasons.push("artifact_missing");
  if (!readiness.queue?.healthy) holdReasons.push("dirty_queue");
  if (!readiness.settlement?.healthy) holdReasons.push("settlement_lag");
  if (!readiness.latestValidatedRun) holdReasons.push("validated_daily_run_missing");
  const dryRun = first(req.query.dryRun) !== "false" && req.body?.dryRun !== false;
  if (dryRun) {
    return res.json({
      success: true,
      dryRun: true,
      publicationHeld: true,
      holdReasons,
      lastGoodReleaseRetained: true,
      mutationPerformed: false,
    });
  }
  if (process.env.PLAYER_FORECAST_SEASON_INFERENCE_ENABLED !== "true") {
    return res.status(503).json({
      success: false,
      dryRun: false,
      code: "PLAYER_FORECAST_SEASON_HOSTED_INFERENCE_DISABLED",
      message: "Season inference is disabled; use the checksum-verified local import workflow.",
      publicationHeld: true,
      holdReasons: ["inference_disabled"],
      lastGoodReleaseRetained: true,
      mutationPerformed: false,
    });
  }
  const blockingHoldReasons = holdReasons.filter((reason) => reason !== "dirty_queue");
  if (blockingHoldReasons.length > 0) {
    return res.status(409).json({
      success: false,
      dryRun: false,
      code: "PLAYER_FORECAST_SEASON_DAILY_HELD",
      publicationHeld: true,
      holdReasons: blockingHoldReasons,
      lastGoodReleaseRetained: true,
      mutationPerformed: false,
    });
  }
  try {
    const seeded = await enqueueDailySeasonProjectionJobs({ supabase: req.supabase });
    const drained = await drainSeasonProjectionJobs({ supabase: req.supabase, limit: 8 });
    return res.json({
      success: drained.results.every((item) => !item.errorCode),
      dryRun: false,
      seeded,
      drained,
      publicationHeld: drained.results.some((item) => !item.published),
      holdReasons: Array.from(
        new Set(drained.results.flatMap((item) => item.heldReasons)),
      ),
      lastGoodReleaseRetained: drained.results.some((item) => !item.published),
      mutationPerformed: seeded.queued > 0 || drained.claimed > 0,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      dryRun: false,
      code: "PLAYER_FORECAST_SEASON_DAILY_FAILED",
      message: playerForecastErrorMessage(error),
      publicationHeld: true,
      holdReasons: ["daily_processing_failed"],
      lastGoodReleaseRetained: true,
      mutationPerformed: false,
    });
  }
});
