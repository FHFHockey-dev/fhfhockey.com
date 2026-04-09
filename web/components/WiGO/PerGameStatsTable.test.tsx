import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import PerGameStatsTable from "./PerGameStatsTable";

const mockFetchPlayerPerGameTotals = vi.hoisted(() => vi.fn());

vi.mock("utils/fetchWigoPlayerStats", () => ({
  fetchPlayerPerGameTotals: mockFetchPlayerPerGameTotals
}));

function renderWithClient(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false
      }
    }
  });

  return render(
    <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>
  );
}

describe("PerGameStatsTable", () => {
  beforeEach(() => {
    mockFetchPlayerPerGameTotals.mockReset();
  });

  it("keeps shooting percentage aligned with the canonical WiGO formatter", async () => {
    mockFetchPlayerPerGameTotals.mockResolvedValue({
      player_id: 1,
      games_played: 10,
      goals: 5,
      assists: 7,
      points: 12,
      shots: 40,
      shooting_percentage: 12.5,
      pp_points: 4,
      hits: 8,
      blocked_shots: 6,
      penalty_minutes: 2,
      season: "20242025",
      toi_per_game: 900,
      points_per_game: 1.2,
      pp_toi_pct_per_game: 35
    });

    renderWithClient(<PerGameStatsTable playerId={1} seasonId={20242025} />);

    await waitFor(() => {
      expect(screen.getByText("12.5%")).toBeTruthy();
    });
  });
});
