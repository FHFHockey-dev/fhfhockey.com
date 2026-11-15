/**
 * Exact instant arithmetic for pregame capture custody.
 *
 * Every deadline decision in this lane compares parsed instants in integer
 * microseconds since the Unix epoch. String ordering of ISO text is never used:
 * equivalent instants can be written with different offsets or precision.
 */

export type Micros = bigint;

const ISO_INSTANT =
  /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,9}))?(Z|z|[+-]\d{2}(?::?\d{2})?)$/;

export const MICROS_PER_MS = BigInt(1_000);
export const MICROS_PER_SECOND = BigInt(1_000_000);
export const MICROS_PER_MINUTE = BigInt(60) * MICROS_PER_SECOND;

/**
 * Parses an ISO-8601 / RFC 3339 instant that carries an explicit offset.
 * Fractions beyond microseconds are rounded toward the requested direction so
 * a bound never becomes less conservative than its source text.
 */
export function parseInstantMicros(text: string, round: "floor" | "ceil" = "floor"): Micros {
  if (typeof text !== "string") throw new Error("instant_not_text");
  const match = ISO_INSTANT.exec(text.trim());
  if (!match) throw new Error(`instant_unparseable:${text}`);
  const [, y, mo, d, h, mi, s, fraction = "", zone] = match;
  const year = Number(y), month = Number(mo), day = Number(d);
  const hour = Number(h), minute = Number(mi), second = Number(s);
  if (month < 1 || month > 12 || day < 1 || day > daysInMonth(year, month)
    || hour > 23 || minute > 59 || second > 59) throw new Error(`instant_out_of_range:${text}`);
  const baseMs = Date.UTC(year, month - 1, day, hour, minute, second);
  if (!Number.isFinite(baseMs)) throw new Error(`instant_out_of_range:${text}`);
  const digits = fraction.padEnd(9, "0");
  let micros = BigInt(digits.slice(0, 6));
  if (round === "ceil" && /[1-9]/.test(digits.slice(6))) micros += BigInt(1);
  let offsetMinutes = 0;
  if (zone !== "Z" && zone !== "z") {
    const sign = zone.startsWith("-") ? -1 : 1;
    const raw = zone.slice(1).replace(":", "");
    const oh = Number(raw.slice(0, 2)), om = Number(raw.slice(2) || "0");
    if (oh > 23 || om > 59) throw new Error(`instant_bad_offset:${text}`);
    offsetMinutes = sign * (oh * 60 + om);
  }
  return BigInt(baseMs) * MICROS_PER_MS + micros - BigInt(offsetMinutes) * MICROS_PER_MINUTE;
}

function daysInMonth(year: number, month: number) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

export function microsFromEpochMs(ms: number): Micros {
  if (!Number.isFinite(ms)) throw new Error("instant_not_finite");
  return BigInt(Math.trunc(ms)) * MICROS_PER_MS;
}

/** Canonical UTC text with exactly six fractional digits. */
export function formatMicros(value: Micros): string {
  const ms = value / MICROS_PER_MS;
  let rem = value % MICROS_PER_MS;
  let wholeMs = ms;
  if (rem < BigInt(0)) { rem += MICROS_PER_MS; wholeMs -= BigInt(1); }
  const iso = new Date(Number(wholeMs)).toISOString(); // ...sss Z
  return `${iso.slice(0, 23)}${rem.toString().padStart(3, "0")}Z`;
}

export const minMicros = (...values: Micros[]): Micros => values.reduce((a, b) => (b < a ? b : a));
export const maxMicros = (...values: Micros[]): Micros => values.reduce((a, b) => (b > a ? b : a));

/** Latest of several instants, compared after parsing (never as strings). */
export function latestInstant(texts: readonly string[], fallback: string): string {
  let best = parseInstantMicros(fallback), bestText = fallback;
  for (const text of texts) {
    const value = parseInstantMicros(text);
    if (value > best) { best = value; bestText = text; }
  }
  return bestText;
}
