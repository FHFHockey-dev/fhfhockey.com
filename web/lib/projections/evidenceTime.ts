/** Preserve PostgreSQL sub-millisecond ordering without importing server clients or crypto. */
export function timestampMicros(value: string): bigint | null {
  const match = typeof value === "string" && value.match(/^([+-]\d{6}|\d{4})-(\d{2})-(\d{2})T\d{2}:\d{2}:\d{2}(?:\.(\d{1,6}))?(?:Z|[+-]\d{2}:\d{2})$/);
  const milliseconds = Date.parse(value);
  if (!match || !Number.isFinite(milliseconds)) return null;
  const year = Number(match[1]), month = Number(match[2]), day = Number(match[3]);
  const leapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const daysInMonth = [31, leapYear ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  if (month < 1 || month > 12 || day < 1 || day > daysInMonth[month - 1]) return null;
  return BigInt(milliseconds) * BigInt(1000) + BigInt((match[4] ?? "").slice(3).padEnd(3, "0"));
}

export function acceptedNewsSupersedes(acceptedAt: string, inputCutoff: string): boolean {
  const accepted = timestampMicros(acceptedAt), cutoff = timestampMicros(inputCutoff);
  return accepted === null || cutoff === null || accepted > cutoff;
}
