import { beforeEach, describe, expect, it, vi } from "vitest";

const { tables, fromMock } = vi.hoisted(() => ({
  tables: {} as Record<string, any[]>,
  fromMock: vi.fn(),
}));

vi.mock("lib/supabase/public-client", () => ({
  default: {
    from: (table: string) => {
      fromMock(table);
      const query: any = {
        select: vi.fn(() => query),
        eq: vi.fn(() => query),
        gte: vi.fn(() => query),
        lte: vi.fn(() => query),
        in: vi.fn(() => query),
        single: vi.fn(() => query),
        throwOnError: vi.fn(async () => ({ data: tables[table] ?? [] })),
      };
      return query;
    },
  },
}));

vi.mock("lib/NHL/server", () => ({
  getCurrentSeason: vi.fn(),
  getPlayer: vi.fn(async () => ({ position: "C", teamId: 22 })),
}));

import handler, { buildToiSeries } from "pages/api/toi";

describe("buildToiSeries", () => {
  it("takes PP TOI from forge toi_pp_seconds and shares it against the player's own team", () => {
    const series = buildToiSeries(
      [
        { toi: "21:30", date: "2026-11-03", gameId: 2026020200 },
        { toi: "20:00", date: "2026-11-01", gameId: 2026020180 },
      ],
      [
        { game_id: 2026020180, team_id: 22, toi_pp_seconds: 240 },
        { game_id: 2026020200, team_id: 22, toi_pp_seconds: 90 },
      ],
      [
        // Both teams' rows come back for each game; only EDM's may be used.
        { gameId: 2026020180, teamId: 22, powerPlayToi: "05:00" },
        { gameId: 2026020180, teamId: 99, powerPlayToi: "02:00" },
        { gameId: 2026020200, teamId: 99, powerPlayToi: "06:00" },
        { gameId: 2026020200, teamId: 22, powerPlayToi: "03:00" },
      ],
    );
    expect(series).toEqual([
      { date: "2026-11-01", toi: 20, powerPlayToi: 4, powerPlayToiShare: 80 },
      { date: "2026-11-03", toi: 21.5, powerPlayToi: 1.5, powerPlayToiShare: 50 },
    ]);
  });

  it("uses the team the player dressed for in that game, not the current team", () => {
    const [point] = buildToiSeries(
      [{ toi: "18:00", date: "2026-10-10", gameId: 1 }],
      [{ game_id: 1, team_id: 7, toi_pp_seconds: 60 }],
      [
        { gameId: 1, teamId: 7, powerPlayToi: "04:00" },
        { gameId: 1, teamId: 22, powerPlayToi: "02:00" },
      ],
    );
    expect(point.powerPlayToiShare).toBe(25);
  });

  it("returns zero PP TOI and share when forge has no row or the team had no PP", () => {
    const series = buildToiSeries(
      [
        { toi: "15:00", date: "2026-10-10", gameId: 1 },
        { toi: "15:00", date: "2026-10-12", gameId: 2 },
      ],
      [{ game_id: 2, team_id: 22, toi_pp_seconds: 0 }],
      [{ gameId: 2, teamId: 22, powerPlayToi: "00:00" }],
    );
    expect(series.map((point) => [point.powerPlayToi, point.powerPlayToiShare])).toEqual([
      [0, 0],
      [0, 0],
    ]);
  });

  it("caps the share at 100% when shift and team clocks disagree slightly", () => {
    const [point] = buildToiSeries(
      [{ toi: "15:00", date: "2026-10-10", gameId: 1 }],
      [{ game_id: 1, team_id: 22, toi_pp_seconds: 125 }],
      [{ gameId: 1, teamId: 22, powerPlayToi: "02:00" }],
    );
    expect(point.powerPlayToiShare).toBe(100);
  });
});

describe("/api/toi handler", () => {
  beforeEach(() => {
    fromMock.mockClear();
    tables.skatersGameStats = [
      // powerPlayToi is no longer selected: the column is a "00:00" placeholder.
      { toi: "22:00", games: { date: "2026-11-01", id: 2026020163 } },
    ];
    tables.forge_player_game_strength = [
      { game_id: 2026020163, team_id: 22, toi_pp_seconds: 180 },
    ];
    tables.teamGameStats = [
      { teamId: 22, powerPlayToi: "04:00", games: { date: "2026-11-01", id: 2026020163 } },
      { teamId: 99, powerPlayToi: "02:00", games: { date: "2026-11-01", id: 2026020163 } },
    ];
  });

  it("serves the chart a non-zero PP share from forge PP TOI", async () => {
    const json = vi.fn();
    const res: any = { status: vi.fn(() => ({ json })) };
    await handler(
      {
        body: {
          PlayerId: 8478402,
          Season: "20262027",
          StartTime: "2026-10-01",
          EndTime: "2026-11-05",
        },
      } as any,
      res,
    );
    expect(res.status).toHaveBeenCalledWith(200);
    expect(fromMock).toHaveBeenCalledWith("forge_player_game_strength");
    expect(json).toHaveBeenCalledWith({
      success: true,
      message: "Success!",
      data: [
        { date: "2026-11-01", toi: 22, powerPlayToi: 3, powerPlayToiShare: 75 },
      ],
    });
  });
});
