import supabase from "lib/supabase";
import { fetchAllSupabasePages } from "lib/supabase/pagination";
import { aggregateTeamFiveOnFive, aggregateTeamSpecialTeams, type TeamSpecialTeamsGame } from "./teamPerformanceDriverModel";
import { getTeamAbbreviationById } from "lib/teamsInfo";

export async function fetchTeamDriverSnapshots(seasonId: number) {
  const today = new Date().toISOString().slice(0, 10);
  // No regular-season game precedes September of the season's first year.
  const seasonFloor = `${Math.floor(seasonId / 10000)}-09-01`;
  // One parallel stage (S4). The cutoff comes from the rows themselves rather
  // than from two "latest date" probes run after the games, and both sources
  // are cut to it afterwards: same rows, two fewer serial round trips.
  // Game metadata supplies authoritative season/type boundaries, including
  // shortened seasons. Do not infer regular-season status from calendar months.
  const [games, fiveOnFiveSeasonRows, teamSeasonGames] = await Promise.all([
    fetchAllSupabasePages(({ from, to }) => supabase
      .from("games").select("id,date,homeTeamId,awayTeamId")
      .eq("seasonId", seasonId).eq("type", 2).order("id").range(from, to)),
    fetchAllSupabasePages(({ from, to }) => supabase.from("nst_team_5v5")
      .select("team_abbreviation,date,gp,xgf,xga,gf")
      .gte("date", seasonFloor).lte("date", today)
      .order("date", { ascending: false }).order("team_abbreviation").range(from, to)),
    fetchAllSupabasePages(({ from, to }) => supabase.from("wgo_team_stats")
      .select("team_id,game_id,date,pp_opportunities,power_play_goals_for,times_shorthanded,pp_goals_against")
      .eq("season_id", seasonId).gte("date", seasonFloor).lte("date", today)
      .order("game_id").order("team_id").range(from, to))
  ]);
  if (!games.length) return { fiveOnFiveRows: [], specialTeamsRows: [] };
  const dates = games.map(game => game.date).sort();
  const start = dates[0];
  const end = dates[dates.length - 1] < today ? dates[dates.length - 1] : today;
  const latestIn = (rows: Array<{ date: string | null }>) => rows.reduce(
    (latest, row) => row.date && row.date >= start && row.date <= end && row.date > latest ? row.date : latest, "");
  // Both sources must have reached the cutoff: a one-night lag in either writer would otherwise
  // make every team that played that night look incomplete and blank the cards league-wide.
  const latest = latestIn(fiveOnFiveSeasonRows);
  const latestTeamGame = latestIn(teamSeasonGames);
  if (!latest || !latestTeamGame) return { fiveOnFiveRows: [], specialTeamsRows: [] };
  const cutoff = latest < latestTeamGame ? latest : latestTeamGame;
  const throughCutoff = <T extends { date: string | null }>(rows: T[]) =>
    rows.filter(row => row.date != null && row.date >= start && row.date <= cutoff);
  const fiveOnFiveDailyRows = throughCutoff(fiveOnFiveSeasonRows);
  const teamGames = throughCutoff(teamSeasonGames);
  const expected = new Map<number, Set<number>>();
  const expectedDates = new Map<string, Map<string, number>>();
  for (const game of games.filter(game => game.date <= cutoff)) {
    for (const team of [game.homeTeamId, game.awayTeamId]) {
      const ids = expected.get(team) ?? new Set<number>();
      ids.add(game.id);
      expected.set(team, ids);
      const abbreviation = getTeamAbbreviationById(team);
      if (abbreviation) {
        const dates = expectedDates.get(abbreviation) ?? new Map<string, number>();
        dates.set(game.date, (dates.get(game.date) ?? 0) + 1);
        expectedDates.set(abbreviation, dates);
      }
    }
  }
  const regularRows = teamGames.filter(row => row.team_id != null && row.game_id != null &&
    expected.get(row.team_id)?.has(row.game_id)) as TeamSpecialTeamsGame[];
  // Partial seasons below the coverage threshold stay incomplete; above it the snapshot carries
  // covered/expected games so the card can say so.
  const expectedGameCounts = new Map([...expected.entries()].map(([team, ids]) => [team, ids.size]));
  return {
    fiveOnFiveRows: aggregateTeamFiveOnFive(fiveOnFiveDailyRows, expectedDates),
    specialTeamsRows: aggregateTeamSpecialTeams(regularRows, expectedGameCounts)
  };
}
