import { bounded } from "lib/socialShare/trendSources";
import type { SharePostContext, SharePostLoadResult, SharePostReadClient } from "./contract";
import { NST_GSAX_COLUMNS, NST_GSAX_TABLES, type NstGsaxRow } from "./goalieGsax";
import { buildLastNightsStandouts, isGoalieView, type LastNightsStandoutsData, type LastNightsStandoutsSettings } from "./lastNightsStandouts";
import { ownershipByPlayer, type OwnershipMapRow, type YahooOwnershipRow } from "./nightlyFloor";
import { OWNERSHIP_LIMITS } from "./nightlyFloor.sources";
import { ROLE_PP_COLUMNS, ROLE_ROLLING_COLUMNS, type RolePpRow, type RoleRollingRow } from "./roleWatch";
import { readCompletedTeamGames, readGoalieAppearances } from "./shared/goalieLedger.sources";
import { readSkaterAppearances } from "./shared/skaterAppearances.sources";
import { NST_COUNT_COLUMNS, NST_ON_ICE_COLUMNS, shareThrough, type NstCountRow, type NstOnIceRow } from "./whatChanged";

/**
 * Ceilings, all failing closed. A full 16-game slate is about 576 skaters and 36 goalies, and each skater has at most
 * 84 games. NST and season reads ask only for the players on the slate; role reads only for the slate's games.
 */
export const STANDOUT_LIMITS = { slateSkaters: 700, slateGoalies: 60, seasonRows: 60000, teamGames: 40, schedule: 20, rolling: 700, pp: 800 } as const;

/** The newest date with skater rows, through yesterday in New York: on an off day this is still the latest completed slate. */
async function readSlateDate(client: SharePostReadClient, scope: { season: number; from: string; through: string }) {
  const { data, error } = await client.from("wgo_skater_stats").select("date").eq("season_id", scope.season).gte("date", scope.from).lte("date", scope.through).order("date", { ascending: false }).limit(1);
  if (error) throw new Error("The latest slate could not be read.");
  return (data?.[0]?.date as string | undefined) ?? null;
}
const readNstSeason = <Row>(what: string, table: string, columns: readonly string[], client: SharePostReadClient, scope: { season: number; through: string; playerIds: readonly number[] }) =>
  bounded<Row>(what, STANDOUT_LIMITS.seasonRows, (from, to) => client.from(table).select(columns.join(","), { count: "exact" }).eq("season", scope.season).lte("date_scraped", scope.through).in("player_id", [...scope.playerIds]).order("date_scraped", { ascending: true }).order("player_id", { ascending: true }).range(from, to));
async function readOwnership(client: SharePostReadClient, season: number) {
  const [yahoo, map] = await Promise.all([
    bounded<YahooOwnershipRow>("Yahoo ownership", OWNERSHIP_LIMITS.yahoo, (start, end) => client.from("yahoo_players").select("player_key,player_id,percent_ownership,last_updated", { count: "exact" }).eq("season", Math.floor(season / 10000)).order("player_key").range(start, end)),
    bounded<OwnershipMapRow>("Yahoo to NHL id map", OWNERSHIP_LIMITS.map, (start, end) => client.from("yahoo_nhl_player_map_read").select("yahoo_player_id,nhl_player_id", { count: "exact" }).order("yahoo_player_id").order("nhl_player_id").range(start, end)),
  ]);
  return { byPlayer: ownershipByPlayer(map, yahoo), updatedAt: yahoo.reduce<string | null>((latest, row) => row.last_updated && (!latest || row.last_updated > latest) ? row.last_updated : latest, null) };
}

export async function loadLastNightsStandouts({ client, generatedAt }: SharePostContext, settings: LastNightsStandoutsSettings): Promise<SharePostLoadResult<LastNightsStandoutsData>> {
  const { through, season, from } = shareThrough(generatedAt);
  const slate = await readSlateDate(client, { season, from, through });
  if (!slate) return { state: "missing", reasons: ["No completed slate this season yet."], evidence: { sources: [], sample: "Not available", strength: "Not available", cohort: "Not available", coverage: null }, data: null };
  const [completedTeamGames, schedule, ownership] = await Promise.all([
    readCompletedTeamGames(client, { season, from: slate, through: slate, limit: STANDOUT_LIMITS.teamGames }),
    bounded<{ id: number }>("Schedule", STANDOUT_LIMITS.schedule, (start, end) => client.from("games").select("id", { count: "exact" }).eq("seasonId", season).eq("type", 2).eq("date", slate).order("id").range(start, end)),
    readOwnership(client, season),
  ]);
  const shared = { slate, season, settings, completedTeamGames, scheduledGameIds: schedule.map(game => game.id), ownership };
  if (isGoalieView(settings.view)) {
    const [goalies, nstGoalies] = await Promise.all([
      readGoalieAppearances(client, { season, from: slate, through: slate, limit: STANDOUT_LIMITS.slateGoalies }),
      bounded<NstGsaxRow>("NST goalie logs", STANDOUT_LIMITS.slateGoalies, (start, end) => client.from(NST_GSAX_TABLES.all).select(NST_GSAX_COLUMNS.join(","), { count: "exact" }).eq("season", season).eq("date_scraped", slate).order("player_id").range(start, end)),
    ]);
    return buildLastNightsStandouts({ ...shared, goalies, nstGoalies });
  }
  const onSlate = await readSkaterAppearances(client, { season, from: slate, through: slate, limit: STANDOUT_LIMITS.slateSkaters });
  const playerIds = onSlate.map(game => game.playerId), gameIds = [...new Set(onSlate.map(game => game.gameId))];
  if (!playerIds.length) return buildLastNightsStandouts({ ...shared, appearances: [] });
  const appearances = await readSkaterAppearances(client, { season, from, through: slate, playerIds, limit: STANDOUT_LIMITS.seasonRows });
  const nstCounts = await readNstSeason<NstCountRow>("NST individual counts", "nst_gamelog_as_counts", NST_COUNT_COLUMNS, client, { season, through: slate, playerIds });
  const nstOnIce = await readNstSeason<NstOnIceRow>("NST on-ice counts", "nst_gamelog_as_counts_oi", NST_ON_ICE_COLUMNS, client, { season, through: slate, playerIds });
  const rolling = await bounded<RoleRollingRow>("Rolling line combinations", STANDOUT_LIMITS.rolling, (start, end) => client.from("rolling_player_game_metrics").select(ROLE_ROLLING_COLUMNS.join(","), { count: "exact" }).eq("season", season).eq("strength_state", "all").in("game_id", gameIds).order("game_id", { ascending: true }).order("player_id", { ascending: true }).range(start, end));
  const pp = await bounded<RolePpRow>("Power-play combinations", STANDOUT_LIMITS.pp, (start, end) => client.from("powerPlayCombinations").select(ROLE_PP_COLUMNS.join(","), { count: "exact" }).in("gameId", gameIds).order("gameId", { ascending: true }).order("playerId", { ascending: true }).range(start, end));
  return buildLastNightsStandouts({ ...shared, appearances, nstCounts, nstOnIce, role: { rolling, pp } });
}
