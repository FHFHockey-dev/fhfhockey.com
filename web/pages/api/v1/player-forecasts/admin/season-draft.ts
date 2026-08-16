import type { NextApiResponse } from "next";

import { cloneSeasonDraft } from "lib/fantasy-projections/admin";
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
    const sourceRunId = typeof req.body?.sourceRunId === "string" ? req.body.sourceRunId : "";
    if (!sourceRunId) {
      return res.status(400).json({ success: false, message: "sourceRunId is required." });
    }
    try {
      return res.json({ success: true, run: await cloneSeasonDraft(req.supabase, sourceRunId) });
    } catch (error) {
      return res.status(400).json({ success: false, message: playerForecastErrorMessage(error) });
    }
  },
);
