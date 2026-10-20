import React, { useId } from "react";
import { STAT_DISPLAY_NAMES, TimeFrame } from "./types";
import styles from "./PlayerPageShell.module.scss";

export const TIME_FRAME_LABELS: Record<Exclude<TimeFrame, "custom">, string> = {
  season: "Full Season",
  last10: "Last 10",
  last20: "Last 20",
  last30: "Last 30"
};

interface PlayerStatControlsProps {
  timeFrame: TimeFrame;
  onTimeFrameChange: (frame: TimeFrame) => void;
  groups: { label: string; stats: string[] }[];
  selectedStats: string[];
  onToggleStat: (stat: string) => void;
}

/**
 * Compact control bar: the game window as a segmented toggle and every
 * statistic choice in one disclosure whose summary lists the active picks.
 */
export function PlayerStatControls({
  timeFrame,
  onTimeFrameChange,
  groups,
  selectedStats,
  onToggleStat
}: PlayerStatControlsProps) {
  const windowLabelId = useId();
  return (
    <div className={styles.controlBar}>
      <div className={styles.controlGroup}>
        <span className={styles.controlLabel} id={windowLabelId}>
          Time period
        </span>
        <div
          className={styles.segmented}
          role="group"
          aria-labelledby={windowLabelId}
        >
          {(Object.keys(TIME_FRAME_LABELS) as (keyof typeof TIME_FRAME_LABELS)[]).map(
            (frame) => (
              <button
                key={frame}
                type="button"
                className={styles.segment}
                aria-pressed={timeFrame === frame}
                onClick={() => onTimeFrameChange(frame)}
              >
                {TIME_FRAME_LABELS[frame]}
              </button>
            )
          )}
        </div>
      </div>

      <details className={`${styles.controlGroup} ${styles.statDisclosure}`}>
        <summary>
          <span className={styles.controlLabel}>
            Statistics · {selectedStats.length} selected
          </span>
          <span className={styles.selectedChips}>
            {selectedStats.map((stat) => (
              <span key={stat} className={styles.chip}>
                {STAT_DISPLAY_NAMES[stat] || stat}
              </span>
            ))}
          </span>
        </summary>
        <div className={styles.statGroups}>
          {groups.map((group) => (
            <fieldset key={group.label} className={styles.statGroup}>
              <legend>{group.label}</legend>
              <div className={styles.statOptions}>
                {group.stats.map((stat) => (
                  <label key={stat} className={styles.statOption}>
                    <input
                      type="checkbox"
                      checked={selectedStats.includes(stat)}
                      onChange={() => onToggleStat(stat)}
                    />
                    {stat.replace(/_/g, " ").toUpperCase()}
                  </label>
                ))}
              </div>
            </fieldset>
          ))}
        </div>
      </details>
    </div>
  );
}
