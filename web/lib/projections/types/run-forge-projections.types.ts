export type GameRow = {
  id: number;
  date: string;
  homeTeamId: number;
  awayTeamId: number;
};

export type LineCombinationRow = {
  gameId: number;
  teamId: number;
  forwards: number[] | null;
  defensemen: number[] | null;
  goalies: number[] | null;
};

export type LineCombinationContext = {
  lineCombination: LineCombinationRow | null;
  sourceGameDate: string | null;
};

export type RollingRow = {
  player_id: number;
  strength_state: string;
  game_date: string;
  toi_seconds_avg_last5: number | null;
  toi_seconds_avg_all: number | null;
  sog_per_60_last5: number | null;
  sog_per_60_all: number | null;
  sog_per_60_avg_last5: number | null;
  sog_per_60_avg_all: number | null;
  goals_total_last5: number | null;
  shots_total_last5: number | null;
  assists_total_last5: number | null;
  goals_total_all: number | null;
  shots_total_all: number | null;
  assists_total_all: number | null;
  hits_per_60_last5: number | null;
  hits_per_60_all: number | null;
  blocks_per_60_last5: number | null;
  blocks_per_60_all: number | null;
  hits_per_60_avg_last5: number | null;
  hits_per_60_avg_all: number | null;
  blocks_per_60_avg_last5: number | null;
  blocks_per_60_avg_all: number | null;
};

export type RosterEventRow = {
  event_id: number;
  team_id: number | null;
  player_id: number | null;
  event_type: string;
  confidence: number;
  payload: unknown;
  effective_from: string;
  effective_to: string | null;
};

export type GoalieGameHistoryRow = {
  shots_against: number | null;
  goals_allowed: number | null;
  saves: number | null;
  game_date?: string | null;
  goalie_id?: number | null;
  toi_seconds?: number | null;
  game_id?: number | null;
};

export type PlayerTeamPositionRow = {
  id: number;
  team_id: number | null;
  position: string | null;
};

export type WgoSkaterDeploymentProfile = {
  toiPerGameSec: number | null;
  esToiPerGameSec: number | null;
  ppToiPerGameSec: number | null;
};

export type SkaterShotQualityProfile = {
  sourceDate: string | null;
  nstShotsPer60: number | null;
  nstIxgPer60: number | null;
  nstRushAttemptsPer60: number | null;
  nstReboundsCreatedPer60: number | null;
};

export type SkaterOnIceContextProfile = {
  sourceDate: string | null;
  nstOiXgfPer60: number | null;
  nstOiXgaPer60: number | null;
  nstOiCfPct: number | null;
  possessionPctSafe: number | null;
};

export type SkaterTeamLevelContextAdjustment = {
  sampleWeight: number;
  shotRateMultiplier: number;
  goalRateMultiplier: number;
  assistRateMultiplier: number;
  paceEdge: number;
  opponentDefenseEdge: number;
};

export type OpponentGoalieContext = {
  source: "goalie_start_projections";
  weightedProjectedGsaaPer60: number | null;
  topStarterProbability: number;
  probabilityMass: number;
  isConfirmedStarter: boolean;
};

export type SkaterRestScheduleAdjustment = {
  sampleWeight: number;
  toiMultiplier: number;
  shotRateMultiplier: number;
  goalRateMultiplier: number;
  assistRateMultiplier: number;
  restDelta: number;
  teamRestDays: number | null;
  opponentRestDays: number | null;
};

export type SkaterSampleShrinkageAdjustment = {
  sampleWeight: number;
  isLowSample: boolean;
  usedCallupFallback: boolean;
  evidenceToiSeconds: number;
  evidenceShots: number;
};

export type SkaterPpOpportunityAllocation = {
  perPlayerPpToiSeconds: Map<number, number>;
  playersReweighted: number;
};

export type SkaterTeammateAssistCoupling = {
  assistRateEsMultiplier: number;
  assistRatePpMultiplier: number;
  dependencyScore: number;
};

export type SkaterRoleBoundedUsage = {
  toiEsSeconds: number;
  toiPpSeconds: number;
  sogPer60Es: number;
  sogPer60Pp: number;
  wasBounded: boolean;
};

export type ReconciledSkaterVector = {
  playerId: number;
  toiEsSeconds: number;
  toiPpSeconds: number;
  shotsEs: number;
  shotsPp: number;
};

export type ReconciliationDistributionValidation = {
  players: ReconciledSkaterVector[];
  wasAdjusted: boolean;
  topEsShareAfter: number;
  topPpShareAfter: number;
};

export type SkaterRoleScenario = {
  role: string;
  probability: number;
  source: "current_role" | "adjacent_role" | "depth_fallback";
};

export type SkaterScenarioStatLine = {
  role: string;
  probability: number;
  goalsEs: number;
  goalsPp: number;
  assistsEs: number;
  assistsPp: number;
};

