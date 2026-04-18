import { endOfDay, isAfter, parseISO } from "date-fns";

type PlayoffSeasonWindow = {
  regularSeasonEndDate: string;
  seasonEndDate: string;
};

function parseSeasonBoundary(value: string) {
  return endOfDay(parseISO(value));
}

export function isPlayoffsActive(
  season: PlayoffSeasonWindow | null | undefined,
  now: Date = new Date()
) {
  if (!season?.regularSeasonEndDate || !season?.seasonEndDate) {
    return false;
  }

  const regularSeasonEnd = parseSeasonBoundary(season.regularSeasonEndDate);
  const seasonEnd = parseSeasonBoundary(season.seasonEndDate);

  return isAfter(now, regularSeasonEnd) && !isAfter(now, seasonEnd);
}

export function getPlayoffBracketYear(
  season: Pick<PlayoffSeasonWindow, "seasonEndDate">
) {
  const parsed = parseISO(season.seasonEndDate);
  if (Number.isNaN(parsed.getTime())) {
    return Number(String(season.seasonEndDate).slice(0, 4));
  }

  return parsed.getFullYear();
}
