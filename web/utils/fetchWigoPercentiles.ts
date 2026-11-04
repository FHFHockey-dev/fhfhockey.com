import supabase from "lib/supabase";
import type { QueryClient } from "@tanstack/react-query";
import { fetchAllSupabasePages } from "lib/supabase/pagination";
import { fetchPlayerPerGameTotals } from "utils/fetchWigoPlayerStats";
import {
  PercentileStrength,
  OffensePercentileTable,
  PlayerRawStats
} from "components/WiGO/types";
import { WIGO_QUERY_DEFAULTS } from "components/WiGO/queryDefaults";

const PAGE_SIZE = 500;
// A fallback season is used only if it reached the panel's default minimum
// GP and the selected player's own row did too. A 3-GP row in a stub season
// with max GP 5 ranked McDavid 1st of 1 on every stat (C-23).
const FALLBACK_MIN_GP = 10;

const ALL_OFFENSE_COLUMNS_TO_SELECT = `
    player_id, season, gp, toi_seconds,
    goals_per_60, total_assists_per_60, total_points_per_60, shots_per_60,
    iscfs_per_60, i_hdcf_per_60, ixg_per_60, icf_per_60,
    cf_per_60, scf_per_60, oi_hdcf_per_60,
    cf_pct, ff_pct, sf_pct, gf_pct, xgf_pct, scf_pct, hdcf_pct
`;


interface OffenseRow {
  player_id: number;
  season: number | string | null;
  gp: number | null;
  toi_seconds: number | null;
  goals_per_60?: number | null;
  total_assists_per_60?: number | null;
  total_points_per_60?: number | null;
  shots_per_60?: number | null;
  iscfs_per_60?: number | null;
  i_hdcf_per_60?: number | null;
  ixg_per_60?: number | null;
  icf_per_60?: number | null;
  cf_per_60?: number | null;
  scf_per_60?: number | null;
  oi_hdcf_per_60?: number | null;
  cf_pct?: number | null;
  ff_pct?: number | null;
  sf_pct?: number | null;
  gf_pct?: number | null;
  xgf_pct?: number | null;
  scf_pct?: number | null;
  hdcf_pct?: number | null;
}


export interface PercentileCohortResult {
  stats: PlayerRawStats[];
  requestedSeasonId: number;
  appliedSeasonId: number;
  fallbackReason: string | null;
  canonicalPlayerGp: number | null;
}

async function fetchPercentileRows<T>(
  tableName: OffensePercentileTable,
  selectColumns: string,
  seasonId: number,
  filterPositiveGp = false
): Promise<T[]> {
  return fetchAllSupabasePages<T>(({ from, to }) => {
    let query = (supabase as any)
      .from(tableName)
      .select(selectColumns)
      .eq("season", seasonId)
      .order("player_id", { ascending: true });

    if (filterPositiveGp) {
      query = query.gt("gp", 0);
    }

    return query.range(from, to);
  }, { pageSize: PAGE_SIZE });
}

async function fetchCanonicalPlayerGp(
  playerId: number,
  seasonId: number
): Promise<number | null> {
  const { data, error } = await (supabase as any)
    .from("wgo_skater_stats_totals")
    .select("games_played")
    .eq("player_id", playerId)
    .eq("season", String(seasonId))
    .maybeSingle();

  if (error) {
    throw error;
  }

  const gamesPlayed = data?.games_played;
  return typeof gamesPlayed === "number" ? gamesPlayed : null;
}

