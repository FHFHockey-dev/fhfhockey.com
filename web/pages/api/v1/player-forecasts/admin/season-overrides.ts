import type { NextApiResponse } from "next";

import { createSeasonOverride } from "lib/fantasy-projections/admin";
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
    const scopeType = req.body?.scopeType;
    if (
      typeof req.body?.runId !== "string" ||
      !["player", "team"].includes(scopeType) ||
      typeof req.body?.fieldPath !== "string" ||
      typeof req.body?.reason !== "string"
    ) {
      return res.status(400).json({ success: false, message: "Invalid override payload." });
    }
    try {
      const override = await createSeasonOverride({
        supabase: req.supabase,
        editorUserId: req.editorUserId,
        runId: req.body.runId,
        scopeType,
        fhfhPlayerId: req.body.fhfhPlayerId == null ? null : Number(req.body.fhfhPlayerId),
        teamId: req.body.teamId == null ? null : Number(req.body.teamId),
        fieldPath: req.body.fieldPath,
        overrideValue: req.body.overrideValue,
        reason: req.body.reason,
        expiresAt: typeof req.body.expiresAt === "string" ? req.body.expiresAt : null,
        supersedesId:
          typeof req.body.supersedesId === "string" ? req.body.supersedesId : null,
      });
      return res.json({ success: true, override });
    } catch (error) {
      return res.status(400).json({ success: false, message: playerForecastErrorMessage(error) });
    }
  },
);
