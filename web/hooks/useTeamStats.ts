// hooks/useTeamStats.ts
import { useEffect, useState } from "react";
import supabase from "lib/supabase";

type TeamStatsMap = {
  [teamAbbrev: string]: {
    xgf_per_game: number;
    xga_per_game: number;
    sf_per_game: number;
    sa_per_game: number;
    goal_for_per_game: number;
    goal_against_per_game: number;
    win_pctg: number;
  };
};

export default function useTeamStats(): TeamStatsMap {
  const [statsMap, setStatsMap] = useState<TeamStatsMap>({});

  useEffect(() => {
    async function fetchStats() {
      const { data, error } = await supabase
        .from("nhl_team_data")
        .select(
          "team_abbrev, win_pctg, xgf_per_game, goal_for_per_game, goal_against_per_game, xga_per_game, sf_per_game, sa_per_game"
        );

      if (error) {
        console.error("Error fetching team stats:", error);
        return;
      }

      console.log("Fetched team stats data:", data);

      const map: TeamStatsMap = {};
      data?.forEach((row: any) => {
        const key = row.team_abbrev.toUpperCase();
        map[key] = {
          xgf_per_game: parseFloat(row.xgf_per_game),
          xga_per_game: parseFloat(row.xga_per_game),
          sf_per_game: parseFloat(row.sf_per_game),
          sa_per_game: parseFloat(row.sa_per_game),
          goal_for_per_game: parseFloat(row.goal_for_per_game),
          goal_against_per_game: parseFloat(row.goal_against_per_game),
          win_pctg: parseFloat(row.win_pctg)
        };
      });
      console.log("Built team stats map:", map);
      setStatsMap(map);
    }
    fetchStats();
  }, []);

  return statsMap;
}
