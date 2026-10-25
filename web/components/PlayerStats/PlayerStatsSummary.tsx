import React, { useMemo } from "react";
import styles from "./PlayerStats.module.scss";
import { PlayerStatsSummaryProps, STAT_DISPLAY_NAMES } from "./types";
import {
  aggregateSummaryStat,
  countAppearances,
  formatPlayerStat
} from "./playerStatsContract";

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

    // Check participation before filtering so unknown rows cannot disappear
    // from goalie ratios. Known nonappearances still stay outside the totals.
    const hasKnownParticipation = log.every((game) =>
      typeof game.games_played === "number" && Number.isFinite(game.games_played) && game.games_played >= 0
    );
    const appearances = log.filter((game) => Number(game.games_played) > 0);
    const totals: { [key: string]: number | null } = {};
    const gamesPlayed = countAppearances(log);

    selectedStats.forEach((stat) => {
      if (stat === "date" || stat === "games_played") return;
      totals[stat] = !hasKnownParticipation && (stat === "save_pct" || stat === "goals_against_avg")
        ? null
        : aggregateSummaryStat(appearances, stat);
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
              {formatPlayerStat(summary.totals[stat], stat)}
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
