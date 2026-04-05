import { describe, expect, it } from "vitest";
import {
  computeTrendOverridesFromHistory,
  resolveUnderlyingStatsLandingSnapshot
} from "./teamLandingRatings";

describe("computeTrendOverridesFromHistory", () => {
  it("computes trend from the latest played snapshot against the prior 10 snapshots", () => {
    const history = new Map([
      [
        "COL",
        [
          { teamAbbr: "COL", date: "2026-04-05", offRating: 120 },
          { teamAbbr: "COL", date: "2026-04-03", offRating: 110 },
          { teamAbbr: "COL", date: "2026-04-01", offRating: 108 },
          { teamAbbr: "COL", date: "2026-03-30", offRating: 106 },
          { teamAbbr: "COL", date: "2026-03-28", offRating: 104 }
        ]
      ]
    ]);

    const trendOverrides = computeTrendOverridesFromHistory(history);

    expect(trendOverrides.get("COL")).toBe(13);
  });

  it("returns zero when there is no prior baseline window", () => {
    const history = new Map([
      [
        "DET",
        [{ teamAbbr: "DET", date: "2026-04-05", offRating: 101 }]
      ]
    ]);

    const trendOverrides = computeTrendOverridesFromHistory(history);

    expect(trendOverrides.get("DET")).toBe(0);
  });
});

describe("resolveUnderlyingStatsLandingSnapshot", () => {
  it("falls back to the latest available date with data when the requested date is empty", async () => {
    const fetchRatings = async (date: string) => {
      if (date === "2026-04-05") {
        return [];
      }

      if (date === "2026-04-04") {
        return [
          {
            teamAbbr: "TOR",
            date,
            offRating: 100,
            defRating: 100,
            paceRating: 100,
            ppTier: 1 as const,
            pkTier: 1 as const,
            trend10: 1,
            components: {
              xgf60: 1,
              gf60: 1,
              sf60: 1,
              xga60: 1,
              ga60: 1,
              sa60: 1,
              pace60: 1
            },
            finishingRating: null,
            goalieRating: null,
            dangerRating: null,
            specialRating: null,
            disciplineRating: null,
            varianceFlag: null
          }
        ];
      }

      return [];
    };

    const result = await resolveUnderlyingStatsLandingSnapshot({
      requestedDate: "2026-04-05",
      availableDates: ["2026-04-05", "2026-04-04", "2026-04-03"],
      fetchRatings
    });

    expect(result.requestedDate).toBe("2026-04-05");
    expect(result.resolvedDate).toBe("2026-04-04");
    expect(result.ratings).toHaveLength(1);
    expect(result.ratings[0]?.date).toBe("2026-04-04");
  });

  it("returns the first valid available date when the requested date is invalid", async () => {
    const fetchRatings = async (date: string) => [
      {
        teamAbbr: "DET",
        date,
        offRating: 99,
        defRating: 99,
        paceRating: 99,
        ppTier: 2 as const,
        pkTier: 2 as const,
        trend10: 0,
        components: {
          xgf60: 1,
          gf60: 1,
          sf60: 1,
          xga60: 1,
          ga60: 1,
          sa60: 1,
          pace60: 1
        },
        finishingRating: null,
        goalieRating: null,
        dangerRating: null,
        specialRating: null,
        disciplineRating: null,
        varianceFlag: null
      }
    ];

    const result = await resolveUnderlyingStatsLandingSnapshot({
      requestedDate: "not-a-date",
      availableDates: ["2026-04-05", "2026-04-04"],
      fetchRatings
    });

    expect(result.requestedDate).toBe("not-a-date");
    expect(result.resolvedDate).toBe("2026-04-05");
    expect(result.ratings[0]?.date).toBe("2026-04-05");
  });
});
