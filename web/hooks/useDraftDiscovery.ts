import { useQuery } from "@tanstack/react-query";

import { draftRankerRequest } from "lib/draft-ranker/client";

export type DraftDiscoveryCard = {
  playerId: number;
  type:
    | "cutoff_challenger"
    | "opportunity_change"
    | "previously_undrafted"
    | "projection_gap"
    | "ownership_riser";
  score: number;
  reasonCode: string;
  reason: string;
  sources: string[];
  sourceDate: string | null;
  sourceObservedAt: string;
  expiresAt: string;
  evidence: Record<string, unknown>;
  personalRank: number | null;
  onBoard: boolean;
  watched: boolean;
  player: {
    canonicalName: string;
    position: string | null;
    organizationName: string | null;
    headshotUrl: string | null;
    lifecycleStatus: string;
  };
};

export type DraftDiscoveryResponse = {
  rankingId: string;
  status: "available" | "empty" | "unavailable";
  message: string | null;
  refresh: null | {
    runId: string;
    targetSeasonId: number;
    algorithmVersion: string;
    completedAt: string;
    sourceSummary: Record<string, unknown>;
    groupCounts: Record<string, number>;
    warningCodes: string[];
  };
  sourceHealth: Array<{
    source_key: string;
    health_state: string;
    source_date: string | null;
    source_observed_at: string | null;
    expires_at: string | null;
    warning_codes: string[];
  }>;
  cards: DraftDiscoveryCard[];
};

export function useDraftDiscovery(rankingId: string, enabled = true) {
  return useQuery({
    queryKey: ["draft-ranker", "discovery", rankingId] as const,
    queryFn: () =>
      draftRankerRequest<DraftDiscoveryResponse>(
        `/api/v1/draft-ranker/discovery?rankingId=${encodeURIComponent(rankingId)}&limit=12`,
      ),
    enabled: enabled && Boolean(rankingId),
    staleTime: 5 * 60_000,
    retry: false,
  });
}
