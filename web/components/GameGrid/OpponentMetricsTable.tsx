// components/GameGrid/OpponentMetricsTable.tsx
import React from "react";
import Image from "next/image";
import { TeamDataWithTotals } from "lib/NHL/types";
import useTeamStats from "hooks/useTeamStats";
import styles from "./OpponentMetricsTable.module.scss";

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

  // Compute averages based on each team's week1 opponents.
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
        return {
          xgf: acc.xgf + (stats ? stats.xgf_per_game : 0),
          xga: acc.xga + (stats ? stats.xga_per_game : 0),
          sf: acc.sf + (stats ? stats.sf_per_game : 0),
          sa: acc.sa + (stats ? stats.sa_per_game : 0),
          gf: acc.gf + (stats ? stats.goal_for_per_game : 0),
          ga: acc.ga + (stats ? stats.goal_against_per_game : 0),
          winPct: acc.winPct + (stats ? stats.win_pctg : 0)
        };
      },
      { xgf: 0, xga: 0, sf: 0, sa: 0, gf: 0, ga: 0, winPct: 0 }
    );
    return {
      avgXgf: totals.xgf / count,
      avgXga: totals.xga / count,
      avgSf: totals.sf / count,
      avgSa: totals.sa / count,
      avgGoalFor: totals.gf / count,
      avgGoalAgainst: totals.ga / count,
      avgWinPct: totals.winPct / count
    };
  };

  // Pre-compute averages for each team
  const teamsAverages = teamData.map((team) => ({
    team,
    averages: computeAverages(team)
  }));

  // Define the metrics to display as rows
  const metricRows = [
    { label: "xGF", key: "avgXgf" },
    { label: "xGA", key: "avgXga" },
    { label: "SF", key: "avgSf" },
    { label: "SA", key: "avgSa" },
    { label: "GF", key: "avgGoalFor" },
    { label: "GA", key: "avgGoalAgainst" },
    { label: "Win%", key: "avgWinPct" }
  ];

  return (
    <div className={styles.container}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th
              colSpan={teamsAverages.length + 1}
              className={`${styles.headerLabelRow} ${styles.fullWidthHeader}`}
            >
              AVERAGE STATS OF OPPONENTS FACED THIS WEEK
            </th>
          </tr>
          <tr>
            {/* Empty top-left cell */}
            <th></th>
            {teamsAverages.map(({ team }) => (
              <th key={team.teamId}>
                <Image
                  src={`/teamLogos/${team.teamAbbreviation}.png`}
                  alt={team.teamAbbreviation || "Team Logo"}
                  width={25}
                  height={25}
                />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {metricRows.map((metric) => (
            <tr key={metric.key}>
              <td>{metric.label}</td>
              {teamsAverages.map(({ averages, team }) => {
                const value = averages[metric.key as keyof Averages];
                return (
                  <td key={team.teamId}>
                    {value != null ? value.toFixed(1) : "-"}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
