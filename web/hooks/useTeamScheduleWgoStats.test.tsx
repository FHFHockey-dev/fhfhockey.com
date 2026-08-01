import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { fromMock } = vi.hoisted(() => ({ fromMock: vi.fn() }));

vi.mock("lib/supabase", () => ({ default: { from: fromMock } }));

import { useTeamScheduleWgoStats } from "./useTeamScheduleWgoStats";

type QueryResult = { data: unknown[] | null; error: Error | null };

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

function query(result: QueryResult | Promise<QueryResult>) {
  const chain: any = {};
  chain.select = vi.fn(() => chain);
  chain.eq = vi.fn(() => chain);
  chain.order = vi.fn(() => chain);
  chain.range = vi.fn(() => chain);
  chain.then = (resolve: (value: QueryResult) => unknown) =>
    Promise.resolve(result).then(resolve);
  return chain;
}

describe("useTeamScheduleWgoStats", () => {
  beforeEach(() => fromMock.mockReset());

  it("rejects invalid identity before querying", async () => {
    const { result } = renderHook(() => useTeamScheduleWgoStats(0, "2025"));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current).toEqual({
      stats: [],
      loading: false,
      error: "WGO analytics unavailable.",
    });
    expect(fromMock).not.toHaveBeenCalled();
  });

  it("owns one exact WGO query and settles empty results", async () => {
    const request = query({ data: [], error: null });
    fromMock.mockReturnValueOnce(request);

    const { result } = renderHook(() =>
      useTeamScheduleWgoStats(22, "20252026"),
    );

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current).toEqual({ stats: [], loading: false, error: null });
    expect(fromMock).toHaveBeenCalledOnce();
    expect(fromMock).toHaveBeenCalledWith("wgo_team_stats");
    expect(request.select).toHaveBeenCalledOnce();
    expect(request.eq).toHaveBeenNthCalledWith(1, "team_id", 22);
    expect(request.eq).toHaveBeenNthCalledWith(2, "season_id", 20252026);
    expect(request.order).toHaveBeenNthCalledWith(1, "date", {
      ascending: true,
    });
    expect(request.order).toHaveBeenNthCalledWith(2, "id", {
      ascending: true,
    });
    expect(request.range).toHaveBeenCalledWith(0, 999);
  });

  it("masks a prior team immediately and rejects its deferred response", async () => {
    const prior = deferred<QueryResult>();
    const currentRow = { id: 2, team_id: 6, date: "2026-01-02" };
    fromMock
      .mockReturnValueOnce(query(prior.promise))
      .mockReturnValueOnce(query({ data: [currentRow], error: null }));

    const { result, rerender } = renderHook(
      ({ teamId }) => useTeamScheduleWgoStats(teamId, "20252026"),
      { initialProps: { teamId: 22 } },
    );

    rerender({ teamId: 6 });
    expect(result.current).toEqual({ stats: [], loading: true, error: null });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.stats).toHaveLength(1);
    expect(result.current.stats[0]).toMatchObject(currentRow);

    act(() => prior.resolve({ data: [{ id: 1, team_id: 22 }], error: null }));
    await act(async () => Promise.resolve());
    expect(result.current.stats).toHaveLength(1);
    expect(result.current.stats[0]).toMatchObject(currentRow);
  });

  it("fails closed with stable public state on query error", async () => {
    fromMock.mockReturnValueOnce(
      query({ data: null, error: new Error("provider detail") }),
    );
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});

    const { result } = renderHook(() =>
      useTeamScheduleWgoStats(22, "20252026"),
    );

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current).toEqual({
      stats: [],
      loading: false,
      error: "WGO analytics unavailable.",
    });
    expect(consoleError).toHaveBeenCalledWith(
      "Unable to load schedule WGO analytics.",
    );
    consoleError.mockRestore();
  });
});
