import { createHash } from "crypto";

import {
  FANTASY_PROJECTION_SEASON_ID,
  FANTASY_PROJECTION_SUPPORTED_CONTRACTS,
  FANTASY_PROJECTION_V5_CONTRACT_CHECKSUM,
  FANTASY_PROJECTION_V5_CONTRACT_VERSION,
  GOALIE_ADVANCED_V5_PRIMITIVE_TARGETS,
  GOALIE_PRIMITIVE_TARGETS,
  reconcileProjectionQuantiles,
  reconcileProjectionValues,
  SKATER_ADVANCED_V5_PRIMITIVE_TARGETS,
  SKATER_PRIMITIVE_TARGETS,
  type FantasyProjectionPopulation,
  type ProjectionValues,
} from "./contracts";

const P10_Z = 1.2815515655446004;

export type PortablePlayerPrior = {
  fhfhPlayerId: number;
  nhlPlayerId?: number | null;
  playerName?: string;
  population: FantasyProjectionPopulation;
  position: "C" | "L" | "R" | "D" | "G";
  teamId: number | null;
  poolStatus?: string;
  rosterStatus?: string;
  rosterConfidence?: number;
  playProbability: number;
  startProbability?: number;
  baselinePlayProbability?: number;
  baselineStartProbability?: number;
  conditionalRates: ProjectionValues;
  baselineConditionalRates?: ProjectionValues;
  conditionalVariances: ProjectionValues;
  ratings: Record<string, number>;
  ratingConfidence?: number;
  ratingSignals?: Record<string, number>;
  sampleGames?: number;
  rookieProfile?: Record<string, unknown>;
  deployment: Record<string, unknown>;
  fallbackFlags?: string[];
  primitiveTargets?: string[];
  contextEffects?: Record<string, {
    selected?: boolean;
    ageMultiplier?: number;
    backToBackMultiplier?: number;
    homeMultiplier?: number;
    awayMultiplier?: number;
  }>;
};

export type PortableTeamContext = {
  teamId: number;
  offenseMultiplier: number;
  defenseMultiplier: number;
  paceMultiplier: number;
  ratings: Record<string, number>;
  scheduleNeutralGoalDifferential?: number;
  projectedGoalsFor?: number;
  projectedGoalsAgainst?: number;
  sampleGames?: number;
  venueScorerMultipliers?: ProjectionValues;
  advancedRates?: ProjectionValues;
};

export type AdvancedSeasonArtifact = {
  schemaVersion: "player-forecast-season-advanced-artifact-v1";
  seasonId: number;
  contractVersion: string;
  contractChecksum: string;
  artifactVersion: string;
  featureSchemaVersion: string;
  trainingCutoffAt: string;
  codeVersion: string;
  baseV4ArtifactChecksum: string;
  players: Record<string, {
    fhfhPlayerId: number;
    population: FantasyProjectionPopulation;
    rates?: ProjectionValues;
  }>;
  teams: Record<string, { teamId: number; rates?: ProjectionValues }>;
  targetPolicies: Record<string, Record<string, {
    baselineRate?: number;
    residual80PerGame?: number;
    fallback?: boolean;
  }>>;
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
  restDays?: number | null;
  isBackToBack?: boolean;
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
    FANTASY_PROJECTION_SUPPORTED_CONTRACTS[artifact.contractVersion] !==
      artifact.contractChecksum
  ) {
    throw new Error("PLAYER_FORECAST_SEASON_ARTIFACT_CONTRACT_MISMATCH");
  }
  if (!artifact.artifactVersion || !artifact.featureSchemaVersion || !artifact.codeVersion) {
    throw new Error("PLAYER_FORECAST_SEASON_ARTIFACT_METADATA_INVALID");
  }
}

function advancedTargetSource(target: string): string | null {
  if (target === "EXPECTED_PRIMARY_ASSISTS") return "PRIMARY_ASSISTS";
  if (target === "EXPECTED_SECONDARY_ASSISTS") return "SECONDARY_ASSISTS";
  return null;
}

