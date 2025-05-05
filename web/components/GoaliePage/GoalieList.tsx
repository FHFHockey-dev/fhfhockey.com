// web/components/GoaliePage/GoalieList.tsx

import React, { useMemo, FC, useState, useCallback } from "react";
import GoalieTable from "./GoalieTable";
import styles from "styles/Goalies.module.scss";
import { format } from "date-fns";
import {
  NumericGoalieStatKey,
  StatColumn,
  GoalieWeeklyAggregate,
  LeagueWeeklyAverage,
  Ranking,
  WeekOption,
  GoalieBaseStats, // Ensure GoalieBaseStats is imported
  GoalieAverages
} from "components/GoaliePage/goalieTypes";
import { calculateWeeklyRanking, rankingPoints } from "./goalieCalculations";

// Define SortConfig interface if not imported
interface SortConfig<T> {
  key: keyof T | null;
  direction: "ascending" | "descending";
}
// Define the type GoalieTable expects
type DisplayGoalie = GoalieBaseStats & {
  playerId: number;
  goalieFullName: string;
  team?: string;
  percentage?: number;
  ranking?: Ranking;
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
  loading?: boolean; // Optional loading state
  onBackToLeaderboard: () => void; // Function to go back to leaderboard
}

const GoalieList: FC<Props> = ({
  goalieAggregates,
  leagueAverage,
  week,
  selectedStats,
  statColumns,
  setView,
  loading,
  onBackToLeaderboard
}) => {
  const [listSortConfig, setListSortConfig] = useState<
    SortConfig<DisplayGoalie>
  >({
    key: "goalieFullName", // Default sort by name
    direction: "ascending"
  });

  // <<<--- MOVE DECLARATION HERE --- >>>
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
    timeOnIce: 0, // minutes from mapping
    savePct: 0,
    goalsAgainstAverage: 0,
    savesPer60: 0,
    shotsAgainstPer60: 0
  };

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
    let transformedGoalies = rankedWeeklyData.map((rankData) => {
      const displayGoalie: Partial<DisplayGoalie> = {
        playerId: rankData.goalie_id ?? -1,
        goalieFullName: rankData.goalie_name ?? "Unknown Goalie",
        team: rankData.team ?? undefined,
        ranking: rankData.weeklyRank,
        percentage: rankData.weeklyRankPercentage
      };
      return displayGoalie as DisplayGoalie;
    });
    // 2. Sort the transformed data
    if (listSortConfig.key !== null) {
      transformedGoalies.sort((a, b) => {
        const key = listSortConfig.key!;
        // Ensure key exists (though DisplayGoalie should be consistent)
        if (!(key in a) || !(key in b)) return 0;

        const aValue = a[key];
        const bValue = b[key];

        // Robust comparison (handle null/undefined, numbers, strings)
        if (aValue == null && bValue == null) return 0;
        if (aValue == null)
          return listSortConfig.direction === "ascending" ? 1 : -1; // Nulls last
        if (bValue == null)
          return listSortConfig.direction === "ascending" ? -1 : 1; // Nulls last

        // Basic comparison, expand if needed (e.g., case-insensitive string)
        if (typeof aValue === "string" && typeof bValue === "string") {
          return (
            aValue.localeCompare(bValue) *
            (listSortConfig.direction === "ascending" ? 1 : -1)
          );
        }

        if (aValue < bValue)
          return listSortConfig.direction === "ascending" ? -1 : 1;
        if (aValue > bValue)
          return listSortConfig.direction === "ascending" ? 1 : -1;
        return 0;
      });
    }

    return transformedGoalies;
    // *** Add listSortConfig to dependencies ***
  }, [rankedWeeklyData, statColumns, listSortConfig]);

  // Step 3: Format the single LeagueWeeklyAverage into GoalieAverages for the table header
  const averagesForTable = useMemo((): GoalieAverages => {
    const averages: Partial<GoalieAverages> = {};
    if (!leagueAverage) return averages as GoalieAverages; // Return empty if no average

    statColumns.forEach((col) => {
      const uiKey = col.value;
      const dbKey = col.dbFieldAverage;

      if (dbKey) {
        const avgValue = leagueAverage[dbKey];
        if (avgValue !== null && avgValue !== undefined) {
          if (typeof avgValue === "number") {
            // Format based on stat type (ensure consistency with GoalieTable)
            if (uiKey === "savePct") averages[uiKey] = avgValue.toFixed(3);
            else if (
              uiKey === "goalsAgainstAverage" ||
              uiKey === "savesPer60" ||
              uiKey === "shotsAgainstPer60"
            )
              averages[uiKey] = avgValue.toFixed(2);
            else if (
              uiKey === "timeOnIce" &&
              leagueAverage.avg_league_weekly_toi_seconds
            )
              // Convert average TOI from seconds to minutes before formatting
              averages[uiKey] = (
                leagueAverage.avg_league_weekly_toi_seconds / 60
              ).toFixed(1);
            else if (Number.isInteger(avgValue))
              averages[uiKey] = String(avgValue);
            else averages[uiKey] = avgValue.toFixed(2); // Default format
          } else {
            averages[uiKey] = String(avgValue); // Keep non-numeric as string
          }
        } else {
          averages[uiKey] = "N/A";
        }
      } else {
        averages[uiKey] = "N/A";
      }
    });
    // Ensure all expected keys exist, even if not in averages data
    Object.keys(GoalieBaseStatsExample).forEach((key) => {
      if (!(key in averages)) {
        averages[key as keyof GoalieAverages] = "N/A";
      }
    });

    return averages as GoalieAverages;
  }, [leagueAverage, statColumns]); // Add GoalieBaseStatsExample as dependency isn't strictly needed but ensures consistency if its structure changes

  // Format week dates for display
  const { startDate, endDate } = useMemo(() => {
    if (!week || !week.start || !week.end)
      return { startDate: "N/A", endDate: "N/A" };
    return {
      startDate: format(week.start, "MM/dd/yyyy"),
      endDate: format(week.end, "MM/dd/yyyy")
    };
  }, [week]);

  // Loading/Error checks - these return messages directly, which is fine
  if (loading) {
    // Handle loading state passed from parent
    return <p className={styles.loadingMessage}>Loading week data...</p>; // Use new style
  }
  if (!goalieAggregates || !leagueAverage) {
    return (
      <p className={styles.standoutNote}>Weekly data or average unavailable.</p>
    ); // Use appropriate note style
  }
  if (goaliesForTable.length === 0 && !loading) {
    return (
      <p className={styles.standoutNote}>No goalie data found for this week.</p>
    ); // Use appropriate note style
  }

  // *** NEW: Handler for List Sorting ***
  // Update key type to match GoalieTable's expected requestSort prop type
  const handleListSort = useCallback(
    (
      key:
        | keyof GoalieBaseStats
        | "playerId"
        | "goalieFullName"
        | "team"
        | "percentage"
        | "ranking"
        | "gameDate" // Add gameDate to match GoalieTable prop type
    ) => {
      // Ensure we only try to set keys that are valid for DisplayGoalie in the state
      // This assumes GoalieTable won't pass 'gameDate' when isSingleWeek is true,
      // or handles it appropriately. If 'gameDate' could be passed, add a check here.
      if (key === "gameDate") {
        console.warn(
          "Sorting by 'gameDate' is not supported in the weekly view."
        );
        return; // Do nothing if 'gameDate' is requested
      }

      setListSortConfig((prevConfig) => {
        let direction: "ascending" | "descending" = "ascending";
        // Now 'key' could be 'gameDate', but we've returned early if it is.
        // So here, 'key' must be one of the keys applicable to DisplayGoalie.
        // We might need a type assertion if TS can't infer this, but let's try without first.
        if (prevConfig.key === key && prevConfig.direction === "ascending") {
          direction = "descending";
        }
        return { key, direction };
      });
    },
    []
  );

  return (
    <GoalieTable
      goalies={goaliesForTable} // Pass sorted data
      averages={averagesForTable}
      selectedStats={selectedStats}
      statColumns={statColumns}
      // setView={setView} // Keep if needed
      startDate={startDate}
      endDate={endDate}
      isSingleWeek={true}
      onBackToLeaderboard={onBackToLeaderboard}
      // *** Pass sort props ***
      requestSort={handleListSort}
      sortConfig={listSortConfig}
    />
  );
};

export default GoalieList;
