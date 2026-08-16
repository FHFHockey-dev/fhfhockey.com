export const FANTASY_PROJECTION_SEASON_ID = 20262027;
export const FANTASY_PROJECTION_CONTRACT_VERSION =
  "player-forecasts-research-v3-season";
export const FANTASY_PROJECTION_CONTRACT_CHECKSUM =
  "29c6766f63ba9a8dbf8890cb6a388418945134b70217d58e9d8645b34dc36b93";
export const FANTASY_PROJECTION_BETA_LABEL =
  "2026–27 beta — model plus editorial review";

export const SKATER_PRIMITIVE_TARGETS = [
  "GAMES_PLAYED",
  "TOTAL_TOI",
  "EV_TOI",
  "PP_TOI",
  "PK_TOI",
  "GOALS",
  "PRIMARY_ASSISTS",
  "SECONDARY_ASSISTS",
  "PLUS_MINUS",
  "SHOTS_ON_GOAL",
  "HITS",
  "BLOCKED_SHOTS",
  "PENALTY_MINUTES",
  "PP_GOALS",
  "PP_ASSISTS",
  "SH_GOALS",
  "SH_ASSISTS",
  "FACEOFFS_WON",
  "FACEOFFS_LOST",
] as const;

export const GOALIE_PRIMITIVE_TARGETS = [
  "GAMES_PLAYED",
  "GAMES_STARTED",
  "TOTAL_TOI",
  "WINS_GOALIE",
  "LOSSES_GOALIE",
  "OTL_GOALIE",
  "SHOTS_AGAINST_GOALIE",
  "GOALS_AGAINST_GOALIE",
  "SHUTOUTS_GOALIE",
] as const;

export const SKATER_DERIVED_TARGETS = [
  "ASSISTS",
  "POINTS",
  "PP_POINTS",
  "SH_POINTS",
] as const;

export const GOALIE_DERIVED_TARGETS = [
  "SAVES_GOALIE",
  "SAVE_PERCENTAGE",
  "GOALS_AGAINST_AVERAGE",
] as const;

export const SKATER_SCORING_TARGETS = [
  ...SKATER_PRIMITIVE_TARGETS,
  ...SKATER_DERIVED_TARGETS,
] as const;

export const GOALIE_SCORING_TARGETS = [
  ...GOALIE_PRIMITIVE_TARGETS,
  ...GOALIE_DERIVED_TARGETS,
] as const;

export type FantasyProjectionView = "opening" | "current" | "ros";
export type FantasyProjectionPopulation = "forward" | "defense" | "goalie";
export type FantasyProjectionPosition = "C" | "L" | "R" | "D" | "G";
export type ProjectionValues = Record<string, number>;

function projectionNumber(value: number): number {
  return Number(value.toFixed(10));
}

export type ProjectionRating = {
  value: number;
  confidence: number;
  sampleGames?: number;
  modelVersion?: string;
};

export type ProjectionDeployment = {
  mostLikelyRole?: Record<string, string | number | null>;
  roleProbabilities?: Record<string, Record<string, number>>;
  confidence?: number;
  expectedEvToi?: number;
  expectedPpToi?: number;
  expectedPkToi?: number;
  expectedTotalToi?: number;
  alternatives?: Array<{
    role: string;
    probability: number;
  }>;
};

export type FantasyProjectionRelease = {
  id: string;
  seasonId: number;
  view: FantasyProjectionView;
  releaseNumber: number;
  label: string;
  beta: boolean;
  issuedAt: string;
  cutoffAt: string;
  artifactChecksum: string;
  contractVersion: string;
  contractChecksum: string;
  rosterRevisionHash: string;
  scheduleRevisionHash: string;
  sourceHighWatermark: string;
  releaseHash: string;
  active: boolean;
};

export type FantasyProjectionPlayer = {
  id: string;
  releaseId: string;
  fhfhPlayerId: number;
  teamId: number | null;
  teamAbbreviation: string | null;
  playerName: string;
  position: FantasyProjectionPosition;
  population: FantasyProjectionPopulation;
  rosterConfidence: number;
  expectedGames: number;
  expectedStarts: number | null;
  expectedToi: ProjectionValues;
  ratings: Record<string, ProjectionRating | number>;
  deployment: ProjectionDeployment;
  modelValues: ProjectionValues;
  publishedValues: ProjectionValues;
  p10: ProjectionValues;
  p50: ProjectionValues;
  p90: ProjectionValues;
  adjustmentDelta: ProjectionValues;
  adjusted: boolean;
  fallbackFlags: string[];
  provenance: Record<string, unknown>;
};

export type FantasyProjectionTeam = {
  id: string;
  releaseId: string;
  teamId: number;
  teamName: string;
  abbreviation: string;
  modelRatings: Record<string, ProjectionRating | number>;
  publishedRatings: Record<string, ProjectionRating | number>;
  deployment: Record<string, unknown>;
  rosterCounts: Record<string, number>;
  adjustmentDelta: ProjectionValues;
  adjusted: boolean;
  confidence: number;
  provenance: Record<string, unknown>;
};

export type FantasyProjectionPlayersResponse = {
  success: true;
  betaLabel: string;
  release: FantasyProjectionRelease;
  players: FantasyProjectionPlayer[];
};

export type FantasyProjectionTeamsResponse = {
  success: true;
  betaLabel: string;
  release: FantasyProjectionRelease;
  teams: FantasyProjectionTeam[];
};

export function reconcileProjectionValues(
  rawValues: ProjectionValues,
  population: FantasyProjectionPopulation,
): ProjectionValues {
  const values = Object.fromEntries(
    Object.entries(rawValues).map(([key, value]) => [
      key,
      Number.isFinite(value) ? Number(value) : 0,
    ]),
  );
  if (population === "goalie") {
    values.SAVES_GOALIE = projectionNumber(Math.max(
      0,
      (values.SHOTS_AGAINST_GOALIE ?? 0) -
        (values.GOALS_AGAINST_GOALIE ?? 0),
    ));
    values.SAVE_PERCENTAGE =
      (values.SHOTS_AGAINST_GOALIE ?? 0) > 0
        ? projectionNumber(values.SAVES_GOALIE / values.SHOTS_AGAINST_GOALIE)
        : 0;
    values.GOALS_AGAINST_AVERAGE =
      (values.TOTAL_TOI ?? 0) > 0
        ? projectionNumber(
            (3600 * (values.GOALS_AGAINST_GOALIE ?? 0)) / values.TOTAL_TOI,
          )
        : 0;
    return values;
  }

  values.ASSISTS = projectionNumber(
    (values.PRIMARY_ASSISTS ?? 0) + (values.SECONDARY_ASSISTS ?? 0),
  );
  values.POINTS = projectionNumber((values.GOALS ?? 0) + values.ASSISTS);
  values.PP_POINTS = projectionNumber(
    (values.PP_GOALS ?? 0) + (values.PP_ASSISTS ?? 0),
  );
  values.SH_POINTS = projectionNumber(
    (values.SH_GOALS ?? 0) + (values.SH_ASSISTS ?? 0),
  );
  return values;
}

export function fantasyProjectionTotal(
  values: ProjectionValues,
  scoring: Record<string, number>,
): number {
  return Object.entries(scoring).reduce((total, [key, weight]) => {
    const value = Number(values[key] ?? 0);
    return total + (Number.isFinite(value) && Number.isFinite(weight) ? value * weight : 0);
  }, 0);
}
