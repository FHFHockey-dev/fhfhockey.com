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
  return `${month}-${day}-${year}`;
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
  // If no date object supplied, use current date
  // Copy date so don't modify supplied date
  var now = date ? new Date(date) : new Date();

  // set time to some convenient value
  now.setHours(0, 0, 0, 0);

  // Get the previous Monday
  var monday = new Date(now);
  monday.setDate(monday.getDate() - monday.getDay() + 1);

  // Get next Sunday
  var sunday = new Date(now);
  sunday.setDate(sunday.getDate() - sunday.getDay() + 7);

  // Return array of date objects
  return [formatYYMMDD(monday), formatYYMMDD(sunday)];
}

function formatYYMMDD(date: Date) {
  const offset = date.getTimezoneOffset();
  date = new Date(date.getTime() - offset * 60 * 1000);
  return date.toISOString().split("T")[0];
}
