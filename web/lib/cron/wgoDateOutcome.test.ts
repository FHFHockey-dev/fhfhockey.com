import { describe, expect, it } from "vitest";

import {
  createWgoDateFailure,
  createWgoDateOutcome,
  summarizeWgoDateOutcomes,
  WgoDateProcessingError,
} from "./wgoDateOutcome";

describe("WGO skater date outcomes", () => {
  it("classifies an empty successful NHL response as an expected no-game skip", () => {
    expect(
      createWgoDateOutcome({
        date: "2026-07-01",
        totalUpdates: 0,
        rowsFetched: 0,
      }),
    ).toMatchObject({
      status: "skipped",
      category: "expected_no_game",
    });
  });

  it("preserves source and write failure categories and reasons", () => {
    const sourceFailure = createWgoDateFailure(
      "2026-07-02",
      new WgoDateProcessingError("source_failure", "NHL API returned 503"),
    );
    const writeFailure = createWgoDateFailure(
      "2026-07-03",
      new WgoDateProcessingError("write_failure", "Supabase upsert failed"),
    );

    expect(sourceFailure).toMatchObject({
      status: "failed",
      category: "source_failure",
      reason: "NHL API returned 503",
    });
    expect(writeFailure).toMatchObject({
      status: "failed",
      category: "write_failure",
      reason: "Supabase upsert failed",
    });
  });

  it("summarizes skipped dates separately and bounds diagnostic samples", () => {
    const outcomes = [
      createWgoDateOutcome({
        date: "2026-07-01",
        totalUpdates: 0,
        rowsFetched: 0,
      }),
      ...Array.from({ length: 12 }, (_, index) =>
        createWgoDateFailure(
          `2026-07-${String(index + 2).padStart(2, "0")}`,
          new WgoDateProcessingError("source_failure", `failure ${index}`),
        ),
      ),
    ];

    expect(summarizeWgoDateOutcomes(outcomes)).toMatchObject({
      skippedDates: ["2026-07-01"],
      skippedDatesCount: 1,
      failedDatesCount: 12,
    });
    expect(summarizeWgoDateOutcomes(outcomes).failures).toHaveLength(10);
  });
});
