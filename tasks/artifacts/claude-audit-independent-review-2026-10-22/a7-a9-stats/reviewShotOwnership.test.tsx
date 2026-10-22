import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { act, cleanup, renderHook } from "@testing-library/react";
const mocks = vi.hoisted(() => ({ from: vi.fn(), range: vi.fn() }));
vi.mock("lib/supabase", () => ({ default: { from: mocks.from } }));
// Deliberately retain the real fetchAllSupabasePages implementation.
import { useShotData } from "hooks/useShotData";

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { resolve, reject, promise };
}
const game = (team: number) => ({ id: team, hometeamid: team, awayteamid: 99 });
const shot = (team: number) => ({ gameid: team, eventownerteamid: team, xcoord: 1, ycoord: 2, typedesckey: "goal" });
const response = (data: any[]) => ({ data, error: null });
const filters = { eventTypes: ["goal"], gameTypes: ["02"] };
beforeEach(() => {
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
  mocks.from.mockImplementation(() => {
    const q: any = { range: mocks.range };
    for (const method of ["select", "eq", "or", "in"]) q[method] = () => q;
    return q;
  });
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.resetAllMocks(); });

it.each(["games-page", "shots-page", "shots-error"])("keeps cached A and retires real pagination after obsolete B %s", async (stage) => {
  const pending = deferred<any>();
  mocks.range.mockResolvedValueOnce(response([game(1)])).mockResolvedValueOnce(response([shot(1), shot(99)]));
  const { result, rerender } = renderHook(({ team }) => useShotData(team, "20262027", filters), { initialProps: { team: 1 } });
  await act(async () => { await Promise.resolve(); });
  expect(result.current.shotData[0]?.eventownerteamid).toBe(1);
  if (stage !== "games-page") mocks.range.mockResolvedValueOnce(response([game(2)]));
  mocks.range.mockReturnValueOnce(pending.promise);
  rerender({ team: 2 });
  await act(async () => { await Promise.resolve(); });
  expect(result.current.isLoading).toBe(true);
  rerender({ team: 1 });
  const count = mocks.range.mock.calls.length;
  await act(async () => {
    if (stage === "shots-error") pending.reject(new Error("obsolete B error"));
    else pending.resolve(response(Array.from({ length: 1000 }, () => stage === "games-page" ? game(2) : shot(2))));
  });
  expect(result.current).toMatchObject({ isLoading: false, error: null });
  expect(result.current.shotData[0]?.eventownerteamid).toBe(1);
  expect(mocks.range).toHaveBeenCalledTimes(count);
});
