import type { NextApiResponse } from "next";

import { seedCanonicalPlayerForecastJobs } from "lib/player-forecasts/orchestration";
import { playerForecastErrorMessage } from "lib/player-forecasts/runtimeSafety";
import playerForecastAdminOnly from "utils/playerForecastAdminOnlyMiddleware";

export default playerForecastAdminOnly(async (req: any, res: NextApiResponse) => {
  if (req.method !== "GET" && req.method !== "POST") {
    res.setHeader("Allow", "GET, POST");
    return res.status(405).json({ success: false, message: "Method not allowed." });
  }
  try {
    const result = await seedCanonicalPlayerForecastJobs({ supabase: req.supabase });
    return res.json({ success: true, researchGate: "approved", ...result });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: playerForecastErrorMessage(error),
    });
  }
});