export type SkaterScenarioHorizonBlendResult = {
  blended: {
    goalsEs: number;
    goalsPp: number;
    assistsEs: number;
    assistsPp: number;
  };
  scenarioLines: SkaterScenarioStatLine[];
  horizonScenarioSummaries: Array<{
    gameIndex: number;
    topRole: string;
    topProbability: number;
  }>;
};

export type SkaterScenarioMetadata = {
  modelVersion: string;
  scenarioCount: number;
  topScenarioDrivers: Array<{
    role: string;
    probability: number;
    source: SkaterRoleScenario["source"];
  }>;
};

export type SustainabilityTrendBandRow = {
  player_id: number;
  snapshot_date: string;
  metric_key: string;
  window_code: string;
  value: number | null;
  ci_lower: number | null;
  ci_upper: number | null;
  n_eff: number | null;
};

export type SkaterTrendAdjustment = {
  metricKey: string;
  windowCode: string;
  snapshotDate: string;
  ageDays: number;
  recencyClass: "fresh" | "soft_stale" | "hard_stale";
  effectState:
    | "applied"
    | "neutralized_by_recency"
    | "within_band_neutral";
  value: number;
  ciLower: number;
  ciUpper: number;
  nEff: number | null;
  confidence: number;
  signedDistance: number;
  shotRateMultiplier: number;
  goalRateMultiplier: number;
  assistRateMultiplier: number;
  uncertaintyVolatilityMultiplier: number;
};

export type TeamGoalieStarterContext = {
  startsByGoalie: Map<number, number>;
  lastPlayedDateByGoalie: Map<number, string>;
  totalGames: number;
  previousGameDate: string | null;
  previousGameStarterGoalieId: number | null;
};

export type StarterContextForTest = TeamGoalieStarterContext;

export type StarterScenario = {
  goalieId: number;
  probability: number;
  rawProbability: number;
  rank: number;
};

export type TeamDefensiveEnvironment = {
  avgShotsAgainstLast10: number | null;
  avgShotsAgainstLast5: number | null;
};

export type TeamOffenseEnvironment = {
  avgShotsForLast10: number | null;
  avgShotsForLast5: number | null;
  avgGoalsForLast10: number | null;
  avgGoalsForLast5: number | null;
};

export type TeamStrengthPrior = {
  sourceDate: string | null;
  xga: number | null;
  xgaPerGame: number | null;
  xgfPerGame: number | null;
};

export type TeamFiveOnFiveProfile = {
  sourceDate: string | null;
  gamesPlayed: number;
  savePct5v5: number | null;
  shootingPlusSavePct5v5: number | null;
};

export type TeamNstExpectedGoalsProfile = {
  source: "nst_team_all" | "nst_team_stats";
  sourceDate: string | null;
  gamesPlayed: number;
  xga: number | null;
  xgaPer60: number | null;
};

export type GoalieWorkloadContext = {
  startsLast7Days: number;
  startsLast14Days: number;
  daysSinceLastStart: number | null;
  isGoalieBackToBack: boolean;
};

export type GoalieRestSplitBucket = "0" | "1" | "2" | "3" | "4_plus";

export type GoalieRestSplitProfile = {
  sourceDate: string | null;
  savePctByBucket: Partial<Record<GoalieRestSplitBucket, number>>;
  gamesByBucket: Partial<Record<GoalieRestSplitBucket, number>>;
};

export type StarterScenarioProjection = {
  goalie_id: number;
  rank: number;
  starter_probability_raw: number;
  starter_probability_top2_normalized: number;
  proj_shots_against: number;
  proj_saves: number;
  proj_goals_allowed: number;
  proj_win_prob: number;
  proj_shutout_prob: number;
  modeled_save_pct: number;
  workload_save_pct_penalty: number;
  rest_split_save_pct_adjustment?: number;
};

export type ProjectionTotals = {
  toiEsSeconds: number;
  toiPpSeconds: number;
  shotsEs: number;
  shotsPp: number;
  goalsEs: number;
  goalsPp: number;
  assistsEs: number;
  assistsPp: number;
};

export type RunProjectionOptions = {
  deadlineMs?: number;
  horizonGames?: number;
};

export type RunProjectionResult = {
  runId: string;
  gamesProcessed: number;
  playerRowsUpserted: number;
  teamRowsUpserted: number;
  goalieRowsUpserted: number;
  timedOut: boolean;
};

export type ForgeTeamGameStrengthRow = {
  game_date: string | null;
  toi_es_seconds: number | null;
  toi_pp_seconds: number | null;
  shots_es: number | null;
  shots_pp: number | null;
};

export type PbpGameIdRow = {
  id: number | null;
};

export type LineCombinationWithGameDateRow = {
  gameId: number;
  teamId?: number;
  forwards?: unknown;
  defensemen?: unknown;
  goalies?: unknown;
  games?: {
    date?: string | null;
  } | null;
};

export type RollingSkaterMetricRow = {
  player_id: number | null;
  game_date: string | null;
  toi_seconds_avg_last5: number | null;
  toi_seconds_avg_all: number | null;
};

export type SeasonIdRow = {
  id: number | null;
};

export type RosterPlayerIdRow = {
  playerId: number | null;
};
