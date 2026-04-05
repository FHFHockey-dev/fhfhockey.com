import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  countState,
  fetchCurrentSeasonMock,
  fetchGameLogsMock,
  fetchAllRatingsMock,
  fetchWgoStatsMock,
  upsertMock,
  calculateEwmaMock,
  calculateLeagueMetricsMock,
  calculateZScoresMock,
  calculateRawScoresMock,
  calculateRawDistributionMock,
  calculateFinalRatingMock
} = vi.hoisted(() => ({
  countState: { value: 0 },
  fetchCurrentSeasonMock: vi.fn(),
  fetchGameLogsMock: vi.fn(),
  fetchAllRatingsMock: vi.fn(),
  fetchWgoStatsMock: vi.fn(),
  upsertMock: vi.fn(),
  calculateEwmaMock: vi.fn(),
  calculateLeagueMetricsMock: vi.fn(),
  calculateZScoresMock: vi.fn(),
  calculateRawScoresMock: vi.fn(),
  calculateRawDistributionMock: vi.fn(),
  calculateFinalRatingMock: vi.fn()
}));

vi.mock("../../../../../lib/cron/withCronJobAudit", () => ({
  withCronJobAudit: (handler: unknown) => handler
}));

vi.mock("../../../../../utils/fetchCurrentSeason", () => ({
  fetchCurrentSeason: fetchCurrentSeasonMock
}));

vi.mock("../../../../../lib/power-ratings", () => ({
  fetchGameLogs: fetchGameLogsMock,
  calculateEwma: calculateEwmaMock,
  calculateLeagueMetrics: calculateLeagueMetricsMock,
  calculateZScores: calculateZScoresMock,
  calculateRawScores: calculateRawScoresMock,
  calculateRawDistribution: calculateRawDistributionMock,
  calculateFinalRating: calculateFinalRatingMock,
  fetchWgoStats: fetchWgoStatsMock,
  fetchAllRatings: fetchAllRatingsMock,
  LOOKBACK_GAMES: 25
}));

vi.mock("../../../../../lib/supabase/server", () => ({
  default: {
    from: vi.fn(() => ({
      select: vi.fn(() =>
        Promise.resolve({
          count: countState.value,
          error: null
        })
      ),
      upsert: upsertMock
    }))
  }
}));

import handler from "../../../../../pages/api/v1/db/update-team-power-ratings";

function createMockRes() {
  const res: any = {
    statusCode: 200,
    headers: {} as Record<string, string | string[]>,
    body: null as any,
    setHeader(key: string, value: string | string[]) {
      this.headers[key] = value;
    },
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(payload: any) {
      this.body = payload;
      return this;
    }
  };
  return res;
}

