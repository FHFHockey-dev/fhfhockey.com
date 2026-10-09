import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const {
  buildPlayerStatsLandingAggregationFromStateMock,
  buildSnapshotsMock,
  invalidateCacheMock,
} = vi.hoisted(() => ({
  buildPlayerStatsLandingAggregationFromStateMock: vi.fn(),
  buildSnapshotsMock: vi.fn(),
  invalidateCacheMock: vi.fn(),
}));

vi.mock("./playerStatsLandingServer", async () => {
  const actual = await vi.importActual<typeof import("./playerStatsLandingServer")>(
    "./playerStatsLandingServer"
  );

  return {
    ...actual,
    buildPlayerStatsLandingAggregationFromState:
      buildPlayerStatsLandingAggregationFromStateMock,
    buildPlayerStatsLandingSummarySnapshotsForGameIds: buildSnapshotsMock,
    invalidatePlayerStatsSeasonAggregateCache: invalidateCacheMock,
  };
});

import {
  PlayerStatsSummaryWriteBusyError,
  refreshPlayerUnderlyingSummarySnapshotsForGameIds,
  warmPlayerStatsLandingSeasonAggregateCache,
} from "./playerStatsSummaryRefresh";

describe("player summary snapshot contention", () => {
  const busy = { code: "P0001", message: "NHL_NORMALIZATION_WRITER_BUSY" };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });
  afterEach(() => vi.useRealTimers());

  function context(count = 1) {
    const rows = Array.from({ length: count }, (_, index) => Object.freeze({
      game_id: 2026020039 + Math.floor(index / 27),
      season_id: 20262027,
      game_date: "2026-10-04",
      endpoint: "landing",
      source_url: `derived://underlying-player-summary-v2/test/${index}`,
      payload_hash: String(index).padStart(64, "0"),
      fetched_at: "2026-10-05T10:25:11.000Z",
      payload: Object.freeze({ toiSeconds: 30.5, xg: 0.12 }),
    }));
    buildSnapshotsMock.mockResolvedValue(rows);
    const upsert = vi.fn().mockResolvedValue({ error: null });
    const supabase = { from: vi.fn(() => ({ upsert })) };
    const run = () => refreshPlayerUnderlyingSummarySnapshotsForGameIds({
      gameIds: [...new Set(rows.map((row) => row.game_id))],
      seasonId: 20262027,
      requestedGameType: 2,
      shouldWarmLandingCache: true,
      supabase: supabase as any,
    });
    return { rows, upsert, run };
  }

  it("retries an aborted summary statement once using the identical built payload", async () => {
    const { rows, upsert, run } = context(101);
    const original = JSON.stringify(rows);
    upsert.mockResolvedValueOnce({ error: busy });
    const pending = run();
    await vi.advanceTimersByTimeAsync(499);
    expect(upsert).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    const result = await pending;

    expect(result).toMatchObject({ rowsUpserted: 101, summaryWriteBusyRetries: 1 });
    expect(upsert).toHaveBeenCalledTimes(3);
    expect(upsert.mock.calls[0][0]).toBe(upsert.mock.calls[1][0]);
    expect(upsert.mock.calls[2][0]).toEqual([rows[100]]);
    expect(upsert.mock.calls[0][1]).toEqual({
      onConflict: "game_id,endpoint,payload_hash", ignoreDuplicates: true,
    });
    expect(JSON.stringify(rows)).toBe(original);
    expect(buildSnapshotsMock).toHaveBeenCalledTimes(1);
    expect(invalidateCacheMock).toHaveBeenCalledTimes(1);
    expect(buildPlayerStatsLandingAggregationFromStateMock).toHaveBeenCalledTimes(1);
  });

  it("shares one retry across batches and preserves the later exhausted stage", async () => {
    const { upsert, run } = context(101);
    upsert.mockResolvedValueOnce({ error: busy })
      .mockResolvedValueOnce({ error: null })
      .mockResolvedValueOnce({ error: busy });
    const pending = run().catch((error) => error);
    await vi.runAllTimersAsync();
    const error = await pending;

    expect(error).toBeInstanceOf(PlayerStatsSummaryWriteBusyError);
    expect(error).toMatchObject({
      code: "P0001", stage: "persist_player_summaries", endpoint: "landing",
      gameIds: [2026020042], attempts: 1,
    });
    expect(upsert).toHaveBeenCalledTimes(3);
    expect(buildSnapshotsMock).toHaveBeenCalledTimes(1);
    expect(invalidateCacheMock).not.toHaveBeenCalled();
    expect(buildPlayerStatsLandingAggregationFromStateMock).not.toHaveBeenCalled();
  });

  it("retains exhaustion after two attempts and never warms failed summaries", async () => {
    const { upsert, run } = context();
    upsert.mockResolvedValue({ error: busy });
    const pending = run().catch((error) => error);
    await vi.runAllTimersAsync();
    expect(await pending).toMatchObject({
      code: "P0001", stage: "persist_player_summaries", endpoint: "landing",
      gameIds: [2026020039], attempts: 2,
    });
    expect(upsert).toHaveBeenCalledTimes(2);
    expect(buildSnapshotsMock).toHaveBeenCalledTimes(1);
    expect(buildPlayerStatsLandingAggregationFromStateMock).not.toHaveBeenCalled();
  });

  it.each([
    { code: "P0001", message: "NHL_NORMALIZATION_SCOPE_BUSY" },
    { code: "42501", message: "NHL_NORMALIZATION_WRITER_BUSY" },
    { code: "23505", message: "duplicate key" },
  ])("does not retry another database error: $code $message", async (error) => {
    const { upsert, run } = context();
    upsert.mockResolvedValue({ error });
    await expect(run()).rejects.toBe(error);
    expect(upsert).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("does not replay an uncertain transport acknowledgement", async () => {
    const { upsert, run } = context();
    const error = new TypeError("fetch failed");
    upsert.mockRejectedValue(error);
    await expect(run()).rejects.toBe(error);
    expect(upsert).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
    expect(buildPlayerStatsLandingAggregationFromStateMock).not.toHaveBeenCalled();
  });
});

