// components/GameGrid/OpponentMetricsTable.tsx
import React, { useState, useEffect, useMemo } from "react"; // Added useState, useEffect
import Image from "next/image";
import { TeamDataWithTotals } from "lib/NHL/types";
import useTeamStats from "hooks/useTeamStats";
import styles from "./OpponentMetricsTable.module.scss";
import clsx from "clsx"; // Import clsx

// --- Re-add useIsMobile hook ---
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

type OpponentMetricsTableProps = {
  teamData: TeamDataWithTotals[];
};

type Averages = {
  avgXgf: number | null;
  avgXga: number | null;
  avgSf: number | null;
  avgSa: number | null;
  avgGoalFor: number | null;
  avgGoalAgainst: number | null;
  avgWinPct: number | null;
};

export default function OpponentMetricsTable({
  teamData
}: OpponentMetricsTableProps) {
  const teamStats = useTeamStats();
  const isMobile = useIsMobile(); // Use the hook
  const [isMobileMinimized, setIsMobileMinimized] = useState(false); // State for minimizing

  // --- Handlers ---
  const toggleMobileMinimize = () => {
    if (isMobile) {
      setIsMobileMinimized((prev) => !prev);
    }
  };

  // --- Computations (Memoized) ---
  const teamsAverages = useMemo(() => {
    const computeAverages = (team: TeamDataWithTotals): Averages => {
      const week1 = team.weeks.find((w) => w.weekNumber === 1);
      if (!week1 || week1.opponents.length === 0) {
        return {
          avgXgf: null,
          avgXga: null,
          avgSf: null,
          avgSa: null,
          avgGoalFor: null,
          avgGoalAgainst: null,
          avgWinPct: null
        };
      }
      const count = week1.opponents.length;
      const totals = week1.opponents.reduce(
        (acc, opp) => {
          const key = opp.abbreviation.toUpperCase();
          const stats = teamStats[key];
          // Add checks for stats existence to avoid summing undefined/NaN
          acc.xgf += stats?.xgf_per_game ?? 0;
          acc.xga += stats?.xga_per_game ?? 0;
          acc.sf += stats?.sf_per_game ?? 0;
          acc.sa += stats?.sa_per_game ?? 0;
          acc.gf += stats?.goal_for_per_game ?? 0;
          acc.ga += stats?.goal_against_per_game ?? 0;
          acc.winPct += stats?.win_pctg ?? 0;
          return acc;
        },
        { xgf: 0, xga: 0, sf: 0, sa: 0, gf: 0, ga: 0, winPct: 0 }
      );
      return {
        avgXgf: count > 0 ? totals.xgf / count : null,
        avgXga: count > 0 ? totals.xga / count : null,
        avgSf: count > 0 ? totals.sf / count : null,
        avgSa: count > 0 ? totals.sa / count : null,
        avgGoalFor: count > 0 ? totals.gf / count : null,
        avgGoalAgainst: count > 0 ? totals.ga / count : null,
        avgWinPct: count > 0 ? totals.winPct / count : null
      };
    };
    // Compute averages only if teamData is available
    return teamData
      ? teamData.map((team) => ({ team, averages: computeAverages(team) }))
      : [];
  }, [teamData, teamStats]); // Dependencies

  const sortedTeamsAverages = useMemo(() => {
    // Sort the computed averages
    return [...teamsAverages].sort((a, b) =>
      a.team.teamAbbreviation.localeCompare(b.team.teamAbbreviation)
    );
  }, [teamsAverages]); // Dependency

  // Define the metrics for the header (order matters)
  const metricColumns: { label: string; key: keyof Averages }[] = [
    { label: "xGF", key: "avgXgf" },
    { label: "xGA", key: "avgXga" },
    { label: "SF", key: "avgSf" },
    { label: "SA", key: "avgSa" },
    { label: "GF", key: "avgGoalFor" },
    { label: "GA", key: "avgGoalAgainst" },
    { label: "W%", key: "avgWinPct" }
  ];

  // Handler for title click, only works on mobile
  const handleTitleClick = isMobile ? toggleMobileMinimize : undefined;

  // Loading/No Data State Check
  const isLoading = Object.keys(teamStats).length === 0; // Simple check if stats are loaded
  const hasData = sortedTeamsAverages.length > 0;

  return (
    // Add minimized class to main container conditionally
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
        aria-controls={isMobile ? "opponent-metrics-content" : undefined}
      >
        <span className={styles.titleText}>
          AVG OPPONENT <span className={styles.spanColorBlue}>STATS</span>
        </span>
        {isMobile && (
          <span
            className={clsx(
              styles.minimizeToggleIcon,
              isMobileMinimized && styles.minimized
            )}
            aria-hidden="true"
          >
            ▼
          </span>
        )}
      </div>

      {/* Collapsible Content Wrapper */}
      <div
        id="opponent-metrics-content"
        className={styles.tableWrapper} // This div handles the collapse transition & visuals
      >
        {isLoading ? (
          <div className={styles.message}>Loading opponent stats...</div>
        ) : !hasData ? (
          <div className={styles.message}>No opponent data available.</div>
        ) : (
          // Scroll Container for the Table
          <table className={styles.table}>
            <thead>
              {/* Second header row: Team + Metric Labels */}
              <tr>
                <th>Team</th>
                {metricColumns.map((metric) => (
                  <th key={metric.key}>{metric.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sortedTeamsAverages.map(({ team, averages }) => (
                <tr key={team.teamId}>
                  <td>
                    <Image
                      src={`/teamLogos/${team.teamAbbreviation}.png`}
                      alt={team.teamAbbreviation || "Team Logo"}
                      width={30}
                      height={30}
                    />
                  </td>
                  {metricColumns.map((metric) => {
                    const value = averages[metric.key]; // Access directly using keyof
                    return (
                      <td key={metric.key}>
                        {value != null
                          ? metric.key === "avgWinPct"
                            ? (value * 100).toFixed(1) // Format percentage
                            : value.toFixed(1) // Format other metrics
                          : "-"}{" "}
                        {/* Placeholder for null */}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
