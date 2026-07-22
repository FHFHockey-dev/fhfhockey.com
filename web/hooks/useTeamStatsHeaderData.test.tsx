import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { fromMock } = vi.hoisted(() => ({ fromMock: vi.fn() }));

vi.mock("lib/supabase", () => ({ default: { from: fromMock } }));

import { useTeamStatsHeaderData } from "./useTeamStatsHeaderData";

type QueryResult = { data: any; error: Error | null };

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
  chain.limit = vi.fn(() => chain);
  chain.maybeSingle = vi.fn(() => chain);
  chain.then = (resolve: (value: QueryResult) => unknown) =>
    Promise.resolve(result).then(resolve);
  return chain;
}

const summary = {
  games_played: 44,
  wins: 28,
  losses: 13,
  ot_losses: 3,
  points: 59,
  goals_for: 150,
  goals_against: 130,
  point_pct: 0.67,
  regulation_and_ot_wins: 25,
};

const standings = {
  division_sequence: 1,
  conference_sequence: 2,
  league_sequence: 11,
  streak_code: "W",
  streak_count: 2,
  l10_wins: 7,
  l10_losses: 2,
  l10_ot_losses: 1,
  division_name: "Pacific",
  conference_name: "Western",
};

describe("useTeamStatsHeaderData", () => {
  beforeEach(() => fromMock.mockReset());

  it("settles an empty summary without retaining header data", async () => {
    fromMock.mockReturnValueOnce(query({ data: null, error: null }));
    const { result } = renderHook(() =>
      useTeamStatsHeaderData(22, "EDM", 20252026),
    );

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current).toEqual({ data: null, loading: false, error: null });
    expect(fromMock).toHaveBeenCalledOnce();
  });

  it("masks a prior identity and rejects its deferred completion", async () => {
    const prior = deferred<QueryResult>();
    fromMock
      .mockReturnValueOnce(query(prior.promise))
      .mockReturnValueOnce(query({ data: summary, error: null }))
      .mockReturnValueOnce(query({ data: [standings], error: null }));

    const { result, rerender } = renderHook(
      ({ teamId, abbreviation }) =>
        useTeamStatsHeaderData(teamId, abbreviation, 20252026),
      { initialProps: { teamId: 22, abbreviation: "EDM" } },
    );

    rerender({ teamId: 6, abbreviation: "BOS" });
    expect(result.current).toEqual({ data: null, loading: true, error: null });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.data?.league_sequence).toBe(11);

    act(() => prior.resolve({ data: { ...summary, points: 10 }, error: null }));
    await act(async () => Promise.resolve());
    expect(result.current.data?.points).toBe(59);
    expect(fromMock).toHaveBeenCalledTimes(3);
  });

  it("preserves unavailable ranks and a stable error contract", async () => {
    fromMock
      .mockReturnValueOnce(query({ data: summary, error: null }))
      .mockReturnValueOnce(query({ data: [], error: null }));
    const { result } = renderHook(() =>
      useTeamStatsHeaderData(22, "EDM", 20252026),
    );
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.data).toMatchObject({
      division_sequence: null,
      conference_sequence: null,
      league_sequence: null,
    });

    fromMock.mockReset();
    fromMock.mockReturnValueOnce(
      query({ data: null, error: new Error("provider detail") }),
    );
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});
    const failed = renderHook(() => useTeamStatsHeaderData(6, "BOS", 20252026));
    await waitFor(() => expect(failed.result.current.loading).toBe(false));
    expect(failed.result.current.error).toBe("Team standings unavailable.");
    expect(consoleError).toHaveBeenCalledWith(
      "Unable to load team standings header.",
    );
    consoleError.mockRestore();
  });
});
