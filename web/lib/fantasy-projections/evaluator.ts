import { createHash } from "crypto";

import {
  FANTASY_PROJECTION_SEASON_ID,
  FANTASY_PROJECTION_SUPPORTED_CONTRACTS,
  FANTASY_PROJECTION_V3_CONTRACT_VERSION,
  FANTASY_PROJECTION_V5_CONTRACT_CHECKSUM,
  FANTASY_PROJECTION_V5_CONTRACT_VERSION,
  GOALIE_ADVANCED_V5_PRIMITIVE_TARGETS,
  GOALIE_FANTASY_V4_PRIMITIVE_TARGETS,
  GOALIE_OUTCOME_TARGETS,
  GOALIE_PRIMITIVE_TARGETS,
  reconcileProjectionQuantiles,
  reconcileProjectionValues,
  reconcileProjectionValuesWithClamps,
  type ProjectionReconciliationClamp,
  SKATER_ADVANCED_V5_PRIMITIVE_TARGETS,
  SKATER_FANTASY_V4_PRIMITIVE_TARGETS,
  SKATER_PRIMITIVE_TARGETS,
  type FantasyProjectionPopulation,
  type ProjectionValues,
} from "./contracts";

const P10_Z = 1.2815515655446004;

/**
 * v2 (L15, 2026-11-12): goalie outcome heads take no game-context multiplier
 * (decision 121); GP/GS are Bernoulli (conditional variance 0); a missing
 * conditional variance falls back to the Poisson variance of the already
 * adjusted mean (once, not times m again); a missing rate is unknown, never 0;
 * expected-assist aliases carry their source's moments; per-game quantiles
 * carry the non-participation atom at 0; season aggregates take quantiles of
 * one joint draw set, with actuals added per draw. Python twin: season.py.
 */
export const SEASON_GAME_EVALUATOR_VERSION = "season-game-evaluator-v2";
export const GOALIE_OUTCOME_TREATMENT_VERSION =
  "goalie-outcomes-prior-rate-no-game-context-v1";
export const SEASON_AGGREGATE_VERSION = "season-aggregate-joint-draws-v2";
/**
 * One-factor Gaussian dependence between a player's targets inside a season
 * aggregate: each target loads 0.65 on a common factor, so any two primitive
 * targets correlate at 0.65² = 0.4225. A presentation choice, not fitted.
 */
export const SEASON_AGGREGATE_FACTOR_LOADING = 0.65;
const SEASON_AGGREGATE_DRAWS = 256;

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

