// Season-level NST values for the /stats/player radar league comparison.
//
// The radar is 5v5 (decision 15). It ranks a skater's 5v5 season row against every
// skater's 5v5 season row, from the regular-season NST 5v5 views (one row per
// player-season; L4a's migration, NULL for unknown values):
//   nst_seasonlong_5v5_rates      individual per-60 rates and toi_seconds
//   nst_seasonlong_5v5_counts_oi  on-ice for/against counts and toi_seconds_oi
// The player's own value and the cohort's come from the same view, season and
// sample minimum, and the player is always one member of the cohort, so a rank
// can never exceed the cohort size.

export type NstRadarView = "nst_seasonlong_5v5_rates" | "nst_seasonlong_5v5_counts_oi";

export const RADAR_STRENGTH_LABEL = "5v5";

type NstRow = Record<string, unknown>;

interface NstRadarStat {
  view: NstRadarView;
  columns: string[];
  // Smallest sample a league row needs before it counts in the ranking.
  leagueMin: { column: string; value: number } | null;
  value: (row: NstRow) => number | null;
}

const MIN_TOI_SECONDS = 3600; // one hour of ice time before a per-60 rate counts

const finite = (value: unknown): number | null => {
  const n = typeof value === "string" ? Number(value) : value;
  return typeof n === "number" && Number.isFinite(n) ? n : null;
};

const share = (forCol: string, againstCol: string) => (row: NstRow) => {
  const f = finite(row[forCol]);
  const a = finite(row[againstCol]);
  if (f === null || a === null || f + a <= 0) return null;
  return (f / (f + a)) * 100;
};

const onIceShare = (forCol: string, againstCol: string, minEvents: number): NstRadarStat => ({
  view: "nst_seasonlong_5v5_counts_oi",
  columns: [forCol, againstCol],
  leagueMin: { column: `${forCol}+${againstCol}`, value: minEvents },
  value: share(forCol, againstCol),
});

const rate = (column: string): NstRadarStat => ({
  view: "nst_seasonlong_5v5_rates",
  columns: [column, "toi_seconds"],
  leagueMin: { column: "toi_seconds", value: MIN_TOI_SECONDS },
  value: (row) => finite(row[column]),
});

const onIcePer60 = (column: string): NstRadarStat => ({
  view: "nst_seasonlong_5v5_counts_oi",
  columns: [column, "toi_seconds_oi"],
  leagueMin: { column: "toi_seconds_oi", value: MIN_TOI_SECONDS },
  value: (row) => {
    const count = finite(row[column]);
    const toi = finite(row.toi_seconds_oi);
    return count === null || toi === null || toi <= 0 ? null : (count * 3600) / toi;
  },
});

export const NST_RADAR_STATS: Record<string, NstRadarStat> = {
  cf_pct: onIceShare("cf", "ca", 20),
  ff_pct: onIceShare("ff", "fa", 15),
  sf_pct: onIceShare("sf", "sa", 10),
  gf_pct: onIceShare("gf", "ga", 1),
  xgf_pct: onIceShare("xgf", "xga", 1),
  goals_per_60: rate("goals_per_60"),
  total_assists_per_60: rate("total_assists_per_60"),
  total_points_per_60: rate("total_points_per_60"),
  shots_per_60: rate("shots_per_60"),
  ixg_per_60: rate("ixg_per_60"),
  icf_per_60: rate("icf_per_60"),
  // NST's HDCF/60 is on-ice (decision 9): the team's high-danger chances while he is on.
  hdcf_per_60: onIcePer60("hdcf"),
  hits_per_60: rate("hits_per_60"),
  pim_per_60: rate("pim_per_60"),
  // On-ice high-danger chances against per 60.
  hdca_per_60: onIcePer60("hdca"),
};

export const isNstRadarStat = (stat: string) => stat in NST_RADAR_STATS;

const meetsLeagueMin = (stat: NstRadarStat, row: NstRow) => {
  if (!stat.leagueMin) return true;
  const total = stat.leagueMin.column
    .split("+")
    .reduce<number | null>((sum, col) => {
      const v = finite(row[col]);
      return sum === null || v === null ? null : sum + v;
    }, 0);
  return total !== null && total >= stat.leagueMin.value;
};

/** The stat's value for one NST season row, or null when unknown or below the sample minimum. */
export function nstRadarStatValue(stat: string, row: NstRow | null | undefined) {
  const def = NST_RADAR_STATS[stat];
  if (!def || !row) return null;
  if (!meetsLeagueMin(def, row)) return null;
  return def.value(row);
}

