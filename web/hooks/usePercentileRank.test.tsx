import React from "react";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import usePercentileRank from "./usePercentileRank";

const mockRpc = vi.hoisted(() => vi.fn());
const mockUseCurrentSeason = vi.hoisted(() => vi.fn());

const rangeCalls = vi.hoisted(() => [] as unknown[][]);
// The hook pages the RPC with order().range(); each page call runs mockRpc.
vi.mock("lib/supabase/public-client", () => ({
  default: {
    rpc: (...args: unknown[]) => {
      const result = mockRpc(...args);
      const chain: any = {
        ...result,
        order: () => chain,
        range: (...range: unknown[]) => { rangeCalls.push(range); return chain; },
      };
      return chain;
    },
  },
}));

vi.mock("./useCurrentSeason", () => ({
  default: mockUseCurrentSeason,
}));

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  function QueryWrapper({ children }: { children: React.ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  }

  return QueryWrapper;
}

describe("usePercentileRank", () => {
  let dateNowSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    dateNowSpy = vi
      .spyOn(Date, "now")
      .mockReturnValue(new Date("2026-04-09T12:00:00Z").getTime());
    mockRpc.mockReset();
    mockUseCurrentSeason.mockReset();
    mockUseCurrentSeason.mockReturnValue({
      seasonId: 20252026,
      regularSeasonStartDate: "2025-10-07",
      regularSeasonEndDate: "2026-04-17",
    });
  });

  it("uses explicit season bounds for SEASON instead of null dates", async () => {
    mockRpc.mockReturnValue({
      returns: vi.fn().mockResolvedValue({
        data: [
          {
            id: 8476453,
            avggoals: 0.6,
            avgassists: 1.1,
            avgplusminus: 0.2,
            avgpim: 0.4,
            avghits: 0.6,
            avgblockedshots: 0.5,
            avgpowerplaypoints: 0.4,
            avgshots: 3.7,
            count: 72,
          },
          {
            id: 1,
            avggoals: 0.2,
            avgassists: 0.5,
            avgplusminus: 0.1,
            avgpim: 0.3,
            avghits: 0.2,
            avgblockedshots: 0.1,
            avgpowerplaypoints: 0.1,
            avgshots: 2.1,
            count: 50,
          },
        ],
        error: null,
      }),
    });

    const { result } = renderHook(() => usePercentileRank(8476453, "SEASON"), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(mockRpc).toHaveBeenCalled();
      expect(result.current.data?.goals).toBeGreaterThan(0);
    });

    expect(mockRpc).toHaveBeenCalledWith("get_skaters_avg_stats", {
      start_date: "2025-10-07",
      end_date: "2026-04-09",
    });
  });

  it("keeps the season's date-only end boundary and shares the cohort across players", async () => {
    dateNowSpy.mockReturnValue(new Date("2026-09-19T12:00:00Z").getTime());
    mockRpc.mockReturnValue({
      returns: vi.fn().mockResolvedValue({ data: [], error: null }),
    });
    const { result, rerender } = renderHook(
      ({ playerId }) => usePercentileRank(playerId, "SEASON"),
      {
        initialProps: { playerId: 8476453 },
        wrapper: createWrapper(),
      },
    );
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(mockRpc).toHaveBeenCalledWith("get_skaters_avg_stats", {
      start_date: "2025-10-07",
      end_date: "2026-04-17",
    });
    rerender({ playerId: 8478402 });
    expect(mockRpc).toHaveBeenCalledTimes(1);
    expect(result.current.data).toBeUndefined();
  });

  it("recovers from a transient timeout with one bounded retry", async () => {
    mockRpc
      .mockReturnValueOnce({
        returns: vi
          .fn()
          .mockResolvedValue({
            data: null,
            error: { code: "57014", message: "statement timeout" },
          }),
      })
      .mockReturnValue({
        returns: vi.fn().mockResolvedValue({ data: [], error: null }),
      });
    const { result } = renderHook(() => usePercentileRank(8476453, "SEASON"), {
      wrapper: createWrapper(),
    });
    await waitFor(() => expect(mockRpc).toHaveBeenCalledTimes(2), {
      timeout: 2500,
    });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBeNull();
  });

  it("uses midrank for ties and clears results when the player is cleared", async () => {
    const row = { avggoals: 0, avgassists: 0, avgplusminus: 0, avgpim: 0,
      avghits: 0, avgblockedshots: 0, avgpowerplaypoints: 0, avgshots: 0, numgames: 10 };
    mockRpc.mockReturnValue({ returns: vi.fn().mockResolvedValue({
      data: [{ ...row, id: 1 }, { ...row, id: 2 }], error: null
    }) });
    const { result, rerender } = renderHook(
      ({ playerId }: { playerId: number | undefined }) => usePercentileRank(playerId, "SEASON"),
      { wrapper: createWrapper(), initialProps: { playerId: 1 as number | undefined } }
    );
    await waitFor(() => expect(result.current.data?.goals).toBe(50));
    expect(Object.values(result.current.data!)).toEqual(Array(8).fill(50));
    rerender({ playerId: undefined });
    expect(result.current.data).toBeUndefined();
  });

  it("does not query an inverted preseason date window", () => {
    mockUseCurrentSeason.mockReturnValue({ seasonId: 20262027,
      regularSeasonStartDate: "2026-09-29", regularSeasonEndDate: "2027-04-10" });
    const { result } = renderHook(() => usePercentileRank(1, "SEASON"), { wrapper: createWrapper() });
    expect(mockRpc).not.toHaveBeenCalled();
    expect(result.current.data).toBeUndefined();
    expect(result.current.loading).toBe(false);
  });

  it("does not turn missing category values into zero percentiles", async () => {
    mockRpc.mockReturnValue({ returns: vi.fn().mockResolvedValue({
      data: [{ id: 1, avggoals: null, numgames: 10 }], error: null
    }) });
    const { result } = renderHook(() => usePercentileRank(1, "SEASON"), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.data).toBeUndefined();
  });

  it("exposes a persistent source failure after two attempts", async () => {
    const error = { code: "57014", message: "statement timeout" };
    mockRpc.mockReturnValue({
      returns: vi.fn().mockResolvedValue({ data: null, error }),
    });
    const { result } = renderHook(() => usePercentileRank(8476453, "SEASON"), {
      wrapper: createWrapper(),
    });
    await waitFor(() => expect(result.current.error).toEqual(error), {
      timeout: 2500,
    });
    expect(mockRpc).toHaveBeenCalledTimes(2);
    expect(result.current.loading).toBe(false);
    expect(result.current.data).toBeUndefined();
  });

  afterEach(() => {
    dateNowSpy.mockRestore();
  });
});

