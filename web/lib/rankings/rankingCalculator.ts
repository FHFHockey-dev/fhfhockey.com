import {
  getContextualRankingMetricDefinition,
  type ContextualRankingMetricKey,
} from "./metricDefinitions";

export type ContextualRankingPositionGroup = "forward" | "defense";

export type ContextualRankingPeerGroupType =
  | "all_skaters"
  | "position"
  | "deployment"
  | "team";

export type RankingSampleConfidence = "low" | "medium" | "high";

export type RankingPeerGroupWarning =
  | "small_peer_group"
  | "empty_peer_group"
  | "metric_unavailable"
  | "sample_below_minimum";

export type ContextualRankingCandidate = {
  entityId: number;
  teamId: number | null;
  metricKey: ContextualRankingMetricKey;
  rawValue: number | null;
  numerator?: number | null;
  denominator?: number | null;
  gamesPlayed?: number | null;
  toiSeconds?: number | null;
  positionGroup?: ContextualRankingPositionGroup | null;
  deploymentBucket?: string | null;
};

export type ContextualRankingRow = ContextualRankingCandidate & {
  peerGroupType: ContextualRankingPeerGroupType;
  peerGroupKey: string;
  calculatedRawValue: number | null;
  normalizedValue: number | null;
  rawRank: number | null;
  percentile: number | null;
  qualifiedPeerCount: number;
  minimumSampleMet: boolean;
  sampleConfidence: RankingSampleConfidence;
  warnings: RankingPeerGroupWarning[];
};

export type BuildContextualRankingRowsInput = {
  candidates: ContextualRankingCandidate[];
  metricKey: ContextualRankingMetricKey;
  peerGroupType: ContextualRankingPeerGroupType;
  minGp?: number;
  minToiSeconds?: number;
  minimumPeerCount?: number;
};

function finiteNumber(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return value;
}

function round(value: number, decimals = 6): number {
  return Number(value.toFixed(decimals));
}

export function calculateMetricRawValue(args: {
  metricKey: ContextualRankingMetricKey;
  rawValue?: number | null;
  numerator?: number | null;
  denominator?: number | null;
}): number | null {
  const rawValue = finiteNumber(args.rawValue);
  if (rawValue != null) return rawValue;

  const definition = getContextualRankingMetricDefinition(args.metricKey);
  const numerator = finiteNumber(args.numerator);
  const denominator = finiteNumber(args.denominator);
  if (!definition || numerator == null || denominator == null || denominator <= 0) {
    return null;
  }

  if (definition.isRateStat) {
    return round((numerator / denominator) * 3600);
  }

  return round(numerator / denominator);
}

export function normalizeMetricValue(args: {
  metricKey: ContextualRankingMetricKey;
  rawValue: number | null;
}): number | null {
  const rawValue = finiteNumber(args.rawValue);
  if (rawValue == null) return null;

  const definition = getContextualRankingMetricDefinition(args.metricKey);
  return definition?.higherIsBetter === false ? -rawValue : rawValue;
}

export function getRankingPeerGroupKey(args: {
  candidate: ContextualRankingCandidate;
  peerGroupType: ContextualRankingPeerGroupType;
}): string | null {
  if (args.peerGroupType === "all_skaters") return "all";
  if (args.peerGroupType === "position") {
    return args.candidate.positionGroup ?? null;
  }
  if (args.peerGroupType === "deployment") {
    return args.candidate.deploymentBucket ?? null;
  }
  if (args.peerGroupType === "team") {
    return args.candidate.teamId == null ? null : String(args.candidate.teamId);
  }
  return null;
}

function sampleMeetsMinimums(args: {
  candidate: ContextualRankingCandidate;
  minGp: number;
  minToiSeconds: number;
}): boolean {
  const gp = finiteNumber(args.candidate.gamesPlayed);
  const toi = finiteNumber(args.candidate.toiSeconds);
  return (
    (gp == null || gp >= args.minGp) &&
    (toi == null || toi >= args.minToiSeconds)
  );
}

export function getSampleConfidence(args: {
  gamesPlayed?: number | null;
  toiSeconds?: number | null;
  minGp: number;
  minToiSeconds: number;
  minimumSampleMet: boolean;
}): RankingSampleConfidence {
  if (!args.minimumSampleMet) return "low";

  const gp = finiteNumber(args.gamesPlayed);
  const toi = finiteNumber(args.toiSeconds);
  const gpMultiple =
    args.minGp > 0 && gp != null ? gp / args.minGp : gp == null ? 1 : 0;
  const toiMultiple =
    args.minToiSeconds > 0 && toi != null
      ? toi / args.minToiSeconds
      : toi == null
        ? 1
        : 0;
  const sampleMultiple = Math.min(gpMultiple, toiMultiple);

  if (sampleMultiple >= 2) return "high";
  if (sampleMultiple >= 1) return "medium";
  return "low";
}

