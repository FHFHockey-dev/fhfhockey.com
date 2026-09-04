import type { DateToWeekResult, YahooMatchupWeek } from "./types";

export function isIsoDate(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

export function mapDateToYahooWeek(
  date: string,
  weeks: readonly YahooMatchupWeek[],
  gameKey?: string,
): DateToWeekResult {
  if (!isIsoDate(date)) {
    return { status: "unmapped", reason: "invalid_date", matchingWeeks: [] };
  }

  const matchingWeeks = weeks
    .filter(
      (week) =>
        (gameKey === undefined || week.gameKey === gameKey) &&
        isIsoDate(week.startDate) &&
        isIsoDate(week.endDate) &&
        week.startDate <= date &&
        date <= week.endDate,
    )
    .sort((left, right) => left.week - right.week);

  if (matchingWeeks.length === 1) {
    return { status: "mapped", week: matchingWeeks[0] };
  }
  return {
    status: "unmapped",
    reason: matchingWeeks.length > 1 ? "overlapping_weeks" : "outside_weeks",
    matchingWeeks,
  };
}
