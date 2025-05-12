// /Users/tim/Desktop/fhfhockey.com/web/lib/projectionsConfig/formatTotalSecondsToMMSS.ts

export const formatTotalSecondsToMMSS = (
  totalSecondsInput: number | null | undefined
): string => {
  if (
    totalSecondsInput === null ||
    totalSecondsInput === undefined ||
    Number.isNaN(totalSecondsInput) ||
    totalSecondsInput < 0
  ) {
    return "-";
  }

  const minutes = Math.floor(totalSecondsInput / 60);
  const seconds = Math.floor(totalSecondsInput % 60);

  const mm = String(minutes).padStart(2, "0");
  const ss = String(seconds).padStart(2, "0");

  return `${mm}:${ss}`;
};