describe("/api/v1/db/update-team-power-ratings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    countState.value = 0;
    fetchCurrentSeasonMock.mockResolvedValue({ startDate: "2025-10-07" });
    fetchGameLogsMock.mockResolvedValue([]);
    fetchAllRatingsMock.mockResolvedValue([]);
    fetchWgoStatsMock.mockResolvedValue([]);
    upsertMock.mockResolvedValue({ error: null });
    calculateEwmaMock.mockImplementation(() => null);
    calculateLeagueMetricsMock.mockReturnValue({});
    calculateZScoresMock.mockImplementation((metric) => metric);
    calculateRawScoresMock.mockImplementation((metric) => metric);
    calculateRawDistributionMock.mockImplementation((scores: any[]) => ({
      date: scores[0]?.date ?? "2026-03-14"
    }));
    calculateFinalRatingMock.mockImplementation(() => ({
      team_abbreviation: "ANA",
      date: "2026-03-14",
      off_rating: 100,
      def_rating: 100,
      pace_rating: 100,
      xgf60: 0,
      gf60: 0,
      sf60: 0,
      xga60: 0,
      ga60: 0,
      sa60: 0,
      pace60: 0,
      finishing_rating: 100,
      goalie_rating: 100,
      danger_rating: 100,
      special_rating: 100,
      discipline_rating: 100,
      variance_flag: 0
    }));
  });

  it("returns 405 for unsupported methods", async () => {
    const req: any = {
      method: "DELETE",
      query: {}
    };
    const res = createMockRes();

    await handler(req, res);

    expect(res.statusCode).toBe(405);
    expect(res.headers.Allow).toEqual(["POST", "GET"]);
    expect(res.body).toEqual({ error: "Method not allowed" });
  });

  it("backfills from season start by default when the table is empty", async () => {
    const req: any = {
      method: "GET",
      query: {
        date: "2026-03-14"
      }
    };
    const res = createMockRes();

    await handler(req, res);

    expect(fetchCurrentSeasonMock).toHaveBeenCalledTimes(1);
    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({
      startDate: "2025-10-07",
      endDate: "2026-03-14",
      executionScope: {
        requestedDate: "2026-03-14",
        startDate: "2025-10-07",
        endDate: "2026-03-14",
        tableWasEmpty: true,
        smokeTestMode: false,
        autoBackfillApplied: true,
        smokeTestComparable: false,
        smokeTestGuidance:
          "This run expanded beyond a one-day smoke test. Pass smokeTest=true with a target date to force a bounded one-day operational probe when the table is empty."
      }
    });
    expect(res.body.executionScope.windowDays).toBeGreaterThan(1);
  });

  it("keeps empty-table smoke tests bounded to the requested date", async () => {
    const req: any = {
      method: "GET",
      query: {
        date: "2026-03-14",
        smokeTest: "true"
      }
    };
    const res = createMockRes();

    await handler(req, res);

    expect(fetchCurrentSeasonMock).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({
      startDate: "2026-03-14",
      endDate: "2026-03-14",
      processedDays: 1,
      executionScope: {
        requestedDate: "2026-03-14",
        startDate: "2026-03-14",
        endDate: "2026-03-14",
        windowDays: 1,
        tableWasEmpty: true,
        smokeTestMode: true,
        autoBackfillApplied: false,
        smokeTestComparable: true,
        smokeTestGuidance: null
      }
    });
  });

  it("supports explicit backfill ranges when the table is already populated", async () => {
    countState.value = 32;

    const req: any = {
      method: "GET",
      query: {
        startDate: "2026-03-20",
        endDate: "2026-04-05"
      }
    };
    const res = createMockRes();

    await handler(req, res);

    expect(fetchCurrentSeasonMock).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({
      startDate: "2026-03-20",
      endDate: "2026-04-05",
      executionScope: {
        requestedDate: "2026-04-05",
        requestedStartDate: "2026-03-20",
        requestedEndDate: "2026-04-05",
        startDate: "2026-03-20",
        endDate: "2026-04-05",
        tableWasEmpty: false,
        smokeTestMode: false,
        autoBackfillApplied: false,
        explicitRangeApplied: true,
        smokeTestComparable: false
      }
    });
    expect(res.body.executionScope.windowDays).toBeGreaterThan(1);
  });

  it("recomputes stored trend10 from played snapshots instead of stale stored rows", async () => {
    countState.value = 32;

    fetchGameLogsMock.mockResolvedValue([
      { team_abbreviation: "COL", date: "2026-04-05", data_mode: "all" },
      { team_abbreviation: "COL", date: "2026-04-03", data_mode: "all" },
      { team_abbreviation: "COL", date: "2026-04-01", data_mode: "all" },
      { team_abbreviation: "COL", date: "2026-03-30", data_mode: "all" },
      { team_abbreviation: "COL", date: "2026-03-28", data_mode: "all" }
    ]);
    fetchAllRatingsMock.mockResolvedValue([
      {
        team_abbreviation: "COL",
        date: "2026-04-04",
        off_rating: 120,
        trend10: 0
      },
      {
        team_abbreviation: "COL",
        date: "2026-04-02",
        off_rating: 120,
        trend10: 0
      }
    ]);

    calculateEwmaMock.mockImplementation((games: any[], targetDate: string) => ({
      team_abbreviation: games[0].team_abbreviation,
      date: targetDate
    }));
    calculateFinalRatingMock.mockImplementation((score: any) => {
      const offByDate: Record<string, number> = {
        "2026-04-05": 120,
        "2026-04-03": 110,
        "2026-04-01": 108,
        "2026-03-30": 106,
        "2026-03-28": 104
      };

      return {
        team_abbreviation: score.team_abbreviation,
        date: score.date,
        off_rating: offByDate[score.date] ?? 100,
        def_rating: 100,
        pace_rating: 100,
        xgf60: 0,
        gf60: 0,
        sf60: 0,
        xga60: 0,
        ga60: 0,
        sa60: 0,
        pace60: 0,
        finishing_rating: 100,
        goalie_rating: 100,
        danger_rating: 100,
        special_rating: 100,
        discipline_rating: 100,
        variance_flag: 0
      };
    });

    const req: any = {
      method: "GET",
      query: {
        date: "2026-04-05"
      }
    };
    const res = createMockRes();

    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(upsertMock).toHaveBeenCalledTimes(1);
    const upserts = upsertMock.mock.calls[0]?.[0] as Array<Record<string, unknown>>;
    expect(upserts).toEqual([
      expect.objectContaining({
        team_abbreviation: "COL",
        trend10: 13
      })
    ]);
  });

  it("returns 400 for invalid explicit date ranges", async () => {
    const req: any = {
      method: "GET",
      query: {
        startDate: "2026-04-05",
        endDate: "2026-03-20"
      }
    };
    const res = createMockRes();

    await handler(req, res);

    expect(res.statusCode).toBe(400);
    expect(res.body).toEqual({
      error: "Invalid startDate/endDate range"
    });
  });
});
