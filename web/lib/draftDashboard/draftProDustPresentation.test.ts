import { describe, expect, it } from "vitest";

import { buildDraftProDustNotices } from "./draftProDustPresentation";

describe("buildDraftProDustNotices", () => {
  it("keeps an error visible when the DUST candidate scope is limited", () => {
    expect(buildDraftProDustNotices({
      projectionDataNotices: [], canUseProDust: true, hasPrivateImport: false, candidateScopeLimited: true,
      dust: { status: "error", error: "Schedule service unavailable", result: null },
    })).toEqual([
      "DUST analyzes the top 500 available players by league value in this view.",
      "DUST is unavailable. Schedule service unavailable",
    ]);
  });

  it("reports the oldest schedule freshness rather than the latest row", () => {
    const notices = buildDraftProDustNotices({
      projectionDataNotices: [], canUseProDust: true, hasPrivateImport: false, candidateScopeLimited: false,
      dust: { status: "ready", error: null, result: {
        state: "ready", diagnostics: [], insights: [], baseline: null,
        window: { startWeek: 1, endWeek: 2, startDate: null, endDate: null },
        freshness: { oldestFetchedAt: "2026-09-01T00:00:00.000Z", latestFetchedAt: "2026-09-07T00:00:00.000Z" },
      } },
    });
    expect(notices[0]).toContain("oldest schedule freshness 2026-09-01T00:00:00.000Z");
    expect(notices[0]).not.toContain("2026-09-07T00:00:00.000Z");
  });
});
