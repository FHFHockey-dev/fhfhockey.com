import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

import { clearClientFetchCache } from "lib/dashboard/clientFetchCache";

vi.mock("next/head", () => ({
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>
}));

vi.mock("next/router", () => ({
  useRouter: () => ({
    query: {
      playerId: "88",
      date: "2026-03-14",
      mode: "tonight"
    }
  })
}));

vi.mock("hooks/useTeamSchedule", () => ({
  useTeamSchedule: () => ({
    games: [
      {
        id: 1,
        gameDate: "2026-03-15",
        homeTeam: { abbrev: "NJD" },
        awayTeam: { abbrev: "NYI" }
      }
    ],
    loading: false,
    error: null
  })
}));

import ForgePlayerDetailPage from "../../../../pages/forge/player/[playerId]";

function jsonResponse(data: unknown, ok = true, status = ok ? 200 : 500): Response {
  return {
    ok,
    status,
    json: async () => data
  } as Response;
}

describe("FORGE player detail page", () => {
  beforeEach(() => {
    clearClientFetchCache();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it("renders projection, ownership, and drill-in context for top-add cards", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/api/v1/forge/players")) {
        return jsonResponse({
          asOfDate: "2026-03-14",
          data: [
            {
              player_id: 88,
              player_name: "Top Add",
              team_name: "New Jersey Devils",
              position: "C",
              pts: 2.7,
              ppp: 0.8,
              sog: 3.6,
              hit: 0.4,
              blk: 0.2,
              uncertainty: 0.3
            }
          ]
        });
      }
      if (url.includes("/api/v1/transactions/ownership-snapshots")) {
        return jsonResponse({
          players: [{ playerId: 88, ownership: 42 }]
        });
      }
      if (url.includes("/api/v1/transactions/ownership-trends")) {
        return jsonResponse({
          success: true,
          selectedPlayers: [
            {
              playerId: 88,
              latest: 42,
              delta: 5,
              sparkline: [
                { date: "2026-03-10", value: 37 },
                { date: "2026-03-14", value: 42 }
              ]
            }
          ],
          risers: [],
          fallers: []
        });
      }
      return jsonResponse({}, false);
    });

    vi.stubGlobal("fetch", fetchMock);

    render(<ForgePlayerDetailPage />);

    expect(await screen.findByText("Projection and Ownership")).toBeTruthy();
    expect(screen.getByText("Top Add")).toBeTruthy();
    expect(screen.getByText("Upcoming Schedule")).toBeTruthy();
    expect(screen.getByText("5D +5.0 pts")).toBeTruthy();
    expect(
      screen
        .getAllByRole("link", { name: "Dashboard" })
        .some((link) => link.getAttribute("href") === "/forge/dashboard")
    ).toBe(true);
    expect(
      screen
        .getAllByRole("link", { name: "Start Chart" })
        .some((link) => link.getAttribute("href") === "/start-chart")
    ).toBe(true);
    expect(
      screen
        .getAllByRole("link", { name: "Team Detail" })
        .some((link) => link.getAttribute("href") === "/forge/team/NJD")
    ).toBe(true);
    expect(screen.getByRole("link", { name: "FORGE Landing" }).getAttribute("href")).toBe(
      "/FORGE"
    );
    expect(screen.getByRole("link", { name: "Trends Player Page" })).toBeTruthy();
  });

  it("keeps projection detail visible when ownership context is unavailable", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/api/v1/forge/players")) {
        return jsonResponse({
          asOfDate: "2026-03-12",
          data: [
            {
              player_id: 88,
              player_name: "Top Add",
              team_name: "New Jersey Devils",
              position: "C",
              pts: 2.7,
              ppp: 0.8,
              sog: 3.6,
              hit: 0.4,
              blk: 0.2,
              uncertainty: 0.3
            }
          ]
        });
      }
      if (url.includes("/api/v1/transactions/ownership-snapshots")) {
        return jsonResponse({}, false, 500);
      }
      if (url.includes("/api/v1/transactions/ownership-trends")) {
        return jsonResponse({}, false, 500);
      }
      return jsonResponse({}, false);
    });

    vi.stubGlobal("fetch", fetchMock);

    render(<ForgePlayerDetailPage />);

    expect(await screen.findByText("Using latest available projections from 2026-03-12.")).toBeTruthy();
    expect(screen.getByText("Ownership context unavailable for this player.")).toBeTruthy();
    expect(screen.getAllByText("Projection and Ownership").length).toBeGreaterThan(0);
    expect(screen.getByText("Top Add")).toBeTruthy();
  });
});
