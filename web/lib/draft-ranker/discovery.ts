import { createHash } from "node:crypto";

import { DRAFT_RANKER_TARGET_SEASON_ID } from "./contracts";

export const DRAFT_RANKER_DISCOVERY_ALGORITHM_VERSION =
  "draft-ranker-discovery-v1";
export const DRAFT_RANKER_DISCOVERY_THRESHOLDS = Object.freeze({
  minimumProjectionSources: 2,
  projectionGapRanks: 25,
  previouslyUndraftedMaximumRank: 300,
  cutoffMinimumRank: 251,
  cutoffMaximumRank: 275,
  ownershipGainPoints: 5,
  ownershipTopDecile: 0.9,
  opportunityEventMinimumConfidence: 0.75,
  opportunityDeploymentShareGain: 0.15,
});

export type DiscoverySignalType =
  | "projection_gap"
  | "previously_undrafted"
  | "ownership_riser"
  | "opportunity_change";

export type DiscoveryHealthState =
  | "available"
  | "stale"
  | "season_mismatch"
  | "insufficient_sources"
  | "unmapped"
  | "unavailable";

export type DiscoverySourceHealth = {
  source_key: string;
  health_state: DiscoveryHealthState;
  source_season_id: number | null;
  source_date: string | null;
  source_observed_at: string | null;
  expires_at: string | null;
  row_count: number;
  mapped_player_count: number;
  eligible_player_count: number;
  warning_codes: string[];
  metadata: Record<string, unknown>;
};

export type MaterializedDiscoverySignal = {
  fhfh_player_id: number;
  signal_type: DiscoverySignalType;
  score: number;
  reason_code: string;
  reason_text: string;
  source_keys: string[];
  source_date: string | null;
  source_observed_at: string;
  expires_at: string;
  evidence: Record<string, unknown>;
};

export type ProjectionRankObservation = {
  fhfhPlayerId: number;
  sourceKey: string;
  sourceDisplayName: string;
  sourceSeasonId: number;
  projectionRank: number;
  projectedFantasyPoints: number | null;
  projectedGames: number | null;
  sourceObservedAt: string;
  expiresAt: string;
};

export type ProjectionConsensus = {
  fhfh_player_id: number;
  consensus_rank: number;
  source_count: number;
  source_keys: string[];
  source_observed_at: string;
  expires_at: string;
  evidence: {
    sourceDisplayNames: string[];
    sourceRanks: Array<{ sourceKey: string; rank: number }>;
    medianMethod: "median_source_rank";
  };
};

export type PriorAdpEvidence = {
  fhfhPlayerId: number;
  priorAdp: number | null;
  adpState: "known" | "previously_undrafted" | "unknown";
  sourceKey: string;
};

export type OwnershipTimelinePoint = { date: string; value: number };

export type OwnershipCandidate = {
  fhfhPlayerId: number;
  timeline: OwnershipTimelinePoint[];
  sourceKey?: string;
};

export type OpportunityCandidate = {
  fhfhPlayerId: number;
  currentTeamId: number | null;
  priorTeamId: number | null;
  eventType: string | null;
  eventConfidence: number | null;
  eventObservedAt: string | null;
  eventExpiresAt: string | null;
  projectionRankGain: number | null;
  projectionObservedAt?: string | null;
  projectionExpiresAt?: string | null;
  deploymentShareGain: number | null;
  sourceKeys: string[];
};

function finiteNumber(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function validIsoInstant(value: string): number | null {
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : null;
}

function median(values: number[]): number {
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[middle - 1] + sorted[middle]) / 2
    : sorted[middle];
}

function percentile(values: number[], percentileValue: number): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((left, right) => left - right);
  const index = Math.ceil(percentileValue * sorted.length) - 1;
  return sorted[Math.max(0, Math.min(index, sorted.length - 1))];
}

