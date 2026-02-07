type ConfidenceTier = "LOW" | "MEDIUM" | "HIGH";
type QualityTier = "ELITE" | "ABOVE_AVERAGE" | "AVERAGE" | "BELOW_AVERAGE";
type ReliabilityTier = "STABLE" | "AVERAGE" | "VOLATILE";
type GoalieRecommendation = "START" | "SIT" | "STREAM_TARGET" | "AVOID";

export type GoalieEvidence = {
  recentStarts: number;
  recentShotsAgainst: number;
  recentGoalsAllowed: number;
  baselineStarts: number;
  baselineShotsAgainst: number;
  baselineGoalsAllowed: number;
  residualStdDev: number;
};

export type GoalieModelInput = {
  projectedShotsAgainst: number;
  starterProbability: number;
  projectedGoalsFor: number;
  evidence: GoalieEvidence;
  leagueSavePct?: number;
};

export type GoalieModelOutput = {
  modeledSavePct: number;
  projectedGoalsAllowed: number;
  projectedSaves: number;
  winProbability: number;
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

function safeRate(numerator: number, denominator: number, fallback: number): number {
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator <= 0)
    return fallback;
  return numerator / denominator;
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

export function computeGoalieProjectionModel(
  input: GoalieModelInput
): GoalieModelOutput {
  const leagueSavePct = clamp(input.leagueSavePct ?? 0.9, 0.84, 0.94);
  const projectedShotsAgainst = Math.max(0, input.projectedShotsAgainst);
  const starterProbability = clamp(input.starterProbability, 0, 1);
  const projectedGoalsFor = Math.max(0, input.projectedGoalsFor);

  const recentShots = Math.max(0, input.evidence.recentShotsAgainst);
  const recentGoals = Math.max(0, input.evidence.recentGoalsAllowed);
  const baselineShots = Math.max(0, input.evidence.baselineShotsAgainst);
  const baselineGoals = Math.max(0, input.evidence.baselineGoalsAllowed);

  const recentSvPct = 1 - safeRate(recentGoals, recentShots, 1 - leagueSavePct);
  const baselineSvPct =
    1 - safeRate(baselineGoals, baselineShots, 1 - leagueSavePct);

  const recentWeight = clamp(recentShots / (recentShots + 500), 0, 1);
  const evidenceSvPct =
    baselineSvPct + recentWeight * (recentSvPct - baselineSvPct);

  const priorShots = clamp(850 - baselineShots * 0.25, 350, 900);
  const priorSaves = priorShots * leagueSavePct;
  const posteriorSvPct = safeRate(
    evidenceSvPct * (baselineShots + recentShots) + priorSaves,
    baselineShots + recentShots + priorShots,
    leagueSavePct
  );
  const modeledSavePct = clamp(posteriorSvPct, 0.85, 0.94);

  const projectedGoalsAllowed = projectedShotsAgainst * (1 - modeledSavePct);
  const projectedSaves = Math.max(0, projectedShotsAgainst - projectedGoalsAllowed);

  const volatilityIndex = clamp(input.evidence.residualStdDev / 1.2, 0, 2);
  const blowupLambda = projectedGoalsAllowed * (1 + 0.35 * volatilityIndex);
  const blowupRisk = clamp(
    (1 - poissonCdf(3, blowupLambda)) * starterProbability,
    0,
    1
  );

  const goalDiff = projectedGoalsFor - projectedGoalsAllowed;
  const baseWinProb = 1 / (1 + Math.exp(-goalDiff / 1.25));
  const winProbability = clamp(baseWinProb * starterProbability, 0, 1);
  const shutoutBase = Math.exp(-projectedGoalsAllowed);
  const shutoutProbability = clamp(shutoutBase * starterProbability, 0, 1);

  const baselineSampleConfidence = clamp(baselineShots / 1200, 0, 1);
  const recentSampleConfidence = clamp(recentShots / 300, 0, 1);
  const volatilityPenalty = clamp(volatilityIndex / 2, 0, 1) * 0.35;
  const confidenceScore = clamp(
    0.2 + baselineSampleConfidence * 0.5 + recentSampleConfidence * 0.3 - volatilityPenalty,
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
