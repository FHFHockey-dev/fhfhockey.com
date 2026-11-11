// Joins one WGO skater game row with the four NST all-situations game-log
// rows for the same date. Besides the display rates and shares, it carries
// the source-matched NST primitives (counts and TOI seconds) so a window can
// be pooled: per-60 by TOI and shares by their own denominators.
//
// Units (rule 17): NST `toi` is seconds (update-nst-gamelog parses mm:ss to
// seconds); NST shares are percentage points. PDO is rebuilt here from the
// on-ice counts on the 1.000 index (on-ice SH + SV as fractions), so a game
// and a pooled window share one declared scale.

type NstRow = Record<string, any>;

/** Individual NST counts (nst_gamelog_as_counts), carried as `nst_<column>`. */
export const NST_INDIVIDUAL_PRIMITIVES = [
  "toi",
  "goals",
  "total_assists",
  "first_assists",
  "second_assists",
  "total_points",
  "shots",
  "ixg",
  "icf",
  "iff",
  "iscfs",
  "hdcf",
  "rush_attempts",
  "rebounds_created",
  "shots_blocked",
  "pim",
  "total_penalties",
  "penalties_drawn",
  "giveaways",
  "takeaways",
  "hits"
] as const;

/** On-ice NST counts (nst_gamelog_as_counts_oi), carried as `nst_oi_<column>`. */
export const NST_ON_ICE_PRIMITIVES = [
  "toi",
  "cf",
  "ca",
  "ff",
  "fa",
  "sf",
  "sa",
  "gf",
  "ga",
  "xgf",
  "xga",
  "scf",
  "sca",
  "hdcf",
  "hdca",
  "mdcf",
  "mdca",
  "ldcf",
  "ldca",
  "off_zone_starts",
  "neu_zone_starts",
  "def_zone_starts",
  "off_zone_faceoffs",
  "def_zone_faceoffs"
] as const;

const value = (row: NstRow, key: string) => row[key] ?? null;

/**
 * Index NST rows by date. Two rows for one date are ambiguous, so that date
 * is treated as missing rather than resolved by row order.
 */
export function indexNstRowsByDate(rows: NstRow[] | null | undefined): Map<string, NstRow | null> {
  const byDate = new Map<string, NstRow | null>();
  for (const row of rows ?? []) {
    const key = String(row.date_scraped ?? "").slice(0, 10);
    if (!key) continue;
    byDate.set(key, byDate.has(key) ? null : row);
  }
  return byDate;
}

export interface NstGameRows {
  counts?: NstRow | null;
  countsOi?: NstRow | null;
  rates?: NstRow | null;
  ratesOi?: NstRow | null;
}

