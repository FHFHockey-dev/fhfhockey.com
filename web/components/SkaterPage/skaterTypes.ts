export type SkaterValuationMode = "ownership" | "adp";

export type SkaterWeekRating =
  | "Elite"
  | "Quality"
  | "Average"
  | "Bad"
  | "Really Bad";

export type SkaterWeekCounts = Record<SkaterWeekRating, number>;

export type SkaterBucketKind =
  | "ownership"
  | "adp-round"
  | "waiver-wire"
  | "low-percent-drafted"
  | "unknown";

export interface SkaterBucket {
  key: string;
  label: string;
  kind: SkaterBucketKind;
  sortOrder: number;
}

export type SkaterFantasyStatKey =
  | "GOALS"
  | "ASSISTS"
  | "POINTS"
  | "HITS"
  | "PENALTY_MINUTES"
  | "BLOCKED_SHOTS"
  | "SHOTS_ON_GOAL"
  | "PP_POINTS"
  | "PP_GOALS"
  | "PP_ASSISTS"
  | "SH_POINTS"
  | "SH_GOALS"
  | "SH_ASSISTS"
  | "PLUS_MINUS"
  | "TIME_ON_ICE";

export type SkaterFantasyPointSettings = Record<SkaterFantasyStatKey, number>;

export interface SkaterScoringCategory {
  key: SkaterFantasyStatKey;
  label: string;
  sourceField: keyof SkaterGameRow;
  defaultValue: number;
  defaultSelected: boolean;
}

export interface SkaterGameRow {
  player_id: number | null;
  player_name: string | null;
  team_abbrev?: string | null;
  current_team_abbreviation?: string | null;
  position_code?: string | null;
  date: string | null;
  season_id?: number | null;
  games_played?: number | null;
  points?: number | null;
  goals?: number | null;
  assists?: number | null;
  shots?: number | null;
  shooting_percentage?: number | null;
  plus_minus?: number | null;
  pp_points?: number | null;
  pp_goals?: number | null;
  pp_assists?: number | null;
  pp_toi?: number | null;
  pp_toi_per_game?: number | null;
  sh_points?: number | null;
  sh_goals?: number | null;
  sh_assists?: number | null;
  hits?: number | null;
  blocked_shots?: number | null;
  penalty_minutes?: number | null;
  toi_per_game?: number | null;
  individual_sat_for_per_60?: number | null;
  nst_ipp?: number | null;
  nst_ixg_per_60?: number | null;
  nst_oi_cf_per_60?: number | null;
}

export interface YahooOwnershipTimelineEntry {
  date: string;
  value: number;
}

export interface YahooDraftAnalysis {
  average_cost?: string | number | null;
  average_pick?: string | number | null;
  average_round?: string | number | null;
  percent_drafted?: string | number | null;
  preseason_average_cost?: string | number | null;
  preseason_average_pick?: string | number | null;
  preseason_average_round?: string | number | null;
  preseason_percent_drafted?: string | number | null;
}

export interface YahooSkaterRow {
  player_id: string | number | null;
  season?: number | null;
  player_name?: string | null;
  full_name?: string | null;
  percent_ownership?: number | null;
  ownership_timeline?: YahooOwnershipTimelineEntry[] | null;
  draft_analysis?: YahooDraftAnalysis | null;
  average_draft_pick?: number | null;
  average_draft_round?: number | null;
  average_draft_cost?: number | null;
  percent_drafted?: number | null;
}

export interface SkaterWeek {
  key: string;
  startDate: string;
  endDate: string;
  weekNumber?: number | null;
  season?: string | number | null;
}

export interface SkaterWeeklyAggregate {
  playerId: number;
  playerName: string;
  team: string;
  position: string;
  week: SkaterWeek;
  gamesPlayed: number;
  fantasyPoints: number;
  fantasyPointsPerGame: number | null;
  ownershipAverage: number | null;
  adp: number | null;
  percentDrafted: number | null;
  bucket: SkaterBucket;
}

export interface SkaterGameWithFantasyPoints extends SkaterGameRow {
  fantasyPoints: number;
}

export interface BuildSkaterValueRowsOptions {
  valuationMode: SkaterValuationMode;
  scoringSettings: Partial<SkaterFantasyPointSettings>;
  selectedScoringKeys: SkaterFantasyStatKey[];
  yahooRows?: YahooSkaterRow[];
  matchupWeeks?: SkaterWeek[];
  minimumPercentDrafted?: number;
  averageComparisonBasis?: "weekly" | "game";
}

export interface SkaterBucketWeeklyAverage {
  weekKey: string;
  bucket: SkaterBucket;
  playerCount: number;
  averageFantasyPoints: number;
  averageFantasyPointsPerGame: number | null;
  weeklyStandardDeviation: number;
}

export interface SkaterValueOverviewRow {
  rowType: "player" | "bucket-average";
  playerId?: number;
  playerName: string;
  team: string;
  tier: string;
  valuation: number | null;
  valuationLabel: "OWN%" | "ADP";
  bucket: SkaterBucket;
  weekCounts: SkaterWeekCounts;
  percentOkWeeks: number;
  percentGoodWeeks: number;
  weeklyVariance: number;
  gameToGameVariance: number;
  averageFantasyPointsPerGame: number | null;
  averageFantasyPointsPerWeek: number;
  fantasyPointsAboveAverage: number;
  gamesPlayed: number;
  totalFantasyPoints: number;
}

export interface SkaterMetricsRow {
  rowType: "player" | "bucket-average";
  playerId?: number;
  playerName: string;
  team: string;
  valuation: number | null;
  valuationLabel: "OWN%" | "ADP";
  bucket: SkaterBucket;
  gamesPlayed: number;
  averageTimeOnIce: number | null;
  goals: number;
  assists: number;
  points: number;
  shots: number;
  shootingPercentage: number | null;
  averagePowerPlayTimeOnIce: number | null;
  powerPlayGoals: number;
  powerPlayAssists: number;
  powerPlayPoints: number;
  hits: number;
  blocks: number;
  penaltyMinutes: number;
  plusMinus: number;
}

export interface SkaterAdvancedMetricsRow {
  rowType: "player" | "bucket-average";
  playerId?: number;
  playerName: string;
  team: string;
  valuation: number | null;
  valuationLabel: "OWN%" | "ADP";
  bucket: SkaterBucket;
  gamesPlayed: number;
  goalsPer60: number | null;
  assistsPer60: number | null;
  pointsPer60: number | null;
  shotsPer60: number | null;
  powerPlayGoalsPer60: number | null;
  powerPlayAssistsPer60: number | null;
  powerPlayPointsPer60: number | null;
  hitsPer60: number | null;
  blocksPer60: number | null;
  penaltyMinutesPer60: number | null;
  corsiForPer60: number | null;
  individualPointPercentage: number | null;
  individualExpectedGoalsPer60: number | null;
}
