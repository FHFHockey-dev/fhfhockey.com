import type { NextApiRequest, NextApiResponse } from "next";

import supabase from "lib/supabase/public-client";
import {
  ppShareServingEnabled,
  readPpTeamGameClocks,
  type PpTeamGameClock
} from "lib/ppShare/serving";

/**
 * Decision 152: the stored PP clock rows the client readers (PowerPlayCombos, LinemateMatrix, ShiftChart) gate on,
 * plus whether PP share serving is on (the server-side PP_SHARE_SERVING_ENABLED flag). With serving off it reads
 * nothing and the readers keep today's behaviour. Read-only; public data (pp_team_game_clock has a public read
 * policy).
 *   GET /api/v1/pp-share/team-game-clock?gameIds=2026020001,2026020002
 */
export const MAX_GAMES_PER_REQUEST = 60;

export type PpTeamGameClockResponse =
  | { servingEnabled: false; clocks: [] }
  | { servingEnabled: true; clocks: PpTeamGameClock[] }
  | { error: string };

export default async function handler(req: NextApiRequest, res: NextApiResponse<PpTeamGameClockResponse>) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed." });
  }
  const raw = Array.isArray(req.query.gameIds) ? req.query.gameIds.join(",") : req.query.gameIds ?? "";
  const gameIds = [...new Set(raw.split(",").map((value) => Number(value.trim())))];
  if (gameIds.length === 0 || gameIds.some((id) => !Number.isSafeInteger(id) || id <= 0)) {
    return res.status(400).json({ error: "gameIds must be a comma-separated list of game ids." });
  }
  if (gameIds.length > MAX_GAMES_PER_REQUEST) {
    return res.status(400).json({ error: `At most ${MAX_GAMES_PER_REQUEST} games per request.` });
  }
  if (!ppShareServingEnabled()) {
    res.setHeader("Cache-Control", "public, s-maxage=60, stale-while-revalidate=300");
    return res.status(200).json({ servingEnabled: false, clocks: [] });
  }
  try {
    const clocks = await readPpTeamGameClocks(supabase as any, gameIds);
    res.setHeader("Cache-Control", "public, s-maxage=300, stale-while-revalidate=600");
    return res.status(200).json({ servingEnabled: true, clocks });
  } catch (error: any) {
    return res.status(500).json({ error: error?.message ?? "Reading the PP clock failed." });
  }
}
