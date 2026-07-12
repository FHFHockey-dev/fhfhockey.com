import { describe, expect, it } from "vitest";

import {
  buildHomepageModulePresentation,
  evaluateFreshness,
  evaluateMixedEffectiveDates
} from "./freshness";

describe("buildHomepageModulePresentation", () => {
  it("prioritizes loading and error states over stale evaluation", () => {
    expect(
      buildHomepageModulePresentation({
        source: "games",
        loading: true,
        error: "Request failed",
        isEmpty: true,
        timestamp: "2026-03-20T00:00:00.000Z",
        maxAgeHours: 1
      })
    ).toMatchObject({
      state: "loading",
      panelState: "loading"
    });

    expect(
      buildHomepageModulePresentation({
        source: "games",
        error: "Request failed",
        isEmpty: true
      })
    ).toMatchObject({
      state: "error",
      panelState: "error",
      message: "Request failed"
    });
  });

  it("returns empty and stale states when appropriate", () => {
    expect(
      buildHomepageModulePresentation({
        source: "injuries",
        isEmpty: true,
        emptyMessage: "No injuries to show."
      })
    ).toMatchObject({
      state: "empty",
      panelState: "empty",
      message: "No injuries to show."
    });

    expect(
      buildHomepageModulePresentation({
        source: "trends",
        timestamp: "2026-03-20T00:00:00.000Z",
        maxAgeHours: 12
      })
    ).toMatchObject({
      state: "stale",
      panelState: "info"
    });
  });

  it("returns ready when there are no active issues", () => {
    expect(
      buildHomepageModulePresentation({
        source: "standings",
        timestamp: new Date().toISOString(),
        maxAgeHours: 12
      })
    ).toEqual({
      state: "ready",
      panelState: null,
      message: null
    });
  });

  it("treats date-only daily snapshots as covering the full source day", () => {
    expect(
      evaluateFreshness(
        [{ source: "team-ratings", timestamp: "2026-05-09", maxAgeHours: 1, severity: "warn" }],
        Date.parse("2026-05-09T12:00:00.000Z")
      )
    ).toEqual({
      ok: true,
      issues: []
    });
  });
});

describe("evaluateMixedEffectiveDates", () => {
  it("warns only when known module dates differ beyond the tolerated daily cadence", () => {
    expect(
      evaluateMixedEffectiveDates([
        { source: "slate", label: "Slate", date: "2026-03-14" },
        { source: "adds", label: "Top Adds", date: "2026-03-13" }
      ])
    ).toMatchObject({ isMixed: false, gapDays: 1 });

    expect(
      evaluateMixedEffectiveDates([
        { source: "slate", label: "Slate", date: "2026-03-14" },
        { source: "movement", label: "Player movement", date: "2026-03-09" },
        { source: "missing", label: "Missing", date: null }
      ])
    ).toMatchObject({
      isMixed: true,
      gapDays: 5,
      earliestDate: "2026-03-09",
      latestDate: "2026-03-14"
    });
  });
});