export function mergeNstGameRow<T extends Record<string, any>>(
  wgoGame: T,
  nst: NstGameRows
): T & Record<string, number | null> {
  const nstCounts = nst.counts ?? {};
  const nstCountsOi = nst.countsOi ?? {};
  const nstRates = nst.rates ?? {};
  const nstRatesOi = nst.ratesOi ?? {};

  // Zone-start shares of all starts; a known zero count is a valid zero.
  const oz = value(nstCountsOi, "off_zone_starts");
  const nz = value(nstCountsOi, "neu_zone_starts");
  const dz = value(nstCountsOi, "def_zone_starts");
  const totalStarts = oz !== null && nz !== null && dz !== null ? oz + nz + dz : null;
  const startShare = (part: number | null) =>
    part !== null && totalStarts ? (part / totalStarts) * 100 : null;

  const gf = value(nstCountsOi, "gf");
  const sf = value(nstCountsOi, "sf");
  const sa = value(nstCountsOi, "sa");
  const ga = value(nstCountsOi, "ga");
  const pdo =
    gf !== null && sf !== null && sa !== null && ga !== null && sf > 0 && sa > 0
      ? gf / sf + (sa - ga) / sa
      : null;

  const primitives: Record<string, number | null> = {};
  for (const column of NST_INDIVIDUAL_PRIMITIVES) {
    primitives[`nst_${column}`] = value(nstCounts, column);
  }
  for (const column of NST_ON_ICE_PRIMITIVES) {
    primitives[`nst_oi_${column}`] = value(nstCountsOi, column);
  }

  return {
    ...wgoGame,
    // NST on-ice possession shares (counts_oi)
    cf_pct: value(nstCountsOi, "cf_pct"),
    ff_pct: value(nstCountsOi, "ff_pct"),
    sf_pct: value(nstCountsOi, "sf_pct"),
    gf_pct: value(nstCountsOi, "gf_pct"),
    xgf_pct: value(nstCountsOi, "xgf_pct"),
    scf_pct: value(nstCountsOi, "scf_pct"),
    hdcf_pct: value(nstCountsOi, "hdcf_pct"),
    mdcf_pct: value(nstCountsOi, "mdcf_pct"),
    ldcf_pct: value(nstCountsOi, "ldcf_pct"),
    on_ice_cf_pct: value(nstCountsOi, "cf_pct"),
    on_ice_ff_pct: value(nstCountsOi, "ff_pct"),
    on_ice_sf_pct: value(nstCountsOi, "sf_pct"),
    on_ice_gf_pct: value(nstCountsOi, "gf_pct"),
    on_ice_xgf_pct: value(nstCountsOi, "xgf_pct"),
    on_ice_scf_pct: value(nstCountsOi, "scf_pct"),
    on_ice_hdcf_pct: value(nstCountsOi, "hdcf_pct"),

    // NST individual production per 60 (rates)
    goals_per_60: value(nstRates, "goals_per_60"),
    total_assists_per_60: value(nstRates, "total_assists_per_60"),
    first_assists_per_60: value(nstRates, "first_assists_per_60"),
    second_assists_per_60: value(nstRates, "second_assists_per_60"),
    total_points_per_60: value(nstRates, "total_points_per_60"),
    shots_per_60: value(nstRates, "shots_per_60"),
    ixg_per_60: value(nstRates, "ixg_per_60"),
    icf_per_60: value(nstRates, "icf_per_60"),
    iff_per_60: value(nstRates, "iff_per_60"),
    iscfs_per_60: value(nstRates, "iscfs_per_60"),
    hdcf_per_60: value(nstRates, "hdcf_per_60"),
    rush_attempts_per_60: value(nstRates, "rush_attempts_per_60"),
    rebounds_created_per_60: value(nstRates, "rebounds_created_per_60"),
    shots_blocked_per_60: value(nstRates, "shots_blocked_per_60"),

    // NST on-ice against per 60 (rates_oi; the individual table has none)
    hdca_per_60: value(nstRatesOi, "hdca_per_60"),
    sca_per_60: value(nstRatesOi, "sca_per_60"),
    xga_per_60: value(nstRatesOi, "xga_per_60"),
    ga_per_60: value(nstRatesOi, "ga_per_60"),

    // NST discipline per 60 (rates)
    pim_per_60: value(nstRates, "pim_per_60"),
    total_penalties_per_60: value(nstRates, "total_penalties_per_60"),
    penalties_drawn_per_60: value(nstRates, "penalties_drawn_per_60"),
    penalty_differential_per_60: value(nstRates, "penalty_differential_per_60"),
    giveaways_per_60: value(nstRates, "giveaways_per_60"),
    takeaways_per_60: value(nstRates, "takeaways_per_60"),
    hits_per_60: value(nstRates, "hits_per_60"),

    // NST on-ice rates per 60 (rates_oi)
    on_ice_goals_per_60: value(nstRatesOi, "gf_per_60"),
    on_ice_goals_against_per_60: value(nstRatesOi, "ga_per_60"),
    on_ice_shots_per_60: value(nstRatesOi, "sf_per_60"),
    on_ice_shots_against_per_60: value(nstRatesOi, "sa_per_60"),
    on_ice_cf_per_60: value(nstRatesOi, "cf_per_60"),
    on_ice_ca_per_60: value(nstRatesOi, "ca_per_60"),
    on_ice_ff_per_60: value(nstRatesOi, "ff_per_60"),
    on_ice_fa_per_60: value(nstRatesOi, "fa_per_60"),
    on_ice_xgf_per_60: value(nstRatesOi, "xgf_per_60"),
    on_ice_xga_per_60: value(nstRatesOi, "xga_per_60"),

    // NST zone usage (counts_oi)
    off_zone_start_pct: value(nstCountsOi, "off_zone_start_pct"),
    def_zone_start_pct: startShare(dz),
    neu_zone_start_pct: startShare(nz),
    off_zone_faceoff_pct: value(nstCountsOi, "off_zone_faceoff_pct"),

    // NST on-ice impact (counts_oi)
    on_ice_sh_pct: value(nstCountsOi, "on_ice_sh_pct"),
    on_ice_sv_pct: value(nstCountsOi, "on_ice_sv_pct"),
    pdo,

    // Legacy raw count fields kept for existing readers
    ixg: value(nstCounts, "ixg"),
    icf: value(nstCounts, "icf"),
    iff: value(nstCounts, "iff"),
    hdcf: value(nstCounts, "hdcf"),
    hdca: value(nstCounts, "hdca"),
    rush_attempts: value(nstCounts, "rush_attempts"),
    rebounds_created: value(nstCounts, "rebounds_created"),
    cf: value(nstCountsOi, "cf"),
    ca: value(nstCountsOi, "ca"),
    ff: value(nstCountsOi, "ff"),
    fa: value(nstCountsOi, "fa"),
    sf: value(nstCountsOi, "sf"),
    sa: value(nstCountsOi, "sa"),
    gf: value(nstCountsOi, "gf"),
    ga: value(nstCountsOi, "ga"),
    xgf: value(nstCountsOi, "xgf"),
    xga: value(nstCountsOi, "xga"),
    scf: value(nstCountsOi, "scf"),
    sca: value(nstCountsOi, "sca"),

    // Source-matched primitives for pooling
    ...primitives
  };
}
