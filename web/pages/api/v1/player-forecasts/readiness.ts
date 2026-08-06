import type { NextApiResponse } from "next";

import { collectPlayerForecastReadiness } from "lib/player-forecasts/readiness";
import adminOnly from "utils/adminOnlyMiddleware";

export default adminOnly(async (req: any, res: NextApiResponse) => {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ success: false, message: "Method not allowed." });
  }
  try {
    return res.json(await collectPlayerForecastReadiness({ supabase: req.supabase }));
  } catch {
    return res.status(500).json({
      success: false,
      message: "Player Forecasts readiness could not be evaluated.",
    });
  }
});
