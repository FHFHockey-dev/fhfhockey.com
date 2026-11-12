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

import handler, { buildToiSeries, PP_SHARE_UNAVAILABLE_REASON } from "pages/api/toi";

describe("buildToiSeries (W2-P0-13, decision 71)", () => {
  it("withholds observed PP time and share until a qualified PP clock exists", () => {
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
        // Both teams' rows come back for each game; only the player's team may be used.
        { gameId: 2026020180, teamId: 22, powerPlayToi: "05:00" },
        { gameId: 2026020180, teamId: 99, powerPlayToi: "02:00" },
        { gameId: 2026020200, teamId: 99, powerPlayToi: "06:00" },
        { gameId: 2026020200, teamId: 22, powerPlayToi: "03:00" },
      ],
    );
    expect(series.map((point) => [point.date, point.toi, point.powerPlayToi, point.powerPlayToiShare])).toEqual([
      ["2026-11-01", 20, null, null],
      ["2026-11-03", 21.5, null, null],
    ]);
    // FORGE's split is reported as a labelled model input beside the official team clock.
    expect(series[0].modelPowerPlay).toEqual({
      source: "forge_player_game_strength.toi_pp_seconds",
      playerPpMinutes: 4,
      teamPpClockMinutes: 5,
      exceedsTeamClock: false,
    });
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
    expect(point.modelPowerPlay.teamPpClockMinutes).toBe(4);
  });

  it("keeps a missing FORGE row or team clock unknown, not 0", () => {
    const series = buildToiSeries(
      [
        { toi: "15:00", date: "2026-10-10", gameId: 1 },
        { toi: "15:00", date: "2026-10-12", gameId: 2 },
        { toi: "", date: "2026-10-14", gameId: 3 },
      ],
      [
        { game_id: 2, team_id: 22, toi_pp_seconds: null },
        { game_id: 3, team_id: 22, toi_pp_seconds: 30 },
      ],
      [{ gameId: 2, teamId: 22, powerPlayToi: null }],
    );
    expect(series.map((point) => point.modelPowerPlay.playerPpMinutes)).toEqual([null, null, 0.5]);
    expect(series.map((point) => point.modelPowerPlay.teamPpClockMinutes)).toEqual([null, null, null]);
    expect(series.map((point) => point.modelPowerPlay.exceedsTeamClock)).toEqual([null, null, null]);
    expect(series[2].toi).toBeNull();
  });

  it("flags a modelled PP time above the team clock instead of capping it", () => {
    const [point] = buildToiSeries(
      [{ toi: "15:00", date: "2026-10-10", gameId: 1 }],
      [{ game_id: 1, team_id: 22, toi_pp_seconds: 125 }],
      [{ gameId: 1, teamId: 22, powerPlayToi: "02:00" }],
    );
    expect(point.powerPlayToiShare).toBeNull();
    expect(point.modelPowerPlay.playerPpMinutes).toBeCloseTo(125 / 60, 9);
    expect(point.modelPowerPlay.exceedsTeamClock).toBe(true);
  });
});

describe("/api/toi handler", () => {
  beforeEach(() => {
    fromMock.mockClear();
    tables.skatersGameStats = [
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

  it("serves no observed PP share and says why, with FORGE labelled as a model input", async () => {
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
    expect(json).toHaveBeenCalledWith({
      success: true,
      message: "Success!",
      powerPlayStatus: { available: false, reason: PP_SHARE_UNAVAILABLE_REASON },
      data: [
        {
          date: "2026-11-01",
          toi: 22,
          powerPlayToi: null,
          powerPlayToiShare: null,
          modelPowerPlay: {
            source: "forge_player_game_strength.toi_pp_seconds",
            playerPpMinutes: 3,
            teamPpClockMinutes: 4,
            exceedsTeamClock: false,
          },
        },
      ],
    });
  });
});
