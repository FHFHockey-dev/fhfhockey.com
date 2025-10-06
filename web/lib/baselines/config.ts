export const deploymentElasticity = {
  pp1Threshold: 0.65,
  pp1Enter: 0.62,
  pp1Exit: 0.58,
  triggerRelChange: 0.15,
  triggerAbsDelta: 0.1,
  varianceAlpha: 0.75,
  meanBeta: 0.5,
  capRel: 1.0,
  minTeamPPSeconds: 90,
  smoothWeights: { L10: 0.6, L20: 0.3, lastSeason: 0.1 },
  varianceOnly: [
    "shooting_percentage",
    "nst_oi_shooting_pct",
    "nst_ipp",
    "nst_oi_pdo",
    "points_per_60",
    "goals_per_60"
  ],
  shiftAndVariance: ["pp_points_per_60", "pp_goals_per_60", "pp_shots_per_60"]
};

export const metricAllowlist = {
  // HI
  hi: [
    "shooting_percentage",
    "shooting_percentage_5v5",
    "pp_shooting_percentage",
    "nst_oi_shooting_pct",
    "nst_oi_save_pct",
    "nst_oi_pdo",
    "nst_ipp",
    "nst_ixg",
    "fin_res_level",
    "fin_res_rate_5v5",
    "nst_ixg_per_60"
    // "nst_icf_per_60",
    // "nst_hdcf_per_60",
    // "nst_oi_xgf_pct",
    // "nst_oi_cf_pct",
    // "nst_oi_scf_pct",
    // "points_per_60_5v5",
    // "pp_points_per_60",
    // "pp_goals_per_60",
    // "pp_shots_per_60",
    // "shots",
    // "nst_shots_per_60"
  ],
  // MED
  med: [
    "shots",
    "nst_shots_per_60",
    "nst_icf_per_60",
    "nst_hdcf_per_60",
    "nst_icf",
    "nst_hdcf",
    "individual_shots_for_per_60",
    "toi_per_game",
    "es_toi_per_game",
    "ev_time_on_ice",
    "toi_per_game_5v5",
    "points_per_60_5v5",
    "points_per_60",
    "goals_per_60",
    "pp_goals_per_60",
    "pp_points_per_60",
    "pp_shots_per_60",
    "nst_oi_xgf_pct",
    "nst_oi_cf_pct",
    "nst_oi_scf_pct"
  ],
  // LOW (kept minimal)
  low: [
    "nst_iff_per_60",
    "nst_iscfs_per_60",
    "nst_rush_attempts_per_60",
    "nst_rebounds_created_per_60",
    "goals",
    "assists",
    "points",
    "shifts",
    "time_on_ice_per_shift",
    "individual_shots_for_per_60"
  ]
};

export const SIGMA_MIN = 1e-6;
