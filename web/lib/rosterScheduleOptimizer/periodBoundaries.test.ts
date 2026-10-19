import { describe, expect, it } from "vitest";
import { explicitPeriodTimeZone, periodLocalTime, resolvePeriodBoundary } from "./periodBoundaries";

describe("explicit acquisition-period boundaries", () => {
  it.each([
    ["2026-10-12T03:00", "2026-10-12T07:00:00.000Z"],
    ["2026-10-19T03:00", "2026-10-19T07:00:00.000Z"],
    ["2026-03-02T03:00", "2026-03-02T08:00:00.000Z"],
    ["2026-03-09T03:00", "2026-03-09T07:00:00.000Z"],
    ["2026-10-26T03:00", "2026-10-26T07:00:00.000Z"],
    ["2026-11-02T03:00", "2026-11-02T08:00:00.000Z"],
  ])("preserves Monday03:00 New York for %s", (local, instant) => {
    expect(resolvePeriodBoundary(local, "America/New_York")).toEqual({ instant, error: null });
    expect(periodLocalTime(instant, "America/New_York")).toBe(`${local}:00.000`);
  });
  it("uses exact instants across167and169hour weeks and preserves sub-minute precision", () => {
    const at = (local: string) => Date.parse(resolvePeriodBoundary(local, "America/New_York").instant!);
    expect((at("2026-03-09T03:00") - at("2026-03-02T03:00")) / 3600000).toBe(167);
    expect((at("2026-11-02T03:00") - at("2026-10-26T03:00")) / 3600000).toBe(169);
    expect(resolvePeriodBoundary("2026-10-12T03:01:02.123", "America/New_York").instant).toBe("2026-10-12T07:01:02.123Z");
    expect(resolvePeriodBoundary("2026-10-12T03:00", "Etc/GMT+5").instant).toBe("2026-10-12T08:00:00.000Z");
  });
  it.each(["", "2026-02-30T03:00", "2026-10-12T25:00", "2026-10-12T03:61", "2026-10-12", "2026-10-12T03:00Z"])("rejects invalid local input %s", value => {
    expect(resolvePeriodBoundary(value, "America/New_York")).toMatchObject({ instant: null, error: expect.any(String) });
  });
  it.each(["", "EST", "PST", "Not/AZone"])("does not guess ambiguous/invalid zone %s", zone => {
    expect(explicitPeriodTimeZone(zone)).toBe(false);
    expect(resolvePeriodBoundary("2026-10-12T03:00", zone).instant).toBeNull();
  });
  it("rejects nonexistent and repeated local times rather than selecting an offset", () => {
    expect(resolvePeriodBoundary("2026-03-08T02:30", "America/New_York")).toMatchObject({ instant: null, error: expect.stringContaining("does not exist") });
    expect(resolvePeriodBoundary("2026-11-01T01:30", "America/New_York")).toMatchObject({ instant: null, error: expect.stringContaining("occurs twice") });
  });
});
