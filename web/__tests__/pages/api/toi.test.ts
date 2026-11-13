import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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
        then: (resolve: any, reject: any) =>
          Promise.resolve({ data: tables[table] ?? [], error: null }).then(resolve, reject),
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
import { PP_CLOCK_MISSING_REASON, PP_PLAYER_ABOVE_CLOCK_REASON } from "lib/ppShare/serving";

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

  it("serving off (PP_SHARE_SERVING_ENABLED unset) never reads the stored PP tables", async () => {
    const res: any = { status: vi.fn(() => ({ json: vi.fn() })) };
    await handler({ body: { PlayerId: 8478402, Season: "20262027", StartTime: "2026-10-01", EndTime: "2026-11-05" } } as any, res);
    expect(fromMock.mock.calls.map(([table]) => table)).not.toContain("pp_team_game_clock");
    expect(fromMock.mock.calls.map(([table]) => table)).not.toContain("powerPlayCombinations");
  });

  describe("serving on (PP_SHARE_SERVING_ENABLED=true, decision 152)", () => {
    beforeEach(() => {
      process.env.PP_SHARE_SERVING_ENABLED = "true";
      tables.pp_team_game_clock = [
        { game_id: 2026020163, team_id: 22, availability: "available", clock_seconds: 297, unavailable_reason: null, computed_at: "t" },
        { game_id: 2026020163, team_id: 99, availability: "available", clock_seconds: 126, unavailable_reason: null, computed_at: "t" },
      ];
      tables.powerPlayCombinations = [{ gameId: 2026020163, PPTOI: 223 }];
    });
    afterEach(() => {
      delete process.env.PP_SHARE_SERVING_ENABLED;
    });

    it("serves stored PP minutes and share (%) from the player's team clock", async () => {
      const json = vi.fn();
      const res: any = { status: vi.fn(() => ({ json })) };
      await handler({ body: { PlayerId: 8480803, Season: "20262027", StartTime: "2026-10-01", EndTime: "2026-11-05" } } as any, res);
      const body = json.mock.calls[0][0];
      expect(body.powerPlayStatus).toEqual({ available: true, reason: null });
      expect(body.data[0]).toMatchObject({
        powerPlayToi: 223 / 60,
        powerPlayToiShare: (223 / 297) * 100,
        powerPlayShareStatus: { availability: "available", reason: null },
      });
    });

    const games = [{ toi: "20:00", date: "2026-11-01", gameId: 1 }];
    const forge = [{ game_id: 1, team_id: 22, toi_pp_seconds: 100 }];
    const clockRow = (over: object) => ({ gameId: 1, teamId: 22, availability: "available" as const, clockSeconds: 120,
      unavailableReason: null, computedAt: "t", ...over });
    const point = (clocks: any[], ppRows: any[], forgeRows = forge) =>
      buildToiSeries(games, forgeRows, [], { clocks, ppRows })[0];

    it.each([
      { name: "available", clocks: [clockRow({})], ppRows: [{ gameId: 1, PPTOI: 60 }],
        want: { powerPlayToi: 1, powerPlayToiShare: 50, powerPlayShareStatus: { availability: "available", reason: null } } },
      { name: "available, a skater with no stored row (a real 0)", clocks: [clockRow({})], ppRows: [],
        want: { powerPlayToi: 0, powerPlayToiShare: 0, powerPlayShareStatus: { availability: "available", reason: null } } },
      { name: "not applicable (N/A, never 0%)", clocks: [clockRow({ availability: "not_applicable", clockSeconds: 0 })], ppRows: [],
        want: { powerPlayToi: 0, powerPlayToiShare: null, powerPlayShareStatus: { availability: "not_applicable", reason: null } } },
      { name: "unavailable with its reason", clocks: [clockRow({ availability: "unavailable", clockSeconds: 148,
        unavailableReason: "The clock differs from the official team PP total by +28 s." })], ppRows: [{ gameId: 1, PPTOI: 60 }],
        want: { powerPlayToi: null, powerPlayToiShare: null, powerPlayShareStatus: { availability: "unavailable",
          reason: "The clock differs from the official team PP total by +28 s." } } },
      { name: "no clock row", clocks: [], ppRows: [{ gameId: 1, PPTOI: 60 }],
        want: { powerPlayToi: null, powerPlayToiShare: null, powerPlayShareStatus: { availability: "unavailable", reason: PP_CLOCK_MISSING_REASON } } },
      { name: "player PP time above the clock (withheld, never capped)", clocks: [clockRow({})], ppRows: [{ gameId: 1, PPTOI: 121 }],
        want: { powerPlayToi: null, powerPlayToiShare: null, powerPlayShareStatus: { availability: "unavailable", reason: PP_PLAYER_ABOVE_CLOCK_REASON } } },
      { name: "another team's clock is never used", clocks: [clockRow({ teamId: 99 })], ppRows: [{ gameId: 1, PPTOI: 60 }],
        want: { powerPlayToi: null, powerPlayToiShare: null, powerPlayShareStatus: { availability: "unavailable", reason: PP_CLOCK_MISSING_REASON } } },
    ])("$name", ({ clocks, ppRows, want }) => {
      expect(point(clocks, ppRows)).toMatchObject(want);
    });

    it("an unknown team for the game (no FORGE row) stays unavailable", () => {
      expect(point([clockRow({})], [{ gameId: 1, PPTOI: 60 }], [])).toMatchObject({
        powerPlayToi: null, powerPlayToiShare: null,
        powerPlayShareStatus: { availability: "unavailable", reason: PP_CLOCK_MISSING_REASON },
      });
    });
  });
});
