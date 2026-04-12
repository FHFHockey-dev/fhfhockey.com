// web/components/GoaliePage/GoalieLeaderboard.tsx

import React, { FC } from "react";
import styles from "styles/Goalies.module.scss";
// Import updated types
import type {
  GoalieRanking,
  Ranking,
  SortConfig
} from "components/GoaliePage/goalieTypes";
import {
  buildGoalieVarianceAverages,
  formatGoalieVarianceValue,
  getGoalieLeaderboardColumns
} from "./goalieMetrics";

interface Props {
  goalieRankings: GoalieRanking[];
  sortConfig?: SortConfig<GoalieRanking>;
  requestSort?: (key: keyof GoalieRanking) => void;
  varianceDisplayMode?: "raw" | "relative";
}

const GoalieLeaderboard: FC<Props> = ({
  goalieRankings,
  requestSort,
  sortConfig,
  varianceDisplayMode = "raw"
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
    if (p >= 75) return styles.percentHigh;
    if (p >= 50) return styles.percentMedium;
    return styles.percentLow;
  };

  const columns = React.useMemo(
    () => getGoalieLeaderboardColumns(varianceDisplayMode),
    [varianceDisplayMode]
  );
  const varianceAverages = React.useMemo(
    () => buildGoalieVarianceAverages(goalieRankings),
    [goalieRankings]
  );

  const getValueTierClass = (tier: string | undefined) => {
    switch (tier) {
      case "Tier 1":
        return styles.valueTierTier1;
      case "Tier 2":
        return styles.valueTierTier2;
      case "Tier 3":
        return styles.valueTierTier3;
      case "Tier 4":
        return styles.valueTierTier4;
      default:
        return styles.valueTierTier5;
    }
  };

  // Helper to safely access week counts (unchanged)
  const getWeekCount = (goalie: GoalieRanking, rank: Ranking): number => {
    const legacyRankMap: Record<Ranking, string> = {
      Elite: "Elite Week",
      Quality: "Quality Week",
      Average: "Week",
      Bad: "Bad Week",
      "Really Bad": "Really Bad Week"
    };

    return (
      goalie?.weekCounts?.[rank] ??
      goalie?.weekCounts?.[legacyRankMap[rank] as Ranking] ??
      0
    );
  };

  // Helper function to get sort indicator
  const getSortIndicator = (key: keyof GoalieRanking): string => {
    if (!sortConfig || sortConfig.key !== key) {
      return ""; // Not sorted by this column or no sort config
    }
    return sortConfig.direction === "ascending" ? " ▲" : " ▼";
  };

  return (
    <>
      {/* Use standard h2, adjust styling via CSS if needed */}
      <h2 className={styles.goalieRankingLeaderboardHeader}>
        Goalie Ranking Leaderboard
      </h2>
      <table className={styles.dataTable}>
        <thead>
          <tr>
            {columns.map((column) => {
              const { label, sortKey, width, infoTitle } = column;
              const isSortable = typeof requestSort === "function";

              return (
                <th
                  key={label}
                  className={isSortable ? styles.sortableHeader : ""}
                  onClick={isSortable ? () => requestSort(sortKey) : undefined}
                  style={{ width: width }}
                >
                  {label}
                  {infoTitle && (
                    <span
                      className={styles.infoIcon}
                      title={infoTitle}
                    >
                      &#9432;
                    </span>
                  )}
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
                <td>
                  {(() => {
                    return goalie.valueTier && goalie.valueTierScore != null ? (
                      <span
                        className={`${styles.valueTierPill} ${getValueTierClass(
                          goalie.valueTier
                        )}`}
                        title={`Filtered-population value score ${goalie.valueTierScore.toFixed(
                          1
                        )}`}
                      >
                        {goalie.valueTier}
                      </span>
                    ) : (
                      "N/A"
                    );
                  })()}
                </td>
                <td>{goalie.totalPoints ?? 0}</td> {/* WoW Pts */}
                <td>{getWeekCount(goalie, "Elite")}</td> {/* Elite Wk */}
                <td>{getWeekCount(goalie, "Quality")}</td> {/* Quality */}
                <td>{getWeekCount(goalie, "Average")}</td> {/* AVG */}
                <td>{getWeekCount(goalie, "Bad")}</td> {/* BAD */}
                <td>{getWeekCount(goalie, "Really Bad")}</td> {/* Really Bad */}
                <td
                  className={getPercentageClass(goalie.percentAcceptableWeeks)}
                >
                  {(goalie.percentAcceptableWeeks ?? 0).toFixed(1)}%
                </td>
                <td className={getPercentageClass(goalie.percentGoodWeeks)}>
                  {(goalie.percentGoodWeeks ?? 0).toFixed(1)}%
                </td>
                <td>
                  {formatGoalieVarianceValue(
                    goalie.wowVariance,
                    varianceAverages.wowVariance,
                    varianceDisplayMode
                  )}
                </td>
                <td>
                  {formatGoalieVarianceValue(
                    goalie.gogVariance,
                    varianceAverages.gogVariance,
                    varianceDisplayMode
                  )}
                </td>
                <td>
                  {goalie.averageFantasyPointsPerGame?.toFixed(2) ?? "N/A"}
                </td>
                <td>
                  {fPtsDiff !== undefined
                    ? `${fPtsDiff >= 0 ? "+" : ""}${fPtsDiff.toFixed(2)}`
                    : "N/A"}
                </td>
                <td
                  className={getPercentageClass(goalie.averagePercentileRank)}
                >
                  {goalie.averagePercentileRank?.toFixed(1) ?? "N/A"}%
                </td>
                <td>{goalie.totalGamesPlayed ?? "N/A"}</td> {/* GP */}
                <td>{goalie.overallSavePct?.toFixed(3) ?? "N/A"}</td>
                <td>{goalie.overallGaa?.toFixed(2) ?? "N/A"}</td> {/* GAA */}
              </tr>
            );
          })}
        </tbody>
      </table>

      <p className={styles.varianceNote}>
        Lower standard deviation indicates more consistent performance.
        Avg %ile shows overall statistical rank vs peers (higher is better).
        Relative mode shows the delta versus the filtered average.
        Fantasy Points (fPts) calculated based on settings.
      </p>
    </>
  );
};

export default GoalieLeaderboard;