describe("warmPlayerStatsLandingSeasonAggregateCache", () => {
  beforeEach(() => {
    buildPlayerStatsLandingAggregationFromStateMock.mockReset();
    buildPlayerStatsLandingAggregationFromStateMock.mockResolvedValue({
      family: "onIceCounts",
      rows: [],
      pagination: {
        page: 1,
        pageSize: 50,
        totalRows: 0,
        totalPages: 0,
      },
      sort: {
        sortKey: "xgfPct",
        direction: "desc",
      },
    });
  });

  it("warms the default skater landing aggregate cache by default", async () => {
    await warmPlayerStatsLandingSeasonAggregateCache({
      seasonId: 20252026,
      gameType: 2,
    });

    expect(buildPlayerStatsLandingAggregationFromStateMock).toHaveBeenCalledTimes(1);
    expect(buildPlayerStatsLandingAggregationFromStateMock.mock.calls[0]?.[0]).toMatchObject({
      primary: {
        seasonRange: {
          fromSeasonId: 20252026,
          throughSeasonId: 20252026,
        },
        seasonType: "regularSeason",
        statMode: "onIce",
        displayMode: "counts",
      },
      view: {
        sort: {
          sortKey: "xgfPct",
          direction: "desc",
        },
      },
    });
  });

  it("can warm a dedicated goalie aggregate cache profile", async () => {
    await warmPlayerStatsLandingSeasonAggregateCache({
      seasonId: 20252026,
      gameType: 2,
      statModes: ["goalies"],
    });

    expect(buildPlayerStatsLandingAggregationFromStateMock).toHaveBeenCalledTimes(1);
    expect(buildPlayerStatsLandingAggregationFromStateMock.mock.calls[0]?.[0]).toMatchObject({
      primary: {
        statMode: "goalies",
        displayMode: "counts",
      },
      view: {
        sort: {
          sortKey: "savePct",
          direction: "desc",
        },
      },
    });
  });

  it("warms each requested stat mode once", async () => {
    await warmPlayerStatsLandingSeasonAggregateCache({
      seasonId: 20252026,
      gameType: 2,
      statModes: ["onIce", "goalies", "goalies"],
    });

    expect(buildPlayerStatsLandingAggregationFromStateMock).toHaveBeenCalledTimes(2);
    expect(
      buildPlayerStatsLandingAggregationFromStateMock.mock.calls.map(
        (call) => call[0]?.primary.statMode
      )
    ).toEqual(["onIce", "goalies"]);
  });
});
