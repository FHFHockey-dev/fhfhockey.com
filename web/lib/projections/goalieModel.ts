import {
  STARTER_DECISION_SHARE,
  posteriorSavePct,
  shutoutProbability as shotsMixtureShutoutProbability,
  teamWinProbability
} from "./goalie/goalieOutcomes";

type ConfidenceTier = "LOW" | "MEDIUM" | "HIGH";
type QualityTier = "ELITE" | "ABOVE_AVERAGE" | "AVERAGE" | "BELOW_AVERAGE";
type ReliabilityTier = "STABLE" | "AVERAGE" | "VOLATILE";
type GoalieRecommendation = "START" | "SIT" | "STREAM_TARGET" | "AVOID";

export type GoalieEvidence = {
  recentStarts: number;
  recentShotsAgainst: number;
  recentGoalsAllowed: number;
  seasonStarts: number;
  seasonShotsAgainst: number;
  seasonGoalsAllowed: number;
  baselineStarts: number;
  baselineShotsAgainst: number;
  baselineGoalsAllowed: number;
  residualStdDev: number;
  qualityStarts?: number | null;
  qualityStartsPct?: number | null;
};

export type GoalieModelInput = {
  projectedShotsAgainst: number;
  starterProbability: number;
  projectedGoalsFor: number | null;
  evidence: GoalieEvidence;
  /** Season-current league save % (the beta prior mean). */
  leagueSavePct?: number;
  /** Additive game-context save % adjustment (B2B, workload, damped context terms). */
  savePctAdjustment?: number;
  /**
   * P(team wins | this goalie starts): a team-game probability (the team-level value is paired per
   * game so both teams sum to 1), conditioned on this starter. When omitted,
   * an unpaired Poisson race of projectedGoalsFor vs this goalie's goals allowed is used.
   */
  teamWinProbabilityIfStarts?: number | null;
};

export type GoalieModelOutput = {
  modeledSavePct: number;
  projectedGoalsAllowed: number;
  projectedSaves: number;
  /**
   * This goalie's credited W without relief: P(start) x P(team wins | starts) x decision share
   * (with starterProbability 1, the W among starts). Not a team win probability; scored against
   * credited wins. goalieWinPopulations adds the relief share across candidates.
   */
  winProbability: number | null;
  shutoutProbability: number;
  blowupRisk: number;
  volatilityIndex: number;
  confidenceTier: ConfidenceTier;
  qualityTier: QualityTier;
  reliabilityTier: ReliabilityTier;
  recommendation: GoalieRecommendation;
};

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}

function normalizePct(value: number | null | undefined): number | null {
  if (!Number.isFinite(value)) return null;
  const raw = Number(value);
  if (raw < 0) return null;
  if (raw > 1 && raw <= 100) return raw / 100;
  return clamp(raw, 0, 1);
}

function poissonCdf(k: number, lambda: number): number {
  if (lambda <= 0) return 1;
  const maxK = Math.max(0, Math.floor(k));
  let sum = 0;
  let term = Math.exp(-lambda);
  for (let i = 0; i <= maxK; i += 1) {
    if (i > 0) term *= lambda / i;
    sum += term;
  }
  return clamp(sum, 0, 1);
}

function tierFromConfidence(score: number): ConfidenceTier {
  if (score >= 0.72) return "HIGH";
  if (score >= 0.45) return "MEDIUM";
  return "LOW";
}

function qualityFromSavePctDelta(delta: number): QualityTier {
  if (delta >= 0.012) return "ELITE";
  if (delta >= 0.004) return "ABOVE_AVERAGE";
  if (delta >= -0.006) return "AVERAGE";
  return "BELOW_AVERAGE";
}

function reliabilityFromVolatility(volatilityIndex: number): ReliabilityTier {
  if (volatilityIndex <= 0.55) return "STABLE";
  if (volatilityIndex <= 1.1) return "AVERAGE";
  return "VOLATILE";
}

function recommendationFromProfile(args: {
  starterProbability: number;
  blowupRisk: number;
  qualityTier: QualityTier;
  reliabilityTier: ReliabilityTier;
}): GoalieRecommendation {
  const { starterProbability, blowupRisk, qualityTier, reliabilityTier } = args;
  if (starterProbability < 0.42) return "AVOID";
  if (qualityTier === "ELITE" && reliabilityTier === "STABLE") return "START";
  if (blowupRisk >= 0.42 && reliabilityTier === "VOLATILE") return "SIT";
  if (starterProbability >= 0.62 && blowupRisk <= 0.32) return "START";
  if (
    starterProbability >= 0.5 &&
    (qualityTier === "ELITE" || qualityTier === "ABOVE_AVERAGE")
  ) {
    return "STREAM_TARGET";
  }
  return "SIT";
}

export function computeModeledSavePct(args: {
  evidence: GoalieEvidence;
  leagueSavePct?: number;
  savePctAdjustment?: number;
}): number {
  const leagueSavePct = clamp(args.leagueSavePct ?? 0.9, 0.84, 0.94);
  const baselineShots = Math.max(0, args.evidence.baselineShotsAgainst);
  const seasonShots = Math.max(0, args.evidence.seasonShotsAgainst ?? 0);
  // The baseline window (last 200 GP) contains the season and recent windows: use it once.
  const useBaseline = baselineShots >= seasonShots;
  const posterior = posteriorSavePct({
    shots: useBaseline ? baselineShots : seasonShots,
    goals: Math.max(0, useBaseline ? args.evidence.baselineGoalsAllowed : args.evidence.seasonGoalsAllowed),
    priorMean: leagueSavePct
  });
  const adjustment = Number.isFinite(args.savePctAdjustment) ? Number(args.savePctAdjustment) : 0;
  return clamp(posterior + adjustment, 0.85, 0.94);
}

