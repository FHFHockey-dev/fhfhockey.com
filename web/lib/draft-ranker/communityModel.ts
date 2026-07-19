import { createHash } from "node:crypto";

export const DRAFT_RANKER_COMMUNITY_MODEL_VERSION =
  "regularized-bradley-terry-v1";

export const DRAFT_RANKER_COMMUNITY_THRESHOLDS = Object.freeze({
  marketPriorIndependentUsers: 20,
  emergingUsers: 5,
  emergingComparisons: 10,
  emergingOpponents: 5,
  establishedUsers: 20,
  establishedComparisons: 40,
  establishedOpponents: 10,
  cutoffOpponentsEachSide: 2,
  cutoffLowerRank: 200,
  cutoffUpperRank: 300,
  publicCutoff: 250,
});

export type CommunityEvidenceState =
  | "market_seeded"
  | "building"
  | "emerging"
  | "established";

export type CommunityPriorState = "market_ranked" | "previously_undrafted";

export type CommunityCandidate = {
  fhfhPlayerId: number;
  marketRank: number | null;
  priorState: CommunityPriorState;
};

export type CommunityPairPreference = {
  comparisonId: string;
  userKey: string;
  lowPlayerId: number;
  highPlayerId: number;
  preferredPlayerId: number;
  establishedAt: string;
  communityEligible?: boolean;
  consentActive?: boolean;
  rateEligible?: boolean;
  moderationExcluded?: boolean;
};

export type CommunityPlayerResult = {
  fhfhPlayerId: number;
  modelRank: number;
  score: number;
  marketRank: number | null;
  priorState: CommunityPriorState;
  marketPriorWeight: number;
  evidenceState: CommunityEvidenceState;
  confidenceLabel: "market prior" | "building" | "limited" | "established";
  independentUsers: number;
  comparisonCount: number;
  distinctOpponents: number;
  cutoffOpponentsInside: number;
  cutoffOpponentsOutside: number;
  stabilityBufferRanks: number;
  conservativeRank: number;
  publicDisplayEligible: boolean;
  publicTop250Eligible: boolean;
  admissionBasis: "market_prior" | "community_evidence" | null;
};

export type CommunityModelResult = {
  modelVersion: string;
  acceptedComparisonCount: number;
  excludedComparisonCount: number;
  deduplicatedComparisonCount: number;
  iterations: number;
  converged: boolean;
  players: CommunityPlayerResult[];
};

export function stableCommunityHash(value: unknown): string {
  const canonicalize = (candidate: unknown): unknown => {
    if (Array.isArray(candidate)) return candidate.map(canonicalize);
    if (candidate && typeof candidate === "object") {
      return Object.fromEntries(
        Object.entries(candidate as Record<string, unknown>)
          .sort(([left], [right]) => left.localeCompare(right))
          .map(([key, nested]) => [key, canonicalize(nested)]),
      );
    }
    return candidate;
  };
  return createHash("sha256")
    .update(JSON.stringify(canonicalize(value)))
    .digest("hex");
}

type AcceptedPreference = CommunityPairPreference & {
  lowPlayerId: number;
  highPlayerId: number;
};

function validInstant(value: string): number | null {
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : null;
}

function canonicalPair(lowPlayerId: number, highPlayerId: number) {
  return lowPlayerId < highPlayerId
    ? ([lowPlayerId, highPlayerId] as const)
    : ([highPlayerId, lowPlayerId] as const);
}

function sigmoid(value: number): number {
  if (value >= 0) {
    const exp = Math.exp(-Math.min(value, 40));
    return 1 / (1 + exp);
  }
  const exp = Math.exp(Math.max(value, -40));
  return exp / (1 + exp);
}

function priorScore(rank: number | null, fieldSize: number): number {
  if (rank == null) return 0;
  const boundedRank = Math.max(1, Math.min(rank, fieldSize));
  return Math.log((fieldSize + 1 - boundedRank) / boundedRank);
}

