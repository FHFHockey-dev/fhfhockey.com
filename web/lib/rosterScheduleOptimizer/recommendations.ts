import {
  compatibleActiveSlotTypes,
  normalizeEligibility,
} from "./eligibility";
import { expandActiveSlots } from "./slots";
import {
  DEFAULT_RECOMMENDATION_THRESHOLDS,
  type AlternativeRecommendation,
  type CandidateDustComparable,
  type RecommendationThresholds,
} from "./types";

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

  return recommendations.sort(
    (left, right) =>
      right.dustImprovement - left.dustImprovement ||
      right.valueDifference - left.valueDifference ||
      right.player.value - left.player.value ||
      left.player.id.localeCompare(right.player.id),
  );
}