function rankQualifiedRows(
  rows: Array<ContextualRankingRow & { normalizedValue: number }>,
  minimumPeerCount: number,
): ContextualRankingRow[] {
  const sorted = [...rows].sort((a, b) => {
    if (b.normalizedValue !== a.normalizedValue) {
      return b.normalizedValue - a.normalizedValue;
    }
    return a.entityId - b.entityId;
  });
  const qualifiedPeerCount = sorted.length;
  const lowerPeerCountByValue = new Map<number, number>();
  for (let index = 0; index < sorted.length;) {
    const value = sorted[index].normalizedValue;
    let nextIndex = index + 1;
    while (
      nextIndex < sorted.length &&
      sorted[nextIndex].normalizedValue === value
    ) {
      nextIndex += 1;
    }
    lowerPeerCountByValue.set(value, qualifiedPeerCount - nextIndex);
    index = nextIndex;
  }
  let priorValue: number | null = null;
  let rank = 0;

  return sorted.map((row) => {
    if (priorValue == null || row.normalizedValue !== priorValue) {
      rank += 1;
      priorValue = row.normalizedValue;
    }

    return {
      ...row,
      rawRank: rank,
      percentile: round(
        ((lowerPeerCountByValue.get(row.normalizedValue) ?? 0) /
          qualifiedPeerCount) *
          100,
        3,
      ),
      qualifiedPeerCount,
      warnings:
        qualifiedPeerCount < minimumPeerCount
          ? [...row.warnings, "small_peer_group"]
          : row.warnings,
    };
  });
}

export function buildContextualRankingRows(
  input: BuildContextualRankingRowsInput,
): ContextualRankingRow[] {
  const definition = getContextualRankingMetricDefinition(input.metricKey);
  const minGp = input.minGp ?? definition?.minimumGp ?? 0;
  const minToiSeconds =
    input.minToiSeconds ?? definition?.minimumToiSeconds ?? 0;
  const minimumPeerCount = input.minimumPeerCount ?? 3;

  const baseRows = input.candidates
    .filter((candidate) => candidate.metricKey === input.metricKey)
    .map((candidate): ContextualRankingRow | null => {
      const peerGroupKey = getRankingPeerGroupKey({
        candidate,
        peerGroupType: input.peerGroupType,
      });
      if (!peerGroupKey) return null;

      const calculatedRawValue = calculateMetricRawValue(candidate);
      const normalizedValue = normalizeMetricValue({
        metricKey: input.metricKey,
        rawValue: calculatedRawValue,
      });
      const minimumSampleMet = sampleMeetsMinimums({
        candidate,
        minGp,
        minToiSeconds,
      });
      const warnings: RankingPeerGroupWarning[] = [];
      if (!definition || definition.availabilityStatus !== "available") {
        warnings.push("metric_unavailable");
      }
      if (!minimumSampleMet) warnings.push("sample_below_minimum");

      return {
        ...candidate,
        peerGroupType: input.peerGroupType,
        peerGroupKey,
        calculatedRawValue,
        normalizedValue,
        rawRank: null,
        percentile: null,
        qualifiedPeerCount: 0,
        minimumSampleMet,
        sampleConfidence: getSampleConfidence({
          gamesPlayed: candidate.gamesPlayed,
          toiSeconds: candidate.toiSeconds,
          minGp,
          minToiSeconds,
          minimumSampleMet,
        }),
        warnings,
      };
    })
    .filter((row): row is ContextualRankingRow => row != null);

  const rowsByGroup = new Map<string, ContextualRankingRow[]>();
  for (const row of baseRows) {
    const groupRows = rowsByGroup.get(row.peerGroupKey) ?? [];
    groupRows.push(row);
    rowsByGroup.set(row.peerGroupKey, groupRows);
  }

  const rankedRows: ContextualRankingRow[] = [];
  for (const groupRows of rowsByGroup.values()) {
    const qualifiedRows = groupRows.filter(
      (
        row,
      ): row is ContextualRankingRow & { normalizedValue: number } =>
        row.minimumSampleMet &&
        row.normalizedValue != null &&
        definition?.availabilityStatus === "available",
    );

    const rankedByEntityId = new Map(
      rankQualifiedRows(qualifiedRows, minimumPeerCount).map((row) => [
        row.entityId,
        row,
      ]),
    );
    const qualifiedPeerCount = qualifiedRows.length;

    for (const row of groupRows) {
      const rankedRow = rankedByEntityId.get(row.entityId);
      if (rankedRow) {
        rankedRows.push(rankedRow);
        continue;
      }

      rankedRows.push({
        ...row,
        qualifiedPeerCount,
        warnings:
          qualifiedPeerCount === 0
            ? [...row.warnings, "empty_peer_group"]
            : qualifiedPeerCount < minimumPeerCount
              ? [...row.warnings, "small_peer_group"]
              : row.warnings,
      });
    }
  }

  return rankedRows.sort((a, b) => {
    if (a.rawRank != null && b.rawRank != null) return a.rawRank - b.rawRank;
    if (a.rawRank != null) return -1;
    if (b.rawRank != null) return 1;
    return a.entityId - b.entityId;
  });
}
