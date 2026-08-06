import type { NextApiResponse } from "next";

import { loadPlayerForecastRestOfSeason } from "lib/player-forecasts/restOfSeason";
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
  const conditioning = value(req.query.conditioning);
  if (conditioning && !["conditional_playing", "unconditional"].includes(conditioning)) {
    return res.status(400).json({ success: false, message: "Invalid rest-of-season conditioning." });
  }
  try {
    return res.json({
      success: true,
      forecasts: await loadPlayerForecastRestOfSeason({
        supabase: req.supabase,
        playerId: numberValue(req.query.playerId),
        targetKey: value(req.query.targetKey),
        conditioning: conditioning as "conditional_playing" | "unconditional" | null,
      }),
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: playerForecastErrorMessage(error) });
  }
});
