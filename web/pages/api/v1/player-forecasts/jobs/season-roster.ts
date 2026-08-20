import type { NextApiResponse } from "next";

import { FANTASY_PROJECTION_SEASON_ID } from "lib/fantasy-projections/contracts";
import { refreshSeasonRosterIntegrity } from "lib/fantasy-projections/rosterReconciliation";
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
  const landingBatchSize = Number(first(req.query.landingBatchSize) ?? 96);
  if (!Number.isInteger(landingBatchSize) || landingBatchSize < 1 || landingBatchSize > 250) {
    return res.status(400).json({
      success: false,
      message: "landingBatchSize must be an integer within [1,250].",
    });
  }
  if (dryRun) {
    return res.json({
      success: true,
      dryRun: true,
      mutationPerformed: false,
      seasonId: FANTASY_PROJECTION_SEASON_ID,
      plannedSources: [
        "official_roster",
        "player_landing",
        "processed_forecast_relevant_ifttt",
      ],
      landingBatchSize,
      note: "Roster omissions are never interpreted as player releases.",
    });
  }
  if (
    process.env.NODE_ENV === "production" &&
    process.env.PLAYER_FORECAST_ROSTER_REFRESH_ENABLED !== "true"
  ) {
    return res.status(503).json({
      success: false,
      dryRun: false,
      mutationPerformed: false,
      code: "PLAYER_FORECAST_ROSTER_REFRESH_ACTIVATION_NOT_APPROVED",
      message: "Hosted roster refresh remains disabled until activation is approved.",
    });
  }
  try {
    const result = await refreshSeasonRosterIntegrity({
      supabase: req.supabase,
      seasonId: FANTASY_PROJECTION_SEASON_ID,
      landingBatchSize,
    });
    return res.json({ ...result, dryRun: false, mutationPerformed: true });
  } catch (error) {
    return res.status(500).json({
      success: false,
      dryRun: false,
      mutationPerformed: false,
      message: playerForecastErrorMessage(error),
    });
  }
});
