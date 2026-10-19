import type { NextApiRequest, NextApiResponse } from "next";
import serviceRoleClient from "lib/supabase/server";
import { readYahooEligibilityCache } from "lib/rosterScheduleOptimizer/yahooEligibilityCache";

/** Public season-scoped Yahoo positions only; no provider/account calls or writes. */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") { res.setHeader("Allow", "GET"); return res.status(405).end(); }
  const seasonId = Number(req.query.seasonId);
  const season = String(seasonId);
  const playerIds = typeof req.query.playerIds === "string" ? req.query.playerIds.split(",") : [];
  if (!/^\d{8}$/.test(season) || Number(season.slice(4)) !== Number(season.slice(0, 4)) + 1
    || !playerIds.length || playerIds.length > 60 || new Set(playerIds).size !== playerIds.length
    || playerIds.some(id => !/^[1-9]\d{0,14}$/.test(id))) return res.status(400).json({ success: false, error: "Choose one NHL season and up to 60 unique canonical player IDs." });
  const receipt = await readYahooEligibilityCache(serviceRoleClient, seasonId, playerIds);
  // Cache clocks are rechecked by the consumer; keep intermediary caches out of the daily boundary.
  res.setHeader("Cache-Control", "no-store");
  return res.json({ success: true, receipt });
}
