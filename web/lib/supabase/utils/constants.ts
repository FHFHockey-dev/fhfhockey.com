// utils/constants.ts

export enum StatField {
  GamesPlayed = "games_played",
  Goals = "goals",
  Assists = "assists",
  Points = "points",
  Shots = "shots",
  TimeOnIce = "time_on_ice",
  ESGoalsFor = "es_goals_for",
  PPGoalsFor = "pp_goals_for",
  SHGoalsFor = "sh_goals_for",
  TotalPrimaryAssists = "total_primary_assists",
  TotalSecondaryAssists = "total_secondary_assists",
  PAtoSARatio = "pa_to_sa_ratio",
  ShootingPercentage = "shooting_percentage",
  OnIceShootingPct = "on_ice_shooting_pct",
  ZoneStartPct = "zone_start_pct",
  PPToiPctPerGame = "pp_toi_pct_per_game",
  IPP = "ipp",
  SOGPer60 = "sog_per_60",
}

/**
 * Array of all statistic fields for iteration purposes.
 */
export const STAT_FIELDS: StatField[] = [
  StatField.GamesPlayed,
  StatField.Goals,
  StatField.Assists,
  StatField.Points,
  StatField.Shots,
  StatField.TimeOnIce,
  StatField.ESGoalsFor,
  StatField.PPGoalsFor,
  StatField.SHGoalsFor,
  StatField.TotalPrimaryAssists,
  StatField.TotalSecondaryAssists,
  StatField.ShootingPercentage,
  StatField.OnIceShootingPct,
  StatField.ZoneStartPct,
  StatField.PPToiPctPerGame,
  StatField.IPP,
  StatField.SOGPer60,
];

export const RATED_STAT_FIELDS: StatField[] = [
  StatField.ShootingPercentage,
  StatField.IPP,
  StatField.OnIceShootingPct,
  StatField.ZoneStartPct,
  StatField.TimeOnIce,
  StatField.PAtoSARatio,
  StatField.SOGPer60,
  StatField.PPToiPctPerGame,
];

/**
 * Mapping from statistic fields to their display labels.
 */
export const STAT_LABELS: Record<StatField, string> = {
  [StatField.GamesPlayed]: "Games Played",
  [StatField.Goals]: "Goals",
  [StatField.Assists]: "Assists",
  [StatField.Points]: "Points",
  [StatField.Shots]: "Shots",
  [StatField.TimeOnIce]: "Time on Ice",
  [StatField.ESGoalsFor]: "ES Goals For",
  [StatField.PPGoalsFor]: "PP Goals For",
  [StatField.SHGoalsFor]: "SH Goals For",
  [StatField.TotalPrimaryAssists]: "Primary Assists",
  [StatField.TotalSecondaryAssists]: "Secondary Assists",
  [StatField.PAtoSARatio]: "PA to SA Ratio",
  [StatField.ShootingPercentage]: "Shooting %",
  [StatField.OnIceShootingPct]: "On-Ice Shooting %",
  [StatField.ZoneStartPct]: "Zone Start %",
  [StatField.PPToiPctPerGame]: "PP TOI % per Game",
  [StatField.IPP]: "IPP",
  [StatField.SOGPer60]: "SOG per 60",
};

/**
 * Empty PerGameAverages for initialization and fallback.
 */
export const emptyPerGameAverages: Record<StatField, number> = {
  [StatField.GamesPlayed]: 0,
  [StatField.Goals]: 0,
  [StatField.Assists]: 0,
  [StatField.Points]: 0,
  [StatField.Shots]: 0,
  [StatField.TimeOnIce]: 0,
  [StatField.ESGoalsFor]: 0,
  [StatField.PPGoalsFor]: 0,
  [StatField.SHGoalsFor]: 0,
  [StatField.TotalPrimaryAssists]: 0,
  [StatField.TotalSecondaryAssists]: 0,
  [StatField.PAtoSARatio]: 0,
  [StatField.ShootingPercentage]: 0,
  [StatField.OnIceShootingPct]: 0,
  [StatField.ZoneStartPct]: 0,
  [StatField.PPToiPctPerGame]: 0,
  [StatField.IPP]: 0,
  [StatField.SOGPer60]: 0,
};

/**
 * Weights for each statistic based on importance ratings.
 * Lower ratings indicate higher importance.
 */

export const STAT_WEIGHTS: Partial<Record<StatField, number>> = (() => {
  const ratings: Partial<Record<StatField, number>> = {
    [StatField.ShootingPercentage]: 4.0625,
    [StatField.IPP]: 4.8125,
    [StatField.OnIceShootingPct]: 6.263157895,
    [StatField.ZoneStartPct]: 6.583333333,
    [StatField.TimeOnIce]: 4.692307692,
    [StatField.PAtoSARatio]: 6.571428571,
    [StatField.SOGPer60]: 4.0625,
    [StatField.PPToiPctPerGame]: 4.666666667,
  };

  // Invert the ratings
  const inverseRatings: Partial<Record<StatField, number>> = {};
  let sumOfInverses = 0;
  for (const stat of RATED_STAT_FIELDS) {
    const inverse = 1 / ratings[stat]!;
    inverseRatings[stat] = inverse;
    sumOfInverses += inverse;
  }

  // Normalize to get weights that sum to 1
  const weights: Partial<Record<StatField, number>> = {};
  for (const stat of RATED_STAT_FIELDS) {
    weights[stat] = inverseRatings[stat]! / sumOfInverses;
  }

  return weights;
})();
