import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useGameData, useSchedule } from "./useGameGrid";
import { loadGame, latestCompletedGame } from "./data";
import { gameFixture } from "./testFixtures";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
function response(value: unknown) {
  return new Response(JSON.stringify(value), {
    headers: { "content-type": "application/json" },
  });
}
function fixtureFetch(url: string) {
  const target = decodeURIComponent(url);
  const id = target.includes("2026010055") ? 2026010055 : 2026010054;
  const f = gameFixture(id);
  return response(
    target.includes("boxscore")
      ? f.box
      : target.includes("shiftcharts")
        ? f.shifts
        : f.pbp,
  );
}

describe("Game Grid loading", () => {
  it("shares the three parallel requests and uses the same-origin proxy", async () => {
    const fetchMock = vi.fn(async (url: string) => fixtureFetch(url));
    vi.stubGlobal("fetch", fetchMock);
    const [a, b] = await Promise.all([
      loadGame(2026010054),
      loadGame(2026010054),
    ]);
    expect(a).toBe(b);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(
      fetchMock.mock.calls.every(([url]) => url.startsWith("/api/cors?url=")),
    ).toBe(true);
  });
  it("discards stale responses when changing games", async () => {
    let release: () => void = () => {};
    const pending = new Promise<void>((resolve) => {
      release = resolve;
    });
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (url.includes("2026010054")) await pending;
        return fixtureFetch(url);
      }),
    );
    const { result, rerender } = renderHook(({ id }) => useGameData(id, 0), {
      initialProps: { id: 2026010054 },
    });
    rerender({ id: 2026010055 });
    await waitFor(() => expect(result.current.game?.id).toBe(2026010055));
    await act(async () => {
      release();
      await pending;
    });
    expect(result.current.game?.id).toBe(2026010055);
  });
  it("clears old data immediately on deselection and retries failed requests", async () => {
    const fetchMock = vi.fn(async (url: string) => fixtureFetch(url));
    vi.stubGlobal("fetch", fetchMock);
    const { result, rerender } = renderHook(
      ({ id, retry }: { id: number | null; retry: number }) =>
        useGameData(id, retry),
      { initialProps: { id: 2026010054 as number | null, retry: 0 } },
    );
    await waitFor(() => expect(result.current.game).not.toBeNull());
    rerender({ id: null, retry: 0 });
    expect(result.current.game).toBeNull();
    fetchMock.mockRejectedValue(new Error("Network unavailable"));
    rerender({ id: 2026010054, retry: 0 });
    await waitFor(() =>
      expect(result.current.error).toBe("Network unavailable"),
    );
    fetchMock.mockImplementation(async (url) => fixtureFetch(url));
    rerender({ id: 2026010054, retry: 1 });
    await waitFor(() => expect(result.current.game?.id).toBe(2026010054));
  });
  it("discards a stale schedule after a date change", async () => {
    let release: () => void = () => {};
    const pending = new Promise<void>((resolve) => {
      release = resolve;
    });
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (url.includes("2026-09-26")) await pending;
        return response({
          gameWeek: [
            {
              date: url.includes("2026-09-26") ? "2026-09-26" : "2026-09-27",
              games: [],
            },
          ],
        });
      }),
    );
    const { result, rerender } = renderHook(
      ({ date }) => useSchedule(date, 0),
      { initialProps: { date: "2026-09-26" } },
    );
    rerender({ date: "2026-09-27" });
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => {
      release();
      await pending;
    });
    expect(result.current.date).toBe("2026-09-27");
    expect(result.current.games).toEqual([]);
  });
  it("bounds the default game search to two schedule requests and excludes future games", async () => {
    const fetchMock = vi.fn(async () =>
      response({
        gameWeek: [
          {
            date: "2026-09-29",
            games: [
              {
                id: 1,
                gameState: "FINAL",
                homeTeam: { abbrev: "UTA" },
                awayTeam: { abbrev: "COL" },
              },
            ],
          },
        ],
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
    expect(await latestCompletedGame(new Date(2026, 8, 28))).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
