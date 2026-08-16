import type { NextApiResponse } from "next";

import { validateSeasonRun } from "lib/fantasy-projections/admin";
import { playerForecastErrorMessage } from "lib/player-forecasts/runtimeSafety";
import playerForecastSeasonEditorOnly, {
  type PlayerForecastSeasonEditorRequest,
} from "utils/playerForecastSeasonEditorOnlyMiddleware";

export default playerForecastSeasonEditorOnly(
  async (req: PlayerForecastSeasonEditorRequest, res: NextApiResponse) => {
    if (req.method !== "POST") {
      res.setHeader("Allow", "POST");
      return res.status(405).json({ success: false, message: "Method not allowed." });
    }
    const runId = typeof req.body?.runId === "string" ? req.body.runId : "";
    if (!runId) {
      return res.status(400).json({ success: false, message: "runId is required." });
    }
    try {
      const result = await validateSeasonRun(req.supabase, runId);
      return res.status(result.valid ? 200 : 409).json({ success: result.valid, ...result });
    } catch (error) {
      return res.status(400).json({ success: false, message: playerForecastErrorMessage(error) });
    }
  },
);
