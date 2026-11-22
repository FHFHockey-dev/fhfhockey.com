export const DAILY_RANKINGS_SEASON = 20262027;
export const MAX_DISPATCH_REQUESTS = 1000;
const easternDate = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit",
});

function isCanaryDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const ms = Date.parse(value);
  return Number.isFinite(ms) && new Date(ms).toISOString().slice(0, 10) === value;
}

export function rankingCadenceEnabled(value?: string) {
  return value === "daily" || isCanaryDate(value ?? "");
}

export function dailyPublicationWindow(value: string | undefined, now: Date) {
  if (!value || value === "off") return { status: "disabled" } as const;
  if (!rankingCadenceEnabled(value)) throw new Error("Invalid RANKINGS_DAILY_PUBLICATION setting.");
  const parts = easternDate.formatToParts(now);
  const date = ["year", "month", "day"].map(key => parts.find(p => p.type === key)!.value).join("-");
  const target = new Date(Date.parse(date) - 86_400_000).toISOString().slice(0, 10);
  if (value !== "daily" && value !== target) return { status: "unapproved_date", target } as const;
  const startYear = Math.floor(DAILY_RANKINGS_SEASON / 10000);
  if (target < `${startYear}-09-01` || target > `${startYear + 1}-06-30`) {
    return { status: "out_of_season", target } as const;
  }
  const opening = Date.parse(date + "T13:46:00Z");
  if (now.getTime() < opening) return { status: "early", target } as const;
  if (now.getTime() >= opening + 60_000) {
    return { status: "late", target, deadline: Math.min(now.getTime() + 10_000, opening + 240_000) } as const;
  }
  return {
    // Even the last admissible start has three full minutes before 13:50.
    // Leave five seconds between the application stop and the 180s function cap.
    status: "open", target, deadline: Math.min(now.getTime() + 175_000, opening + 240_000),
  } as const;
}
