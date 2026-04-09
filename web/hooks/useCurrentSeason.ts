import { useQuery } from "@tanstack/react-query";
import { Season } from "lib/NHL/types";
import { getCurrentSeason } from "lib/NHL/client";

export const currentSeasonQueryKey = ["currentSeason"] as const;

export default function useCurrentSeason() {
  const { data } = useQuery<Season | null>({
    queryKey: currentSeasonQueryKey,
    queryFn: async () => {
      try {
        const season = await getCurrentSeason();

        if (season && typeof season.seasonId === "number") {
          return season;
        }

        console.warn(
          "useCurrentSeason received an invalid season payload; leaving season unset.",
          season
        );
        return null;
      } catch (error) {
        console.error("useCurrentSeason failed to load season", error);
        throw error;
      }
    },
    staleTime: 1000 * 60 * 60,
    gcTime: 1000 * 60 * 60 * 6
  });

  return data ?? undefined;
}
