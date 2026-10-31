import { bounded as boundedRead } from "lib/socialShare/trendSources";
import type { SharePostReadClient } from "../contract";
import { SKATER_APPEARANCE_COLUMNS, toSkaterAppearances, type SkaterAppearanceRow } from "./skaterAppearances";

/** Bounded, exact-count read of wgo_skater_stats; narrow it by date or player ids, and over `limit` rows it fails closed. */
export async function readSkaterAppearances(client: SharePostReadClient, scope: { season: number; from: string; through: string; playerIds?: readonly number[]; limit: number }) {
  const rows = await boundedRead<SkaterAppearanceRow>("Skater appearances", scope.limit, (from, to) => {
    let query = client.from("wgo_skater_stats").select(SKATER_APPEARANCE_COLUMNS.join(","), { count: "exact" }).eq("season_id", scope.season).gte("date", scope.from).lte("date", scope.through);
    if (scope.playerIds) query = query.in("player_id", [...scope.playerIds]);
    return query.order("date", { ascending: true }).order("game_id", { ascending: true }).order("player_id", { ascending: true }).range(from, to);
  });
  return toSkaterAppearances(rows, scope);
}
