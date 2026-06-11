import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  fetchTOIRawDataMock,
  getTOIDataMock,
  fetchNhlApiRawGamePayloadsMock
} = vi.hoisted(() => ({
  fetchTOIRawDataMock: vi.fn(),
  getTOIDataMock: vi.fn(),
  fetchNhlApiRawGamePayloadsMock: vi.fn()
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
      .filter((row) => row.p1.id === row.p2.id)
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

vi.mock("utils/getPowerPlayBlocks", () => ({
  default: () => [
    {
      teamId: 1,
      start: { period: 1, timeInPeriod: "00:00" },
      end: { period: 1, timeInPeriod: "02:00" }
    }
  ]
}));

vi.mock("lib/supabase/Upserts/nhlRawGamecenter.mjs", () => ({
  fetchNhlApiRawGamePayloads: fetchNhlApiRawGamePayloadsMock
}));

import { updatePowerPlayCombinations } from "../../../../../pages/api/v1/db/update-power-play-combinations/[gameId]";

function createSupabaseMock() {
  const throwOnError = vi.fn().mockResolvedValue({ data: null });
  const upsert = vi.fn(() => ({ throwOnError }));
  return {
    supabase: {
      from: vi.fn(() => ({ upsert }))
    },
    upsert,
    throwOnError
  };
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
        1: players.map((entry) => ({ toi: 60, p1: entry, p2: entry }))
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
});
