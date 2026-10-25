import { useEffect, useState } from "react";
import type { ExtendedWeekData } from "lib/NHL/types";
const EMPTY_SCHEDULE: ExtendedWeekData[] = [];

/** One clock for every row; boundary timers do no fetching or polling. */
export default function useOpportunityClock(rows: ExtendedWeekData[]) {
  // Loading callers may allocate []; identity churn must not restart the clock.
  const clockRows = rows.length ? rows : EMPTY_SCHEDULE;
  const [calculatedAt, setCalculatedAt] = useState(() => new Date().toISOString());
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const update = () => {
      clearTimeout(timer);
      const now = Date.now();
      setCalculatedAt(new Date(now).toISOString());
      const midnight = new Date(now);
      midnight.setHours(24, 0, 0, 0);
      const starts = clockRows.flatMap((r) => Object.values(r).flatMap((g: unknown) => {
        const start = g && typeof g === "object" && "startTimeUTC" in g ? Date.parse(String(g.startTimeUTC)) : NaN;
        return start > now ? [start] : [];
      }));
      timer = setTimeout(update, Math.max(1, Math.min(midnight.getTime(), ...starts) - now));
    };
    const visible = () => { if (document.visibilityState === "visible") update(); };
    update();
    document.addEventListener("visibilitychange", visible);
    return () => { clearTimeout(timer); document.removeEventListener("visibilitychange", visible); };
  }, [clockRows]);
  return calculatedAt;
}
