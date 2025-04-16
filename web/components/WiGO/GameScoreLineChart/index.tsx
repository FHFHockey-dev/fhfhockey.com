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
import supabase from "lib/supabase/client";
import RollingAverageChart from "./RollingAverageChart";
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

type GameScoreLineChart = {
  playerId: number | undefined;
};

export default function GameScoreLineChart({ playerId }: GameScoreLineChart) {
  const { data } = useQuery({
    queryKey: [playerId],
    queryFn: async ({ queryKey }) => {
      if (queryKey[0] === undefined) return [];
      const { data } = await supabase
        .rpc("get_skater_game_score_by_limit", {
          player_id: queryKey[0],
          num_games: 20
        })
        .order("game_date", { ascending: true })
        .throwOnError();
      return data;
    }
  });

  return (
    <RollingAverageChart
      data={data ?? []}
      windowSizes={[5, 10]}
      getValue={(item) => item.game_score}
      getLabel={(item) => item.game_date.split("-").slice(1).join("-")}
    />
  );
}
