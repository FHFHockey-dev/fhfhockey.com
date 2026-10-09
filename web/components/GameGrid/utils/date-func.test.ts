import { describe, expect, it } from "vitest";
import { format } from "date-fns";
import { addDays, getDayStr, parseDateStr, parseGameGridDateRange } from "./date-func";

describe("Game Grid extended-day keys", () => {
  it.each(["2026-10-05", "2026-12-28", "2026-03-02", "2026-10-26"])(
    "matches the schedule keys across weeks, years, and DST from %s", (startDate) => {
      const start = parseDateStr(startDate);
      expect(Array.from({ length: 10 }, (_, i) => getDayStr(start, addDays(start, i))))
        .toEqual(["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN", "nMON", "nTUE", "nWED"]);
    }
  );
});

describe("Game Grid URL date ranges", () => {
  it.each([
    ["broken", "2026-10-08"],
    ["2026-02-30", "2026-03-08"],
    ["2026-13-01", "2027-01-08"],
    ["2026-10-08", "2026-10-01"],
    ["2026-10-01", undefined],
    [undefined, "2026-10-08"],
    [["2026-10-01", "2026-10-02"], "2026-10-08"]
  ])("rejects an unusable range %s / %s", (start, end) => {
    expect(parseGameGridDateRange(start, end)).toBeNull();
  });

  it("preserves local calendar dates and includes the whole last day", () => {
    const range = parseGameGridDateRange("2024-02-29", "2024-02-29")!;
    expect(format(new Date(range[0]), "yyyy-MM-dd HH:mm:ss.SSS")).toBe("2024-02-29 00:00:00.000");
    expect(format(new Date(range[1]), "yyyy-MM-dd HH:mm:ss.SSS")).toBe("2024-02-29 23:59:59.999");
  });
});
