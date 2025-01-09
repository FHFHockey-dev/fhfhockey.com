// /components/WiGO/TimeframeComparison.tsx

import React, { useState } from "react";
import styles from "./TimeframeComparison.module.scss";

interface TimeframeComparisonProps {
  onCompare: (left: string, right: string) => void;
}

const TIMEFRAME_OPTIONS = ["STD", "L5", "L10", "L20", "3YA", "CA"];

const TimeframeComparison: React.FC<TimeframeComparisonProps> = ({
  onCompare
}) => {
  // Default: STD on left, CA on right
  const [leftValue, setLeftValue] = useState<string>("STD");
  const [rightValue, setRightValue] = useState<string>("CA");

  const handleLeftChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    setLeftValue(val);
    onCompare(val, rightValue);
  };

  const handleRightChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    setRightValue(val);
    onCompare(leftValue, val);
  };

  return (
    <div className={styles.timeframeContainer}>
      <select
        className={styles.timeframeSelect}
        value={leftValue}
        onChange={handleLeftChange}
      >
        {TIMEFRAME_OPTIONS.map((opt) => (
          <option key={`left-${opt}`} value={opt}>
            {opt}
          </option>
        ))}
      </select>

      <span className={styles.vsText}>VS.</span>

      <select
        className={styles.timeframeSelect}
        value={rightValue}
        onChange={handleRightChange}
      >
        {TIMEFRAME_OPTIONS.map((opt) => (
          <option key={`right-${opt}`} value={opt}>
            {opt}
          </option>
        ))}
      </select>
    </div>
  );
};

export default TimeframeComparison;
