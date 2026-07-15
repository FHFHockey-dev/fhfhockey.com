import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { draftRankerRequest } from "lib/draft-ranker/client";

export type DraftContributionPreference = {
  contributionEnabled: boolean;
  privacyPolicyVersion: string | null;
  consentedAt: string | null;
  revokedAt: string | null;
  updateSource: string | null;
  updatedAt: string | null;
  currentPolicyVersion: string;
};

export function useDraftContributionPreference(
  userId: string,
  enabled = true,
) {
  const queryClient = useQueryClient();
  const queryKey = ["draft-ranker", "pairwise", "consent", userId] as const;
  const state = useQuery({
    queryKey,
    queryFn: () =>
      draftRankerRequest<DraftContributionPreference>(
        "/api/v1/draft-ranker/pairwise/consent",
      ),
    enabled: enabled && Boolean(userId),
    staleTime: 30_000,
  });
  const mutation = useMutation({
    mutationFn: (contributionEnabled: boolean) =>
      draftRankerRequest<DraftContributionPreference>(
        "/api/v1/draft-ranker/pairwise/consent",
        {
          method: "POST",
          body: JSON.stringify({
            contributionEnabled,
            operationId: crypto.randomUUID(),
          }),
        },
      ),
    onSuccess: (data) => queryClient.setQueryData(queryKey, data),
  });
  return { state, mutation };
}