/** Expected-assist aliases and the observed head whose moments they carry. */
const EXPECTED_ASSIST_ALIASES: Readonly<Record<string, string>> = {
  EXPECTED_PRIMARY_ASSISTS: "PRIMARY_ASSISTS",
  EXPECTED_SECONDARY_ASSISTS: "SECONDARY_ASSISTS",
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
  evaluatorVersion: string;
  /** Goalies only: the versioned outcome treatment (decision 121). */
  outcomeTreatment?: string;
  /** Declared targets with no finite conditional rate: unknown, not 0. */
  missingTargets: string[];
  /** e.g. `variance_poisson_fallback:GOALS` when a variance was not supplied. */
  momentFlags: string[];
  /** Coherence clamps that bound on the unconditional means. */
  reconciliationClamps: ProjectionReconciliationClamp[];
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

function defaultPrimitiveTargets(
  population: FantasyProjectionPopulation,
  contractVersion: string,
): string[] {
  const fantasyV4 = contractVersion !== FANTASY_PROJECTION_V3_CONTRACT_VERSION;
  return population === "goalie"
    ? [...GOALIE_PRIMITIVE_TARGETS, ...(fantasyV4 ? GOALIE_FANTASY_V4_PRIMITIVE_TARGETS : [])]
    : [...SKATER_PRIMITIVE_TARGETS, ...(fantasyV4 ? SKATER_FANTASY_V4_PRIMITIVE_TARGETS : [])];
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
        const finite = (value: unknown): number | null =>
          value == null || !Number.isFinite(Number(value)) ? null : Number(value);
        // A missing rate is unknown (W3-5 F2): the target is left out and the
        // evaluator reports it in missingTargets instead of serving 0.
        const rate = sourceTarget
          ? finite(basePlayer.conditionalRates[sourceTarget])
          : finite(advancedPlayer.rates?.[target]) ?? finite(policy.baselineRate);
        if (rate == null) {
          delete conditionalRates[target];
          delete baselineConditionalRates[target];
          delete conditionalVariances[target];
          if (policy.fallback) fallbackFlags.add(`advanced_v5_${target.toLowerCase()}_fallback`);
          continue;
        }
        const baselineRate = sourceTarget
          ? finite(basePlayer.baselineConditionalRates?.[sourceTarget]) ?? rate
          : finite(policy.baselineRate) ?? rate;
        let variance: number | null;
        if (sourceTarget) {
          // Alias identity: the expected-assist head carries its source's
          // conditional variance unchanged (W3-5 PR2).
          variance = finite(basePlayer.conditionalVariances[sourceTarget]);
        } else {
          // residual80PerGame is the 80% quantile of absolute per-game error,
          // so under a normal residual sigma = residual / z(0.9) (C17); the
          // Poisson variance (the rate) is kept as a declared floor.
          const residual = Math.max(0, Number(policy.residual80PerGame ?? 0));
          variance = Math.max(rate, (residual / P10_Z) ** 2);
        }
        conditionalRates[target] = round(rate);
        baselineConditionalRates[target] = round(baselineRate);
        if (variance == null) delete conditionalVariances[target];
        else conditionalVariances[target] = round(variance);
        if (policy.fallback) fallbackFlags.add(`advanced_v5_${target.toLowerCase()}_fallback`);
      }
      return [id, {
        ...basePlayer,
        conditionalRates,
        baselineConditionalRates,
        conditionalVariances,
        // A base prior without an explicit list uses its contract's default
        // targets; dropping them would orphan the expected-assist aliases.
        primitiveTargets: Array.from(
          new Set([
            ...(basePlayer.primitiveTargets ?? defaultPrimitiveTargets(basePlayer.population, base.contractVersion)),
            ...targets,
          ]),
        ),
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
  if (
    population === "goalie" &&
    (GOALIE_OUTCOME_TARGETS as readonly string[]).includes(target)
  ) {
    // Decision 121: no pace, venue, rest or home/away multiplier on goalie
    // W/L/OTL/SO/QS until a fitted goalie model (decision 38) supplies one.
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
  if (["TOTAL_TOI", "EV_TOI", "PP_TOI", "PK_TOI"].includes(target)) {
    // Pace affects event opportunity, not the fixed pool of regulation
    // minutes. Deployment already supplies the TOI rate.
    return contextualMultiplier;
  }
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

/**
 * Inverse standard-normal CDF (Acklam's rational approximation, relative error
 * below 1.2e-9). The three levels used by the season contract return the exact
 * shared constant so full-participation quantiles match mean ± z·sd.
 * Python twin: season.py `_normal_quantile` (same coefficients and branches).
 */
export function normalQuantile(level: number): number {
  if (!(level > 0 && level < 1)) throw new Error("NORMAL_QUANTILE_LEVEL_INVALID");
  if (level === 0.5) return 0;
  if (level === 0.1) return -P10_Z;
  if (level === 0.9) return P10_Z;
  const a = [-3.969683028665376e1, 2.209460984245205e2, -2.759285104469687e2, 1.38357751867269e2, -3.066479806614716e1, 2.506628277459239];
  const b = [-5.447609879822406e1, 1.615858368580409e2, -1.556989798598866e2, 6.680131188771972e1, -1.328068155288572e1];
  const c = [-7.784894002430293e-3, -3.223964580411365e-1, -2.400758277161838, -2.549732539343734, 4.374664141464968, 2.938163982698783];
  const d = [7.784695709041462e-3, 3.224671290700398e-1, 2.445134137142996, 3.754408661907416];
  const low = 0.02425;
  if (level < low || level > 1 - low) {
    const q = Math.sqrt(-2 * Math.log(level < low ? level : 1 - level));
    const value =
      (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
      ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
    return level < low ? value : -value;
  }
  const q = level - 0.5;
  const r = q * q;
  return (
    ((((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q) /
    (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1)
  );
}

/**
 * Quantile of "0 with probability 1 − p, else conditional ~ Normal(mean, sd²)",
 * the conditional part clipped at 0 unless negatives are allowed (C17: carry
 * the non-participation atom instead of a symmetric mean ± z·sd band).
 */
export function participationMixtureQuantile(
  level: number,
  probability: number,
  conditionalMean: number,
  conditionalSd: number,
  allowNegative: boolean,
): number {
  const p = Math.min(1, Math.max(0, probability));
  if (p <= 0) return 0;
  if (!(conditionalSd > 0)) {
    if (conditionalMean >= 0) {
      return level <= 1 - p ? 0 : Math.max(allowNegative ? -Infinity : 0, conditionalMean);
    }
    if (!allowNegative) return 0;
    return level <= p ? conditionalMean : 0;
  }
  if (allowNegative && level < p) {
    const below = conditionalMean + conditionalSd * normalQuantile(level / p);
    if (below < 0) return below;
  }
  if (level > 1 - p) {
    const above =
      conditionalMean + conditionalSd * normalQuantile((level - (1 - p)) / p);
    if (above > 0) return above;
  }
  return 0;
}

function gameQuantiles(
  moments: Record<string, { mean: number; variance: number; probability: number }>,
  population: FantasyProjectionPopulation,
): SeasonGameEvaluation["quantiles"] {
  const p10: ProjectionValues = {};
  const p50: ProjectionValues = {};
  const p90: ProjectionValues = {};
  for (const [target, moment] of Object.entries(moments)) {
    const sd = Math.sqrt(Math.max(0, moment.variance));
    const allowNegative = target === "PLUS_MINUS";
    const at = (level: number) =>
      round(participationMixtureQuantile(level, moment.probability, moment.mean, sd, allowNegative));
    p10[target] = at(0.1);
    p50[target] = at(0.5);
    p90[target] = at(0.9);
    if (target === "GAMES_PLAYED" || target === "GAMES_STARTED") {
      for (const values of [p10, p50, p90]) {
        values[target] = round(Math.min(1, Math.max(0, values[target])));
      }
    }
  }
  if (p10.GAMES_STARTED != null && p10.GAMES_PLAYED != null) {
    p10.GAMES_STARTED = Math.min(p10.GAMES_STARTED, p10.GAMES_PLAYED);
    p50.GAMES_STARTED = Math.min(p50.GAMES_STARTED, p50.GAMES_PLAYED);
    p90.GAMES_STARTED = Math.min(p90.GAMES_STARTED, p90.GAMES_PLAYED);
  }
  // Derived heads (POINTS, SV%, …) are marginal endpoint bounds here, not
  // joint quantiles; season aggregates use joint draws instead.
  return reconcileProjectionQuantiles({ p10, p50, p90 }, population);
}

function finiteOrNull(value: unknown): number | null {
  return value == null || !Number.isFinite(Number(value)) ? null : Number(value);
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
  const moments: Record<string, { mean: number; variance: number; probability: number }> = {};
  const missingTargets: string[] = [];
  const momentFlags: string[] = [];
  const team = artifact.teams[String(game.teamId)];
  const opponent = artifact.teams[String(game.opponentTeamId)];
  const venue = game.isHome ? team : opponent;

  const orderedTargets = [
    ...targetKeys.filter((target) => !(target in EXPECTED_ASSIST_ALIASES)),
    ...targetKeys.filter((target) => target in EXPECTED_ASSIST_ALIASES),
  ];
  for (const target of orderedTargets) {
    const aliasSource = EXPECTED_ASSIST_ALIASES[target];
    if (aliasSource) {
      // Alias identity (W3-5 PR2): same moments as the observed head; with
      // no evaluated source head the alias is unknown.
      if (!(aliasSource in conditionalMeans)) {
        missingTargets.push(target);
        continue;
      }
      conditionalMeans[target] = conditionalMeans[aliasSource];
      unconditionalMeans[target] = unconditionalMeans[aliasSource];
      baselineUnconditionalMeans[target] = baselineUnconditionalMeans[aliasSource];
      variances[target] = variances[aliasSource];
      moments[target] = moments[aliasSource];
      continue;
    }
    const participation = target === "GAMES_PLAYED" || target === "GAMES_STARTED";
    const rate = participation ? 1 : finiteOrNull(prior.conditionalRates[target]);
    if (rate == null) {
      missingTargets.push(target);
      continue;
    }
    const candidateMultiplier = targetMultiplier(
      target,
      prior.population,
      team,
      opponent,
      venue,
      game,
      prior.contextEffects?.[target],
    );
    const conditional = participation
      ? 1
      : Math.max(target === "PLUS_MINUS" ? -Infinity : 0, rate * candidateMultiplier);
    const mixtureProbability =
      target === "GAMES_STARTED"
        ? rawStartProbability ?? 0
        : rawPlayingProbability;
    let conditionalVariance: number;
    if (participation) {
      // GP/GS are Bernoulli: given participation the count is exactly 1.
      conditionalVariance = 0;
    } else {
      const suppliedVariance = finiteOrNull(prior.conditionalVariances[target]);
      if (suppliedVariance == null) {
        // Poisson fallback on the already adjusted mean: m enters once.
        conditionalVariance = Math.abs(conditional);
        momentFlags.push(`variance_poisson_fallback:${target}`);
      } else {
        // Declared convention: the variance-to-mean ratio is preserved under
        // the game multiplier (exact for Poisson; m² is exact only for mY).
        conditionalVariance = Math.max(0, suppliedVariance * candidateMultiplier);
      }
    }
    conditionalMeans[target] = round(conditional);
    unconditionalMeans[target] = round(conditional * mixtureProbability);
    const baselineRate = participation
      ? 1
      : finiteOrNull(prior.baselineConditionalRates?.[target]) ?? rate;
    const baselineConditional = participation
      ? 1
      : Math.max(
          target === "PLUS_MINUS" ? -Infinity : 0,
          baselineRate * targetMultiplier(target, prior.population, team, opponent, venue),
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
    moments[target] = {
      mean: conditional,
      variance: conditionalVariance,
      probability: mixtureProbability,
    };
  }

  const reconciledConditional = reconcileProjectionValues(
    conditionalMeans,
    prior.population,
  );
  const unconditional = reconcileProjectionValuesWithClamps(
    unconditionalMeans,
    prior.population,
  );
  const reconciledBaselineUnconditional = reconcileProjectionValues(
    baselineUnconditionalMeans,
    prior.population,
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
    unconditionalMeans: unconditional.values,
    baselineUnconditionalMeans: reconciledBaselineUnconditional,
    variances,
    quantiles: gameQuantiles(moments, prior.population),
    deployment: prior.deployment,
    fallbackFlags: [...(prior.fallbackFlags ?? [])].sort(),
    evaluatorVersion: SEASON_GAME_EVALUATOR_VERSION,
    ...(prior.population === "goalie"
      ? { outcomeTreatment: GOALIE_OUTCOME_TREATMENT_VERSION }
      : {}),
    missingTargets: [...missingTargets].sort(),
    momentFlags: [...momentFlags].sort(),
    reconciliationClamps: unconditional.clamps,
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

function aliasSourceIn(target: string, values: ProjectionValues): string | null {
  const source = EXPECTED_ASSIST_ALIASES[target];
  return source && source in values ? source : null;
}

function jointAggregateQuantiles(
  means: ProjectionValues,
  variances: ProjectionValues,
  actuals: ProjectionValues,
  population: FantasyProjectionPopulation,
  maximumGames: number,
  seed: string,
  draws = SEASON_AGGREGATE_DRAWS,
): SeasonGameEvaluation["quantiles"] {
  let state = Number.parseInt(createHash("sha256").update(seed).digest("hex").slice(0, 8), 16);
  const normal = () => {
    state = (Math.imul(1_664_525, state) + 1_013_904_223) >>> 0;
    const first = (state + 0.5) / 4_294_967_296;
    state = (Math.imul(1_664_525, state) + 1_013_904_223) >>> 0;
    const second = (state + 0.5) / 4_294_967_296;
    return Math.sqrt(-2 * Math.log(first)) * Math.cos(2 * Math.PI * second);
  };
  const targets = Object.keys(variances).sort();
  const samples = new Map<string, number[]>();
  const loading = SEASON_AGGREGATE_FACTOR_LOADING;
  const independentWeight = Math.sqrt(1 - loading * loading);
  for (let drawIndex = 0; drawIndex < draws; drawIndex += 1) {
    const common = normal();
    const draw: ProjectionValues = {};
    for (const target of targets) {
      if (aliasSourceIn(target, means)) continue;
      const deviation = loading * common + independentWeight * normal();
      const value = means[target] + Math.sqrt(Math.max(0, variances[target])) * deviation;
      draw[target] = target === "PLUS_MINUS" ? value : Math.max(0, value);
    }
    for (const target of targets) {
      const source = aliasSourceIn(target, means);
      if (source) draw[target] = draw[source];
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
    // Actuals are a known offset: add them per draw, before any derived head
    // is formed, so sums and ratios stay joint (W3-5 F4/PR1, rule 26).
    for (const target of targets) {
      draw[target] += actuals[target] ?? 0;
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
      [...samples.entries()]
        .filter(([, values]) => values.length === draws)
        .map(([target, values]) => [target, sampledQuantile(values, probability)]),
    );
  return {
    p10: projection(0.1),
    p50: projection(0.5),
    p90: projection(0.9),
  };
}

export type SeasonAggregate = {
  means: ProjectionValues;
  variances: ProjectionValues;
  quantiles: SeasonGameEvaluation["quantiles"];
  componentManifest: Array<{ gameId: number; componentHash: string }>;
  aggregationVersion: string;
  dependence: {
    crossGame: "independent_games_assumption";
    withinGameTargets: "one_factor_gaussian";
    factorLoading: number;
    primitiveCorrelation: number;
  };
  /** Targets unknown in at least one remaining game: unknown in the total. */
  missingTargets: string[];
  aggregateHash: string;
};

function finishAggregate(
  unsigned: Omit<SeasonAggregate, "aggregateHash">,
): SeasonAggregate {
  return { ...unsigned, aggregateHash: checksumCanonicalJson(unsigned) };
}

const AGGREGATE_DEPENDENCE: SeasonAggregate["dependence"] = {
  crossGame: "independent_games_assumption",
  withinGameTargets: "one_factor_gaussian",
  factorLoading: SEASON_AGGREGATE_FACTOR_LOADING,
  primitiveCorrelation: round(SEASON_AGGREGATE_FACTOR_LOADING ** 2),
};

/**
 * Season aggregate of remaining-game evaluations plus (current view) the
 * player's actuals so far. Means add; variances add under the declared
 * independent-games assumption; every quantile, primitive or derived, comes
 * from one joint draw set with the actuals added per draw.
 */
/**
 * Actuals so far, by primitive target. An explicit null (or non-finite) value
 * means at least one completed game's value is unknown: the season total for
 * that target is then unknown too (W2-7 D9), never actual-as-0.
 */
export type SeasonActuals = Readonly<Record<string, number | null | undefined>>;

export function aggregateSeasonGames(
  evaluations: SeasonGameEvaluation[],
  options: { actuals?: SeasonActuals } = {},
): SeasonAggregate {
  if (evaluations.length === 0) {
    throw new Error("PLAYER_FORECAST_SEASON_COMPONENTS_REQUIRED");
  }
  const population = evaluations[0].population;
  for (const evaluation of evaluations) {
    if (evaluation.population !== population) {
      throw new Error("PLAYER_FORECAST_SEASON_POPULATION_MISMATCH");
    }
  }
  const suppliedActuals = options.actuals ?? {};
  // Only primitive (variance-carrying) targets are summed; derived heads are
  // rebuilt from the summed primitives.
  const allTargets = new Set(evaluations.flatMap((evaluation) => Object.keys(evaluation.variances)));
  const missingTargets = new Set(evaluations.flatMap((evaluation) => evaluation.missingTargets ?? []));
  const targets: string[] = [];
  for (const target of [...allTargets].sort()) {
    const knownEverywhere = evaluations.every(
      (evaluation) =>
        target in evaluation.variances && target in evaluation.unconditionalMeans,
    );
    if (knownEverywhere && !missingTargets.has(target)) targets.push(target);
    else missingTargets.add(target);
  }
  const means: ProjectionValues = {};
  const variances: ProjectionValues = {};
  for (const target of targets) {
    let mean = 0;
    let variance = 0;
    for (const evaluation of evaluations) {
      mean += evaluation.unconditionalMeans[target];
      variance += evaluation.variances[target];
    }
    means[target] = round(mean);
    variances[target] = round(variance);
  }
  for (const target of missingTargets) {
    delete means[target];
    delete variances[target];
  }
  // An expected-assist alias is the observed head: it takes its source's actuals.
  const actuals: ProjectionValues = {};
  for (const target of Object.keys(means)) {
    const source = aliasSourceIn(target, means);
    const key = source ?? target;
    const raw = suppliedActuals[key];
    if (key in suppliedActuals && raw !== undefined && finiteOrNull(raw) == null) {
      missingTargets.add(target);
      delete means[target];
      delete variances[target];
      continue;
    }
    actuals[target] = finiteOrNull(raw) ?? 0;
  }
  const totals = Object.fromEntries(
    Object.entries(means).map(([target, value]) => [target, round(value + actuals[target])]),
  );
  const componentManifest = evaluations
    .map(({ gameId, componentHash }) => ({ gameId, componentHash }))
    .sort((left, right) => left.gameId - right.gameId);
  return finishAggregate({
    means: reconcileProjectionValues(totals, population),
    variances,
    quantiles: jointAggregateQuantiles(
      means,
      variances,
      actuals,
      population,
      evaluations.length,
      `${SEASON_AGGREGATE_VERSION}:${evaluations[0].fhfhPlayerId}:${componentManifest
        .map(({ gameId }) => gameId)
        .join(",")}`,
    ),
    componentManifest,
    aggregationVersion: SEASON_AGGREGATE_VERSION,
    dependence: AGGREGATE_DEPENDENCE,
    missingTargets: [...missingTargets].sort(),
  });
}

/**
 * No remaining games: the remaining contribution is a real zero for every
 * primitive target; with actuals, the season line is exactly the actuals.
 */
export function emptySeasonAggregate(
  population: FantasyProjectionPopulation,
  primitiveTargets: readonly string[],
  options: { actuals?: SeasonActuals } = {},
): SeasonAggregate {
  const actuals = options.actuals ?? {};
  const missingTargets = primitiveTargets.filter(
    (target) => target in actuals && actuals[target] !== undefined && finiteOrNull(actuals[target]) == null,
  );
  const knownTargets = primitiveTargets.filter((target) => !missingTargets.includes(target));
  const totals = reconcileProjectionValues(
    Object.fromEntries(knownTargets.map((target) => [target, round(finiteOrNull(actuals[target]) ?? 0)])),
    population,
  );
  return finishAggregate({
    means: totals,
    variances: Object.fromEntries(knownTargets.map((target) => [target, 0])),
    quantiles: { p10: { ...totals }, p50: { ...totals }, p90: { ...totals } },
    componentManifest: [],
    aggregationVersion: SEASON_AGGREGATE_VERSION,
    dependence: AGGREGATE_DEPENDENCE,
    missingTargets: [...missingTargets].sort(),
  });
}
