import React from "react";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import usePercentileRank from "./usePercentileRank";

const mockRpc = vi.hoisted(() => vi.fn());
const mockUseCurrentSeason = vi.hoisted(() => vi.fn());

vi.mock("lib/supabase/public-client", () => ({
  default: {
    rpc: mockRpc
  }
}));

vi.mock("./useCurrentSeason", () => ({
  default: mockUseCurrentSeason
}));

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false
      }
    }
  });

  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
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
      regularSeasonEndDate: "2026-04-17"
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
            count: 72
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
            count: 50
          }
        ],
        error: null
      })
    });

    const { result } = renderHook(
      () => usePercentileRank(8476453, "SEASON"),
      { wrapper: createWrapper() }
    );

    await waitFor(() => {
      expect(mockRpc).toHaveBeenCalled();
      expect(result.current.data?.goals).toBeGreaterThan(0);
    });

    expect(mockRpc).toHaveBeenCalledWith("get_skaters_avg_stats", {
      start_date: "2025-10-07",
      end_date: "2026-04-09"
    });
  });

  afterEach(() => {
    dateNowSpy.mockRestore();
  });
});
