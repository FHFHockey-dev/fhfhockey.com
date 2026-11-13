import { beforeEach, describe, expect, it, vi } from "vitest";

const { fromMock, lteMock, selectMock } = vi.hoisted(() => ({
  fromMock: vi.fn(),
  lteMock: vi.fn(),
  selectMock: vi.fn()
}));

type QueryResult = {
  data?: any;
  error: { message?: string } | null;
};

function createQueryBuilder(resolver: () => QueryResult) {
  const builder: any = {
    select(...args: unknown[]) {
      selectMock(...args);
      return builder;
    },
    eq() {
      return builder;
    },
    lte(...args: unknown[]) {
      lteMock(...args);
      return builder;
    },
    limit() {
      return builder;
    },
    order() {
      return builder;
    },
    then(resolve: (value: any) => any) {
      const out = resolver();
      return Promise.resolve(resolve({ data: out.data ?? [], error: out.error }));
    }
  };
  return builder;
}

vi.mock("lib/supabase/server", () => ({
  default: {
    from: fromMock
  }
}));

import {
  clearTeamRatingsCache,
  fetchTeamRatings,
  fetchTeamRatingsAsOf
} from "./teamRatingsService";

describe("teamRatingsService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearTeamRatingsCache();
  });

  it("reads from the canonical team_power_ratings_daily table only", async () => {
    fromMock.mockImplementation((table: string) => {
      expect(table).toBe("team_power_ratings_daily");
      return createQueryBuilder(() => ({
        data: [
          {
            team_abbreviation: "TOR",
            date: "2026-02-07",
            off_rating: 81.2,
            def_rating: 74.6,
            pace_rating: 79.1,
            pp_tier: 1,
            pk_tier: 2,
            trend10: 3.4,
            xgf60: 3.2,
            gf60: 3.1,
            sf60: 31.7,
            xga60: 2.8,
            ga60: 2.7,
            sa60: 28.4,
            pace60: 60.3,
            finishing_rating: 0.4,
            goalie_rating: 0.2,
            danger_rating: 0.1,
            special_rating: 0.3,
            discipline_rating: -0.1,
            variance_flag: 0
          }
        ],
        error: null
      }));
    });

    const result = await fetchTeamRatings("2026-02-07");

    expect(fromMock).toHaveBeenCalledTimes(1);
    expect(fromMock).toHaveBeenCalledWith("team_power_ratings_daily");
    expect(result).toEqual([
      expect.objectContaining({
        teamAbbr: "TOR",
        date: "2026-02-07",
        offRating: 81.2,
        finishingRating: 0.4
      })
    ]);
  });

  it("carries calculation version and source date into the read model (Astra #434 P1)", async () => {
    const base = {
      date: "2026-09-30",
      off_rating: 100,
      def_rating: 100,
      pace_rating: 100,
      trend10: 0,
      goalie_rating: 104
    };
    fromMock.mockImplementation(() =>
      createQueryBuilder(() => ({
        data: [
          {
            ...base,
            team_abbreviation: "TOR",
            calculation_version: "team-power-v4-5v5-goaltending",
            source_through_date: "2026-09-29"
          },
          {
            ...base,
            team_abbreviation: "SEA",
            calculation_version: "legacy_unversioned",
            source_through_date: "2026-08-29T00:00:00+00:00"
          },
          { ...base, team_abbreviation: "UTA", calculation_version: null, source_through_date: null }
        ],
        error: null
      }))
    );

    const rows = await fetchTeamRatings("2026-09-30");

    expect(String(selectMock.mock.calls[0]?.[0])).toContain(
      "calculation_version,source_through_date"
    );
    expect(
      rows.map(({ teamAbbr, calculationVersion, sourceThroughDate }) => [
        teamAbbr,
        calculationVersion,
        sourceThroughDate
      ])
    ).toEqual([
      ["TOR", "team-power-v4-5v5-goaltending", "2026-09-29"],
      ["SEA", "legacy_unversioned", "2026-08-29"],
      ["UTA", null, null]
    ]);

    clearTeamRatingsCache();
    const asOf = await fetchTeamRatingsAsOf("2026-09-30");
    expect(asOf.ratings[1]).toMatchObject({
      calculationVersion: "legacy_unversioned",
      sourceThroughDate: "2026-08-29"
    });
  });

  it("keeps an unknown PP/PK tier unknown instead of tier 0 (W1 P0 #13)", async () => {
    fromMock.mockImplementation(() =>
      createQueryBuilder(() => ({
        data: [
          {
            team_abbreviation: "UTA",
            date: "2026-02-07",
            off_rating: 100,
            def_rating: 100,
            pace_rating: 100,
            pp_tier: null,
            pk_tier: 3,
            trend10: 0
          }
        ],
        error: null
      }))
    );

    const [row] = await fetchTeamRatings("2026-02-07");

    expect(row.ppTier).toBeNull();
    expect(row.pkTier).toBe(3);
  });

  it("falls back to core columns on the same canonical table when extended columns are unavailable", async () => {
    let callCount = 0;
    fromMock.mockImplementation((table: string) => {
      expect(table).toBe("team_power_ratings_daily");
      return createQueryBuilder(() => {
        callCount += 1;
        if (callCount === 1) {
          return {
            data: [],
            error: {
              message: 'column "finishing_rating" does not exist'
            }
          };
        }

        return {
          data: [
            {
              team_abbreviation: "MTL",
              date: "2026-02-07",
              off_rating: 72.1,
              def_rating: 69.5,
              pace_rating: 70.3,
              pp_tier: 2,
              pk_tier: 2,
              trend10: -1.2,
              xgf60: 2.6,
              gf60: 2.5,
              sf60: 28.1,
              xga60: 2.9,
              ga60: 3,
              sa60: 30.4,
              pace60: 58.8
            }
          ],
          error: null
        };
      });
    });

    const result = await fetchTeamRatings("2026-02-07", "mtl");

    expect(fromMock).toHaveBeenCalledTimes(2);
    expect(fromMock.mock.calls).toEqual([
      ["team_power_ratings_daily"],
      ["team_power_ratings_daily"]
    ]);
    expect(result).toEqual([
      expect.objectContaining({
        teamAbbr: "MTL",
        finishingRating: null,
        goalieRating: null
      })
    ]);
  });

  it("resolves the nearest rating snapshot on or before a historical slate", async () => {
    fromMock.mockImplementation(() =>
      createQueryBuilder(() => ({
        data: [
          {
            team_abbreviation: "TOR",
            date: "2026-02-06",
            off_rating: 101,
            def_rating: 102,
            pace_rating: 99,
            pp_tier: 1,
            pk_tier: 2,
            trend10: 1,
            xgf60: 3,
            gf60: 3,
            sf60: 30,
            xga60: 2.8,
            ga60: 2.7,
            sa60: 29,
            pace60: 60
          },
          {
            team_abbreviation: "TOR",
            date: "2026-02-05",
            off_rating: 99,
            def_rating: 99,
            pace_rating: 99,
            pp_tier: 2,
            pk_tier: 2,
            trend10: 0,
            xgf60: 2.9,
            gf60: 2.9,
            sf60: 29,
            xga60: 2.9,
            ga60: 2.9,
            sa60: 29,
            pace60: 58
          }
        ],
        error: null
      }))
    );

    const result = await fetchTeamRatingsAsOf("2026-02-07", "tor");

    expect(lteMock).toHaveBeenCalledWith("date", "2026-02-07");
    expect(result).toMatchObject({
      requestedDate: "2026-02-07",
      resolvedDate: "2026-02-06",
      ratings: [{ teamAbbr: "TOR", date: "2026-02-06" }]
    });
    expect(fromMock).toHaveBeenCalledTimes(1);
  });
});
