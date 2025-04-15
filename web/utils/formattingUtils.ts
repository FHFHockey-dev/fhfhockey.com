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
