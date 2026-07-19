import { useQuery } from "@tanstack/react-query";

import supabase from "lib/supabase/client";

export type CommunityRankingRow = {
  playerId: number;
  communityRank: number | null;
  estimatedRank: number;
  previousYahooAdp: number | null;
  previouslyUndrafted: boolean;
  evidenceState: "market_seeded" | "building" | "emerging" | "established";
  confidenceLabel: string;
  independentUsers: number;
  comparisonCount: number;
  distinctOpponents: number;
  cutoffCoverage: { inside: number; outside: number };
  stabilityBufferRanks: number;
  conservativeRank: number;
  admissionBasis: "market_prior" | "community_evidence" | null;
  previousCommunityRank: number | null;
  rankChange: number | null;
  lastEvidenceAt: string | null;
  personalRank: number | null;
  personalDelta: number | null;
  player: {
    canonicalName: string;
    position: string | null;
    organizationName: string | null;
    organizationType: string;
    lifecycleStatus: string;
    headshotUrl: string | null;
  };
};

export type CommunityDraftRankingsResponse = {
  status: "unavailable" | "market_seeded" | "available";
  message: string | null;
  snapshot: null | {
    id: string;
    targetSeasonId: number;
    snapshotAsOf: string;
    publishedAt: string;
    cadence: string;
    modelVersion: string;
    playerCount: number;
    publicDisplayCount: number;
    publicTop250Count: number;
    acceptedComparisonCount: number;
    coldStart: boolean;
  };
  rows: CommunityRankingRow[];
  emerging: CommunityRankingRow[];
  pagination: { page: number; limit: number; total: number };
  signedInPersonalContext: boolean;
};

async function requestCommunityRankings(page: number, limit: number) {
  const { data } = await supabase.auth.getSession();
  const response = await fetch(
    `/api/v1/draft-ranker/community?page=${page}&limit=${limit}`,
    {
      headers: {
        Accept: "application/json",
        ...(data.session
          ? { Authorization: `Bearer ${data.session.access_token}` }
          : {}),
      },
    },
  );
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(
      payload?.error?.message ?? "Community Rankings could not be loaded.",
    );
  }
  return payload.data as CommunityDraftRankingsResponse;
}

export function useCommunityDraftRankings(
  userId: string | null,
  page: number,
  limit = 50,
) {
  return useQuery({
    queryKey: ["draft-ranker", "community", userId, page, limit] as const,
    queryFn: () => requestCommunityRankings(page, limit),
    staleTime: 5 * 60_000,
    retry: false,
  });
}
