import type { NextApiRequest, NextApiResponse } from "next";

import supabase from "lib/supabase";
import { getUpcomingSustainabilityPayload } from "lib/sustainability/read";

function first(value: string | string[] | undefined): string | null {
  return Array.isArray(value) ? value[0] ?? null : value ?? null;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ success: false, message: "Method not allowed" });
  }
  const playerId = Number(first(req.query.playerId));
  const games = Number(first(req.query.games) ?? 5);
  if (!Number.isInteger(playerId) || playerId <= 0 || ![5, 10].includes(games)) {
    return res.status(400).json({
      success: false,
      message: "playerId must be positive and games must be 5 or 10"
    });
  }

  try {
    const payload = await getUpcomingSustainabilityPayload({
      client: supabase,
      playerId,
      games
    });
    if (!payload) {
      return res.status(404).json({ success: false, message: "No upcoming sustainability projections found" });
    }
    return res.status(200).json({ success: true, ...payload });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : String(error)
    });
  }
}
