// components/GameGrid/OpponentMetricsTable.tsx
import React from "react";
import { TeamDataWithTotals } from "lib/NHL/types";
import useTeamStats from "hooks/useTeamStats";
import styles from "./GameGrid.module.scss";

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
  const teamStats = useTeamStats(); // keys: uppercase team abbreviations

  // For each team, compute averages based on its week1 opponents.
  // (You can change the logic to combine multiple weeks if needed.)
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
        // If no stats are found for an opponent, treat its value as 0.
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

  return (
    <table className={styles.opponentMetricsTable}>
      <thead>
        <tr>
          <th colSpan={7} className={styles.metricsHeader}>
            Opponent's Averaged Metrics
          </th>
        </tr>
        <tr>
          <th>Avg xGF</th>
          <th>Avg xGA</th>
          <th>Avg SF</th>
          <th>Avg SA</th>
          <th>Avg GF</th>
          <th>Avg GA</th>
          <th>Avg Win %</th>
        </tr>
      </thead>
      <tbody>
        {teamData.map((team) => {
          const averages = computeAverages(team);
          return (
            <tr key={team.teamId}>
              <td>
                {averages.avgXgf != null ? averages.avgXgf.toFixed(2) : "-"}
              </td>
              <td>
                {averages.avgXga != null ? averages.avgXga.toFixed(2) : "-"}
              </td>
              <td>
                {averages.avgSf != null ? averages.avgSf.toFixed(2) : "-"}
              </td>
              <td>
                {averages.avgSa != null ? averages.avgSa.toFixed(2) : "-"}
              </td>
              <td>
                {averages.avgGoalFor != null
                  ? averages.avgGoalFor.toFixed(2)
                  : "-"}
              </td>
              <td>
                {averages.avgGoalAgainst != null
                  ? averages.avgGoalAgainst.toFixed(2)
                  : "-"}
              </td>
              <td>
                {averages.avgWinPct != null
                  ? averages.avgWinPct.toFixed(2)
                  : "-"}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
