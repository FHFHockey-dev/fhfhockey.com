import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor, act } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Player, TableAggregateData } from "components/WiGO/types";
import useWigoPlayerDashboard from "./useWigoPlayerDashboard";

const {
  mockReplace,
  mockRouter,
  singleMock,
  eqMock,
  selectMock,
  fromMock,
  mockFetchPlayerAggregatedStats,
  mockGetCurrentSeason
} = vi.hoisted(() => {
  const mockReplace = vi.fn().mockResolvedValue(true);
  const mockRouter = {
    query: {} as Record<string, string>,
    pathname: "/wigoCharts",
    replace: mockReplace
  };

  const singleMock = vi.fn();
  const eqMock = vi.fn(() => ({
    single: singleMock
  }));
  const selectMock = vi.fn(() => ({
    eq: eqMock
  }));
  const fromMock = vi.fn(() => ({
    select: selectMock
  }));

  return {
    mockReplace,
    mockRouter,
    singleMock,
    eqMock,
    selectMock,
    fromMock,
    mockFetchPlayerAggregatedStats: vi.fn(),
    mockGetCurrentSeason: vi.fn()
  };
});

vi.mock("next/router", () => ({
  useRouter: () => mockRouter
}));

vi.mock("lib/supabase", () => ({
  default: {
    from: fromMock
  }
}));

vi.mock("utils/fetchWigoPlayerStats", () => ({
  fetchPlayerAggregatedStats: mockFetchPlayerAggregatedStats
}));

vi.mock("lib/NHL/client", () => ({
  getCurrentSeason: mockGetCurrentSeason
}));

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false
      }
    }
  });
}

function createWrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  };
}

function createPlayer(overrides: Partial<Player> = {}): Player {
  return {
    id: 123,
    firstName: "Jack",
    lastName: "Hughes",
    fullName: "Jack Hughes",
    position: "C",
    birthDate: "2001-05-14",
    birthCity: null,
    birthCountry: null,
    heightInCentimeters: 178,
    weightInKilograms: 80,
    team_id: 1,
    image_url: "https://example.com/headshot.png",
    ...overrides
  };
}

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;

  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });

  return { promise, resolve, reject };
}

describe("useWigoPlayerDashboard", () => {
  beforeEach(() => {
    mockRouter.query = {};
    mockReplace.mockClear();
    fromMock.mockClear();
    selectMock.mockClear();
    eqMock.mockClear();
    singleMock.mockReset();
    mockFetchPlayerAggregatedStats.mockReset();
    mockGetCurrentSeason.mockReset();
    mockGetCurrentSeason.mockResolvedValue({ seasonId: 20242025 });
  });

  it("loads selected player, branding, season, and aggregated stats from the URL query", async () => {
    const player = createPlayer();
    const aggregates = [{ label: "Goals", STD: 31 }] as TableAggregateData[];

    mockRouter.query = { playerId: String(player.id) };
    singleMock.mockResolvedValue({ data: player, error: null });
    mockFetchPlayerAggregatedStats.mockResolvedValue(aggregates);

    const queryClient = createQueryClient();
    const { result } = renderHook(() => useWigoPlayerDashboard(), {
      wrapper: createWrapper(queryClient)
    });

    await waitFor(() => {
      expect(result.current.selectedPlayer?.id).toBe(player.id);
    });

    expect(result.current.currentSeasonId).toBe(20242025);
    expect(result.current.headshotUrl).toBe(player.image_url);
    expect(result.current.teamName).toBe("New Jersey Devils");
    expect(result.current.teamAbbreviation).toBe("NJD");
    expect(result.current.teamIdForLog).toBe(1);
    expect(result.current.rawCombinedData).toEqual(aggregates);
    expect(result.current.aggDataError).toBeNull();
  });

  it("surfaces aggregate query failures without preserving stale table data", async () => {
    const player = createPlayer();

    mockRouter.query = { playerId: String(player.id) };
    singleMock.mockResolvedValue({ data: player, error: null });
    mockFetchPlayerAggregatedStats.mockRejectedValue(new Error("aggregate boom"));

    const queryClient = createQueryClient();
    const { result } = renderHook(() => useWigoPlayerDashboard(), {
      wrapper: createWrapper(queryClient)
    });

    await waitFor(() => {
      expect(result.current.selectedPlayer?.id).toBe(player.id);
      expect(result.current.aggDataError).toBe("aggregate boom");
    });

    expect(result.current.rawCombinedData).toEqual([]);
  });

  it("clears player and aggregate state while the next player is still loading", async () => {
    const firstPlayer = createPlayer({ id: 123, fullName: "Jack Hughes" });
    const secondPlayer = createPlayer({
      id: 456,
      firstName: "Nico",
      lastName: "Hischier",
      fullName: "Nico Hischier"
    });

    const secondPlayerDeferred = createDeferred<{
      data: Player;
      error: null;
    }>();
    const secondAggregateDeferred = createDeferred<TableAggregateData[]>();

    mockRouter.query = { playerId: String(firstPlayer.id) };
    singleMock
      .mockResolvedValueOnce({ data: firstPlayer, error: null })
      .mockImplementationOnce(() => secondPlayerDeferred.promise);
    mockFetchPlayerAggregatedStats
      .mockResolvedValueOnce([{ label: "Goals", STD: 31 }])
      .mockImplementationOnce(() => secondAggregateDeferred.promise);

    const queryClient = createQueryClient();
    const { result, rerender } = renderHook(() => useWigoPlayerDashboard(), {
      wrapper: createWrapper(queryClient)
    });

    await waitFor(() => {
      expect(result.current.selectedPlayer?.id).toBe(firstPlayer.id);
      expect(result.current.rawCombinedData).toEqual([{ label: "Goals", STD: 31 }]);
    });

    mockRouter.query = { playerId: String(secondPlayer.id) };
    rerender();

    await waitFor(() => {
      expect(result.current.selectedPlayerId).toBe(secondPlayer.id);
      expect(result.current.selectedPlayer).toBeNull();
      expect(result.current.rawCombinedData).toEqual([]);
    });

    act(() => {
      secondPlayerDeferred.resolve({ data: secondPlayer, error: null });
      secondAggregateDeferred.resolve([{ label: "Goals", STD: 27 }]);
    });

    await waitFor(() => {
      expect(result.current.selectedPlayer?.id).toBe(secondPlayer.id);
      expect(result.current.rawCombinedData).toEqual([{ label: "Goals", STD: 27 }]);
    });
  });

  it("updates the URL and hydrates the cached player selection when a search result is chosen", async () => {
    const selectedPlayer = createPlayer({ id: 789, fullName: "Timo Meier" });
    const queryClient = createQueryClient();
    const { result, rerender } = renderHook(() => useWigoPlayerDashboard(), {
      wrapper: createWrapper(queryClient)
    });

    act(() => {
      result.current.handlePlayerSelect(selectedPlayer, "https://example.com/timo.png");
    });

    expect(mockReplace).toHaveBeenCalledWith(
      {
        pathname: "/wigoCharts",
        query: { playerId: selectedPlayer.id }
      },
      undefined,
      { shallow: true }
    );

    mockRouter.query = { playerId: String(selectedPlayer.id) };
    singleMock.mockResolvedValue({ data: selectedPlayer, error: null });
    mockFetchPlayerAggregatedStats.mockResolvedValue([]);
    rerender();

    await waitFor(() => {
      expect(result.current.selectedPlayer?.id).toBe(selectedPlayer.id);
      expect(result.current.headshotUrl).toBe("https://example.com/timo.png");
    });
  });
});
