import { bounded } from "lib/socialShare/trendSources";
import type { SharePostContext, SharePostLoadResult } from "./contract";
import { buildBshBoard, skaterSeasonScope, type BshBoardData, type BshBoardSettings, type SkaterSeason } from "./bshBoard";
import { readCompletedTeamGames } from "./shared/goalieLedger.sources";
import { readSkaterAppearances } from "./shared/skaterAppearances.sources";

/** Ceilings for a full regular season, failing closed above them: 2,624 team games × about 18 skaters, and 1,312 games. */
export const SKATER_SEASON_LIMITS = { appearances: 50000, teamGames: 2700, scheduledGames: 1400 };

/** The one read behind this lane's posts: a season of appearances, plus the games that prove the feed is complete. */
export async function readSkaterSeason({ client, generatedAt }: SharePostContext): Promise<SkaterSeason> {
  const { season, from, through } = skaterSeasonScope(generatedAt);
  const [appearances, teamGames, scheduled] = await Promise.all([
    readSkaterAppearances(client, { season, from, through, limit: SKATER_SEASON_LIMITS.appearances }),
    readCompletedTeamGames(client, { season, from, through, limit: SKATER_SEASON_LIMITS.teamGames }),
    bounded<{ id: number }>("Schedule", SKATER_SEASON_LIMITS.scheduledGames, (start, end) => client.from("games").select("id", { count: "exact" }).eq("seasonId", season).eq("type", 2).gte("date", from).lte("date", through).order("id").range(start, end)),
  ]);
  return { appearances, teamGames, scheduledGames: scheduled.length, through };
}

export async function loadBshBoard(context: SharePostContext, settings: BshBoardSettings): Promise<SharePostLoadResult<BshBoardData>> {
  return buildBshBoard(await readSkaterSeason(context), settings);
}