export function mergeAdvancedSeasonArtifact(
  base: PortableSeasonArtifact,
  advanced: AdvancedSeasonArtifact,
): PortableSeasonArtifact {
  verifyPortableSeasonArtifact(base);
  if (
    advanced.schemaVersion !== "player-forecast-season-advanced-artifact-v1" ||
    advanced.seasonId !== FANTASY_PROJECTION_SEASON_ID ||
    advanced.contractVersion !== FANTASY_PROJECTION_V5_CONTRACT_VERSION ||
    advanced.contractChecksum !== FANTASY_PROJECTION_V5_CONTRACT_CHECKSUM
  ) {
    throw new Error("PLAYER_FORECAST_SEASON_ADVANCED_ARTIFACT_CONTRACT_MISMATCH");
  }
  const players = Object.fromEntries(
    Object.entries(base.players).map(([id, basePlayer]) => {
      const advancedPlayer = advanced.players[id];
      if (!advancedPlayer || advancedPlayer.population !== basePlayer.population) {
        throw new Error(`PLAYER_FORECAST_SEASON_ADVANCED_PLAYER_MISMATCH:${id}`);
      }
      const targets = basePlayer.population === "goalie"
        ? GOALIE_ADVANCED_V5_PRIMITIVE_TARGETS
        : SKATER_ADVANCED_V5_PRIMITIVE_TARGETS;
      const conditionalRates = { ...basePlayer.conditionalRates };
      const baselineConditionalRates = { ...basePlayer.baselineConditionalRates };
      const conditionalVariances = { ...basePlayer.conditionalVariances };
      const fallbackFlags = new Set(basePlayer.fallbackFlags ?? []);
      for (const target of targets) {
        const sourceTarget = advancedTargetSource(target);
        const policy = advanced.targetPolicies[basePlayer.population]?.[target] ?? {};
        const rate = sourceTarget
          ? Number(basePlayer.conditionalRates[sourceTarget] ?? 0)
          : Number(advancedPlayer.rates?.[target] ?? policy.baselineRate ?? 0);
        const baselineRate = sourceTarget
          ? Number(basePlayer.baselineConditionalRates?.[sourceTarget] ?? rate)
          : Number(policy.baselineRate ?? rate);
        const residual = Number(policy.residual80PerGame ?? 0);
        let variance = Math.max(rate, residual * residual);
        if (sourceTarget) {
          const probability = Math.min(1, Math.max(0, basePlayer.playProbability));
          const sourceVariance = Number(basePlayer.conditionalVariances[sourceTarget] ?? rate);
          const mixtureVariance =
            probability * sourceVariance +
            probability * (1 - probability) * rate * rate;
          variance = probability > 0
            ? Math.max(0, (mixtureVariance - probability * (1 - probability) * rate * rate) / probability)
            : 0;
        }
        conditionalRates[target] = round(rate);
        baselineConditionalRates[target] = round(baselineRate);
        conditionalVariances[target] = round(variance);
        if (policy.fallback) fallbackFlags.add(`advanced_v5_${target.toLowerCase()}_fallback`);
      }
      return [id, {
        ...basePlayer,
        conditionalRates,
        baselineConditionalRates,
        conditionalVariances,
        primitiveTargets: Array.from(new Set([...(basePlayer.primitiveTargets ?? []), ...targets])),
        fallbackFlags: [...fallbackFlags].sort(),
      }];
    }),
  );
  const teams = Object.fromEntries(
    Object.entries(base.teams).map(([id, team]) => [
      id,
      { ...team, advancedRates: { ...(advanced.teams[id]?.rates ?? {}) } },
    ]),
  );
  return {
    ...base,
    schemaVersion: "player-forecast-season-artifact-v1",
    contractVersion: advanced.contractVersion,
    contractChecksum: advanced.contractChecksum,
    artifactVersion: advanced.artifactVersion,
    featureSchemaVersion: advanced.featureSchemaVersion,
    trainingCutoffAt: advanced.trainingCutoffAt,
    codeVersion: advanced.codeVersion,
    players,
    teams,
    goldenVectors: undefined,
  };
}

