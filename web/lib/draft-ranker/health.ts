export type DraftRankingOrderHealth = {
  rankingId: string;
  lockVersion: number;
  entryCount: number;
  minimumOrderKey: number | null;
  maximumOrderKey: number | null;
  minimumGap: number | null;
  duplicateOrderKeys: number;
  nonIncreasingKeys: number;
  unsafeOrderKeys: number;
  normalizationRecommended: boolean;
  underfilledTop250: boolean;
};

export function analyzeDraftRankingOrdering(args: {
  rankingId: string;
  lockVersion: number;
  orderKeys: number[];
}): DraftRankingOrderHealth {
  const sorted = [...args.orderKeys].sort((left, right) => left - right);
  let duplicateOrderKeys = 0;
  let nonIncreasingKeys = 0;
  let minimumGap: number | null = null;
  for (let index = 1; index < sorted.length; index += 1) {
    const gap = sorted[index] - sorted[index - 1];
    if (gap === 0) duplicateOrderKeys += 1;
    if (gap <= 0) nonIncreasingKeys += 1;
    minimumGap = minimumGap == null ? gap : Math.min(minimumGap, gap);
  }
  const unsafeOrderKeys = sorted.filter(
    (key) => !Number.isSafeInteger(key) || key <= 0,
  ).length;
  return {
    rankingId: args.rankingId,
    lockVersion: args.lockVersion,
    entryCount: sorted.length,
    minimumOrderKey: sorted[0] ?? null,
    maximumOrderKey: sorted.at(-1) ?? null,
    minimumGap,
    duplicateOrderKeys,
    nonIncreasingKeys,
    unsafeOrderKeys,
    normalizationRecommended:
      duplicateOrderKeys > 0 ||
      nonIncreasingKeys > 0 ||
      unsafeOrderKeys > 0 ||
      (minimumGap != null && minimumGap <= 1),
    underfilledTop250: sorted.length > 0 && sorted.length < 250,
  };
}

export function summarizeDraftRankerHealth(args: {
  orderings: DraftRankingOrderHealth[];
  identityReviewCandidateCount: number;
  pendingIdentityReviewCount: number;
  expiredActivePlacementCount: number;
  incompleteSeedRunCount: number;
  missingCommunitySnapshot: boolean;
  missingDiscoveryRefresh: boolean;
}) {
  const orderingBlocked = args.orderings.some(
    (ordering) =>
      ordering.duplicateOrderKeys > 0 ||
      ordering.nonIncreasingKeys > 0 ||
      ordering.unsafeOrderKeys > 0,
  );
  const attention =
    args.orderings.some(
      (ordering) =>
        ordering.normalizationRecommended || ordering.underfilledTop250,
    ) ||
    args.identityReviewCandidateCount > 0 ||
    args.pendingIdentityReviewCount > 0 ||
    args.expiredActivePlacementCount > 0 ||
    args.incompleteSeedRunCount > 0 ||
    args.missingCommunitySnapshot ||
    args.missingDiscoveryRefresh;
  return {
    status: orderingBlocked
      ? ("blocked" as const)
      : attention
        ? ("attention" as const)
        : ("healthy" as const),
    orderingBlocked,
    attention,
  };
}
