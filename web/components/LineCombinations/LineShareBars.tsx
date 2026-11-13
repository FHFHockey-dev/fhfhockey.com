import React from "react";

import type { SkaterStats } from "pages/lines/[abbreviation]";
import type { LineSource } from "components/LineCombinations/utilities";

import styles from "./LineShareBars.module.scss";

type LineShareBarsProps = {
  lines: Array<{
    label: string;
    players: SkaterStats[];
    /** The unit's 5v5 clock seconds together in the last game (5v5 board only). */
    fiveOnFiveSeconds?: number | null;
  }>;
  /**
   * On the 5v5 board, ice time share is each unit's 5v5 time together in the
   * last game; on the legacy board (the default), its players' all-strength
   * TOI per game played.
   */
  lineSource?: LineSource;
};

function isKnown(value: number | null | undefined): value is number {
  return value != null && Number.isFinite(value);
}

/**
 * A line's ice time: the mean of its players' all-strength TOI per game played,
 * so a player who dressed for fewer of the games, or a line with fewer players,
 * does not read as less ice time. Null when any player's TOI or games are
 * unknown (never 0).
 */
function lineToiPerGame(players: SkaterStats[]): number | null {
  if (players.length === 0) return null;
  let sum = 0;
  for (const { TOISeconds, numGames } of players) {
    if (!isKnown(TOISeconds) || !isKnown(numGames) || numGames <= 0) return null;
    sum += TOISeconds / numGames;
  }
  return sum / players.length;
}

/** Goals by the line's players over the window; null when any is unknown. */
function lineGoals(players: SkaterStats[]): number | null {
  let sum = 0;
  for (const { Goals } of players) {
    if (!isKnown(Goals)) return null;
    sum += Goals;
  }
  return sum;
}

/**
 * Each line's share of the lines' total. An empty line has no share; one
 * unknown line leaves the total unknown, so every share is withheld.
 */
function toShares(values: Array<number | null>, players: SkaterStats[][]) {
  const counted = values.filter((_, index) => players[index].length > 0);
  if (counted.some((value) => value === null)) return values.map(() => null);
  const total = (counted as number[]).reduce((sum, value) => sum + value, 0);
  return values.map((value, index) =>
    players[index].length > 0 && value !== null && total > 0 ? value / total : null
  );
}

function formatShare(share: number | null) {
  return share === null ? "—" : `${(share * 100).toFixed(1)}%`;
}

export default function LineShareBars({
  lines,
  lineSource = "all_strength_legacy"
}: LineShareBarsProps) {
  const fiveOnFive = lineSource === "five_on_five_observed";
  const players = lines.map((line) => line.players);
  const toiShares = toShares(
    fiveOnFive
      ? lines.map(({ fiveOnFiveSeconds }) => (isKnown(fiveOnFiveSeconds) ? fiveOnFiveSeconds : null))
      : players.map(lineToiPerGame),
    players
  );
  const toiLabel = fiveOnFive ? "5v5 time share" : "Ice time share";
  const goalShares = toShares(players.map(lineGoals), players);
  const toiWithheld = lines.some(
    (line, index) => line.players.length > 0 && toiShares[index] === null
  );

  return (
    <section className={styles.wrapper} aria-labelledby="line-share-title">
      <header className={styles.header}>
        <h3 id="line-share-title" className={styles.title}>Recent line share</h3>
        {fiveOnFive ? (
          <p className={styles.description}>
            5v5 time share is each line&apos;s 5v5 time together in the last game. Goal share
            counts its players&apos; goals over the team&apos;s last 10 games with lines, at all
            strengths, including goals away from this line.
          </p>
        ) : (
          <p className={styles.description}>
            Over the team&apos;s last 10 games with lines, at all strengths. Ice time share
            compares each line&apos;s average ice time per game played; goal share counts its
            players&apos; goals. Both include time and goals away from this line.
          </p>
        )}
        {toiWithheld ? (
          <p className={styles.description}>
            {fiveOnFive
              ? "5v5 time share is unavailable: a line's 5v5 time is missing."
              : "Ice time share is unavailable: a player's ice time is missing."}
          </p>
        ) : null}
      </header>

      <div className={styles.rows}>
        {lines.map((line, index) => {
          const toiShare = toiShares[index];
          const goalShare = goalShares[index];

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
                  <span>{toiLabel}</span>
                  <strong>{formatShare(toiShare)}</strong>
                </div>
                <div className={styles.track}>
                  {toiShare === null ? null : (
                    <div
                      className={styles.fillTime}
                      style={{ width: `${toiShare * 100}%` }}
                    />
                  )}
                </div>
              </div>

              <div className={styles.metricBlock}>
                <div className={styles.metricHeader}>
                  <span>Goal share</span>
                  <strong>{formatShare(goalShare)}</strong>
                </div>
                <div className={styles.track}>
                  {goalShare === null ? null : (
                    <div
                      className={styles.fillGoals}
                      style={{ width: `${goalShare * 100}%` }}
                    />
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
