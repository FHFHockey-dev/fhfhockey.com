import { describe, expect, it, vi } from "vitest";
import {
  computeTrendOverridesFromHistory,
  fetchTeamRatingHistoryForNarratives,
  mergeUnderlyingStatsLandingRatings,
  resolveUnderlyingStatsLandingSnapshot
} from "./teamLandingRatings";
import type { TeamRating } from "../teamRatingsService";

const buildRating = (teamAbbr: string, date: string): TeamRating => ({
  teamAbbr,
  date,
  offRating: 100,
  defRating: 100,
  paceRating: 100,
  ppTier: 2,
  pkTier: 2,
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
});

const buildLandingRating = (
  teamAbbr: string,
  date: string,
  overrides: Partial<TeamRating> = {}
) =>
  mergeUnderlyingStatsLandingRatings({
    baseRatings: [{ ...buildRating(teamAbbr, date), ...overrides }],
    trendOverrides: new Map(),
    scheduleStrengthByTeam: new Map()
  })[0]!;

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

describe("fetchTeamRatingHistoryForNarratives", () => {
  it("paginates the complete narrative lookback with stable ordering", async () => {
    const rows = Array.from({ length: 1007 }, (_, index) => ({
      date: `2026-04-${String(30 - (index % 11)).padStart(2, "0")}`,
      def_rating: 100,
      ga60: 2,
      gf60: 3,
      off_rating: 100,
      pace60: 60,
      pace_rating: 100,
      pk_tier: 2,
      pp_tier: 2,
      sa60: 28,
      sf60: 30,
      team_abbreviation: "TOR",
      xga60: 2,
      xgf60: 3
    }));
    const ranges: Array<[number, number]> = [];
    const orders: Array<[string, boolean]> = [];

    const createQuery = () => {
      const query: any = {
        select: vi.fn(() => query),
        in: vi.fn(() => query),
        gte: vi.fn(() => query),
        lte: vi.fn(() => query),
        order: vi.fn((column: string, options: { ascending: boolean }) => {
          orders.push([column, options.ascending]);
          return query;
        }),
        range: vi.fn((from: number, to: number) => {
          ranges.push([from, to]);
          return Promise.resolve({
            data: rows.slice(from, to + 1),
            error: null
          });
        })
      };
      return query;
    };
    const supabase = {
      from: vi.fn(() => createQuery())
    };

    const result = await fetchTeamRatingHistoryForNarratives(
      "2026-04-30",
      ["TOR"],
      supabase as any
    );

    expect(ranges).toEqual([
      [0, 999],
      [1000, 1999]
    ]);
    expect(orders).toEqual([
      ["date", false],
      ["team_abbreviation", true],
      ["date", false],
      ["team_abbreviation", true]
    ]);
    expect(result.get("TOR")).toHaveLength(11);
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
          buildLandingRating("TOR", date, {
            ppTier: 1 as const,
            pkTier: 1 as const,
            trend10: 1
          })
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
    expect(result.dashboard.quadrant.points).toHaveLength(1);
    expect(result.dashboard.risers[0]?.teamAbbr).toBe("TOR");
  });

  it("returns the first valid available date when the requested date is invalid", async () => {
    const fetchRatings = async (date: string) => [
      buildLandingRating("DET", date, {
        offRating: 99,
        defRating: 99,
        paceRating: 99
      })
    ];

    const result = await resolveUnderlyingStatsLandingSnapshot({
      requestedDate: "not-a-date",
      availableDates: ["2026-04-05", "2026-04-04"],
      fetchRatings
    });

    expect(result.requestedDate).toBe("not-a-date");
    expect(result.resolvedDate).toBe("2026-04-05");
    expect(result.ratings[0]?.date).toBe("2026-04-05");
    expect(result.dashboard.quadrant.points[0]?.teamAbbr).toBe("DET");
  });
});

describe("mergeUnderlyingStatsLandingRatings", () => {
  it("merges repaired trend and sos values into landing-page rows", () => {
    const result = mergeUnderlyingStatsLandingRatings({
      baseRatings: [buildRating("TOR", "2026-04-05"), buildRating("DET", "2026-04-05")],
      trendOverrides: new Map([
        ["TOR", 2.34]
      ]),
      scheduleStrengthByTeam: new Map([
        [
          "TOR",
          {
            teamAbbr: "TOR",
            date: "2026-04-05",
            sos: 0.575,
            texture: null,
            future: {
              directOpponentPointPct: 0.56,
              indirectOpponentPointPct: 0.54,
              opponentGamesPlayed: 10,
              rank: 8,
              sos: 0.5533333333333333,
              uniqueOpponents: 9
            },
            past: {
              directOpponentPointPct: 0.58,
              indirectOpponentPointPct: 0.55,
              opponentGamesPlayed: 77,
              rank: 4,
              sos: 0.57,
              uniqueOpponents: 31
            }
          }
        ]
      ])
    });

    expect(result).toEqual([
      expect.objectContaining({
        narrative: [],
        scheduleTexture: null,
        teamAbbr: "TOR",
        trend10: 2.34,
        sos: 0.575,
        sosFuture: 0.5533333333333333,
        sosPast: 0.57
      }),
      expect.objectContaining({
        narrative: [],
        scheduleTexture: null,
        teamAbbr: "DET",
        trend10: 0,
        sos: null,
        sosFuture: null,
        sosPast: null
      })
    ]);
  });

  it("adds server-generated narratives from recent rating history", () => {
    const result = mergeUnderlyingStatsLandingRatings({
      baseRatings: [
        {
          ...buildRating("TOR", "2026-04-05"),
          components: {
            ga60: 2.6,
            gf60: 3.4,
            pace60: 58.5,
            sa60: 26,
            sf60: 31,
            xga60: 2.7,
            xgf60: 3.3
          },
          defRating: 106,
          offRating: 109,
          paceRating: 103,
          ppTier: 1
        },
        buildRating("DET", "2026-04-05")
      ],
      ratingHistoryByTeam: new Map([
        [
          "TOR",
          [
            {
              components: {
                ga60: 2.7,
                gf60: 3.4,
                pace60: 59,
                sa60: 26,
                sf60: 31,
                xga60: 2.8,
                xgf60: 3.3
              },
              date: "2026-04-05",
              defRating: 106,
              offRating: 109,
              paceRating: 104,
              pkTier: 2,
              ppTier: 1
            },
            {
              components: {
                ga60: 3,
                gf60: 3,
                pace60: 56,
                sa60: 28,
                sf60: 28,
                xga60: 3.1,
                xgf60: 3
              },
              date: "2026-04-03",
              defRating: 100,
              offRating: 100,
              paceRating: 100,
              pkTier: 2,
              ppTier: 2
            }
          ]
        ]
      ]),
      trendOverrides: new Map(),
      scheduleStrengthByTeam: new Map([
        [
          "TOR",
          {
            date: "2026-04-05",
            future: {
              directOpponentPointPct: null,
              indirectOpponentPointPct: null,
              opponentGamesPlayed: 0,
              rank: 10,
              sos: 0.5,
              uniqueOpponents: 0
            },
            past: {
              directOpponentPointPct: null,
              indirectOpponentPointPct: null,
              opponentGamesPlayed: 0,
              rank: 12,
              sos: 0.49,
              uniqueOpponents: 0
            },
            sos: 0.495,
            teamAbbr: "TOR",
            texture: null
          }
        ]
      ])
    });

    expect(result[0]?.narrative[0]).toContain("5v5 offense is rising");
  });
});
