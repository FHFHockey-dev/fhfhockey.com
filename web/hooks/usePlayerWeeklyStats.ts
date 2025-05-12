import { useState, useEffect, useMemo } from "react";
import supabase from "lib/supabase";
import { PostgrestResponse } from "@supabase/supabase-js";
import { getWeekStartDates } from "../utils/dateUtils"; // Adjusted path
import {
  STATS_MASTER_LIST,
  StatDefinition
} from "lib/projectionsConfig/statsMasterList";

// Define the expected structure of a row from wgo_skater_stats
interface SkaterStatGameLog {
  player_id: number;
  date: string; // YYYY-MM-DD
  games_played: number | null;
  goals: number | null;
  assists: number | null;
  points: number | null;
  plus_minus: number | null;
  shots: number | null; // maps to SHOTS_ON_GOAL
  hits: number | null;
  blocked_shots: number | null;
  penalty_minutes: number | null;
  pp_points: number | null;
  pp_goals: number | null;
  pp_assists: number | null;
  sh_points: number | null;
  // Add other relevant stats from wgo_skater_stats that contribute to fantasy points
  // e.g. faceoffs_won, faceoffs_lost if they are in your fantasyPointSettings keys
  [key: string]: any; // Allow other properties
}

export interface WeeklyPerformanceData {
  weekStartDate: string; // YYYY-MM-DD, representing Monday of the week
  fantasyPoints: number;
  gamesPlayedInWeek: number;
}

interface UsePlayerWeeklyStatsProps {
  playerId: number | null;
  seasonStartDate: string | null; // YYYY-MM-DD
  seasonEndDate: string | null; // YYYY-MM-DD
  fantasyPointSettings: Record<string, number>;
  isEnabled?: boolean; // To control whether the hook should fetch data
}

const usePlayerWeeklyStats = ({
  playerId,
  seasonStartDate,
  seasonEndDate,
  fantasyPointSettings,
  isEnabled = true
}: UsePlayerWeeklyStatsProps) => {
  const [weeklyData, setWeeklyData] = useState<WeeklyPerformanceData[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Memoize stat key mapping to avoid recalculating on every render
  const statDbColumnMap = useMemo(() => {
    const map: Record<string, string> = {};
    STATS_MASTER_LIST.forEach((statDef) => {
      // Simplified mapping, assuming wgo_skater_stats columns match statDef.key.toLowerCase()
      // or a more specific mapping if available (like 'shots' for 'SHOTS_ON_GOAL')
      if (statDef.isSkaterStat) {
        if (statDef.key === "SHOTS_ON_GOAL") {
          map[statDef.key] = "shots";
        } else if (statDef.key === "PENALTY_MINUTES") {
          map[statDef.key] = "penalty_minutes";
        } else if (statDef.key === "BLOCKED_SHOTS") {
          map[statDef.key] = "blocked_shots";
        } else if (statDef.key === "PP_POINTS") {
          map[statDef.key] = "pp_points";
        } else if (statDef.key === "SH_POINTS") {
          map[statDef.key] = "sh_points";
          // Add other explicit mappings here as needed for wgo_skater_stats column names
        } else {
          map[statDef.key] = statDef.key.toLowerCase();
        }
      }
    });
    return map;
  }, []);

  useEffect(() => {
    if (!isEnabled || !playerId || !seasonStartDate || !seasonEndDate) {
      setWeeklyData([]);
      setIsLoading(false);
      return;
    }

    const fetchAndProcessData = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const {
          data: gameLogs,
          error: fetchError
        }: PostgrestResponse<SkaterStatGameLog> = await supabase
          .from("wgo_skater_stats")
          .select("*") // Select all columns for now, can be optimized later
          .eq("player_id", playerId)
          .gte("date", seasonStartDate)
          .lte("date", seasonEndDate)
          .order("date", { ascending: true });

        if (fetchError) {
          throw fetchError;
        }

        const dailyFantasyPoints: Record<
          string,
          { totalPoints: number; gamesPlayed: number }
        > = {};
        gameLogs.forEach((log) => {
          let pointsForGame = 0;
          for (const statKey in fantasyPointSettings) {
            const pointValue = fantasyPointSettings[statKey];
            if (pointValue === 0) continue;

            const dbColumnName = statDbColumnMap[statKey];
            if (
              dbColumnName &&
              log[dbColumnName] !== null &&
              typeof log[dbColumnName] === "number"
            ) {
              pointsForGame += (log[dbColumnName] as number) * pointValue;
            }
          }
          dailyFantasyPoints[log.date] = {
            totalPoints:
              (dailyFantasyPoints[log.date]?.totalPoints || 0) + pointsForGame,
            gamesPlayed:
              (dailyFantasyPoints[log.date]?.gamesPlayed || 0) +
              (log.games_played || 0)
          };
        });

        const allWeekStartDates = getWeekStartDates(
          seasonStartDate,
          seasonEndDate
        );
        const aggregatedWeeklyData: WeeklyPerformanceData[] =
          allWeekStartDates.map((weekStartDateObj) => {
            const weekStartString = weekStartDateObj
              .toISOString()
              .split("T")[0];
            let pointsForWeek = 0;
            let gamesInWeek = 0;

            for (let i = 0; i < 7; i++) {
              const dayInWeek = new Date(weekStartDateObj);
              dayInWeek.setDate(weekStartDateObj.getDate() + i);
              const dayString = dayInWeek.toISOString().split("T")[0];

              if (dailyFantasyPoints[dayString]) {
                pointsForWeek += dailyFantasyPoints[dayString].totalPoints;
                gamesInWeek += dailyFantasyPoints[dayString].gamesPlayed;
              }
            }
            return {
              weekStartDate: weekStartString,
              fantasyPoints: pointsForWeek,
              gamesPlayedInWeek: gamesInWeek
            };
          });

        setWeeklyData(aggregatedWeeklyData);
      } catch (e: any) {
        console.error("Error fetching or processing player weekly stats:", e);
        setError(e.message || "An error occurred.");
        setWeeklyData([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchAndProcessData();
  }, [
    playerId,
    seasonStartDate,
    seasonEndDate,
    JSON.stringify(fantasyPointSettings),
    isEnabled,
    statDbColumnMap
  ]); // Include statDbColumnMap

  return { weeklyData, isLoading, error };
};

export default usePlayerWeeklyStats;
