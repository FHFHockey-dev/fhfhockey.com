import { describe, expect, it } from "vitest";

import {
  NST_BURST_INTERVAL_MS,
  NST_BURST_TOKEN_CAP,
  NST_PAGES_PER_BURST_TOKEN_CAP,
  NST_PAGES_PER_STANDARD_TOKEN_CAP,
  NST_STANDARD_TOKEN_CAP,
  NST_TOKENS_PER_PAGE,
  NST_RATE_LIMIT_WINDOWS,
  assessNstRequestPlan,
  canBurstNstRequests,
  selectNstSafeInterval
} from "./nstRateLimitPolicy";

describe("nstRateLimitPolicy", () => {
  it("exports the published NST key-budget windows", () => {
    expect(NST_RATE_LIMIT_WINDOWS).toEqual([
      { label: "5m_burst", windowMs: 300_000, maxRequests: 80 },
      { label: "1h_standard", windowMs: 3_600_000, maxRequests: 180 }
    ]);
    expect(NST_TOKENS_PER_PAGE).toBe(10);
    expect(NST_STANDARD_TOKEN_CAP).toBe(1_800);
    expect(NST_BURST_TOKEN_CAP).toBe(800);
    expect(NST_PAGES_PER_STANDARD_TOKEN_CAP).toBe(180);
    expect(NST_PAGES_PER_BURST_TOKEN_CAP).toBe(80);
  });

  it("allows safe small bursts", () => {
    expect(canBurstNstRequests(10)).toBe(true);
    expect(canBurstNstRequests(20)).toBe(true);
    expect(canBurstNstRequests(80)).toBe(true);
  });

  it("rejects burst plans that would exceed the five-minute burst cap", () => {
    expect(canBurstNstRequests(81)).toBe(false);

    const assessment = assessNstRequestPlan({
      requestCount: 81,
      intervalMs: NST_BURST_INTERVAL_MS
    });

    expect(assessment.isCompliant).toBe(false);
    expect(assessment.windowCounts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          label: "5m_burst",
          projectedRequests: 81,
          compliant: false
        })
      ])
    );
  });

  it("accepts a modest delay when it brings the plan under every limit", () => {
    const assessment = assessNstRequestPlan({
      requestCount: 81,
      intervalMs: 4_000
    });

    expect(assessment.isCompliant).toBe(true);
    expect(assessment.windowCounts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          label: "5m_burst",
          projectedRequests: 76,
          compliant: true
        }),
        expect.objectContaining({
          label: "1h_standard",
          projectedRequests: 81,
          compliant: true
        })
      ])
    );
  });

  it("selects the first safe interval from a candidate list", () => {
    const assessment = selectNstSafeInterval(81, [0, 1_000, 4_000, 21_000]);

    expect(assessment).not.toBeNull();
    expect(assessment?.intervalMs).toBe(4_000);
    expect(assessment?.isCompliant).toBe(true);
  });

  it("returns null when no candidate interval is safe", () => {
    expect(selectNstSafeInterval(181, [0, 3_000])).toBeNull();
  });
});