export function computeGoalieProjectionModel(
  input: GoalieModelInput
): GoalieModelOutput {
  const leagueSavePct = clamp(input.leagueSavePct ?? 0.9, 0.84, 0.94);
  const projectedShotsAgainst = Math.max(0, input.projectedShotsAgainst);
  const starterProbability = clamp(input.starterProbability, 0, 1);
  if (input.projectedGoalsFor !== null && (!Number.isFinite(input.projectedGoalsFor) || input.projectedGoalsFor < 0)) {
    throw new Error("Projected goals for must be finite and nonnegative, or explicitly unavailable");
  }
  const projectedGoalsFor = input.projectedGoalsFor;

  const recentShots = Math.max(0, input.evidence.recentShotsAgainst);
  const seasonShots = Math.max(
    0,
    input.evidence.seasonShotsAgainst ?? input.evidence.baselineShotsAgainst
  );
  const baselineShots = Math.max(0, input.evidence.baselineShotsAgainst);

  const lowRecentSamplePenalty = clamp((140 - recentShots) / 140, 0, 1);
  const lowSeasonSamplePenalty = clamp((420 - seasonShots) / 420, 0, 1);
  const smallSamplePenalty = clamp(
    lowRecentSamplePenalty * 0.6 + lowSeasonSamplePenalty * 0.4,
    0,
    1
  );

  // One beta-binomial over all evidence toward the season-current league mean (no recency layer).
  const modeledSavePct = computeModeledSavePct({
    evidence: input.evidence,
    leagueSavePct,
    savePctAdjustment: input.savePctAdjustment
  });

  const projectedGoalsAllowed = projectedShotsAgainst * (1 - modeledSavePct);
  const projectedSaves = Math.max(0, projectedShotsAgainst - projectedGoalsAllowed);

  const qualityStarts = Math.max(0, input.evidence.qualityStarts ?? 0);
  const qualityStartsPct = normalizePct(input.evidence.qualityStartsPct);
  const qualityStartsWeight = clamp(qualityStarts / (qualityStarts + 16), 0, 1);
  const qualityStabilityDelta =
    qualityStartsPct == null
      ? 0
      : clamp(qualityStartsPct - 0.53, -0.25, 0.25) * qualityStartsWeight;
  const volatilityIndex = clamp(
    input.evidence.residualStdDev / 1.2 - qualityStabilityDelta * 1.25,
    0,
    2
  );
  const blowupLambda = projectedGoalsAllowed * (1 + 0.35 * volatilityIndex);
  const blowupRisk = clamp(
    (1 - poissonCdf(3, blowupLambda)) * starterProbability,
    0,
    1
  );

  const teamWinIfStarts = input.teamWinProbabilityIfStarts !== undefined
    ? input.teamWinProbabilityIfStarts
    : projectedGoalsFor === null ? null : teamWinProbability(projectedGoalsFor, projectedGoalsAllowed);
  const winProbability = teamWinIfStarts == null ? null
    : clamp(clamp(teamWinIfStarts, 0, 1) * STARTER_DECISION_SHARE * starterProbability, 0, 1);
  const shutoutProbability = clamp(
    shotsMixtureShutoutProbability({ expectedShotsAgainst: projectedShotsAgainst, savePct: modeledSavePct }) *
      starterProbability,
    0,
    1
  );

  const baselineSampleConfidence = clamp(baselineShots / 1400, 0, 1);
  const seasonSampleConfidence = clamp(seasonShots / 900, 0, 1);
  const recentSampleConfidence = clamp(recentShots / 300, 0, 1);
  const volatilityPenalty = clamp(volatilityIndex / 2, 0, 1) * 0.35;
  const samplePenalty = smallSamplePenalty * 0.22;
  const qualityStabilityBoost = clamp(qualityStabilityDelta * 0.4, -0.06, 0.06);
  const confidenceScore = clamp(
    0.18 +
      baselineSampleConfidence * 0.4 +
      seasonSampleConfidence * 0.25 +
      recentSampleConfidence * 0.17 -
      volatilityPenalty -
      samplePenalty +
      qualityStabilityBoost,
    0,
    1
  );
  const confidenceTier = tierFromConfidence(confidenceScore);

  const qualityTier = qualityFromSavePctDelta(modeledSavePct - leagueSavePct);
  const reliabilityTier = reliabilityFromVolatility(volatilityIndex);
  const recommendation = recommendationFromProfile({
    starterProbability,
    blowupRisk,
    qualityTier,
    reliabilityTier
  });

  return {
    modeledSavePct,
    projectedGoalsAllowed,
    projectedSaves,
    winProbability,
    shutoutProbability,
    blowupRisk,
    volatilityIndex,
    confidenceTier,
    qualityTier,
    reliabilityTier,
    recommendation
  };
}
