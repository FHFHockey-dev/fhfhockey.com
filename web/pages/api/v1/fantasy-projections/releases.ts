import type { NextApiRequest, NextApiResponse } from "next";

import { loadFantasyProjectionReleases } from "lib/fantasy-projections/queries";
import { playerForecastErrorMessage, playerForecastRuntimeBoundary } from "lib/player-forecasts/runtimeSafety";
import { getServiceRoleClient } from "lib/supabase/server";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ success: false, message: "Method not allowed." });
  }
  const seasonId = Number(Array.isArray(req.query.seasonId) ? req.query.seasonId[0] : req.query.seasonId);
  if (!Number.isInteger(seasonId) || seasonId <= 0) {
    return res.status(400).json({ success: false, message: "A valid seasonId is required." });
  }
  const boundary = playerForecastRuntimeBoundary();
  if (!boundary.allowed) {
    return res.status(503).json({ success: false, message: boundary.message });
  }
  try {
    const payload = await loadFantasyProjectionReleases(getServiceRoleClient(), seasonId);
    // Active pointers change atomically. Keep this small metadata response fresh;
    // player/team payloads are separately cached under a release-specific URL.
    res.setHeader("Cache-Control", "no-store");
    return res.json({ success: true, ...payload });
  } catch (error) {
    return res.status(500).json({ success: false, message: playerForecastErrorMessage(error) });
  }
}
