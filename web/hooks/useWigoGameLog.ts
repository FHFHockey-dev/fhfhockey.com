import { useQuery } from "@tanstack/react-query";
import { fetchPlayerGameLogConsistencyData } from "utils/fetchWigoPlayerStats";
import { WIGO_QUERY_DEFAULTS } from "components/WiGO/queryDefaults";

// Points, consistency and Game Score coverage share the same season calendar.
export default function useWigoGameLog(playerId: number | null | undefined, seasonId: number | null | undefined) {
  return useQuery({
    queryKey: ["wigoGameLog", playerId, seasonId],
    queryFn: () => fetchPlayerGameLogConsistencyData(playerId!, String(seasonId)),
    enabled: Number.isSafeInteger(playerId) && Number.isSafeInteger(seasonId) && playerId! > 0 && seasonId! > 0,
    ...WIGO_QUERY_DEFAULTS
  });
}