function stabilityBuffer(args: {
  independentUsers: number;
  comparisons: number;
  opponents: number;
}): number {
  if (!args.comparisons) return 75;
  return Math.ceil(
    30 / Math.sqrt(Math.max(1, args.independentUsers)) +
      40 / Math.sqrt(args.comparisons) +
      10 / Math.sqrt(Math.max(1, args.opponents)),
  );
}

export function deduplicateCommunityPreferences(
  preferences: CommunityPairPreference[],
): {
  accepted: AcceptedPreference[];
  excludedCount: number;
  deduplicatedCount: number;
} {
  let excludedCount = 0;
  let eligibleCount = 0;
  const latest = new Map<string, AcceptedPreference>();
  for (const preference of preferences) {
    const [lowPlayerId, highPlayerId] = canonicalPair(
      preference.lowPlayerId,
      preference.highPlayerId,
    );
    const valid =
      Number.isInteger(lowPlayerId) &&
      lowPlayerId > 0 &&
      Number.isInteger(highPlayerId) &&
      highPlayerId > lowPlayerId &&
      [lowPlayerId, highPlayerId].includes(preference.preferredPlayerId) &&
      Boolean(preference.userKey) &&
      Boolean(preference.comparisonId) &&
      validInstant(preference.establishedAt) != null &&
      preference.communityEligible !== false &&
      preference.consentActive !== false &&
      preference.rateEligible !== false &&
      !preference.moderationExcluded;
    if (!valid) {
      excludedCount += 1;
      continue;
    }
    eligibleCount += 1;
    const normalized = { ...preference, lowPlayerId, highPlayerId };
    const key = `${preference.userKey}:${lowPlayerId}:${highPlayerId}`;
    const existing = latest.get(key);
    if (
      !existing ||
      preference.establishedAt > existing.establishedAt ||
      (preference.establishedAt === existing.establishedAt &&
        preference.comparisonId > existing.comparisonId)
    ) {
      latest.set(key, normalized);
    }
  }
  return {
    accepted: [...latest.values()].sort(
      (left, right) =>
        left.userKey.localeCompare(right.userKey) ||
        left.lowPlayerId - right.lowPlayerId ||
        left.highPlayerId - right.highPlayerId,
    ),
    excludedCount,
    deduplicatedCount: eligibleCount - latest.size,
  };
}

