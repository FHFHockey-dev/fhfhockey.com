import { describe, expect, it } from "vitest";
import { addDays, getDayStr, parseDateStr } from "./date-func";

describe("Game Grid extended-day keys", () => {
  it.each(["2026-10-05", "2026-12-28", "2026-03-02", "2026-10-26"])(
    "matches the schedule keys across weeks, years, and DST from %s", (startDate) => {
      const start = parseDateStr(startDate);
      expect(Array.from({ length: 10 }, (_, i) => getDayStr(start, addDays(start, i))))
        .toEqual(["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN", "nMON", "nTUE", "nWED"]);
    }
  );
});
