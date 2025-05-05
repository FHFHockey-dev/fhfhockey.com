// web/components/GoaliePage/GoalieList.tsx

import React, { useMemo, FC } from "react";
import GoalieTable from "./GoalieTable";
import styles from "styles/Goalies.module.scss";
import { format } from "date-fns";
import {
  // Remove Week import if not used directly
  NumericGoalieStatKey,
  StatColumn,
  GoalieWeeklyAggregate,
  LeagueWeeklyAverage,
  Ranking,
  WeekOption,
  GoalieBaseStats,
  GoalieAverages
} from "components/GoaliePage/goalieTypes";
import { calculateWeeklyRanking, rankingPoints } from "./goalieCalculations";

// Define the type GoalieTable expects based on its definition
// This combines GoalieBaseStats with info and optional ranking fields
type DisplayGoalie = GoalieBaseStats & {
  playerId: number;
  goalieFullName: string;
  team?: string;
  percentage?: number; // Assuming GoalieTable uses this name
  ranking?: Ranking;
  // Add fields GoalieTable might expect
};

interface GoalieWeeklyRank extends GoalieWeeklyAggregate {
  weeklyRank: Ranking;
  weeklyRankPercentage: number;
  weeklyRankPoints: number;
}

interface Props {
  goalieAggregates: GoalieWeeklyAggregate[] | null;
  leagueAverage: LeagueWeeklyAverage | null;
  week: WeekOption["value"];
  selectedStats: NumericGoalieStatKey[];
  statColumns: StatColumn[];
  setView: React.Dispatch<React.SetStateAction<"leaderboard" | "week">>;
}

