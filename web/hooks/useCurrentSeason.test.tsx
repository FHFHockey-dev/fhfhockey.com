import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { Season } from "lib/NHL/types";
import useCurrentSeason, { useCurrentSeasonQuery } from "./useCurrentSeason";

const mockGetCurrentSeason = vi.hoisted(() => vi.fn());

vi.mock("lib/NHL/client", () => ({
  getCurrentSeason: mockGetCurrentSeason,
}));

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });
}

function createWrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  };
}

function createSeason(): Season {
  return {
    slice: (start, end) => String(20252026).slice(start, end),
    seasonId: 20252026,
    regularSeasonStartDate: "2025-10-07",
    regularSeasonEndDate: "2026-04-16",
    seasonEndDate: "2026-06-22",
    numberOfGames: 82,
    lastSeasonId: 20242025,
    lastRegularSeasonStartDate: "2024-10-04",
    lastRegularSeasonEndDate: "2025-04-17",
    lastSeasonEndDate: "2025-06-17",
    lastNumberOfGames: 82,
  };
}

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;

  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve;
    reject = promiseReject;
  });

  return { promise, resolve, reject };
}

describe("useCurrentSeason", () => {
  beforeEach(() => {
    mockGetCurrentSeason.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("preserves the default data-only undefined-to-season contract", async () => {
    const deferred = createDeferred<Season>();
    const season = createSeason();
    mockGetCurrentSeason.mockReturnValue(deferred.promise);

    const queryClient = createQueryClient();
    const { result } = renderHook(() => useCurrentSeason(), {
      wrapper: createWrapper(queryClient),
    });

    expect(result.current).toBeUndefined();

    act(() => {
      deferred.resolve(season);
    });

    await waitFor(() => {
      expect(result.current).toEqual(season);
    });
  });

  it("exposes the pending query state before season resolution", () => {
    const deferred = createDeferred<Season>();
    mockGetCurrentSeason.mockReturnValue(deferred.promise);

    const queryClient = createQueryClient();
    const { result } = renderHook(() => useCurrentSeasonQuery(), {
      wrapper: createWrapper(queryClient),
    });

    expect(result.current.status).toBe("pending");
    expect(result.current.isPending).toBe(true);
    expect(result.current.data).toBeUndefined();
    expect(result.current.error).toBeNull();
  });

  it("exposes a terminal query error without fabricating season data", async () => {
    const error = new Error("season endpoint unavailable");
    mockGetCurrentSeason.mockRejectedValue(error);
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    const queryClient = createQueryClient();
    const { result } = renderHook(() => useCurrentSeasonQuery(), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.status).toBe("error");
    expect(result.current.isPending).toBe(false);
    expect(result.current.data).toBeUndefined();
    expect(result.current.error).toBe(error);
  });

  it("exposes a successful null result when no valid season is available", async () => {
    mockGetCurrentSeason.mockResolvedValue(null);
    vi.spyOn(console, "warn").mockImplementation(() => undefined);

    const queryClient = createQueryClient();
    const { result } = renderHook(() => useCurrentSeasonQuery(), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => {
      expect(result.current.status).toBe("success");
    });

    expect(result.current.isPending).toBe(false);
    expect(result.current.isError).toBe(false);
    expect(result.current.data).toBeNull();
    expect(result.current.error).toBeNull();
  });
});
