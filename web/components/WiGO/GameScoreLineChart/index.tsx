import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
} from "chart.js";
import { useQuery } from "@tanstack/react-query";
import supabase from "lib/supabase/client"; // Ensure this is the client instance
import RollingAverageChart from "./RollingAverageChart";
import useCurrentSeason from "hooks/useCurrentSeason";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

type GameScoreLineChartProps = {
  playerId: number | undefined;
};

export default function GameScoreLineChart({
  playerId
}: GameScoreLineChartProps) {
  // Call hooks inside the component
  const currentSeason = useCurrentSeason();
  const seasonId = currentSeason?.seasonId; // Safely access seasonId

  // Update queryKey to reflect the data source accurately
  const queryKey = ["skaterGameScoresForSeason", playerId, seasonId];

  const { data, isLoading, error } = useQuery({
    queryKey: queryKey,
    queryFn: async ({ queryKey }) => {
      const pId = queryKey[1] as number | undefined;
      const sId = queryKey[2] as number | undefined;

      // Ensure we have valid IDs before calling the RPC
      if (pId === undefined || sId === undefined) {
        console.log("Player ID or Season ID is missing for query.");
        return []; // Return empty array if IDs aren't ready
      }

      console.log(
        `Workspaceing game scores for player ${pId} in season ${sId} using RPC.`
      );

      // --- Single RPC Call ---
      // Call the NEW RPC function directly with player and season IDs
      const { data: rpcData, error: rpcError } = await supabase
        .rpc("get_skater_game_scores_for_season", {
          p_player_id: pId,
          p_season_id: sId
        })
        .order("game_date", { ascending: true });

      if (rpcError) {
        console.error(
          "Error fetching game scores for season via RPC:",
          rpcError
        );
        throw rpcError; // Let react-query handle the error state
      }

      // Return the data fetched by the RPC, or an empty array if null/undefined
      return rpcData ?? [];
    },
    // Query is enabled only when both playerId and seasonId are valid numbers
    enabled: typeof playerId === "number" && typeof seasonId === "number"
  });

  // --- Loading and Error States ---
  if (isLoading) return <div>Loading game scores...</div>;
  if (error)
    return <div>Error loading game scores: {(error as Error).message}</div>;
  // Optional: Display specific message while season is loading if player ID is present
  if (typeof seasonId !== "number" && typeof playerId === "number")
    return <div>Loading season info...</div>;

  // --- Render Chart ---
  return (
    <RollingAverageChart
      // Ensure data is always an array for the chart component
      data={data ?? []}
      windowSizes={[5, 10]}
      getValue={(item) => item.game_score ?? 0} // Provide default value if null
      // Make sure date formatting is correct for labels, handle null date
      getLabel={(item) =>
        item.game_date ? item.game_date.split("-").slice(1).join("-") : ""
      }
    />
  );
}
