import { localDate } from "lib/rosterScheduleOptimizer/planningDates";
import { weekDates } from "./schedule";
import { SHARE_TIME_ZONE, type SocialShareFormat, type SocialShareSnapshot } from "./types";

// Each edition's own posting day within its week (Mon = 0).
const POSTING_DAYS: Partial<Record<SocialShareFormat, { label: string; index: number }>> = {
  "game-grid": { label: "Monday", index: 0 }, "tuesday-trends": { label: "Tuesday", index: 1 }, "remaining-week": { label: "Wednesday", index: 2 },
};

/**
 * Card eyebrow label from the edition's real date context (SS1-8-O3): the posting day's name only when
 * the edition was generated on that day of its week; otherwise "Week ahead", "This week" or "Past week".
 */
export function editionLabel(snapshot: Pick<SocialShareSnapshot, "format" | "generatedAt" | "weekStart" | "weekEnd">): string {
  const today = localDate(snapshot.generatedAt, SHARE_TIME_ZONE), own = POSTING_DAYS[snapshot.format];
  if (own && today === weekDates(snapshot.weekStart)[own.index]) return own.label;
  return today < snapshot.weekStart ? "Week ahead" : today > snapshot.weekEnd ? "Past week" : "This week";
}
