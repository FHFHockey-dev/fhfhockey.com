import supabase from "lib/supabase";
import { fetchAllSupabasePages } from "lib/supabase/pagination";
import { aggregateTeamFiveOnFive, aggregateTeamSpecialTeams, type TeamSpecialTeamsGame } from "./teamPerformanceDriverModel";
import { getTeamAbbreviationById } from "lib/teamsInfo";

export async function fetchTeamDriverSnapshots(seasonId: number) {
  // Game metadata supplies authoritative season/type boundaries, including
  // shortened seasons. Do not infer regular-season status from calendar months.
  const games = await fetchAllSupabasePages(({ from, to }) => supabase
    .from("games").select("id,date,homeTeamId,awayTeamId")
    .eq("seasonId", seasonId).eq("type", 2).order("id").range(from, to));
  if (!games.length) return { fiveOnFiveRows: [], specialTeamsRows: [] };
  const dates = games.map(game => game.date).sort();
  const start = dates[0];
  const today = new Date().toISOString().slice(0, 10);
  const end = dates[dates.length - 1] < today ? dates[dates.length - 1] : today;
  // Both sources must have reached the cutoff: a one-night lag in either writer would otherwise
  // make every team that played that night look incomplete and blank the cards league-wide.
  const [latest, latestTeamGame] = await Promise.all([
    supabase.from("nst_team_5v5").select("date")
      .gte("date", start).lte("date", end).order("date", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("wgo_team_stats").select("date")
      .eq("season_id", seasonId).gte("date", start).lte("date", end)
      .order("date", { ascending: false }).limit(1).maybeSingle()
  ]);
  if (latest.error) throw latest.error;
  if (latestTeamGame.error) throw latestTeamGame.error;
  if (!latest.data || !latestTeamGame.data) return { fiveOnFiveRows: [], specialTeamsRows: [] };
  const cutoff = latest.data.date < latestTeamGame.data.date ? latest.data.date : latestTeamGame.data.date;
  const [fiveOnFiveDailyRows, teamGames] = await Promise.all([
    fetchAllSupabasePages(({ from, to }) => supabase.from("nst_team_5v5")
      .select("team_abbreviation,date,gp,xgf,xga,gf")
      .gte("date", start).lte("date", cutoff)
      .order("date", { ascending: false }).order("team_abbreviation").range(from, to)),
    fetchAllSupabasePages(({ from, to }) => supabase.from("wgo_team_stats")
      .select("team_id,game_id,date,pp_opportunities,power_play_goals_for,times_shorthanded,pp_goals_against")
      .eq("season_id", seasonId).gte("date", start).lte("date", cutoff)
      .order("game_id").order("team_id").range(from, to))
  ]);
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
