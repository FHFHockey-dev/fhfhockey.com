import { describe, expect, it } from "vitest";
import { buildFlurryAdjustedPredictions, summarizeFlurryAdjustedXg } from "./flurryAdjusted";

describe("flurry-adjusted xG", () => {
  it("discounts later sequence shots without overwriting raw xG", () => {
    const rows = buildFlurryAdjustedPredictions([
      { gameId: 1, eventId: 2, rawXg: 0.5, flurrySequenceId: "a", flurryShotIndex: 2 },
      { gameId: 1, eventId: 1, rawXg: 0.2, flurrySequenceId: "a", flurryShotIndex: 1 },
      { gameId: 1, eventId: 3, rawXg: 0.1, flurrySequenceId: null, flurryShotIndex: null },
    ]);

    expect(rows.map((row) => [row.eventId, row.rawXg, row.flurryAdjustedXg])).toEqual([
      [3, 0.1, 0.1],
      [1, 0.2, 0.2],
      [2, 0.5, 0.4],
    ]);
    expect(summarizeFlurryAdjustedXg(rows)).toMatchObject({
      rawXg: 0.8,
      flurryAdjustedXg: 0.7,
      adjustment: -0.1,
      rawPreserved: true,
    });
  });
});

