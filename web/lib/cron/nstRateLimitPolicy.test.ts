import { describe, expect, it } from "vitest";

import {
  NST_BURST_INTERVAL_MS,
  NST_RATE_LIMIT_WINDOWS,
  assessNstRequestPlan,
  canBurstNstRequests,
  selectNstSafeInterval
} from "./nstRateLimitPolicy";

describe("nstRateLimitPolicy", () => {
  it("exports the published NST windows", () => {
    expect(NST_RATE_LIMIT_WINDOWS).toEqual([
      { label: "1m", windowMs: 60_000, maxRequests: 40 },
      { label: "5m", windowMs: 300_000, maxRequests: 80 },
      { label: "15m", windowMs: 900_000, maxRequests: 100 },
      { label: "1h", windowMs: 3_600_000, maxRequests: 180 }
    ]);
  });

  it("allows safe small bursts", () => {
    expect(canBurstNstRequests(10)).toBe(true);
    expect(canBurstNstRequests(20)).toBe(true);
    expect(canBurstNstRequests(40)).toBe(true);
  });

  it("rejects burst plans that would exceed the one-minute cap", () => {
    expect(canBurstNstRequests(41)).toBe(false);

    const assessment = assessNstRequestPlan({
      requestCount: 44,
      intervalMs: NST_BURST_INTERVAL_MS
    });

    expect(assessment.isCompliant).toBe(false);
    expect(assessment.windowCounts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          label: "1m",
          projectedRequests: 44,
          compliant: false
        })
      ])
    );
  });

  it("accepts a modest delay when it brings the plan under every limit", () => {
    const assessment = assessNstRequestPlan({
      requestCount: 44,
      intervalMs: 3_000
    });

    expect(assessment.isCompliant).toBe(true);
    expect(assessment.windowCounts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          label: "1m",
          projectedRequests: 21,
          compliant: true
        }),
        expect.objectContaining({
          label: "5m",
          projectedRequests: 44,
          compliant: true
        })
      ])
    );
  });

  it("selects the first safe interval from a candidate list", () => {
    const assessment = selectNstSafeInterval(44, [0, 1_000, 3_000, 21_000]);

    expect(assessment).not.toBeNull();
    expect(assessment?.intervalMs).toBe(3_000);
    expect(assessment?.isCompliant).toBe(true);
  });

  it("returns null when no candidate interval is safe", () => {
    expect(selectNstSafeInterval(400, [0, 3_000])).toBeNull();
  });
});
