// /Users/tim/Desktop/fhfhockey.com/web/lib/projectionsConfig/formatToMMSS.ts
// This function now expects DECIMAL MINUTES as input.

export const formatToMMSS = (
  decimalMinutes: number | null | undefined
): string => {
  if (
    decimalMinutes === null ||
    decimalMinutes === undefined ||
    Number.isNaN(decimalMinutes) ||
    decimalMinutes < 0
  ) {
    return "-";
  }

  let totalMinutes = Math.floor(decimalMinutes);
  const fractionalPart = decimalMinutes - totalMinutes;
  let seconds = Math.round(fractionalPart * 60);

  // Handle rounding of seconds that results in 60
  if (seconds === 60) {
    totalMinutes += 1;
    seconds = 0;
  }

  const mm = String(totalMinutes).padStart(2, "0");
  const ss = String(seconds).padStart(2, "0");

  return `${mm}:${ss}`;
};
