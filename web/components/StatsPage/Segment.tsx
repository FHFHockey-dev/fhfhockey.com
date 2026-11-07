// /components/leaderboard/Segment.tsx

import React from "react";
import styles from "styles/Stats.module.scss";

// Validated categorical slots for the 3-part leader bars (G/A1/A2, ESG/PPG/SHG,
// B/S/H) on the dark rows: brand blue, amber, violet. No status red for a series.
export const PART_COLORS = ["#1590c4", "#c98500", "#9085e9"] as const;

interface SegmentProps {
  flexValue: number;
  color: string;
  label: string;
  isFirst: boolean;
  isLast: boolean;
}

const Segment: React.FC<SegmentProps> = ({
  flexValue,
  color,
  label,
  isFirst,
  isLast
}) => {
  if (flexValue <= 0) return null;
  return (
    <div className={styles.segmentContainer} style={{ flex: flexValue }}>
      <div className={styles.segmentCore} style={{ backgroundColor: color }}>
        <span className={styles.segmentLabel}>{label}</span>
      </div>
      {!isFirst && (
        <div
          className={styles.leftTriangle}
          style={{ borderBottomColor: color }}
        />
      )}
      {!isLast && (
        <div
          className={styles.rightTriangle}
          style={{ borderTopColor: color }}
        />
      )}
    </div>
  );
};

export default Segment;
