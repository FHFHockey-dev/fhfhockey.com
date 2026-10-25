import type { NextApiRequest, NextApiResponse } from "next";
import type { SupabaseClient } from "@supabase/supabase-js";
import { withCronJobAudit } from "lib/cron/withCronJobAudit";
import { withNhlOffSeasonSkip } from "lib/cron/nhlOffSeason";
import supabase from "lib/supabase/server";
import adminOnly from "utils/adminOnlyMiddleware";
import { forecastCalendarPolicy } from "lib/player-forecasts/contributions";
import { buildLedgerRows, buildMarketLedgerRows, LEDGER_MARKET_ENABLED, LEDGER_SOURCES, type LedgerGame, type LedgerMarketQuote, type LedgerPlayer } from "lib/player-forecasts/servedForecastLedger";
import { loadForgeDailyBridgeForecasts, teamStrengthPriors, teamWinProbability } from "lib/rosterScheduleData/forgeDailyBridge";
import { loadPlanningInputs, pages } from "lib/rosterScheduleData/planningInputs";

/** S-B1: snapshots what the RSO bridge serves for one ET date (plus naive controls) into forge_served_forecast_ledger.
 * Writes only that table (upsert on its PK); games already started are refused and counted.
 * Task 6.3 (LEDGER_MARKET_ENABLED): adds `market` rows from the day's pre-game prices, upserted after the other sources. */
export const LEDGER_TABLE = "forge_served_forecast_ledger";
const UPSERT_BATCH = 500, ID_CHUNK = 200, DAY_MS = 86400000;
const QUOTE_COLUMNS = "game_id,market_type,sportsbook_key,outcome_key,line_value,price_american,source_observed_at";
type Row = Record<string, any>;

function todayEtDateOnly(now: Date) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}
const param = (req: NextApiRequest, key: string) => { const value = req.query[key]; return Array.isArray(value) ? value[0] : value; };
const chunks = <T,>(list: T[], size: number) => Array.from({ length: Math.ceil(list.length / size) }, (_, index) => list.slice(index * size, (index + 1) * size));

