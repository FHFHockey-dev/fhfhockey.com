import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

vi.mock("recharts", () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  LineChart: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Line: () => <div />,
  XAxis: () => <div />,
  YAxis: () => <div />,
  Tooltip: () => <div />,
  Legend: () => <div />,
  CartesianGrid: () => <div />,
  Brush: () => <div />
}));

const routerReplace = vi.fn();

vi.mock("next/router", () => ({
  useRouter: () => ({
    isReady: true,
    query: {
      playerId: "88",
      date: "2026-03-14",
      origin: "forge-dashboard",
      returnTo: "/forge/dashboard?date=2026-03-14&team=NJD&position=f",
      baseline: "career",
      window: "last10",
      view: "l30"
    },
    pathname: "/trends/player/[playerId]",
    replace: routerReplace
  })
}));

vi.mock("lib/supabase", () => {
  const playersQuery = {
    eq: vi.fn(() => ({
      maybeSingle: vi.fn(() =>
        Promise.resolve({
          data: { fullName: "Top Add" },
          error: null
        })
      )
    }))
  };

  const metricsRange = vi.fn(() =>
    Promise.resolve({
      data: [
        {
          game_date: "2026-03-01",
          goals: 1,
          assists: 1,
          points: 2,
          shots: 4,
          goals_avg_career: 0.5,
          assists_avg_career: 0.6,
          points_avg_career: 1.1,
          shots_avg_career: 3.0,
          goals_avg_last10: 0.7,
          assists_avg_last10: 0.8,
          points_avg_last10: 1.5,
          shots_avg_last10: 3.8
        },
        {
          game_date: "2026-03-14",
          goals: 2,
          assists: 1,
          points: 3,
          shots: 5,
          goals_avg_career: 0.5,
          assists_avg_career: 0.6,
          points_avg_career: 1.1,
          shots_avg_career: 3.0,
          goals_avg_last10: 0.9,
          assists_avg_last10: 0.9,
          points_avg_last10: 1.8,
          shots_avg_last10: 4.1
        }
      ],
      error: null
    })
  );

  const metricsOrder = vi.fn(() => ({
    range: metricsRange
  }));

  const metricsStrength = vi.fn(() => ({
    order: metricsOrder
  }));

  const metricsPlayer = vi.fn(() => ({
    eq: metricsStrength
  }));

  return {
    default: {
      from: vi.fn((table: string) => {
        if (table === "players") {
          return {
            select: vi.fn(() => playersQuery)
          };
        }

        if (table === "rolling_player_game_metrics") {
          return {
            select: vi.fn(() => ({
              eq: metricsPlayer
            }))
          };
        }

        throw new Error(`Unexpected table: ${table}`);
      })
    }
  };
});

import PlayerTrendPage from "../../../../pages/trends/player/[playerId]";

describe("Trends player detail page", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    routerReplace.mockReset();
  });

  afterEach(() => {
    cleanup();
  });

  it("preserves FORGE dashboard return context when opened from player insight cards", async () => {
    render(<PlayerTrendPage />);

    expect(await screen.findByText("Top Add")).toBeTruthy();
    expect(screen.getByText("FORGE Dashboard Handoff")).toBeTruthy();
    expect(
      screen.getByText("Context date 2026-03-14 preserved for dashboard return.")
    ).toBeTruthy();
    expect(
      screen.getByRole("link", { name: "Back to FORGE Dashboard" }).getAttribute("href")
    ).toBe("/forge/dashboard?date=2026-03-14&team=NJD&position=f");
    expect(screen.getByText("Recent comparison toolkit")).toBeTruthy();
    expect(screen.getByText(/Strong v1 baselines: Season, 3-Year, Career, Cumulative/i)).toBeTruthy();
    expect(screen.getByRole("button", { name: "L30" })).toBeTruthy();
    expect(screen.getByText(/Baseline 0\.50/)).toBeTruthy();
    expect(routerReplace).not.toHaveBeenCalled();
  });
});
