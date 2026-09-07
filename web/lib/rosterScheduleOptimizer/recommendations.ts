import {
  CANONICAL_POSITION_ORDER,
  canEligibilityOccupySlot,
  compatibleActiveSlotTypes,
  normalizeEligibility,
} from "./eligibility";
import { expandActiveSlots } from "./slots";
import {
  DEFAULT_RECOMMENDATION_THRESHOLDS,
  type AlternativeRecommendation,
  type CanonicalEligibility,
  type CandidateDustComparable,
  type RecommendationThresholds,
} from "./types";

type PreparedCandidate<TDust extends CandidateDustComparable> = {
  dust: TDust;
  eligibility: ReturnType<typeof normalizeEligibility>;
  compatibleSlotTypes: readonly CanonicalEligibility[];
};

function compareRecommendations<TDust extends CandidateDustComparable>(
  left: AlternativeRecommendation<TDust>,
  right: AlternativeRecommendation<TDust>,
): number {
  return (
    right.dustImprovement - left.dustImprovement ||
    right.valueDifference - left.valueDifference ||
    right.player.value - left.player.value ||
    left.player.id.localeCompare(right.player.id)
  );
}

function prepareCandidate<TDust extends CandidateDustComparable>(
  dust: TDust,
  activeSlotTypes: readonly string[],
): PreparedCandidate<TDust> {
  const eligibility = normalizeEligibility(dust.player.eligiblePositions);
  return {
    dust,
    eligibility,
    compatibleSlotTypes: CANONICAL_POSITION_ORDER.filter(
      (slotType) =>
        activeSlotTypes.includes(slotType) &&
        canEligibilityOccupySlot(eligibility, slotType),
    ),
  };
}

/**
 * Prepares a fixed alternative pool for callers that only need the top result
 * for many candidates. The public full-ranking API remains available below.
 */
export function createBestAlternativeRecommendationFinder<
  TDust extends CandidateDustComparable,
>(
  alternatives: readonly TDust[],
  rosterSlots: Readonly<Record<string, number>>,
  thresholds: RecommendationThresholds = DEFAULT_RECOMMENDATION_THRESHOLDS,
): (candidate: TDust) => AlternativeRecommendation<TDust> | undefined {
  const activeSlotTypes = expandActiveSlots(rosterSlots).activeSlots.map(
    (slot) => slot.type,
  );
  const preparedAlternatives = alternatives.map((alternative) =>
    prepareCandidate(alternative, activeSlotTypes),
  );
  const preparedByDust = new Map(
    preparedAlternatives.map((prepared) => [prepared.dust, prepared]),
  );

  return (candidate) => {
    const candidatePrepared =
      preparedByDust.get(candidate) ??
      prepareCandidate(candidate, activeSlotTypes);
    const candidateEligibility = candidatePrepared.eligibility;
    if (!candidateEligibility.valid || activeSlotTypes.length === 0) {
      return undefined;
    }

    let best: AlternativeRecommendation<TDust> | undefined;
    for (const alternativePrepared of preparedAlternatives) {
      const alternative = alternativePrepared.dust;
      if (
        alternative.player.id === candidate.player.id ||
        alternative.player.available === false ||
        !alternativePrepared.eligibility.valid ||
        alternativePrepared.eligibility.playerClass !==
          candidateEligibility.playerClass
      ) {
        continue;
      }

      const meaningfulOverlappingSlotTypes =
        candidatePrepared.compatibleSlotTypes.filter(
          (slotType) =>
            slotType !== "UTIL" &&
            alternativePrepared.compatibleSlotTypes.includes(slotType),
        );
      if (meaningfulOverlappingSlotTypes.length === 0) continue;

      const dustImprovement =
        candidate.marginalDustGames - alternative.marginalDustGames;
      const requiredDustImprovement = Math.max(
        thresholds.minimumDustImprovement,
        Math.ceil(
          candidate.marginalDustGames *
            thresholds.minimumRelativeDustImprovement,
        ),
      );
      if (dustImprovement < requiredDustImprovement) continue;
      const valueDifference = alternative.player.value - candidate.player.value;
      const valueLoss = Math.max(0, -valueDifference);
      const relativeValueLoss =
        valueLoss === 0
          ? 0
          : candidate.player.value > 0
            ? valueLoss / candidate.player.value
            : Number.POSITIVE_INFINITY;
      if (relativeValueLoss > thresholds.maximumRelativeValueLoss) continue;
      if (
        thresholds.maximumAbsoluteValueLoss !== undefined &&
        valueLoss > thresholds.maximumAbsoluteValueLoss
      ) {
        continue;
      }

      const recommendation: AlternativeRecommendation<TDust> = {
        player: alternative.player,
        dust: alternative,
        dustImprovement,
        valueDifference,
        relativeValueLoss,
        overlappingSlotTypes: meaningfulOverlappingSlotTypes,
      };
      if (!best || compareRecommendations(recommendation, best) < 0) {
        best = recommendation;
      }
    }
    return best;
  };
}

