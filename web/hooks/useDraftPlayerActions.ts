import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { draftRankerRequest } from "lib/draft-ranker/client";
import type { DraftPlayerActionInput } from "lib/draft-ranker/contracts";

type WatchlistItem = {
  playerId: number;
  priority: number | null;
  note: string | null;
  source: string;
  reason: string | null;
  createdAt: string;
  updatedAt: string;
  player: {
    canonical_name: string;
    canonical_position: string | null;
    current_organization_name: string | null;
    headshot_url: string | null;
    lifecycle_status: string;
  } | null;
};

type PlayerPreference = {
  playerId: number;
  disposition: "dismissed" | "not_relevant" | null;
  comparisonRequestedAt: string | null;
  source: string;
  createdAt: string;
  updatedAt: string;
};

export type DraftPlayerActionsResponse = {
  rankingId: string;
  watchlist: WatchlistItem[];
  preferences: PlayerPreference[];
};

export function useDraftPlayerActions(rankingId: string, enabled = true) {
  const queryClient = useQueryClient();
  const queryKey = ["draft-ranker", "player-actions", rankingId] as const;
  const state = useQuery({
    queryKey,
    queryFn: () =>
      draftRankerRequest<DraftPlayerActionsResponse>(
        `/api/v1/draft-ranker/watchlist?rankingId=${encodeURIComponent(rankingId)}`,
      ),
    enabled: enabled && Boolean(rankingId),
    staleTime: 15_000,
  });
  const action = useMutation({
    mutationFn: (input: Omit<DraftPlayerActionInput, "rankingId">) =>
      draftRankerRequest<Record<string, unknown>>(
        "/api/v1/draft-ranker/watchlist",
        {
          method: "POST",
          body: JSON.stringify({ ...input, rankingId }),
        },
      ),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey }),
        queryClient.invalidateQueries({
          queryKey: ["draft-ranker", "discovery", rankingId],
        }),
      ]);
    },
  });

  return { state, action };
}
