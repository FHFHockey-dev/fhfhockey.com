// components/GameGrid/OpponentMetricsTable.tsx
import React, { useState, useEffect, useMemo } from "react";
import { TeamDataWithTotals } from "lib/NHL/types";
import styles from "./OpponentMetricsTable.module.scss";
import clsx from "clsx";
import PanelStatus from "components/common/PanelStatus";
import MetricInfoDisclosure from "./MetricInfoDisclosure";
import RatingMeter from "./RatingMeter";
import { LoadingRows } from "./LoadingCells";
import toggleStyles from "./DetailToggle.module.scss";
import { buildOpponentRatings, RATING_INFO } from "./utils/scheduleOpportunity";
import OptimizedImage from "components/common/OptimizedImage";
import { getLocalTeamLogoPath } from "lib/images";
import { useTeamsMap } from "hooks/useTeams";
import { TeamNumeric, toRankMaps } from "./utils/metricRanks";
import {
  getOpponentViewDirections,
  OpponentRole
} from "./utils/opponentCategoryEffects";
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
  scheduleLoading?: boolean;
  sourceLoading?: boolean;
  teamData: TeamDataWithTotals[];
  metricsData: UseOpponentMetricsDataResult;
};

export default function OpponentMetricsTable({
  teamData,
  scheduleLoading = false,
  sourceLoading = false,
  metricsData
}: OpponentMetricsTableProps) {
  const isMobile = useIsMobile();
  const [expanded, setExpanded] = useState(false);
  const [isMobileMinimized, setIsMobileMinimized] = useState(false);
  const teamsMap = useTeamsMap();
  // Keep the released default while the perspective control is hidden.
  const role: OpponentRole = "skater";
  const directions = useMemo(() => getOpponentViewDirections(role), [role]);
  const [sortConfig, setSortConfig] = useState<{
    key: keyof OpponentMetricAverages | "atk" | "def" | "teamName";
    direction: "ascending" | "descending";
  } | null>(null);
  const {
    entries,
    metricColumns: sourceColumns,
    leagueAverages,
    statsLoading,
    statsError,
    sourceLabel
  } = metricsData;

  const ratings = useMemo(() => buildOpponentRatings(entries, metricsData.statsByAbbreviation), [entries, metricsData.statsByAbbreviation]);
  const teamsAverages = useMemo(() => entries.map((e) => ({ ...e, averages: { ...e.averages, atk: ratings[e.team.teamId]?.atk ?? null, def: ratings[e.team.teamId]?.def ?? null } })), [entries, ratings]);
  const metricColumns: { label: string; key: keyof OpponentMetricAverages | "atk" | "def" }[] = [{ label: "Attack", key: "atk" }, { label: "Defense", key: "def" }, ...(expanded ? sourceColumns : [])];
  const toggleMobileMinimize = () => {
    if (isMobile) {
      setIsMobileMinimized((prev) => !prev);
    }
  };

  const handleSort = (key: keyof OpponentMetricAverages | "atk" | "def" | "teamName") => {
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
    return sourceColumns.reduce<
      Record<
        keyof OpponentMetricAverages,
        { best: Map<number, number>; worst: Map<number, number> }
      >
    >((acc, { key }) => {
      const entries: TeamNumeric[] = [];
      const direction = directions[key];
      teamsAverages.forEach(({ team, averages }) => {
        const value = averages[key];
        if (typeof value === "number") entries.push({ teamId: team.teamId, value });
      });
      // Mixed-sign or unrelated metrics stay uncolored for this role.
      acc[key] = direction ? toRankMaps(entries, direction) : { best: new Map(), worst: new Map() };
      return acc;
    }, {} as Record<
      keyof OpponentMetricAverages,
      { best: Map<number, number>; worst: Map<number, number> }
    >);
  }, [teamsAverages, sourceColumns, directions]);

  const getRankClass = (
    key: keyof OpponentMetricAverages | "atk" | "def",
    teamId: number,
    value: number | null
  ): string | undefined => {
    if (key === "atk" || key === "def") return undefined;
    if (typeof value !== "number") return undefined;
    const rank = rankMaps[key]?.best.get(teamId);
    if (rank != null) return (styles as any)[`rankGood${rank}`];
    const worstRank = rankMaps[key]?.worst.get(teamId);
    if (worstRank != null) return (styles as any)[`rankBad${worstRank}`];
    return undefined;
  };

  const handleTitleClick = isMobile ? toggleMobileMinimize : undefined;
  const hasData = sortedTeamsAverages.length > 0;
  const pending = statsLoading || scheduleLoading || sourceLoading;

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
        onKeyDown={(event) => { if (isMobile && (event.key === "Enter" || event.key === " ")) { event.preventDefault(); toggleMobileMinimize(); } }}
        role={isMobile ? "button" : undefined}
        tabIndex={isMobile ? 0 : undefined}
        aria-expanded={isMobile ? !isMobileMinimized : undefined}
        aria-controls="opponent-metrics-content"
        data-interactive={isMobile ? true : undefined}
      >
        <span className={styles.titleText}>
          Opponent <span className={styles.spanColorBlue}>Strength</span> <small>↑ stronger</small>
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
        <MetricInfoDisclosure label="opponent metrics" warnings={!statsLoading && !statsError && teamsAverages.some(({ coverage }) => Object.values(coverage).some(({ known, expected }) => known < expected))
          ? ["Some opponent averages are unavailable. Check back after the next stats update."] : []}>
          <p>Opponent stats (Natural Stat Trick): {sourceLabel}</p>
          <p>Metrics per game; PTS% = points / (2 × GP). Missing or incomplete opponent averages show “-”.</p>
          <p>xG = expected goals; GF/GA = goals for/against; SF/SA = shots for/against.</p>
          <p>{RATING_INFO}</p>
        </MetricInfoDisclosure>
        <button type="button" className={toggleStyles.detailToggle} aria-expanded={expanded} aria-label={expanded ? "Collapse opponent details" : "Expand opponent details"} onClick={() => setExpanded((v) => !v)}>
          {expanded ? "Hide source stats" : "Show source stats"} <span aria-hidden="true">{expanded ? "▴" : "▾"}</span>
        </button>
        {statsError && <PanelStatus state="error" message="Opponent stats could not load. Reload to retry." />}
        {!pending && !statsError && !hasData && <PanelStatus state="empty" message="Opponent metrics will appear when schedule data is available." />}
          <table className={styles.table} aria-busy={pending} data-opponent-state={pending ? "loading" : "ready"}>
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
                  <th
                    key={metric.key}
                    data-uncolored={(metric.key === "atk" || metric.key === "def" ? null : directions[metric.key]) ? undefined : true}
                    title={(metric.key === "atk" || metric.key === "def" ? null : directions[metric.key]) ? undefined : `${metric.label} is not colored in the ${role} view`}
                  >
                    <button
                      type="button"
                      onClick={() => handleSort(metric.key)}
                      className={styles.sortButton}
                      aria-label={`Sort by ${metric.key === "atk" ? "opponent attack strength" : metric.key === "def" ? "opponent defense strength" : metric.label} ${
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
              {pending || !hasData ? <LoadingRows columns={metricColumns.length + 1} waiting={pending} rowHeight={30} /> : <>
              <tr className={styles.averagesRow}>
                <td>AVG:</td>
                {metricColumns.map((metric) => {
                  const value = metric.key === "atk" || metric.key === "def" ? null : leagueAverages[metric.key];
                  return (
                    <td key={metric.key} title="Mean of complete displayed team averages">
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
                      <OptimizedImage
                        src={getLocalTeamLogoPath(team.teamAbbreviation)}
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
                        {metric.key === "atk" || metric.key === "def"
                          ? <RatingMeter kind={metric.key} value={value} />
                          : value != null
                            ? metric.key === "avgWinPct"
                              ? `${(value * 100).toFixed(1)}%`
                              : value.toFixed(1)
                            : "-"}
                      </td>
                    );
                  })}
                </tr>
              ))}
              </>}
            </tbody>
          </table>
      </div>
    </div>
  );
}
