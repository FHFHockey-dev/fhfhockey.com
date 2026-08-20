import type { NextApiResponse } from "next";

import { resolveSeasonRosterConflict } from "lib/fantasy-projections/admin";
import { refreshSeasonRosterIntegrity } from "lib/fantasy-projections/rosterReconciliation";
import { playerForecastErrorMessage } from "lib/player-forecasts/runtimeSafety";
import playerForecastSeasonEditorOnly, {
  type PlayerForecastSeasonEditorRequest,
} from "utils/playerForecastSeasonEditorOnlyMiddleware";

const ACTIONS = new Set([
  "select_team",
  "mark_unsigned",
  "retain_current",
  "exclude_evidence",
]);

export default playerForecastSeasonEditorOnly(
  async (req: PlayerForecastSeasonEditorRequest, res: NextApiResponse) => {
    if (req.method !== "POST") {
      res.setHeader("Allow", "POST");
      return res.status(405).json({ success: false, message: "Method not allowed." });
    }
    const conflictId = String(req.body?.conflictId ?? "").trim();
    const action = String(req.body?.action ?? "").trim();
    if (!conflictId || !ACTIONS.has(action)) {
      return res.status(400).json({
        success: false,
        message: "A conflict id and supported resolution action are required.",
      });
    }
    try {
      const resolution = await resolveSeasonRosterConflict({
        supabase: req.supabase,
        editorUserId: req.editorUserId,
        conflictId,
        action: action as
          | "select_team"
          | "mark_unsigned"
          | "retain_current"
          | "exclude_evidence",
        organizationTeamId:
          req.body?.organizationTeamId == null
            ? null
            : Number(req.body.organizationTeamId),
        rosterStatus: req.body?.rosterStatus,
        reason: String(req.body?.reason ?? ""),
      });
      const reconciliation = await refreshSeasonRosterIntegrity({
        supabase: req.supabase,
        landingBatchSize: 1,
      });
      return res.json({ success: true, resolution, reconciliation });
    } catch (error) {
      return res.status(400).json({
        success: false,
        message: playerForecastErrorMessage(error),
      });
    }
  },
);