function targetMultiplier(
  target: string,
  population: FantasyProjectionPopulation,
  team: PortableTeamContext | undefined,
  opponent: PortableTeamContext | undefined,
  venue?: PortableTeamContext,
  game?: SeasonGameContext,
  contextEffect?: NonNullable<PortablePlayerPrior["contextEffects"]>[string],
): number {
  if (
    (population === "goalie"
      ? GOALIE_ADVANCED_V5_PRIMITIVE_TARGETS
      : SKATER_ADVANCED_V5_PRIMITIVE_TARGETS
    ).includes(target as never)
  ) {
    return 1;
  }
  const pace = Math.sqrt(
    Math.max(0.5, team?.paceMultiplier ?? 1) *
      Math.max(0.5, opponent?.paceMultiplier ?? 1),
  );
  const venueMultiplier = ["HITS", "BLOCKED_SHOTS", "TAKEAWAYS", "GIVEAWAYS"].includes(target)
    ? venue?.venueScorerMultipliers?.[target] ?? 1
    : 1;
  const restMultiplier = game?.isBackToBack
    ? contextEffect?.backToBackMultiplier ?? 1
    : 1;
  const homeAwayMultiplier = game?.isHome
    ? contextEffect?.homeMultiplier ?? 1
    : contextEffect?.awayMultiplier ?? 1;
  const contextualMultiplier = restMultiplier * homeAwayMultiplier;
  if (
    population === "goalie" &&
    ["SHOTS_AGAINST_GOALIE", "GOALS_AGAINST_GOALIE"].includes(target)
  ) {
    return contextualMultiplier * pace * Math.max(0.5, opponent?.offenseMultiplier ?? 1);
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
      "EV_GOALS",
      "EV_PRIMARY_ASSISTS",
      "EV_SECONDARY_ASSISTS",
      "PP_PRIMARY_ASSISTS",
      "PP_SECONDARY_ASSISTS",
      "SH_PRIMARY_ASSISTS",
      "SH_SECONDARY_ASSISTS",
      "EMPTY_NET_GOALS",
      "EMPTY_NET_POINTS",
      "EN_PRIMARY_ASSISTS",
      "EN_SECONDARY_ASSISTS",
      "GAME_WINNING_GOALS",
      "OVERTIME_GOALS",
    ].includes(target)
  ) {
    const opposingDefense = Math.max(0.5, opponent?.defenseMultiplier ?? 1);
    return (contextualMultiplier * pace * venueMultiplier) / opposingDefense;
  }
  return contextualMultiplier * pace * venueMultiplier;
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
  return reconcileProjectionQuantiles({ p10, p50, p90 }, population);
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

  const targetKeys = prior.primitiveTargets ?? (
    prior.population === "goalie"
      ? [...GOALIE_PRIMITIVE_TARGETS]
      : [...SKATER_PRIMITIVE_TARGETS]
  );
  const conditionalMeans: ProjectionValues = {};
  const unconditionalMeans: ProjectionValues = {};
  const baselineUnconditionalMeans: ProjectionValues = {};
  const variances: ProjectionValues = {};
  const team = artifact.teams[String(game.teamId)];
  const opponent = artifact.teams[String(game.opponentTeamId)];
  const venue = game.isHome ? team : opponent;

  for (const target of targetKeys) {
    const candidateMultiplier = targetMultiplier(
      target,
      prior.population,
      team,
      opponent,
      venue,
      game,
      prior.contextEffects?.[target],
    );
    const conditional =
      target === "GAMES_PLAYED"
        ? 1
        : target === "GAMES_STARTED"
          ? 1
          : Math.max(
              target === "PLUS_MINUS" ? -Infinity : 0,
              (prior.conditionalRates[target] ?? 0) *
                candidateMultiplier,
            );
    const mixtureProbability =
      target === "GAMES_STARTED"
        ? rawStartProbability ?? 0
        : rawPlayingProbability;
    const conditionalVariance = Math.max(
      0,
      (prior.conditionalVariances[target] ?? Math.abs(conditional)) *
        candidateMultiplier,
    );
    conditionalMeans[target] = round(conditional);
    unconditionalMeans[target] = round(conditional * mixtureProbability);
    const baselineConditional =
      target === "GAMES_PLAYED" || target === "GAMES_STARTED"
        ? 1
        : Math.max(
            target === "PLUS_MINUS" ? -Infinity : 0,
            (prior.baselineConditionalRates?.[target] ?? prior.conditionalRates[target] ?? 0) *
              targetMultiplier(target, prior.population, team, opponent, venue),
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

function sampledQuantile(values: number[], probability: number): number {
  if (values.length === 0) return 0;
  const ordered = [...values].sort((left, right) => left - right);
  const index = Math.max(
    0,
    Math.min(ordered.length - 1, Math.ceil(probability * (ordered.length + 1)) - 1),
  );
  return round(ordered[index]);
}

function correlatedAggregateQuantiles(
  means: ProjectionValues,
  variances: ProjectionValues,
  population: FantasyProjectionPopulation,
  maximumGames: number,
  seed: string,
  draws = 256,
): SeasonGameEvaluation["quantiles"] {
  let state = Number.parseInt(createHash("sha256").update(seed).digest("hex").slice(0, 8), 16);
  const normal = () => {
    state = (Math.imul(1_664_525, state) + 1_013_904_223) >>> 0;
    const first = (state + 0.5) / 4_294_967_296;
    state = (Math.imul(1_664_525, state) + 1_013_904_223) >>> 0;
    const second = (state + 0.5) / 4_294_967_296;
    return Math.sqrt(-2 * Math.log(first)) * Math.cos(2 * Math.PI * second);
  };
  const targets = Object.keys(variances);
  const samples = new Map<string, number[]>();
  const correlation = 0.65;
  const independentWeight = Math.sqrt(1 - correlation * correlation);
  for (let drawIndex = 0; drawIndex < draws; drawIndex += 1) {
    const common = normal();
    const draw: ProjectionValues = {};
    for (const target of targets) {
      const deviation = correlation * common + independentWeight * normal();
      const value = (means[target] ?? 0) + Math.sqrt(Math.max(0, variances[target] ?? 0)) * deviation;
      draw[target] = target === "PLUS_MINUS" ? value : Math.max(0, value);
    }
    if (draw.GAMES_PLAYED != null) {
      draw.GAMES_PLAYED = Math.min(maximumGames, draw.GAMES_PLAYED);
    }
    if (draw.GAMES_STARTED != null) {
      draw.GAMES_STARTED = Math.min(
        maximumGames,
        draw.GAMES_PLAYED ?? maximumGames,
        draw.GAMES_STARTED,
      );
    }
    if (population === "goalie" && draw.SHOTS_AGAINST_GOALIE != null) {
      draw.GOALS_AGAINST_GOALIE = Math.min(
        draw.SHOTS_AGAINST_GOALIE,
        draw.GOALS_AGAINST_GOALIE ?? 0,
      );
      for (const danger of ["HIGH_DANGER", "MID_RANGE", "LONG_RANGE"] as const) {
        const shots = `${danger}_SHOTS_AGAINST_GOALIE`;
        const goals = `${danger}_GOALS_AGAINST_GOALIE`;
        if (draw[shots] != null) {
          draw[goals] = Math.min(draw[shots], draw[goals] ?? 0);
        }
      }
    }
    for (const [target, value] of Object.entries(
      reconcileProjectionValues(draw, population),
    )) {
      const targetSamples = samples.get(target) ?? [];
      targetSamples.push(value);
      samples.set(target, targetSamples);
    }
  }
  const projection = (probability: number) =>
    Object.fromEntries(
      [...samples.entries()].map(([target, values]) => [
        target,
        sampledQuantile(values, probability),
      ]),
    );
  return {
    p10: projection(0.1),
    p50: projection(0.5),
    p90: projection(0.9),
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
  const componentManifest = evaluations
    .map(({ gameId, componentHash }) => ({ gameId, componentHash }))
    .sort((left, right) => left.gameId - right.gameId);
  const advancedTargets = population === "goalie"
    ? GOALIE_ADVANCED_V5_PRIMITIVE_TARGETS
    : SKATER_ADVANCED_V5_PRIMITIVE_TARGETS;
  const usesAdvancedContract = advancedTargets.some(
    (target) => roundedVariances[target] != null,
  );
  const aggregateQuantiles = usesAdvancedContract
    ? correlatedAggregateQuantiles(
        reconciledMeans,
        roundedVariances,
        population,
        evaluations.length,
        `advanced-v5:${evaluations[0].fhfhPlayerId}:${componentManifest
          .map(({ gameId }) => gameId)
          .join(",")}`,
      )
    : quantiles(
        reconciledMeans,
        roundedVariances,
        population,
        evaluations.length,
      );
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

export function emptySeasonAggregate(
  population: FantasyProjectionPopulation,
  primitiveTargets: readonly string[],
): ReturnType<typeof aggregateSeasonGames> {
  const zeroes = reconcileProjectionValues(
    Object.fromEntries(primitiveTargets.map((target) => [target, 0])),
    population,
  );
  const aggregate = {
    means: zeroes,
    variances: Object.fromEntries(primitiveTargets.map((target) => [target, 0])),
    quantiles: { p10: zeroes, p50: zeroes, p90: zeroes },
    componentManifest: [] as Array<{ gameId: number; componentHash: string }>,
  };
  return {
    ...aggregate,
    aggregateHash: checksumCanonicalJson(aggregate),
  };
}
