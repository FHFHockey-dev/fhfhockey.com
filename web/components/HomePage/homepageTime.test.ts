import moment from "moment-timezone";
import { describe, expect, it } from "vitest";
import { formatLocalPlayoffStart, formatLocalStartTime } from "./homepageGameFormatting";
import { formatHomepageDate, formatHomepageTimestamp } from "./HomepageStandingsInjuriesSection";
import { zonedMidnight } from "./homepageTime";

// moment-timezone stays installed for server code, so it is the parity oracle here.
const NORTH_AMERICAN_ZONES = [
  "America/New_York", "America/Toronto", "America/Chicago", "America/Winnipeg", "America/Denver",
  "America/Edmonton", "America/Phoenix", "America/Regina", "America/Los_Angeles", "America/Vancouver",
  "America/Anchorage", "Pacific/Honolulu", "America/Halifax",
];
// Puck drops and edge times on both sides of the 2026-11-01 and 2027-03-14 DST changes.
const INSTANTS = [
  "2026-10-31T23:00:00Z", "2026-11-01T05:30:00Z", "2026-11-01T06:00:00Z", "2026-11-02T00:07:00Z",
  "2027-03-14T06:59:00Z", "2027-03-14T07:00:00Z", "2027-03-14T23:00:00Z", "2026-12-31T05:00:00Z",
  "2026-10-18T17:00:00Z", "2026-10-18T16:00:00Z",
];

describe("homepage game times without moment-timezone", () => {
  it("matches moment's 'h:mm A z' and playoff formats for North American zones", () => {
    for (const zone of NORTH_AMERICAN_ZONES) {
      for (const instant of INSTANTS) {
        const local = moment.tz(instant, "UTC").tz(zone);
        expect(formatLocalStartTime(instant, zone)).toBe(local.format("h:mm A z"));
        const timeFormat = local.minutes() === 0 ? "hA z" : "h:mmA z";
        expect(formatLocalPlayoffStart(instant, zone)).toBe(`${local.format("M-D-YYYY")} | ${local.format(timeFormat)}`);
      }
    }
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
