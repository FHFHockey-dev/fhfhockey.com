import { bounded } from "lib/socialShare/trendSources";
import { activeTeamAbbreviations } from "lib/teamsInfo";
import type { SharePostContext, SharePostLoadResult, SharePostReadClient } from "./contract";
import { buildCreaseShift, creaseShiftPicks, seasonScope, type CreaseShiftData, type CreaseShiftSettings, type ScheduledGame } from "./creaseShift";
import { readCompletedTeamGames, readGoalieAppearances } from "./shared/goalieLedger.sources";

/**
 * A full 84-game season through the cutoff: 32 × 84 / 2 = 1,344 games, 2,688 team rows. The team and goalie reads do not
 * filter out playoff rows, so each also covers a full playoff run (at most 105 games, 210 team rows) on top. The goalie read
 * is one row per goalie per game: 2,688 starts plus relief. Read 11-11 on 82-game seasons: 2,764 to 2,797 goalie rows a
 * regular season, and 2,940 goalie and 2,788 team rows for 2025-26 with its playoffs. Anything above these fails closed.
 */
export const SEASON_TEAM_GAME_LIMIT = 3000;
export const SEASON_GOALIE_LIMIT = 3400;
/** Regular-season games only (`type` 2): 1,344. */
export const SEASON_SCHEDULE_LIMIT = 1400;

/** Game ids per final-state read; at most two game-end rows each before the read fails closed. */
export const FINAL_STATE_CHUNK = 200;

/**
 * The final-state predicate (rule 19), the same evidence the team unit-TOI planner uses: a game is final when its stored
 * play-by-play holds exactly one game-end event. None, or more than one, is not proof.
 */
export async function readFinalGameIds(client: SharePostReadClient, gameIds: readonly number[]): Promise<Set<number>> {
  const ends = new Map<number, number>();
  for (let index = 0; index < gameIds.length; index += FINAL_STATE_CHUNK) {
    const chunk = gameIds.slice(index, index + FINAL_STATE_CHUNK);
    const rows = await bounded<{ gameid: number; id: number }>("Final-state evidence", chunk.length * 2, (start, end) => client.from("pbp_plays").select("gameid,id", { count: "exact" }).in("gameid", [...chunk]).eq("typedesckey", "game-end").order("gameid").order("id").range(start, end));
    for (const row of rows) ends.set(Number(row.gameid), (ends.get(Number(row.gameid)) ?? 0) + 1);
  }
  return new Set([...ends].filter(([, count]) => count === 1).map(([gameId]) => gameId));
}

/** Regular-season games in the dates, oldest first, each with `final` from `readFinalGameIds`. See `ScheduledGame`. */
export async function readScheduledGames(client: SharePostReadClient, scope: { season: number; from: string; through: string; limit: number }): Promise<ScheduledGame[]> {
  const games = await bounded<Omit<ScheduledGame, "final">>("Schedule", scope.limit, (start, end) => client.from("games").select("id,date,homeTeamId,awayTeamId", { count: "exact" }).eq("seasonId", scope.season).eq("type", 2).gte("date", scope.from).lte("date", scope.through).order("date").order("id").range(start, end));
  const final = games.length ? await readFinalGameIds(client, games.map(game => game.id)) : new Set<number>();
  return games.map(game => ({ ...game, final: final.has(game.id) }));
}

export async function loadCreaseShift({ client, generatedAt }: SharePostContext, settings: CreaseShiftSettings): Promise<SharePostLoadResult<CreaseShiftData>> {
  const { from, through, season } = seasonScope(generatedAt);
  const [reported, appearances, scheduled] = await Promise.all([
    readCompletedTeamGames(client, { season, from, through, limit: SEASON_TEAM_GAME_LIMIT }),
    readGoalieAppearances(client, { season, from, through, limit: SEASON_GOALIE_LIMIT }),
    readScheduledGames(client, { season, from, through, limit: SEASON_SCHEDULE_LIMIT }),
  ]);
  // Every team is ranked so a picked team keeps its league rank; the picks only choose who shows.
  return buildCreaseShift({ reported, appearances, scheduled, teams: [...activeTeamAbbreviations].map(String).sort(), picked: creaseShiftPicks(settings.teams), window: Number(settings.window), comparison: settings.comparison === "std" ? "std" : "previous", minComparisonGames: settings.minComparisonGames, through });
}
