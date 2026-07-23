import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  leaderboardReadMock,
  playerReadMock,
  playerSummaryMock,
  upcomingReadMock
} = vi.hoisted(() => ({
  leaderboardReadMock: vi.fn(),
  playerReadMock: vi.fn(),
  playerSummaryMock: vi.fn(),
  upcomingReadMock: vi.fn()
}));

vi.mock("lib/sustainability/read", () => ({
  getSustainabilityLeaderboardPayload: leaderboardReadMock,
  getPlayerSustainabilityPayload: playerReadMock,
  getPlayerSustainabilitySummaryPayload: playerSummaryMock,
  getUpcomingSustainabilityPayload: upcomingReadMock
}));

vi.mock("utils/adminOnlyMiddleware", () => ({
  default: (handler: any) => async (req: any, res: any) => {
    if (req.headers?.authorization !== "Bearer allowed") {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }
    req.supabase = { authorized: true };
    return handler(req, res);
  }
}));

import leaderboardHandler, {
  buildLeaderboardEtag
} from "../../../../../pages/api/v1/sustainability/leaderboard";
import playerHandler from "../../../../../pages/api/v1/sustainability/player/[playerId]";
import upcomingHandler from "../../../../../pages/api/v1/sustainability/upcoming/[playerId]";

function createRes() {
  return {
    statusCode: 200,
    body: null as any,
    headers: {} as Record<string, string>,
    setHeader(name: string, value: string) { this.headers[name] = value; },
    status(code: number) { this.statusCode = code; return this; },
    json(body: any) { this.body = body; return this; },
    end() { return this; }
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

  it("returns the canonical l3/l5/l10/l20 summary without changing the single-window contract", async () => {
    playerSummaryMock.mockResolvedValue({
      player_id: 1,
      snapshot_date: "2026-03-21",
      window_contract: ["l3", "l5", "l10", "l20"],
      windows: [{ window_code: "l10", s_100: 72.4 }]
    });
    const res = createRes();
    await playerHandler(
      { method: "GET", query: { playerId: "1", summary: "true" } } as any,
      res
    );

    expect(res.statusCode).toBe(200);
    expect(playerSummaryMock).toHaveBeenCalledWith(
      expect.objectContaining({ playerId: 1 })
    );
    expect(playerReadMock).not.toHaveBeenCalled();
    expect(res.body.window_contract).toEqual(["l3", "l5", "l10", "l20"]);
  });

  it("validates leaderboard filters, paginates, and emits a deterministic ETag", async () => {
    const invalid = createRes();
    await leaderboardHandler(
      { method: "GET", query: { window_type: "GAME" }, headers: {} } as any,
      invalid
    );
    expect(invalid.statusCode).toBe(400);

    const payload = {
      snapshot_date: "2026-03-21",
      season_id: 20252026,
      window_code: "l10",
      filters: { min_games: 5, min_score: 50, rookie_only: false },
      pagination: { page: 2, page_size: 25, total: 30, total_pages: 2 },
      rows: [{ player_id: 1, s_100: 75 }]
    };
    leaderboardReadMock.mockResolvedValue(payload);
    const res = createRes();
    await leaderboardHandler(
      {
        method: "GET",
        query: {
          window_type: "l10",
          min_games: "5",
          min_score: "50",
          page: "2",
          page_size: "25"
        },
        headers: {}
      } as any,
      res
    );

    expect(res.statusCode).toBe(200);
    expect(leaderboardReadMock).toHaveBeenCalledWith(
      expect.objectContaining({
        options: expect.objectContaining({
          minGames: 5,
          minScore: 50,
          page: 2,
          pageSize: 25
        })
      })
    );
    expect(res.headers.ETag).toBe(buildLeaderboardEtag({
      success: true,
      ...payload
    }));
    expect(res.headers["Cache-Control"]).toContain("s-maxage=300");

    const cached = createRes();
    await leaderboardHandler(
      {
        method: "GET",
        query: { window_type: "l10" },
        headers: { "if-none-match": buildLeaderboardEtag({
          success: true,
          ...payload
        }) }
      } as any,
      cached
    );
    expect(cached.statusCode).toBe(304);
    expect(cached.body).toBeNull();
  });

  it("requires admin/cron authorization before returning components", async () => {
    const unauthorized = createRes();
    await leaderboardHandler(
      {
        method: "GET",
        query: { include: "components" },
        headers: {}
      } as any,
      unauthorized
    );
    expect(unauthorized.statusCode).toBe(401);
    expect(leaderboardReadMock).not.toHaveBeenCalled();

    leaderboardReadMock.mockResolvedValue({
      snapshot_date: "2026-03-21",
      season_id: 20252026,
      window_code: "l10",
      filters: {},
      pagination: {},
      rows: []
    });
    const authorized = createRes();
    await leaderboardHandler(
      {
        method: "GET",
        query: { include: "components" },
        headers: { authorization: "Bearer allowed" }
      } as any,
      authorized
    );
    expect(authorized.statusCode).toBe(200);
    expect(authorized.headers["Cache-Control"]).toBe("private, no-store");
    expect(leaderboardReadMock).toHaveBeenCalledWith(
      expect.objectContaining({
        client: { authorized: true },
        options: expect.objectContaining({ includeComponents: true })
      })
    );
  });
});
