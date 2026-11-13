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
      if (!teamId && !gameId) return res.status(400).json({ error: "A teamId or gameId query parameter is required" });
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
    const requestedDate = date;
    let reports = await fetchTweetProjectionReports(supabase, { teamId, gameId, date });
    // Team pages should not lose yesterday's source posts on a quiet day. Keep
    // this separate from exact-game selection and label the retained date.
    if (teamId && !gameId && reports.length === 0) {
      const oldest = new Date(`${date}T00:00:00Z`);
      oldest.setUTCDate(oldest.getUTCDate() - 7);
      const oldestDate = oldest.toISOString().slice(0, 10);
      // This private table is not in the generated public-client type inventory,
      // matching the server-only storage reader's existing boundary.
      const { data, error } = await (supabase as any).from("tweet_projection_reports")
        .select("report_date").eq("team_id", teamId)
        .gte("report_date", oldestDate).lt("report_date", date)
        .order("report_date", { ascending: false }).limit(1).maybeSingle();
      if (error) throw error;
      if (typeof data?.report_date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(data.report_date) &&
          data.report_date >= oldestDate && data.report_date < date) {
        date = data.report_date;
        reports = await fetchTweetProjectionReports(supabase, { teamId, date });
      }
    }
    res.setHeader("Cache-Control", "public, s-maxage=30, stale-while-revalidate=30");
    return res.json({ enabled: true, reports, sets: selectProjectedUnitSets(reports),
      reportScope: { requestedDate, reportDate: date, fallback: date !== requestedDate } });
  } catch {
    return res.status(503).json({ error: "Projected lineups are temporarily unavailable" });
  }
}
