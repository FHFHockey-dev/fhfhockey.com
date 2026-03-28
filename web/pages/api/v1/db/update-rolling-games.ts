import { withCronJobAudit } from "lib/cron/withCronJobAudit";
import type { NextApiRequest, NextApiResponse } from "next";

/**
 * Query params:
 * - date: optional "all" | "recent"; defaults to "all".
 *
 * Cron-safe static URLs:
 * - /api/v1/db/update-rolling-games
 * - /api/v1/db/update-rolling-games?date=recent
 */

async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST" && req.method !== "GET") {
    res.setHeader("Allow", ["POST", "GET"]);
    return res.status(405).json({ error: "Method not allowed" });
  }

  const mode = req.query.date === "recent" ? "recent" : "all";

  return res.status(410).json({
    success: false,
    error: "Legacy rolling-games loader has been disabled.",
    route: "/api/v1/db/update-rolling-games",
    requestedMode: mode,
    disposition: "DO NOT RUN",
    legacySurface: true,
    legacyLoader: "lib/supabase/Upserts/fetchRollingGames.js",
    replacementRoute: "/api/v1/db/update-rolling-player-averages",
    canonicalOutput: "rolling_player_game_metrics",
    warning:
      "Use the canonical rolling-player averages route instead. This legacy rolling-games wrapper is quarantined and has no canonical status."
  });
}

export default withCronJobAudit(handler);
