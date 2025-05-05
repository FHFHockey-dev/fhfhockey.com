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
      // Add other GoalieBaseStats properties from rankData
      Object.keys(GoalieBaseStatsExample).forEach((baseKey) => {
        const key = baseKey as keyof GoalieBaseStats;
        // Assert rankData to any for index access, assuming GoalieWeeklyRank includes GoalieBaseStats fields
        const value = (rankData as any)[key];
        if (value !== undefined && value !== null) {
          // Assign the value from rankData
          (displayGoalie as any)[key] = value;
        } else {
          // Assign a default or handle missing base stats if necessary
          (displayGoalie as any)[key] = GoalieBaseStatsExample[key]; // Or null, or 'N/A'
        }
      });
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
        // Add comparison for Ranking type if needed
        if (
          key === "ranking" &&
          typeof aValue === "object" &&
          typeof bValue === "object" &&
          aValue !== null &&
          bValue !== null &&
          "value" in aValue &&
          "valueOf" in aValue && // Check if it's a string-like object
          "valueOf" in bValue
        ) {
          // Define the desired sort order for rankings
          const rankingOrder: Ranking[] = [
            "Elite",
            "Quality",
            "Average",
            "Bad",
            "Really Bad"
          ]; // Add "Unknown" or adjust as needed
          const aRankIndex = rankingOrder.indexOf(aValue as Ranking);
          const bRankIndex = rankingOrder.indexOf(bValue as Ranking);

          // Handle cases where a ranking might not be in the defined order
          const effectiveARank = aRankIndex === -1 ? Infinity : aRankIndex;
          const effectiveBRank = bRankIndex === -1 ? Infinity : bRankIndex;

          if (effectiveARank < effectiveBRank)
            return listSortConfig.direction === "ascending" ? -1 : 1;
          if (effectiveARank > effectiveBRank)
            return listSortConfig.direction === "ascending" ? 1 : -1;
          return 0;
        }

        if (typeof aValue === "number" && typeof bValue === "number") {
          if (aValue < bValue)
            return listSortConfig.direction === "ascending" ? -1 : 1;
          if (aValue > bValue)
            return listSortConfig.direction === "ascending" ? 1 : -1;
        }
        // Fallback comparison (might need adjustment based on actual types)
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

  // <<< --- MOVED useCallback HERE --- >>>
  // Define the sort handler using useCallback before conditional returns
  const handleListSort = useCallback(
    (
      key:
        | keyof GoalieBaseStats
        | "playerId"
        | "goalieFullName"
        | "team"
        | "percentage"
        | "ranking"
        | "gameDate" // Keep gameDate here as GoalieTable might pass it
    ) => {
      // Check if the key is valid for DisplayGoalie *before* setting state
      const validKeys: Array<keyof DisplayGoalie> = [
        "playerId",
        "goalieFullName",
        "team",
        "percentage",
        "ranking",
        // Add all keys from GoalieBaseStats
        ...(Object.keys(GoalieBaseStatsExample) as Array<keyof GoalieBaseStats>)
      ];

      // Explicitly check if the incoming key is one we can sort DisplayGoalie by
      if (!validKeys.includes(key as keyof DisplayGoalie)) {
        // Handle unsupported keys like 'gameDate' for this view
        if (key === "gameDate") {
          console.warn(
            "Sorting by 'gameDate' is not applicable in the weekly GoalieList view."
          );
        } else {
          console.warn(`Attempted to sort by an unsupported key: ${key}`);
        }
        return; // Do not update sort state for unsupported keys
      }

      // Now we know 'key' is a valid key for DisplayGoalie (excluding 'gameDate')
      setListSortConfig((prevConfig) => {
        let direction: "ascending" | "descending" = "ascending";
        // Type assertion needed because TS doesn't automatically narrow 'key'
        // based on the runtime check above within the callback scope.
        const sortKey = key as keyof DisplayGoalie;

        if (
          prevConfig.key === sortKey &&
          prevConfig.direction === "ascending"
        ) {
          direction = "descending";
        }
        return { key: sortKey, direction };
      });
    },
    [] // No dependencies needed as it only uses setListSortConfig and constants
  );

  // Loading/Error checks - Now safe to have after all hook calls
  if (loading) {
    return <p className={styles.loadingMessage}>Loading week data...</p>;
  }
  if (!goalieAggregates || !leagueAverage) {
    return (
      <div className={styles.messageContainer}>
        {" "}
        {/* Use a container for centering/styling */}
        <p className={styles.standoutNote}>
          Weekly data or average unavailable.
        </p>
        <button onClick={onBackToLeaderboard} className={styles.backButton}>
          Back to Leaderboard
        </button>
      </div>
    );
  }
  if (goaliesForTable.length === 0 && !loading) {
    return (
      <div className={styles.messageContainer}>
        {" "}
        {/* Use a container for centering/styling */}
        <p className={styles.standoutNote}>
          No goalie data found for this week.
        </p>
        <button onClick={onBackToLeaderboard} className={styles.backButton}>
          Back to Leaderboard
        </button>
      </div>
    );
  }

  // Render the table if data is available
  return (
    <GoalieTable
      goalies={goaliesForTable} // Pass sorted data
      averages={averagesForTable}
      selectedStats={selectedStats}
      statColumns={statColumns}
      // setView={setView} // Keep if needed for other functionality
      startDate={startDate}
      endDate={endDate}
      isSingleWeek={true}
      onBackToLeaderboard={onBackToLeaderboard}
      requestSort={handleListSort} // Pass the memoized sort handler
      sortConfig={listSortConfig} // Pass the current sort config
    />
  );
};

export default GoalieList;
