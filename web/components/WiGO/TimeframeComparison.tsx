// /components/WiGO/TimeframeComparison.tsx

import React, { useState, useEffect } from "react";
import styles from "./TimeframeComparison.module.scss"; // Make sure this path is correct

// Define the available timeframe options
const TIMEFRAME_OPTIONS = ["STD", "L5", "L10", "L20", "LY", "3YA", "CA"]; // Added LY based on table headers

interface TimeframeComparisonProps {
  onCompare: (left: string, right: string) => void;
  initialLeft?: string;
  initialRight?: string;
}

const TimeframeComparison: React.FC<TimeframeComparisonProps> = ({
  onCompare,
  initialLeft = "STD", // Default if not provided
  initialRight = "CA" // Default if not provided
}) => {
  const [leftValue, setLeftValue] = useState<string>(initialLeft);
  const [rightValue, setRightValue] = useState<string>(initialRight);

  // Reset left state if initial prop changes (e.g., on new player selection)
  useEffect(() => {
    // Only update if the prop actually changes from the current state
    if (initialLeft !== leftValue) {
      setLeftValue(initialLeft);
    }
  }, [initialLeft, leftValue]); // Include leftValue in dependency array for check

  // Reset right state if initial prop changes
  useEffect(() => {
    // Only update if the prop actually changes from the current state
    if (initialRight !== rightValue) {
      setRightValue(initialRight);
    }
  }, [initialRight, rightValue]); // Include rightValue in dependency array for check

  // Define the handler for the left dropdown change
  const handleLeftChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newLeftValue = e.target.value;
    setLeftValue(newLeftValue);
    // Call the comparison function with the new left value and current right value
    onCompare(newLeftValue, rightValue);
  };

  // Define the handler for the right dropdown change
  const handleRightChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newRightValue = e.target.value;
    setRightValue(newRightValue);
    // Call the comparison function with the current left value and new right value
    onCompare(leftValue, newRightValue);
  };

  return (
    <div className={styles.timeframeContainer}>
      <select
        className={styles.timeframeSelect}
        value={leftValue}
        onChange={handleLeftChange} // Assign the handler
        aria-label="Select left timeframe for comparison"
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
        onChange={handleRightChange} // Assign the handler
        aria-label="Select right timeframe for comparison"
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
