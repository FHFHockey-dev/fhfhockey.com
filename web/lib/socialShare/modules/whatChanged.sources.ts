import { bounded } from "lib/socialShare/trendSources";
import type { SharePostContext, SharePostLoadResult, SharePostReadClient } from "./contract";
import { readCompletedTeamGames } from "./shared/goalieLedger.sources";
import { readSkaterAppearances } from "./shared/skaterAppearances.sources";
import { buildWhatChanged, matchPlayer, NST_COUNT_COLUMNS, NST_ON_ICE_COLUMNS, shareThrough, usesNstCounts, usesOnIce, type NstCountRow, type NstOnIceRow, type WhatChangedData, type WhatChangedSettings } from "./whatChanged";

/**
 * Season-to-date ceilings, all failing closed. Today's table is 7,775 skater rows; a full season is about 46,000
 * (1,312 games × 2 × 18 skaters plus trades and call-ups). The whole league's NST is read only when an NST metric ranks.
 * Otherwise NST is read for the players shown: the one selected, or those on the boards (12 players, at most 100 rows each).
 */
export const WHAT_CHANGED_LIMITS = { skaterRows: 50000, nstRows: 50000, boardNstRows: 1200, teamGames: 2800, schedule: 1400 } as const;

export async function readSchedule(client: SharePostReadClient, scope: { season: number; through: string }) {
  const rows = await bounded<{ id: number; date: string }>("Schedule", WHAT_CHANGED_LIMITS.schedule, (from, to) => client.from("games").select("id,date", { count: "exact" }).eq("seasonId", scope.season).eq("type", 2).lte("date", scope.through).order("id").range(from, to));
  return rows.map(row => ({ gameId: row.id, date: row.date }));
}
const readNst = <Row>(what: string, table: string, columns: readonly string[], client: SharePostReadClient, scope: { season: number; through: string; playerId: number | null; playerIds?: readonly number[] }) =>
  bounded<Row>(what, scope.playerIds ? WHAT_CHANGED_LIMITS.boardNstRows : WHAT_CHANGED_LIMITS.nstRows, (from, to) => {
    let query = client.from(table).select(columns.join(","), { count: "exact" }).eq("season", scope.season).lte("date_scraped", scope.through);
    if (scope.playerId !== null) query = query.eq("player_id", scope.playerId);
    if (scope.playerIds) query = query.in("player_id", [...scope.playerIds]);
    return query.order("date_scraped", { ascending: true }).order("player_id", { ascending: true }).range(from, to);
  });

export async function loadWhatChanged({ client, generatedAt }: SharePostContext, settings: WhatChangedSettings): Promise<SharePostLoadResult<WhatChangedData>> {
  const { through, season, from } = shareThrough(generatedAt);
  const appearances = await readSkaterAppearances(client, { season, from, through, limit: WHAT_CHANGED_LIMITS.skaterRows });
  const completedTeamGames = await readCompletedTeamGames(client, { season, from, through, limit: WHAT_CHANGED_LIMITS.teamGames });
  const scheduledGames = await readSchedule(client, { season, through });
  const { playerId } = matchPlayer(appearances, settings.player);
  const rankCounts = usesNstCounts(settings.metric), rankOnIce = usesOnIce(settings.metric);
  const nstCounts = rankCounts || playerId !== null ? await readNst<NstCountRow>("NST individual counts", "nst_gamelog_as_counts", NST_COUNT_COLUMNS, client, { season, through, playerId: rankCounts ? null : playerId }) : null;
  const nstOnIce = rankOnIce || playerId !== null ? await readNst<NstOnIceRow>("NST on-ice counts", "nst_gamelog_as_counts_oi", NST_ON_ICE_COLUMNS, client, { season, through, playerId: rankOnIce ? null : playerId }) : null;
  const input = { appearances, nstCounts, nstOnIce, completedTeamGames, scheduledGames, through, settings };
  if (nstCounts || nstOnIce) return buildWhatChanged(input);
  // A WGO metric ranks without NST, so the boards are known before reading the underlying tile for the players on them.
  const { risers = [], fallers = [] } = buildWhatChanged(input).data ?? {}, playerIds = [...risers, ...fallers].map(row => row.playerId);
  if (!playerIds.length) return buildWhatChanged(input);
  return buildWhatChanged({ ...input, nstCounts: await readNst<NstCountRow>("NST individual counts", "nst_gamelog_as_counts", NST_COUNT_COLUMNS, client, { season, through, playerId: null, playerIds }) });
}
