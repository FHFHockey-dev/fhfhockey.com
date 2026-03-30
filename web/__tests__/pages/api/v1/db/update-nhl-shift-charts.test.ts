import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  ingestNhlApiRawGamesMock,
  serviceRoleFromMock,
  gamesSelectMock,
  gamesEqMock,
  gamesLteMock,
  gamesOrderMock,
  gamesLimitMock,
} = vi.hoisted(() => ({
  ingestNhlApiRawGamesMock: vi.fn(),
  serviceRoleFromMock: vi.fn(),
  gamesSelectMock: vi.fn(),
  gamesEqMock: vi.fn(),
  gamesLteMock: vi.fn(),
  gamesOrderMock: vi.fn(),
  gamesLimitMock: vi.fn(),
}));

vi.mock("lib/cron/withCronJobAudit", () => ({
  withCronJobAudit: (handler: any) => handler,
}));

vi.mock("utils/adminOnlyMiddleware", () => ({
  default: (handler: any) => handler,
}));

vi.mock("lib/NHL/server", () => ({
  getCurrentSeason: vi.fn(async () => ({ seasonId: 20252026 })),
}));

vi.mock("lib/supabase/server", () => ({
  default: {
    from: serviceRoleFromMock,
  },
}));

vi.mock("lib/supabase/Upserts/nhlRawGamecenter.mjs", () => ({
  ingestNhlApiRawGames: ingestNhlApiRawGamesMock,
}));

import handler from "../../../../../pages/api/v1/db/update-nhl-shift-charts";

function createMockRes() {
  const res: any = {
    statusCode: 200,
    headers: {} as Record<string, string | string[]>,
    body: null as any,
    headersSent: false,
    setHeader(key: string, value: string | string[]) {
      this.headers[key] = value;
    },
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(payload: any) {
      this.body = payload;
      this.headersSent = true;
      return this;
    },
    send(payload: any) {
      this.body = payload;
      this.headersSent = true;
      return this;
    },
  };
  return res;
}

describe("/api/v1/db/update-nhl-shift-charts", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    gamesLimitMock.mockResolvedValue({
      data: [
        { id: 2025021085, date: "2026-03-19", seasonId: 20252026 },
        { id: 2025021084, date: "2026-03-19", seasonId: 20252026 },
      ],
      error: null,
    });
    gamesOrderMock.mockReturnValue({
      order: gamesOrderMock,
      limit: gamesLimitMock,
    });
    gamesLteMock.mockReturnValue({
      order: gamesOrderMock,
    });
    gamesEqMock.mockReturnValue({
      lte: gamesLteMock,
    });
    gamesSelectMock.mockReturnValue({
      eq: gamesEqMock,
    });

    serviceRoleFromMock.mockImplementation((table: string) => {
      if (table === "games") {
        return {
          select: gamesSelectMock,
        };
      }
      throw new Error(`Unexpected table access: ${table}`);
    });

    ingestNhlApiRawGamesMock.mockResolvedValue([
      {
        gameId: 2025021085,
        rosterCount: 40,
        eventCount: 358,
        shiftCount: 720,
        rawEndpointsStored: 4,
      },
      {
        gameId: 2025021084,
        rosterCount: 40,
        eventCount: 299,
        shiftCount: 782,
        rawEndpointsStored: 4,
      },
    ]);
  });

  it("runs a backfill batch and reports the selected game ids", async () => {
    const req: any = {
      method: "POST",
      query: {
        backfill: "true",
        seasonId: "20252026",
        limit: "2",
      },
      headers: {},
    };
    const res = createMockRes();

    await handler(req, res);

    expect(serviceRoleFromMock).toHaveBeenCalledWith("games");
    expect(ingestNhlApiRawGamesMock).toHaveBeenCalledWith(
      expect.anything(),
      [2025021085, 2025021084]
    );
    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({
      success: true,
      route: "/api/v1/db/update-nhl-shift-charts",
      routeAlias: "shift-charts",
      mode: "backfill_batch",
      seasonId: 20252026,
      requestedGameCount: 2,
      gameIds: [2025021085, 2025021084],
      rowsUpserted: 2247,
    });
  });
});
