import type { NextApiResponse } from "next";

import { playerForecastRuntimeBoundary } from "lib/player-forecasts/runtimeSafety";
import adminOnly from "utils/adminOnlyMiddleware";

type Handler = (req: any, res: NextApiResponse) => Promise<any>;

export default function playerForecastAdminOnly(handler: Handler): Handler {
  return adminOnly(async (req: any, res: NextApiResponse) => {
    const boundary = playerForecastRuntimeBoundary();
    if (!boundary.allowed) {
      return res.status(503).json({
        success: false,
        code: "PLAYER_FORECAST_LOCAL_DATABASE_REQUIRED",
        message: boundary.message,
        databaseTarget: boundary.databaseTarget,
      });
    }
    return handler(req, res);
  });
}
