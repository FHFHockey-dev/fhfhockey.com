import type { NextApiResponse } from "next";

import { rollbackSeasonRelease } from "lib/fantasy-projections/admin";
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
    const releaseId = typeof req.body?.releaseId === "string" ? req.body.releaseId : "";
    const reason = typeof req.body?.reason === "string" ? req.body.reason.trim() : "";
    if (!releaseId || !reason) {
      return res.status(400).json({ success: false, message: "releaseId and reason are required." });
    }
    try {
      const release = await rollbackSeasonRelease({
        supabase: req.supabase,
        editorUserId: req.editorUserId,
        releaseId,
        reason,
      });
      return res.json({ success: true, release });
    } catch (error) {
      return res.status(409).json({ success: false, message: playerForecastErrorMessage(error) });
    }
  },
);