describe("unavailable percentile players", () => {
  it("does not turn missing cohort membership into eight invented zero percentiles", async () => {
    mockUseCurrentSeason.mockReturnValue({
      seasonId: 20252026,
      regularSeasonStartDate: "2025-10-07",
      regularSeasonEndDate: "2026-04-17",
    });
    mockRpc.mockReturnValue({
      returns: vi.fn().mockResolvedValue({ data: [], error: null }),
    });
    const { result } = renderHook(() => usePercentileRank(999, "SEASON"), {
      wrapper: createWrapper(),
    });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.data).toBeUndefined();
  });
});

describe("radar cohort", () => {
  const row = (id: number, numgames: number, avggoals: number) => ({
    id, numgames, avggoals, avgassists: 0, avgplusminus: 0, avgpim: 0,
    avghits: 0, avgblockedshots: 0, avgpowerplaypoints: 0, avgshots: 0,
  });

  beforeEach(() => {
    rangeCalls.length = 0;
    mockRpc.mockReset();
    mockUseCurrentSeason.mockReturnValue({
      seasonId: 20262027,
      regularSeasonStartDate: "2026-10-06",
      regularSeasonEndDate: "2027-04-15",
    });
  });

  it("pages the cohort past the 1,000-row cap in id order", async () => {
    const firstPage = Array.from({ length: 1000 }, (_, index) => row(index + 1, 10, index / 1000));
    mockRpc
      .mockReturnValueOnce({ returns: vi.fn().mockResolvedValue({ data: firstPage, error: null }) })
      .mockReturnValueOnce({ returns: vi.fn().mockResolvedValue({ data: [row(8486067, 16, 2)], error: null }) });
    const { result } = renderHook(() => usePercentileRank(8486067, "SEASON"), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.data?.goals).toBeGreaterThan(99));
    expect(rangeCalls).toEqual([[0, 999], [1000, 1999]]);
    expect(result.current.sample).toEqual({ playerGames: 16, cohortSize: 1001, minGames: 5 });
  });

  it("ranks against skaters with 5+ games but keeps a small-sample target", async () => {
    // Bystedt's shape: 2 games. Two 1-game rows would otherwise sit below him.
    mockRpc.mockReturnValue({ returns: vi.fn().mockResolvedValue({
      data: [row(8483428, 2, 0.5), row(2, 1, 0), row(3, 1, 0), row(4, 12, 1), row(5, 14, 0.25)],
      error: null,
    }) });
    const { result } = renderHook(() => usePercentileRank(8483428, "SEASON"), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.data).toBeDefined());
    // Cohort: the target plus ids 4 and 5. Midrank of 0.5 among [0.25, 0.5, 1] is 50.
    expect(result.current.data?.goals).toBe(50);
    expect(result.current.sample).toEqual({ playerGames: 2, cohortSize: 2, minGames: 5 });
  });
});
