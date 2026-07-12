export type SustainabilityProjectionType = "snapshot" | "opponent_game";

export type SustainabilityDistributionModel = "poisson" | "negbin" | "rate";

export type SustainabilityProjectionBand = {
  lower: number;
  upper: number;
};

export type SustainabilityProjectionInput = {
  playerId: number;
  snapshotDate: string;
  metricKey: string;
  horizonGames: number;
  expectedValue: number;
  projectionType?: SustainabilityProjectionType;
  scopeKey?: string;
  gameId?: number | null;
  teamId?: number | null;
  opponentTeamId?: number | null;
  band50?: SustainabilityProjectionBand | null;
  band80?: SustainabilityProjectionBand | null;
  ratePer60?: number | null;
  toiSeconds?: number | null;
  attempts?: number | null;
  expectedWins?: number | null;
  distributionModel?: SustainabilityDistributionModel | null;
  opponentAdjustment?: Record<string, unknown>;
  distributionSummary?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  computedAt?: string;
  updatedAt?: string;
};
