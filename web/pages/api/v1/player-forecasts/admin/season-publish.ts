import type { NextApiResponse } from "next";

import { publishSeasonRun } from "lib/fantasy-projections/admin";
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
    const label = typeof req.body?.label === "string" ? req.body.label.trim() : "";
    const reason = typeof req.body?.reason === "string" ? req.body.reason.trim() : "";
    if (!runId || !label || !reason) {
      return res.status(400).json({ success: false, message: "runId, label, and reason are required." });
    }
    try {
      const release = await publishSeasonRun({
        supabase: req.supabase,
        editorUserId: req.editorUserId,
        runId,
        label,
        reason,
      });
      return res.json({ success: true, release });
    } catch (error) {
      return res.status(409).json({ success: false, message: playerForecastErrorMessage(error) });
    }
  },
);
