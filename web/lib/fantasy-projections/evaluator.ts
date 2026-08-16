import { createHash } from "crypto";

import {
  FANTASY_PROJECTION_CONTRACT_CHECKSUM,
  FANTASY_PROJECTION_CONTRACT_VERSION,
  FANTASY_PROJECTION_SEASON_ID,
  GOALIE_PRIMITIVE_TARGETS,
  reconcileProjectionValues,
  SKATER_PRIMITIVE_TARGETS,
  type FantasyProjectionPopulation,
  type ProjectionValues,
} from "./contracts";

const P10_Z = 1.2815515655446004;

export type PortablePlayerPrior = {
  fhfhPlayerId: number;
  population: FantasyProjectionPopulation;
  position: "C" | "L" | "R" | "D" | "G";
  teamId: number | null;
  playProbability: number;
  startProbability?: number;
  baselinePlayProbability?: number;
  baselineStartProbability?: number;
  conditionalRates: ProjectionValues;
  baselineConditionalRates?: ProjectionValues;
  conditionalVariances: ProjectionValues;
  ratings: Record<string, number>;
  deployment: Record<string, unknown>;
  fallbackFlags?: string[];
};

export type PortableTeamContext = {
  teamId: number;
  offenseMultiplier: number;
  defenseMultiplier: number;
  paceMultiplier: number;
  ratings: Record<string, number>;
};

export type PortableSeasonArtifact = {
  schemaVersion: "player-forecast-season-artifact-v1";
  seasonId: number;
  contractVersion: string;
  contractChecksum: string;
  artifactVersion: string;
  featureSchemaVersion: string;
  trainingCutoffAt: string;
  codeVersion: string;
  players: Record<string, PortablePlayerPrior>;
  teams: Record<string, PortableTeamContext>;
  goldenVectors?: Array<{
    fhfhPlayerId: number;
    game: SeasonGameContext;
    expected: SeasonGameEvaluation;
  }>;
};

export type SeasonGameContext = {
  gameId: number;
  scheduledStartAt: string;
  teamId: number;
  opponentTeamId: number;
  isHome: boolean;
};

export type SeasonGameEvaluation = {
  gameId: number;
  fhfhPlayerId: number;
  teamId: number;
  opponentTeamId: number;
  population: FantasyProjectionPopulation;
  playingProbability: number;
  startProbability: number | null;
  conditionalMeans: ProjectionValues;
  unconditionalMeans: ProjectionValues;
  baselineUnconditionalMeans: ProjectionValues;
  variances: ProjectionValues;
  quantiles: {
    p10: ProjectionValues;
    p50: ProjectionValues;
    p90: ProjectionValues;
  };
  deployment: Record<string, unknown>;
  fallbackFlags: string[];
  componentHash: string;
};

function boundedProbability(value: number): number {
  return Math.min(1, Math.max(0, Number.isFinite(value) ? value : 0));
}

function round(value: number): number {
  return Number(value.toFixed(10));
}

