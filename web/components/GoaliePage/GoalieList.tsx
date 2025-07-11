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
  GoalieBaseStats,
  GoalieAverages
} from "components/GoaliePage/goalieTypes";
import { calculateWeeklyRanking } from "./goalieCalculations"; // Removed unused rankingPoints import

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
  // setView, // Commented out if not used
  loading,
  onBackToLeaderboard
}) => {
  // --- Start of Hook Declarations ---

  const [listSortConfig, setListSortConfig] = useState<
    SortConfig<DisplayGoalie>
  >({
    key: "goalieFullName", // Default sort by name
    direction: "ascending"
  });

  // Define GoalieBaseStatsExample *before* hooks that depend on it
  // Note: While defining constants inside is fine, if this never changes,
  // defining it *outside* the component could be slightly more optimal.
  // But for dependency array correctness, keeping it here is okay.
  const GoalieBaseStatsExample: Required<GoalieBaseStats> = useMemo(
    () => ({
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
    }),
    []
  ); // Wrap in useMemo to ensure stable reference for dependency arrays

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
    // Sort by points descending
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
        const value = (rankData as any)[key]; // Assuming GoalieWeeklyRank includes GoalieBaseStats fields
        if (value !== undefined && value !== null) {
          (displayGoalie as any)[key] = value;
        } else {
          // Assign default from GoalieBaseStatsExample if value is missing/null
          (displayGoalie as any)[key] = GoalieBaseStatsExample[key];
        }
      });
      return displayGoalie as DisplayGoalie;
    });

    // Sort the transformed data based on listSortConfig
    if (listSortConfig.key !== null) {
      const key = listSortConfig.key; // Key is known to be non-null here
      transformedGoalies.sort((a, b) => {
        // Ensure the key exists on both objects before accessing
        if (!(key in a) || !(key in b)) return 0;

        const aValue = a[key];
        const bValue = b[key];

        // Handle null/undefined values consistently
        if (aValue == null && bValue == null) return 0;
        if (aValue == null)
          return listSortConfig.direction === "ascending" ? 1 : -1; // Nulls last
        if (bValue == null)
          return listSortConfig.direction === "ascending" ? -1 : 1; // Nulls last

        // Specific comparison logic based on type
        if (typeof aValue === "string" && typeof bValue === "string") {
          return (
            aValue.localeCompare(bValue) *
            (listSortConfig.direction === "ascending" ? 1 : -1)
          );
        }

        if (key === "ranking") {
          // Special sort for Ranking type
          const rankingOrder: Ranking[] = [
            "Elite",
            "Quality",
            "Average",
            "Bad",
            "Really Bad"
          ];
          const aRankIndex = rankingOrder.indexOf(aValue as Ranking);
          const bRankIndex = rankingOrder.indexOf(bValue as Ranking);
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
          return 0;
        }

        // Fallback comparison (might need adjustments for other types)
        if (aValue < bValue)
          return listSortConfig.direction === "ascending" ? -1 : 1;
        if (aValue > bValue)
          return listSortConfig.direction === "ascending" ? 1 : -1;
        return 0;
      });
    }

    return transformedGoalies;
  }, [rankedWeeklyData, listSortConfig, GoalieBaseStatsExample]); // <-- Added GoalieBaseStatsExample dependency (line 209 warning)

  // Step 3: Format the single LeagueWeeklyAverage into GoalieAverages for the table header
  const averagesForTable = useMemo((): GoalieAverages => {
    const averages: Partial<GoalieAverages> = {};
    if (!leagueAverage) return averages as GoalieAverages;

    statColumns.forEach((col) => {
      const uiKey = col.value;
      const dbKey = col.dbFieldAverage;

      if (dbKey) {
        const avgValue = leagueAverage[dbKey];
        if (avgValue !== null && avgValue !== undefined) {
          if (typeof avgValue === "number") {
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
              averages[uiKey] = (
                leagueAverage.avg_league_weekly_toi_seconds / 60
              ).toFixed(1);
            else if (Number.isInteger(avgValue))
              averages[uiKey] = String(avgValue);
            else averages[uiKey] = avgValue.toFixed(2);
          } else {
            averages[uiKey] = String(avgValue);
          }
        } else {
          averages[uiKey] = "N/A";
        }
      } else {
        averages[uiKey] = "N/A";
      }
    });
    // Ensure all base stat keys exist, even if not in statColumns/averages data
    Object.keys(GoalieBaseStatsExample).forEach((key) => {
      if (!(key in averages)) {
        averages[key as keyof GoalieAverages] = "N/A"; // Use N/A as default
      }
    });

    return averages as GoalieAverages;
  }, [leagueAverage, statColumns, GoalieBaseStatsExample]); // <-- Added GoalieBaseStatsExample dependency (line 261 warning)

  // Format week dates for display
  const { startDate, endDate } = useMemo(() => {
    if (!week || !week.start || !week.end)
      return { startDate: "N/A", endDate: "N/A" };
    return {
      startDate: format(new Date(week.start), "MM/dd/yyyy"), // Ensure week.start/end are Date objects or parseable strings
      endDate: format(new Date(week.end), "MM/dd/yyyy")
    };
  }, [week]);

  // Define the sort handler using useCallback
  const handleListSort = useCallback(
    (
      key:
        | keyof GoalieBaseStats
        | "playerId"
        | "goalieFullName"
        | "team"
        | "percentage"
        | "ranking"
        | "gameDate" // Keep potential key from GoalieTable
    ) => {
      // Build list of valid keys *based on GoalieBaseStatsExample*
      const validKeys: Array<keyof DisplayGoalie> = [
        "playerId",
        "goalieFullName",
        "team",
        "percentage",
        "ranking",
        ...(Object.keys(GoalieBaseStatsExample) as Array<keyof GoalieBaseStats>)
      ];

      // Check if the incoming key is one we can sort DisplayGoalie by
      if (!validKeys.includes(key as keyof DisplayGoalie)) {
        if (key === "gameDate") {
          console.warn(
            "Sorting by 'gameDate' is not applicable in the weekly GoalieList view."
          );
        } else {
          console.warn(`Attempted to sort by an unsupported key: ${key}`);
        }
        return; // Do not update sort state for unsupported/invalid keys
      }

      // Now we know 'key' is a valid key for DisplayGoalie
      setListSortConfig((prevConfig) => {
        let direction: "ascending" | "descending" = "ascending";
        // Assert key type as it's confirmed valid now
        const sortKey = key as keyof DisplayGoalie;

        if (
          prevConfig.key === sortKey &&
          prevConfig.direction === "ascending"
        ) {
          direction = "descending";
        }
        // Ensure the key being set is one of the valid keys for DisplayGoalie
        return { key: sortKey, direction };
      });
    },
    [GoalieBaseStatsExample] // <-- Added GoalieBaseStatsExample dependency (line 342 warning)
    // setListSortConfig is stable and doesn't need to be listed
  );

  // --- End of Hook Declarations ---

  // Conditional Returns (Now guaranteed to be AFTER all hooks)
  if (loading) {
    return <p className={styles.loadingMessage}>Loading week data...</p>;
  }

  if (!goalieAggregates || !leagueAverage) {
    return (
      <div className={styles.messageContainer}>
        <p className={styles.standoutNote}>
          Weekly data or league average unavailable.
        </p>
        <button onClick={onBackToLeaderboard} className={styles.backButton}>
          Back to Leaderboard
        </button>
      </div>
    );
  }

  // Check goaliesForTable *after* checking aggregates/average
  if (goaliesForTable.length === 0 && !loading) {
    // Added !loading check again for clarity
    return (
      <div className={styles.messageContainer}>
        <p className={styles.standoutNote}>
          No goalie data found for this week.
        </p>
        <button onClick={onBackToLeaderboard} className={styles.backButton}>
          Back to Leaderboard
        </button>
      </div>
    );
  }

  // Render the table if all checks pass
  return (
    <GoalieTable
      goalies={goaliesForTable}
      averages={averagesForTable}
      selectedStats={selectedStats}
      statColumns={statColumns}
      startDate={startDate}
      endDate={endDate}
      isSingleWeek={true}
      onBackToLeaderboard={onBackToLeaderboard}
      requestSort={handleListSort}
      sortConfig={listSortConfig}
    />
  );
};

export default GoalieList;
