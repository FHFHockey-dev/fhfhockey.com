import type { YahooMatchupWeekRow } from "./types";
import type { getScheduleDaily } from "lib/NHL/server/scheduleDaily";

// Proposal only. This file is not part of the application import graph.
export const RECURRING_PROFILE = Object.freeze({
  version: "current-next-v1", gameKey: "477", seasonId: 20262027,
  maxDays: 31, maxSides: 1000, maxPages: 5,
  pageBytes: 1024 * 1024, writeBytes: 1024 * 1024, pageMs: 8000, runMs: 90000,
});

export function parseRecurringQuery(query: Record<string, unknown>) {
  if (Object.keys(query).some(key => !["profile", "dryRun"].includes(key))
    || query.profile !== RECURRING_PROFILE.version
    || query.dryRun !== undefined && !["true", "false"].includes(query.dryRun as string)) {
    throw new Error("Use only profile=current-next-v1 and dryRun=true|false.");
  }
  return { dryRun: query.dryRun !== "false" };
}

function offset(date: string, days: number) {
  return new Date(Date.parse(`${date}T12:00:00Z`) + days * 86400000).toISOString().slice(0, 10);
}

export function recurringRange(now: Date, weeks: readonly YahooMatchupWeekRow[]) {
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York",
    year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
  const valid = (value: string | null): value is string => Boolean(value && /^\d{4}-\d{2}-\d{2}$/.test(value)
    && Number.isFinite(Date.parse(value)) && new Date(`${value}T12:00:00Z`).toISOString().slice(0, 10) === value);
  if (!weeks.length || weeks.length > 64 || weeks.some(week => week.game_key !== RECURRING_PROFILE.gameKey
    || week.season !== "2026" || !valid(week.start_date) || !valid(week.end_date) || week.start_date > week.end_date)) {
    throw new Error("Recurring Yahoo calendar is invalid or outside the pinned season.");
  }
  const active = weeks.filter(week => week.start_date! <= today && today <= week.end_date!);
  if (active.length !== 1) throw new Error("Exactly one active Yahoo period is required.");
  const weekday = new Date(`${today}T12:00:00Z`).getUTCDay();
  const monday = offset(today, -((weekday + 6) % 7));
  const calendarEnd = offset(monday, 13);
  const startDate = offset(active[0].start_date! < monday ? active[0].start_date! : monday, -1);
  const endDate = offset(active[0].end_date! > calendarEnd ? active[0].end_date! : calendarEnd, 1);
  const days = (Date.parse(endDate) - Date.parse(startDate)) / 86400000 + 1;
  if (days > RECURRING_PROFILE.maxDays) throw new Error("Recurring horizon exceeds its approved day budget.");
  return { mode: "bounded" as const, gameKey: RECURRING_PROFILE.gameKey, startDate, endDate };
}

/** Per-page, decoded-body cap; redirect following and retries are forbidden. */
export const fetchRecurringSchedulePage = async (date: string, runSignal: AbortSignal): ReturnType<typeof getScheduleDaily> => {
  if (runSignal.aborted) throw new Error("Recurring refresh deadline exceeded.");
  const controller = new AbortController();
  const abort = () => controller.abort();
  runSignal.addEventListener("abort", abort, { once: true });
  const timer = setTimeout(abort, RECURRING_PROFILE.pageMs);
  try {
    const response = await fetch(`https://api-web.nhle.com/v1/schedule/${date}`, {
      headers: { Accept: "application/json", "User-Agent": "fhfhockey/1.0 (+https://fhfhockey.com)" },
      cache: "no-store", redirect: "error", signal: controller.signal,
    });
    if (!response.ok || !response.headers.get("content-type")?.toLowerCase().includes("application/json") || !response.body) {
      throw new Error("Recurring NHL schedule response is not successful JSON.");
    }
    const advertised = response.headers.get("content-length");
    if (advertised && Number(advertised) > RECURRING_PROFILE.pageBytes) throw new Error("Recurring source byte budget exceeded.");
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let bytes = 0, body = "";
    try {
      for (;;) {
        const { value, done } = await reader.read();
        if (controller.signal.aborted) throw new Error("Recurring source deadline exceeded.");
        if (done) break;
        bytes += value.byteLength;
        if (bytes > RECURRING_PROFILE.pageBytes) throw new Error("Recurring source byte budget exceeded.");
        body += decoder.decode(value, { stream: true });
      }
      body += decoder.decode();
    } finally {
      await reader.cancel().catch(() => undefined);
      reader.releaseLock();
    }
    return JSON.parse(body);
  } finally {
    clearTimeout(timer);
    runSignal.removeEventListener("abort", abort);
    controller.abort();
  }
};
