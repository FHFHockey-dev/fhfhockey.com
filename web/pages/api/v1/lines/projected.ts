import { taggedGameTimeDecision } from "lib/sources/reportedGameTimeDecision";
import type { NextApiRequest, NextApiResponse } from "next";
import supabase from "lib/supabase/server";
import { fetchTweetProjectionReports } from "lib/sources/tweetProjectionStorage";
import { easternReportDate, selectProjectedUnitSets, verifiedOriginalTweetUrl, type ProjectionReport } from "lib/sources/projectedLineups";
import { detectTweetLineContext, identityMentionPresent, requiresRelativeGameDateReview, tweetPipelineFlags } from "lib/sources/tweetInterpretation";
import { tweetPublicationFromUrl } from "lib/sources/tweetPublicationTime";
import { instant, lineSnapshotFlags, type GameGoalieReport, type GameTimeDecisionReport, type LineGame } from "lib/lines/types";
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
  const status: "confirmed" | "projected" | null = event.state === "confirmed" && event.modality !== "tentative" && !projected ? "confirmed"
    : ["projected", "likely"].includes(event.state) && projected ? "projected" : null;
  if (status) return { status, author, playerId: event.playerId, playerName: event.playerName,
    teamAbbreviation: home ? game.homeAbbreviation : game.awayAbbreviation };
}

function gameGoalieReports(reports: ProjectionReport[], game: Matchup, teamId: number, now: number): GameGoalieReport[] {
  const items: GameGoalieReport[] = [];
  for (const report of reports) {
    if (report.teamId !== teamId || report.gameId !== game.id || report.date !== game.date ||
      injuryExitConflict(report.text, game.date, teamId, [game.homeTeamId, game.awayTeamId])) continue;
    const goalie = report.interpretation.events?.some(event => event.kind === "goalie" && (event.teamId == null || event.teamId === teamId));
    const disputed = report.reviewReason === "conflicting_claims";
    if (report.session || report.interpretation.context === "practice" || detectTweetLineContext(report.text).context === "practice" ||
      requiresRelativeGameDateReview(report.text)) continue;
    if (!goalie && !report.interpretation.units.some(unit => unit.situation === "goalie") &&
      !(disputed && /\b(?:goalies?|goaltenders?|netminders?|in (?:net|goal))\b/i.test(report.text))) continue;
    const url = verifiedOriginalTweetUrl(report.originalUrl);
    const author = url && new URL(url).pathname.split("/")[1] === report.verifiedOriginalAuthor ? report.verifiedOriginalAuthor : null;
    const postClock = instant(tweetPublicationFromUrl(url)), posted = instant(report.originalPublishedAt), received = instant(report.receivedAt);
    if (received == null || received > now || (posted != null && posted > now)) continue;
    const verifiedClock = !!author && postClock != null && posted != null && Math.floor(postClock / 1000) === Math.floor(posted / 1000);
    const starter = !disputed && verifiedClock && posted != null && received >= posted ? reportedStarter(report, game) : undefined;
    items.push({ key: report.key, text: report.text, originalUrl: url, author,
      postedAt: verifiedClock ? report.originalPublishedAt : null,
      // Older projection rows substitute publication time when arrival is unavailable.
      receivedAt: posted != null && received > posted ? report.receivedAt : null,
      starter: starter ? { status: starter.status, playerId: starter.playerId, playerName: starter.playerName } : null });
  }
  return items.sort((a, b) => (instant(b.postedAt ?? b.receivedAt) ?? 0) - (instant(a.postedAt ?? a.receivedAt) ?? 0) || a.key.localeCompare(b.key));
}

function gameTimeDecisionReports(reports: ProjectionReport[], game: LineGame, teamId: number, now: number): GameTimeDecisionReport[] {
  const kickoff = instant(game.actualStart ?? game.scheduledStart);
  if (kickoff == null) return [];
  const events = reports.flatMap(report => {
    const posted = instant(report.originalPublishedAt), received = instant(report.receivedAt);
    if (report.teamId !== teamId || report.gameId !== game.id || report.date !== game.date || !report.originalUrl
      || !report.verifiedOriginalAuthor || posted == null || received == null || received < posted || received > now
      || easternReportDate(report.originalPublishedAt!) !== game.date) return [];
    return (report.interpretation.events ?? []).filter(e => e.teamId === teamId && !e.observation
      && (e.kind === "injury" || e.kind === "participation")).map(event => ({ report, event, posted, received }));
  });
  return events.flatMap(({ report, event, posted, received }) => {
    if (event.state !== "game_time_decision" || event.reviewReason || report.reviewReason || posted >= kickoff || received >= kickoff
      || events.some(other => other.event.playerId === event.playerId && (other.posted > posted
        || other.posted === posted && (other.event.state !== event.state || other.report.reviewReason || other.event.reviewReason)))) return [];
    const attributed = taggedGameTimeDecision(report.text);
    if (attributed?.name !== event.playerName || attributed.teamId !== teamId) return [];
    return [{ playerId: event.playerId, playerName: event.playerName, originalUrl: report.originalUrl!, author: report.verifiedOriginalAuthor!,
      postedAt: report.originalPublishedAt!, receivedAt: report.receivedAt }];
  }).sort((a, b) => Date.parse(b.postedAt) - Date.parse(a.postedAt));
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
      if (response.game && response.controls.observations && tweetPipelineFlags().publishing) {
        const game = response.game;
        try {
          const reports = await fetchTweetProjectionReports(supabase, { snapshotTeamIds: response.teams.map(team => team.teamId), gameId: game.id, date: game.date, games: [game] });
          const now = Date.now();
          for (const team of response.teams) {
            team.goalieReports = gameGoalieReports(reports, game, team.teamId, now);
            team.gameTimeDecisionReports = gameTimeDecisionReports(reports, game, team.teamId, now);
          }
        } catch {
          for (const team of response.teams) {
            team.goalieReports = null;
            team.gameTimeDecisionReports = null;
          }
        }
      }
      res.setHeader("Cache-Control", "public, s-maxage=15, stale-while-revalidate=15");
      return res.json(response);
    }
    if (!tweetPipelineFlags().publishing) return res.json({ enabled: false, reports: [], sets: [] });
    const now = new Date().toISOString();
    const gameView = req.query.view === "game" && !!(teamId || gameId);
    const navigation = gameView ? await readReportGames(supabase, { teamId, gameId, now }) : undefined;
    if (navigation === null) return res.status(404).json({ error: "Game not found for this team" });
    const selected = navigation?.games.find(game => game.id === navigation.selectedGameId);
    let games: ReadonlyArray<Pick<LineGame, "id" | "date" | "homeTeamId" | "awayTeamId">> | undefined = navigation?.games;
    let date = easternReportDate(now);
    if (gameId && selected) date = selected.date;
    else if (gameId) {
      const { data, error } = await supabase.from("games").select("id,date,homeTeamId,awayTeamId").eq("id", gameId).maybeSingle();
      if (error) throw error;
      if (!data) return res.status(404).json({ error: "Game not found" });
      date = data.date;
      games = [data];
    }
    const requestedDate = date;
    let reports = await fetchTweetProjectionReports(supabase, { teamId, gameId, date, games });
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
        reports = await fetchTweetProjectionReports(supabase, { teamId, date, games });
      }
    }
    // A game can remain live after Eastern midnight while newer, unrelated team posts arrive.
    if (!gameId && selected && selected.date < requestedDate && selected.date !== date) {
      const gameReports = await fetchTweetProjectionReports(supabase, { teamId, gameId: selected.id, date: selected.date, games });
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
