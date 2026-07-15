import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  DraftRankerClientError,
  draftRankerRequest,
} from "lib/draft-ranker/client";
import type { DraftPlacementMutationInput } from "lib/draft-ranker/contracts";
import type {
  PlacementAnchor,
  PlacementEngineState,
} from "lib/draft-ranker/placementEngine";

type PlacementPlayer = {
  canonical_name: string;
  canonical_position: string | null;
  current_organization_name: string | null;
  headshot_url: string | null;
  lifecycle_status: string;
};

type PlacementNeighbor = {
  playerId: number;
  rank: number;
  player: PlacementPlayer | null;
};

export type DraftPlacementSession = {
  id: string;
  rankingId: string;
  playerId: number;
  status: "active" | "confirmed" | "cancelled" | "expired";
  rankingVersion: number;
  expiresAt: string;
  engineVersion: string;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
  player: PlacementPlayer | null;
  state: PlacementEngineState;
  currentAnchor: PlacementAnchor | null;
  anchorPlayer: (PlacementPlayer & { id: number }) | null;
  neighbors: {
    above: PlacementNeighbor | null;
    below: PlacementNeighbor | null;
  } | null;
};

export type DraftPlacementResponse = {
  session: DraftPlacementSession | null;
};

export function useDraftPlacement(rankingId: string, enabled = true) {
  const queryClient = useQueryClient();
  const queryKey = ["draft-ranker", "placement", rankingId] as const;
  const state = useQuery({
    queryKey,
    queryFn: () =>
      draftRankerRequest<DraftPlacementResponse>(
        `/api/v1/draft-ranker/placement?rankingId=${encodeURIComponent(rankingId)}`,
      ),
    enabled: enabled && Boolean(rankingId),
    staleTime: 5_000,
  });
  const mutation = useMutation({
    mutationFn: (input: DraftPlacementMutationInput) =>
      draftRankerRequest<DraftPlacementResponse>(
        "/api/v1/draft-ranker/placement",
        { method: "POST", body: JSON.stringify(input) },
      ),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey }),
        queryClient.invalidateQueries({
          queryKey: ["draft-ranker", "entries", rankingId],
        }),
        queryClient.invalidateQueries({
          queryKey: ["draft-ranker", "player-actions", rankingId],
        }),
      ]);
    },
    onError: async (error) => {
      if (!(error instanceof DraftRankerClientError)) return;
      const stale = error.body.code === "stale_ranking_version";
      const activePlacement =
        error.body.details?.reason === "active_placement_exists";
      if (stale || activePlacement) {
        await Promise.all([
          queryClient.invalidateQueries({ queryKey }),
          ...(stale
            ? [
                queryClient.invalidateQueries({
                  queryKey: ["draft-ranker", "entries", rankingId],
                }),
              ]
            : []),
        ]);
      }
    },
  });

  return { state, mutation };
}
