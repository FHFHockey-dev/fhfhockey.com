import { bounded } from "lib/socialShare/trendSources";
import { periodMissing, readSkaterPeriod, readSkaterSeason } from "./bshBoard.sources";
import { skaterSeasonScope } from "./bshBoard";
import type { SharePostContext, SharePostLoadResult } from "./contract";
import { buildNightlyFloor, ownershipByPlayer, type NightlyFloorData, type NightlyFloorSettings, type OwnershipMapRow, type YahooOwnershipRow } from "./nightlyFloor";

/** 1,608 and 2,373 rows on 2026-10-31. Over these ceilings the post fails closed rather than ranking on part of the map. */
export const OWNERSHIP_LIMITS = { yahoo: 2500, map: 3500 };

export async function loadNightlyFloor(context: SharePostContext, settings: NightlyFloorSettings): Promise<SharePostLoadResult<NightlyFloorData>> {
  const { client, generatedAt } = context, yahooSeason = Math.floor(skaterSeasonScope(generatedAt).season / 10000);
  const { period, reason } = await readSkaterPeriod(context, settings);
  if (reason) return periodMissing(reason);
  const [season, yahoo, map] = await Promise.all([
    readSkaterSeason(context, period),
    bounded<YahooOwnershipRow>("Yahoo ownership", OWNERSHIP_LIMITS.yahoo, (start, end) => client.from("yahoo_players").select("player_key,player_id,percent_ownership,last_updated", { count: "exact" }).eq("season", yahooSeason).order("player_key").range(start, end)),
    bounded<OwnershipMapRow>("Yahoo to NHL id map", OWNERSHIP_LIMITS.map, (start, end) => client.from("yahoo_nhl_player_map_read").select("yahoo_player_id,nhl_player_id", { count: "exact" }).order("yahoo_player_id").order("nhl_player_id").range(start, end)),
  ]);
  const updatedAt = yahoo.reduce<string | null>((latest, row) => row.last_updated && (!latest || row.last_updated > latest) ? row.last_updated : latest, null);
  return buildNightlyFloor(season, settings, { byPlayer: ownershipByPlayer(map, yahoo), updatedAt });
}
