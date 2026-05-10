import { endOfDay, isAfter, parseISO } from "date-fns";

export const NHL_REGULAR_SEASON_GAME_TYPE = 2;
export const NHL_PLAYOFF_GAME_TYPE = 3;
export const NHL_SCORING_GAME_TYPES = [
  NHL_REGULAR_SEASON_GAME_TYPE,
  NHL_PLAYOFF_GAME_TYPE
] as const;

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

export function isRegularSeasonOrPlayoffGameType(
  gameType: number | null | undefined
) {
  return gameType === NHL_REGULAR_SEASON_GAME_TYPE || gameType === NHL_PLAYOFF_GAME_TYPE;
}

export function buildNhlStatsScoringGameTypeCayenne() {
  return "(gameTypeId=2 or gameTypeId=3)";
}
