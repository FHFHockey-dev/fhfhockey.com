import { beforeEach, describe, expect, it, vi } from "vitest";

const { playerReadMock, upcomingReadMock } = vi.hoisted(() => ({
  playerReadMock: vi.fn(),
  upcomingReadMock: vi.fn()
}));

vi.mock("lib/sustainability/read", () => ({
  getPlayerSustainabilityPayload: playerReadMock,
  getUpcomingSustainabilityPayload: upcomingReadMock
}));

import playerHandler from "../../../../../pages/api/v1/sustainability/player/[playerId]";
import upcomingHandler from "../../../../../pages/api/v1/sustainability/upcoming/[playerId]";

function createRes() {
  return {
    statusCode: 200,
    body: null as any,
    headers: {} as Record<string, string>,
    setHeader(name: string, value: string) { this.headers[name] = value; },
    status(code: number) { this.statusCode = code; return this; },
    json(body: any) { this.body = body; return this; }
  } as any;
}

describe("sustainability read routes", () => {
  beforeEach(() => vi.clearAllMocks());

  it("validates player window/horizon and returns the stable payload", async () => {
    const invalid = createRes();
    await playerHandler({ method: "GET", query: { playerId: "1", window: "7" } } as any, invalid);
    expect(invalid.statusCode).toBe(400);

    playerReadMock.mockResolvedValue({ player_id: 1, snapshot_date: "2026-03-21" });
    const res = createRes();
    await playerHandler({ method: "GET", query: { playerId: "1", window: "10", horizon: "5" } } as any, res);
    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({ success: true, player_id: 1 });
  });

  it("validates upcoming game counts and returns 404 for missing data", async () => {
    const invalid = createRes();
    await upcomingHandler({ method: "GET", query: { playerId: "1", games: "7" } } as any, invalid);
    expect(invalid.statusCode).toBe(400);

    upcomingReadMock.mockResolvedValue(null);
    const res = createRes();
    await upcomingHandler({ method: "GET", query: { playerId: "1", games: "5" } } as any, res);
    expect(res.statusCode).toBe(404);
  });
});
