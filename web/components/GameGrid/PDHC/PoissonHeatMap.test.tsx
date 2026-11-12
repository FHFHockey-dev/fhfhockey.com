import React from "react";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const { fromMock } = vi.hoisted(() => ({ fromMock: vi.fn() }));

vi.mock("lib/supabase/public-client", () => ({ default: { from: fromMock } }));
vi.mock("../contexts/GameGridContext", () => ({ useTeam: () => undefined }));
vi.mock("next/legacy/image", () => ({ default: () => null }));

import PoissonHeatmap from "./PoissonHeatMap";

afterEach(cleanup);

describe("Game Grid matchup probability panel (decision 64, W1 P0 #14)", () => {
  it("shows 'Model odds unavailable' and never reads the placeholder odds", async () => {
    fromMock.mockImplementation(() => ({
      select: () => ({
        eq: () => ({
          single: async () => ({
            data: {
              home_expected_goals: 3.4,
              away_expected_goals: 2.1,
              home_win_odds: 71.2,
              away_win_odds: 28.8,
              home_api_win_odds: null,
              away_api_win_odds: null
            },
            error: null
          })
        })
      })
    }));

    render(<PoissonHeatmap homeTeamId={10} awayTeamId={6} gameId={2025020001} />);

    await waitFor(() => expect(screen.getByRole("status").textContent).toContain("Model odds unavailable"));
    expect(screen.queryByText(/71\.2%/)).toBeNull();
    expect(fromMock).not.toHaveBeenCalled();
  });
});
