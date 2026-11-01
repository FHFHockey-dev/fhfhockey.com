import { bounded } from "lib/socialShare/trendSources";
import { activeTeamAbbreviations } from "lib/teamsInfo";
import type { SharePostContext, SharePostLoadResult } from "./contract";
import { buildTeamGames, teamGamesWindow, type TeamGameInput, type TeamGamesData, type TeamGamesSettings } from "./teamGames";

/** 32 teams × at most 16 games in 30 days; anything above that fails closed. */
const TEAM_GAME_LIMIT = 600;
const SCHEDULE_LIMIT = 300;

export async function loadTeamGames({ client, generatedAt }: SharePostContext, settings: TeamGamesSettings): Promise<SharePostLoadResult<TeamGamesData>> {
  const { from, through, season } = teamGamesWindow(generatedAt, settings.days);
  const rows = await bounded<TeamGameInput>("Team game stats", TEAM_GAME_LIMIT, (start, end) => client.from("wgo_team_stats").select("team_id,game_id,date", { count: "exact" }).eq("season_id", season).gte("date", from).lte("date", through).order("date").order("game_id").order("team_id").range(start, end));
  const scheduled = await bounded<{ id: number }>("Schedule", SCHEDULE_LIMIT, (start, end) => client.from("games").select("id", { count: "exact" }).eq("seasonId", season).eq("type", 2).gte("date", from).lte("date", through).order("id").range(start, end));
  return buildTeamGames({ rows, scheduledGames: scheduled.length, from, through, teams: [...activeTeamAbbreviations].map(String).sort(), updatedAt: null });
}
