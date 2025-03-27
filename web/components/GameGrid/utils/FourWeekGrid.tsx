// components/GameGrid/FourWeekGrid.tsx

import React, { useMemo, useState } from "react";
import styles from "./FourWeekGrid.module.scss";
import Image from "next/legacy/image";
import { TeamDataWithTotals } from "lib/NHL/types";
import { useTeamsMap } from "hooks/useTeams";
import classNames from "classnames";
import { TeamWithScore } from "lib/NHL/types"; // Adjust the import path as necessary

type SortConfig = {
  key: "gamesPlayed" | "offNights" | "avgOpponentPointPct" | "score";
  direction: "ascending" | "descending";
};

type FourWeekGridProps = {
  teamDataArray: TeamDataWithTotals[];
};

/**
 * FourWeekGrid Component
 *
 * Displays a table listing all teams with their total games played, off nights, average opponent point percentage, and 4 WK Score.
 * Includes sortable columns and a sticky averages row.
 */
const FourWeekGrid: React.FC<FourWeekGridProps> = ({ teamDataArray }) => {
  const teamsMap = useTeamsMap();

  // Sorting state
  const [sortConfig, setSortConfig] = useState<SortConfig | null>(null);

  // Sorting handler
  const handleSort = (key: SortConfig["key"]) => {
    let direction: SortConfig["direction"] = "ascending";
    if (
      sortConfig &&
      sortConfig.key === key &&
      sortConfig.direction === "ascending"
    ) {
      direction = "descending";
    }
    setSortConfig({ key, direction });
  };

  // Calculate averages based on all teams
  const averages = useMemo(() => {
    const totalTeams = teamDataArray.length;
    const totalGP = teamDataArray.reduce(
      (acc, team) => acc + team.totals.gamesPlayed,
      0
    );
    const totalOFF = teamDataArray.reduce(
      (acc, team) => acc + team.totals.offNights,
      0
    );
    const totalOPP = teamDataArray.reduce(
      (acc, team) => acc + team.avgOpponentPointPct,
      0
    );
    return {
      gamesPlayed:
        totalTeams > 0 ? parseFloat((totalGP / totalTeams).toFixed(2)) : 0.0,
      offNights:
        totalTeams > 0 ? parseFloat((totalOFF / totalTeams).toFixed(2)) : 0.0,
      avgOpponentPointPct:
        totalTeams > 0 ? parseFloat((totalOPP / totalTeams).toFixed(4)) : 0.0
    };
  }, [teamDataArray]);

  // Calculate rounded averages
  const roundedAvgGP = useMemo(() => {
    const avg = averages.gamesPlayed;
    return Math.round(avg / 1) * 1; // Scaling by 1 for "GP"
  }, [averages.gamesPlayed]);

  const roundedAvgOFF = useMemo(() => {
    const avg = averages.offNights;
    return Math.round(avg / 1) * 1; // Scaling by 1 for "OFF"
  }, [averages.offNights]);

  // Calculate scores and map to TeamWithScore
  const teamsWithScore: TeamWithScore[] = useMemo(() => {
    return teamDataArray.map((team) => ({
      ...team,
      score:
        team.totals.gamesPlayed -
        averages.gamesPlayed +
        (team.totals.offNights - averages.offNights) +
        (averages.avgOpponentPointPct - team.avgOpponentPointPct)
    }));
  }, [teamDataArray, averages]);

  // Sort teams based on sortConfig
  const sortedTeams = useMemo(() => {
    let sortableTeams = [...teamsWithScore];
    if (sortConfig !== null) {
      sortableTeams.sort((a, b) => {
        let aValue: number;
        let bValue: number;

        if (sortConfig.key === "avgOpponentPointPct") {
          aValue = a.avgOpponentPointPct;
          bValue = b.avgOpponentPointPct;
        } else if (sortConfig.key === "score") {
          aValue = a.score;
          bValue = b.score;
        } else {
          aValue = a.totals[sortConfig.key];
          bValue = b.totals[sortConfig.key];
        }

        if (aValue < bValue) {
          return sortConfig.direction === "ascending" ? -1 : 1;
        }
        if (aValue > bValue) {
          return sortConfig.direction === "ascending" ? 1 : -1;
        }
        return 0;
      });
    } else {
      // Default sort: Alphabetical by team name
      sortableTeams.sort((a, b) => {
        const nameA = teamsMap[a.teamId]?.name.toUpperCase() || "";
        const nameB = teamsMap[b.teamId]?.name.toUpperCase() || "";
        if (nameA < nameB) return -1;
        if (nameA > nameB) return 1;
        return 0;
      });
    }
    return sortableTeams;
  }, [teamsWithScore, sortConfig, teamsMap]);

  // Determine unique GP values below the rounded average, sorted ascending
  const belowAvgGPValues = useMemo(() => {
    const uniqueGPs = Array.from(
      new Set(
        sortedTeams
          .map((team) => team.totals.gamesPlayed)
          .filter((gp) => gp < roundedAvgGP)
      )
    ).sort((a, b) => a - b); // Ascending order
    return uniqueGPs;
  }, [sortedTeams, roundedAvgGP]);

  // Determine unique OFF values below the rounded average, sorted ascending
  const belowAvgOFFValues = useMemo(() => {
    const uniqueOFFs = Array.from(
      new Set(
        sortedTeams
          .map((team) => team.totals.offNights)
          .filter((off) => off < roundedAvgOFF)
      )
    ).sort((a, b) => a - b); // Ascending order
    return uniqueOFFs;
  }, [sortedTeams, roundedAvgOFF]);

  // Map GP values to color classes based on their rank (lowest GP -> red)
  const gpColorMap = useMemo(() => {
    const colorClasses = ["red", "orange", "yellow"]; // Define up to three colors
    const map: Record<number, string> = {};
    belowAvgGPValues.forEach((gp, index) => {
      const color = colorClasses[index] || "grey"; // Default to grey if more GP values than colors
      map[gp] = color;
    });
    return map;
  }, [belowAvgGPValues]);

  // Map OFF values to color classes based on their rank (lowest OFF -> red)
  const offColorMap = useMemo(() => {
    const colorClasses = ["red", "orange", "yellow"]; // Define up to three colors
    const map: Record<number, string> = {};
    belowAvgOFFValues.forEach((off, index) => {
      const color = colorClasses[index] || "grey"; // Default to grey if more OFF values than colors
      map[off] = color;
    });
    return map;
  }, [belowAvgOFFValues]);

  // Determine unique OPP (%) values above average, sorted ascending
  const aboveAvgOPPValues = useMemo(() => {
    const uniqueOPPs = Array.from(
      new Set(
        sortedTeams
          .map((team) => team.avgOpponentPointPct)
          .filter((opp) => opp > averages.avgOpponentPointPct)
      )
    ).sort((a, b) => a - b); // Ascending order
    return uniqueOPPs;
  }, [sortedTeams, averages.avgOpponentPointPct]);

  // Map OPP (%) values above average to color classes
  const oppColorMap = useMemo(() => {
    const colorClasses = ["yellow", "orange", "red"]; // Define up to three colors
    const map: Record<number, string> = {};
    aboveAvgOPPValues.forEach((opp, index) => {
      const color = colorClasses[index] || "grey"; // Default to grey if more OPP values than colors
      map[opp] = color;
    });
    return map;
  }, [aboveAvgOPPValues]);

  return (
    <div className={styles.fourWeekGridContainer}>
      <table className={styles.fourWeekGridTable}>
        <thead>
          {/* New top header row */}
          <tr>
            <th colSpan={5} className={styles.topHeader}>
              <span className={styles.topHeaderWhite}>FOUR WEEK </span>
              <span className={styles.topHeaderBlue}>FORECAST</span>
            </th>
          </tr>
          <tr>
            <th>Team</th>
            <th>
              <button
                type="button"
                onClick={() => handleSort("gamesPlayed")}
                className={styles.sortButton}
                aria-label={`Sort by Games Played ${
                  sortConfig?.key === "gamesPlayed" &&
                  sortConfig.direction === "ascending"
                    ? "descending"
                    : "ascending"
                }`}
              >
                GP
                {sortConfig?.key === "gamesPlayed" &&
                  (sortConfig.direction === "ascending" ? " ▲" : " ▼")}
              </button>
            </th>
            <th>
              <button
                type="button"
                onClick={() => handleSort("offNights")}
                className={styles.sortButton}
                aria-label={`Sort by OFF ${
                  sortConfig?.key === "offNights" &&
                  sortConfig.direction === "ascending"
                    ? "descending"
                    : "ascending"
                }`}
              >
                OFF
                {sortConfig?.key === "offNights" &&
                  (sortConfig.direction === "ascending" ? " ▲" : " ▼")}
              </button>
            </th>
            <th>
              <button
                type="button"
                onClick={() => handleSort("avgOpponentPointPct")}
                className={styles.sortButton}
                aria-label={`Sort by Opponent Pct ${
                  sortConfig?.key === "avgOpponentPointPct" &&
                  sortConfig.direction === "ascending"
                    ? "descending"
                    : "ascending"
                }`}
              >
                OPP (%)
                {sortConfig?.key === "avgOpponentPointPct" &&
                  (sortConfig.direction === "ascending" ? " ▲" : " ▼")}
              </button>
            </th>
            <th>
              <button
                type="button"
                onClick={() => handleSort("score")}
                className={styles.sortButton}
                aria-label={`Sort by 4 WK Score ${
                  sortConfig?.key === "score" &&
                  sortConfig.direction === "ascending"
                    ? "descending"
                    : "ascending"
                }`}
              >
                4 WK Score
                {sortConfig?.key === "score" &&
                  (sortConfig.direction === "ascending" ? " ▲" : " ▼")}
              </button>
            </th>
          </tr>
        </thead>
        <tbody>
          {/* AVG Row */}
          <tr className={classNames(styles.averagesRow, styles.stickyRow)}>
            <td>AVG:</td>
            <td>{averages.gamesPlayed.toFixed(2)}</td>
            <td>{averages.offNights.toFixed(2)}</td>
            <td>{(averages.avgOpponentPointPct * 100).toFixed(1)}%</td>
            <td>0.00</td> {/* The average score is 0 */}
          </tr>

          {/* Data Rows */}
          {sortedTeams.map((team) => {
            const teamInfo = teamsMap[team.teamId];
            if (!teamInfo) {
              console.warn(`Team data not found for teamId: ${team.teamId}`);
              return null;
            }

            const gp = team.totals.gamesPlayed;
            const off = team.totals.offNights;
            const oppPct = team.avgOpponentPointPct;
            const score = team.score;

            // Determine color classes for GP
            const isGPAbove = gp > roundedAvgGP;
            const isGPBelow = gp < roundedAvgGP;

            // Determine color classes for OFF
            const isOFFAbove = off > roundedAvgOFF;
            const isOFFBelow = off < roundedAvgOFF;

            // Determine color classes for OPP (%)
            const isOPPBelow = oppPct < averages.avgOpponentPointPct;
            const isOPPAbove = oppPct > averages.avgOpponentPointPct;

            // Determine color classes
            const gpClass = classNames({
              [styles.red]: isGPBelow && gpColorMap[gp] === "red",
              [styles.orange]: isGPBelow && gpColorMap[gp] === "orange",
              [styles.yellow]: isGPBelow && gpColorMap[gp] === "yellow",
              [styles.green]: isGPAbove
            });

            const offClass = classNames({
              [styles.red]: isOFFBelow && offColorMap[off] === "red",
              [styles.orange]: isOFFBelow && offColorMap[off] === "orange",
              [styles.yellow]: isOFFBelow && offColorMap[off] === "yellow",
              [styles.green]: isOFFAbove
            });

            const oppClass = classNames({
              [styles.yellow]: isOPPAbove && oppColorMap[oppPct] === "yellow",
              [styles.orange]: isOPPAbove && oppColorMap[oppPct] === "orange",
              [styles.red]: isOPPAbove && oppColorMap[oppPct] === "red",
              [styles.green]: isOPPBelow
            });

            // Determine color class for Score
            // Optional: You can implement color coding for the score as well
            // For now, we'll keep it without color coding
            const scoreClass = classNames({
              // Example:
              // [styles.positive]: score > 0,
              // [styles.negative]: score < 0,
            });

            return (
              <tr key={team.teamId}>
                <td className={styles.teamCell}>
                  <div className={styles.teamInfo}>
                    <Image
                      src={teamInfo.logo}
                      alt={`${teamInfo.name} logo`}
                      objectFit="contain"
                      width={35}
                      height={35}
                      className={styles.teamLogo}
                    />
                  </div>
                </td>
                <td className={gpClass}>{gp}</td>
                <td className={offClass}>{off}</td>
                <td className={oppClass}>{(oppPct * 100).toFixed(1)}%</td>
                <td className={scoreClass}>{score.toFixed(2)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

export default FourWeekGrid;