async function fetchCanonicalSeasonMaxGp(seasonId: number): Promise<number> {
  const { data, error } = await (supabase as any)
    .from("wgo_skater_stats_totals")
    .select("games_played")
    .eq("season", String(seasonId))
    .order("games_played", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return typeof data?.games_played === "number" ? data.games_played : 0;
}

function getPreviousSeasonId(seasonId: number): number {
  const seasonStart = Math.floor(seasonId / 10000);
  const seasonEnd = seasonId % 10000;

  return (seasonStart - 1) * 10000 + (seasonEnd - 1);
}

function isPercentileSeasonIncomplete(args: {
  canonicalPlayerGp: number | null;
  percentilePlayerGp: number | null;
  canonicalSeasonMaxGp: number;
  percentileSeasonMaxGp: number;
}): boolean {
  const {
    canonicalPlayerGp,
    percentilePlayerGp,
    canonicalSeasonMaxGp,
    percentileSeasonMaxGp
  } = args;

  const playerSeasonLooksStale =
    canonicalPlayerGp !== null &&
    canonicalPlayerGp >= 10 &&
    (percentilePlayerGp === null ||
      percentilePlayerGp <=
        Math.max(4, Math.floor(canonicalPlayerGp * 0.35)));

  const cohortLooksStale =
    canonicalSeasonMaxGp >= 20 &&
    percentileSeasonMaxGp <=
      Math.max(10, Math.floor(canonicalSeasonMaxGp * 0.35));

  return playerSeasonLooksStale || cohortLooksStale;
}

/**
 * NST per-strength GP can exceed what WGO says anyone played that season (seen live: GP 102 in an
 * 82-game season). Such a GP is unusable: the selected player falls back to their canonical WGO GP,
 * and other rows lose their GP, which keeps them out of min-GP filters, TOI/GP and the staleness check.
 */
export function sanitizePercentileCohortGp(
  stats: PlayerRawStats[],
  {
    playerId,
    canonicalPlayerGp,
    canonicalSeasonMaxGp
  }: { playerId: number; canonicalPlayerGp: number | null; canonicalSeasonMaxGp: number }
): PlayerRawStats[] {
  return stats.map((row) => {
    const gp = row.gp;
    if (gp == null) return row;
    if (row.player_id === playerId && canonicalPlayerGp !== null && gp > canonicalPlayerGp) {
      return { ...row, gp: canonicalPlayerGp };
    }
    if (canonicalSeasonMaxGp > 0 && gp > canonicalSeasonMaxGp) {
      return { ...row, gp: null };
    }
    return row;
  });
}

/**
 * Fetches the season-specific percentile cohort used by the WiGO percentile panel.
 */
export async function fetchAllPlayerStatsForStrength(
  strength: PercentileStrength,
  seasonId: number
): Promise<PlayerRawStats[]> {
  const offenseTable =
    `nst_percentile_${strength}_offense` as OffensePercentileTable;

  try {
    // Offense rows carry GP and TOI themselves (and are read with gp > 0), so
    // the defense table, which only supplied those two, is not read (S5).
    const offenseData = await fetchPercentileRows<OffenseRow>(
      offenseTable,
      ALL_OFFENSE_COLUMNS_TO_SELECT,
      seasonId,
      true
    );

    return offenseData.map(
      (offensePlayer: OffenseRow) =>
        ({
          ...offensePlayer,
          gp: offensePlayer.gp ?? null,
          toi: offensePlayer.toi_seconds ?? null
        }) as PlayerRawStats
    );
  } catch (err) {
    console.error(
      `Error fetching all player stats for strength ${strength}:`,
      err
    );
    throw err;
  }
}

export async function fetchPercentileCohortForPlayer(
  strength: PercentileStrength,
  seasonId: number,
  playerId: number,
  queryClient?: QueryClient
): Promise<PercentileCohortResult> {
  // League inputs are independent of the selected player and minimum-GP filter.
  const fetchSeasonStats = (requestedSeason: number) =>
    queryClient
      ? queryClient.fetchQuery({
          queryKey: ["wigoPercentileCohort", strength, requestedSeason],
          queryFn: () => fetchAllPlayerStatsForStrength(strength, requestedSeason),
          staleTime: WIGO_QUERY_DEFAULTS.staleTime
        })
      : fetchAllPlayerStatsForStrength(strength, requestedSeason);
  // With a client, the player's GP comes from the dashboard's shared per-game
  // totals query, so this season's totals row is read once (S5).
  const fetchPlayerGp = (requestedSeason: number) =>
    queryClient
      ? queryClient
          .fetchQuery({
            queryKey: ["wigoPerGameTotals", playerId, requestedSeason],
            queryFn: () => fetchPlayerPerGameTotals(playerId, requestedSeason),
            staleTime: WIGO_QUERY_DEFAULTS.staleTime
          })
          .then((totals) =>
            typeof totals?.games_played === "number" ? totals.games_played : null
          )
      : fetchCanonicalPlayerGp(playerId, requestedSeason);
  const fetchSeasonMaxGp = (requestedSeason: number) =>
    queryClient
      ? queryClient.fetchQuery({
          queryKey: ["wigoPercentileSeasonMaxGp", requestedSeason],
          queryFn: () => fetchCanonicalSeasonMaxGp(requestedSeason),
          staleTime: WIGO_QUERY_DEFAULTS.staleTime
        })
      : fetchCanonicalSeasonMaxGp(requestedSeason);
  const [rawRequestedStats, canonicalPlayerGp, canonicalSeasonMaxGp] =
    await Promise.all([
      fetchSeasonStats(seasonId),
      fetchPlayerGp(seasonId),
      fetchSeasonMaxGp(seasonId)
    ]);

  const requestedStats = sanitizePercentileCohortGp(rawRequestedStats, {
    playerId,
    canonicalPlayerGp,
    canonicalSeasonMaxGp
  });
  const percentilePlayerGp =
    requestedStats.find((player) => player.player_id === playerId)?.gp ?? null;
  const percentileSeasonMaxGp = requestedStats.reduce(
    (max, player) => Math.max(max, player.gp ?? 0),
    0
  );

  if (
    !isPercentileSeasonIncomplete({
      canonicalPlayerGp,
      percentilePlayerGp,
      canonicalSeasonMaxGp,
      percentileSeasonMaxGp
    })
  ) {
    return {
      stats: requestedStats,
      requestedSeasonId: seasonId,
      appliedSeasonId: seasonId,
      fallbackReason: null,
      canonicalPlayerGp
    };
  }

  const fallbackSeasonId = getPreviousSeasonId(seasonId);
  const [rawFallbackStats, fallbackPlayerGp, fallbackSeasonMaxGp] =
    await Promise.all([
      fetchSeasonStats(fallbackSeasonId),
      fetchPlayerGp(fallbackSeasonId),
      fetchSeasonMaxGp(fallbackSeasonId)
    ]);
  // The fallback season gets the same GP check as the requested one (C-34).
  const fallbackStats = sanitizePercentileCohortGp(rawFallbackStats, {
    playerId,
    canonicalPlayerGp: fallbackPlayerGp,
    canonicalSeasonMaxGp: fallbackSeasonMaxGp
  });
  const fallbackRowGp =
    fallbackStats.find((player) => player.player_id === playerId)?.gp ?? null;
  const fallbackCohortMaxGp = fallbackStats.reduce(
    (max, player) => Math.max(max, player.gp ?? 0),
    0
  );

  if (
    fallbackRowGp === null ||
    fallbackRowGp < FALLBACK_MIN_GP ||
    fallbackCohortMaxGp < FALLBACK_MIN_GP
  ) {
    return {
      stats: requestedStats,
      requestedSeasonId: seasonId,
      appliedSeasonId: seasonId,
      fallbackReason:
        "Current-season percentile data appears incomplete and no usable fallback cohort was available.",
      canonicalPlayerGp
    };
  }

  return {
    stats: fallbackStats,
    requestedSeasonId: seasonId,
    appliedSeasonId: fallbackSeasonId,
    fallbackReason: `Current-season percentile data is incomplete for ${strength.toUpperCase()}. Showing ${fallbackSeasonId} player values and league cohort; these are not ${seasonId} player values.`,
    canonicalPlayerGp
  };
}
