import { addDays } from "date-fns";

export const MAX_STANDINGS_DATES_PER_RUN = 14;

export function parseBooleanQuery(
  value: string | string[] | undefined,
): boolean {
  const raw = Array.isArray(value) ? value[0] : value;
  return raw === "true" || raw === "1" || raw === "yes";
}

export function boundStandingsEndDate(
  startDate: Date,
  requestedEndDate: Date,
  maxDates?: number,
) {
  if (!maxDates) {
    return { endDate: requestedEndDate, bounded: false };
  }
  const boundedEndDate = addDays(startDate, maxDates - 1);
  return boundedEndDate < requestedEndDate
    ? { endDate: boundedEndDate, bounded: true }
    : { endDate: requestedEndDate, bounded: false };
}
