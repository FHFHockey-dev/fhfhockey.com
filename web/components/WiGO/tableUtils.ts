// /Users/tim/Desktop/FHFH/fhfhockey.com/web/components/WiGO/tableUtils.ts

import { TableAggregateData } from "./types";
import {
  formatWigoStatValue,
  shouldUseGpForDiff
} from "./statMetadata";

/**
 * Computes the .DIFF property for each row in the tableData based on comparing leftKey vs. rightKey.
 * Applies per-game calculation for true counts and direct comparison for rates/averages/percentages.
 */
export function computeDiffColumn( // <<< NEW Unified Function
  tableData: TableAggregateData[],
  leftKey: keyof TableAggregateData,
  rightKey: keyof TableAggregateData
): TableAggregateData[] {
  if (!tableData || tableData.length === 0) {
    return [];
  }

  // Create a deep clone to avoid modifying the original array directly
  const updatedData = structuredClone(tableData);
  // Find the GP row *within the cloned data*
  const gpRow = updatedData.find((r) => r.label === "GP");

  updatedData.forEach((row) => {
    const leftVal = row[leftKey];
    const rightVal = row[rightKey];

    // Skip the GP row itself for DIFF calculation
    if (row.label === "GP") {
      row.DIFF = undefined;
      return;
    }

    // Check if values are valid numbers
    if (typeof leftVal === "number" && typeof rightVal === "number") {
      let diffBaseLeft: number | undefined = undefined;
      let diffBaseRight: number | undefined = undefined;

      // Determine the base values for comparison
      if (shouldUseGpForDiff(row.label)) {
        // --- Calculate per-game rate for true counts ---
        const gpLeft = gpRow ? gpRow[leftKey] : null;
        const gpRight = gpRow ? gpRow[rightKey] : null;

        // Check if GP values are valid numbers > 0
        if (
          typeof gpLeft === "number" &&
          gpLeft > 0 &&
          typeof gpRight === "number" &&
          gpRight > 0
        ) {
          diffBaseLeft = leftVal / gpLeft;
          diffBaseRight = rightVal / gpRight;
        }
        // If GP is invalid, diffBase remains undefined
      } else {
        // --- Use values directly for rates, averages (ATOI/PPTOI), percentages ---
        diffBaseLeft = leftVal;
        diffBaseRight = rightVal;
      }

      // Calculate percentage difference if base values are valid
      if (
        typeof diffBaseLeft === "number" &&
        typeof diffBaseRight === "number"
      ) {
        if (diffBaseRight !== 0) {
          const diff =
            ((diffBaseLeft - diffBaseRight) / Math.abs(diffBaseRight)) * 100; // Use Math.abs for consistent base
          // Assign if the result is a finite number
          row.DIFF = isFinite(diff) ? diff : undefined;
        } else {
          // Handle right value being 0
          row.DIFF = diffBaseLeft !== 0 ? undefined : 0; // If left is non-zero -> infinite change (undefined), if left is 0 -> 0% change
        }
      } else {
        // If base values couldn't be determined (e.g., invalid GP)
        row.DIFF = undefined;
      }
    } else {
      // If leftVal or rightVal is not a number
      row.DIFF = undefined;
    }
  });
  return updatedData; // Return the modified clone
}

// Remove the old separate functions if no longer needed elsewhere
// export function computeDiffColumnForCounts(...) { ... }
// export function computeDiffColumnForRates(...) { ... }

/**
 * Format cell values for display based on the statistic label.
 * Assumes time values (ATOI, PPTOI) are consistently in average seconds per game.
 * Assumes percentage values (S%, PP%, etc.) are consistently scaled 0-100.
 */
export const formatCell = (
  row: TableAggregateData,
  columnKey: keyof Omit<TableAggregateData, "label" | "GP" | "DIFF">
): string => {
  const value = row[columnKey];
  return formatWigoStatValue(row.label, value);
};

/**
 * Simple function to format seconds as MM:SS
 */
export const formatSecondsToMMSS = (seconds: number): string => {
  const totalSeconds = Math.round(seconds);
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${mins}:${secs < 10 ? "0" : ""}${secs}`;
};
