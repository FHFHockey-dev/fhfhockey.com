export const PLAYER_FORECAST_SYSTEM_KEY = "player_forecasts" as const;
export const PLAYER_FORECAST_DEFAULT_LABEL = "Player Forecasts";
export const PLAYER_FORECAST_MAX_HORIZON = 10;
export const PLAYER_FORECAST_DEBOUNCE_MS = 5 * 60 * 1000;

export type PlayerForecastPopulation = "forward" | "defense" | "goalie";

export type PlayerForecastConditioning =
  | "playing_probability"
  | "start_probability"
  | "conditional_playing"
  | "conditional_start"
  | "unconditional";

export type PlayerForecastQuantiles = Record<string, number>;

export type PlayerForecastRestOfSeasonComponent = {
  gameId: number;
  scheduledStartAt: string;
  mean: number;
  variance: number;
  playsProbability?: number | null;
  sourceOutputId?: string | null;
  fallbackFlags?: string[];
};

export type PlayerForecastRestOfSeasonAggregate = {
  conditioning: "conditional_playing" | "unconditional";
  remainingGames: number;
  remainingMean: number;
  remainingVariance: number;
  remainingQuantiles: PlayerForecastQuantiles;
  seasonToDateActual: number;
  fullSeasonMean: number;
  fullSeasonQuantiles: PlayerForecastQuantiles;
  distributionKind: "independent_game_moments_normal_approximation";
  scheduleRevisionHash: string;
  fallbackFlags: string[];
  componentManifest: PlayerForecastRestOfSeasonComponent[];
};

export type PlayerForecastRestOfSeasonForecast = {
  id: string;
  modelArtifactId: string;
  seasonId: number;
  teamId: number;
  playerId: number;
  playerName: string;
  population: PlayerForecastPopulation;
  targetKey: string;
  conditioning: "conditional_playing" | "unconditional";
  remainingGames: number;
  remainingMean: number;
  remainingVariance: number;
  remainingQuantiles: PlayerForecastQuantiles;
  seasonToDateActual: number;
  fullSeasonMean: number;
  fullSeasonQuantiles: PlayerForecastQuantiles;
  issuedAt: string;
  scheduleRevisionHash: string;
  fallbackFlags: string[];
};

export type PlayerForecastRevision = {
  outputId: string;
  runId: string;
  gameId: number;
  teamId: number;
  playerId: number;
  playerName: string;
  population: PlayerForecastPopulation;
  targetKey: string;
  conditioning: PlayerForecastConditioning;
  teamGameHorizon: number;
  pointEstimate: number | null;
  probability: number | null;
  distributionKind: string | null;
  distribution: Record<string, unknown> | null;
  quantiles: PlayerForecastQuantiles | null;
  issuedAt: string;
  cutoffAt: string;
  scheduledStartAt: string;
  modelVersion: string | null;
  artifactChecksum: string | null;
  featureSchemaVersion: string | null;
  sourceHighWatermark: string;
  fallbackFlags: string[];
  degraded: boolean;
  degradedReasons: string[];
};

export type PlayerForecastCandle = {
  gameId: number;
  playerId: number;
  playerName: string;
  modelVersion: string | null;
  artifactChecksum: string | null;
  targetKey: string;
  conditioning: PlayerForecastConditioning;
  scheduledStartAt: string;
  open: number;
  high: number;
  low: number;
  close: number;
  openingHorizon: number;
  revisionCount: number;
  finalQuantiles: PlayerForecastQuantiles | null;
  actual: number | null;
  settlementStatus: "unsettled" | "provisional" | "final" | "corrected";
  revisions: Array<{ issuedAt: string; value: number; horizon: number }>;
};

export type PlayerForecastAccountabilityCheckpoint = {
  slateDate: string;
  modelArtifactId: string;
  modelVersion: string;
  checkpoint: string;
  checkpointOrder: number;
  compositeSkillScore: number;
  evaluatedForecasts: number;
  scoringVersion: string;
  settlementStatus: "provisional" | "final" | "corrected";
};

export type PlayerForecastAccountabilityCandle = {
  slateDate: string;
  modelArtifactId: string;
  modelVersion: string;
  open: number;
  high: number;
  low: number;
  close: number;
  evaluatedForecasts: number;
  scoringVersion: string;
  settlementStatus: "provisional" | "final" | "corrected";
  checkpoints: PlayerForecastAccountabilityCheckpoint[];
};

export type PlayerForecastDashboardPayload = {
  success: true;
  systemKey: typeof PLAYER_FORECAST_SYSTEM_KEY;
  label: string;
  researchGate: "pending" | "approved";
  generatedAt: string;
  filters: {
    playerId: number | null;
    gameId: number | null;
    targetKey: string | null;
    conditioning: PlayerForecastConditioning | null;
  };
  playerCandles: PlayerForecastCandle[];
  accountabilityCandles: PlayerForecastAccountabilityCandle[];
  revisions: PlayerForecastRevision[];
  restOfSeasonForecasts: PlayerForecastRestOfSeasonForecast[];
  conflicts: Array<Record<string, unknown>>;
  fixtureData: {
    present: boolean;
    disclaimer: string | null;
  };
  runHealth: {
    pending: number;
    running: number;
    failed: number;
    succeeded: number;
    researchBlockedRuns: number;
  };
};
