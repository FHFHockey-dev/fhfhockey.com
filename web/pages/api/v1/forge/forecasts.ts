import type { NextApiRequest, NextApiResponse } from "next";
import supabase from "lib/supabase/server";
import { buildGameExpectationView, GameExpectationViewLimitError } from "lib/player-forecasts/gameExpectationView";
import { loadGameExpectations, parseGameExpectationScope } from "lib/player-forecasts/gameExpectationReader";
import type { GameExpectationsResponse } from "lib/player-forecasts/gameExpectations";
import { forecastSourceSummary, selectForecastServingSource, type ForecastServingSource } from "lib/player-forecasts/forecastServingSource";

/** Shared CDN reuse, as on Start Chart: at most 15 s and never past the earliest receipt expiry or puck drop. */
function sharedMaxAgeSeconds(data: GameExpectationsResponse, source: ForecastServingSource, now: number) {
  let earliest = Infinity;
  const add = (value: string | null | undefined) => {
    const time = Date.parse(value ?? "");
    if (Number.isFinite(time) && time < earliest) earliest = time;
  };
  if (source.kind === "native") add(source.expiresAt);
  for (const player of data.players) for (const game of player.games) {
    add(game.scheduledAt); add(game.startParticipation?.expiresAt);
    for (const target of Object.values(game.targets)) {
      add(target.expiresAt); add(target.participation?.expiresAt);
      for (const source of target.sources) add(source.expiresAt);
    }
  }
  return Math.max(0, Math.min(15, Math.floor((earliest - now) / 1000)));
}

/** Reads only the shared released catalog and admitted game revisions. */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") { res.setHeader("Allow", "GET"); return res.status(405).end(); }
  let scope;
  try { scope = parseGameExpectationScope(req.query); }
  catch (error) { return res.status(400).json({ success: false, error: error instanceof Error ? error.message : "Invalid forecast scope." }); }
  try {
    if (!supabase) throw new Error("Unavailable database client");
    const now = new Date();
    const source = await selectForecastServingSource(supabase, scope.seasonId, now);
    const data = await loadGameExpectations(supabase, scope, now, { source });
    const view = buildGameExpectationView(data);
    // Expiry/use admission is checked at every read; a shared copy never outlives the earliest expiry.
    res.setHeader("Cache-Control", `s-maxage=${sharedMaxAgeSeconds(data, source, Date.now())}, stale-while-revalidate=0`);
    return res.status(200).json({ success: true, data: view, forecastSource: forecastSourceSummary(source) });
  } catch (error) {
    res.setHeader("Cache-Control", "no-store");
    if (error instanceof GameExpectationViewLimitError) return res.status(503).json({ success: false, code: "forecast_view_too_large", error: error.message });
    return res.status(503).json({ success: false, error: "Released forecasts are temporarily unavailable." });
  }
}
