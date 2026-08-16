import type { NextApiResponse } from "next";

import { enqueueSeasonRerun } from "lib/fantasy-projections/admin";
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
    const seasonId = Number(req.body?.seasonId);
    const reason = typeof req.body?.reason === "string" ? req.body.reason.trim() : "";
    if (!Number.isInteger(seasonId) || seasonId <= 0 || !reason) {
      return res.status(400).json({ success: false, message: "seasonId and reason are required." });
    }
    try {
      const job = await enqueueSeasonRerun({
        supabase: req.supabase,
        seasonId,
        teamId: req.body.teamId == null ? null : Number(req.body.teamId),
        fhfhPlayerId:
          req.body.fhfhPlayerId == null ? null : Number(req.body.fhfhPlayerId),
        reason,
      });
      return res.json({ success: true, job });
    } catch (error) {
      return res.status(400).json({ success: false, message: playerForecastErrorMessage(error) });
    }
  },
);
