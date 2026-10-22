import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, renderHook } from "@testing-library/react";

const mocks = vi.hoisted(() => ({ pages: vi.fn() }));
vi.mock("lib/supabase", () => ({
  default: { from: () => { throw new Error("Unexpected unmocked query"); } }
}));
vi.mock("lib/supabase/pagination", () => ({ fetchAllSupabasePages: mocks.pages }));

import { useShotData } from "./useShotData";

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

const games = (team: number) => [{ id: team, hometeamid: team, awayteamid: 99 }];
const shots = (team: number, type = "goal") => [
  { gameid: team, eventownerteamid: team, xcoord: 10, ycoord: 5, typedesckey: type },
  { gameid: team, eventownerteamid: 99, xcoord: -10, ycoord: 5, typedesckey: type }
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
    mocks.pages.mockResolvedValueOnce(games(1)).mockResolvedValueOnce(shots(1, "hit"));
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
