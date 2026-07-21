import {
  act,
  cleanup,
  render,
  renderHook,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { teamsInfo } from "lib/teamsInfo";
import type { AggregatedMatrixSeasonData } from "./fetchAggregatedData";
import type { Mode } from "./index";
import type { PlayerData } from "./utilities";
import {
  mapAggregatedPlayers,
  useDateRangeMatrixData,
  type AggregatedDRMPlayer,
  type DRMSeasonType,
} from "./useDateRangeMatrixData";

const getTOIDataForGamesMock = vi.hoisted(() => vi.fn());

vi.mock("./useTOIData", () => ({
  getTOIDataForGames: getTOIDataForGamesMock,
}));

beforeEach(() => {
  getTOIDataForGamesMock.mockReset();
});

afterEach(() => {
  cleanup();
});

function aggregatedSeasonData(
  overrides: Partial<AggregatedMatrixSeasonData> = {},
): AggregatedMatrixSeasonData {
  return {
    totalTOI: 0,
    gameLength: 0,
    gamesPlayed: new Set<number>(),
    ATOI: "00:00",
    gameIds: [],
    homeOrAway: [],
    opponent: [],
    opponentId: [],
    timeSpentWith: {},
    timeSpentWithMixed: {},
    timesPlayedWith: {},
    mutualSharedToi: {},
    percentToiWith: {},
    percentToiWithMixed: {},
    percentOfSeason: {},
    timesOnLine: {},
    timesOnPair: {},
    GP: 0,
    ...overrides,
  };
}

const aggregatedPlayer: AggregatedDRMPlayer = {
  playerId: 97,
  teamId: teamsInfo.EDM.id,
  teamAbbrev: "EDM",
  franchiseId: teamsInfo.EDM.franchiseId,
  playerName: "Connor McDavid",
  playerAbbrevName: "C. McDavid",
  lastName: "McDavid",
  primaryPosition: "C",
  displayPosition: "C",
  sweaterNumber: 97,
  seasonId: 20252026,
  playerType: "F",
  comboPoints: 0,
  regularSeasonData: aggregatedSeasonData({
    totalTOI: 1200,
    gameLength: 7200,
    gamesPlayed: new Set([2025020001, 2025020002]),
    GP: 2,
    ATOI: "10:00",
    gameIds: [2025020001, 2025020002],
    homeOrAway: ["home", "away"],
    opponent: ["CGY", "VAN"],
    opponentId: [20, 23],
    timesOnLine: { 1: 2 },
    timesOnPair: {},
    percentToiWith: { 29: 71.5 },
    percentToiWithMixed: { 2: 73 },
    timeSpentWith: { 29: 858 },
    timeSpentWithMixed: { 2: 876 },
    timesPlayedWith: { 2: 2, 29: 2 },
    mutualSharedToi: { 2: 876, 29: 858 },
    percentOfSeason: { 29: 35.75 },
  }),
  playoffData: aggregatedSeasonData({
    totalTOI: 630,
    gameLength: 3600,
    gamesPlayed: new Set([2025030001]),
    GP: 1,
    ATOI: "10:30",
    gameIds: [2025030001],
    homeOrAway: ["home"],
    opponent: ["LAK"],
    opponentId: [26],
    timesOnLine: { 2: 1 },
    timesOnPair: {},
    percentToiWith: { 29: 48.25 },
    percentToiWithMixed: { 2: 50 },
    timeSpentWith: { 29: 304 },
    timeSpentWithMixed: { 2: 315 },
    timesPlayedWith: { 2: 1, 29: 1 },
    mutualSharedToi: { 2: 315, 29: 304 },
    percentOfSeason: { 29: 24.125 },
  }),
};
const aggregatedPlayers = [aggregatedPlayer];

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

function rawPlayer(id: number): PlayerData {
  return {
    id,
    teamId: teamsInfo.EDM.id,
    franchiseId: teamsInfo.EDM.franchiseId,
    position: "C",
    name: `Player ${id}`,
    playerAbbrevName: `P. ${id}`,
    lastName: String(id),
    totalTOI: 600,
    timesOnLine: {},
    timesOnPair: {},
    percentToiWith: {},
    percentToiWithMixed: {},
    timeSpentWith: {},
    timeSpentWithMixed: {},
    GP: 1,
    timesPlayedWith: {},
    ATOI: "10:00",
    percentOfSeason: {},
    displayPosition: "C",
    comboPoints: 0,
  };
}

function rawResult(id: number) {
  const player = rawPlayer(id);
  return {
    toiData: [],
    roster: [player],
    team: { id: teamsInfo.EDM.id, name: "EDM" },
    homeAwayInfo: [],
    playerATOI: { [id]: player.ATOI },
    coverage: { inputRows: 1, rosterRows: 1, skippedRows: 0 },
  };
}

function groupingPlayer(id: number, playerType: "F" | "D" | "G"): PlayerData {
  const position =
    playerType === "F"
      ? id % 3 === 0
        ? "RW"
        : id % 3 === 1
          ? "LW"
          : "C"
      : playerType;
  return {
    ...rawPlayer(id),
    position,
    displayPosition: position,
    playerType,
    timesOnLine: playerType === "F" ? { "1": 1_000 - id } : {},
    timesOnPair: playerType === "D" ? { "1": 1_000 - id } : {},
  };
}

function rawGroupingResult() {
  const roster = [
    ...Array.from({ length: 15 }, (_, index) => groupingPlayer(index + 1, "F")),
    ...Array.from({ length: 8 }, (_, index) =>
      groupingPlayer(101 + index, "D"),
    ),
    groupingPlayer(201, "G"),
  ];
  return {
    toiData: [],
    roster,
    team: { id: teamsInfo.EDM.id, name: teamsInfo.EDM.name },
    homeAwayInfo: [],
    playerATOI: Object.fromEntries(
      roster.map((player) => [player.id, player.ATOI]),
    ),
    coverage: {
      inputRows: roster.length,
      rosterRows: roster.length,
      skippedRows: 0,
    },
  };
}

describe("mapAggregatedPlayers", () => {
  it("projects the typed regular-season bucket without coercion", () => {
    const [player] = mapAggregatedPlayers(
      aggregatedPlayers,
      "regularSeason",
      " edm ",
    );

    expect(player).toMatchObject({
      id: 97,
      teamId: teamsInfo.EDM.id,
      franchiseId: teamsInfo.EDM.franchiseId,
      totalTOI: 1200,
      GP: 2,
      ATOI: "10:00",
      sweaterNumber: 97,
      timesOnLine: { 1: 2 },
      percentToiWith: { 29: 71.5 },
      timeSpentWith: { 29: 858 },
      timesPlayedWith: { 29: 2 },
      mutualSharedToi: { 29: 858 },
    });
  });

  it("selects the playoff bucket instead of reusing regular-season values", () => {
    const [player] = mapAggregatedPlayers(aggregatedPlayers, "playoffs", "EDM");

    expect(player).toMatchObject({
      totalTOI: 630,
      GP: 1,
      ATOI: "10:30",
      timesOnLine: { 2: 1 },
      percentToiWith: { 29: 48.25 },
      timeSpentWith: { 29: 304 },
      percentOfSeason: { 29: 24.125 },
    });
  });

  it("fails closed instead of skipping an invalid player identity", () => {
    const invalidPlayer = {
      ...aggregatedPlayer,
      playerId: null,
    } as unknown as AggregatedDRMPlayer;

    expect(() =>
      mapAggregatedPlayers([invalidPlayer], "regularSeason", "EDM"),
    ).toThrow("invalid player identity");
  });

  it("fails closed on canonical team identity drift", () => {
    const mismatchedPlayer = {
      ...aggregatedPlayer,
      teamId: teamsInfo.CGY.id,
    };

    expect(() =>
      mapAggregatedPlayers([mismatchedPlayer], "regularSeason", "EDM"),
    ).toThrow("canonical team identity");
  });

  it("fails closed on duplicate player identities", () => {
    expect(() =>
      mapAggregatedPlayers(
        [aggregatedPlayer, { ...aggregatedPlayer }],
        "regularSeason",
        "EDM",
      ),
    ).toThrow("duplicate player identity");
  });
});

describe("useDateRangeMatrixData aggregated season selection", () => {
  it("updates the roster when the selected season type changes", async () => {
    const { result, rerender } = renderHook(
      ({ seasonType }: { seasonType: DRMSeasonType }) =>
        useDateRangeMatrixData({
          teamAbbreviation: "EDM",
          startDate: "2025-04-01",
          endDate: "2025-05-01",
          mode: "total-toi",
          source: "aggregated",
          seasonType,
          aggregatedData: aggregatedPlayers,
        }),
      { initialProps: { seasonType: "playoffs" as DRMSeasonType } },
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
      expect(result.current.roster[0]?.totalTOI).toBe(630);
    });

    rerender({ seasonType: "regularSeason" });

    await waitFor(() => {
      expect(result.current.roster[0]?.totalTOI).toBe(1200);
      expect(result.current.roster[0]?.GP).toBe(2);
    });
  });
});

