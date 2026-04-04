import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

vi.mock("next/router", () => ({
  useRouter: () => ({
    isReady: true,
    query: {
      playerId: "88",
      date: "2026-03-14",
      origin: "forge-dashboard",
      returnTo: "/forge/dashboard?date=2026-03-14&team=NJD&position=f"
    }
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
      data: [],
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
  });
});
