import type { LeagueRules } from "./planningTypes";

/** Resolve the existing independent lineup window in league-local time. */
export function lineupPeriodAtDate(date: string, periods: LeagueRules["lineupPeriods"], zone: string) {
  const midnight = Date.parse(zonedMidnight(date, zone));
  return periods?.find(period => Date.parse(period.start) <= midnight && midnight < Date.parse(period.end));
}

const dateFormats = new Map<string, Intl.DateTimeFormat>();
export function localDate(value: string, zone: string): string {
  let format = dateFormats.get(zone);
  if (!format) dateFormats.set(zone, format = new Intl.DateTimeFormat("en-US", { timeZone: zone, year: "numeric", month: "2-digit", day: "2-digit" }));
  const parts = format.formatToParts(new Date(value));
  const part = (kind: string) => parts.find(item => item.type === kind)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

/** The start of a local day: the first instant whose local date is `date` (Astra PR6). Usually local midnight; where a
 * clock change skips midnight (Cairo, Beirut, Havana spring-forward) it is the first instant after the gap, never a time
 * on the day before. */
export function zonedMidnight(date: string, zone: string): string {
  const estimate = Date.parse(approximateMidnight(date, zone));
  const onDate = (time: number) => localDate(new Date(time).toISOString(), zone) >= date;
  // The usual case: the estimate is on the day and the minute before is not.
  if (onDate(estimate) && !onDate(estimate - 60000)) return new Date(estimate).toISOString();
  // Local date is monotone in time, so binary-search the first minute on `date` within a few hours of the estimate.
  let low = estimate - 4 * 3600000, high = estimate + 4 * 3600000;
  if (onDate(low) || !onDate(high)) return new Date(estimate).toISOString();
  while (high - low > 60000) {
    const mid = low + Math.floor((high - low) / 120000) * 60000;
    if (onDate(mid)) high = mid; else low = mid;
  }
  return new Date(high).toISOString();
}

function approximateMidnight(date: string, zone: string): string {
  let candidate = Date.parse(`${date}T00:00:00Z`);
  const formatter = new Intl.DateTimeFormat("en-US", { timeZone: zone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
  const target = Date.parse(`${date}T00:00:00Z`);
  for (let pass = 0; pass < 3; pass++) {
    const parts = formatter.formatToParts(new Date(candidate));
    const part = (kind: string) => Number(parts.find(item => item.type === kind)?.value ?? 0);
    const shown = Date.UTC(part("year"), part("month") - 1, part("day"), part("hour"), part("minute"));
    candidate += target - shown;
  }
  return new Date(candidate).toISOString();
}

export function nextLocalMidnight(date: string, zone: string): string {
  const nextDate = new Date(Date.parse(`${date}T12:00:00Z`) + 86400000).toISOString().slice(0, 10);
  return zonedMidnight(nextDate, zone);
}
