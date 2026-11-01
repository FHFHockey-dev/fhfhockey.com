import { bounded } from "lib/socialShare/trendSources";
import { skaterSeasonScope } from "./bshBoard";
import { SKATER_SEASON_LIMITS } from "./bshBoard.sources";
import type { SharePostContext, SharePostLoadResult } from "./contract";
import { buildMultiCatStars, type MultiCatData, type MultiCatGame, type MultiCatSeason, type MultiCatSettings } from "./multiCatStars";
import { readCompletedTeamGames } from "./shared/goalieLedger.sources";
import { SKATER_APPEARANCE_COLUMNS, toSkaterAppearances, type SkaterAppearanceRow } from "./shared/skaterAppearances";

type MultiCatRow = SkaterAppearanceRow & { plus_minus: number | null };
const COLUMNS = [...SKATER_APPEARANCE_COLUMNS, "plus_minus"].join(",");

/** A SELECT over one season of wgo_skater_stats, plus the games that prove the feed is complete. Over a ceiling it fails closed. */
export async function readMultiCatSeason({ client, generatedAt }: SharePostContext): Promise<MultiCatSeason> {
  const { season, from, through } = skaterSeasonScope(generatedAt);
  const [rows, teamGames, scheduled] = await Promise.all([
    bounded<MultiCatRow>("Skater appearances", SKATER_SEASON_LIMITS.appearances, (start, end) => client.from("wgo_skater_stats").select(COLUMNS, { count: "exact" }).eq("season_id", season).gte("date", from).lte("date", through).order("date", { ascending: true }).order("game_id", { ascending: true }).order("player_id", { ascending: true }).range(start, end)),
    readCompletedTeamGames(client, { season, from, through, limit: SKATER_SEASON_LIMITS.teamGames }),
    bounded<{ id: number }>("Schedule", SKATER_SEASON_LIMITS.scheduledGames, (start, end) => client.from("games").select("id", { count: "exact" }).eq("seasonId", season).eq("type", 2).gte("date", from).lte("date", through).order("id").range(start, end)),
  ]);
  const plusMinus = new Map(rows.map(row => [`${row.player_id}:${row.game_id}`, row.plus_minus]));
  const appearances: MultiCatGame[] = toSkaterAppearances(rows, { season, through }).map(row => ({ ...row, plusMinus: plusMinus.get(`${row.playerId}:${row.gameId}`) ?? null }));
  return { appearances, teamGames, scheduledGames: scheduled.length, through };
}

export async function loadMultiCatStars(context: SharePostContext, settings: MultiCatSettings): Promise<SharePostLoadResult<MultiCatData>> {
  return buildMultiCatStars(await readMultiCatSeason(context), settings);
}
