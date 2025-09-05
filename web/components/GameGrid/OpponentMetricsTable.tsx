// components/GameGrid/OpponentMetricsTable.tsx
import React, { useState, useEffect, useMemo } from "react";
import Image from "next/image";
import { TeamDataWithTotals } from "lib/NHL/types";
import supabase from "lib/supabase"; // Import the Supabase client
import styles from "./OpponentMetricsTable.module.scss";
import clsx from "clsx";
import PanelStatus from "components/common/PanelStatus";

// It's best practice to move this interface to a shared types file (e.g., lib/NHL/types.ts)
// to avoid duplication. It is included here for completeness.
export interface TeamStats {
  id: number;
  team_id: number | null;
  franchise_name: string;
  date: string;
  games_played: number | null;
  wins: number | null;
  losses: number | null;
  ot_losses: number | null;
  points: number | null;
  goals_for: number | null;
  goals_against: number | null;
  goals_for_per_game: number | null;
  goals_against_per_game: number | null;
  point_pct: number | null;
  regulation_and_ot_wins: number | null;
  wins_in_regulation: number | null;
  wins_in_shootout: number | null;
  faceoff_win_pct: number | null;
  power_play_pct: number | null;
  penalty_kill_pct: number | null;
  shots_for_per_game: number | null;
  shots_against_per_game: number | null;
  season_id: number | null;
  game_id: number | null;
  opponent_id: number | null;
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

  // Effect to fetch and process stats for all teams on component mount
  useEffect(() => {
    const fetchAndProcessAllStats = async () => {
      setStatsLoading(true);

      const { data: allStatsData, error } = await supabase
        .from("wgo_team_stats")
        .select("*");

      if (error) {
        console.error("Failed to fetch all team stats:", error);
        setStatsLoading(false);
        return;
      }

      if (allStatsData) {
        // Create a map from team_id to abbreviation using the teamData prop.
        // NOTE: This assumes the `teamData` prop contains every team that might
        // appear as an opponent. A more robust solution involves having a
        // dedicated 'teams' table in your database that maps IDs to abbreviations.
        const teamIdToAbbrMap = new Map<number, string>();
        teamData.forEach((team) => {
          if (team.teamId && team.teamAbbreviation) {
            teamIdToAbbrMap.set(
              team.teamId,
              team.teamAbbreviation.toUpperCase()
            );
          }
        });

        const statsByAbbr = allStatsData.reduce<{ [key: string]: TeamStats }>(
          (acc, stat) => {
            const abbr = teamIdToAbbrMap.get(stat.team_id!);
            if (abbr) {
              // This will overwrite, keeping the last fetched stat for a team.
              // If your table has multiple entries per team, you may need to
              // add logic here to select the most recent one.
              acc[abbr] = stat;
            }
            return acc;
          },
          {}
        );

        setAllTeamStats(statsByAbbr);
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
            // Ensure stats exist before summing
            acc.xgf += stats.shots_for_per_game ?? 0; // Assuming xgf maps to this
            acc.xga += stats.shots_against_per_game ?? 0; // Assuming xga maps to this
            acc.sf += stats.shots_for_per_game ?? 0;
            acc.sa += stats.shots_against_per_game ?? 0;
            acc.gf += stats.goals_for_per_game ?? 0;
            acc.ga += stats.goals_against_per_game ?? 0;
            acc.winPct += stats.point_pct ?? 0; // Assuming win_pctg is point_pct
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

  const sortedTeamsAverages = useMemo(() => {
    return [...teamsAverages].sort((a, b) =>
      a.team.teamAbbreviation.localeCompare(b.team.teamAbbreviation)
    );
  }, [teamsAverages]);

  const metricColumns: { label: string; key: keyof Averages }[] = [
    { label: "xGF", key: "avgXgf" },
    { label: "xGA", key: "avgXga" },
    { label: "SF", key: "avgSf" },
    { label: "SA", key: "avgSa" },
    { label: "GF", key: "avgGoalFor" },
    { label: "GA", key: "avgGoalAgainst" },
    { label: "W%", key: "avgWinPct" }
  ];

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
                      width={24}
                      height={24}
                    />
                  </td>
                  {metricColumns.map((metric) => {
                    const value = averages[metric.key];
                    return (
                      <td key={metric.key}>
                        {value != null
                          ? metric.key === "avgWinPct"
                            ? (value * 100).toFixed(1)
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
