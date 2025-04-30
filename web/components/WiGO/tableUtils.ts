// /Users/tim/Desktop/FHFH/fhfhockey.com/web/components/WiGO/tableUtils.ts

import {
  formatMinutesToMMSS,
  formatSecondsToMMSS as formatSecondsUtil
} from "utils/formattingUtils"; // Use a consistent name
import { TableAggregateData } from "./types";

// --- <<< NEW: Define labels needing per-game DIFF calculation >>> ---
// These are stats typically stored as cumulative totals for STD/LY/CA/3YA,
// requiring division by GP for a meaningful comparison across those timeframes.
const trueCountLabelsForDiff = new Set([
  "Goals",
  "Assists",
  "Points",
  "SOG",
  "ixG",
  "PPG",
  "PPA",
  "PPP",
  "HIT",
  "BLK",
  "PIM",
  "iCF"
  // Note: ATOI/PPTOI are handled separately as they become averages.
  // Note: IPP, OZS%, oiSH%, S%, PP% are percentages/rates already.
]);

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
      if (trueCountLabelsForDiff.has(row.label)) {
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
  const label = row.label;

  // Handle null, undefined, or non-numeric values first
  if (value == null || typeof value !== "number" || isNaN(value)) {
    return "-";
  }

  // --- Time Formatting ---
  // Assumes fetchPlayerAggregatedStats now ensures these are avg SECONDS/game
  if (label === "ATOI" || label === "PPTOI") {
    return formatSecondsUtil(value); // Use the seconds formatter
  }

  // --- Percentage Formatting ---
  // Assumes fetchPlayerAggregatedStats ensures these are scaled 0-100
  if (
    label === "S%" ||
    label === "PP%" ||
    label === "oiSH%" ||
    label === "IPP" ||
    label === "OZS%" ||
    label === "PTS1%"
  ) {
    // Also catch dynamic percentages if needed: || label.endsWith('%') || label.endsWith('_pct')
    return `${value.toFixed(1)}%`;
  }

  // --- Rate Formatting ---
  if (label.includes("/60")) {
    return value.toFixed(2); // Typically show 2 decimal places for /60 rates
  }

  // --- Integer Count Formatting ---
  // Add any other known integer counts if needed
  if (
    label === "GP" ||
    label === "Goals" ||
    label === "Assists" ||
    label === "Points" ||
    label === "SOG" ||
    label === "PPG" ||
    label === "PPA" ||
    label === "PPP" ||
    label === "HIT" ||
    label === "BLK" ||
    label === "PIM" ||
    label === "iCF"
  ) {
    // Check if it's effectively an integer (within tolerance for floating point issues if needed)
    // Or just round if values might have decimals from averaging (e.g., L5 GP)
    return Math.round(value).toString();
  }

  // --- Default Formatting ---
  // For other numbers (like ixG, potentially some averages not caught above)
  // Default to 1 decimal place
  return value.toFixed(1);
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
