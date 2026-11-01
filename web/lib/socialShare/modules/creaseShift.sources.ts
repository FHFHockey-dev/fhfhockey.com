import { bounded } from "lib/socialShare/trendSources";
import { activeTeamAbbreviations } from "lib/teamsInfo";
import type { SharePostContext, SharePostLoadResult, SharePostReadClient } from "./contract";
import { buildCreaseShift, seasonScope, type CreaseShiftData, type CreaseShiftSettings, type ScheduledGame } from "./creaseShift";
import { readCompletedTeamGames, readGoalieAppearances } from "./shared/goalieLedger.sources";

/** A full season through the cutoff: 1,312 games × 2 team rows, plus relief rows. Anything above this fails closed. */
export const SEASON_TEAM_GAME_LIMIT = 2800;
export const SEASON_GOALIE_LIMIT = 3400;
export const SEASON_SCHEDULE_LIMIT = 1400;

export const readScheduledGames = (client: SharePostReadClient, scope: { season: number; from: string; through: string; limit: number }) => bounded<ScheduledGame>("Schedule", scope.limit, (start, end) => client.from("games").select("id,date,homeTeamId,awayTeamId", { count: "exact" }).eq("seasonId", scope.season).eq("type", 2).gte("date", scope.from).lte("date", scope.through).order("date").order("id").range(start, end));

export async function loadCreaseShift({ client, generatedAt }: SharePostContext, settings: CreaseShiftSettings): Promise<SharePostLoadResult<CreaseShiftData>> {
  const { from, through, season } = seasonScope(generatedAt);
  const [reported, appearances, scheduled] = await Promise.all([
    readCompletedTeamGames(client, { season, from, through, limit: SEASON_TEAM_GAME_LIMIT }),
    readGoalieAppearances(client, { season, from, through, limit: SEASON_GOALIE_LIMIT }),
    readScheduledGames(client, { season, from, through, limit: SEASON_SCHEDULE_LIMIT }),
  ]);
  return buildCreaseShift({ reported, appearances, scheduled, teams: [...activeTeamAbbreviations].map(String).sort(), window: Number(settings.window), comparison: settings.comparison === "std" ? "std" : "previous", minComparisonGames: settings.minComparisonGames, through });
}
