import { bounded as boundedRead } from "lib/socialShare/trendSources";
import type { SharePostReadClient } from "../contract";
import { GOALIE_APPEARANCE_COLUMNS, TEAM_GAME_COLUMNS, toCompletedTeamGames, toGoalieAppearances, type GoalieAppearanceRow, type TeamGameRow } from "./goalieLedger";

/** Bounded, exact-count reads; narrow them by date or ids, and over `limit` rows they fail closed. */
export async function readGoalieAppearances(client: SharePostReadClient, scope: { season: number; from: string; through: string; goalieIds?: readonly number[]; limit: number }) {
  const rows = await boundedRead<GoalieAppearanceRow>("Goalie appearances", scope.limit, (from, to) => {
    let query = client.from("wgo_goalie_stats").select(GOALIE_APPEARANCE_COLUMNS.join(","), { count: "exact" }).eq("season_id", scope.season).gte("date", scope.from).lte("date", scope.through);
    if (scope.goalieIds) query = query.in("goalie_id", [...scope.goalieIds]);
    return query.order("date", { ascending: true }).order("game_id", { ascending: true }).order("goalie_id", { ascending: true }).range(from, to);
  });
  return toGoalieAppearances(rows, scope);
}
export async function readCompletedTeamGames(client: SharePostReadClient, scope: { season: number; from: string; through: string; limit: number }) {
  const rows = await boundedRead<TeamGameRow>("Completed team games", scope.limit, (from, to) => client.from("wgo_team_stats").select(TEAM_GAME_COLUMNS.join(","), { count: "exact" }).eq("season_id", scope.season).gte("date", scope.from).lte("date", scope.through)
    .order("date", { ascending: true }).order("game_id", { ascending: true }).order("team_id", { ascending: true }).range(from, to));
  return toCompletedTeamGames(rows, scope);
}
