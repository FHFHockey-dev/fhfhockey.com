// web/components/GoaliePage/GoalieTable.tsx

import React, { FC } from "react";
import styles from "styles/Goalies.module.scss";
import type {
  NumericGoalieStatKey,
  StatColumn,
  GoalieBaseStats, // Represents a single game/week stat line
  GoalieAverages, // Represents averages for the displayed data
  Ranking
} from "components/GoaliePage/goalieTypes";
// Import shared statMap
import { statMap } from "./goalieCalculations"; // Adjust path if needed
import { SortConfig } from "pages/trueGoalieValue";

// Type for the data rows this table displays (can be ranked games or ranked weeks)
type DisplayGoalie = GoalieBaseStats & {
  playerId: number;
  goalieFullName: string;
  team?: string;
  percentage?: number; // Optional: Comparison percentage (calculated in GoalieList/Leaderboard prep)
  ranking?: Ranking; // Optional: Ranking string ('Elite', etc.)
  // Add gameDate if displaying games
  gameDate?: Date | string;
  // Add derived stats if calculated upstream
  savesPer60?: number;
  shotsAgainstPer60?: number;
  fantasyPoints?: number; // Add fantasy points property
};

interface Props {
  goalies: DisplayGoalie[]; // Receives sorted goalies
  averages: GoalieAverages;
  selectedStats: NumericGoalieStatKey[];
  statColumns: StatColumn[];
  // setView: React.Dispatch<React.SetStateAction<"leaderboard" | "week">>; // Keep if needed
  startDate: string;
  endDate: string;
  isSingleWeek: boolean;
  onBackToLeaderboard?: () => void;
  // *** NEW: Add sort props ***
  requestSort: (key: keyof DisplayGoalie) => void;
  sortConfig: SortConfig<DisplayGoalie>;
}