describe("useDateRangeMatrixData line and pair ownership", () => {
  it("publishes canonical groups for all modes without refetching the roster", async () => {
    getTOIDataForGamesMock.mockResolvedValueOnce(rawGroupingResult());

    const { result, rerender } = renderHook(
      ({ mode }: { mode: Mode }) =>
        useDateRangeMatrixData({
          teamAbbreviation: "EDM",
          startDate: "2025-04-01",
          endDate: "2025-05-01",
          mode,
          source: "raw",
        }),
      { initialProps: { mode: "total-toi" as Mode } },
    );

    await waitFor(() => expect(result.current.status).toBe("success"));
    expect(result.current.lines).toHaveLength(4);
    expect(result.current.pairs).toHaveLength(3);

    rerender({ mode: "line-combination" });
    expect(result.current.lines).toHaveLength(4);
    expect(result.current.pairs).toHaveLength(3);

    rerender({ mode: "full-roster" });
    expect(result.current.lines).toHaveLength(5);
    expect(result.current.pairs).toHaveLength(4);
    expect(getTOIDataForGamesMock).toHaveBeenCalledTimes(1);
  });
});

describe("useDateRangeMatrixData request state", () => {
  it("keeps the newest raw request when an older request resolves last", async () => {
    const first = deferred<ReturnType<typeof rawResult>>();
    const second = deferred<ReturnType<typeof rawResult>>();
    getTOIDataForGamesMock
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise);

    const { result, rerender } = renderHook(
      ({ startDate }) =>
        useDateRangeMatrixData({
          teamAbbreviation: "EDM",
          startDate,
          endDate: "2025-05-01",
          mode: "total-toi",
          source: "raw",
        }),
      { initialProps: { startDate: "2025-04-01" } },
    );

    await waitFor(() => expect(result.current.status).toBe("loading"));
    rerender({ startDate: "2025-04-02" });

    await act(async () => {
      second.resolve(rawResult(2));
      await second.promise;
    });
    await waitFor(() => expect(result.current.roster[0]?.id).toBe(2));

    await act(async () => {
      first.resolve(rawResult(1));
      await first.promise;
    });
    expect(result.current.roster[0]?.id).toBe(2);
    expect(result.current.status).toBe("success");
  });

  it("masks prior data during the render that changes request identity", async () => {
    const pending = deferred<ReturnType<typeof rawResult>>();
    getTOIDataForGamesMock
      .mockResolvedValueOnce(rawResult(1))
      .mockReturnValueOnce(pending.promise);
    const snapshots: Array<{
      startDate: string;
      loading: boolean;
      status: string;
      stale: boolean;
      rosterIds: number[];
    }> = [];

    function Probe({ startDate }: { startDate: string }) {
      const current = useDateRangeMatrixData({
        teamAbbreviation: "EDM",
        startDate,
        endDate: "2025-05-01",
        mode: "total-toi",
        source: "raw",
      });
      snapshots.push({
        startDate,
        loading: current.loading,
        status: current.status,
        stale: current.stale,
        rosterIds: current.roster.map((player) => player.id),
      });
      return null;
    }

    const rendered = render(<Probe startDate="2025-04-01" />);
    await waitFor(() => {
      expect(
        snapshots.some(
          (snapshot) =>
            snapshot.status === "success" && snapshot.rosterIds[0] === 1,
        ),
      ).toBe(true);
    });

    snapshots.length = 0;
    rendered.rerender(<Probe startDate="2025-04-02" />);
    expect(snapshots[0]).toEqual({
      startDate: "2025-04-02",
      loading: true,
      status: "loading",
      stale: true,
      rosterIds: [],
    });

    await act(async () => {
      pending.resolve(rawResult(2));
      await pending.promise;
    });
    await waitFor(() => {
      expect(
        snapshots.some(
          (snapshot) =>
            snapshot.status === "success" && snapshot.rosterIds[0] === 2,
        ),
      ).toBe(true);
    });
  });

  it("clears loading and data when required input becomes invalid", async () => {
    const pending = deferred<ReturnType<typeof rawResult>>();
    getTOIDataForGamesMock.mockReturnValueOnce(pending.promise);

    const { result, rerender } = renderHook(
      ({ teamAbbreviation }: { teamAbbreviation: string | undefined }) =>
        useDateRangeMatrixData({
          teamAbbreviation,
          startDate: "2025-04-01",
          endDate: "2025-05-01",
          mode: "total-toi",
          source: "raw",
        }),
      { initialProps: { teamAbbreviation: "EDM" as string | undefined } },
    );

    await waitFor(() => expect(result.current.loading).toBe(true));
    rerender({ teamAbbreviation: undefined });
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
      expect(result.current.status).toBe("idle");
      expect(result.current.roster).toEqual([]);
    });

    await act(async () => {
      pending.resolve(rawResult(1));
      await pending.promise;
    });
    expect(result.current.status).toBe("idle");
    expect(result.current.roster).toEqual([]);
  });

  it("returns an explicit error state for a rejected raw request", async () => {
    getTOIDataForGamesMock.mockRejectedValueOnce(
      new Error("raw request failed"),
    );

    const { result } = renderHook(() =>
      useDateRangeMatrixData({
        teamAbbreviation: "EDM",
        startDate: "2025-04-01",
        endDate: "2025-05-01",
        mode: "total-toi",
        source: "raw",
      }),
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
      expect(result.current.status).toBe("error");
      expect(result.current.error).toBe("raw request failed");
      expect(result.current.roster).toEqual([]);
    });
  });

  it("propagates genuine raw coverage and partial status", async () => {
    getTOIDataForGamesMock.mockResolvedValueOnce({
      ...rawResult(1),
      coverage: { inputRows: 3, rosterRows: 1, skippedRows: 2 },
    });

    const { result } = renderHook(() =>
      useDateRangeMatrixData({
        teamAbbreviation: "EDM",
        startDate: "2025-04-01",
        endDate: "2025-05-01",
        mode: "total-toi",
        source: "raw",
        seasonType: "playoffs",
      }),
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
      expect(result.current.status).toBe("partial");
      expect(result.current.coverage).toEqual({
        inputRows: 3,
        rosterRows: 1,
        skippedRows: 2,
      });
    });
    expect(getTOIDataForGamesMock).toHaveBeenCalledWith(
      "EDM",
      "2025-04-01",
      "2025-05-01",
      "playoffs",
    );
  });

  it("uses a canonical team identity for lowercase raw input metadata", async () => {
    getTOIDataForGamesMock.mockResolvedValueOnce(rawResult(1));

    const { result } = renderHook(() =>
      useDateRangeMatrixData({
        teamAbbreviation: " edm ",
        startDate: "2025-04-01",
        endDate: "2025-05-01",
        mode: "total-toi",
        source: "raw",
        seasonType: "regularSeason",
      }),
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
      expect(result.current.teamId).toBe(teamsInfo.EDM.id);
      expect(result.current.teamName).toBe(teamsInfo.EDM.name);
    });
    expect(getTOIDataForGamesMock).toHaveBeenCalledWith(
      " edm ",
      "2025-04-01",
      "2025-05-01",
      "regularSeason",
    );
  });
});
