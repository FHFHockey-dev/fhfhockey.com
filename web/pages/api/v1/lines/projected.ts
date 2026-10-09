import type { NextApiRequest, NextApiResponse } from "next";
import supabase from "lib/supabase/server";
import { fetchTweetProjectionReports } from "lib/sources/tweetProjectionStorage";
import { easternReportDate, selectProjectedUnitSets } from "lib/sources/projectedLineups";
import { tweetPipelineFlags } from "lib/sources/tweetInterpretation";
import { lineSnapshotFlags } from "lib/lines/types";
import { readGameLines } from "lib/lines/service";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") return res.status(405).end();
  const parseId = (value: unknown) => value == null ? undefined : typeof value === "string" && /^[1-9]\d*$/.test(value) && Number.isSafeInteger(Number(value)) ? Number(value) : NaN;
  const teamId = parseId(req.query.teamId);
  const gameId = parseId(req.query.gameId);
  if (Number.isNaN(teamId) || Number.isNaN(gameId)) return res.status(400).json({ error: "Invalid team or game ID" });
  try {
    if (lineSnapshotFlags().entryServing) {
      if (!teamId && !gameId) return res.status(400).json({ error: "A team or game is required" });
      const response = await readGameLines(supabase, { teamId, gameId, now: new Date().toISOString() });
      if (gameId && !response.game) return res.status(404).json({ error: "Game not found for this team" });
      res.setHeader("Cache-Control", "public, s-maxage=15, stale-while-revalidate=15");
      return res.json(response);
    }
    if (!tweetPipelineFlags().publishing) return res.json({ enabled: false, reports: [], sets: [] });
    let date = easternReportDate(new Date().toISOString());
    if (gameId) {
      const { data, error } = await supabase.from("games").select("date").eq("id", gameId).maybeSingle();
      if (error) throw error;
      if (!data) return res.status(404).json({ error: "Game not found" });
      date = data.date;
    }
    const reports = await fetchTweetProjectionReports(supabase, { teamId, gameId, date });
    res.setHeader("Cache-Control", "public, s-maxage=30, stale-while-revalidate=30");
    return res.json({ enabled: true, reports, sets: selectProjectedUnitSets(reports) });
  } catch {
    return res.status(503).json({ error: "Projected lineups are temporarily unavailable" });
  }
}