export function canonicalJson(value: unknown): string {
  if (value === null) return "null";
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>)
      .filter(([, child]) => child !== undefined)
      .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
      .map(([key, child]) => `${JSON.stringify(key)}:${canonicalJson(child)}`)
      .join(",")}}`;
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new Error("CANONICAL_JSON_NUMBER_INVALID");
    const rounded = round(value);
    return Number.isInteger(rounded)
      ? String(rounded)
      : rounded.toFixed(10).replace(/0+$/, "").replace(/\.$/, "");
  }
  if (typeof value === "string" || typeof value === "boolean") {
    return JSON.stringify(value);
  }
  throw new Error("CANONICAL_JSON_VALUE_INVALID");
}

export function checksumCanonicalJson(value: unknown): string {
  return createHash("sha256").update(canonicalJson(value)).digest("hex");
}

export function verifyPortableSeasonArtifact(
  artifact: PortableSeasonArtifact,
): void {
  if (
    artifact.schemaVersion !== "player-forecast-season-artifact-v1" ||
    artifact.seasonId !== FANTASY_PROJECTION_SEASON_ID ||
    artifact.contractVersion !== FANTASY_PROJECTION_CONTRACT_VERSION ||
    artifact.contractChecksum !== FANTASY_PROJECTION_CONTRACT_CHECKSUM
  ) {
    throw new Error("PLAYER_FORECAST_SEASON_ARTIFACT_CONTRACT_MISMATCH");
  }
  if (!artifact.artifactVersion || !artifact.featureSchemaVersion || !artifact.codeVersion) {
    throw new Error("PLAYER_FORECAST_SEASON_ARTIFACT_METADATA_INVALID");
  }
}

function targetMultiplier(
  target: string,
  population: FantasyProjectionPopulation,
  team: PortableTeamContext | undefined,
  opponent: PortableTeamContext | undefined,
): number {
  const pace = Math.sqrt(
    Math.max(0.5, team?.paceMultiplier ?? 1) *
      Math.max(0.5, opponent?.paceMultiplier ?? 1),
  );
  if (
    population === "goalie" &&
    ["SHOTS_AGAINST_GOALIE", "GOALS_AGAINST_GOALIE"].includes(target)
  ) {
    return pace * Math.max(0.5, opponent?.offenseMultiplier ?? 1);
  }
  if (
    population !== "goalie" &&
    [
      "GOALS",
      "PRIMARY_ASSISTS",
      "SECONDARY_ASSISTS",
      "SHOTS_ON_GOAL",
      "PP_GOALS",
      "PP_ASSISTS",
      "SH_GOALS",
      "SH_ASSISTS",
    ].includes(target)
  ) {
    const opposingDefense = Math.max(0.5, opponent?.defenseMultiplier ?? 1);
    return pace / opposingDefense;
  }
  return pace;
}

function quantiles(
  means: ProjectionValues,
  variances: ProjectionValues,
  population: FantasyProjectionPopulation,
  maximumGames?: number,
): SeasonGameEvaluation["quantiles"] {
  const p10: ProjectionValues = {};
  const p50: ProjectionValues = {};
  const p90: ProjectionValues = {};
  for (const [target, mean] of Object.entries(means)) {
    const deviation = Math.sqrt(Math.max(0, variances[target] ?? 0));
    const allowNegative = target === "PLUS_MINUS";
    p10[target] = round(
      allowNegative ? mean - P10_Z * deviation : Math.max(0, mean - P10_Z * deviation),
    );
    p50[target] = round(mean);
    p90[target] = round(Math.max(p10[target], mean + P10_Z * deviation));
  }
  if (maximumGames != null) {
    for (const values of [p10, p50, p90]) {
      if (values.GAMES_PLAYED != null) {
        values.GAMES_PLAYED = round(
          Math.min(maximumGames, Math.max(0, values.GAMES_PLAYED)),
        );
      }
      if (values.GAMES_STARTED != null) {
        values.GAMES_STARTED = round(
          Math.min(
            maximumGames,
            values.GAMES_PLAYED ?? maximumGames,
            Math.max(0, values.GAMES_STARTED),
          ),
        );
      }
    }
  }
  if (population !== "goalie") {
    return {
      p10: reconcileProjectionValues(p10, population),
      p50: reconcileProjectionValues(p50, population),
      p90: reconcileProjectionValues(p90, population),
    };
  }

  const p10Shots = Math.max(0, p10.SHOTS_AGAINST_GOALIE ?? 0);
  const p50Shots = Math.max(0, p50.SHOTS_AGAINST_GOALIE ?? 0);
  const p90Shots = Math.max(0, p90.SHOTS_AGAINST_GOALIE ?? 0);
  const p10Goals = Math.max(0, p10.GOALS_AGAINST_GOALIE ?? 0);
  const p50Goals = Math.max(0, p50.GOALS_AGAINST_GOALIE ?? 0);
  const p90Goals = Math.max(0, p90.GOALS_AGAINST_GOALIE ?? 0);
  const p10Toi = Math.max(0, p10.TOTAL_TOI ?? 0);
  const p50Toi = Math.max(0, p50.TOTAL_TOI ?? 0);
  const p90Toi = Math.max(0, p90.TOTAL_TOI ?? 0);
  const p10Saves = Math.max(0, p10Shots - p90Goals);
  const p50Saves = Math.max(0, p50Shots - p50Goals);
  const p90Saves = Math.max(p50Saves, p90Shots - p10Goals);
  p10.SAVES_GOALIE = round(p10Saves);
  p50.SAVES_GOALIE = round(p50Saves);
  p90.SAVES_GOALIE = round(p90Saves);

  const savePercentage = p50Shots > 0 ? p50Saves / p50Shots : 0;
  const lowerSavePercentage = p90Shots > 0 ? p10Saves / p90Shots : 0;
  const upperSavePercentage = p10Shots > 0 ? p90Saves / p10Shots : 1;
  p10.SAVE_PERCENTAGE = round(
    Math.min(savePercentage, Math.max(0, lowerSavePercentage)),
  );
  p50.SAVE_PERCENTAGE = round(Math.min(1, Math.max(0, savePercentage)));
  p90.SAVE_PERCENTAGE = round(
    Math.min(1, Math.max(savePercentage, upperSavePercentage)),
  );

  const gaa = p50Toi > 0 ? (3600 * p50Goals) / p50Toi : 0;
  const lowerGaa = p90Toi > 0 ? (3600 * p10Goals) / p90Toi : 0;
  const upperGaa = p10Toi > 0 ? (3600 * p90Goals) / p10Toi : Math.max(gaa, lowerGaa);
  p10.GOALS_AGAINST_AVERAGE = round(Math.min(gaa, Math.max(0, lowerGaa)));
  p50.GOALS_AGAINST_AVERAGE = round(Math.max(0, gaa));
  p90.GOALS_AGAINST_AVERAGE = round(Math.max(gaa, upperGaa));
  return { p10, p50, p90 };
}

export function evaluatePortableSeasonGame(
  artifact: PortableSeasonArtifact,
  fhfhPlayerId: number,
  game: SeasonGameContext,
): SeasonGameEvaluation {
  verifyPortableSeasonArtifact(artifact);
  const prior = artifact.players[String(fhfhPlayerId)];
  if (!prior) throw new Error("PLAYER_FORECAST_SEASON_PLAYER_PRIOR_NOT_FOUND");
  if (prior.teamId != null && prior.teamId !== game.teamId) {
    throw new Error("PLAYER_FORECAST_SEASON_PLAYER_TEAM_MISMATCH");
  }

  const rawPlayingProbability = boundedProbability(prior.playProbability);
  const playingProbability = round(rawPlayingProbability);
  const rawStartProbability =
    prior.population === "goalie"
      ? Math.min(rawPlayingProbability, boundedProbability(prior.startProbability ?? 0))
      : null;
  const startProbability =
    rawStartProbability != null
      ? round(rawStartProbability)
      : null;

  const targetKeys =
    prior.population === "goalie"
      ? GOALIE_PRIMITIVE_TARGETS
      : SKATER_PRIMITIVE_TARGETS;
  const conditionalMeans: ProjectionValues = {};
  const unconditionalMeans: ProjectionValues = {};
  const baselineUnconditionalMeans: ProjectionValues = {};
  const variances: ProjectionValues = {};
  const team = artifact.teams[String(game.teamId)];
  const opponent = artifact.teams[String(game.opponentTeamId)];

  for (const target of targetKeys) {
    const conditional =
      target === "GAMES_PLAYED"
        ? 1
        : target === "GAMES_STARTED"
          ? 1
          : Math.max(
              target === "PLUS_MINUS" ? -Infinity : 0,
              (prior.conditionalRates[target] ?? 0) *
                targetMultiplier(target, prior.population, team, opponent),
            );
    const mixtureProbability =
      target === "GAMES_STARTED"
        ? rawStartProbability ?? 0
        : rawPlayingProbability;
    const conditionalVariance = Math.max(
      0,
      (prior.conditionalVariances[target] ?? Math.abs(conditional)) *
        targetMultiplier(target, prior.population, team, opponent),
    );
    conditionalMeans[target] = round(conditional);
    unconditionalMeans[target] = round(conditional * mixtureProbability);
    const baselineConditional =
      target === "GAMES_PLAYED" || target === "GAMES_STARTED"
        ? 1
        : Math.max(
            target === "PLUS_MINUS" ? -Infinity : 0,
            (prior.baselineConditionalRates?.[target] ?? prior.conditionalRates[target] ?? 0) *
              targetMultiplier(target, prior.population, team, opponent),
          );
    const baselineProbability =
      target === "GAMES_STARTED"
        ? boundedProbability(prior.baselineStartProbability ?? prior.startProbability ?? 0)
        : boundedProbability(prior.baselinePlayProbability ?? prior.playProbability);
    baselineUnconditionalMeans[target] = round(
      baselineConditional * baselineProbability,
    );
    variances[target] = round(
      mixtureProbability * conditionalVariance +
        mixtureProbability * (1 - mixtureProbability) * conditional * conditional,
    );
  }

  const reconciledConditional = reconcileProjectionValues(
    conditionalMeans,
    prior.population,
  );
  const reconciledUnconditional = reconcileProjectionValues(
    unconditionalMeans,
    prior.population,
  );
  const reconciledBaselineUnconditional = reconcileProjectionValues(
    baselineUnconditionalMeans,
    prior.population,
  );
  const reconciledQuantiles = quantiles(
    reconciledUnconditional,
    variances,
    prior.population,
    1,
  );
  const outputWithoutHash = {
    gameId: game.gameId,
    fhfhPlayerId,
    teamId: game.teamId,
    opponentTeamId: game.opponentTeamId,
    population: prior.population,
    playingProbability,
    startProbability,
    conditionalMeans: reconciledConditional,
    unconditionalMeans: reconciledUnconditional,
    baselineUnconditionalMeans: reconciledBaselineUnconditional,
    variances,
    quantiles: reconciledQuantiles,
    deployment: prior.deployment,
    fallbackFlags: [...(prior.fallbackFlags ?? [])].sort(),
  };
  return {
    ...outputWithoutHash,
    componentHash: checksumCanonicalJson(outputWithoutHash),
  };
}

export function aggregateSeasonGames(
  evaluations: SeasonGameEvaluation[],
): {
  means: ProjectionValues;
  variances: ProjectionValues;
  quantiles: SeasonGameEvaluation["quantiles"];
  componentManifest: Array<{ gameId: number; componentHash: string }>;
  aggregateHash: string;
} {
  if (evaluations.length === 0) {
    throw new Error("PLAYER_FORECAST_SEASON_COMPONENTS_REQUIRED");
  }
  const population = evaluations[0].population;
  const means: ProjectionValues = {};
  const variances: ProjectionValues = {};
  for (const evaluation of evaluations) {
    if (evaluation.population !== population) {
      throw new Error("PLAYER_FORECAST_SEASON_POPULATION_MISMATCH");
    }
    for (const [target, value] of Object.entries(evaluation.unconditionalMeans)) {
      means[target] = (means[target] ?? 0) + value;
    }
    for (const [target, value] of Object.entries(evaluation.variances)) {
      variances[target] = (variances[target] ?? 0) + value;
    }
  }
  const reconciledMeans = reconcileProjectionValues(
    Object.fromEntries(Object.entries(means).map(([key, value]) => [key, round(value)])),
    population,
  );
  const roundedVariances = Object.fromEntries(
    Object.entries(variances).map(([key, value]) => [key, round(value)]),
  );
  const aggregateQuantiles = quantiles(
    reconciledMeans,
    roundedVariances,
    population,
    evaluations.length,
  );
  const componentManifest = evaluations
    .map(({ gameId, componentHash }) => ({ gameId, componentHash }))
    .sort((left, right) => left.gameId - right.gameId);
  const aggregate = {
    means: reconciledMeans,
    variances: roundedVariances,
    quantiles: aggregateQuantiles,
    componentManifest,
  };
  return {
    ...aggregate,
    aggregateHash: checksumCanonicalJson(aggregate),
  };
}
