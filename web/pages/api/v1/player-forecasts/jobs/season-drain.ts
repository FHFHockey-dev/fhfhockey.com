import type { NextApiResponse } from "next";

import { collectSeasonProjectionReadiness } from "lib/fantasy-projections/readiness";
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
  return res.status(501).json({
    success: false,
    dryRun: false,
    code: "PLAYER_FORECAST_SEASON_ACTIVATION_NOT_APPROVED",
    message: "Non-dry-run queue processing remains activation-gated.",
    mutationPerformed: false,
  });
});
