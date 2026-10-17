import type { NextApiRequest, NextApiResponse } from "next";
import supabase from "lib/supabase/server";
import { buildGameExpectationView, GameExpectationViewLimitError } from "lib/player-forecasts/gameExpectationView";
import { loadGameExpectations, parseGameExpectationScope } from "lib/player-forecasts/gameExpectationReader";

/** Reads only the shared released catalog and admitted game revisions. */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") { res.setHeader("Allow", "GET"); return res.status(405).end(); }
  let scope;
  try { scope = parseGameExpectationScope(req.query); }
  catch (error) { return res.status(400).json({ success: false, error: error instanceof Error ? error.message : "Invalid forecast scope." }); }
  try {
    if (!supabase) throw new Error("Unavailable database client");
    const data = await loadGameExpectations(supabase, scope);
    // Expiry/use admission is checked at every read; do not serve a cached expired release.
    res.setHeader("Cache-Control", "no-store");
    return res.status(200).json({ success: true, data: buildGameExpectationView(data) });
  } catch (error) {
    if (error instanceof GameExpectationViewLimitError) return res.status(503).json({ success: false, code: "forecast_view_too_large", error: error.message });
    return res.status(503).json({ success: false, error: "Released forecasts are temporarily unavailable." });
  }
}
