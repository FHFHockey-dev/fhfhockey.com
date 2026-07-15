import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  DraftRankerClientError,
  draftRankerRequest,
} from "lib/draft-ranker/client";
import type { ReorderDraftRankingInput } from "lib/draft-ranker/contracts";

export type DraftRankingBootstrap = {
  initialized: boolean;
  pairwiseEnabled: boolean;
  targetSeasonId: number;
  ranking: null | {
    id: string;
    lock_version: number;
    name: string;
    status: string;
  };
  counts: { entries: number; watchlist: number };
};

export type DraftRankingEntry = {
  playerId: number;
  rank: number;
  orderKey: number;
  seedSource: string | null;
  seedAdp: number | null;
  seedRank: number | null;
  tier: string | null;
  notes: string | null;
  updatedAt: string;
  player: {
    canonical_name: string;
    canonical_position: string | null;
    current_organization_name: string | null;
    headshot_url: string | null;
    lifecycle_status: string;
  } | null;
};

export type DraftRankingEntries = {
  ranking: {
    id: string;
    lockVersion: number;
    targetSeasonId: number;
    status: string;
  };
  entries: DraftRankingEntry[];
};

export function useDraftRanking(userId: string | null) {
  const queryClient = useQueryClient();
  const enabled = Boolean(userId);
  const bootstrapKey = ["draft-ranker", "bootstrap", userId] as const;
  const bootstrap = useQuery({
    queryKey: bootstrapKey,
    queryFn: () =>
      draftRankerRequest<DraftRankingBootstrap>("/api/v1/draft-ranker"),
    enabled,
    retry: false,
  });
  const rankingId = bootstrap.data?.ranking?.id ?? null;
  const entriesKey = ["draft-ranker", "entries", userId, rankingId] as const;
  const entries = useQuery({
    queryKey: entriesKey,
    queryFn: () =>
      draftRankerRequest<DraftRankingEntries>(
        `/api/v1/draft-ranker/entries?rankingId=${encodeURIComponent(rankingId!)}`,
      ),
    enabled: enabled && Boolean(rankingId),
    retry: false,
  });

  const initialize = useMutation({
    mutationFn: () =>
      draftRankerRequest("/api/v1/draft-ranker/initialize", {
        method: "POST",
        body: JSON.stringify({ operationId: crypto.randomUUID() }),
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: bootstrapKey });
    },
  });

  const reorder = useMutation({
    mutationFn: (
      input: Omit<
        ReorderDraftRankingInput,
        "operationId" | "expectedVersion" | "rankingId"
      >,
    ) => {
      if (!rankingId || !entries.data) {
        throw new Error("The ranking is not ready to edit.");
      }
      return draftRankerRequest("/api/v1/draft-ranker/reorder", {
        method: "POST",
        body: JSON.stringify({
          ...input,
          rankingId,
          expectedVersion: entries.data.ranking.lockVersion,
          operationId: crypto.randomUUID(),
        }),
      });
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: bootstrapKey }),
        queryClient.invalidateQueries({ queryKey: entriesKey }),
      ]);
    },
    onError: async (error) => {
      if (
        error instanceof DraftRankerClientError &&
        error.body.code === "stale_ranking_version"
      ) {
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: bootstrapKey }),
          queryClient.invalidateQueries({ queryKey: entriesKey }),
        ]);
      }
    },
  });

  return { bootstrap, entries, initialize, reorder };
}
