import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { fetchCurrentSeasonMock, rebuildPlayerTrendsMock } = vi.hoisted(() => ({
  fetchCurrentSeasonMock: vi.fn(),
  rebuildPlayerTrendsMock: vi.fn(),
}));

vi.mock("../../../../../lib/cron/withCronJobAudit", () => ({
  withCronJobAudit: (handler: unknown) => handler,
}));

vi.mock("../../../../../utils/fetchCurrentSeason", () => ({
  fetchCurrentSeason: fetchCurrentSeasonMock,
}));

vi.mock("../../../../../pages/api/v1/trends/player-trends", () => ({
  rebuildPlayerTrends: rebuildPlayerTrendsMock,
}));

import handler from "../../../../../pages/api/v1/db/update-player-trend-metrics";

function createMockRes() {
  return {
    statusCode: 200,
    body: null as any,
    headers: {} as Record<string, string | string[]>,
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
    },
  } as any;
}

describe("/api/v1/db/update-player-trend-metrics", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-15T12:00:00.000Z"));
    fetchCurrentSeasonMock.mockResolvedValue({
      id: 20252026,
      startDate: "2025-10-07T00:00:00.000Z",
    });
    rebuildPlayerTrendsMock.mockResolvedValue({
      success: true,
      startDate: "2025-10-07",
      writeFromDate: "2026-03-08",
      seasonId: 20252026,
      playersProcessed: 10,
      gamesProcessed: 200,
      metricsUpserted: 300,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it("rebuilds current-season state but writes only the seven-day repair window", async () => {
    const res = createMockRes();

    await handler({ method: "POST" } as any, res);

    expect(res.statusCode).toBe(200);
    expect(rebuildPlayerTrendsMock).toHaveBeenCalledWith({
      startDate: "2025-10-07",
      seasonId: 20252026,
      writeFromDate: "2026-03-08",
    });
    expect(res.body).toMatchObject({
      success: true,
      mode: "current_season_incremental_write",
      writeWindow: {
        startDate: "2026-03-08",
        endDate: "2026-03-15",
        repairDays: 7,
      },
    });
  });

  it("rejects GET so the scheduled writer has an explicit POST contract", async () => {
    const res = createMockRes();

    await handler({ method: "GET" } as any, res);

    expect(res.statusCode).toBe(405);
    expect(res.headers.Allow).toEqual(["POST"]);
    expect(rebuildPlayerTrendsMock).not.toHaveBeenCalled();
  });
});
