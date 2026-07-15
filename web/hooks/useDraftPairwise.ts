import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { draftRankerRequest } from "lib/draft-ranker/client";
import type { DraftPairQueueMode } from "lib/draft-ranker/queue";

export type DraftPairwisePlayer = {
  playerId: number;
  rank: number;
  name: string;
  position: string | null;
  organization: string | null;
  headshotUrl: string | null;
  lifecycleStatus: string;
  evidence: { yahooAdp: number | null; previouslyUndrafted: boolean };
};

export type DraftPairwiseQueue = {
  algorithmVersion: string;
  mode: DraftPairQueueMode;
  plannedSlots: number;
  availableSlots: number | null;
  reviewedThroughRank: number | null;
  prompt: null | {
    promptId: string;
    rankingId: string;
    rankingVersion: number;
    status: string;
    expiresAt: string;
    mode: DraftPairQueueMode;
    reason: string;
    reasonCode: string;
    category: string | null;
    focusPosition: string | null;
    algorithmVersion: string;
    idempotentReplay: boolean;
    players: [DraftPairwisePlayer, DraftPairwisePlayer];
  };
};

export function useDraftPairwise(args: {
  userId: string | null;
  rankingId: string | null;
  expectedVersion: number | null;
  mode: DraftPairQueueMode;
  enabled: boolean;
}) {
  const queryClient = useQueryClient();
  const operation = useRef({ key: "", id: crypto.randomUUID() });
  const [round, setRound] = useState(0);
  const [answers, setAnswers] = useState(0);
  const operationKey = `${args.rankingId}:${args.expectedVersion}:${args.mode}:${round}`;
  if (operation.current.key !== operationKey) {
    operation.current = { key: operationKey, id: crypto.randomUUID() };
  }
  const queueKey = [
    "draft-ranker",
    "pairwise",
    "queue",
    args.userId,
    args.rankingId,
    args.expectedVersion,
    args.mode,
    round,
  ] as const;
  const queue = useQuery({
    queryKey: queueKey,
    queryFn: () =>
      draftRankerRequest<DraftPairwiseQueue>(
        "/api/v1/draft-ranker/pairwise/queue",
        {
          method: "POST",
          body: JSON.stringify({
            rankingId: args.rankingId,
            expectedVersion: args.expectedVersion,
            mode: args.mode,
            operationId: operation.current.id,
          }),
        },
      ),
    enabled:
      args.enabled &&
      !(args.mode === "quick_five" && answers >= 5) &&
      Boolean(args.userId && args.rankingId) &&
      args.expectedVersion !== null,
    retry: false,
    placeholderData: (previous) => previous,
  });
  const respond = useMutation({
    mutationFn: (outcome: "low" | "high" | "too_close" | "skip") => {
      const prompt = queue.data?.prompt;
      if (!prompt) throw new Error("No active comparison is available.");
      return draftRankerRequest<{
        resultingVersion: number;
        reordered: boolean;
      }>("/api/v1/draft-ranker/pairwise/respond", {
        method: "POST",
        body: JSON.stringify({
          promptId: prompt.promptId,
          outcome,
          expectedVersion: prompt.rankingVersion,
          operationId: crypto.randomUUID(),
        }),
      });
    },
    onSuccess: async () => {
      setAnswers((value) => value + 1);
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ["draft-ranker", "bootstrap", args.userId],
        }),
        queryClient.invalidateQueries({
          queryKey: ["draft-ranker", "entries", args.userId, args.rankingId],
        }),
      ]);
      setRound((value) => value + 1);
    },
  });

  return { queue, respond, answers };
}
