// /Users/tim/Desktop/fhfhockey.com/web/lib/projectionsConfig/fantasyPointsConfig.ts

/**
 * Default fantasy point values for skater stats.
 * Stats not listed here will default to 0.
 * Keys should match STATS_MASTER_LIST keys.
 */
export const DEFAULT_SKATER_FANTASY_POINTS: Record<string, number> = {
  GOALS: 3,
  ASSISTS: 2,
  PP_POINTS: 1,
  SHOTS_ON_GOAL: 0.2,
  HITS: 0.2,
  BLOCKED_SHOTS: 0.25,
  SH_POINTS: 1
  // Other skater stats (e.g., PLUS_MINUS, PENALTY_MINUTES, TIME_ON_ICE_PER_GAME, FACEOFFS_WON, FACEOFFS_LOST)
  // will default to 0 unless specified here during initialization.
  // GAMES_PLAYED typically doesn't have a direct fantasy point value.
};

/**
 * Default fantasy point values for goalie stats.
 * Stats not listed here will default to 0.
 * Keys should match STATS_MASTER_LIST keys.
 */
export const DEFAULT_GOALIE_FANTASY_POINTS: Record<string, number> = {
  GOALS_AGAINST_GOALIE: -1, // Note: This is typically negative
  SAVES_GOALIE: 0.2,
  SHUTOUTS_GOALIE: 3,
  WINS_GOALIE: 4
  // Other goalie stats (e.g., GAMES_PLAYED, LOSSES_GOALIE, OTL_GOALIE, SHOTS_AGAINST_GOALIE,
  // GOALS_AGAINST_AVERAGE, SAVE_PERCENTAGE) will default to 0 unless specified here during initialization.
};

/**
 * Helper to get the appropriate default fantasy points object based on player type.
 */
export const getDefaultFantasyPointsConfig = (
  playerType: "skater" | "goalie" | "overall"
): Record<string, number> => {
  return playerType === "skater"
    ? DEFAULT_SKATER_FANTASY_POINTS
    : DEFAULT_GOALIE_FANTASY_POINTS;
};
