import type { NextApiRequest, NextApiResponse } from "next";

import supabase from "lib/supabase";
import { getPlayerSustainabilityPayload } from "lib/sustainability/read";

const WINDOWS = new Set([3, 5, 10, 25, 50]);
const HORIZONS = new Set([5, 10]);

function first(value: string | string[] | undefined): string | null {
  return Array.isArray(value) ? value[0] ?? null : value ?? null;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ success: false, message: "Method not allowed" });
  }
  const playerId = Number(first(req.query.playerId));
  const window = Number(first(req.query.window) ?? 10);
  const horizon = Number(first(req.query.horizon) ?? 5);
  if (!Number.isInteger(playerId) || playerId <= 0) {
    return res.status(400).json({ success: false, message: "playerId must be a positive integer" });
  }
  if (!WINDOWS.has(window) || !HORIZONS.has(horizon)) {
    return res.status(400).json({
      success: false,
      message: "window must be 3/5/10/25/50 and horizon must be 5/10"
    });
  }

  try {
    const payload = await getPlayerSustainabilityPayload({
      client: supabase,
      playerId,
      window,
      horizon
    });
    if (!payload) {
      return res.status(404).json({ success: false, message: "No sustainability snapshot found" });
    }
    return res.status(200).json({ success: true, ...payload });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : String(error)
    });
  }
}
