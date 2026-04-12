import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { RawStatsCollection } from "components/WiGO/types";
import PlayerRatingsDisplay from "./PlayerRatingsDisplay";

const mockFetchRawStatsForAllStrengths = vi.hoisted(() => vi.fn());

vi.mock("utils/fetchWigoRatingStats", () => ({
  fetchRawStatsForAllStrengths: mockFetchRawStatsForAllStrengths
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

describe("PlayerRatingsDisplay", () => {
  beforeEach(() => {
    mockFetchRawStatsForAllStrengths.mockReset();
  });

  it("renders ratings for a low-gp forward instead of dropping them from the cohort", async () => {
    const rawStats: RawStatsCollection = {
      as: {
        offense: [
          { player_id: 91, season: 20242025, gp: 5, toi_seconds: 500, total_points_per_60: 4 },
          { player_id: 2, season: 20242025, gp: 12, toi_seconds: 800, total_points_per_60: 2 },
          { player_id: 3, season: 20242025, gp: 15, toi_seconds: 900, total_points_per_60: 1 }
        ],
        defense: [
          { player_id: 91, season: 20242025, gp: 5, toi_seconds: 500, xga_per_60: 1 },
          { player_id: 2, season: 20242025, gp: 12, toi_seconds: 800, xga_per_60: 2 },
          { player_id: 3, season: 20242025, gp: 15, toi_seconds: 900, xga_per_60: 3 }
        ]
      },
      es: {
        offense: [
          { player_id: 91, season: 20242025, gp: 5, toi_seconds: 500, total_points_per_60: 4 },
          { player_id: 2, season: 20242025, gp: 12, toi_seconds: 800, total_points_per_60: 2 },
          { player_id: 3, season: 20242025, gp: 15, toi_seconds: 900, total_points_per_60: 1 }
        ],
        defense: [
          { player_id: 91, season: 20242025, gp: 5, toi_seconds: 500, xga_per_60: 1 },
          { player_id: 2, season: 20242025, gp: 12, toi_seconds: 800, xga_per_60: 2 },
          { player_id: 3, season: 20242025, gp: 15, toi_seconds: 900, xga_per_60: 3 }
        ]
      },
      pp: {
        offense: [
          { player_id: 91, season: 20242025, gp: 2, toi_seconds: 100, gf_per_60: 8 },
          { player_id: 2, season: 20242025, gp: 10, toi_seconds: 50, gf_per_60: 4 }
        ],
        defense: []
      },
      pk: {
        offense: [],
        defense: [
          { player_id: 91, season: 20242025, gp: 1, toi_seconds: 50, ga_per_60: 1 },
          { player_id: 2, season: 20242025, gp: 10, toi_seconds: 50, ga_per_60: 2 }
        ]
      }
    };

    mockFetchRawStatsForAllStrengths.mockResolvedValue(rawStats);

    renderWithClient(
      <PlayerRatingsDisplay
        playerId={91}
        seasonId={20242025}
        minGp={10}
      />
    );

    await waitFor(() => {
      expect(screen.getByText("Offense")).toBeTruthy();
    });

    expect(screen.getAllByText("58.3").length).toBeGreaterThan(0);
    expect(screen.getByText("35.0")).toBeTruthy();
  });

  it("keeps rendering a defense-first player when power-play offense data is missing", async () => {
    const rawStats: RawStatsCollection = {
      as: {
        offense: [
          { player_id: 44, season: 20242025, gp: 22, toi_seconds: 1200, total_points_per_60: 1.4 },
          { player_id: 7, season: 20242025, gp: 22, toi_seconds: 1000, total_points_per_60: 2.8 }
        ],
        defense: [
          { player_id: 44, season: 20242025, gp: 22, toi_seconds: 1200, xga_per_60: 1.1 },
          { player_id: 7, season: 20242025, gp: 22, toi_seconds: 1000, xga_per_60: 2.2 }
        ]
      },
      es: {
        offense: [
          { player_id: 44, season: 20242025, gp: 22, toi_seconds: 1100, total_points_per_60: 1.1 },
          { player_id: 7, season: 20242025, gp: 22, toi_seconds: 1000, total_points_per_60: 2.1 }
        ],
        defense: [
          { player_id: 44, season: 20242025, gp: 22, toi_seconds: 1100, xga_per_60: 0.9 },
          { player_id: 7, season: 20242025, gp: 22, toi_seconds: 1000, xga_per_60: 1.9 }
        ]
      },
      pp: {
        offense: [
          { player_id: 7, season: 20242025, gp: 20, toi_seconds: 400, gf_per_60: 6 }
        ],
        defense: []
      },
      pk: {
        offense: [],
        defense: [
          { player_id: 44, season: 20242025, gp: 20, toi_seconds: 500, ga_per_60: 1.2 },
          { player_id: 7, season: 20242025, gp: 20, toi_seconds: 300, ga_per_60: 2.4 }
        ]
      }
    };

    mockFetchRawStatsForAllStrengths.mockResolvedValue(rawStats);

    renderWithClient(
      <PlayerRatingsDisplay
        playerId={44}
        seasonId={20242025}
        minGp={10}
      />
    );

    await waitFor(() => {
      expect(screen.getByText("Defense")).toBeTruthy();
    });

    const offenseSection = screen.getByText("Offense").closest("div");
    expect(offenseSection).toBeTruthy();
    expect(
      within(offenseSection as HTMLElement).queryByText(
        "No rating data available for this player/season."
      )
    ).toBeNull();
    expect(screen.getAllByText("58.3").length).toBeGreaterThan(0);
  });
});