export function rankAlternativeRecommendations<
  TDust extends CandidateDustComparable,
>(
  candidate: TDust,
  alternatives: readonly TDust[],
  rosterSlots: Readonly<Record<string, number>>,
  thresholds: RecommendationThresholds = DEFAULT_RECOMMENDATION_THRESHOLDS,
): readonly AlternativeRecommendation<TDust>[] {
  const activeSlotTypes = expandActiveSlots(rosterSlots).activeSlots.map(
    (slot) => slot.type,
  );
  const candidateEligibility = normalizeEligibility(
    candidate.player.eligiblePositions,
  );
  if (!candidateEligibility.valid || activeSlotTypes.length === 0) return [];
  const candidateSlotTypes = compatibleActiveSlotTypes(
    candidate.player.eligiblePositions,
    activeSlotTypes,
  );

  const recommendations: AlternativeRecommendation<TDust>[] = [];
  for (const alternative of alternatives) {
    if (
      alternative.player.id === candidate.player.id ||
      alternative.player.available === false
    ) {
      continue;
    }
    const alternativeEligibility = normalizeEligibility(
      alternative.player.eligiblePositions,
    );
    if (
      !alternativeEligibility.valid ||
      alternativeEligibility.playerClass !== candidateEligibility.playerClass
    ) {
      continue;
    }
    const alternativeSlotTypes = compatibleActiveSlotTypes(
      alternative.player.eligiblePositions,
      activeSlotTypes,
    );
    const overlappingSlotTypes = candidateSlotTypes.filter((slotType) =>
      alternativeSlotTypes.includes(slotType),
    );
    const meaningfulOverlappingSlotTypes = overlappingSlotTypes.filter(
      (slotType) => slotType !== "UTIL",
    );
    if (meaningfulOverlappingSlotTypes.length === 0) continue;

    const dustImprovement =
      candidate.marginalDustGames - alternative.marginalDustGames;
    const requiredDustImprovement = Math.max(
      thresholds.minimumDustImprovement,
      Math.ceil(
        candidate.marginalDustGames *
          thresholds.minimumRelativeDustImprovement,
      ),
    );
    if (dustImprovement < requiredDustImprovement) continue;
    const valueDifference = alternative.player.value - candidate.player.value;
    const valueLoss = Math.max(0, -valueDifference);
    const relativeValueLoss =
      valueLoss === 0
        ? 0
        : candidate.player.value > 0
          ? valueLoss / candidate.player.value
          : Number.POSITIVE_INFINITY;
    if (relativeValueLoss > thresholds.maximumRelativeValueLoss) continue;
    if (
      thresholds.maximumAbsoluteValueLoss !== undefined &&
      valueLoss > thresholds.maximumAbsoluteValueLoss
    ) {
      continue;
    }

    recommendations.push({
      player: alternative.player,
      dust: alternative,
      dustImprovement,
      valueDifference,
      relativeValueLoss,
      overlappingSlotTypes: meaningfulOverlappingSlotTypes,
    });
  }

  return recommendations.sort(compareRecommendations);
}
