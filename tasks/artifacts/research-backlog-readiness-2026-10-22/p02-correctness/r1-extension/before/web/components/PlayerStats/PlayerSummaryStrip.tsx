import React, { useMemo } from "react";
import { GameLogEntry } from "./types";
import {
  aggregateSummaryStat,
  formatPlayerStat,
  isAppearance
} from "./playerStatsContract";
import styles from "./PlayerPageShell.module.scss";

interface PlayerSummaryStripProps {
  gameLog: GameLogEntry[];
  isGoalie: boolean;
  windowLabel: string;
}

type Metric = {
  label: string;
  stat: string;
  tone?: "volume" | "rate";
  note?: (value: number | null, games: number) => string;
};

const perGame = (value: number | null, games: number) =>
  value === null || games === 0 ? "" : `${(value / games).toFixed(2)} / GP`;

const SKATER_METRICS: Metric[] = [
  { label: "Goals", stat: "goals", tone: "volume", note: perGame },
  { label: "Assists", stat: "assists", tone: "volume", note: perGame },
  { label: "Points", stat: "points", tone: "volume", note: perGame },
  { label: "Shots", stat: "shots", tone: "volume", note: perGame },
  { label: "SH%", stat: "shooting_percentage", tone: "rate", note: () => "Goals ÷ shots" },
  { label: "TOI / GP", stat: "toi_per_game", tone: "rate" },
  { label: "PP points", stat: "pp_points", tone: "volume", note: perGame }
];

const GOALIE_METRICS: Metric[] = [
  { label: "Wins", stat: "wins", tone: "volume" },
  { label: "SV%", stat: "save_pct", tone: "rate", note: () => "Saves ÷ shots against" },
  { label: "GAA", stat: "goals_against_avg", tone: "rate" },
  { label: "Shutouts", stat: "shutouts", tone: "volume" },
  { label: "Shots against", stat: "shots_against", tone: "volume", note: perGame }
];

const COUNT_STATS = new Set([
  "goals",
  "assists",
  "points",
  "shots",
  "pp_points",
  "wins",
  "shutouts",
  "shots_against"
]);

/**
 * Compact answers first: the selected window's headline figures, built with
 * the same contract helpers as the Trends summary so the tabs agree.
 */
export function PlayerSummaryStrip({
  gameLog,
  isGoalie,
  windowLabel
}: PlayerSummaryStripProps) {
  const { games, values } = useMemo(() => {
    const appearances = gameLog.filter(isAppearance);
    const metrics = isGoalie ? GOALIE_METRICS : SKATER_METRICS;
    return {
      games: appearances.length,
      values: metrics.map((metric) => ({
        metric,
        value: aggregateSummaryStat(appearances, metric.stat)
      }))
    };
  }, [gameLog, isGoalie]);

  return (
    <section
      className={styles.metrics}
      aria-label={`Summary, ${windowLabel}`}
      data-count={values.length + 1}
      style={{ "--metric-count": values.length + 1 } as React.CSSProperties}
    >
      <article className={styles.metric}>
        <span className={styles.metricLabel}>Games</span>
        <strong className={styles.metricValue}>{games}</strong>
        <small className={styles.metricNote}>{windowLabel}</small>
      </article>
      {values.map(({ metric, value }) => (
        <article
          key={metric.stat}
          className={styles.metric}
          data-tone={metric.tone}
        >
          <span className={styles.metricLabel}>{metric.label}</span>
          <strong className={styles.metricValue}>
            {value === null
              ? "-"
              : COUNT_STATS.has(metric.stat)
                ? String(value)
                : formatPlayerStat(value, metric.stat)}
          </strong>
          <small className={styles.metricNote}>
            {metric.note?.(value, games) || " "}
          </small>
        </article>
      ))}
    </section>
  );
}
