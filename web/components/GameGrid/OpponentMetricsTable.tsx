// components/GameGrid/OpponentMetricsTable.tsx
import React, { useState, useEffect, useMemo } from "react";
import Image from "next/image";
import { TeamDataWithTotals } from "lib/NHL/types";
import styles from "./OpponentMetricsTable.module.scss";
import clsx from "clsx";
import PanelStatus from "components/common/PanelStatus";
import { useTeamsMap } from "hooks/useTeams";
import {
  OpponentMetricAverages,
  UseOpponentMetricsDataResult
} from "./utils/useOpponentMetricsData";

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
  metricsData: UseOpponentMetricsDataResult;
};

type TeamNumeric = { teamId: number; value: number };

function toRankMaps(entries: TeamNumeric[], bestDirection: "asc" | "desc") {
  const sorted = [...entries].sort((a, b) =>
    bestDirection === "asc" ? a.value - b.value : b.value - a.value
  );
  const best = new Map<number, number>();
  const worst = new Map<number, number>();
  sorted.slice(0, 10).forEach((entry, index) => best.set(entry.teamId, index + 1));
  sorted
    .slice(Math.max(sorted.length - 10, 0))
    .forEach((entry, index) => worst.set(entry.teamId, index + 1));
  return { best, worst };
}

