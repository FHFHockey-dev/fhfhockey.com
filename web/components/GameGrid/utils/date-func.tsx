import { endOfISOWeek, startOfISOWeek } from "date-fns";
import { Day } from "../GameGrid";

/**
 *
 * @param date An instance of Date
 * @returns Mon, Tue
 */
export function getDayStr(date: Date) {
  return date.toLocaleString("en-us", { weekday: "short" }) as Day;
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
// return an array of date objects for start (monday)
// and end (sunday) of week based on supplied
// date object or current date
export function startAndEndOfWeek(date?: Date): [string, string] {
  const monday = startOfISOWeek(date || new Date());
  const sunday = endOfISOWeek(date || new Date());

  // Return array of date objects
  return [formatYYMMDD(monday), formatYYMMDD(sunday)];
}

function formatYYMMDD(date: Date) {
  const offset = date.getTimezoneOffset();
  date = new Date(date.getTime() - offset * 60 * 1000);
  return date.toISOString().split("T")[0];
}
