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
      teamId: "NJD",
      date: "2026-03-14"
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
      },
      {
        id: 2,
        gameDate: "2026-03-17",
        homeTeam: { abbrev: "BOS" },
        awayTeam: { abbrev: "NJD" }
      }
    ],
    loading: false,
    error: null,
    record: {
      wins: 40,
      losses: 23,
      otLosses: 5,
      points: 85
    }
  })
}));

import ForgeTeamDetailPage from "../../../../pages/forge/team/[teamId]";

function jsonResponse(data: unknown, ok = true, status = ok ? 200 : 500): Response {
  return {
    ok,
    status,
    json: async () => data
  } as Response;
}

describe("FORGE team detail page", () => {
  beforeEach(() => {
    clearClientFetchCache();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it("renders team power, schedule, and drill-in links", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/api/team-ratings")) {
        return jsonResponse([
          {
            teamAbbr: "NJD",
            date: "2026-03-14",
            offRating: 84,
            defRating: 81,
            paceRating: 80,
            ppTier: 1,
            pkTier: 2,
            trend10: 1.8
          }
        ]);
      }
      if (url.includes("/api/v1/trends/team-ctpi")) {
        return jsonResponse({
          teams: [
            {
              team: "NJD",
              ctpi_0_to_100: 67,
              sparkSeries: [
                { date: "2026-03-10", value: 62 },
                { date: "2026-03-14", value: 67 }
              ]
            }
          ]
        });
      }
      if (url.includes("/api/v1/start-chart")) {
        return jsonResponse({
          dateUsed: "2026-03-14",
          games: [
            {
              id: 1,
              date: "2026-03-14",
              homeTeamId: 1,
              awayTeamId: 2,
              homeRating: { offRating: 84, defRating: 81, paceRating: 80, ppTier: 1, pkTier: 2 },
              awayRating: { offRating: 79, defRating: 77, paceRating: 78, ppTier: 2, pkTier: 2 }
            }
          ]
        });
      }
      return jsonResponse({}, false);
    });

    vi.stubGlobal("fetch", fetchMock);

    render(<ForgeTeamDetailPage />);

    expect(await screen.findByText("Current Team Context")).toBeTruthy();
    expect(screen.getByText("Upcoming Games and Record")).toBeTruthy();
    expect(screen.getByText("40-23-5")).toBeTruthy();
    expect(screen.getAllByText("vs NYI").length).toBeGreaterThan(0);
    expect(
      screen
        .getAllByRole("link", { name: "Dashboard" })
        .some(
          (link) =>
            link.getAttribute("href") === "/forge/dashboard?date=2026-03-14&team=NJD"
        )
    ).toBe(true);
    expect(
      screen
        .getAllByRole("link", { name: "Start Chart" })
        .some(
          (link) =>
            link.getAttribute("href") === "/start-chart?date=2026-03-14&team=NJD"
        )
    ).toBe(true);
    expect(
      screen
        .getAllByRole("link", { name: "Trends" })
        .some(
          (link) => link.getAttribute("href") === "/trends?date=2026-03-14&team=NJD"
        )
    ).toBe(true);
    expect(screen.getByRole("link", { name: "FORGE Landing" }).getAttribute("href")).toBe(
      "/FORGE?date=2026-03-14&team=NJD"
    );
    expect(screen.getByRole("link", { name: "Underlying Stats" })).toBeTruthy();
  });

  it("degrades locally when team context is stale or a supporting feed is unavailable", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/api/team-ratings")) {
        return jsonResponse([
          {
            teamAbbr: "NJD",
            date: "2026-03-12",
            offRating: 84,
            defRating: 81,
            paceRating: 80,
            ppTier: 1,
            pkTier: 2,
            trend10: 1.8
          }
        ]);
      }
      if (url.includes("/api/v1/trends/team-ctpi")) {
        return jsonResponse({}, false, 500);
      }
      if (url.includes("/api/v1/start-chart")) {
        return jsonResponse({ dateUsed: "2026-03-14", games: [] });
      }
      return jsonResponse({}, false);
    });

    vi.stubGlobal("fetch", fetchMock);

    render(<ForgeTeamDetailPage />);

    expect(await screen.findByText("Using latest available team ratings from 2026-03-12.")).toBeTruthy();
    expect(screen.getByText("CTPI unavailable for this date.")).toBeTruthy();
    expect(screen.getByText("Matchup edge unavailable for this date.")).toBeTruthy();
    expect(screen.getAllByText("Upcoming Games and Record").length).toBeGreaterThan(0);
  });
});
