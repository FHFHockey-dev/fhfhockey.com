// C:\Users\timbr\OneDrive\Desktop\fhfhockey.com-3\web\components\GameGrid\utils\date-func.tsx

import { endOfISOWeek, getWeek, startOfDay, startOfISOWeek } from "date-fns";
import { DAY_ABBREVIATION, EXTENDED_DAY_ABBREVIATION } from "lib/NHL/types";

function getDayStrInternal(date: Date) {
  return date
    .toLocaleString("en-us", { weekday: "short" })
    .toUpperCase() as DAY_ABBREVIATION;
}

const GET_WEEK_OPTIONS = { weekStartsOn: 1 } as const;

/**
 *
 * @param start start date
 * @param date An instance of Date
 * @returns MON, TUE, nMON
 */
export function getDayStr(start: Date, date: Date): EXTENDED_DAY_ABBREVIATION {
  const startWeek = getWeek(start, GET_WEEK_OPTIONS);
  const currentWeek = getWeek(date, GET_WEEK_OPTIONS);

  const dayStr = getDayStrInternal(date);
  // @ts-expect-error
  return startWeek === currentWeek ? dayStr : `NEXT ${dayStr}`;
}

export function addDays(date: Date, days: number) {
  var result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

// format date as m-day-year
export function formatDate(date: Date) {
  var year = date.getFullYear();
  var month = date.getMonth() + 1;
  var day = date.getDate();
  return `${month}-${day}`;
}

const _MS_PER_DAY = 1000 * 60 * 60 * 24;

// a and b are javascript Date objects
export function dateDiffInDays(a: Date, b: Date) {
  // Discard the time and time-zone information.
  const utc1 = Date.UTC(a.getFullYear(), a.getMonth(), a.getDate());
  const utc2 = Date.UTC(b.getFullYear(), b.getMonth(), b.getDate());

  return Math.floor((utc2 - utc1) / _MS_PER_DAY);
}

// https://stackoverflow.com/questions/8381427/get-start-date-and-end-date-of-current-week-week-start-from-monday-and-end-with

/**
 * Get an array of ISO string of monday and sunday
 * of the week given by the parameter __date__
 * @param date a date which determines the week
 * @returns [monday, sunday] - ISO string
 */
export function startAndEndOfWeek(date?: Date): [string, string] {
  const monday = startOfISOWeek(date || new Date());
  const sunday = startOfDay(endOfISOWeek(date || new Date()));

  // Return array of date objects
  return [monday.toISOString(), sunday.toISOString()];
}

/**
 * Parse a date string as a Date obj. Ignore current hh-mm-ss
 * @param dateStr e.g., "2022-06-13"
 */
export function parseDateStr(dateStr: string) {
  const [year, month, day] = dateStr.split("-");
  return new Date(Number(year), Number(month) - 1, Number(day));
}