export function computeCommunityRanking(args: {
  candidates: CommunityCandidate[];
  preferences: CommunityPairPreference[];
  maximumIterations?: number;
  convergenceTolerance?: number;
}): CommunityModelResult {
  const uniqueCandidates = new Map<number, CommunityCandidate>();
  for (const candidate of args.candidates) {
    if (
      !Number.isInteger(candidate.fhfhPlayerId) ||
      candidate.fhfhPlayerId <= 0
    ) {
      continue;
    }
    const marketRank =
      candidate.marketRank != null &&
      Number.isFinite(candidate.marketRank) &&
      candidate.marketRank > 0
        ? candidate.marketRank
        : null;
    uniqueCandidates.set(candidate.fhfhPlayerId, {
      ...candidate,
      marketRank,
      priorState:
        marketRank == null ? "previously_undrafted" : candidate.priorState,
    });
  }
  const {
    accepted: rawAccepted,
    excludedCount,
    deduplicatedCount,
  } = deduplicateCommunityPreferences(args.preferences);
  let unknownPlayerEvidence = 0;
  const accepted = rawAccepted.filter((preference) => {
    const known =
      uniqueCandidates.has(preference.lowPlayerId) &&
      uniqueCandidates.has(preference.highPlayerId);
    if (!known) unknownPlayerEvidence += 1;
    return known;
  });
  const candidates = [...uniqueCandidates.values()].sort(
    (left, right) => left.fhfhPlayerId - right.fhfhPlayerId,
  );
  const indexByPlayer = new Map(
    candidates.map((candidate, index) => [candidate.fhfhPlayerId, index]),
  );
  const userSets = candidates.map(() => new Set<string>());
  const opponentSets = candidates.map(() => new Set<number>());
  const comparisonCounts = candidates.map(() => 0);
  for (const preference of accepted) {
    const lowIndex = indexByPlayer.get(preference.lowPlayerId)!;
    const highIndex = indexByPlayer.get(preference.highPlayerId)!;
    userSets[lowIndex].add(preference.userKey);
    userSets[highIndex].add(preference.userKey);
    opponentSets[lowIndex].add(preference.highPlayerId);
    opponentSets[highIndex].add(preference.lowPlayerId);
    comparisonCounts[lowIndex] += 1;
    comparisonCounts[highIndex] += 1;
  }

  const fieldSize = Math.max(
    candidates.length,
    ...candidates.map((candidate) => Math.ceil(candidate.marketRank ?? 0)),
    1,
  );
  const marketMeans = candidates.map((candidate) =>
    priorScore(candidate.marketRank, fieldSize),
  );
  const marketWeights = candidates.map((candidate, index) =>
    candidate.marketRank == null
      ? 0
      : 4 *
        Math.max(
          0,
          1 -
            userSets[index].size /
              DRAFT_RANKER_COMMUNITY_THRESHOLDS.marketPriorIndependentUsers,
        ),
  );
  const scores = marketMeans.map((mean, index) =>
    candidates[index].marketRank == null ? 0 : mean,
  );
  const regularization = 0.25;
  const maximumIterations = args.maximumIterations ?? 500;
  const convergenceTolerance = args.convergenceTolerance ?? 1e-8;
  let iterations = 0;
  let converged = candidates.length === 0;

  for (
    let iteration = 0;
    iteration < maximumIterations && candidates.length;
    iteration += 1
  ) {
    const gradients = scores.map(
      (score, index) =>
        -regularization * score -
        marketWeights[index] * (score - marketMeans[index]),
    );
    const curvatures = scores.map(
      (_, index) => regularization + marketWeights[index],
    );
    for (const preference of accepted) {
      const winnerId = preference.preferredPlayerId;
      const loserId =
        winnerId === preference.lowPlayerId
          ? preference.highPlayerId
          : preference.lowPlayerId;
      const winnerIndex = indexByPlayer.get(winnerId)!;
      const loserIndex = indexByPlayer.get(loserId)!;
      const probability = sigmoid(scores[winnerIndex] - scores[loserIndex]);
      const residual = 1 - probability;
      const curvature = Math.max(probability * (1 - probability), 1e-6);
      gradients[winnerIndex] += residual;
      gradients[loserIndex] -= residual;
      curvatures[winnerIndex] += curvature;
      curvatures[loserIndex] += curvature;
    }
    let maximumDelta = 0;
    for (let index = 0; index < scores.length; index += 1) {
      const delta = Math.max(
        -1,
        Math.min(1, (0.5 * gradients[index]) / curvatures[index]),
      );
      scores[index] += delta;
      maximumDelta = Math.max(maximumDelta, Math.abs(delta));
    }
    iterations = iteration + 1;
    if (maximumDelta < convergenceTolerance) {
      converged = true;
      break;
    }
  }

  const ordered = candidates
    .map((candidate, index) => ({ candidate, index, score: scores[index] }))
    .sort(
      (left, right) =>
        right.score - left.score ||
        (left.candidate.marketRank ?? Number.MAX_SAFE_INTEGER) -
          (right.candidate.marketRank ?? Number.MAX_SAFE_INTEGER) ||
        left.candidate.fhfhPlayerId - right.candidate.fhfhPlayerId,
    );
  const modelRankByPlayer = new Map(
    ordered.map((row, index) => [row.candidate.fhfhPlayerId, index + 1]),
  );

  const players = ordered.map(({ candidate, index, score }) => {
    const independentUsers = userSets[index].size;
    const comparisonCount = comparisonCounts[index];
    const opponents = [...opponentSets[index]];
    const distinctOpponents = opponents.length;
    const cutoffOpponentsInside = opponents.filter((opponentId) => {
      const rank = modelRankByPlayer.get(opponentId)!;
      return (
        rank >= DRAFT_RANKER_COMMUNITY_THRESHOLDS.cutoffLowerRank &&
        rank <= DRAFT_RANKER_COMMUNITY_THRESHOLDS.publicCutoff
      );
    }).length;
    const cutoffOpponentsOutside = opponents.filter((opponentId) => {
      const rank = modelRankByPlayer.get(opponentId)!;
      return (
        rank > DRAFT_RANKER_COMMUNITY_THRESHOLDS.publicCutoff &&
        rank <= DRAFT_RANKER_COMMUNITY_THRESHOLDS.cutoffUpperRank
      );
    }).length;
    const emerging =
      independentUsers >= DRAFT_RANKER_COMMUNITY_THRESHOLDS.emergingUsers &&
      comparisonCount >=
        DRAFT_RANKER_COMMUNITY_THRESHOLDS.emergingComparisons &&
      distinctOpponents >= DRAFT_RANKER_COMMUNITY_THRESHOLDS.emergingOpponents;
    const established =
      independentUsers >= DRAFT_RANKER_COMMUNITY_THRESHOLDS.establishedUsers &&
      comparisonCount >=
        DRAFT_RANKER_COMMUNITY_THRESHOLDS.establishedComparisons &&
      distinctOpponents >=
        DRAFT_RANKER_COMMUNITY_THRESHOLDS.establishedOpponents &&
      cutoffOpponentsInside >=
        DRAFT_RANKER_COMMUNITY_THRESHOLDS.cutoffOpponentsEachSide &&
      cutoffOpponentsOutside >=
        DRAFT_RANKER_COMMUNITY_THRESHOLDS.cutoffOpponentsEachSide;
    const evidenceState: CommunityEvidenceState = established
      ? "established"
      : emerging
        ? "emerging"
        : comparisonCount > 0
          ? "building"
          : candidate.marketRank != null
            ? "market_seeded"
            : "building";
    const stabilityBufferRanks = stabilityBuffer({
      independentUsers,
      comparisons: comparisonCount,
      opponents: distinctOpponents,
    });
    const modelRank = modelRankByPlayer.get(candidate.fhfhPlayerId)!;
    const conservativeRank = modelRank + stabilityBufferRanks;
    const marketSeededTop250 =
      candidate.marketRank != null &&
      candidate.marketRank <= DRAFT_RANKER_COMMUNITY_THRESHOLDS.publicCutoff &&
      !established;
    const communityAdmitted =
      established &&
      conservativeRank <= DRAFT_RANKER_COMMUNITY_THRESHOLDS.publicCutoff;
    return {
      fhfhPlayerId: candidate.fhfhPlayerId,
      modelRank,
      score,
      marketRank: candidate.marketRank,
      priorState: candidate.priorState,
      marketPriorWeight: marketWeights[index],
      evidenceState,
      confidenceLabel:
        evidenceState === "market_seeded"
          ? "market prior"
          : evidenceState === "building"
            ? "building"
            : evidenceState === "emerging"
              ? "limited"
              : "established",
      independentUsers,
      comparisonCount,
      distinctOpponents,
      cutoffOpponentsInside,
      cutoffOpponentsOutside,
      stabilityBufferRanks,
      conservativeRank,
      publicDisplayEligible:
        candidate.marketRank != null ||
        independentUsers >= DRAFT_RANKER_COMMUNITY_THRESHOLDS.emergingUsers,
      publicTop250Eligible: marketSeededTop250 || communityAdmitted,
      admissionBasis: marketSeededTop250
        ? "market_prior"
        : communityAdmitted
          ? "community_evidence"
          : null,
    } satisfies CommunityPlayerResult;
  });

  return {
    modelVersion: DRAFT_RANKER_COMMUNITY_MODEL_VERSION,
    acceptedComparisonCount: accepted.length,
    excludedComparisonCount: excludedCount + unknownPlayerEvidence,
    deduplicatedComparisonCount: deduplicatedCount,
    iterations,
    converged,
    players,
  };
}
