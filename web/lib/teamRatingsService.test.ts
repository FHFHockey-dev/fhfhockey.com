import { beforeEach, describe, expect, it, vi } from "vitest";

const { fromMock } = vi.hoisted(() => ({
  fromMock: vi.fn()
}));

type QueryResult = {
  data?: any;
  error: { message?: string } | null;
};

function createQueryBuilder(resolver: () => QueryResult) {
  const builder: any = {
    select() {
      return builder;
    },
    eq() {
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

import { clearTeamRatingsCache, fetchTeamRatings } from "./teamRatingsService";

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
});
