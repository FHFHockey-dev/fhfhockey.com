import React, { useMemo } from "react";
import styles from "./PlayerStats.module.scss";
import {
  PlayerStatsSummaryProps,
  formatStatValue,
  STAT_DISPLAY_NAMES,
  PERCENTAGE_STATS,
  PER_60_STATS,
  PER_GAME_STATS
} from "./types";

export function PlayerStatsSummary({
  gameLog,
  playoffGameLog,
  selectedStats,
  isGoalie,
  showPlayoffData = false
}: PlayerStatsSummaryProps) {
  const summary = useMemo(() => {
    const log = showPlayoffData && playoffGameLog ? playoffGameLog : gameLog;

    if (log.length === 0) return null;

    const totals: { [key: string]: number } = {};
    const gamesPlayed = log.reduce(
      (sum, game) => sum + (game.games_played || 0),
      0
    );

    selectedStats.forEach((stat) => {
      if (stat === "date" || stat === "games_played") return;

      const values = log.map((game) => Number(game[stat]) || 0);

      // For percentages, calculate weighted average
      if (PERCENTAGE_STATS.includes(stat as any)) {
        const weights = log.map((game) => game.games_played || 1);
        const weightedSum = values.reduce(
          (sum, val, idx) => sum + val * weights[idx],
          0
        );
        const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
        totals[stat] = totalWeight > 0 ? weightedSum / totalWeight : 0;
      } else if (
        PER_60_STATS.includes(stat as any) ||
        PER_GAME_STATS.includes(stat as any)
      ) {
        // For per-60 and per-game stats, calculate simple average across games where player played
        const validValues = values.filter((val) => val > 0);
        totals[stat] =
          validValues.length > 0
            ? validValues.reduce((sum, val) => sum + val, 0) /
              validValues.length
            : 0;
      } else {
        // For counting stats (goals, assists, points, etc.), sum them up
        totals[stat] = values.reduce((sum, val) => sum + val, 0);
      }
    });

    return { totals, gamesPlayed };
  }, [gameLog, playoffGameLog, selectedStats, showPlayoffData]);

  if (!summary || summary.gamesPlayed === 0) {
    return null;
  }

  return (
    <div className={styles.summarySection}>
      <h3>Season Summary</h3>
      <div className={styles.summaryGrid}>
        {selectedStats.map((stat) => (
          <div key={stat} className={styles.summaryCard}>
            <div className={styles.summaryLabel}>
              {STAT_DISPLAY_NAMES[stat] || stat}
            </div>
            <div className={styles.summaryValue}>
              {formatStatValue(summary.totals[stat] || 0, stat)}
            </div>
            <div className={styles.summaryDescription}>
              {summary.gamesPlayed} games played
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
