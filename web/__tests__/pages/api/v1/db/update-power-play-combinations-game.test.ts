import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  fetchTOIRawDataMock,
  getTOIDataMock,
  fetchNhlApiRawGamePayloadsMock,
  getPowerPlayBlocksMock
} = vi.hoisted(() => ({
  fetchTOIRawDataMock: vi.fn(),
  getTOIDataMock: vi.fn(),
  fetchNhlApiRawGamePayloadsMock: vi.fn(),
  getPowerPlayBlocksMock: vi.fn()
}));

vi.mock("utils/adminOnlyMiddleware", () => ({
  default: (handler: any) => handler
}));

vi.mock("lib/cron/withCronJobAudit", () => ({
  withCronJobAudit: (handler: any) => handler
}));

vi.mock("components/LinemateMatrix", () => ({
  fetchTOIRawData: fetchTOIRawDataMock,
  getKey: (p1: number, p2: number) => `${p1}-${p2}`,
  getTOIData: getTOIDataMock,
  sortByPPTOI: (table: Record<string, { toi: number; p1: any; p2: any }>) =>
    Object.values(table)
      .filter((row) => row.p1.id === row.p2.id && row.toi > 0)
      .sort((a, b) => b.toi - a.toi)
      .map((row) => row.p1)
}));

vi.mock("components/LinemateMatrix/utilities", () => ({
  getAvg: (
    players: Array<{ id: number }>,
    table: Record<string, { toi: number }>
  ) =>
    players.reduce((sum, player) => sum + table[`${player.id}-${player.id}`].toi, 0) /
    players.length
}));

vi.mock("utils/getPowerPlayBlocks", async (importOriginal) => ({
  ...(await importOriginal<typeof import("utils/getPowerPlayBlocks")>()),
  default: getPowerPlayBlocksMock
}));

vi.mock("lib/supabase/Upserts/nhlRawGamecenter.mjs", () => ({
  fetchNhlApiRawGamePayloads: fetchNhlApiRawGamePayloadsMock
}));

import { updatePowerPlayCombinations } from "../../../../../pages/api/v1/db/update-power-play-combinations/[gameId]";

function createSupabaseMock() {
  const throwOnError = vi.fn().mockResolvedValue({ data: null });
  const upsert = vi.fn(() => ({ throwOnError }));
  const inPlayers = vi.fn(() => ({ throwOnError }));
  const eq = vi.fn(() => ({ in: inPlayers }));
  const del = vi.fn(() => ({ eq }));
  return {
    supabase: {
      from: vi.fn(() => ({ upsert, delete: del }))
    },
    upsert,
    del,
    eq,
    inPlayers,
    throwOnError
  };
}

function shift(playerId: number, teamId = 1) {
  return { id: playerId, playerId, teamId, duration: "00:45" };
}

function player(id: number) {
  return {
    id,
    teamId: 1,
    position: "C",
    sweaterNumber: id,
    name: `Player ${id}`
  };
}

