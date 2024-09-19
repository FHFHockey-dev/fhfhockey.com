// lib/supabase/utils/config.js

module.exports = {
  ROLLING_WINDOW_SIZE: 10,
  EMA_ALPHA: 0.3,
  SIGNIFICANCE_LEVEL: 0.05,
  SURVEY_RANKINGS: {
    shooting_percentage: 1, // Most important
    ipp: 2,
    on_ice_shooting_pct: 3,
    a1_a2_percentage: 4,
    sog_per_60: 5,
    pp_percentage: 6, // Least important
    // Add more stats as needed
  },
  STAT_VARIANCES: {
    shooting_percentage: 0.02, // Example variance
    ipp: 10,
    on_ice_shooting_pct: 0.03,
    a1_a2_percentage: 0.05,
    sog_per_60: 1.0,
    pp_percentage: 0.04,
    // Add more stats as needed
  },
};
