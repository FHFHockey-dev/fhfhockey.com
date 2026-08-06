import type { NextApiResponse } from "next";

import { loadPlayerForecastDashboard } from "lib/player-forecasts/dashboard";
import { playerForecastErrorMessage } from "lib/player-forecasts/runtimeSafety";
import playerForecastAdminOnly from "utils/playerForecastAdminOnlyMiddleware";

export default playerForecastAdminOnly(async (req: any, res: NextApiResponse) => {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ success: false, message: "Method not allowed." });
  }
  try {
    const payload = await loadPlayerForecastDashboard({ supabase: req.supabase });
    return res.json({
      success: true,
      systemKey: payload.systemKey,
      researchGate: payload.researchGate,
      candles: payload.accountabilityCandles,
      runHealth: payload.runHealth,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: playerForecastErrorMessage(error) });
  }
});
