// Intl-based zoned formatting for homepage client code, so the homepage does
// not ship moment-timezone's zone database. Outputs mirror the moment format
// strings they replace; see homepageTime.test.ts for the parity oracle.

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const formatters = new Map<string, Intl.DateTimeFormat>();

export type ZonedParts = {
  year: number;
  month: number;
  day: number;
  hour12: number;
  minute: number;
  dayPeriod: "AM" | "PM";
  zoneName: string;
};

export function localTimeZone(): string | undefined {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return undefined;
  }
}

function formatterFor(timeZone: string | undefined) {
  const key = timeZone ?? "";
  let formatter = formatters.get(key);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat("en-US", {
      timeZone,
      year: "numeric",
      month: "numeric",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hourCycle: "h23",
      timeZoneName: "short",
    });
    formatters.set(key, formatter);
  }
  return formatter;
}

export function zonedParts(date: Date, timeZone?: string): ZonedParts {
  const values: Record<string, string> = {};
  for (const part of formatterFor(timeZone).formatToParts(date)) values[part.type] = part.value;
  const hour24 = Number(values.hour) % 24;
  return {
    year: Number(values.year),
    month: Number(values.month),
    day: Number(values.day),
    hour12: hour24 % 12 === 0 ? 12 : hour24 % 12,
    minute: Number(values.minute),
    dayPeriod: hour24 < 12 ? "AM" : "PM",
    zoneName: values.timeZoneName ?? "",
  };
}

/** Parses the way `moment(value)` does for the inputs the homepage receives: date-only strings are local midnight. */
export function parseMomentLike(value: string): Date | null {
  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  const date = dateOnly
    ? new Date(Number(dateOnly[1]), Number(dateOnly[2]) - 1, Number(dateOnly[3]))
    : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

const pad2 = (value: number) => String(value).padStart(2, "0");

/** moment "h:mm A". */
export const formatClock = (parts: ZonedParts) => `${parts.hour12}:${pad2(parts.minute)} ${parts.dayPeriod}`;

/** moment "MMM D, YYYY". */
export const formatMonthDayYear = (parts: ZonedParts) => `${MONTHS[parts.month - 1]} ${parts.day}, ${parts.year}`;

/** moment "MMM D". */
export const formatMonthDay = (parts: ZonedParts) => `${MONTHS[parts.month - 1]} ${parts.day}`;

/** The instant of local midnight for a calendar date in a time zone (DST-safe). */
export function zonedMidnight(ymd: string, timeZone: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd);
  if (!match) return null;
  const wallClock = Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  let instant = wallClock;
  // Two passes settle the offset when the first guess lands across a DST change.
  for (let pass = 0; pass < 2; pass += 1) {
    const parts = zonedParts(new Date(instant), timeZone);
    const hour24 = parts.hour12 % 12 + (parts.dayPeriod === "PM" ? 12 : 0);
    const observed = Date.UTC(parts.year, parts.month - 1, parts.day, hour24, parts.minute);
    instant += wallClock - observed;
  }
  return new Date(instant);
}
