import type { NextApiResponse } from "next";

import { collectSeasonProjectionReadiness } from "lib/fantasy-projections/readiness";
import { drainSeasonProjectionJobs } from "lib/fantasy-projections/seasonJobs";
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
  const dryRun = first(req.query.dryRun) !== "false";
  const readiness = await collectSeasonProjectionReadiness({ supabase: req.supabase });
  if (dryRun) {
    return res.json({ success: true, dryRun: true, queue: readiness.queue, mutationPerformed: false });
  }
  if (process.env.PLAYER_FORECAST_SEASON_INFERENCE_ENABLED !== "true") {
    return res.status(503).json({
      success: false,
      dryRun: false,
      code: "PLAYER_FORECAST_SEASON_HOSTED_INFERENCE_DISABLED",
      message: "Hosted season inference is disabled; use the checksum-verified local import workflow.",
      mutationPerformed: false,
    });
  }
  const requestedLimit = Number(first(req.query.limit) ?? req.body?.limit ?? 8);
  try {
    const result = await drainSeasonProjectionJobs({
      supabase: req.supabase,
      limit: Number.isFinite(requestedLimit) ? requestedLimit : 8,
    });
    return res.json({
      success: result.results.every((item) => !item.errorCode),
      dryRun: false,
      ...result,
      mutationPerformed: result.claimed > 0,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      dryRun: false,
      code: "PLAYER_FORECAST_SEASON_DRAIN_FAILED",
      message: playerForecastErrorMessage(error),
      mutationPerformed: false,
    });
  }
});
