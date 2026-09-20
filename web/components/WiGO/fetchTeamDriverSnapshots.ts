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
  const latest = await supabase.from("nst_team_5v5").select("date")
    .gte("date", start).lte("date", end).order("date", { ascending: false }).limit(1).maybeSingle();
  if (latest.error) throw latest.error;
  if (!latest.data) return { fiveOnFiveRows: [], specialTeamsRows: [] };
  const cutoff = latest.data.date;
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
  const observed = new Map<number, Set<number>>();
  for (const row of regularRows) {
    const ids = observed.get(row.team_id) ?? new Set<number>();
    ids.add(row.game_id);
    observed.set(row.team_id, ids);
  }
  // Partial seasons must not masquerade as complete team percentages.
  const completeRows = regularRows.filter(row => observed.get(row.team_id)?.size === expected.get(row.team_id)?.size);
  return {
    fiveOnFiveRows: aggregateTeamFiveOnFive(fiveOnFiveDailyRows, expectedDates),
    specialTeamsRows: aggregateTeamSpecialTeams(completeRows)
  };
}
