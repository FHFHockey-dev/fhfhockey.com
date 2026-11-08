import moment from "moment-timezone";
import { describe, expect, it } from "vitest";
import { formatLocalPlayoffStart, formatLocalStartTime } from "./homepageGameFormatting";
import { formatHomepageDate, formatHomepageTimestamp } from "./HomepageStandingsInjuriesSection";
import { zonedMidnight } from "./homepageTime";

// Fixed puck drops on both sides of the 2026-03-08 and 2026-11-01 DST changes, so the
// expectations never depend on today's date. They come from the runtime's IANA data
// (Node 22 ICU, tzdata 2026e), not from moment-timezone: its bundled 2025b data predates
// British Columbia, Alberta and Manitoba dropping the fall-back (tzdata 2026b, 2026c, 2026e),
// so those three zones stay on -07/-06/-05 after 2026-11-01. US zones match moment exactly.
const INSTANTS = ["2026-03-07T23:00:00Z", "2026-03-09T00:07:00Z", "2026-10-31T23:00:00Z", "2026-11-02T00:07:00Z"];
const EXPECTED_START_TIMES: Record<string, string[]> = {
  "America/New_York": ["6:00 PM EST", "8:07 PM EDT", "7:00 PM EDT", "7:07 PM EST"],
  "America/Toronto": ["6:00 PM EST", "8:07 PM EDT", "7:00 PM EDT", "7:07 PM EST"],
  "America/Chicago": ["5:00 PM CST", "7:07 PM CDT", "6:00 PM CDT", "6:07 PM CST"],
  "America/Winnipeg": ["5:00 PM CST", "7:07 PM CDT", "6:00 PM CDT", "7:07 PM CDT"],
  "America/Denver": ["4:00 PM MST", "6:07 PM MDT", "5:00 PM MDT", "5:07 PM MST"],
  "America/Edmonton": ["4:00 PM MST", "6:07 PM MDT", "5:00 PM MDT", "6:07 PM MDT"],
  "America/Phoenix": ["4:00 PM MST", "5:07 PM MST", "4:00 PM MST", "5:07 PM MST"],
  "America/Regina": ["5:00 PM CST", "6:07 PM CST", "5:00 PM CST", "6:07 PM CST"],
  "America/Los_Angeles": ["3:00 PM PST", "5:07 PM PDT", "4:00 PM PDT", "4:07 PM PST"],
  "America/Vancouver": ["3:00 PM PST", "5:07 PM PDT", "4:00 PM PDT", "5:07 PM PDT"],
  "America/Anchorage": ["2:00 PM AKST", "4:07 PM AKDT", "3:00 PM AKDT", "3:07 PM AKST"],
  "Pacific/Honolulu": ["1:00 PM HST", "2:07 PM HST", "1:00 PM HST", "2:07 PM HST"],
  "America/Halifax": ["7:00 PM AST", "9:07 PM ADT", "8:00 PM ADT", "8:07 PM AST"],
};

describe("homepage game times without moment-timezone", () => {
  it("formats 'h:mm A z' and playoff starts for North American zones across DST changes", () => {
    for (const [zone, expected] of Object.entries(EXPECTED_START_TIMES)) {
      INSTANTS.forEach((instant, index) => {
        expect(formatLocalStartTime(instant, zone), `${zone} ${instant}`).toBe(expected[index]);
      });
    }
    expect(formatLocalPlayoffStart("2026-03-07T23:00:00Z", "America/Edmonton")).toBe("3-7-2026 | 4PM MST");
    expect(formatLocalPlayoffStart("2026-03-09T00:07:00Z", "America/Los_Angeles")).toBe("3-8-2026 | 5:07PM PDT");
    expect(formatLocalPlayoffStart("2026-10-31T23:00:00Z", "America/Chicago")).toBe("10-31-2026 | 6PM CDT");
    expect(formatLocalPlayoffStart("2026-11-02T00:07:00Z", "America/New_York")).toBe("11-1-2026 | 7:07PM EST");
    expect(formatLocalPlayoffStart("2026-11-02T00:07:00Z", "America/Winnipeg")).toBe("11-1-2026 | 7:07PM CDT");
  });

  it("keeps the clock and changes only the zone label elsewhere", () => {
    // Intl names zones without North American abbreviations by offset (GMT+1 where moment says BST).
    const instant = "2027-06-01T18:30:00Z";
    expect(formatLocalStartTime(instant, "Europe/London")).toBe("7:30 PM GMT+1");
    expect(moment.tz(instant, "Europe/London").format("h:mm A")).toBe("7:30 PM");
  });

  it("keeps empty and invalid inputs as before", () => {
    expect(formatLocalStartTime("")).toBe("");
    expect(formatLocalPlayoffStart("")).toBe("TBD");
    expect(formatLocalStartTime("not a date", "America/New_York")).toBe("Invalid date");
  });
});

describe("homepage New York dates without moment-timezone", () => {
  const values = [
    "2026-10-18", "2026-11-01", "2027-03-14", "2026-10-18T03:30:00Z", "2026-10-18T03:30:00+00:00",
    "2026-11-01T05:59:00Z", "2026-11-01T06:01:00Z", "2026-10-18T22:15:00", "2027-01-05T12:00:00-08:00",
  ];

  it("matches moment for the standings and transaction labels", () => {
    for (const value of values) {
      const parsed = moment(value);
      expect(formatHomepageDate(value)).toBe(parsed.clone().tz("America/New_York").format("M/D/YY"));
      const hasTime = /T\d{2}:\d{2}/.test(value);
      expect(formatHomepageTimestamp(value)).toBe(
        parsed.clone().tz("America/New_York").format(hasTime ? "MMM D, h:mm A" : "MMM D, YYYY"),
      );
    }
    expect(formatHomepageDate(null)).toBe("N/A");
    expect(formatHomepageDate("garbage")).toBe("N/A");
    expect(formatHomepageTimestamp(undefined)).toBe("");
  });

  it("finds midnight in New York across DST changes", () => {
    for (const date of ["2026-10-07", "2026-11-01", "2026-11-02", "2027-03-14", "2027-03-15", "2026-12-31"]) {
      expect(zonedMidnight(date, "America/New_York")?.getTime()).toBe(
        moment.tz(date, "YYYY-MM-DD", "America/New_York").startOf("day").valueOf(),
      );
    }
    expect(zonedMidnight("10/07/2026", "America/New_York")).toBeNull();
  });
});
