import { beforeEach, describe, expect, it, vi } from "vitest";

const { ingestNhlApiRawGamesMock, serviceRoleFromMock } = vi.hoisted(() => ({
  ingestNhlApiRawGamesMock: vi.fn(),
  serviceRoleFromMock: vi.fn(),
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

import handler from "../../../../../pages/api/v1/db/update-nhl-play-by-play";

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

describe("/api/v1/db/update-nhl-play-by-play", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    ingestNhlApiRawGamesMock.mockResolvedValue([
      {
        gameId: 2025021103,
        rosterCount: 40,
        eventCount: 318,
        shiftCount: 706,
        rawEndpointsStored: 4,
      },
    ]);
  });

  it("runs a single-game raw ingest and returns route metadata", async () => {
    const req: any = {
      method: "GET",
      query: {
        gameId: "2025021103",
        seasonId: "20252026",
      },
      headers: {},
    };
    const res = createMockRes();

    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(ingestNhlApiRawGamesMock).toHaveBeenCalledWith(
      expect.anything(),
      [2025021103]
    );
    expect(res.body).toMatchObject({
      success: true,
      route: "/api/v1/db/update-nhl-play-by-play",
      routeAlias: "play-by-play",
      mode: "game",
      seasonId: 20252026,
      requestedGameCount: 1,
      gameIds: [2025021103],
      rowsUpserted: 1068,
    });
  });

  it("returns 405 for unsupported methods", async () => {
    const req: any = {
      method: "DELETE",
      query: {},
      headers: {},
    };
    const res = createMockRes();

    await handler(req, res);

    expect(res.statusCode).toBe(405);
    expect(res.body).toMatchObject({
      success: false,
      message: "Method not allowed",
    });
  });
});
