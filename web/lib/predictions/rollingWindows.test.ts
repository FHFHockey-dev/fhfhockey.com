import { describe, expect, it } from "vitest";

import {
  CANONICAL_HISTORICAL_BASELINE_WINDOWS,
  CANONICAL_ROLLING_GAME_WINDOWS,
  CANONICAL_SUSTAINABILITY_WINDOW_CODES,
  FORGE_TREND_ADJUSTMENT_WINDOW_PRIORITY,
  NON_PERSISTED_ROLLING_WINDOW_DECISIONS,
} from "./rollingWindows";

describe("rolling window contract", () => {
  it("documents the canonical persisted rolling and sustainability windows", () => {
    expect(CANONICAL_ROLLING_GAME_WINDOWS).toEqual([3, 5, 10, 20]);
    expect(CANONICAL_SUSTAINABILITY_WINDOW_CODES).toEqual(["l3", "l5", "l10", "l20"]);
    expect(CANONICAL_HISTORICAL_BASELINE_WINDOWS).toEqual(["season", "three_year", "career"]);
  });

  it("keeps requested but unsupported 1/25/50 game windows explicit", () => {
    expect(NON_PERSISTED_ROLLING_WINDOW_DECISIONS.map((entry) => entry.games)).toEqual([
      1,
      25,
      50,
    ]);
  });

  it("keeps FORGE trend adjustments on validated sustainability windows only", () => {
    expect(FORGE_TREND_ADJUSTMENT_WINDOW_PRIORITY).toEqual(["l5", "l10"]);
  });
});
