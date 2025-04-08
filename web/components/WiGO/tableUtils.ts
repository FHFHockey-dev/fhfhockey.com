// /Users/tim/Desktop/FHFH/fhfhockey.com/web/components/WiGO/tableUtils.ts

import { TableAggregateData } from "./types";

/**
 * Helper that takes the tableData for counts
 * and updates the .DIFF property based on comparing leftKey vs. rightKey
 * as a per-game difference.
 */
export function computeDiffColumnForCounts(
  tableData: TableAggregateData[],
  leftKey: keyof TableAggregateData,
  rightKey: keyof TableAggregateData
): TableAggregateData[] {
  // Create a deep clone to avoid modifying the original array directly
  const updatedData = structuredClone(tableData);
  const gpRow = updatedData.find((r) => r.label === "GP");

  updatedData.forEach((row) => {
    const leftVal = row[leftKey];
    const rightVal = row[rightKey];

    // If it's the "GP" row itself, we might skip or just set DIFF=undefined
    if (row.label === "GP") {
      row.DIFF = undefined;
      return;
    }

    // Safely get the GP # for each timeframe
    const gpLeft = gpRow ? gpRow[leftKey] : 0;
    const gpRight = gpRow ? gpRow[rightKey] : 0;

    if (
      typeof leftVal === "number" &&
      typeof rightVal === "number" &&
      typeof gpLeft === "number" &&
      typeof gpRight === "number" &&
      gpLeft > 0 &&
      gpRight > 0 // Avoid division by zero
    ) {
      const perGameLeft = leftVal / gpLeft;
      const perGameRight = rightVal / gpRight;
      // Avoid division by zero if perGameRight is 0
      row.DIFF =
        perGameRight !== 0
          ? ((perGameLeft - perGameRight) / perGameRight) * 100
          : undefined;
    } else {
      row.DIFF = undefined;
    }
  });
  return updatedData; // Return the modified clone
}

/**
 * Helper that takes the tableData for rates
 * and updates the .DIFF property based on comparing leftKey vs. rightKey
 * directly as a percentage difference.
 */
export function computeDiffColumnForRates(
  tableData: TableAggregateData[],
  leftKey: keyof TableAggregateData,
  rightKey: keyof TableAggregateData
): TableAggregateData[] {
  // Create a deep clone
  const updatedData = structuredClone(tableData);

  updatedData.forEach((row) => {
    const leftVal = row[leftKey];
    const rightVal = row[rightKey];

    if (
      typeof leftVal === "number" &&
      typeof rightVal === "number" &&
      rightVal !== 0 // Avoid division by zero
    ) {
      row.DIFF = ((leftVal - rightVal) / rightVal) * 100;
    } else {
      row.DIFF = undefined;
    }
  });
  return updatedData; // Return the modified clone
}

/**
 * Simple function to format seconds as MM:SS
 */
export const formatSecondsToMMSS = (seconds: number): string => {
  const totalSeconds = Math.round(seconds);
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${mins}:${secs < 10 ? "0" : ""}${secs}`;
};

/**
 * Format cell values for display based on the statistic label.
 */
export const formatCell = (label: string, value?: number): string => {
  if (value == null || isNaN(value)) return "-"; // Handle null, undefined, and NaN
  switch (label) {
    case "ATOI":
    case "PPTOI":
      return formatSecondsToMMSS(value);
    case "PP%":
      // Assuming PP% is stored like 61.6 for 61.6%
      return `${value.toFixed(1)}%`; // Keep one decimal place for PP%
    default:
      // Check if the number is an integer
      if (Number.isInteger(value)) {
        return value.toString(); // Display integers without decimals
      }
      return value.toFixed(2); // Default to 2 decimal places for other stats
  }
};
