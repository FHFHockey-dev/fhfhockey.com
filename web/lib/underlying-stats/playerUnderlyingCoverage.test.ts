import { describe, expect, it } from "vitest";

import { classifyPlayerUnderlyingCoverage } from "./playerUnderlyingCoverage";

describe("classifyPlayerUnderlyingCoverage", () => {
  it("identifies raw roster coverage gaps before formula review", () => {
    expect(
      classifyPlayerUnderlyingCoverage({
        expectedGameIds: [3, 1, 2],
        rosterGameIds: [1],
        summaryGameIds: [1],
      }),
    ).toMatchObject({
      status: "stale-roster",
      missingRosterGameIds: [2, 3],
      formulaReviewReady: false,
    });
  });

  it("separates summary-refresh gaps from raw roster gaps", () => {
    expect(
      classifyPlayerUnderlyingCoverage({
        expectedGameIds: [1, 2, 3],
        rosterGameIds: [1, 2, 3],
        summaryGameIds: [1, 3],
      }),
    ).toMatchObject({
      status: "stale-summary",
      missingRosterGameIds: [],
      missingSummaryGameIds: [2],
      formulaReviewReady: false,
    });
  });

  it("allows formula review only after all coverage layers agree", () => {
    expect(
      classifyPlayerUnderlyingCoverage({
        expectedGameIds: [1, 2, 2],
        rosterGameIds: [2, 1],
        summaryGameIds: [1, 2],
      }),
    ).toMatchObject({
      status: "complete",
      expectedGameIds: [1, 2],
      formulaReviewReady: true,
    });
  });

  it("does not claim formula readiness when the independent reference fails", () => {
    expect(
      classifyPlayerUnderlyingCoverage({
        expectedGameIds: [],
        rosterGameIds: [],
        summaryGameIds: [],
        referenceAvailable: false,
      }),
    ).toMatchObject({
      status: "unknown-reference",
      formulaReviewReady: false,
    });
  });
});