/** Plain-language sample minimum for a stat, for the "below the minimum" note. */
export function nstRadarMinimumLabel(stat: string) {
  const min = NST_RADAR_STATS[stat]?.leagueMin;
  if (!min) return null;
  if (min.column.startsWith("toi_seconds")) return `${min.value / 60} min of ${RADAR_STRENGTH_LABEL} ice time`;
  return `${min.value} on-ice ${RADAR_STRENGTH_LABEL} events`;
}

// The subset of the Supabase query builder this module uses.
interface QueryLike extends PromiseLike<{ data: unknown; error: unknown }> {
  eq(column: string, value: unknown): QueryLike;
  in(column: string, values: unknown[]): QueryLike;
}
export interface SupabaseLike {
  from(table: string): { select(columns: string): QueryLike };
}

export interface NstRadarSeason {
  rowsByView: Partial<Record<NstRadarView, { rows: NstRow[]; error: unknown }>>;
  /** Player ids in the requested positions, or null for no position filter. */
  allowedPlayerIds: Set<number> | null;
  positionError: unknown;
}

/**
 * Reads the NST season rows the requested stats need: one query per view, plus one
 * WGO read for the position filter (the NST views carry no position).
 */
export async function fetchNstRadarSeason(
  client: SupabaseLike,
  season: number,
  stats: string[],
  positionFilter: string[],
): Promise<NstRadarSeason> {
  const columnsByView = new Map<NstRadarView, Set<string>>();
  stats.forEach((stat) => {
    const def = NST_RADAR_STATS[stat];
    if (!def) return;
    const cols = columnsByView.get(def.view) ?? new Set(["player_id"]);
    def.columns.forEach((col) => cols.add(col));
    columnsByView.set(def.view, cols);
  });

  const read = async (query: PromiseLike<{ data: unknown; error: unknown }>) => {
    try {
      const { data, error } = await query;
      return { rows: Array.isArray(data) ? (data as NstRow[]) : [], error };
    } catch (error) {
      return { rows: [], error };
    }
  };

  const views = [...columnsByView.keys()];
  const [viewResults, positions] = await Promise.all([
    Promise.all(
      views.map((view) =>
        read(client.from(view).select([...columnsByView.get(view)!].join(",")).eq("season", season)),
      ),
    ),
    positionFilter.length === 0 || views.length === 0
      ? Promise.resolve(null)
      : read(
          client
            .from("wgo_skater_stats_per_game")
            .select("player_id")
            .eq("season", String(season))
            .in("position_code", positionFilter),
        ),
  ]);

  const rowsByView: NstRadarSeason["rowsByView"] = {};
  views.forEach((view, i) => { rowsByView[view] = viewResults[i]; });
  return {
    rowsByView,
    allowedPlayerIds: positions
      ? new Set(positions.rows.map((row) => Number(row.player_id)).filter(Number.isFinite))
      : null,
    positionError: positions?.error ?? null,
  };
}

/**
 * The player's value and the other cohort members' values for one stat, all under
 * the same view, season and sample minimum. The player's own row is left out of
 * `peerValues` (the caller adds the player once). A failed read or a missing player
 * row leaves the stat unranked ("No 5v5 comparison data"); a player row below the
 * minimum is unranked too and reported as `belowMinimum`.
 */
export function nstRadarComparison(stat: string, season: NstRadarSeason, playerId: number) {
  const def = NST_RADAR_STATS[stat];
  const result = def ? season.rowsByView[def.view] : undefined;
  if (!def || !result || result.error || season.positionError) {
    return {
      playerValue: null, peerValues: [] as number[], belowMinimum: false,
      error: result?.error ?? season.positionError ?? null,
    };
  }
  const playerRow = result.rows.find((row) => Number(row.player_id) === playerId);
  const peerValues = result.rows
    .filter((row) => Number(row.player_id) !== playerId)
    .filter((row) => !season.allowedPlayerIds || season.allowedPlayerIds.has(Number(row.player_id)))
    .map((row) => nstRadarStatValue(stat, row))
    .filter((v): v is number => v !== null);
  const playerValue = nstRadarStatValue(stat, playerRow);
  const belowMinimum =
    playerValue === null && !!playerRow && def.value(playerRow) !== null && !meetsLeagueMin(def, playerRow);
  return { playerValue, peerValues, belowMinimum, error: null };
}
