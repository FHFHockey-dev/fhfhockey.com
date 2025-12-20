// components/GameGrid/OpponentMetricsTable.tsx
import React, { useState, useEffect, useMemo } from "react";
import Image from "next/image";
import { TeamDataWithTotals } from "lib/NHL/types";
import supabase from "lib/supabase"; // Import the Supabase client
import styles from "./OpponentMetricsTable.module.scss";
import clsx from "clsx";
import PanelStatus from "components/common/PanelStatus";
import { useTeamsMap } from "hooks/useTeams";

// It's best practice to move this interface to a shared types file (e.g., lib/NHL/types.ts)
// to avoid duplication. It is included here for completeness.
// Snapshot row from public.nst_team_all
export interface TeamStats {
  team_abbreviation: string;
  team_name: string;
  gp: number | null;
  sf: number | null;
  sa: number | null;
  gf: number | null;
  ga: number | null;
  xgf: number | null;
  xga: number | null;
  points: number | null;
  date: string; // YYYY-MM-DD
}

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
  // State for storing stats for ALL teams, keyed by abbreviation
  const [allTeamStats, setAllTeamStats] = useState<{
    [key: string]: TeamStats;
  }>({});
  const [statsLoading, setStatsLoading] = useState(true);

  const isMobile = useIsMobile();
  const [isMobileMinimized, setIsMobileMinimized] = useState(false);
  const teamsMap = useTeamsMap();
  const [sortConfig, setSortConfig] = useState<{
    key: keyof Averages | "teamName";
    direction: "ascending" | "descending";
  } | null>(null);

  // Effect to fetch and process stats for all teams on component mount
  useEffect(() => {
    const fetchAndProcessAllStats = async () => {
      setStatsLoading(true);

      // Pull from NST daily team table using the most recent date per team.
      // Strategy: order by date desc, and take the first row we see per team_abbreviation.
      const { data, error } = await supabase
        .from("nst_team_all")
        .select(
          [
            "team_abbreviation",
            "team_name",
            "gp",
            "sf",
            "sa",
            "gf",
            "ga",
            "xgf",
            "xga",
            "points",
            "date"
          ].join(",")
        )
        .order("date", { ascending: false });

      if (error) {
        console.error("Failed to fetch team stats:", error);
        setStatsLoading(false);
        return;
      }

      const rows: TeamStats[] = (data ?? []) as unknown as TeamStats[];

      if (rows && rows.length > 0) {
        // Keep first encounter per team_abbreviation (most recent date due to DESC order)
        const statsByAbbr = rows.reduce<{ [key: string]: TeamStats }>(
          (acc, stat) => {
            const abbr = stat.team_abbreviation?.toUpperCase();
            if (!abbr) return acc;
            if (!acc[abbr]) {
              acc[abbr] = stat;
            }
            return acc;
          },
          {}
        );
        setAllTeamStats(statsByAbbr);
      } else {
        setAllTeamStats({});
      }
      setStatsLoading(false);
    };

    if (teamData && teamData.length > 0) {
      fetchAndProcessAllStats();
    } else {
      setStatsLoading(false);
    }
  }, [teamData]); // Rerun if teamData changes

  const toggleMobileMinimize = () => {
    if (isMobile) {
      setIsMobileMinimized((prev) => !prev);
    }
  };

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
          const stats = allTeamStats[key]; // Use the new state object
          if (stats) {
            const gp = stats.gp ?? 0;
            const denom = gp > 0 ? gp : 0;
            const perGame = (value: number | null | undefined) =>
              denom > 0 ? (value ?? 0) / denom : 0;
            // Use NST per-game rates
            acc.xgf += perGame(stats.xgf);
            acc.xga += perGame(stats.xga);
            acc.sf += perGame(stats.sf);
            acc.sa += perGame(stats.sa);
            acc.gf += perGame(stats.gf);
            acc.ga += perGame(stats.ga);
            // Compute point pct from points / (gp*2) if possible
            const points = stats.points ?? 0;
            acc.winPct += denom > 0 ? points / (denom * 2) : 0;
          }
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
    return teamData
      ? teamData.map((team) => ({ team, averages: computeAverages(team) }))
      : [];
  }, [teamData, allTeamStats]); // Use allTeamStats as a dependency

  const handleSort = (key: keyof Averages | "teamName") => {
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

  const metricColumns = useMemo(
    (): { label: string; key: keyof Averages }[] => [
      { label: "xGF", key: "avgXgf" },
      { label: "xGA", key: "avgXga" },
      { label: "SF", key: "avgSf" },
      { label: "SA", key: "avgSa" },
      { label: "GF", key: "avgGoalFor" },
      { label: "GA", key: "avgGoalAgainst" },
      { label: "W%", key: "avgWinPct" }
    ],
    []
  );

  const leagueAverages = useMemo(() => {
    const sums: Partial<Record<keyof Averages, number>> = {};
    const counts: Partial<Record<keyof Averages, number>> = {};
    metricColumns.forEach(({ key }) => {
      sums[key] = 0;
      counts[key] = 0;
    });

    sortedTeamsAverages.forEach(({ averages }) => {
      metricColumns.forEach(({ key }) => {
        const value = averages[key];
        if (typeof value === "number") {
          sums[key] = (sums[key] ?? 0) + value;
          counts[key] = (counts[key] ?? 0) + 1;
        }
      });
    });

    const result: Partial<Record<keyof Averages, number | null>> = {};
    metricColumns.forEach(({ key }) => {
      const count = counts[key] ?? 0;
      result[key] = count > 0 ? (sums[key] ?? 0) / count : null;
    });
    return result as Record<keyof Averages, number | null>;
  }, [sortedTeamsAverages, metricColumns]);

  type TeamNumeric = { teamId: number; value: number };
  const toRankMaps = (entries: TeamNumeric[], bestDirection: "asc" | "desc") => {
    const sorted = [...entries].sort((a, b) =>
      bestDirection === "asc" ? a.value - b.value : b.value - a.value
    );
    const best = new Map<number, number>();
    const worst = new Map<number, number>();
    sorted.slice(0, 10).forEach((e, i) => best.set(e.teamId, i + 1));
    sorted
      .slice(Math.max(sorted.length - 10, 0))
      .forEach((e, i) => worst.set(e.teamId, i + 1));
    return { best, worst };
  };

  const rankMaps = useMemo(() => {
    const directions: Record<keyof Averages, "asc" | "desc"> = {
      avgXgf: "asc",
      avgXga: "desc",
      avgSf: "asc",
      avgSa: "desc",
      avgGoalFor: "asc",
      avgGoalAgainst: "desc",
      avgWinPct: "asc"
    };

    return metricColumns.reduce<
      Record<keyof Averages, { best: Map<number, number>; worst: Map<number, number> }>
    >((acc, { key }) => {
      const entries: TeamNumeric[] = [];
      sortedTeamsAverages.forEach(({ team, averages }) => {
        const value = averages[key];
        if (typeof value === "number") entries.push({ teamId: team.teamId, value });
      });
      acc[key] = toRankMaps(entries, directions[key]);
      return acc;
    }, {} as Record<keyof Averages, { best: Map<number, number>; worst: Map<number, number> }>);
  }, [sortedTeamsAverages, metricColumns]);

  const getRankClass = (
    key: keyof Averages,
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
        ) : !hasData ? (
          <PanelStatus state="empty" message="No opponent data available." />
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
