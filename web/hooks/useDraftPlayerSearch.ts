import { useMutation, useQuery } from "@tanstack/react-query";

import { useDebounce } from "hooks/useDebounce";
import { draftRankerRequest } from "lib/draft-ranker/client";
import type { RequestDraftPlayerAdditionInput } from "lib/draft-ranker/contracts";

export type DraftPlayerSearchResult = {
  playerId: number;
  canonicalName: string;
  birthYear: number | null;
  position: string | null;
  organizationName: string | null;
  organizationType: string;
  lifecycleStatus: string;
  headshotUrl: string | null;
  nhlPlayerId: number | null;
  yahooPlayerId: string | null;
  externalProviders: string[];
  isRankable: boolean;
  matchKind: string;
  similarityScore: number;
};

type DraftPlayerSearchResponse = {
  query: string;
  includeArchived: boolean;
  results: DraftPlayerSearchResult[];
};

type PlayerAdditionResponse = {
  status: "completed" | "duplicate";
  requestId: string;
  requestStatus: string;
  created: boolean;
};

export function useDraftPlayerSearch(
  query: string,
  includeArchived: boolean,
  enabled: boolean,
) {
  const debouncedQuery = useDebounce(query.trim(), 250);
  const search = useQuery({
    queryKey: ["draft-ranker", "player-search", debouncedQuery, includeArchived],
    queryFn: () =>
      draftRankerRequest<DraftPlayerSearchResponse>(
        `/api/v1/draft-ranker/players/search?q=${encodeURIComponent(
          debouncedQuery,
        )}&includeArchived=${includeArchived}`,
      ),
    enabled: enabled && debouncedQuery.length >= 2,
    retry: false,
    staleTime: 30_000,
  });

  const requestAddition = useMutation({
    mutationFn: (input: RequestDraftPlayerAdditionInput) =>
      draftRankerRequest<PlayerAdditionResponse>(
        "/api/v1/draft-ranker/players/request-addition",
        { method: "POST", body: JSON.stringify(input) },
      ),
  });

  return { debouncedQuery, search, requestAddition };
}
