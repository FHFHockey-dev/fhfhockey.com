// components/GameGrid/FourWeekGrid.tsx

import React, { useMemo, useState, useEffect } from "react"; // Added useEffect
import styles from "./FourWeekGrid.module.scss";
import Image from "next/image"; // Use next/image instead of legacy
import { TeamDataWithTotals, TeamWithScore } from "lib/NHL/types"; // Consolidate type imports
import { useTeamsMap } from "hooks/useTeams";
import classNames from "classnames"; // Use classnames (or clsx)
import clsx from "clsx";

// --- useIsMobile hook ---
function useIsMobile() {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined") return;
    function handleResize() {
      setIsMobile(window.innerWidth < 768);
    }
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);
  return isMobile;
}

// --- Component Props and Types ---
type FourWeekGridProps = {
  teamDataArray: TeamDataWithTotals[];
};
type SortConfig = {
  key:
    | "gamesPlayed"
    | "offNights"
    | "avgOpponentPointPct"
    | "score"
    | "teamName"; // Added teamName
  direction: "ascending" | "descending";
};
type Averages = {
  gamesPlayed: number;
  offNights: number;
  avgOpponentPointPct: number;
};

const FourWeekGrid: React.FC<FourWeekGridProps> = ({ teamDataArray }) => {
  const teamsMap = useTeamsMap();
  const isMobile = useIsMobile();
  const [isMobileMinimized, setIsMobileMinimized] = useState(false);
  const [sortConfig, setSortConfig] = useState<SortConfig | null>(null); // Default sort removed, will apply in useMemo

  // --- Handlers ---
  const toggleMobileMinimize = () => {
    if (isMobile) {
      setIsMobileMinimized((prev) => !prev);
    }
  };
  const handleSort = (key: SortConfig["key"]) => {
    let direction: SortConfig["direction"] = "ascending";
    if (
      sortConfig &&
      sortConfig.key === key &&
      sortConfig.direction === "ascending"
    ) {
      direction = "descending";
    }
    // If sorting by team name, default to ascending first time
    if (key === "teamName" && (!sortConfig || sortConfig.key !== "teamName")) {
      direction = "ascending";
    } else if (key !== "teamName" && (!sortConfig || sortConfig.key !== key)) {
      // For numeric columns, default to descending first time
      direction = "descending";
    }
    setSortConfig({ key, direction });
  };

  // --- Memoized Calculations ---
  const averages = useMemo((): Averages => {
    if (!teamDataArray || teamDataArray.length === 0) {
      return { gamesPlayed: 0, offNights: 0, avgOpponentPointPct: 0 };
    }
    const totalTeams = teamDataArray.length;
    const totalGP = teamDataArray.reduce(
      (acc, team) => acc + (team.totals?.gamesPlayed ?? 0),
      0
    );
    const totalOFF = teamDataArray.reduce(
      (acc, team) => acc + (team.totals?.offNights ?? 0),
      0
    );
    const totalOPP = teamDataArray.reduce(
      (acc, team) => acc + (team.avgOpponentPointPct ?? 0),
      0
    );
    return {
      gamesPlayed: totalTeams > 0 ? totalGP / totalTeams : 0,
      offNights: totalTeams > 0 ? totalOFF / totalTeams : 0,
      avgOpponentPointPct: totalTeams > 0 ? totalOPP / totalTeams : 0
    };
  }, [teamDataArray]);

  const roundedAvgGP = useMemo(
    () => Math.round(averages.gamesPlayed),
    [averages.gamesPlayed]
  );
  const roundedAvgOFF = useMemo(
    () => Math.round(averages.offNights),
    [averages.offNights]
  );

  const teamsWithScore: TeamWithScore[] = useMemo(() => {
    if (!teamDataArray) return [];
    return teamDataArray.map((team) => {
      const gp = team.totals?.gamesPlayed ?? averages.gamesPlayed; // Use average if null
      const offNights = team.totals?.offNights ?? averages.offNights; // Use average if null
      const avgOppPct =
        team.avgOpponentPointPct ?? averages.avgOpponentPointPct; // Use average if null

      // Calculate score relative to averages
      const score =
        gp -
        averages.gamesPlayed +
        (offNights - averages.offNights) +
        (averages.avgOpponentPointPct - avgOppPct); // Higher OPP% is bad, so subtract from average

      return { ...team, score };
    });
  }, [teamDataArray, averages]);

  const sortedTeams = useMemo(() => {
    let sortableTeams = [...teamsWithScore];
    const currentSortKey = sortConfig?.key;
    const currentDirection = sortConfig?.direction;

    sortableTeams.sort((a, b) => {
      let aValue: number | string;
      let bValue: number | string;

      // Get values based on sort key
      switch (currentSortKey) {
        case "gamesPlayed":
          aValue = a.totals?.gamesPlayed ?? -Infinity; // Push nulls down
          bValue = b.totals?.gamesPlayed ?? -Infinity;
          break;
        case "offNights":
          aValue = a.totals?.offNights ?? -Infinity;
          bValue = b.totals?.offNights ?? -Infinity;
          break;
        case "avgOpponentPointPct":
          aValue = a.avgOpponentPointPct ?? Infinity; // Push nulls down (higher % is worse)
          bValue = b.avgOpponentPointPct ?? Infinity;
          break;
        case "score":
          aValue = a.score ?? -Infinity;
          bValue = b.score ?? -Infinity;
          break;
        case "teamName":
          aValue = teamsMap[a.teamId]?.name.toLowerCase() || "";
          bValue = teamsMap[b.teamId]?.name.toLowerCase() || "";
          break;
        default: // Default alphabetical sort if no sortConfig
          aValue = teamsMap[a.teamId]?.name.toLowerCase() || "";
          bValue = teamsMap[b.teamId]?.name.toLowerCase() || "";
          // Force ascending for default alphabetical
          if (aValue < bValue) return -1;
          if (aValue > bValue) return 1;
          return 0;
      }

      // Comparison logic
      if (aValue < bValue) return currentDirection === "ascending" ? -1 : 1;
      if (aValue > bValue) return currentDirection === "ascending" ? 1 : -1;
      return 0;
    });

    return sortableTeams;
  }, [teamsWithScore, sortConfig, teamsMap]);

  // --- Color Mapping Logic (remains largely the same) ---
  const belowAvgGPValues = useMemo(() => {
    /* ... */
  }, [sortedTeams, roundedAvgGP]);
  const belowAvgOFFValues = useMemo(() => {
    /* ... */
  }, [sortedTeams, roundedAvgOFF]);
  const aboveAvgOPPValues = useMemo(() => {
    /* ... */
  }, [sortedTeams, averages.avgOpponentPointPct]);
  const gpColorMap = useMemo(() => {
    const map: { [key: number]: string } = {};
    return map;
  }, [belowAvgGPValues]);
  const offColorMap = useMemo(() => {
    const map: { [key: number]: string } = {};
    return map;
  }, [belowAvgOFFValues]);
  const oppColorMap = useMemo(() => {
    const map: { [key: number]: string } = {};
    return map;
  }, [aboveAvgOPPValues]);

  // --- Render ---
  const handleTitleClick = isMobile ? toggleMobileMinimize : undefined;
  const isLoading =
    !teamsMap ||
    Object.keys(teamsMap).length === 0 ||
    teamDataArray.length === 0; // More robust loading check
  const hasData = !isLoading && sortedTeams.length > 0;

  return (
    <div
      className={clsx(
        styles.container,
        isMobile && isMobileMinimized && styles.minimized
      )}
    >
      {/* Clickable Title Header */}
      <div
        className={styles.titleHeader}
        onClick={handleTitleClick}
        role={isMobile ? "button" : undefined}
        tabIndex={isMobile ? 0 : undefined}
        aria-expanded={isMobile ? !isMobileMinimized : undefined}
        aria-controls={isMobile ? "four-week-grid-content" : undefined}
      >
        <span className={styles.titleText}>
          {" "}
          FOUR WEEK <span className={styles.spanColorBlue}>FORECAST</span>{" "}
        </span>
        {isMobile && (
          <span
            className={clsx(
              styles.minimizeToggleIcon,
              isMobileMinimized && styles.minimized
            )}
            aria-hidden="true"
          >
            {" "}
            ▼{" "}
          </span>
        )}
      </div>

      {/* Collapsible Content Wrapper */}
      <div id="four-week-grid-content" className={styles.tableWrapper}>
        {isLoading ? (
          <div className={styles.message}>Loading schedule data...</div>
        ) : !hasData ? (
          <div className={styles.message}>No schedule data available.</div>
        ) : (
          // REMOVED Scroll Container Div - Table directly inside wrapper
          <table className={styles.table}>
            <thead>
              <tr>
                {/* Team Header - Make it sortable too */}
                <th>
                  <button
                    type="button"
                    onClick={() => handleSort("teamName")}
                    className={styles.sortButton}
                    aria-label={`Sort by Team Name ${
                      sortConfig?.key === "teamName" &&
                      sortConfig.direction === "ascending"
                        ? "descending"
                        : "ascending"
                    }`}
                  >
                    Team{" "}
                    {sortConfig?.key === "teamName" &&
                      (sortConfig.direction === "ascending" ? " ▲" : " ▼")}
                  </button>
                </th>
                <th>
                  <button
                    type="button"
                    onClick={() => handleSort("gamesPlayed")}
                    className={styles.sortButton}
                    aria-label={`Sort by Games Played ${
                      sortConfig?.key === "gamesPlayed" &&
                      sortConfig.direction === "descending"
                        ? "ascending"
                        : "descending"
                    }`}
                  >
                    GP{" "}
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
                      sortConfig.direction === "descending"
                        ? "ascending"
                        : "descending"
                    }`}
                  >
                    OFF{" "}
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
                      sortConfig.direction === "descending"
                        ? "ascending"
                        : "descending"
                    }`}
                  >
                    OPP (%){" "}
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
                      sortConfig.direction === "descending"
                        ? "ascending"
                        : "descending"
                    }`}
                  >
                    4WK Score{" "}
                    {sortConfig?.key === "score" &&
                      (sortConfig.direction === "ascending" ? " ▲" : " ▼")}
                  </button>
                </th>
              </tr>
            </thead>
            <tbody>
              {/* AVG Row */}
              <tr className={styles.averagesRow}>
                <td>AVG:</td>
                <td>{averages.gamesPlayed.toFixed(2)}</td>
                <td>{averages.offNights.toFixed(2)}</td>
                <td>{(averages.avgOpponentPointPct * 100).toFixed(1)}%</td>
                <td>0.00</td> {/* AVG score is always 0 by definition */}
              </tr>

              {/* Data Rows */}
              {sortedTeams.map((team) => {
                const teamInfo = teamsMap[team.teamId];
                if (!teamInfo) return null; // Skip if no team info found

                const gp = team.totals?.gamesPlayed ?? "-"; // Use '-' if null
                const off = team.totals?.offNights ?? "-";
                const oppPct = team.avgOpponentPointPct;
                const score = team.score;

                // Determine color classes
                const isGPAbove = typeof gp === "number" && gp > roundedAvgGP;
                const isGPBelow = typeof gp === "number" && gp < roundedAvgGP;
                const isOFFAbove =
                  typeof off === "number" && off > roundedAvgOFF;
                const isOFFBelow =
                  typeof off === "number" && off < roundedAvgOFF;
                const isOPPBelow =
                  typeof oppPct === "number" &&
                  oppPct < averages.avgOpponentPointPct;
                const isOPPAbove =
                  typeof oppPct === "number" &&
                  oppPct > averages.avgOpponentPointPct;

                const gpClass = classNames({
                  [styles.green]: isGPAbove,
                  [styles[gpColorMap[gp as number] ?? "grey"]]: isGPBelow
                });
                const offClass = classNames({
                  [styles.green]: isOFFAbove,
                  [styles[offColorMap[off as number] ?? "grey"]]: isOFFBelow
                });
                const oppClass = classNames({
                  [styles.green]: isOPPBelow,
                  [styles[oppColorMap[oppPct as number] ?? "grey"]]: isOPPAbove
                });
                // Score coloring (example - positive is green, negative red)
                const scoreClass = classNames({
                  [styles.green]: score > 0.1,
                  [styles.red]: score < -0.1
                });

                return (
                  <tr key={team.teamId}>
                    <td className={styles.teamCell}>
                      <div className={styles.teamInfo}>
                        <Image
                          src={teamInfo.logo}
                          alt={`${teamInfo.name} logo`}
                          width={28}
                          height={28}
                          className={styles.teamLogo}
                        />
                        {/* Optional: Add team name/abbr here on wider screens */}
                        {/* <span className={styles.teamNameText}>{teamInfo.abbreviation}</span> */}
                      </div>
                    </td>
                    <td className={gpClass}>{gp}</td>
                    <td className={offClass}>{off}</td>
                    <td className={oppClass}>
                      {typeof oppPct === "number"
                        ? `${(oppPct * 100).toFixed(1)}%`
                        : "-"}
                    </td>
                    <td className={scoreClass}>{score.toFixed(2)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export default FourWeekGrid;
