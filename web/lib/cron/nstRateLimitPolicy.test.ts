import { describe, expect, it } from "vitest";

import {
  NST_BURST_INTERVAL_MS,
  NST_MAX_BURST_REQUESTS,
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
      { label: "1m_burst", windowMs: 60_000, maxRequests: 40 },
      { label: "5m_burst", windowMs: 300_000, maxRequests: 80 },
      { label: "15m_burst", windowMs: 900_000, maxRequests: 100 },
      { label: "1h_standard", windowMs: 3_600_000, maxRequests: 180 }
    ]);
    expect(NST_TOKENS_PER_PAGE).toBe(10);
    expect(NST_STANDARD_TOKEN_CAP).toBe(1_800);
    expect(NST_BURST_TOKEN_CAP).toBe(800);
    expect(NST_PAGES_PER_STANDARD_TOKEN_CAP).toBe(180);
    expect(NST_PAGES_PER_BURST_TOKEN_CAP).toBe(80);
  });

  it("allows at most 39 requests in a burst", () => {
    expect(NST_MAX_BURST_REQUESTS).toBe(39);
    expect(canBurstNstRequests(10)).toBe(true);
    expect(canBurstNstRequests(39)).toBe(true);
    expect(canBurstNstRequests(40)).toBe(false);
    expect(canBurstNstRequests(80)).toBe(false);
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

  it("keeps an arbitrarily large queue within every window at 21 seconds per request", () => {
    const assessment = assessNstRequestPlan({
      requestCount: 10_000,
      intervalMs: 21_000
    });

    expect(assessment.isCompliant).toBe(true);
    expect(assessment.windowCounts).toEqual([
      expect.objectContaining({ label: "1m_burst", projectedRequests: 3 }),
      expect.objectContaining({ label: "5m_burst", projectedRequests: 15 }),
      expect.objectContaining({ label: "15m_burst", projectedRequests: 43 }),
      expect.objectContaining({ label: "1h_standard", projectedRequests: 172 })
    ]);
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
