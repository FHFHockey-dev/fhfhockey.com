import { describe, expect, it } from "vitest";

import { buildHomepageModulePresentation } from "./freshness";

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
});
