import { describe, expect, it } from "vitest";
import { localDate, zonedMidnight } from "./planningDates";

const minute = 60000;
const before = (value: string) => new Date(Date.parse(value) - minute).toISOString();

describe("zonedMidnight (Astra PR6)", () => {
  it("returns the first instant of the local day, never a time on the day before", () => {
    for (const [date, zone] of [["2026-04-24", "Africa/Cairo"], ["2026-03-29", "Asia/Beirut"], ["2026-03-08", "America/Havana"],
      ["2026-03-08", "America/New_York"], ["2026-11-01", "America/New_York"], ["2026-10-26", "Europe/London"], ["2026-10-26", "UTC"]]) {
      const start = zonedMidnight(date, zone);
      expect(localDate(start, zone), `${zone} ${date}`).toBe(date);
      expect(localDate(before(start), zone) < date, `${zone} ${date}`).toBe(true);
    }
  });
  it("keeps ordinary midnights unchanged", () => {
    expect(zonedMidnight("2026-10-26", "America/New_York")).toBe("2026-10-26T04:00:00.000Z");
    expect(zonedMidnight("2026-03-08", "America/New_York")).toBe("2026-03-08T05:00:00.000Z");
    expect(zonedMidnight("2026-11-01", "America/New_York")).toBe("2026-11-01T04:00:00.000Z");
  });
  it("starts a day whose midnight is skipped at the first instant after the gap", () => {
    // Cairo springs forward at 00:00 on 2026-04-24: the day starts at 01:00 local (22:00 UTC the evening before).
    expect(zonedMidnight("2026-04-24", "Africa/Cairo")).toBe("2026-04-23T22:00:00.000Z");
  });
});
