import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  countState,
  fetchCurrentSeasonMock,
  fetchGameLogsMock,
  fetchAllRatingsMock,
  fetchWgoStatsMock,
  upsertMock
} = vi.hoisted(() => ({
  countState: { value: 0 },
  fetchCurrentSeasonMock: vi.fn(),
  fetchGameLogsMock: vi.fn(),
  fetchAllRatingsMock: vi.fn(),
  fetchWgoStatsMock: vi.fn(),
  upsertMock: vi.fn()
}));

vi.mock("../../../../../lib/cron/withCronJobAudit", () => ({
  withCronJobAudit: (handler: unknown) => handler
}));

vi.mock("../../../../../utils/fetchCurrentSeason", () => ({
  fetchCurrentSeason: fetchCurrentSeasonMock
}));

vi.mock("../../../../../lib/power-ratings", () => ({
  fetchGameLogs: fetchGameLogsMock,
  calculateEwma: vi.fn(() => null),
  calculateLeagueMetrics: vi.fn(),
  calculateZScores: vi.fn(),
  calculateRawScores: vi.fn(),
  calculateRawDistribution: vi.fn(),
  calculateFinalRating: vi.fn(),
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
});