const GoalieList: FC<Props> = ({
  goalieAggregates,
  leagueAverage,
  week,
  selectedStats,
  statColumns,
  setView
}) => {
  // Step 1: Calculate internal ranked data (GoalieWeeklyRank)
  const rankedWeeklyData = useMemo((): GoalieWeeklyRank[] => {
    if (!goalieAggregates || !leagueAverage || goalieAggregates.length === 0) {
      return [];
    }
    const rankedData: GoalieWeeklyRank[] = goalieAggregates.map((aggregate) => {
      const { ranking, percentage, points } = calculateWeeklyRanking(
        aggregate,
        leagueAverage,
        selectedStats,
        statColumns
      );
      return {
        ...aggregate,
        weeklyRank: ranking,
        weeklyRankPercentage: percentage,
        weeklyRankPoints: points
      };
    });
    rankedData.sort((a, b) => b.weeklyRankPoints - a.weeklyRankPoints);
    return rankedData;
  }, [goalieAggregates, leagueAverage, selectedStats, statColumns]);

  // Step 2: Transform GoalieWeeklyRank[] into DisplayGoalie[] for GoalieTable
  const goaliesForTable = useMemo((): DisplayGoalie[] => {
    return rankedWeeklyData.map((rankData) => {
      // Initialize with info and ranking fields
      const displayGoalie: Partial<DisplayGoalie> = {
        playerId: rankData.goalie_id ?? -1, // Handle potential null goalie_id
        goalieFullName: rankData.goalie_name ?? "Unknown Goalie",
        team: rankData.team ?? undefined,
        ranking: rankData.weeklyRank,
        percentage: rankData.weeklyRankPercentage // Map calculated percentage
      };

      // Map aggregate stats (snake_case) to base stats (camelCase)
      statColumns.forEach((col) => {
        const uiKey = col.value; // The camelCase key (e.g., 'gamesPlayed')
        const dbKey = col.dbFieldGoalie; // The snake_case key (e.g., 'weekly_gp')

        if (dbKey && uiKey in GoalieBaseStatsExample) {
          // Check if uiKey is a valid GoalieBaseStats key
          const weeklyValue = rankData[dbKey];
          let mappedValue: number | undefined = undefined;

          if (typeof weeklyValue === "number" && !isNaN(weeklyValue)) {
            mappedValue = weeklyValue;
            // Special conversion for TOI from seconds to minutes
            if (uiKey === "timeOnIce" && dbKey === "weekly_toi_seconds") {
              mappedValue = weeklyValue / 60;
            }
          }

          // Assign the potentially converted value (default to 0 if null/undefined)
          (displayGoalie as any)[uiKey] = mappedValue ?? 0;
        }
      });
      // Ensure all required GoalieBaseStats fields are present (assign default 0 if mapping failed)
      Object.keys(GoalieBaseStatsExample).forEach((key) => {
        if (!(key in displayGoalie)) {
          (displayGoalie as any)[key] = 0;
        }
      });

      return displayGoalie as DisplayGoalie; // Cast to the final type
    });
  }, [rankedWeeklyData, statColumns]);

  // Helper object to check keys against GoalieBaseStats structure during mapping
  const GoalieBaseStatsExample: Required<GoalieBaseStats> = {
    gamesPlayed: 0,
    gamesStarted: 0,
    wins: 0,
    losses: 0,
    otLosses: 0,
    saves: 0,
    shotsAgainst: 0,
    goalsAgainst: 0,
    shutouts: 0,
    timeOnIce: 0,
    savePct: 0,
    goalsAgainstAverage: 0,
    savesPer60: 0,
    shotsAgainstPer60: 0
  };

  // Step 3: Format the single LeagueWeeklyAverage into GoalieAverages for the table header
  const averagesForTable = useMemo((): GoalieAverages => {
    const averages: Partial<GoalieAverages> = {};
    if (!leagueAverage) return averages as GoalieAverages;

    statColumns.forEach((col) => {
      const uiKey = col.value;
      const dbKey = col.dbFieldAverage; // e.g., 'avg_league_weekly_sv_pct'

      if (dbKey) {
        const avgValue = leagueAverage[dbKey];
        if (avgValue !== null && avgValue !== undefined) {
          // Ensure avgValue is a number before formatting
          if (typeof avgValue === "number") {
            // Format based on stat type (mirroring GoalieTable formatting logic is best)
            if (uiKey === "savePct") averages[uiKey] = avgValue.toFixed(3);
            else if (
              [
                "goalsAgainstAverage",
                "savesPer60",
                "shotsAgainstPer60"
              ].includes(uiKey)
            )
              averages[uiKey] = avgValue.toFixed(2);
            else if (Number.isInteger(avgValue))
              averages[uiKey] = String(avgValue);
            else averages[uiKey] = avgValue.toFixed(2); // Default format for other numbers
          } else {
            // Handle cases where avgValue is not a number (e.g., string)
            // Potentially try to parse if needed, or default to "N/A" or the string value itself
            averages[uiKey] = String(avgValue); // Or "N/A" if preferred
          }
        } else {
          averages[uiKey] = "N/A";
        }
      } else {
        averages[uiKey] = "N/A";
      }
    });
    return averages as GoalieAverages;
  }, [leagueAverage, statColumns]);

  // Format week dates for display
  const { startDate, endDate } = useMemo(() => {
    if (!week || !week.start || !week.end)
      return { startDate: "N/A", endDate: "N/A" };
    return {
      startDate: format(week.start, "MM/dd/yyyy"),
      endDate: format(week.end, "MM/dd/yyyy")
    };
  }, [week]);

  // Loading/Error checks (unchanged)
  if (!goalieAggregates || !leagueAverage) {
    return <p>Loading weekly data or average unavailable...</p>;
  }
  if (goaliesForTable.length === 0) {
    // Check transformed data
    return <p>No goalie data found for this week.</p>;
  }

  return (
    <div className={styles.tableContainer}>
      <GoalieTable
        // Pass the TRANSFORMED data and calculated AVERAGES
        goalies={goaliesForTable} // <--- Use transformed data
        averages={averagesForTable} // <--- Use formatted averages
        selectedStats={selectedStats}
        statColumns={statColumns}
        setView={setView}
        startDate={startDate}
        endDate={endDate}
        isSingleWeek={true}
        // leagueAverage={leagueAverage} // Removed: No longer needed if averagesForTable is passed
      />
    </div>
  );
};

export default GoalieList;
