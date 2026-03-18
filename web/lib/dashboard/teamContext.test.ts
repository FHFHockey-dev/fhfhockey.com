import { describe, expect, it } from "vitest";

import {
  buildSlateMatchupEdgeMap,
  computeCtpiDelta,
  computeTeamPowerScore,
  normalizeSpecialTeamTier
} from "./teamContext";

describe("teamContext helpers", () => {
  it("computes team power score with normalized special-team tiers", () => {
    expect(
      computeTeamPowerScore({
        offRating: 82,
        defRating: 79,
        paceRating: 80,
        ppTier: 1,
        pkTier: 2,
        trend10: 1.1
      })
    ).toBeCloseTo(84.8333333333, 5);
  });

  it("falls back missing rating inputs to neutral defaults", () => {
    expect(
      computeTeamPowerScore({
        offRating: null,
        defRating: null,
        paceRating: null,
        ppTier: null,
        pkTier: 9,
        trend10: null
      })
    ).toBeCloseTo(3, 5);
    expect(normalizeSpecialTeamTier(null)).toBe(2);
    expect(normalizeSpecialTeamTier(9)).toBe(2);
  });

  it("computes CTPI delta from spark series", () => {
    expect(
      computeCtpiDelta({
        ctpi_0_to_100: 65,
        sparkSeries: [
          { date: "2026-03-10", value: 60 },
          { date: "2026-03-14", value: 65 }
        ]
      })
    ).toBe(5);
  });

  it("builds reciprocal matchup edges from slate ratings", () => {
    const edges = buildSlateMatchupEdgeMap([
      {
        id: 1,
        date: "2026-03-14",
        homeTeamId: 1,
        awayTeamId: 2,
        homeGoalies: [],
        awayGoalies: [],
        homeRating: {
          offRating: 82,
          defRating: 80,
          paceRating: 79,
          ppTier: 1,
          pkTier: 2,
          trend10: 1.2
        },
        awayRating: {
          offRating: 76,
          defRating: 75,
          paceRating: 77,
          ppTier: 2,
          pkTier: 2,
          trend10: -0.3
        }
      }
    ]);

    expect(edges.get("NJD")).toMatchObject({ opponentAbbr: "NYI" });
    expect(edges.get("NYI")).toMatchObject({ opponentAbbr: "NJD" });
    expect((edges.get("NJD")?.edge ?? 0) * -1).toBeCloseTo(
      edges.get("NYI")?.edge ?? 0,
      5
    );
  });
});
