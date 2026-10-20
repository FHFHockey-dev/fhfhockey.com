import React from "react";
import styles from "./PlayerStats.module.scss";

interface PlayerStatsAdvancedNoteProps {
  showAdvanced?: boolean;
}

const GLOSSARY: [string, string][] = [
  ["CF%", "Corsi For Percentage - Shot attempts for vs total shot attempts while on ice"],
  ["FF%", "Fenwick For Percentage - Unblocked shot attempts for vs total while on ice"],
  ["xGF%", "Expected Goals For Percentage - Expected goals for vs total while on ice"],
  ["HDCF%", "High Danger Corsi For Percentage - High danger shot attempts for vs total"],
  ["Per 60 stats", "Individual stats projected per 60 minutes of ice time"],
  ["PDO", "On-ice shooting percentage + on-ice save percentage (luck indicator)"],
  ["Zone Start%", "Percentage of shifts starting in offensive/defensive zones"]
];

/** Source note and glossary as one compact disclosure (RSO details pattern). */
export function PlayerStatsAdvancedNote({
  showAdvanced = false
}: PlayerStatsAdvancedNoteProps) {
  if (!showAdvanced) return null;

  return (
    <details className={styles.advancedNote}>
      <summary>
        <span className={styles.advancedNoteTitle}>Advanced statistics</span>
        <span className={styles.advancedNoteHint}>
          NST possession and per-60 data · glossary
        </span>
      </summary>
      <div className={styles.advancedNoteContent}>
        <p>
          <strong>NST Data:</strong> Possession metrics (CF%, xGF%, HDCF%), zone
          entries, and individual impact measurements.
        </p>
        <p>
          <strong>Key Metrics:</strong> Per-60 minute rates that normalize for
          ice time and provide deeper insights beyond traditional stats.
        </p>
        <dl className={styles.advancedGlossary}>
          {GLOSSARY.map(([term, definition]) => (
            <div key={term}>
              <dt>{term}</dt>
              <dd>{definition}</dd>
            </div>
          ))}
        </dl>
      </div>
    </details>
  );
}
