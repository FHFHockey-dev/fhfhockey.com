import type { NextApiResponse } from "next";

import { drainPlayerForecastQueue } from "lib/player-forecasts/orchestration";
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
  const limit = Math.min(Math.max(Number(first(req.query.limit)) || 8, 1), 50);
  const dryRun = first(req.query.dryRun) === "true";
  try {
    const result = await drainPlayerForecastQueue({
      supabase: req.supabase,
      limit,
      dryRun,
    });
    return res.status(result.failed > 0 ? 207 : 200).json({ success: true, ...result });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: playerForecastErrorMessage(error),
    });
  }
});
