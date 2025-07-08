// web/components/GoaliePage/GoalieLeaderboard.tsx

import React, { FC } from "react";
import styles from "styles/Goalies.module.scss";
// Import updated types
import type {
  GoalieRanking,
  Ranking,
  StatColumn,
  NumericGoalieStatKey
} from "components/GoaliePage/goalieTypes";
// Adjust path if SortConfig is defined elsewhere, e.g., in trueGoalieValue.tsx
import { SortConfig } from "pages/trueGoalieValue";

interface Props {
  goalieRankings: GoalieRanking[];
  // setView can likely be removed if only used for back button previously
  setView: React.Dispatch<React.SetStateAction<"leaderboard" | "week">>;
  statColumns: StatColumn[]; // Receive stat columns for percentile headers
  sortConfig?: SortConfig<GoalieRanking>; // Optional sort config
  requestSort: (key: keyof GoalieRanking) => void; // Function to request sorting
}

// *** DEFINE COLUMN WIDTHS HERE ***
// Adjust these percentages as needed. Try to keep the total around 100%.
const columnWidths: { [label: string]: string } = {
  Rank: "4%",
  Name: "10%", // Wider for names
  Team: "5%",
  "Rank Pts": "5%", // Added WoW Pts mapping
  "Elite Wk": "5%",
  Quality: "5%", // Renamed from Quality Wk if needed to match label
  AVG: "5%", // Renamed from Av Wk if needed
  BAD: "5%", // Renamed from Bd Wk if needed
  "Really Bad": "5%", // Renamed from RB Wk if needed
  "% OK WKs": "5%",
  "% Good WKs": "5%",
  "Week Over Week Variance": "6%", // Adjusted label from WoW Var
  "Game Over Game Variance": "6%", // Adjusted label from GoG Var
  "Avg fPts/G": "5%",
  "Total fPts": "5%", // Added total fantasy points column
  "+/- Lg Avg fPts": "5%",
  "Percentile Rank": "5%", // Adjusted label from Avg %ile
  GP: "4%",
  "SV%": "5%",
  GAA: "5%"
};
// Current Total: 4+10+5+5+5+5+5+5

