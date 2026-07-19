import {
  act,
  cleanup,
  render,
  renderHook,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { teamsInfo } from "lib/teamsInfo";
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

const aggregatedPlayer: AggregatedDRMPlayer = {
  playerId: 97,
  teamId: teamsInfo.EDM.id,
  playerName: "Connor McDavid",
  playerAbbrevName: "C. McDavid",
  lastName: "McDavid",
  primaryPosition: "C",
  displayPosition: "C",
  playerType: "F",
  regularSeasonData: {
    totalTOI: "20:00",
    GP: 2,
    ATOI: "10:00",
    timesOnLine: { 1: "2" },
    timesOnPair: {},
    percentToiWith: { 29: "71.5" },
    percentToiWithMixed: { 29: 73 },
    timeSpentWith: { 29: "858" },
    timeSpentWithMixed: { 29: 876 },
    timesPlayedWith: { 29: "2" },
    percentOfSeason: { 29: "35.75" },
  },
  playoffData: {
    totalTOI: "10:30",
    GP: 1,
    ATOI: "10:30",
    timesOnLine: { 2: "1" },
    timesOnPair: {},
    percentToiWith: { 29: "48.25" },
    percentToiWithMixed: { 29: "50" },
    timeSpentWith: { 29: "304" },
    timeSpentWithMixed: { 29: "315" },
    timesPlayedWith: { 29: "1" },
    percentOfSeason: { 29: "24.125" },
  },
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

describe("mapAggregatedPlayers", () => {
  it("selects and normalizes the regular-season bucket", () => {
    const [player] = mapAggregatedPlayers(
      aggregatedPlayers,
      "regularSeason",
      "EDM",
    );

    expect(player).toMatchObject({
      id: 97,
      teamId: teamsInfo.EDM.id,
      franchiseId: teamsInfo.EDM.franchiseId,
      totalTOI: 1200,
      GP: 2,
      ATOI: "10:00",
      timesOnLine: { 1: 2 },
      percentToiWith: { 29: 71.5 },
      timeSpentWith: { 29: 858 },
      timesPlayedWith: { 29: 2 },
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

  it("skips rows without a valid player identity", () => {
    expect(
      mapAggregatedPlayers(
        [{ ...aggregatedPlayer, playerId: null }],
        "regularSeason",
        "EDM",
      ),
    ).toEqual([]);
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
