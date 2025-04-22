// components/WiGO/ratingsConstants.ts (REVISED - using ONLY available stats)
import { PercentileStrength, PlayerRawStats } from "components/WiGO/types";

// Define the STATS needed for OFFENSE ratings per strength
export const OFFENSE_RATING_STATS: {
  [key in PercentileStrength]?: (keyof PlayerRawStats)[];
} = {
  as: [
    // Use stats available in nst_percentile_as_offense
    "total_points_per_60",
    "ixg_per_60",
    "iscfs_per_60", // Individual Scoring Chances For
    "penalties_drawn_per_60",
    "xgf_pct", // On-Ice Expected Goals For %
    "cf_pct", // On-Ice Corsi For %
    // 'rush_attempts_per_60', // Available
    // 'rebounds_created_per_60', // Available
    "shots_per_60" // Available
  ],
  es: [
    // ASSUMING ES tables have similar columns - ADJUST IF NEEDED
    "total_points_per_60",
    "ixg_per_60",
    "iscfs_per_60",
    "penalties_drawn_per_60",
    "xgf_pct",
    "cf_pct",
    "shots_per_60"
  ],
  pp: [
    // ASSUMING PP tables have similar columns - ADJUST IF NEEDED
    "gf_per_60",
    "xgf_per_60",
    "scf_per_60",
    "hdgf_per_60",
    "shots_per_60",
    "total_points_per_60",
    "ixg_per_60"
  ],
  pk: []
};

// Define the STATS needed for DEFENSE ratings per strength
export const DEFENSE_RATING_STATS: {
  [key in PercentileStrength]?: (keyof PlayerRawStats)[];
} = {
  as: [
    // Use stats available in nst_percentile_as_defense
    "xga_per_60", // Expected Goals Against
    "sca_per_60", // Scoring Chances Against
    "hdca_per_60", // High-Danger Chances Against
    "shots_blocked_per_60",
    "takeaways_per_60",
    "minor_penalties_per_60",
    "giveaways_per_60"
  ],
  es: [
    // ASSUMING ES tables have similar columns - ADJUST IF NEEDED
    "xga_per_60",
    "sca_per_60",
    "hdca_per_60",
    "shots_blocked_per_60",
    "takeaways_per_60",
    "minor_penalties_per_60",
    "giveaways_per_60"
  ],
  pp: [],
  pk: [
    // ASSUMING PK tables have similar columns - ADJUST IF NEEDED
    "ga_per_60",
    "xga_per_60",
    "sca_per_60",
    "hdca_per_60",
    "sa_per_60",
    "shots_blocked_per_60",
    "takeaways_per_60"
  ]
};

// Define which stats are higherIsBetter
// *** This map MUST include ALL keys used above and reflect ACTUAL keys in PlayerRawStats ***
export const HIGHER_IS_BETTER_MAP: { [key: string]: boolean } = {
  // Simplified to string index initially
  // Offensive Stats (Generally Higher is Better)
  goals_per_60: true,
  total_assists_per_60: true,
  first_assists_per_60: true,
  second_assists_per_60: true,
  total_points_per_60: true,
  ipp: true,
  shots_per_60: true,
  sh_percentage: true,
  ixg_per_60: true,
  icf_per_60: true,
  iff_per_60: true,
  iscfs_per_60: true,
  i_hdcf_per_60: true, // From offense schema
  rush_attempts_per_60: true,
  rebounds_created_per_60: true,
  penalties_drawn_per_60: true,
  cf_per_60: true,
  ff_per_60: true,
  sf_per_60: true,
  gf_per_60: true,
  xgf_per_60: true,
  scf_per_60: true,
  oi_hdcf_per_60: true, // From offense schema
  hdgf_per_60: true,
  mdgf_per_60: true,
  ldgf_per_60: true,
  cf_pct: true,
  ff_pct: true,
  sf_pct: true,
  gf_pct: true,
  xgf_pct: true,
  scf_pct: true,
  hdcf_pct: true,
  hdgf_pct: true,
  mdgf_pct: true,
  ldgf_pct: true,
  on_ice_sh_pct: true,

  // Defensive Stats (Generally Lower is Better, hence 'false')
  ca_per_60: false,
  fa_per_60: false,
  sa_per_60: false,
  ga_per_60: false,
  xga_per_60: false,
  sca_per_60: false,
  hdca_per_60: false,
  hdga_per_60: false,
  mdga_per_60: false,
  ldga_per_60: false,
  giveaways_per_60: false,
  pim_per_60: false,
  total_penalties_per_60: false,
  minor_penalties_per_60: false,
  major_penalties_per_60: false,
  misconduct_penalties_per_60: false,

  // Defensive Stats (Generally Higher is Better)
  shots_blocked_per_60: true,
  takeaways_per_60: true,
  on_ice_sv_pct: true,
  hits_per_60: true, // Debatable, but often seen as positive defensive engagement

  // Base/Other
  gp: true,
  toi_seconds: true
};
