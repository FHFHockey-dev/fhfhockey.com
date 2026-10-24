import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, renderHook } from "@testing-library/react";

const mocks = vi.hoisted(() => ({ pages: vi.fn(), from: vi.fn() }));
vi.mock("lib/supabase", () => ({
  default: {
    from: (table: string) => {
      const query = mocks.from(table);
      if (!query) throw new Error("Unexpected unmocked query");
      return query;
    }
  }
}));
vi.mock("lib/supabase/pagination", () => ({ fetchAllSupabasePages: mocks.pages }));

import { useShotData } from "./useShotData";

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

// NHL game IDs carry the game type in digits 5-6: 2026020001 is regular season.
const gameId = (team: number, gameType = "02") => Number(`2026${gameType}${String(team).padStart(4, "0")}`);
const games = (team: number, gameType = "02") => [{ id: gameId(team, gameType), hometeamid: team, awayteamid: 99 }];
const shots = (team: number, type = "goal", gameType = "02") => [
  { gameid: gameId(team, gameType), eventownerteamid: team, xcoord: 10, ycoord: 5, typedesckey: type },
  { gameid: gameId(team, gameType), eventownerteamid: 99, xcoord: -10, ycoord: 5, typedesckey: type }
];
const filters = { eventTypes: ["goal"], gameTypes: ["02"] };

async function flush() {
  await act(async () => { await Promise.resolve(); });
}

beforeEach(() => {
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.resetAllMocks();
});