export default function OpponentMetricsTable({
  teamData,
  metricsData
}: OpponentMetricsTableProps) {
  const isMobile = useIsMobile();
  const [isMobileMinimized, setIsMobileMinimized] = useState(false);
  const teamsMap = useTeamsMap();
  const [sortConfig, setSortConfig] = useState<{
    key: keyof OpponentMetricAverages | "teamName";
    direction: "ascending" | "descending";
  } | null>(null);
  const {
    entries: teamsAverages,
    metricColumns,
    leagueAverages,
    statsLoading,
    statsError
  } = metricsData;

  const toggleMobileMinimize = () => {
    if (isMobile) {
      setIsMobileMinimized((prev) => !prev);
    }
  };

  const handleSort = (key: keyof OpponentMetricAverages | "teamName") => {
    let direction: "ascending" | "descending" = "ascending";
    if (
      sortConfig &&
      sortConfig.key === key &&
      sortConfig.direction === "ascending"
    ) {
      direction = "descending";
    }
    if (key === "teamName" && (!sortConfig || sortConfig.key !== "teamName")) {
      direction = "ascending";
    } else if (key !== "teamName" && (!sortConfig || sortConfig.key !== key)) {
      direction = "descending";
    }
    setSortConfig({ key, direction });
  };

  const sortedTeamsAverages = useMemo(() => {
    const currentSortKey = sortConfig?.key;
    const currentDirection = sortConfig?.direction;
    const sortable = [...teamsAverages];

    if (!currentSortKey || !currentDirection) return sortable;

    sortable.sort((a, b) => {
      if (currentSortKey === "teamName") {
        const aName =
          teamsMap[a.team.teamId]?.name?.toLowerCase() ??
          a.team.teamAbbreviation?.toLowerCase() ??
          "";
        const bName =
          teamsMap[b.team.teamId]?.name?.toLowerCase() ??
          b.team.teamAbbreviation?.toLowerCase() ??
          "";
        if (aName < bName) return currentDirection === "ascending" ? -1 : 1;
        if (aName > bName) return currentDirection === "ascending" ? 1 : -1;
        return 0;
      }

      const aValue = a.averages[currentSortKey];
      const bValue = b.averages[currentSortKey];
      const aNum =
        aValue == null
          ? currentDirection === "ascending"
            ? Infinity
            : -Infinity
          : aValue;
      const bNum =
        bValue == null
          ? currentDirection === "ascending"
            ? Infinity
            : -Infinity
          : bValue;

      if (aNum < bNum) return currentDirection === "ascending" ? -1 : 1;
      if (aNum > bNum) return currentDirection === "ascending" ? 1 : -1;
      return 0;
    });

    return sortable;
  }, [teamsAverages, sortConfig, teamsMap]);

  const rankMaps = useMemo(() => {
    const directions: Record<keyof OpponentMetricAverages, "asc" | "desc"> = {
      avgXgf: "asc",
      avgXga: "desc",
      avgSf: "asc",
      avgSa: "desc",
      avgGoalFor: "asc",
      avgGoalAgainst: "desc",
      avgWinPct: "asc"
    };

    return metricColumns.reduce<
      Record<
        keyof OpponentMetricAverages,
        { best: Map<number, number>; worst: Map<number, number> }
      >
    >((acc, { key }) => {
      const entries: TeamNumeric[] = [];
      sortedTeamsAverages.forEach(({ team, averages }) => {
        const value = averages[key];
        if (typeof value === "number") entries.push({ teamId: team.teamId, value });
      });
      acc[key] = toRankMaps(entries, directions[key]);
      return acc;
    }, {} as Record<
      keyof OpponentMetricAverages,
      { best: Map<number, number>; worst: Map<number, number> }
    >);
  }, [sortedTeamsAverages, metricColumns]);

  const getRankClass = (
    key: keyof OpponentMetricAverages,
    teamId: number,
    value: number | null
  ): string | undefined => {
    if (typeof value !== "number") return undefined;
    const rank = rankMaps[key]?.best.get(teamId);
    if (rank != null) return (styles as any)[`rankGood${rank}`];
    const worstRank = rankMaps[key]?.worst.get(teamId);
    if (worstRank != null) return (styles as any)[`rankBad${worstRank}`];
    return undefined;
  };

  const handleTitleClick = isMobile ? toggleMobileMinimize : undefined;
  const hasData = sortedTeamsAverages.length > 0;

  return (
    <div
      className={clsx(
        styles.container,
        isMobile && isMobileMinimized && styles.minimized
      )}
    >
      <div
        className={styles.titleHeader}
        onClick={handleTitleClick}
        role={isMobile ? "button" : undefined}
        tabIndex={isMobile ? 0 : undefined}
        aria-expanded={isMobile ? !isMobileMinimized : undefined}
        aria-controls="opponent-metrics-content"
        data-interactive={isMobile ? true : undefined}
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
      <div id="opponent-metrics-content" className={styles.tableWrapper}>
        {statsLoading ? (
          <PanelStatus state="loading" message="Loading opponent stats..." />
        ) : statsError ? (
          <PanelStatus state="error" message={statsError} />
        ) : !hasData ? (
          <PanelStatus
            state="empty"
            message={
              teamData.length === 0
                ? "Opponent metrics will appear when schedule data is available."
                : "No opponent data available."
            }
          />
        ) : (
          <table className={styles.table}>
            <thead>
              <tr>
                <th>
                  <button
                    type="button"
                    onClick={() => handleSort("teamName")}
                    className={styles.sortButton}
                    aria-label={`Sort by Team ${
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
                {metricColumns.map((metric) => (
                  <th key={metric.key}>
                    <button
                      type="button"
                      onClick={() => handleSort(metric.key)}
                      className={styles.sortButton}
                      aria-label={`Sort by ${metric.label} ${
                        sortConfig?.key === metric.key &&
                        sortConfig.direction === "descending"
                          ? "ascending"
                          : "descending"
                      }`}
                    >
                      {metric.label}{" "}
                      {sortConfig?.key === metric.key &&
                        (sortConfig.direction === "ascending" ? " ▲" : " ▼")}
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr className={styles.averagesRow}>
                <td>AVG:</td>
                {metricColumns.map((metric) => {
                  const value = leagueAverages[metric.key];
                  return (
                    <td key={metric.key}>
                      {value != null
                        ? metric.key === "avgWinPct"
                          ? `${(value * 100).toFixed(1)}%`
                          : value.toFixed(2)
                        : "-"}
                    </td>
                  );
                })}
              </tr>
              {sortedTeamsAverages.map(({ team, averages }) => (
                <tr key={team.teamId}>
                  <td>
                    <div className={styles.teamInfo}>
                      <Image
                        src={`/teamLogos/${team.teamAbbreviation ?? "default"}.png`}
                        alt={team.teamAbbreviation || "Team Logo"}
                        width={24}
                        height={24}
                        className={styles.teamLogo}
                      />
                    </div>
                  </td>
                  {metricColumns.map((metric) => {
                    const value = averages[metric.key];
                    return (
                      <td
                        key={metric.key}
                        className={getRankClass(metric.key, team.teamId, value)}
                      >
                        {value != null
                          ? metric.key === "avgWinPct"
                            ? `${(value * 100).toFixed(1)}%`
                            : value.toFixed(1)
                          : "-"}
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
