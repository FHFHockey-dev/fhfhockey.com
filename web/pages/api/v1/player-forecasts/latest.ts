import type { NextApiResponse } from "next";

import { loadPlayerForecastDashboard } from "lib/player-forecasts/dashboard";
import { playerForecastErrorMessage } from "lib/player-forecasts/runtimeSafety";
import playerForecastAdminOnly from "utils/playerForecastAdminOnlyMiddleware";

function numberValue(value: string | string[] | undefined): number | null {
  const parsed = Number(Array.isArray(value) ? value[0] : value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

export default playerForecastAdminOnly(async (req: any, res: NextApiResponse) => {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ success: false, message: "Method not allowed." });
  }
  try {
    const payload = await loadPlayerForecastDashboard({
      supabase: req.supabase,
      filters: {
        playerId: numberValue(req.query.playerId),
        gameId: numberValue(req.query.gameId),
        targetKey: typeof req.query.targetKey === "string" ? req.query.targetKey : null,
      },
    });
    const latest = new Map<string, (typeof payload.revisions)[number]>();
    for (const revision of payload.revisions) {
      const key = [
        revision.gameId,
        revision.playerId,
        revision.targetKey,
        revision.conditioning,
        revision.artifactChecksum ?? revision.modelVersion ?? "unversioned",
      ].join(":");
      const prior = latest.get(key);
      if (!prior || revision.issuedAt > prior.issuedAt) latest.set(key, revision);
    }
    return res.json({
      success: true,
      systemKey: payload.systemKey,
      researchGate: payload.researchGate,
      forecasts: Array.from(latest.values()),
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: playerForecastErrorMessage(error) });
  }
});
