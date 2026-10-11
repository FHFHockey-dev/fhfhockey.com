import { getSchedule } from "lib/NHL/server";
import { assertCalendarDate, buildScheduleSnapshot, calendarWeekStart, weekDates } from "./schedule";
import { isSocialShareFormat, type SocialShareFormat } from "./types";

export class SocialShareRequestError extends Error {
  constructor(message: string, public status: number) { super(message); }
}
export async function loadScheduleShareSnapshot(format: SocialShareFormat, weekStart?: string, selectedDates?: string[]) {
  if (!isSocialShareFormat(format)) throw new SocialShareRequestError("Unknown social-share format.", 404);
  const requestedAt = new Date().toISOString();
  const start = weekStart ?? calendarWeekStart(requestedAt);
  try {
    const dates = weekDates(assertCalendarDate(start));
    if (selectedDates && (new Set(selectedDates).size !== selectedDates.length || selectedDates.some(date => !dates.includes(assertCalendarDate(date))))) throw new Error("Selected dates must be unique dates within the selected week.");
  } catch (error) { throw new SocialShareRequestError(error instanceof Error ? error.message : "Invalid date selection.", 400); }
  if (format !== "game-grid" && format !== "remaining-week") {
    const blocked = buildScheduleSnapshot({ format, weekStart: start, selectedDates, generatedAt: requestedAt, schedule: { data: {}, numGamesPerDay: [], coveredDates: [] } });
    blocked.source = { name: "NHL schedule", fetchedAt: null, updatedAt: null, coveredDates: [], state: "blocked", reasons: ["No upstream schedule read was made for this unsupported format."] };
    blocked.reasons = ["This format requires ownership or player evidence that is not available in this schedule-only edition."];
    return blocked;
  }
  try {
    const schedule = await getSchedule(start, { includeOdds: false });
    return buildScheduleSnapshot({ format, weekStart: start, selectedDates, generatedAt: new Date().toISOString(), schedule });
  } catch { throw new SocialShareRequestError("NHL schedule is unavailable. Refresh to retry.", 503); }
}
