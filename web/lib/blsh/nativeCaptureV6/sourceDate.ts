/** BLSH native capture v6: clock-only gates (no I/O). DESIGN.md §1.1 gates 2-4 and §2.
 * The candidate source date comes from the server clock, so the one-shot claim can
 * precede every network call. A request body can never widen or move the window. */

/** First UTC capture day v6 may run: keeps it off the reviewed 11-17 pilot and its 11-18 fallback. */
export const PILOT_FENCE_FIRST_CAPTURE_DATE = "2026-11-19";
/** Server-side window [12:00:00Z, 12:30:00Z): pg_cron fires at 12:05Z and 12:20Z. */
export const CAPTURE_WINDOW_START_MINUTE_UTC = 12 * 60;
export const CAPTURE_WINDOW_END_MINUTE_UTC = 12 * 60 + 30;
/** prepareNativeProcessCapture's season bounds; regular-season scope is the schedule's gameType 2. */
export const SEASON_FIRST_DATE = "2026-07-01";
export const SEASON_LAST_DATE = "2027-06-30";

export type SourceDateDecision =
  | { ok: true; captureDateUTC: string; sourceDate: string }
  | { ok: false; reason: "invalid_clock" | "pilot_fence" | "outside_window" | "outside_season" };

const day = (ms: number) => new Date(ms).toISOString().slice(0, 10);

export function selectSourceDate(nowMs: number): SourceDateDecision {
  if (!Number.isFinite(nowMs)) return { ok: false, reason: "invalid_clock" };
  const now = new Date(nowMs);
  const captureDateUTC = day(nowMs);
  if (captureDateUTC < PILOT_FENCE_FIRST_CAPTURE_DATE) return { ok: false, reason: "pilot_fence" };
  const minute = now.getUTCHours() * 60 + now.getUTCMinutes();
  if (minute < CAPTURE_WINDOW_START_MINUTE_UTC || minute >= CAPTURE_WINDOW_END_MINUTE_UTC) return { ok: false, reason: "outside_window" };
  const sourceDate = day(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 1));
  if (sourceDate < SEASON_FIRST_DATE || captureDateUTC > SEASON_LAST_DATE) return { ok: false, reason: "outside_season" };
  return { ok: true, captureDateUTC, sourceDate };
}