const handler = async (req: NextApiRequest, res: NextApiResponse) => {
  if (req.method !== "GET" && req.method !== "POST") { res.setHeader("Allow", "GET, POST"); return res.status(405).json({ error: "Method not allowed" }); }
  const now = new Date(), date = param(req, "date") ?? todayEtDateOnly(now);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(Date.parse(`${date}T12:00:00Z`))
    || new Date(`${date}T12:00:00Z`).toISOString().slice(0, 10) !== date) return res.status(400).json({ error: "date must be YYYY-MM-DD" });
  // Elapsed time per stage, so a deadline error names the stage that spent the budget.
  const stageMs: Record<string, number> = {};
  let stage = "day_games", stageStart = Date.now();
  const enter = (next: string) => { stageMs[stage] = Date.now() - stageStart; stage = next; stageStart = Date.now(); };
  try {
    const db = supabase as unknown as SupabaseClient<any>, deadline = Date.now() + 45000;
    const dayGames = await pages(() => db.from("games").select("id,date,seasonId,startTime,homeTeamId,awayTeamId", { count: "exact" }).eq("date", date).order("id"), deadline, 40);
    if (!dayGames.length) return res.status(200).json({ success: true, date, games: 0, rowsUpserted: 0, countsBySource: {}, skippedGames: [] });
    const seasonId = Number(dayGames[0].seasonId);
    enter("planning_inputs");
    const planning = await loadPlanningInputs(db, { seasonId, startDate: date, endDate: date, timeZone: "America/New_York" }, now);
    const sides = new Map<string, Row[]>();
    for (const game of planning.games) sides.set(game.id, [...(sides.get(game.id) ?? []), game]);
    const games: LedgerGame[] = dayGames.map(row => {
      const side = sides.get(String(row.id)) ?? [];
      return { gameId: Number(row.id), date, homeTeamId: Number(row.homeTeamId), awayTeamId: Number(row.awayTeamId),
        status: side.length && side.every(game => game.status === "scheduled") ? "scheduled" : side[0]?.status ?? "unverified",
        scheduledAt: side[0]?.startsAt ?? (row.startTime ? new Date(row.startTime).toISOString() : null) };
    });
    const teamIds = new Set(games.flatMap(game => [game.homeTeamId, game.awayTeamId]));
    // Same identity rule as the bridge: NHL id, a unique current team, a roster revision and an abbreviation.
    const identified = planning.players.filter(player => player.nhlId !== null && Number.isFinite(player.nhlTeamId) && player.rosterRevision
      && player.teamAbbreviation && teamIds.has(player.nhlTeamId!));
    const players: LedgerPlayer[] = identified.map(player => ({ nhlId: player.nhlId!, planningId: player.id, playerClass: player.playerClass, teamId: player.nhlTeamId! }));
    enter("forge_bridge");
    const bridge = await loadForgeDailyBridgeForecasts(db, identified, planning.games, now, seasonId, deadline, forecastCalendarPolicy());
    const runIds = [...new Set(bridge.forecasts.map(row => row.revisionId.split(":").at(-1)!).filter(Boolean))];
    const previousSeason = (Math.floor(seasonId / 10000) - 1) * 10001 + 1;
    const priorFrom = new Date(Date.parse(`${date}T12:00:00Z`) - 7 * DAY_MS).toISOString().slice(0, 10);
    const skaterIds = players.filter(row => row.playerClass === "skater").map(row => row.nhlId), goalieIds = players.filter(row => row.playerClass === "goalie").map(row => row.nhlId);
    enter("history_reads");
    const [runs, scheduleGames, wgoGameRows, goalieGameRows, teamPriors, lastSeasonTeams] = await Promise.all([
      runIds.length ? pages(() => db.from("forge_runs").select("run_id,as_of_date", { count: "exact" }).in("run_id", runIds).order("run_id"), deadline, 500, row => row.run_id) : [],
      pages(() => db.from("games").select("id,date,homeTeamId,awayTeamId", { count: "exact" }).eq("seasonId", seasonId).lte("date", date).order("date").order("id"), deadline, 2000),
      // Season-to-date per-game rows before the date: last-5 and season means (bounded by one season per player).
      Promise.all(chunks(skaterIds, ID_CHUNK).map(ids => pages(() => db.from("wgo_skater_stats").select("player_id,date,game_id,season_id,goals,assists,pp_points,shots,hits,blocked_shots", { count: "exact" })
        .in("player_id", ids).eq("season_id", seasonId).lt("date", date).order("date", { ascending: false }).order("player_id"), deadline, 20000, row => [row.player_id, row.date])))
        .then(parts => parts.flat()),
      Promise.all(chunks(goalieIds, ID_CHUNK).map(ids => pages(() => db.from("wgo_goalie_stats").select("goalie_id,date,game_id,season_id,games_started,saves,goals_against,shots_against,wins,shutouts", { count: "exact" })
        .in("goalie_id", ids).eq("season_id", seasonId).lt("date", date).order("date", { ascending: false }).order("goalie_id"), deadline, 10000, row => [row.goalie_id, row.date])))
        .then(parts => parts.flat()),
      // Optional team-xG inputs (as the bridge reads them); a failed read means a neutral 0.5 win chance.
      pages(() => db.from("nhl_team_data").select("team_abbrev,date,xga,xga_per_game,xgf_per_game,games_played", { count: "exact" }).eq("season_id", seasonId)
        .gte("date", priorFrom).lte("date", date).order("date", { ascending: false }).order("team_abbrev"), deadline, 2000, row => [row.team_abbrev, row.date, row.xga, row.xga_per_game]).catch(() => []),
      pages(() => db.from("nst_team_stats").select("team_abbreviation,season,situation,gp,xga,xgf", { count: "exact" }).eq("season", previousSeason).eq("situation", "all")
        .order("team_abbreviation"), deadline, 200, row => [row.team_abbreviation, row.season]).catch(() => []),
    ]);
    const priors = teamStrengthPriors(teamPriors, lastSeasonTeams), teamWin = new Map<string, number>(), teamAbbreviations = new Map<string, string>();
    for (const game of games) {
      const side = sides.get(String(game.gameId)) ?? [], home = side.find(row => row.home)?.teamAbbreviation, away = side.find(row => !row.home)?.teamAbbreviation;
      if (!home || !away) continue;
      teamAbbreviations.set(`${game.gameId}:${game.homeTeamId}`, home.toUpperCase()).set(`${game.gameId}:${game.awayTeamId}`, away.toUpperCase());
      teamWin.set(`${game.gameId}:${game.homeTeamId}`, teamWinProbability(priors.get(home.toUpperCase()), priors.get(away.toUpperCase()), true));
      teamWin.set(`${game.gameId}:${game.awayTeamId}`, teamWinProbability(priors.get(away.toUpperCase()), priors.get(home.toUpperCase()), false));
    }
    enter("ledger_build");
    const { rows, universe, skippedGameIds } = buildLedgerRows({ date, seasonId, now, games, players, bridgeForecasts: bridge.forecasts,
      runDates: new Map(runs.map(row => [row.run_id, row.as_of_date])), scheduleGames, wgoGameRows, goalieGameRows, teamWin });
    enter("ledger_upsert");
    let rowsUpserted = 0;
    for (const batch of chunks(rows, UPSERT_BATCH)) {
      const { error } = await db.from(LEDGER_TABLE).upsert(batch, { onConflict: "served_date,player_id,game_id,source" });
      if (error) return res.status(rowsUpserted ? 207 : 500).json({ success: false, date, rowsUpserted, error: error.message, skippedGames: skippedGameIds });
      rowsUpserted += batch.length;
    }
    // Market rows go last and alone: a market read or write failure never blocks the served forecasts above.
    enter("market");
    let marketRows: typeof rows = [], marketError: string | null = null;
    if (LEDGER_MARKET_ENABLED) try {
      const gameIds = games.map(game => game.gameId);
      const [propQuotes, gameQuotes] = await Promise.all([
        pages(() => db.from("prop_market_prices_daily").select(`${QUOTE_COLUMNS},player_id`, { count: "exact" }).eq("snapshot_date", date).in("game_id", gameIds)
          .order("game_id").order("player_id").order("market_type").order("sportsbook_key").order("outcome_key"), deadline, 50000,
        row => [row.game_id, row.player_id, row.market_type, row.sportsbook_key, row.outcome_key]),
        pages(() => db.from("market_prices_daily").select(QUOTE_COLUMNS, { count: "exact" }).eq("snapshot_date", date).in("game_id", gameIds).eq("market_type", "h2h")
          .order("game_id").order("sportsbook_key").order("outcome_key"), deadline, 2000, row => [row.game_id, row.sportsbook_key, row.outcome_key]),
      ]);
      const positions = new Map(identified.map(player => [player.nhlId!, player.eligiblePositions[0]]));
      marketRows = buildMarketLedgerRows({ date, now, rows, propQuotes: propQuotes as LedgerMarketQuote[], gameQuotes: gameQuotes as LedgerMarketQuote[],
        positions, teamAbbreviations, teamWin });
      for (const batch of chunks(marketRows, UPSERT_BATCH)) {
        const { error } = await db.from(LEDGER_TABLE).upsert(batch, { onConflict: "served_date,player_id,game_id,source" });
        if (error) throw new Error(error.message);
        rowsUpserted += batch.length;
      }
    } catch (error: any) {
      marketError = error?.message ?? String(error);
    }
    const countsBySource = Object.fromEntries(LEDGER_SOURCES.map(source => [source, [...rows, ...marketRows].filter(row => row.source === source).length]));
    if (marketError) return res.status(207).json({ success: false, date, rowsUpserted, countsBySource, marketError, skippedGames: skippedGameIds });
    return res.status(200).json({ success: true, date, seasonId, games: games.length, players: players.length, rowsUpserted, countsBySource,
      identifiedPlayerGames: universe.length, coverageStatus: "unavailable_independent_universe_not_persisted",
      skippedGames: skippedGameIds, bridgeLimitations: bridge.limitations });
  } catch (error: any) {
    stageMs[stage] = Date.now() - stageStart;
    console.error("forge-served-forecast-snapshot failed:", stage, stageMs, error);
    return res.status(500).json({ success: false, date, error: error?.message ?? String(error), stage, stageMs });
  }
};

export default adminOnly(withCronJobAudit(withNhlOffSeasonSkip(handler as any)));