const GoalieTable: FC<Props> = ({
  goalies,
  averages,
  selectedStats,
  statColumns,
  // setView,
  startDate,
  endDate,
  isSingleWeek,
  onBackToLeaderboard,
  // *** Destructure sort props ***
  requestSort,
  sortConfig
}) => {
  // Helper to determine CSS class based on comparison percentage (if available)
  const getPercentageClass = (percentage: number | undefined): string => {
    // ... (keep existing logic)
    const p = percentage ?? 0;
    if (p > 75) return styles.percentHigh; // Example thresholds
    if (p > 50) return styles.percentMedium;
    return styles.percentLow;
  };

  // Helper to determine CSS class for stat cells based on comparison to average
  const getStatComparisonClass = (
    goalieValue: number | undefined | string,
    avgValueStr: string | undefined,
    statKey: NumericGoalieStatKey,
    isStatSelected: boolean
  ): string => {
    // Don't highlight if stat not selected or data missing/invalid
    if (
      !isStatSelected ||
      goalieValue === undefined ||
      goalieValue === null ||
      avgValueStr === undefined
    ) {
      return "";
    }

    const numericGoalieValue =
      typeof goalieValue === "string" ? parseFloat(goalieValue) : goalieValue;
    const avgValue = parseFloat(avgValueStr);

    if (isNaN(numericGoalieValue) || isNaN(avgValue)) {
      return ""; // Cannot compare
    }

    // Use imported statMap
    const comparisonType = statMap[statKey];
    if (!comparisonType) return ""; // Stat not in map?

    // Apply classes based on comparison
    if (comparisonType === "larger" && numericGoalieValue >= avgValue)
      return styles.better;
    if (comparisonType === "smaller" && numericGoalieValue <= avgValue)
      return styles.better;

    return styles.worse;
  };

  // Helper to format stat values for display
  const formatStatValue = (
    value: any,
    statKey: NumericGoalieStatKey
  ): string | number => {
    if (value === null || value === undefined || value === "") return "N/A";

    if (typeof value === "number") {
      if (statKey === "savePct") return value.toFixed(3);
      if (
        statKey === "goalsAgainstAverage" ||
        statKey === "savesPer60" ||
        statKey === "shotsAgainstPer60"
      )
        return value.toFixed(2);
      if (Number.isInteger(value)) return value; // Display integers directly
      // Default for other numbers (e.g., TOI if it had decimals)
      return value.toFixed(1);
    }
    // If it's already a string or something else, return as is
    return String(value);
  };

  // *** NEW: Helper function for sort indicators ***
  const getSortIndicator = (key: keyof DisplayGoalie): string => {
    if (!sortConfig || sortConfig.key !== key) return ""; // Check if sortConfig exists
    return sortConfig.direction === "ascending" ? " ▲" : " ▼";
  };

  return (
    <>
      {/* Conditionally show Back button */}
      {/* CHANGE className for the button */}
      {isSingleWeek &&
        onBackToLeaderboard && ( // Check if handler exists
          <button
            className={styles.backButton} // Use the new button class
            onClick={onBackToLeaderboard}
          >
            Back to Leaderboard
          </button>
        )}

      {/* Use standard h2, remove specific class */}
      {/* Removed className={styles.tableHeader} */}
      <h2>
        {isSingleWeek ? "Weekly Game Stats" : "Goalie Leaderboard Details"} from{" "}
        {startDate} to {endDate}
      </h2>

      {/* Optional: Add scroll container if needed */}
      {/* <div className={styles.tableScrollContainer}> */}

      {/* CHANGE table class name */}
      <table className={styles.dataTable}>
        <thead>
          {/* Averages Row - uses .averageHeader, .averageCell which should exist */}
          <tr>
            <td colSpan={isSingleWeek ? 2 : 2} className={styles.averageHeader}>
              {isSingleWeek ? "Weekly Game Averages:" : "Range Averages:"}
            </td>
            {statColumns.map((statCol) => (
              <td key={`avg-${statCol.value}`} className={styles.averageCell}>
                {averages[statCol.value] ?? "N/A"}
              </td>
            ))}
            {/* Spacers for optional columns */}
            {goalies[0]?.fantasyPoints !== undefined && (
              <td className={styles.averageHeader}>Total fPts</td>
            )}
            {goalies[0]?.percentage !== undefined && (
              <td className={styles.averageHeader}></td>
            )}
            {goalies[0]?.ranking !== undefined && (
              <td className={styles.averageHeader}></td>
            )}
          </tr>
          {/* Header Row */}
          <tr>
            <th
              onClick={() =>
                requestSort(isSingleWeek ? "gameDate" : "goalieFullName")
              }
            >
              {isSingleWeek ? "Date" : "Name"}
              {getSortIndicator(isSingleWeek ? "gameDate" : "goalieFullName")}
            </th>
            <th
              onClick={() =>
                requestSort(isSingleWeek ? "goalieFullName" : "team")
              }
            >
              {isSingleWeek ? "Goalie" : "Team"}
              {getSortIndicator(isSingleWeek ? "goalieFullName" : "team")}
            </th>
            {statColumns.map((stat) => (
              // Use value for key, label for display
              <th
                key={`th-${stat.value}`}
                onClick={() => requestSort(stat.value)}
              >
                {stat.label}
                {getSortIndicator(stat.value)}
              </th>
            ))}
            {/* Conditionally show Fantasy Points header */}
            {goalies[0]?.fantasyPoints !== undefined && (
              <th onClick={() => requestSort("fantasyPoints")}>
                Total fPts
                {getSortIndicator("fantasyPoints")}
              </th>
            )}
            {/* Conditionally show Percentage/Ranking headers (add sorting if needed) */}
            {goalies[0]?.percentage !== undefined && (
              <th onClick={() => requestSort("percentage")}>
                % &gt; AVG
                {getSortIndicator("percentage")}
              </th>
            )}
            {goalies[0]?.ranking !== undefined && <th>Rank</th>}
          </tr>
        </thead>
        <tbody>
          {goalies.map(
            (
              goalie,
              index // Use index for key if gameDate+playerId isn't unique enough
            ) => (
              <tr
                key={`${goalie.playerId}-${
                  isSingleWeek ? goalie.gameDate?.toString() : ""
                }-${index}`}
              >
                <td>
                  {isSingleWeek
                    ? goalie.gameDate
                      ? new Date(goalie.gameDate).toLocaleDateString()
                      : "N/A"
                    : (goalie.goalieFullName ?? "N/A")}
                </td>
                <td>
                  {isSingleWeek
                    ? (goalie.goalieFullName ?? "N/A")
                    : (goalie.team ?? "N/A")}
                </td>
                {/* Map through defined stat columns to render cells */}
                {statColumns.map((statCol) => {
                  // Access the stat value dynamically using the key
                  const goalieStatValue =
                    goalie[statCol.value as keyof DisplayGoalie];
                  const isSelected = selectedStats.includes(statCol.value);

                  // Get comparison class
                  const cellClass = getStatComparisonClass(
                    goalieStatValue as number | string | undefined,
                    averages[statCol.value],
                    statCol.value,
                    isSelected
                  );
                  const combinedClassName = `${cellClass}`; // Add base td class if needed

                  return (
                    <td
                      key={`${goalie.playerId}-${statCol.value}-${index}`}
                      className={combinedClassName || undefined} // Apply class only if not empty
                    >
                      {formatStatValue(goalieStatValue, statCol.value)}
                    </td>
                  );
                })}
                {/* Fantasy Points cell */}
                {goalie.fantasyPoints !== undefined && (
                  <td>{goalie.fantasyPoints.toFixed(1)}</td>
                )}
                {/* Optional Percentage/Ranking cells */}
                {goalie.percentage !== undefined && (
                  <td className={getPercentageClass(goalie.percentage)}>
                    {goalie.percentage !== undefined
                      ? `${goalie.percentage.toFixed(1)}%`
                      : "N/A"}
                  </td>
                )}
                {goalie.ranking !== undefined && (
                  <td>{goalie.ranking ?? "N/A"}</td>
                )}
              </tr>
            )
          )}
        </tbody>
      </table>
      {/* </div> End optional tableScrollContainer */}
    </>
  );
};

export default GoalieTable;