const GoalieLeaderboard: FC<Props> = ({
  goalieRankings,
  setView,
  statColumns,
  requestSort, // Destructure new props
  sortConfig
}) => {
  if (!goalieRankings || goalieRankings.length === 0) {
    return (
      <p className={styles.standoutNote}>
        No rankings available. Select a date range, ensure data is fetched, and
        check fantasy settings.
      </p>
    );
  }

  // Function to determine percentage class (unchanged)
  const getPercentageClass = (percentage: number | undefined): string => {
    const p = percentage ?? 0;
    if (p >= 65) return styles.percentHigh;
    if (p >= 50) return styles.percentMedium;
    return styles.percentLow;
  };

  // Helper to safely access week counts (unchanged)
  const getWeekCount = (goalie: GoalieRanking, rank: Ranking): number => {
    return goalie?.weekCounts?.[rank] ?? 0;
  };

  // Get stat keys that have percentiles calculated (based on calculation logic)
  const percentileKeys = statColumns
    .map((c) => c.value)
    .filter(
      (key) =>
        goalieRankings[0]?.percentiles && // Check if percentiles exist on first goalie
        goalieRankings[0].percentiles[key] !== undefined
    ) as NumericGoalieStatKey[];

  // Helper function to get sort indicator
  const getSortIndicator = (key: keyof GoalieRanking): string => {
    if (!sortConfig || sortConfig.key !== key) {
      return ""; // Not sorted by this column or no sort config
    }
    return sortConfig.direction === "ascending" ? " ▲" : " ▼";
  };

  // Helper to map column labels to GoalieRanking keys (adjust mappings as needed)
  const columnToSortKeyMap: { [label: string]: keyof GoalieRanking | null } = {
    Rank: null,
    Name: "goalieFullName",
    Team: "team",
    "WoW Pts": "totalPoints", // Added mapping
    "Elite Wk": null, // Cannot sort easily
    Quality: null, // Cannot sort easily
    AVG: null, // Cannot sort easily
    BAD: null, // Cannot sort easily
    "Really Bad": null, // Cannot sort easily
    "% OK WKs": "percentAcceptableWeeks",
    "% Good WKs": "percentGoodWeeks",
    "Week Over Week Variance": "wowVariance", // Adjusted label
    "Game Over Game Variance": "gogVariance", // Adjusted label
    "Avg fPts/G": "averageFantasyPointsPerGame",
    "Total fPts": "totalGamesPlayed", // Use totalGamesPlayed as proxy for custom sort
    "+/- Lg Avg fPts": null, // Cannot sort easily
    "Percentile Rank": "averagePercentileRank", // Adjusted label
    GP: "totalGamesPlayed",
    "SV%": "overallSavePct",
    GAA: "overallGaa"
  };

  // Define the exact order and labels for headers
  const headerLabels = [
    "Rank",
    "Name",
    "Team",
    "WoW Pts", // Added WoW Pts
    "Elite Wk",
    "Quality",
    "AVG",
    "BAD",
    "Really Bad",
    "% OK WKs",
    "% Good WKs",
    "Week Over Week Variance", // Use full label
    "Game Over Game Variance", // Use full label
    "Avg fPts/G",
    "Total fPts", // Added Total fPts
    "+/- Lg Avg fPts",
    "Percentile Rank", // Use full label
    "GP",
    "SV%",
    "GAA"
  ];

  return (
    <>
      {/* Use standard h2, adjust styling via CSS if needed */}
      <h2 className={styles.goalieRankingLeaderboardHeader}>
        Goalie Ranking Leaderboard
      </h2>
      <table className={styles.dataTable}>
        <thead>
          <tr>
            {/* Iterate over the defined headerLabels array */}
            {headerLabels.map((label) => {
              const sortKey = columnToSortKeyMap[label];
              const isSortable = sortKey !== null;
              // Get the width from the map, default to 'auto' if not found
              const width = columnWidths[label] || "auto";

              return (
                <th
                  key={label}
                  className={isSortable ? styles.sortableHeader : ""}
                  onClick={isSortable ? () => requestSort(sortKey) : undefined}
                  // *** APPLY INLINE STYLE FOR WIDTH ***
                  style={{ width: width }}
                >
                  {label}
                  {/* Add info icons conditionally based on label */}
                  {label === "Week Over Week Variance" && (
                    <span
                      className={styles.infoIcon}
                      title="Week-over-Week Ranking Variance (StdDev of Weekly Points vs League Avg)"
                    >
                      &#9432;
                    </span>
                  )}
                  {label === "Game Over Game Variance" && (
                    <span
                      className={styles.infoIcon}
                      title="Game-over-Game Fantasy Point Variance (StdDev of Game fPts)"
                    >
                      &#9432;
                    </span>
                  )}
                  {label === "Avg fPts/G" && (
                    <span
                      className={styles.infoIcon}
                      title="Average Fantasy Points Scored Per Game Played"
                    >
                      &#9432;
                    </span>
                  )}
                  {label === "+/- Lg Avg fPts" && (
                    <span
                      className={styles.infoIcon}
                      title="Goalie Avg fPts/G vs League Avg fPts/G for the period"
                    >
                      &#9432;
                    </span>
                  )}
                  {label === "Percentile Rank" && (
                    <span
                      className={styles.infoIcon}
                      title="Average Percentile Rank across key statistics"
                    >
                      &#9432;
                    </span>
                  )}
                  {/* Sort Indicator */}
                  {isSortable && (
                    <span className={styles.sortIndicator}>
                      {getSortIndicator(sortKey)}
                    </span>
                  )}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {/* Map over rankings - IMPORTANT: Ensure the order of TDs matches the headerLabels array */}
          {goalieRankings.map((goalie, index) => {
            // Calculate fPts difference from league average
            const fPtsDiff =
              goalie.leagueAverageFantasyPointsPerGame !== undefined
                ? goalie.averageFantasyPointsPerGame -
                  goalie.leagueAverageFantasyPointsPerGame
                : undefined;

            return (
              <tr key={`${goalie.playerId}-${index}`}>
                {/* Make sure TD order matches headerLabels */}
                <td>{index + 1}</td> {/* Rank */}
                <td>{goalie.goalieFullName ?? "N/A"}</td> {/* Name */}
                <td>{goalie.team ?? "N/A"}</td> {/* Team */}
                <td>{goalie.totalPoints ?? 0}</td> {/* WoW Pts */}
                <td>{getWeekCount(goalie, "Elite")}</td> {/* Elite Wk */}
                <td>{getWeekCount(goalie, "Quality")}</td> {/* Quality */}
                <td>{getWeekCount(goalie, "Average")}</td> {/* AVG */}
                <td>{getWeekCount(goalie, "Bad")}</td> {/* BAD */}
                <td>{getWeekCount(goalie, "Really Bad")}</td> {/* Really Bad */}
                <td
                  className={getPercentageClass(goalie.percentAcceptableWeeks)}
                >
                  {" "}
                  {/* % OK WKs */}
                  {(goalie.percentAcceptableWeeks ?? 0).toFixed(1)}%
                </td>
                <td className={getPercentageClass(goalie.percentGoodWeeks)}>
                  {" "}
                  {/* % Good WKs */}
                  {(goalie.percentGoodWeeks ?? 0).toFixed(1)}%
                </td>
                <td>{goalie.wowVariance?.toFixed(2) ?? "N/A"}</td>{" "}
                {/* Week Over Week Variance */}
                <td>{goalie.gogVariance?.toFixed(2) ?? "N/A"}</td>{" "}
                {/* Game Over Game Variance */}
                <td>
                  {goalie.averageFantasyPointsPerGame?.toFixed(2) ?? "N/A"}
                </td>
                {/* Avg fPts/G */}
                <td>
                  {(
                    goalie.averageFantasyPointsPerGame * goalie.totalGamesPlayed
                  )?.toFixed(1) ?? "N/A"}
                </td>
                {/* Total fPts */}
                <td>
                  {" "}
                  {/* +/- Lg Avg fPts */}
                  {fPtsDiff !== undefined
                    ? `${fPtsDiff >= 0 ? "+" : ""}${fPtsDiff.toFixed(2)}`
                    : "N/A"}
                </td>
                <td
                  className={getPercentageClass(goalie.averagePercentileRank)}
                >
                  {" "}
                  {/* Percentile Rank */}
                  {goalie.averagePercentileRank?.toFixed(1) ?? "N/A"}%
                </td>
                <td>{goalie.totalGamesPlayed ?? "N/A"}</td> {/* GP */}
                <td>{goalie.overallSavePct?.toFixed(3) ?? "N/A"}</td>{" "}
                {/* SV% */}
                <td>{goalie.overallGaa?.toFixed(2) ?? "N/A"}</td> {/* GAA */}
              </tr>
            );
          })}
        </tbody>
      </table>

      <p className={styles.varianceNote}>
        Lower Variance (WoW Var, GoG Var) indicates more consistent performance.
        Avg %ile shows overall statistical rank vs peers (higher is better).
        Fantasy Points (fPts) calculated based on settings.
      </p>
    </>
  );
};

export default GoalieLeaderboard;
