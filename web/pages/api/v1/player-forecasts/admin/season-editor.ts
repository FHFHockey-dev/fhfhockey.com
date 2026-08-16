import type { NextApiResponse } from "next";

import { loadSeasonEditorWorkspace } from "lib/fantasy-projections/admin";
import { playerForecastErrorMessage } from "lib/player-forecasts/runtimeSafety";
import playerForecastSeasonEditorOnly, {
  type PlayerForecastSeasonEditorRequest,
} from "utils/playerForecastSeasonEditorOnlyMiddleware";

export default playerForecastSeasonEditorOnly(
  async (req: PlayerForecastSeasonEditorRequest, res: NextApiResponse) => {
    if (req.method !== "GET") {
      res.setHeader("Allow", "GET");
      return res.status(405).json({ success: false, message: "Method not allowed." });
    }
    const rawSeasonId = Array.isArray(req.query.seasonId)
      ? req.query.seasonId[0]
      : req.query.seasonId;
    const seasonId = Number(rawSeasonId);
    if (!Number.isInteger(seasonId) || seasonId <= 0) {
      return res.status(400).json({ success: false, message: "A valid seasonId is required." });
    }
    const rawTeamId = Array.isArray(req.query.teamId)
      ? req.query.teamId[0]
      : req.query.teamId;
    const teamId = rawTeamId == null || rawTeamId === "" ? null : Number(rawTeamId);
    if (teamId != null && (!Number.isInteger(teamId) || teamId <= 0)) {
      return res.status(400).json({ success: false, message: "teamId must be a positive integer." });
    }
    try {
      return res.json(await loadSeasonEditorWorkspace(req.supabase, seasonId, teamId));
    } catch (error) {
      return res.status(500).json({ success: false, message: playerForecastErrorMessage(error) });
    }
  },
);
