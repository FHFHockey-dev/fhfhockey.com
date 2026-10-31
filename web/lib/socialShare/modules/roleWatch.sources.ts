import { bounded } from "lib/socialShare/trendSources";
import type { SharePostContext, SharePostLoadResult } from "./contract";
import { readCompletedTeamGames } from "./shared/goalieLedger.sources";
import { readSkaterAppearances } from "./shared/skaterAppearances.sources";
import { buildRoleWatch, ROLE_PP_COLUMNS, ROLE_ROLLING_COLUMNS, roleWatchShown, type RolePpRow, type RoleRollingRow, type RoleWatchData, type RoleWatchSettings } from "./roleWatch";
import { shareThrough, WHAT_CHANGED_LIST_CAP } from "./whatChanged";
import { readSchedule, WHAT_CHANGED_LIMITS } from "./whatChanged.sources";

/** Role context reads only the listed players' two games: at most 18 players × 36 games, and 40 PP rows per game. */
const LISTED_PLAYERS = WHAT_CHANGED_LIST_CAP * 2, LISTED_GAMES = LISTED_PLAYERS * 2, PP_ROWS_PER_GAME = 40;

export async function loadRoleWatch({ client, generatedAt }: SharePostContext, settings: RoleWatchSettings): Promise<SharePostLoadResult<RoleWatchData>> {
  const { through, season, from } = shareThrough(generatedAt);
  const appearances = await readSkaterAppearances(client, { season, from, through, limit: WHAT_CHANGED_LIMITS.skaterRows });
  const completedTeamGames = await readCompletedTeamGames(client, { season, from, through, limit: WHAT_CHANGED_LIMITS.teamGames });
  const scheduledGameIds = await readSchedule(client, { season, through });
  const { playerIds, gameIds } = roleWatchShown(appearances, settings);
  const rolling = playerIds.length ? await bounded<RoleRollingRow>("Rolling line combinations", LISTED_PLAYERS * LISTED_GAMES, (start, end) => client.from("rolling_player_game_metrics").select(ROLE_ROLLING_COLUMNS.join(","), { count: "exact" }).eq("season", season).eq("strength_state", "all").in("player_id", playerIds).in("game_id", gameIds).order("game_id", { ascending: true }).order("player_id", { ascending: true }).range(start, end)) : [];
  const pp = gameIds.length ? await bounded<RolePpRow>("Power-play combinations", LISTED_GAMES * PP_ROWS_PER_GAME, (start, end) => client.from("powerPlayCombinations").select(ROLE_PP_COLUMNS.join(","), { count: "exact" }).in("gameId", gameIds).order("gameId", { ascending: true }).order("playerId", { ascending: true }).range(start, end)) : [];
  return buildRoleWatch({ appearances, evidence: { rolling, pp }, completedTeamGames, scheduledGameIds, through, settings });
}
