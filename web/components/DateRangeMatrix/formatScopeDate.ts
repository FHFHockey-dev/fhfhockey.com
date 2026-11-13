// "2026-09-29" → "Sep 29" (or "Sep 29, 2026"). Noon avoids a timezone day shift.
export function formatScopeDate(isoDate: string, withYear: boolean): string {
  return new Date(`${isoDate}T12:00:00`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    ...(withYear ? { year: "numeric" } : {}),
  });
}
