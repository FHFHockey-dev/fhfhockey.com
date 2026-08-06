import type { NextApiResponse } from "next";

import playerForecastAdminOnly from "utils/playerForecastAdminOnlyMiddleware";
import { settlePlayerForecasts } from "lib/player-forecasts/settlement";

export default playerForecastAdminOnly(async (req: any, res: NextApiResponse) => {
  if (req.method !== "GET" && req.method !== "POST") {
    res.setHeader("Allow", "GET, POST");
    return res.status(405).json({ success: false, message: "Method not allowed." });
  }
  try {
    const result = await settlePlayerForecasts({ supabase: req.supabase });
    return res.json({ success: true, researchGate: "approved", ...result });
  } catch {
    return res.status(500).json({ success: false, message: "Settlement failed." });
  }
});
