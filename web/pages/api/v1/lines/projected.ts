import type { NextApiRequest, NextApiResponse } from "next";
import supabase from "lib/supabase/server";
import { fetchTweetProjectionReports } from "lib/sources/tweetProjectionStorage";
import { easternReportDate, selectProjectedUnitSets, verifiedOriginalTweetUrl, type ProjectionReport } from "lib/sources/projectedLineups";
import { detectTweetLineContext, identityMentionPresent, requiresRelativeGameDateReview, tweetPipelineFlags } from "lib/sources/tweetInterpretation";
import { tweetPublicationFromUrl } from "lib/sources/tweetPublicationTime";
import { lineSnapshotFlags, type LineGame } from "lib/lines/types";
import { NO_CONFIRMATION_AUTHORS } from "lib/lines/authority";
import { getTeamInfoById } from "lib/teamsInfo";
import { injuryExitConflict } from "lib/sources/lineReportTime";
import { readGameLines, readReportGames } from "lib/lines/service";

type Matchup = Pick<LineGame, "id" | "date" | "homeTeamId" | "awayTeamId" | "homeAbbreviation" | "awayAbbreviation">;

function reportedStarter(report: ProjectionReport, game: Matchup) {
  if (game.id !== report.gameId || game.date !== report.date || ![game.homeTeamId, game.awayTeamId].includes(report.teamId)
    || report.interpretation.context !== "game" || report.session || report.interpretation.units.some(unit => unit.listing === "pipe_pair")) return;
  const goalies = (report.interpretation.events ?? []).filter(event => event.kind === "goalie");
  if (!goalies.length || goalies.some(event => !event.teamId)) return;
  const side = goalies.filter(event => event.teamId === report.teamId);
  const starters = side.filter(event => event.goalieRole === "starter" && event.state !== "ruled_out");
  if (starters.length !== 1) return;
  const event = starters[0]!;
  if (event.observation || event.reviewReason || event.modality === "negated" || event.modality === "observation"
    || side.some(other => other.playerId === event.playerId && (other.goalieRole === "backup" || other.state === "ruled_out"))
    || !Number.isSafeInteger(event.playerId) || event.playerId <= 0 || !event.playerName?.trim()) return;
  const evidence = event.evidence?.text;
  if (!evidence || !report.text.includes(evidence) || !identityMentionPresent(evidence, event.playerName.split(" ").at(-1)!)
    || !/\b(starts?|starting|starter|in (?:goal|net)|gets? the nod)\b/i.test(evidence) || evidence.includes("?")) return;
  const context = detectTweetLineContext(report.text);
  if (context.context === "practice" || requiresRelativeGameDateReview(report.text)
    || /\b(?:last (?:night|game|week|season)|previous game|next (?:game|week|\w+day))\b/i.test(report.text)) return;
  const weekday = new Date(game.date + "T12:00:00Z").toLocaleDateString("en-US", { weekday: "long", timeZone: "UTC" }).toLowerCase();
  if ([...evidence.matchAll(/\b(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)\b/gi)].some(match => match[0].toLowerCase() !== weekday)) return;
  const home = game.homeTeamId === report.teamId;
  const opponent = getTeamInfoById(home ? game.awayTeamId : game.homeTeamId);
  const opponentNames = [home ? game.awayAbbreviation : game.homeAbbreviation, opponent?.shortName, opponent?.name];
  // Older events leave their own applicability unresolved. The report can still identify
  // this scheduled matchup by its opponent or an explicit same-day reference.
  if (event.effectiveDate ? event.effectiveDate !== game.date
    : !/\b(?:today|tonight|this (?:afternoon|evening))\b/i.test(report.text) && !opponentNames.some(name => name && identityMentionPresent(report.text, name))) return;
  const url = verifiedOriginalTweetUrl(report.originalUrl);
  const posted = tweetPublicationFromUrl(url);
  const author = report.verifiedOriginalAuthor;
  if (!author || !url || new URL(url).pathname.split("/")[1] !== author || !posted || !report.originalPublishedAt || easternReportDate(posted) !== game.date
    || Math.floor(Date.parse(posted) / 1000) !== Math.floor(Date.parse(report.originalPublishedAt) / 1000)) return;
  if (NO_CONFIRMATION_AUTHORS.includes(author.toLowerCase()) || /^(?:null|undefined|unknown|none|n_?a|source_account)$/i.test(author)) return;
  const projected = /\b(?:expected|projected|likely|probable)\b/i.test(evidence);
  const status = event.state === "confirmed" && event.modality !== "tentative" && !projected ? "confirmed"
    : ["projected", "likely"].includes(event.state) && projected ? "projected" : null;
  if (status) return { status, author, playerId: event.playerId, playerName: event.playerName,
    teamAbbreviation: home ? game.homeAbbreviation : game.awayAbbreviation };
}

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
    const now = new Date().toISOString();
    const gameView = req.query.view === "game" && !!(teamId || gameId);
    const navigation = gameView ? await readReportGames(supabase, { teamId, gameId, now }) : undefined;
    if (navigation === null) return res.status(404).json({ error: "Game not found for this team" });
    const selected = navigation?.games.find(game => game.id === navigation.selectedGameId);
    let date = easternReportDate(now);
    if (gameId && selected) date = selected.date;
    else if (gameId) {
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
    // A game can remain live after Eastern midnight while newer, unrelated team posts arrive.
    if (!gameId && selected && selected.date < requestedDate && selected.date !== date) {
      const gameReports = await fetchTweetProjectionReports(supabase, { teamId, gameId: selected.id, date: selected.date });
      reports = [...gameReports, ...reports];
    }
    const applicable: ProjectionReport[] = [];
    const shown = reports.map(report => {
      const game = navigation?.games.find(item => item.id === report.gameId);
      const exit = injuryExitConflict(report.text, game?.date ?? report.date, report.teamId, game && [game.homeTeamId, game.awayTeamId]);
      if (exit) {
        const unknownSubject = exit === "assigned_team_named_as_opponent";
        return { ...report, gameId: null, teamId: unknownSubject ? null : report.teamId,
          teamAbbreviation: unknownSubject ? null : report.teamAbbreviation,
          interpretation: { ...report.interpretation, context: "unknown", certainty: "reported", units: [], events: [],
            changes: [], excludedUnits: [], lineContext: undefined } };
      }
      if (!navigation || (selected && report.gameId === selected.id && report.date === selected.date)) applicable.push(report);
      return selected ? { ...report, reportedStarter: reportedStarter(report, selected) } : report;
    });
    res.setHeader("Cache-Control", "public, s-maxage=30, stale-while-revalidate=30");
    return res.json({ enabled: true, reports: shown, sets: selectProjectedUnitSets(applicable), ...(navigation ? { navigation } : {}),
      reportScope: { requestedDate, reportDate: date, fallback: date !== requestedDate } });
  } catch {
    return res.status(503).json({ error: "Projected lineups are temporarily unavailable" });
  }
}
