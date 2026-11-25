import {
  CANONICAL_POSITION_ORDER,
  canEligibilityOccupySlot,
  normalizeEligibility,
} from "./eligibility";
import { expandActiveSlots } from "./slots";
import {
  DEFAULT_RECOMMENDATION_THRESHOLDS,
  type ActiveSlotType,
  type AlternativeRecommendation,
  type CandidateDustComparable,
  type RecommendationThresholds,
} from "./types";

type PreparedCandidate<TDust extends CandidateDustComparable> = {
  dust: TDust;
  eligibility: ReturnType<typeof normalizeEligibility>;
  slotTypes: readonly ActiveSlotType[];
};

function prepareCandidate<TDust extends CandidateDustComparable>(
  dust: TDust,
  activeSlotTypes: readonly ActiveSlotType[],
): PreparedCandidate<TDust> {
  const eligibility = normalizeEligibility(dust.player.eligiblePositions);
  return {
    dust,
    eligibility,
    slotTypes: CANONICAL_POSITION_ORDER.filter(
      (slotType) =>
        slotType !== "UTIL" &&
        activeSlotTypes.includes(slotType) &&
        canEligibilityOccupySlot(eligibility, slotType),
    ),
  };
}

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

function recommendationEvaluator<TDust extends CandidateDustComparable>(
  prepared: PreparedCandidate<TDust>,
  thresholds: RecommendationThresholds,
) {
  const candidate = prepared.dust;
  const requiredDustImprovement = Math.max(
    thresholds.minimumDustImprovement,
    Math.ceil(
      candidate.marginalDustGames * thresholds.minimumRelativeDustImprovement,
    ),
  );

  return (
    alternativePrepared: PreparedCandidate<TDust>,
  ): AlternativeRecommendation<TDust> | undefined => {
    const alternative = alternativePrepared.dust;
    if (
      alternative.player.id === candidate.player.id ||
      alternative.player.available === false ||
      !alternativePrepared.eligibility.valid ||
      alternativePrepared.eligibility.playerClass !==
        prepared.eligibility.playerClass
    ) {
      return undefined;
    }

    const overlappingSlotTypes = prepared.slotTypes.filter((slotType) =>
      alternativePrepared.slotTypes.includes(slotType),
    );
    if (overlappingSlotTypes.length === 0) return undefined;

    const dustImprovement =
      candidate.marginalDustGames - alternative.marginalDustGames;
    if (dustImprovement < requiredDustImprovement) return undefined;
    const valueDifference = alternative.player.value - candidate.player.value;
    const valueLoss = Math.max(0, -valueDifference);
    const relativeValueLoss =
      valueLoss === 0
        ? 0
        : candidate.player.value > 0
          ? valueLoss / candidate.player.value
          : Number.POSITIVE_INFINITY;
    if (relativeValueLoss > thresholds.maximumRelativeValueLoss) return undefined;
    if (
      thresholds.maximumAbsoluteValueLoss !== undefined &&
      valueLoss > thresholds.maximumAbsoluteValueLoss
    ) {
      return undefined;
    }

    return {
      player: alternative.player,
      dust: alternative,
      dustImprovement,
      valueDifference,
      relativeValueLoss,
      overlappingSlotTypes,
    };
  };
}

/** Prepare a fixed pool once for callers that only need the best result. */
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
  const prepared = alternatives.map((alternative) =>
    prepareCandidate(alternative, activeSlotTypes),
  );
  const byDust = new Map(prepared.map((entry) => [entry.dust, entry]));

  return (candidate) => {
    const entry = byDust.get(candidate) ?? prepareCandidate(candidate, activeSlotTypes);
    if (!entry.slotTypes.length) return undefined;

    const evaluate = recommendationEvaluator(entry, thresholds);
    let best: AlternativeRecommendation<TDust> | undefined;
    for (const alternative of prepared) {
      const recommendation = evaluate(alternative);
      if (recommendation && (!best || compareRecommendations(recommendation, best) < 0)) {
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
  const prepared = prepareCandidate(candidate, activeSlotTypes);
  if (!prepared.slotTypes.length) return [];
  const evaluate = recommendationEvaluator(prepared, thresholds);

  const recommendations: AlternativeRecommendation<TDust>[] = [];
  for (const alternative of alternatives) {
    const recommendation = evaluate(prepareCandidate(alternative, activeSlotTypes));
    if (recommendation) recommendations.push(recommendation);
  }
  return recommendations.sort(compareRecommendations);
}
