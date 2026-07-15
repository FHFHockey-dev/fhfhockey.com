const EIGHT_DIGIT_SEASON = /^\d{8}$/;
const SIX_DIGIT_GAME_SUFFIX = /^\d{6}$/;

export function buildNhlGameSummaryReportUrl(
  season: string | number,
  gameIdSuffix: string,
): string {
  const seasonFolder = String(season).trim();
  const suffix = gameIdSuffix.trim();

  if (!EIGHT_DIGIT_SEASON.test(seasonFolder)) {
    throw new Error("NHL HTML report season must be exactly eight digits.");
  }
  if (!SIX_DIGIT_GAME_SUFFIX.test(suffix)) {
    throw new Error("NHL HTML report game suffix must be exactly six digits.");
  }

  return `https://www.nhl.com/scores/htmlreports/${seasonFolder}/GS${suffix}.HTM`;
}
