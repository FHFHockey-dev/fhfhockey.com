// components/GameGrid/FourWeekGrid.tsx

import React, { useMemo, useState, useEffect } from "react"; // Added useEffect
import styles from "./FourWeekGrid.module.scss";
import Image from "next/image"; // Use next/image instead of legacy
import Link from "next/link";
import { TeamDataWithTotals, TeamWithScore } from "lib/NHL/types"; // Consolidate type imports
import { useTeamsMap } from "hooks/useTeams";
import clsx from "clsx";
import { FOUR_WEEK_COLOR_LEGEND, toFourWeekMetricBands } from "./fourWeekMetricBands";
import { getFourWeekAverages, getFourWeekScore } from "./scheduleSummary";
import type { FourWeekCalendar } from "./useFourWeekSchedule";
import {
  buildFourWeekDetailAverages,
  buildFourWeekDetailCells,
  FourWeekGridView,
  getFourWeekNumbers,
} from "./fourWeekGridViews";

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
  calendar?: FourWeekCalendar;
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
const FourWeekGrid: React.FC<FourWeekGridProps> = ({ teamDataArray, calendar }) => {
  const teamsMap = useTeamsMap();
  const isMobile = useIsMobile();
  const [isMobileMinimized, setIsMobileMinimized] = useState(false);
  const [activeView, setActiveView] = useState<FourWeekGridView>("summary");
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
  const averages = useMemo(() => getFourWeekAverages(teamDataArray), [teamDataArray]);

  const roundedAvgGP = useMemo(
    () => Math.round(averages.gamesPlayed ?? 0),
    [averages.gamesPlayed],
  );
  const roundedAvgOFF = useMemo(
    () => Math.round(averages.offNights ?? 0),
    [averages.offNights],
  );

  const teamsWithScore: TeamWithScore[] = useMemo(() => {
    if (!teamDataArray) return [];
    return teamDataArray.map((team) => ({
      ...team,
      avgOpponentPointPct: team.totals.scheduleCoverage && team.totals.scheduleCoverage.known < team.totals.scheduleCoverage.expected
        ? null : team.avgOpponentPointPct,
      score: getFourWeekScore(team, averages)
    }));
  }, [teamDataArray, averages]);

  const sortedTeams = useMemo(() => {
    let sortableTeams = [...teamsWithScore];
    const currentSortKey = sortConfig?.key;
    const currentDirection = sortConfig?.direction;

    sortableTeams.sort((a, b) => {
      let aValue: number | string | null;
      let bValue: number | string | null;
      const aComplete = !a.totals.scheduleCoverage || a.totals.scheduleCoverage.known === a.totals.scheduleCoverage.expected;
      const bComplete = !b.totals.scheduleCoverage || b.totals.scheduleCoverage.known === b.totals.scheduleCoverage.expected;

      // Get values based on sort key
      switch (currentSortKey) {
        case "gamesPlayed":
          aValue = aComplete ? a.totals.gamesPlayed : null;
          bValue = bComplete ? b.totals.gamesPlayed : null;
          break;
        case "offNights":
          aValue = aComplete ? a.totals.offNights : null;
          bValue = bComplete ? b.totals.offNights : null;
          break;
        case "avgOpponentPointPct":
          aValue = a.avgOpponentPointPct;
          bValue = b.avgOpponentPointPct;
          break;
        case "score":
          aValue = a.score;
          bValue = b.score;
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
      if (aValue == null) return bValue == null ? 0 : 1;
      if (bValue == null) return -1;
      if (aValue < bValue) return currentDirection === "ascending" ? -1 : 1;
      if (aValue > bValue) return currentDirection === "ascending" ? 1 : -1;
      return 0;
    });

    return sortableTeams;
  }, [teamsWithScore, sortConfig, teamsMap]);

  const metricBands = useMemo(() => {
    const complete = (team: TeamWithScore) => !team.totals.scheduleCoverage || team.totals.scheduleCoverage.known === team.totals.scheduleCoverage.expected;
    return {
      gamesPlayed: toFourWeekMetricBands(teamsWithScore.map((team) => ({ teamId: team.teamId, value: complete(team) ? team.totals.gamesPlayed : null })), "desc"),
      offNights: toFourWeekMetricBands(teamsWithScore.map((team) => ({ teamId: team.teamId, value: complete(team) ? team.totals.offNights : null })), "desc"),
      avgOpponentPointPct: toFourWeekMetricBands(teamsWithScore.map((team) => ({ teamId: team.teamId, value: team.avgOpponentPointPct })), "asc"),
      score: toFourWeekMetricBands(teamsWithScore.map((team) => ({ teamId: team.teamId, value: team.score })), "desc"),
    };
  }, [teamsWithScore]);

  const weekNumbers = useMemo(
    () => getFourWeekNumbers(teamDataArray ?? []),
    [teamDataArray],
  );
  const weeklyAverages = useMemo(
    () => buildFourWeekDetailAverages(teamDataArray ?? [], weekNumbers),
    [teamDataArray, weekNumbers],
  );

  // --- Render ---
  const handleTitleClick = isMobile ? toggleMobileMinimize : undefined;
  const isLoading = !teamsMap || Object.keys(teamsMap).length === 0;
  const hasData = sortedTeams.length > 0;

  return (
    <div
      className={clsx(
        styles.container,
        isMobile && isMobileMinimized && styles.minimized,
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
        data-interactive={isMobile ? true : undefined}
      >
        <span className={styles.titleText}>
          {" "}
          FOUR WEEK <span className={styles.spanColorBlue}>FORECAST</span>{" "}
        </span>
        {isMobile && (
          <span
            className={clsx(
              styles.minimizeToggleIcon,
              isMobileMinimized && styles.minimized,
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
        {calendar && (
          <p className={styles.calendarContext}>
            {calendar.error ?? `${calendar.start}–${calendar.end}: selected Monday–Sunday week plus three weeks. ${calendar.knownDays === calendar.expectedDays ? "Schedule complete." : "Schedule incomplete; affected totals are unavailable."}`}
          </p>
        )}
        <p className={styles.calendarContext}>{FOUR_WEEK_COLOR_LEGEND}</p>
        {isLoading ? (
          <div className={styles.message}>Loading schedule data...</div>
        ) : !hasData ? (
          <div className={styles.message}>No schedule data available.</div>
        ) : (
          <>
            <div
              className={styles.viewTabs}
              role="tablist"
              aria-label="Four-week forecast views"
            >
              <button
                type="button"
                role="tab"
                aria-selected={activeView === "summary"}
                className={clsx(
                  styles.viewTab,
                  activeView === "summary" && styles.viewTabActive,
                )}
                onClick={() => setActiveView("summary")}
              >
                4W Summary
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={activeView === "weekly"}
                className={clsx(
                  styles.viewTab,
                  activeView === "weekly" && styles.viewTabActive,
                )}
                onClick={() => setActiveView("weekly")}
              >
                Weekly Detail
              </button>
            </div>
            {activeView === "summary" ? (
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
                    <td>{averages.gamesPlayed?.toFixed(2) ?? "-"}</td>
                    <td>{averages.offNights?.toFixed(2) ?? "-"}</td>
                    <td>{averages.avgOpponentPointPct == null ? "-" : `${(averages.avgOpponentPointPct * 100).toFixed(1)}%`}</td>
                    <td>{averages.score?.toFixed(2) ?? "-"}</td>
                  </tr>

                  {/* Data Rows */}
                  {sortedTeams.map((team) => {
                    const teamInfo = teamsMap[team.teamId];
                    if (!teamInfo) return null; // Skip if no team info found

                    const complete = !team.totals.scheduleCoverage || team.totals.scheduleCoverage.known === team.totals.scheduleCoverage.expected;
                    const gp = complete ? team.totals.gamesPlayed : "-";
                    const off = complete ? team.totals.offNights : "-";
                    const oppPct = team.avgOpponentPointPct;
                    const score = team.score;

                    return (
                      <tr key={team.teamId}>
                        <td className={styles.teamCell}>
                          <Link
                            href={`/stats/team/${teamInfo.abbreviation}`}
                            aria-label={`Open ${teamInfo.name} Team HQ`}
                            className={styles.teamInfo}
                          >
                            <Image
                              src={teamInfo.logo}
                              alt={`${teamInfo.name} logo`}
                              width={24}
                              height={24}
                              className={styles.teamLogo}
                            />
                            {/* Optional: Add team name/abbr here on wider screens */}
                            {/* <span className={styles.teamNameText}>{teamInfo.abbreviation}</span> */}
                          </Link>
                        </td>
                        <td data-favorability={metricBands.gamesPlayed.get(team.teamId)}>{gp}</td>
                        <td data-favorability={metricBands.offNights.get(team.teamId)}>{off}</td>
                        <td data-favorability={metricBands.avgOpponentPointPct.get(team.teamId)}>
                          {typeof oppPct === "number"
                            ? `${(oppPct * 100).toFixed(1)}%`
                            : "-"}
                        </td>
                        <td data-favorability={metricBands.score.get(team.teamId)}>{score?.toFixed(2) ?? "-"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            ) : (
              <table className={clsx(styles.table, styles.weeklyTable)}>
                <thead>
                  <tr>
                    <th>Team</th>
                    {weekNumbers.map((weekNumber) => (
                      <th key={weekNumber}>W{weekNumber}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <tr className={styles.averagesRow}>
                    <td>AVG:</td>
                    {weeklyAverages.map((week) => (
                      <td key={week.weekNumber}>
                        {week.gamesPlayed?.toFixed(1) ?? "-"}G /{" "}
                        {week.offNights?.toFixed(1) ?? "-"}O
                      </td>
                    ))}
                  </tr>
                  {sortedTeams.map((team) => {
                    const teamInfo = teamsMap[team.teamId];
                    if (!teamInfo) return null;

                    return (
                      <tr key={team.teamId}>
                        <td className={styles.teamCell}>
                          <Link
                            href={`/stats/team/${teamInfo.abbreviation}`}
                            aria-label={`Open ${teamInfo.name} Team HQ`}
                            className={styles.teamInfo}
                          >
                            <Image
                              src={teamInfo.logo}
                              alt={`${teamInfo.name} logo`}
                              width={24}
                              height={24}
                              className={styles.teamLogo}
                            />
                          </Link>
                        </td>
                        {buildFourWeekDetailCells(team, weekNumbers).map(
                          (week) => (
                            <td key={week.weekNumber}>
                              <strong>
                                {week.gamesPlayed == null
                                  ? `Schedule ${week.coverage?.known ? "partial" : "unavailable"}`
                                  : `${week.gamesPlayed}G / ${week.offNights}O`}
                              </strong>
                              <span className={styles.opponentList}>
                                {week.opponents.length
                                  ? week.opponents.join(" · ")
                                  : week.gamesPlayed == null ? "" : "No games"}
                              </span>
                            </td>
                          ),
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default FourWeekGrid;
