import { Line } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
} from "chart.js";
import { useQuery } from "@tanstack/react-query";
import supabase from "lib/supabase/client";
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
  playerId: number;
};

export default function GameScoreLineChart({ playerId }: GameScoreLineChart) {
  const { data } = useQuery({
    queryKey: [playerId],
    queryFn: async ({ queryKey }) => {
      const { data } = await supabase
        .rpc("get_skater_game_score_by_limit", {
          player_id: queryKey[0],

          num_games: 10,
        })
        .throwOnError();
      return data;
    },
  });

  console.log(data);

  return <div>{JSON.stringify(data)}</div>;
}