export function stableDiscoveryHash(value: unknown): string {
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

export function buildProjectionConsensus(args: {
  observations: ProjectionRankObservation[];
  asOf: string;
  targetSeasonId?: number;
}): ProjectionConsensus[] {
  const targetSeasonId = args.targetSeasonId ?? DRAFT_RANKER_TARGET_SEASON_ID;
  const asOfTimestamp = validIsoInstant(args.asOf);
  if (asOfTimestamp == null)
    throw new Error("A valid discovery as-of time is required.");

  const byPlayer = new Map<number, ProjectionRankObservation[]>();
  for (const observation of args.observations) {
    const observedAt = validIsoInstant(observation.sourceObservedAt);
    const expiresAt = validIsoInstant(observation.expiresAt);
    const projectionRank = finiteNumber(observation.projectionRank);
    if (
      !Number.isInteger(observation.fhfhPlayerId) ||
      observation.fhfhPlayerId <= 0 ||
      observation.sourceSeasonId !== targetSeasonId ||
      projectionRank == null ||
      projectionRank <= 0 ||
      observedAt == null ||
      observedAt > asOfTimestamp ||
      expiresAt == null ||
      expiresAt <= asOfTimestamp
    ) {
      continue;
    }
    const group = byPlayer.get(observation.fhfhPlayerId) ?? [];
    group.push({ ...observation, projectionRank });
    byPlayer.set(observation.fhfhPlayerId, group);
  }

  const consensus: ProjectionConsensus[] = [];
  for (const [fhfhPlayerId, rawObservations] of byPlayer) {
    const bySource = new Map<string, ProjectionRankObservation>();
    const conflictingSources = new Set<string>();
    for (const observation of rawObservations) {
      if (conflictingSources.has(observation.sourceKey)) continue;
      const existing = bySource.get(observation.sourceKey);
      if (!existing) {
        bySource.set(observation.sourceKey, observation);
        continue;
      }
      // Conflicting duplicates make this source/player ineligible instead of
      // allowing row order to choose the evidence.
      if (existing.projectionRank !== observation.projectionRank) {
        bySource.delete(observation.sourceKey);
        conflictingSources.add(observation.sourceKey);
      }
    }
    const sourceRows = [...bySource.values()].sort((left, right) =>
      left.sourceKey.localeCompare(right.sourceKey),
    );
    if (
      sourceRows.length <
      DRAFT_RANKER_DISCOVERY_THRESHOLDS.minimumProjectionSources
    ) {
      continue;
    }
    const sourceObservedAt = sourceRows.reduce(
      (latest, row) =>
        row.sourceObservedAt > latest ? row.sourceObservedAt : latest,
      sourceRows[0].sourceObservedAt,
    );
    const expiresAt = sourceRows.reduce(
      (earliest, row) => (row.expiresAt < earliest ? row.expiresAt : earliest),
      sourceRows[0].expiresAt,
    );
    consensus.push({
      fhfh_player_id: fhfhPlayerId,
      consensus_rank: median(sourceRows.map((row) => row.projectionRank)),
      source_count: sourceRows.length,
      source_keys: sourceRows.map((row) => row.sourceKey),
      source_observed_at: sourceObservedAt,
      expires_at: expiresAt,
      evidence: {
        sourceDisplayNames: sourceRows.map((row) => row.sourceDisplayName),
        sourceRanks: sourceRows.map((row) => ({
          sourceKey: row.sourceKey,
          rank: row.projectionRank,
        })),
        medianMethod: "median_source_rank",
      },
    });
  }
  return consensus.sort(
    (left, right) =>
      left.consensus_rank - right.consensus_rank ||
      left.fhfh_player_id - right.fhfh_player_id,
  );
}

export function buildProjectionBackedSignals(args: {
  consensus: ProjectionConsensus[];
  priorAdp: PriorAdpEvidence[];
}): MaterializedDiscoverySignal[] {
  const adpByPlayer = new Map(
    args.priorAdp.map((evidence) => [evidence.fhfhPlayerId, evidence]),
  );
  const signals: MaterializedDiscoverySignal[] = [];
  for (const consensus of args.consensus) {
    const adp = adpByPlayer.get(consensus.fhfh_player_id);
    if (!adp || adp.adpState === "unknown") continue;
    if (
      adp.adpState === "known" &&
      adp.priorAdp != null &&
      adp.priorAdp - consensus.consensus_rank >=
        DRAFT_RANKER_DISCOVERY_THRESHOLDS.projectionGapRanks
    ) {
      const gap = adp.priorAdp - consensus.consensus_rank;
      signals.push({
        fhfh_player_id: consensus.fhfh_player_id,
        signal_type: "projection_gap",
        score: gap,
        reason_code: "consensus_projection_above_prior_adp",
        reason_text: `Consensus projection rank is ${Math.round(gap)} places ahead of prior Yahoo ADP.`,
        source_keys: [...consensus.source_keys, adp.sourceKey],
        source_date: null,
        source_observed_at: consensus.source_observed_at,
        expires_at: consensus.expires_at,
        evidence: {
          consensusRank: consensus.consensus_rank,
          priorAdp: adp.priorAdp,
          rankGap: gap,
          projectionSourceCount: consensus.source_count,
        },
      });
    }
    if (
      adp.adpState === "previously_undrafted" &&
      consensus.consensus_rank <=
        DRAFT_RANKER_DISCOVERY_THRESHOLDS.previouslyUndraftedMaximumRank
    ) {
      signals.push({
        fhfh_player_id: consensus.fhfh_player_id,
        signal_type: "previously_undrafted",
        score:
          DRAFT_RANKER_DISCOVERY_THRESHOLDS.previouslyUndraftedMaximumRank -
          consensus.consensus_rank +
          1,
        reason_code: "previously_undrafted_projected_top_300",
        reason_text: `Previously undrafted player now has a consensus projection rank of ${Math.round(consensus.consensus_rank)}.`,
        source_keys: [...consensus.source_keys, adp.sourceKey],
        source_date: null,
        source_observed_at: consensus.source_observed_at,
        expires_at: consensus.expires_at,
        evidence: {
          consensusRank: consensus.consensus_rank,
          priorAdpState: "previously_undrafted",
          projectionSourceCount: consensus.source_count,
        },
      });
    }
  }
  return signals;
}

function parseOwnershipTimeline(timeline: OwnershipTimelinePoint[]) {
  return timeline
    .map((point) => ({
      date: point.date,
      timestamp: Date.parse(`${point.date}T00:00:00.000Z`),
      value: finiteNumber(point.value),
    }))
    .filter(
      (point): point is { date: string; timestamp: number; value: number } =>
        Number.isFinite(point.timestamp) && point.value != null,
    )
    .sort((left, right) => left.timestamp - right.timestamp);
}

export function buildOwnershipRiserSignals(args: {
  candidates: OwnershipCandidate[];
  asOf: string;
  offseason: boolean;
}): MaterializedDiscoverySignal[] {
  const asOfTimestamp = validIsoInstant(args.asOf);
  if (asOfTimestamp == null)
    throw new Error("A valid discovery as-of time is required.");
  const eligible = args.candidates.flatMap((candidate) => {
    const points = parseOwnershipTimeline(candidate.timeline).filter(
      (point) => point.timestamp <= asOfTimestamp,
    );
    const latest = points.at(-1);
    if (!latest) return [];
    const targetTimestamp = latest.timestamp - 7 * 86_400_000;
    const baseline = [...points]
      .reverse()
      .find((point) => point.timestamp <= targetTimestamp);
    if (!baseline) return [];
    const gapDays = (latest.timestamp - baseline.timestamp) / 86_400_000;
    if (gapDays < 6 || gapDays > 10) return [];
    const delta = latest.value - baseline.value;
    const maximumAgeMs = (args.offseason ? 7 : 2) * 86_400_000;
    if (asOfTimestamp - latest.timestamp > maximumAgeMs) return [];
    return [{ candidate, latest, baseline, delta, maximumAgeMs }];
  });
  const positiveDeltas = eligible
    .map((row) => row.delta)
    .filter((delta) => delta > 0);
  const topDecileThreshold = percentile(
    positiveDeltas,
    DRAFT_RANKER_DISCOVERY_THRESHOLDS.ownershipTopDecile,
  );

  return eligible.flatMap((row) => {
    const qualifiesByAbsolute =
      row.delta >= DRAFT_RANKER_DISCOVERY_THRESHOLDS.ownershipGainPoints;
    const qualifiesByDecile =
      row.delta > 0 &&
      topDecileThreshold != null &&
      row.delta >= topDecileThreshold;
    if (!qualifiesByAbsolute && !qualifiesByDecile) return [];
    const expiresAt = new Date(
      row.latest.timestamp + row.maximumAgeMs,
    ).toISOString();
    return [
      {
        fhfh_player_id: row.candidate.fhfhPlayerId,
        signal_type: "ownership_riser" as const,
        score: row.delta,
        reason_code: qualifiesByAbsolute
          ? "ownership_gain_five_points"
          : "ownership_gain_top_decile",
        reason_text: `Yahoo ownership increased ${row.delta.toFixed(1)} percentage points over seven days.`,
        source_keys: [
          row.candidate.sourceKey ?? "yahoo_players.ownership_timeline",
        ],
        source_date: row.latest.date,
        source_observed_at: `${row.latest.date}T23:59:59.999Z`,
        expires_at: expiresAt,
        evidence: {
          latestOwnership: row.latest.value,
          baselineOwnership: row.baseline.value,
          deltaPoints: row.delta,
          latestDate: row.latest.date,
          baselineDate: row.baseline.date,
          eligiblePoolSize: eligible.length,
          topDecileThreshold,
        },
      },
    ];
  });
}

const OPPORTUNITY_EVENT_TYPES = new Set([
  "LINE_CHANGE",
  "PP_UNIT_CHANGE",
  "CALLUP",
  "RETURN",
  "GOALIE_START_CONFIRMED",
  "GOALIE_START_LIKELY",
]);

export function buildOpportunityChangeSignals(args: {
  candidates: OpportunityCandidate[];
  asOf: string;
}): MaterializedDiscoverySignal[] {
  const asOfTimestamp = validIsoInstant(args.asOf);
  if (asOfTimestamp == null)
    throw new Error("A valid discovery as-of time is required.");
  return args.candidates.flatMap((candidate) => {
    const eventObservedAt = candidate.eventObservedAt
      ? validIsoInstant(candidate.eventObservedAt)
      : null;
    const eventExpiresAt = candidate.eventExpiresAt
      ? validIsoInstant(candidate.eventExpiresAt)
      : null;
    const eventVerified =
      candidate.eventType != null &&
      OPPORTUNITY_EVENT_TYPES.has(candidate.eventType) &&
      (candidate.eventConfidence ?? 0) >=
        DRAFT_RANKER_DISCOVERY_THRESHOLDS.opportunityEventMinimumConfidence &&
      eventObservedAt != null &&
      eventObservedAt <= asOfTimestamp &&
      eventExpiresAt != null &&
      eventExpiresAt > asOfTimestamp;
    const projectionMaterial =
      (candidate.projectionRankGain ?? 0) >=
      DRAFT_RANKER_DISCOVERY_THRESHOLDS.projectionGapRanks;
    const projectionObservedAt = candidate.projectionObservedAt
      ? validIsoInstant(candidate.projectionObservedAt)
      : null;
    const projectionExpiresAt = candidate.projectionExpiresAt
      ? validIsoInstant(candidate.projectionExpiresAt)
      : null;
    const projectionVerified =
      projectionMaterial &&
      projectionObservedAt != null &&
      projectionObservedAt <= asOfTimestamp &&
      projectionExpiresAt != null &&
      projectionExpiresAt > asOfTimestamp;
    const deploymentMaterial =
      (candidate.deploymentShareGain ?? 0) >=
      DRAFT_RANKER_DISCOVERY_THRESHOLDS.opportunityDeploymentShareGain;
    const teamChanged =
      candidate.currentTeamId != null &&
      candidate.priorTeamId != null &&
      candidate.currentTeamId !== candidate.priorTeamId;
    const qualifies = teamChanged
      ? projectionVerified || eventVerified
      : eventVerified && (projectionVerified || deploymentMaterial);
    const evidenceObservedAt = eventVerified
      ? candidate.eventObservedAt
      : candidate.projectionObservedAt;
    const evidenceExpiresAt = eventVerified
      ? candidate.eventExpiresAt
      : candidate.projectionExpiresAt;
    if (!qualifies || !evidenceObservedAt || !evidenceExpiresAt) return [];

    return [
      {
        fhfh_player_id: candidate.fhfhPlayerId,
        signal_type: "opportunity_change" as const,
        score: Math.max(
          candidate.projectionRankGain ?? 0,
          (candidate.deploymentShareGain ?? 0) * 100,
        ),
        reason_code: teamChanged
          ? "verified_team_change_with_opportunity"
          : "verified_role_change_with_material_delta",
        reason_text: teamChanged
          ? "Verified team change is supported by current opportunity evidence."
          : "Verified role change is supported by a material projection or deployment increase.",
        source_keys: [...new Set(candidate.sourceKeys)].sort(),
        source_date: candidate.eventObservedAt?.slice(0, 10) ?? null,
        source_observed_at: evidenceObservedAt,
        expires_at: evidenceExpiresAt,
        evidence: {
          currentTeamId: candidate.currentTeamId,
          priorTeamId: candidate.priorTeamId,
          eventType: candidate.eventType,
          eventConfidence: candidate.eventConfidence,
          projectionRankGain: candidate.projectionRankGain,
          deploymentShareGain: candidate.deploymentShareGain,
        },
      },
    ];
  });
}

export function deriveOwnerRelativeDiscovery(args: {
  personalRank: number;
  consensusRank: number;
}): "cutoff_challenger" | "projection_gap" | null {
  const gap = args.personalRank - args.consensusRank;
  if (gap < DRAFT_RANKER_DISCOVERY_THRESHOLDS.projectionGapRanks) return null;
  if (
    args.personalRank >= DRAFT_RANKER_DISCOVERY_THRESHOLDS.cutoffMinimumRank &&
    args.personalRank <= DRAFT_RANKER_DISCOVERY_THRESHOLDS.cutoffMaximumRank
  ) {
    return "cutoff_challenger";
  }
  return "projection_gap";
}
