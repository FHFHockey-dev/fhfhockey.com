import { useQuery } from "@tanstack/react-query";
import { fetchPlayerPerGameTotals } from "utils/fetchWigoPlayerStats";
import { WIGO_QUERY_DEFAULTS } from "components/WiGO/queryDefaults";

// Snapshot, pace and trend references must share the same player/season totals.
export default function useWigoPlayerTotals(
  playerId: number | null | undefined,
  seasonId: number | null | undefined
) {
  return useQuery({
    queryKey: ["wigoPerGameTotals", playerId, seasonId],
    queryFn: () => fetchPlayerPerGameTotals(playerId!, seasonId!),
    enabled: !!playerId && !!seasonId,
    ...WIGO_QUERY_DEFAULTS
  });
}
