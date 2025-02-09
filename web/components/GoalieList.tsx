// web/components/GoalieList.tsx
// @ts-nocheck
import React, { useEffect, useState } from "react";
import supabase from "lib/supabase";
import GoalieTable from "./GoalieTable";
import styles from "../styles/Goalies.module.scss";
import { format } from "date-fns";
import {
  GoalieStat,
  GoalieStatRaw,
  Week,
  NumericStatKey,
  GoalieWithRanking,
} from "lib/supabase/GoaliePage/types";
import { calculateAverages } from "lib/supabase/GoaliePage/calculateAverages";
import { calculateRanking } from "lib/supabase/GoaliePage/calculateRanking";

interface Props {
  week: Week;
  selectedStats: NumericStatKey[];
  statColumns: { label: string; value: string }[];
  setView: React.Dispatch<React.SetStateAction<string>>;
}

const GoalieList: React.FC<Props> = ({
  week,
  selectedStats,
  statColumns,
  setView,
}) => {
  const [goalies, setGoalies] = useState<GoalieWithRanking[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchGoalies = async () => {
      setLoading(true);
      setError(null);
      try {
        // Fetch goalie stats for the selected week
        const { data: goalieStats, error: goalieError } = await supabase
          .from("goalie_page_stats")
          .select("*")
          .eq("week_id", week.id);

        if (goalieError) {
          console.error("Error fetching goalie data:", goalieError.message);
          setError("Error fetching goalie data");
          return;
        }

        if (!goalieStats || goalieStats.length === 0) {
          setError("No goalie data found");
          return;
        }

        // Map goalieStats to camelCase
        const goaliesData: GoalieStat[] = goalieStats.map((goalie) => ({
          id: goalie.id,
          playerId: goalie.player_id,
          weekId: goalie.week_id,
          gamesPlayed: goalie.games_played,
          gamesStarted: goalie.games_started,
          wins: goalie.wins,
          losses: goalie.losses,
          otLosses: goalie.ot_losses,
          saves: goalie.saves,
          shotsAgainst: goalie.shots_against,
          goalsAgainst: goalie.goals_against,
          shutouts: goalie.shutouts,
          timeOnIce: goalie.time_on_ice,
          savePct: goalie.save_pct,
          goalsAgainstAverage: goalie.goals_against_average,
          team: goalie.team,
          goalieFullName: goalie.goalie_full_name,
        }));

        // Calculate averages for the week
        const averages = calculateAverages(goaliesData);

        // Calculate rankings for each goalie
        const goaliesWithRanking: GoalieWithRanking[] = goaliesData.map((g) => {
          const { ranking, percentage } = calculateRanking(
            g,
            averages,
            selectedStats
          );

          // Determine percentages based on ranking
          const percentAcceptableWeeks = [
            "Elite Week",
            "Quality Week",
            "Week",
          ].includes(ranking)
            ? 100
            : 0;

          const percentGoodWeeks = ["Elite Week", "Quality Week"].includes(
            ranking
          )
            ? 100
            : 0;

          return {
            ...g,
            percentage,
            ranking,
            percentAcceptableWeeks,
            percentGoodWeeks,
          };
        });

        setGoalies(goaliesWithRanking);
      } catch (err) {
        console.error("Unexpected error fetching goalie data:", err);
        setError("Error fetching goalie data");
      } finally {
        setLoading(false);
      }
    };

    fetchGoalies();
  }, [week, selectedStats]);

  if (loading) return <p>Loading...</p>;
  if (error) return <p className={styles.errorText}>{error}</p>;
  if (goalies.length === 0)
    return <p>No goalie data available for this week.</p>;

  const startDate = format(new Date(week.startDate), "MM/dd/yyyy");
  const endDate = format(new Date(week.endDate), "MM/dd/yyyy");

  return (
    <div className={styles.tableContainer}>
      <GoalieTable
        goalies={goalies}
        selectedStats={selectedStats}
        statColumns={statColumns}
        setView={setView}
        startDate={startDate}
        endDate={endDate}
      />
    </div>
  );
};

export default GoalieList;