describe("updatePowerPlayCombinations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getPowerPlayBlocksMock.mockReturnValue([
      {
        teamId: 1,
        start: { period: 1, timeInPeriod: "00:00" },
        end: { period: 1, timeInPeriod: "02:00" }
      }
    ]);
  });

  it("uses NHL HTML shift-report fallback when JSON shiftcharts are empty", async () => {
    const rawData = [
      { data: [] },
      { rostersMap: {}, teams: [{ id: 1, name: "Home" }] },
      { plays: [] }
    ] as const;
    const htmlShiftRows = [{ id: 1, playerId: 10, teamId: 1 }];
    const players = [10, 11, 12, 13, 14].map(player);
    const toiRows = players.map((entry, index) => ({
      toi: 120 - index * 5,
      p1: entry,
      p2: entry
    }));
    const supabaseMock = createSupabaseMock();

    fetchTOIRawDataMock.mockResolvedValue(rawData);
    fetchNhlApiRawGamePayloadsMock.mockResolvedValue({
      payloads: {
        shiftcharts: {
          data: htmlShiftRows,
          source: "htmlreports"
        }
      }
    });
    getTOIDataMock.mockReturnValue({
      toi: { 1: toiRows },
      teams: [{ id: 1, name: "Home" }]
    });

    const summary = await updatePowerPlayCombinations(
      2025021301,
      supabaseMock.supabase as any
    );

    expect(fetchNhlApiRawGamePayloadsMock).toHaveBeenCalledWith(2025021301);
    expect(getTOIDataMock.mock.calls[0]?.[0][0].data).toEqual(htmlShiftRows);
    expect(supabaseMock.upsert).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          gameId: 2025021301,
          playerId: 10,
          unit: 1,
          PPTOI: 120,
          pp_share_of_team: 1
        })
      ])
    );
    expect(summary).toMatchObject({
      gameId: 2025021301,
      rowCount: 5,
      teamCount: 1,
      shiftSource: "htmlreports"
    });
  });

  it("does not fetch fallback payloads when JSON shiftcharts are present", async () => {
    const rawData = [
      { data: [{ id: 1, playerId: 10, teamId: 1 }] },
      { rostersMap: {}, teams: [{ id: 1, name: "Home" }] },
      { plays: [] }
    ] as const;
    const players = [10, 11, 12, 13, 14].map(player);
    const supabaseMock = createSupabaseMock();

    fetchTOIRawDataMock.mockResolvedValue(rawData);
    getTOIDataMock.mockReturnValue({
      toi: {
        1: players.map((entry) => ({ toi: 120, p1: entry, p2: entry }))
      },
      teams: [{ id: 1, name: "Home" }]
    });

    const summary = await updatePowerPlayCombinations(
      2025021300,
      supabaseMock.supabase as any
    );

    expect(fetchNhlApiRawGamePayloadsMock).not.toHaveBeenCalled();
    expect(summary.shiftSource).toBe("json-api");
  });

  it("deletes the row of a player whose shifts prove zero power-play time", async () => {
    const players = [10, 11, 12, 13, 14].map(player);
    const supabaseMock = createSupabaseMock();
    fetchTOIRawDataMock.mockResolvedValue([
      { data: [10, 11, 12, 13, 14, 15].map((id) => shift(id)) },
      { rostersMap: {}, teams: [{ id: 1, name: "Home" }] },
      { plays: [] }
    ]);
    getTOIDataMock.mockReturnValue({
      toi: {
        1: [
          ...players.map((entry) => ({ toi: 120, p1: entry, p2: entry })),
          { toi: 0, p1: player(15), p2: player(15) }
        ]
      },
      teams: [{ id: 1, name: "Home" }]
    });

    await updatePowerPlayCombinations(2025021302, supabaseMock.supabase as any);

    expect(supabaseMock.eq).toHaveBeenCalledWith("gameId", 2025021302);
    expect(supabaseMock.inPlayers).toHaveBeenCalledWith("playerId", [15]);
  });

  it.each([3, 4])(
    "keeps the stored rows of players a partial feed omits, with %i skaters on one team",
    async (skaters) => {
      const home = [10, 11, 12, 13, 14];
      const away = [20, 21, 22, 23, 24].slice(0, skaters);
      const supabaseMock = createSupabaseMock();
      getPowerPlayBlocksMock.mockReturnValue([
        {
          teamId: 1,
          start: { period: 1, timeInPeriod: "00:00" },
          end: { period: 1, timeInPeriod: "02:00" }
        },
        {
          teamId: 2,
          start: { period: 1, timeInPeriod: "05:00" },
          end: { period: 1, timeInPeriod: "07:00" }
        }
      ]);
      fetchTOIRawDataMock.mockResolvedValue([
        { data: [...home.map((id) => shift(id)), ...away.map((id) => shift(id, 2))] },
        { rostersMap: {}, teams: [] },
        { plays: [] }
      ]);
      const toiRows = (ids: number[]) =>
        ids.map(player).map((entry) => ({ toi: 120, p1: entry, p2: entry }));
      getTOIDataMock.mockReturnValue({
        toi: { 1: toiRows(home), 2: toiRows(away) },
        teams: [
          { id: 1, name: "Home" },
          { id: 2, name: "Away" }
        ]
      });

      const summary = await updatePowerPlayCombinations(
        2025021308,
        supabaseMock.supabase as any
      );

      expect(summary.rowCount).toBe(5 + skaters);
      expect(supabaseMock.del).not.toHaveBeenCalled();
    }
  );

  it("writes nothing and removes rows shifts disprove when neither team had a power play", async () => {
    const supabaseMock = createSupabaseMock();
    getPowerPlayBlocksMock.mockReturnValue([]);
    fetchTOIRawDataMock.mockResolvedValue([
      { data: [shift(10)] },
      { rostersMap: {}, teams: [{ id: 1, name: "Home" }] },
      { plays: [] }
    ]);
    getTOIDataMock.mockReturnValue({
      toi: { 1: [] },
      teams: [{ id: 1, name: "Home" }]
    });

    const summary = await updatePowerPlayCombinations(
      2025021303,
      supabaseMock.supabase as any
    );

    expect(summary.rowCount).toBe(0);
    expect(supabaseMock.upsert).not.toHaveBeenCalled();
    expect(supabaseMock.eq).toHaveBeenCalledWith("gameId", 2025021303);
    expect(supabaseMock.inPlayers).toHaveBeenCalledWith("playerId", [10]);
  });

  it("does not treat a shift row with no duration as proof", async () => {
    const supabaseMock = createSupabaseMock();
    getPowerPlayBlocksMock.mockReturnValue([]);
    fetchTOIRawDataMock.mockResolvedValue([
      { data: [{ id: 1, playerId: 10, teamId: 1, duration: null }] },
      { rostersMap: {}, teams: [{ id: 1, name: "Home" }] },
      { plays: [] }
    ]);
    getTOIDataMock.mockReturnValue({
      toi: { 1: [] },
      teams: [{ id: 1, name: "Home" }]
    });

    await updatePowerPlayCombinations(2025021309, supabaseMock.supabase as any);

    expect(supabaseMock.del).not.toHaveBeenCalled();
  });

  it("writes the team that had a power play when the other had none", async () => {
    const players = [10, 11, 12, 13, 14].map(player);
    const supabaseMock = createSupabaseMock();
    fetchTOIRawDataMock.mockResolvedValue([
      { data: [10, 11, 12, 13, 14].map((id) => shift(id)).concat(shift(20, 2)) },
      { rostersMap: {}, teams: [] },
      { plays: [] }
    ]);
    getTOIDataMock.mockReturnValue({
      toi: {
        1: players.map((entry) => ({ toi: 120, p1: entry, p2: entry })),
        2: []
      },
      teams: [
        { id: 1, name: "Home" },
        { id: 2, name: "Away" }
      ]
    });

    const summary = await updatePowerPlayCombinations(
      2025021305,
      supabaseMock.supabase as any
    );

    expect(summary.rowCount).toBe(5);
    expect(supabaseMock.inPlayers).toHaveBeenCalledWith("playerId", [20]);
  });

  it("refuses the game when a team with PP time has no shifts, and keeps stored rows", async () => {
    const players = [10, 11, 12, 13, 14].map(player);
    const supabaseMock = createSupabaseMock();
    getPowerPlayBlocksMock.mockReturnValue([
      {
        teamId: 1,
        start: { period: 1, timeInPeriod: "00:00" },
        end: { period: 1, timeInPeriod: "02:00" }
      },
      {
        teamId: 2,
        start: { period: 1, timeInPeriod: "05:00" },
        end: { period: 1, timeInPeriod: "07:00" }
      }
    ]);
    fetchTOIRawDataMock.mockResolvedValue([
      { data: [{ id: 1, playerId: 10, teamId: 1 }] },
      { rostersMap: {}, teams: [] },
      { plays: [] }
    ]);
    getTOIDataMock.mockReturnValue({
      toi: {
        1: players.map((entry) => ({ toi: 120, p1: entry, p2: entry })),
        2: []
      },
      teams: [
        { id: 1, name: "Home" },
        { id: 2, name: "Away" }
      ]
    });

    await expect(
      updatePowerPlayCombinations(2025021306, supabaseMock.supabase as any)
    ).rejects.toThrow("Incomplete shift data for game 2025021306: team(s) 2");
    expect(supabaseMock.upsert).not.toHaveBeenCalled();
    expect(supabaseMock.del).not.toHaveBeenCalled();
  });

  it("refuses the game when a team's shifts cover only part of its PP time", async () => {
    const supabaseMock = createSupabaseMock();
    fetchTOIRawDataMock.mockResolvedValue([
      { data: [{ id: 1, playerId: 10, teamId: 1 }] },
      { rostersMap: {}, teams: [] },
      { plays: [] }
    ]);
    getTOIDataMock.mockReturnValue({
      toi: { 1: [{ toi: 120, p1: player(10), p2: player(10) }] },
      teams: [{ id: 1, name: "Home" }]
    });

    await expect(
      updatePowerPlayCombinations(2025021307, supabaseMock.supabase as any)
    ).rejects.toThrow("Incomplete shift data");
    expect(supabaseMock.upsert).not.toHaveBeenCalled();
    expect(supabaseMock.del).not.toHaveBeenCalled();
  });

  it("keeps stored rows when power plays have no shifts behind them", async () => {
    const supabaseMock = createSupabaseMock();
    fetchTOIRawDataMock.mockResolvedValue([
      { data: [] },
      { rostersMap: {}, teams: [{ id: 1, name: "Home" }] },
      { plays: [] }
    ]);
    fetchNhlApiRawGamePayloadsMock.mockResolvedValue({ payloads: {} });
    getTOIDataMock.mockReturnValue({
      toi: { 1: [] },
      teams: [{ id: 1, name: "Home" }]
    });

    await expect(
      updatePowerPlayCombinations(2025021304, supabaseMock.supabase as any)
    ).rejects.toThrow("No power play combinations found");
    expect(supabaseMock.del).not.toHaveBeenCalled();
  });
});

