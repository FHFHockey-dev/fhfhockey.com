import { formatInTimeZone, fromZonedTime } from "date-fns-tz";

/** Avoid ambiguous abbreviations such as EST; exact period bounds still store instants. */
export function explicitPeriodTimeZone(zone: string): boolean {
  if (zone !== "UTC" && !zone.includes("/")) return false;
  try { new Intl.DateTimeFormat("en", { timeZone: zone }); return true; } catch { return false; }
}

export function periodLocalTime(instant: string, zone: string): string {
  try { return formatInTimeZone(instant, zone, "yyyy-MM-dd'T'HH:mm:ss.SSS"); } catch { return ""; }
}

/** Resolve only a single, exactly round-tripping local time; never guess across a DST gap/fold. */
export function resolvePeriodBoundary(value: string, zone: string): { instant: string | null; error: string | null } {
  if (!explicitPeriodTimeZone(zone)) return { instant: null, error: "Use an explicit IANA time zone, such as America/New_York or UTC." };
  const match = /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?$/.exec(value);
  if (!match) return { instant: null, error: "Enter a complete local date and time." };
  const normalized = `${match[1]}T${match[2]}:${match[3]}:${match[4] ?? "00"}.${(match[5] ?? "").padEnd(3, "0")}`;
  const wall = Date.parse(`${normalized}Z`);
  if (!Number.isFinite(wall) || new Date(wall).toISOString() !== `${normalized}Z`) return { instant: null, error: "Enter a valid calendar date and time." };
  const seed = fromZonedTime(normalized, zone).getTime();
  const offsets = new Set<number>();
  // Neighboring days expose the offsets on each side of a daylight-saving transition.
  for (const days of [-2, -1, 0, 1, 2]) {
    const probe = seed + days * 86400000;
    offsets.add(Date.parse(`${periodLocalTime(new Date(probe).toISOString(), zone)}Z`) - probe);
  }
  const matches = [...offsets].map(offset => wall - offset)
    .filter(instant => Number.isFinite(instant) && periodLocalTime(new Date(instant).toISOString(), zone) === normalized);
  if (matches.length !== 1) return { instant: null, error: matches.length
    ? "This local time occurs twice during a clock change. Choose an unambiguous time or an explicit fixed-offset IANA zone."
    : "This local time does not exist during a clock change. Choose a valid local time." };
  return { instant: new Date(matches[0]).toISOString(), error: null };
}