describe("useShotData request ownership", () => {
  it.each(["games", "shots"])("keeps cached A after A → B → A while B %s are pending", async (stage) => {
    const pending = deferred<any[]>();
    mocks.pages.mockResolvedValueOnce(games(1)).mockResolvedValueOnce(shots(1));
    const { result, rerender } = renderHook(({ team }) => useShotData(team, "20262027", filters), {
      initialProps: { team: 1 }
    });
    await flush();
    expect(result.current.shotData[0].eventownerteamid).toBe(1);

    if (stage === "shots") mocks.pages.mockResolvedValueOnce(games(2));
    mocks.pages.mockReturnValueOnce(pending.promise);
    rerender({ team: 2 });
    await flush();
    expect(result.current.shotData).toEqual([]);
    rerender({ team: 1 });
    expect(result.current.isLoading).toBe(false);
    expect(result.current.shotData[0].eventownerteamid).toBe(1);
    await act(async () => { pending.resolve(stage === "games" ? games(2) : shots(2)); });

    expect(result.current.shotData[0].eventownerteamid).toBe(1);
    expect(result.current.opponentShotData[0].eventownerteamid).toBe(99);
    expect(result.current.error).toBeNull();
    expect(result.current.isLoading).toBe(false);
    expect(mocks.pages).toHaveBeenCalledTimes(stage === "games" ? 3 : 4);
  });

  it.each(["success", "empty", "error"])("ignores stale %s and finally while the current request is loading", async (outcome) => {
    const old = deferred<any[]>();
    const current = deferred<any[]>();
    mocks.pages.mockReturnValueOnce(old.promise).mockReturnValueOnce(current.promise);
    const { result, rerender } = renderHook(({ team }) => useShotData(team, "20262027", filters), {
      initialProps: { team: 1 }
    });
    rerender({ team: 2 });
    await act(async () => {
      if (outcome === "error") old.reject(new Error("obsolete failure"));
      else old.resolve(outcome === "empty" ? [] : games(1));
    });
    expect(result.current).toMatchObject({ isLoading: true, error: null, shotData: [], opponentShotData: [] });
    expect(mocks.pages).toHaveBeenCalledTimes(2);
    await act(async () => { current.resolve([]); });
    expect(result.current).toMatchObject({ isLoading: false, error: null, shotData: [] });
  });

  it("defers hidden reads and preserves the loaded key across tab visibility and equal filters", async () => {
    mocks.pages.mockResolvedValueOnce(games(1)).mockResolvedValueOnce(shots(1));
    const { result, rerender } = renderHook(({ enabled }) => useShotData(1, "20262027", {
      eventTypes: ["goal"], gameTypes: ["02"]
    }, enabled), { initialProps: { enabled: false } });
    expect(mocks.pages).not.toHaveBeenCalled();
    rerender({ enabled: true });
    await flush();
    expect(result.current.shotData[0].eventownerteamid).toBe(1);
    rerender({ enabled: false });
    rerender({ enabled: true });
    await flush();
    expect(result.current.isLoading).toBe(false);
    expect(mocks.pages).toHaveBeenCalledTimes(2);
  });

  it("retires a pending hidden-tab request and fetches again when shown", async () => {
    const hidden = deferred<any[]>();
    mocks.pages.mockResolvedValueOnce(games(1)).mockReturnValueOnce(hidden.promise);
    const { result, rerender } = renderHook(({ enabled }) => useShotData(1, "20262027", filters, enabled), {
      initialProps: { enabled: true }
    });
    await flush();
    rerender({ enabled: false });
    await act(async () => { hidden.resolve(shots(1)); });
    expect(result.current.shotData).toEqual([]);
    mocks.pages.mockResolvedValueOnce(games(1)).mockResolvedValueOnce(shots(1));
    rerender({ enabled: true });
    await flush();
    expect(result.current.shotData[0].eventownerteamid).toBe(1);
    expect(mocks.pages).toHaveBeenCalledTimes(4);
  });

  it.each(["event", "game", "season"])("owns pending reads by %s filter as well as team", async (changed) => {
    const old = deferred<any[]>();
    mocks.pages.mockResolvedValueOnce(games(1)).mockReturnValueOnce(old.promise);
    const { result, rerender } = renderHook(({ event, game, season }) => useShotData(1, season, {
      eventTypes: [event], gameTypes: [game]
    }), { initialProps: { event: "goal", game: "02", season: "20262027" } });
    await flush();
    const gameType = changed === "game" ? "03" : "02";
    mocks.pages.mockResolvedValueOnce(games(1, gameType)).mockResolvedValueOnce(shots(1, "hit", gameType));
    rerender({
      event: changed === "event" ? "hit" : "goal",
      game: changed === "game" ? "03" : "02",
      season: changed === "season" ? "20252026" : "20262027"
    });
    await flush();
    await act(async () => { old.resolve(shots(1)); });
    expect(result.current.shotData[0].typedesckey).toBe("hit");
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeNull();
    expect(mocks.pages).toHaveBeenCalledTimes(4);
  });

  it("reads only games of the selected game types", async () => {
    const chunks: unknown[][] = [];
    const eventQuery: any = {
      select: () => eventQuery,
      in: (column: string, values: unknown[]) => {
        if (column === "gameid") chunks.push(values);
        return eventQuery;
      },
      range: () => eventQuery
    };
    mocks.from.mockReturnValue(eventQuery);
    mocks.pages
      .mockResolvedValueOnce([
        { id: 2026020001, hometeamid: 1, awayteamid: 99 },
        { id: 2026030001, hometeamid: 99, awayteamid: 1 },
        { id: 2026010001, hometeamid: 1, awayteamid: 99 }
      ])
      .mockImplementationOnce(async (query: any) => {
        query({ from: 0, to: 999 });
        return [{ gameid: 2026030001, eventownerteamid: 1, xcoord: 10, ycoord: 5, typedesckey: "goal" }];
      });
    const { result } = renderHook(() => useShotData(1, "20262027", { eventTypes: ["goal"], gameTypes: ["03"] }));
    await flush();
    expect(chunks).toEqual([[2026030001]]);
    expect(result.current.shotData).toHaveLength(1);
  });

  it("returns nothing for a selection that excludes every game", async () => {
    mocks.pages.mockResolvedValueOnce(games(1));
    const { result } = renderHook(() => useShotData(1, "20262027", { eventTypes: ["goal"], gameTypes: ["03"] }));
    await flush();
    expect(result.current).toMatchObject({ isLoading: false, error: null, shotData: [], opponentShotData: [] });
    expect(mocks.pages).toHaveBeenCalledTimes(1);
  });

  it.each([
    ["event", { eventTypes: [], gameTypes: ["02"] }],
    ["game", { eventTypes: ["goal"], gameTypes: [] }]
  ])("makes no read when no %s type is selected", async (_label, emptyFilters) => {
    const { result } = renderHook(() => useShotData(1, "20262027", emptyFilters));
    await flush();
    expect(mocks.pages).not.toHaveBeenCalled();
    expect(result.current).toMatchObject({ isLoading: false, error: null, shotData: [], opponentShotData: [] });
  });

  it("drops unparseable coordinates instead of plotting them at center ice", async () => {
    mocks.pages.mockResolvedValueOnce(games(1)).mockResolvedValueOnce([
      { gameid: gameId(1), eventownerteamid: 1, xcoord: "", ycoord: 5, typedesckey: "goal" },
      { gameid: gameId(1), eventownerteamid: 1, xcoord: "12", ycoord: "-4", typedesckey: "goal" },
      { gameid: gameId(1), eventownerteamid: 99, xcoord: -10, ycoord: "n/a", typedesckey: "goal" }
    ]);
    const { result } = renderHook(() => useShotData(1, "20262027", filters));
    await flush();
    expect(result.current.shotData).toEqual([
      expect.objectContaining({ xcoord: 12, ycoord: -4, eventownerteamid: 1 })
    ]);
    expect(result.current.opponentShotData).toEqual([]);
  });

  it("clears the previous error when loading a different key", async () => {
    mocks.pages.mockRejectedValueOnce(new Error("current failure"));
    const { result, rerender } = renderHook(({ team }) => useShotData(team, "20262027", filters), {
      initialProps: { team: 1 }
    });
    await flush();
    expect(result.current.error?.message).toBe("current failure");
    mocks.pages.mockResolvedValueOnce([]);
    rerender({ team: 2 });
    await flush();
    expect(result.current.error).toBeNull();
    expect(result.current.isLoading).toBe(false);
  });
});
