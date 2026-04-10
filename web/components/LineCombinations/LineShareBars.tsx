import React from "react";

import type { SkaterStats } from "pages/lines/[abbreviation]";

import styles from "./LineShareBars.module.scss";

type LineShareBarsProps = {
  lines: Array<{
    label: string;
    players: SkaterStats[];
  }>;
};

function toShare(value: number, total: number) {
  if (!Number.isFinite(value) || total <= 0) {
    return 0;
  }

  return value / total;
}

export default function LineShareBars({ lines }: LineShareBarsProps) {
  const lineRows = lines.map((line) => {
    const toiSeconds = line.players.reduce(
      (sum, player) => sum + (player.TOISeconds ?? 0),
      0
    );
    const goals = line.players.reduce((sum, player) => sum + (player.Goals ?? 0), 0);
    return {
      ...line,
      toiSeconds,
      goals,
    };
  });

  const totalToi = lineRows.reduce((sum, line) => sum + line.toiSeconds, 0);
  const totalGoals = lineRows.reduce((sum, line) => sum + line.goals, 0);

  return (
    <section className={styles.wrapper}>
      <header className={styles.header}>
        <h3 className={styles.title}>Recent Line Share</h3>
        <p className={styles.description}>
          Last tracked sample share for forward-line ice time and goal production.
        </p>
      </header>

      <div className={styles.rows}>
        {lineRows.map((line) => {
          const toiShare = toShare(line.toiSeconds, totalToi);
          const goalShare = toShare(line.goals, totalGoals);

          return (
            <div key={line.label} className={styles.row}>
              <div className={styles.meta}>
                <span className={styles.label}>{line.label}</span>
                <span className={styles.players}>
                  {line.players.map((player) => player.playerName.split(" ").slice(-1)[0]).join(" / ")}
                </span>
              </div>

              <div className={styles.metricBlock}>
                <div className={styles.metricHeader}>
                  <span>Timeshare</span>
                  <strong>{(toiShare * 100).toFixed(1)}%</strong>
                </div>
                <div className={styles.track}>
                  <div
                    className={styles.fillTime}
                    style={{ width: `${toiShare * 100}%` }}
                  />
                </div>
              </div>

              <div className={styles.metricBlock}>
                <div className={styles.metricHeader}>
                  <span>Goal Share</span>
                  <strong>{(goalShare * 100).toFixed(1)}%</strong>
                </div>
                <div className={styles.track}>
                  <div
                    className={styles.fillGoals}
                    style={{ width: `${goalShare * 100}%` }}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
