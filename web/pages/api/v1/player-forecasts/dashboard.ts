import type { NextApiResponse } from "next";

import type { PlayerForecastConditioning } from "lib/player-forecasts/contracts";
import { loadPlayerForecastDashboard } from "lib/player-forecasts/dashboard";
import { playerForecastErrorMessage } from "lib/player-forecasts/runtimeSafety";
import playerForecastAdminOnly from "utils/playerForecastAdminOnlyMiddleware";

function value(input: string | string[] | undefined): string | null {
  return Array.isArray(input) ? input[0] ?? null : input ?? null;
}

function numberValue(input: string | string[] | undefined): number | null {
  const parsed = Number(value(input));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

export default playerForecastAdminOnly(async (req: any, res: NextApiResponse) => {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ success: false, message: "Method not allowed." });
  }
  try {
    return res.json(
      await loadPlayerForecastDashboard({
        supabase: req.supabase,
        filters: {
          playerId: numberValue(req.query.playerId),
          gameId: numberValue(req.query.gameId),
          targetKey: value(req.query.targetKey),
          conditioning: value(req.query.conditioning) as PlayerForecastConditioning | null,
        },
      }),
    );
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: playerForecastErrorMessage(error),
    });
  }
});
