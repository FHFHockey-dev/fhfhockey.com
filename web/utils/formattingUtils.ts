/**
 * Formats total minutes into MM:SS format.
 * Example: 18.75 => "18:45"
 * Example: 5.5 => "05:30"
 */
export const formatMinutesToMMSS = (
  totalMinutes: number | null | undefined
): string => {
  if (
    totalMinutes === null ||
    totalMinutes === undefined ||
    isNaN(totalMinutes) ||
    totalMinutes < 0
  ) {
    return "--:--"; // Or "00:00" or handle as needed
  }

  const totalSeconds = Math.round(totalMinutes * 60); // Convert to total seconds and round
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  const paddedMinutes = String(minutes).padStart(2, "0");
  const paddedSeconds = String(seconds).padStart(2, "0");

  return `${paddedMinutes}:${paddedSeconds}`;
};

/**
 * Formats a date string (YYYY-MM-DD) to MM/DD format.
 */
export const formatDateToMMDD = (
  dateString: string | null | undefined
): string => {
  if (!dateString) return "";
  try {
    const date = new Date(dateString + "T00:00:00"); // Add time part to avoid timezone issues
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${month}/${day}`;
  } catch (e) {
    console.error("Error formatting date:", dateString, e);
    return "";
  }
};

/**
 * Formats total seconds into MM:SS format.
 * Example: 1125 => "18:45"
 * Example: 330 => "05:30"
 * Example: 1200 => "20:00"
 */
export const formatSecondsToMMSS = (
  totalSecondsInput: number | null | undefined
): string => {
  if (
    totalSecondsInput === null ||
    totalSecondsInput === undefined ||
    isNaN(totalSecondsInput) ||
    totalSecondsInput < 0
  ) {
    return "--:--"; // Or "00:00" or handle as needed
  }

  // Input is already seconds. Round it in case it's a double precision value representing seconds.
  const totalSeconds = Math.round(totalSecondsInput);

  // Calculate minutes and remaining seconds
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  // Pad with leading zeros if necessary
  const paddedMinutes = String(minutes).padStart(2, "0");
  const paddedSeconds = String(seconds).padStart(2, "0");

  return `${paddedMinutes}:${paddedSeconds}`;
};

/**
 * Formats time on ice from seconds to MM:SS format.
 * This is specifically for hockey TOI data that comes from the database as seconds.
 * Example: 1125 seconds => "18:45"
 * Example: 330 seconds => "05:30"
 */
export const formatTOIFromSeconds = (
  totalSecondsInput: number | null | undefined
): string => {
  if (
    totalSecondsInput === null ||
    totalSecondsInput === undefined ||
    isNaN(totalSecondsInput) ||
    totalSecondsInput < 0
  ) {
    return "0:00";
  }

  // Input is already seconds. Round it in case it's a double precision value representing seconds.
  const totalSeconds = Math.round(totalSecondsInput);

  // Calculate minutes and remaining seconds
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  // Format as M:SS (no leading zero for minutes, but leading zero for seconds)
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
};

/**
 * Formats time on ice from seconds to MM:SS format with leading zeros for minutes.
 * This ensures consistent MM:SS formatting for display purposes.
 * Example: 1125 seconds => "18:45"
 * Example: 330 seconds => "05:30"
 */
export const formatTOIFromSecondsWithLeadingZero = (
  totalSecondsInput: number | null | undefined
): string => {
  if (
    totalSecondsInput === null ||
    totalSecondsInput === undefined ||
    isNaN(totalSecondsInput) ||
    totalSecondsInput < 0
  ) {
    return "00:00";
  }

  // Input is already seconds. Round it in case it's a double precision value representing seconds.
  const totalSeconds = Math.round(totalSecondsInput);

  // Calculate minutes and remaining seconds
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  // Format as MM:SS with leading zeros
  const paddedMinutes = String(minutes).padStart(2, "0");
  const paddedSeconds = String(seconds).padStart(2, "0");

  return `${paddedMinutes}:${paddedSeconds}`;
};

/**
 * Calculates rolling average for a dataset.
 * @param data Array of data points.
 * @param windowSize The number of data points to include in the average.
 * @param getValue Function to extract the numeric value from a data point.
 * @returns Array of rolling averages (or null if not enough data).
 */
export function calculateRollingAverage<T>(
  data: T[],
  windowSize: number,
  getValue: (item: T) => number | null | undefined
): (number | null)[] {
  if (!data || data.length === 0 || windowSize <= 0) {
    return [];
  }

  return data.map((_, index) => {
    if (index < windowSize - 1) {
      return null; // Not enough data points for the window yet
    }
    const window = data.slice(index - windowSize + 1, index + 1);
    let sum = 0;
    let count = 0;
    for (const item of window) {
      const value = getValue(item);
      if (value !== null && value !== undefined && !isNaN(value)) {
        sum += value;
        count++;
      }
    }
    // Return null if the window had no valid data points
    return count > 0 ? sum / count : null;
  });
}

/**
 * Formats a number into a percentage string with one decimal place.
 * Example: 0.153 => "15.3%"
 */
export const formatPercentage = (value: number | null | undefined): string => {
  if (value === null || value === undefined || isNaN(value)) {
    return "-%"; // Or "0.0%"
  }
  return `${(value * 100).toFixed(1)}%`;
};

/**
 * Converts a number into an ordinal string (e.g., 1 -> "1st", 2 -> "2nd").
 * Returns null if the input is null or not a positive integer.
 */
export function formatOrdinal(rank: number | null): string | null {
  if (rank === null || rank <= 0 || !Number.isInteger(rank)) {
    return null; // Or return 'N/A', '-', etc. based on preference
  }

  const j = rank % 10;
  const k = rank % 100;

  if (j === 1 && k !== 11) {
    return rank + "st";
  }
  if (j === 2 && k !== 12) {
    return rank + "nd";
  }
  if (j === 3 && k !== 13) {
    return rank + "rd";
  }
  return rank + "th";
}