describe("getPowerPlayBlocks", () => {
  const HOME = 1;
  const AWAY = 2;

  type Blocks = Array<{
    teamId: number;
    start: { period: number; timeInPeriod: string };
    end: { period: number; timeInPeriod: string };
  }>;

  function play(typeDescKey: string, period: number, timeInPeriod: string, details: object = {}) {
    return {
      typeDescKey,
      timeInPeriod,
      periodDescriptor: { number: period, periodType: period > 3 ? "OT" : "REG" },
      details
    };
  }
  const penalty = (
    teamId: number,
    period: number,
    time: string,
    committedByPlayerId: number,
    typeCode = "MIN",
    duration = 2
  ) =>
    play("penalty", period, time, {
      eventOwnerTeamId: teamId,
      typeCode,
      duration,
      committedByPlayerId
    });
  const goal = (teamId: number, period: number, time: string) =>
    play("goal", period, time, { eventOwnerTeamId: teamId });
  const gameEnd = (period = 3, time = "20:00") => play("game-end", period, time);
  const faceoffs = [
    play("faceoff", 1, "00:00", { eventOwnerTeamId: HOME }),
    play("faceoff", 1, "00:00", { eventOwnerTeamId: AWAY })
  ];

  async function blocksFor(plays: unknown[]): Promise<Blocks> {
    const { default: getBlocks } = await vi.importActual<
      typeof import("../../../../../utils/getPowerPlayBlocks")
    >("utils/getPowerPlayBlocks");
    return getBlocks([...faceoffs, ...plays, gameEnd()]) as unknown as Blocks;
  }
  const spans = (blocks: Blocks) =>
    blocks.map(
      (block) =>
        `${block.teamId} P${block.start.period} ${block.start.timeInPeriod} - P${block.end.period} ${block.end.timeInPeriod}`
    );

  it("runs an uninterrupted minor for its full two minutes", async () => {
    expect(spans(await blocksFor([penalty(AWAY, 1, "05:00", 20)]))).toEqual([
      "1 P1 05:00 - P1 07:00"
    ]);
  });

  it("ends a minor early on a power-play goal", async () => {
    const blocks = await blocksFor([
      penalty(AWAY, 1, "05:00", 20),
      goal(HOME, 1, "05:40")
    ]);
    expect(spans(blocks)).toEqual(["1 P1 05:00 - P1 05:40"]);
  });

  it("does not end a minor on a shorthanded goal", async () => {
    const blocks = await blocksFor([
      penalty(AWAY, 1, "05:00", 20),
      goal(AWAY, 1, "05:40")
    ]);
    expect(spans(blocks)).toEqual(["1 P1 05:00 - P1 07:00"]);
  });

  it("cuts the power play off when the game ends", async () => {
    expect(spans(await blocksFor([penalty(AWAY, 3, "19:00", 20)]))).toEqual([
      "1 P3 19:00 - P4 00:00"
    ]);
  });

  it("does not end a major on a goal", async () => {
    const blocks = await blocksFor([
      penalty(AWAY, 1, "05:00", 20, "MAJ", 5),
      goal(HOME, 1, "05:40")
    ]);
    expect(spans(blocks)).toEqual(["1 P1 05:00 - P1 10:00"]);
  });

  it("takes two minutes off a double minor per goal", async () => {
    const blocks = await blocksFor([
      penalty(AWAY, 1, "05:00", 20, "MIN", 4),
      goal(HOME, 1, "05:30"),
      goal(HOME, 1, "06:00")
    ]);
    expect(spans(blocks)).toEqual(["1 P1 05:00 - P1 06:00"]);
  });

  it("gives no power play for misconducts or game misconducts", async () => {
    const blocks = await blocksFor([
      penalty(AWAY, 1, "05:00", 20, "MIS", 10),
      penalty(AWAY, 1, "09:00", 21, "GAM", 10)
    ]);
    expect(blocks).toEqual([]);
  });

  it("does not net a bench minor against a misconduct at the same stoppage", async () => {
    const blocks = await blocksFor([
      penalty(HOME, 2, "11:38", 10, "BEN", 2),
      penalty(AWAY, 2, "11:38", 20, "MIS", 10)
    ]);
    expect(spans(blocks)).toEqual(["2 P2 11:38 - P2 13:38"]);
  });

  it("counts a 5-on-3 once and a goal only ends one of its penalties", async () => {
    const blocks = await blocksFor([
      penalty(AWAY, 1, "05:00", 20),
      penalty(AWAY, 1, "06:00", 21),
      goal(HOME, 1, "06:30")
    ]);
    // The goal ends the first penalty, and the second still runs to 08:00.
    expect(spans(blocks)).toEqual(["1 P1 05:00 - P1 08:00"]);
  });

  it("runs two players' penalties from one stoppage together", async () => {
    const blocks = await blocksFor([
      penalty(AWAY, 3, "03:46", 20),
      penalty(AWAY, 3, "03:46", 21)
    ]);
    expect(spans(blocks)).toEqual(["1 P3 03:46 - P3 05:46"]);
  });

  it("runs one player's two penalties from one stoppage in sequence", async () => {
    const blocks = await blocksFor([
      penalty(AWAY, 1, "05:00", 20),
      penalty(AWAY, 1, "05:00", 20)
    ]);
    expect(spans(blocks)).toEqual(["1 P1 05:00 - P1 09:00"]);
  });

  it("holds a third penalty until one of the first two has expired", async () => {
    const blocks = await blocksFor([
      penalty(AWAY, 1, "05:00", 20),
      penalty(AWAY, 1, "05:30", 21),
      penalty(AWAY, 1, "06:00", 22)
    ]);
    expect(spans(blocks)).toEqual(["1 P1 05:00 - P1 09:00"]);
  });

  it("gives neither team a power play during 4-on-4 from overlapping penalties", async () => {
    const blocks = await blocksFor([
      penalty(AWAY, 1, "05:00", 20),
      penalty(HOME, 1, "06:00", 10)
    ]);
    expect(spans(blocks)).toEqual([
      "1 P1 05:00 - P1 06:00",
      "2 P1 07:00 - P1 08:00"
    ]);
  });

  it("cancels coinciding minors, including when one team also takes a misconduct", async () => {
    const blocks = await blocksFor([
      penalty(HOME, 2, "18:34", 10),
      penalty(HOME, 2, "18:34", 11),
      penalty(AWAY, 2, "18:34", 20),
      penalty(AWAY, 2, "18:34", 21),
      penalty(HOME, 2, "18:34", 12, "MIS", 10)
    ]);
    expect(blocks).toEqual([]);
  });

  it("leaves the difference when coinciding penalties do not match", async () => {
    const blocks = await blocksFor([
      penalty(HOME, 1, "05:00", 10),
      penalty(AWAY, 1, "05:00", 20, "MIN", 4)
    ]);
    expect(spans(blocks)).toEqual(["1 P1 05:00 - P1 07:00"]);
  });

  it("carries a power play over the intermission", async () => {
    expect(spans(await blocksFor([penalty(AWAY, 1, "19:00", 20)]))).toEqual([
      "1 P1 19:00 - P2 01:00"
    ]);
  });

  it("returns nothing for a game with no penalties, so neither team has a power play", async () => {
    expect(await blocksFor([goal(HOME, 1, "05:00")])).toEqual([]);
  });

  it("ignores the shootout", async () => {
    const { default: getBlocks } = await vi.importActual<
      typeof import("../../../../../utils/getPowerPlayBlocks")
    >("utils/getPowerPlayBlocks");
    const blocks = getBlocks([
      ...faceoffs,
      penalty(AWAY, 4, "04:00", 20),
      play("period-end", 4, "05:00"),
      { ...goal(HOME, 5, "00:00"), periodDescriptor: { number: 5, periodType: "SO" } }
    ]);
    expect(spans(blocks as unknown as Blocks)).toEqual(["1 P4 04:00 - P4 05:00"]);
  });

  it("reads on-ice power-play time in a playoff period past the fourth", async () => {
    const { getPairwiseTOI } = await vi.importActual<
      typeof import("../../../../../components/LinemateMatrix/utilities")
    >("components/LinemateMatrix/utilities");
    const shift = {
      id: 1,
      gameId: 1,
      playerId: 10,
      period: 5,
      firstName: "",
      lastName: "",
      teamId: HOME,
      teamName: "",
      duration: "01:00",
      startTime: "00:30",
      endTime: "01:30"
    };
    const blocks = [
      {
        teamId: HOME,
        start: { period: 5, type: "OT", timeInPeriod: "01:00" },
        end: { period: 5, type: "OT", timeInPeriod: "03:00" }
      }
    ] as any;
    expect(getPairwiseTOI([shift], 10, 10, blocks)).toBe(30);
  });

  it("measures a player's time on a 5-on-3 once", async () => {
    const { getPairwiseTOI } = await vi.importActual<
      typeof import("../../../../../components/LinemateMatrix/utilities")
    >("components/LinemateMatrix/utilities");
    const blocks = await blocksFor([
      penalty(AWAY, 1, "05:00", 20),
      penalty(AWAY, 1, "06:00", 21)
    ]);
    const shift = {
      id: 1,
      gameId: 1,
      playerId: 10,
      period: 1,
      firstName: "",
      lastName: "",
      teamId: HOME,
      teamName: "",
      duration: "03:00",
      startTime: "05:00",
      endTime: "08:00"
    };
    expect(getPairwiseTOI([shift], 10, 10, blocks as any)).toBe(180);
  });
});
