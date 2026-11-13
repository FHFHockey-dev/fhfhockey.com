import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { fromMock } = vi.hoisted(() => ({ fromMock: vi.fn() }));
vi.mock("lib/supabase/public-client", () => ({ default: { from: fromMock } }));

import handler, { MAX_GAMES_PER_REQUEST } from "../../../../../pages/api/v1/pp-share/team-game-clock";

function call(query: Record<string, string>, method = "GET") {
  const res: any = {
    statusCode: 200, headers: {} as Record<string, string>, body: null as any,
    setHeader(k: string, v: string) { this.headers[k] = v; },
    status(code: number) { this.statusCode = code; return this; },
    json(body: unknown) { this.body = body; return this; }
  };
  return handler({ method, query } as any, res).then(() => res);
}

describe("/api/v1/pp-share/team-game-clock (decision 152 gate for client readers)", () => {
  beforeEach(() => {
    fromMock.mockReset();
    fromMock.mockReturnValue({
      select: () => ({
        in: async (_col: string, ids: number[]) => ({
          data: ids.flatMap((id) => [
            { game_id: id, team_id: 22, availability: "available", clock_seconds: 297, unavailable_reason: null, computed_at: "t" },
            { game_id: id, team_id: 12, availability: "not_applicable", clock_seconds: 0, unavailable_reason: null, computed_at: "t" }
          ]),
          error: null
        })
      })
    });
  });
  afterEach(() => {
    delete process.env.PP_SHARE_SERVING_ENABLED;
  });

  it("serving off: says so and reads nothing", async () => {
    const res = await call({ gameIds: "2026020163" });
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ servingEnabled: false, clocks: [] });
    expect(fromMock).not.toHaveBeenCalled();
  });

  it("serving on: returns the stored clock rows", async () => {
    process.env.PP_SHARE_SERVING_ENABLED = "true";
    const res = await call({ gameIds: "2026020163" });
    expect(res.body).toEqual({ servingEnabled: true, clocks: [
      { gameId: 2026020163, teamId: 22, availability: "available", clockSeconds: 297, unavailableReason: null, computedAt: "t" },
      { gameId: 2026020163, teamId: 12, availability: "not_applicable", clockSeconds: 0, unavailableReason: null, computedAt: "t" }
    ] });
    expect(fromMock).toHaveBeenCalledWith("pp_team_game_clock");
  });

  it.each([{ gameIds: "" }, { gameIds: "abc" }, { gameIds: "1,-2" },
    { gameIds: Array.from({ length: MAX_GAMES_PER_REQUEST + 1 }, (_, i) => i + 1).join(",") }])(
    "refuses bad game ids %#", async (query) => {
      process.env.PP_SHARE_SERVING_ENABLED = "true";
      const res = await call(query);
      expect(res.statusCode).toBe(400);
      expect(fromMock).not.toHaveBeenCalled();
    });

  it("refuses anything but GET", async () => {
    expect((await call({ gameIds: "1" }, "POST")).statusCode).toBe(405);
  });
});
