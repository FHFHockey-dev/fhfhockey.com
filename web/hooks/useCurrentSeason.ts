import { useContext } from "react";
import { QueryClientContext, useQuery } from "@tanstack/react-query";
import { Season } from "lib/NHL/types";
import { getCurrentSeason } from "lib/NHL/client";

export const currentSeasonQueryKey = ["currentSeason"] as const;

export function useCurrentSeasonQuery() {
  return useQuery<Season | null>({
    queryKey: currentSeasonQueryKey,
    queryFn: async () => {
      try {
        const season = await getCurrentSeason();

        if (season && typeof season.seasonId === "number") {
          return season;
        }

        console.warn(
          "useCurrentSeason received an invalid season payload; leaving season unset.",
          season,
        );
        return null;
      } catch (error) {
        console.error("useCurrentSeason failed to load season", error);
        throw error;
      }
    },
    staleTime: 1000 * 60 * 60,
    gcTime: 1000 * 60 * 60 * 6,
  });
}

export default function useCurrentSeason() {
  const { data } = useCurrentSeasonQuery();

  return data ?? undefined;
}

/**
 * What a panel says while it waits for the season: loading, or that the
 * lookup failed after its retries. It reads the shared query state without
 * subscribing (the page's own season query re-renders it), so it also works
 * outside a QueryClientProvider.
 */
export function useSeasonPendingMessage(): string {
  const client = useContext(QueryClientContext);
  return client?.getQueryState(currentSeasonQueryKey)?.status === "error"
    ? "Unable to load season info right now."
    : "Loading season info...";
}
