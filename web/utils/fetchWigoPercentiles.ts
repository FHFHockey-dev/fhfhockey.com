import supabase from "lib/supabase";
import {
  PercentileStrength,
  OffensePercentileTable,
  DefensePercentileTable,
  PlayerRawStats
} from "components/WiGO/types";

const PAGE_SIZE = 500;

const ALL_OFFENSE_COLUMNS_TO_SELECT = `
    player_id, season, gp, toi_seconds,
    goals_per_60, total_assists_per_60, total_points_per_60, shots_per_60,
    iscfs_per_60, i_hdcf_per_60, ixg_per_60, icf_per_60,
    cf_per_60, scf_per_60, oi_hdcf_per_60,
    cf_pct, ff_pct, sf_pct, gf_pct, xgf_pct, scf_pct, hdcf_pct
`;

const ALL_DEFENSE_COLUMNS_TO_SELECT = `
    player_id, season, gp, toi_seconds
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

interface DefenseRow {
  player_id: number;
  season: number | string | null;
  gp: number | null;
  toi_seconds: number | null;
}

export interface PercentileCohortResult {
  stats: PlayerRawStats[];
  requestedSeasonId: number;
  appliedSeasonId: number;
  fallbackReason: string | null;
  canonicalPlayerGp: number | null;
}

async function fetchPercentileRows<T>(
  tableName: OffensePercentileTable | DefensePercentileTable,
  selectColumns: string,
  seasonId: number,
  filterPositiveGp = false
): Promise<T[]> {
  const allRows: T[] = [];
  let page = 0;

  while (true) {
    let query = (supabase as any)
      .from(tableName)
      .select(selectColumns)
      .eq("season", seasonId)
      .order("player_id", { ascending: true });

    if (filterPositiveGp) {
      query = query.gt("gp", 0);
    }

    const from = page * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;
    const { data, error } = await query.range(from, to);

    if (error) {
      throw error;
    }

    const rows = (data as T[] | null) ?? [];
    allRows.push(...rows);

    if (rows.length < PAGE_SIZE) {
      break;
    }

    page += 1;
  }

  return allRows;
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
    console.warn("Failed to fetch canonical player GP:", error.message);
    return null;
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
    console.warn("Failed to fetch canonical season max GP:", error.message);
    return 0;
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
 * Fetches the season-specific percentile cohort used by the WiGO percentile panel.
 */
export async function fetchAllPlayerStatsForStrength(
  strength: PercentileStrength,
  seasonId: number
): Promise<PlayerRawStats[]> {
  const offenseTable =
    `nst_percentile_${strength}_offense` as OffensePercentileTable;
  const defenseTable =
    `nst_percentile_${strength}_defense` as DefensePercentileTable;

  try {
    const [offenseData, defenseRows] = await Promise.all([
      fetchPercentileRows<OffenseRow>(
        offenseTable,
        ALL_OFFENSE_COLUMNS_TO_SELECT,
        seasonId,
        true
      ),
      fetchPercentileRows<DefenseRow>(
        defenseTable,
        ALL_DEFENSE_COLUMNS_TO_SELECT,
        seasonId
      )
    ]);
    const defenseDataById = new Map<number, DefenseRow>(
      defenseRows.map((d: DefenseRow) => [Number(d.player_id), d])
    );

    const combinedData: PlayerRawStats[] = offenseData.map(
      (offensePlayer: OffenseRow) => {
        const defensePlayer = defenseDataById.get(
          Number(offensePlayer.player_id)
        );
        return {
          ...offensePlayer,
          gp: (offensePlayer.gp as number | null) ?? defensePlayer?.gp ?? null,
          toi:
            (offensePlayer.toi_seconds as number | null) ??
            defensePlayer?.toi_seconds ??
            null
        } as PlayerRawStats;
      }
    );

    return combinedData;
  } catch (err) {
    console.error(
      `Error fetching all player stats for strength ${strength}:`,
      err
    );
    return [];
  }
}

export async function fetchPercentileCohortForPlayer(
  strength: PercentileStrength,
  seasonId: number,
  playerId: number
): Promise<PercentileCohortResult> {
  const [requestedStats, canonicalPlayerGp, canonicalSeasonMaxGp] =
    await Promise.all([
      fetchAllPlayerStatsForStrength(strength, seasonId),
      fetchCanonicalPlayerGp(playerId, seasonId),
      fetchCanonicalSeasonMaxGp(seasonId)
    ]);

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
  const fallbackStats = await fetchAllPlayerStatsForStrength(
    strength,
    fallbackSeasonId
  );
  const fallbackHasPlayer = fallbackStats.some(
    (player) => player.player_id === playerId
  );

  if (!fallbackStats.length || !fallbackHasPlayer) {
    return {
      stats: requestedStats,
      requestedSeasonId: seasonId,
      appliedSeasonId: seasonId,
      fallbackReason:
        "Current-season percentile data appears incomplete and no fallback cohort was available.",
      canonicalPlayerGp
    };
  }

  return {
    stats: fallbackStats,
    requestedSeasonId: seasonId,
    appliedSeasonId: fallbackSeasonId,
    fallbackReason: `Current-season percentile data is incomplete for ${strength.toUpperCase()}. Using ${fallbackSeasonId} percentile cohort while ${seasonId} catches up.`,
    canonicalPlayerGp
  };
}
