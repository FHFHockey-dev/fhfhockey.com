import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";

import { clearClientFetchCache } from "lib/dashboard/clientFetchCache";

vi.mock("next/head", () => ({
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>
}));

import FORGEPage from "../../pages/FORGE";

function jsonResponse(data: unknown, ok = true, status = ok ? 200 : 500): Response {
  return {
    ok,
    status,
    json: async () => data
  } as Response;
}

describe("FORGE landing page", () => {
  beforeEach(() => {
    clearClientFetchCache();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it("renders slate, top adds, and sustainability previews with drill-in links", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/api/v1/start-chart")) {
        return jsonResponse({
          dateUsed: "2026-03-14",
          games: [
            {
              id: 1,
              date: "2026-03-14",
              awayTeamId: 1,
              homeTeamId: 2,
              awayGoalies: [{ player_id: 10, name: "Away Goalie", start_probability: 0.64 }],
              homeGoalies: [{ player_id: 11, name: "Home Goalie", start_probability: 0.71 }]
            }
          ]
        });
      }
      if (url.includes("/api/v1/forge/players")) {
        return jsonResponse({
          asOfDate: "2026-03-14",
          data: [
            {
              player_id: 88,
              player_name: "Top Add",
              team_name: "New Jersey Devils",
              position: "C",
              pts: 2.6,
              ppp: 0.8,
              sog: 3.4,
              hit: 0.6,
              blk: 0.2,
              uncertainty: 0.3
            }
          ]
        });
      }
      if (url.includes("/api/v1/transactions/ownership-trends")) {
        return jsonResponse({
          success: true,
          risers: [
            {
              playerId: 88,
              name: "Top Add",
              latest: 41,
              delta: 6,
              teamAbbrev: "NJD"
            }
          ],
          fallers: []
        });
      }
      if (url.includes("direction=cold")) {
        return jsonResponse({
          snapshot_date: "2026-03-14",
          rows: [
            {
              player_id: 101,
              player_name: "Trustworthy Skater",
              s_100: 67.2,
              luck_pressure: -1.2
            }
          ]
        });
      }
      if (url.includes("direction=hot")) {
        return jsonResponse({
          snapshot_date: "2026-03-14",
          rows: [
            {
              player_id: 202,
              player_name: "Overheated Skater",
              s_100: 38.8,
              luck_pressure: 1.5
            }
          ]
        });
      }
      return jsonResponse({}, false);
    });

    vi.stubGlobal("fetch", fetchMock);

    render(<FORGEPage />);

    expect(await screen.findByText("Slate Preview")).toBeTruthy();
    expect(screen.getByText("Top Player Adds")).toBeTruthy();
    expect(screen.getByText("Sustainability Preview")).toBeTruthy();
    expect(screen.getByText("Top Add")).toBeTruthy();
    expect(screen.getByText("Trustworthy Skater")).toBeTruthy();
    expect(screen.getByText("Overheated Skater")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Open Full Dashboard" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Dashboard" }).getAttribute("href")).toBe(
      "/forge/dashboard"
    );
    expect(screen.getByRole("link", { name: "Start Chart" }).getAttribute("href")).toBe(
      "/start-chart"
    );
    expect(screen.getByRole("link", { name: "Trends" }).getAttribute("href")).toBe(
      "/trends"
    );
    expect(screen.getByRole("link", { name: "Open Start Chart" }).getAttribute("href")).toBe(
      "/start-chart"
    );
  });

  it("shows an error state when preview fetches fail", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse({}, false, 500)));

    render(<FORGEPage />);

    await waitFor(() => {
      expect(
        screen.getByText("Error: FORGE previews are temporarily unavailable.")
      ).toBeTruthy();
    });
  });

  it("keeps preview panels usable when one feed is stale or another fails", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/api/v1/start-chart")) {
        return jsonResponse({
          dateUsed: "2026-03-12",
          games: [
            {
              id: 1,
              date: "2026-03-12",
              awayTeamId: 1,
              homeTeamId: 2,
              awayGoalies: [{ player_id: 10, name: "Away Goalie", start_probability: 0.64 }],
              homeGoalies: [{ player_id: 11, name: "Home Goalie", start_probability: 0.71 }]
            }
          ]
        });
      }
      if (url.includes("/api/v1/forge/players")) {
        return jsonResponse({
          asOfDate: "2026-03-12",
          data: [
            {
              player_id: 88,
              player_name: "Top Add",
              team_name: "New Jersey Devils",
              position: "C",
              pts: 2.6,
              ppp: 0.8,
              sog: 3.4,
              hit: 0.6,
              blk: 0.2,
              uncertainty: 0.3
            }
          ]
        });
      }
      if (url.includes("/api/v1/transactions/ownership-trends")) {
        return jsonResponse({}, false, 500);
      }
      if (url.includes("direction=cold")) {
        return jsonResponse({
          snapshot_date: "2026-03-12",
          rows: [
            {
              player_id: 101,
              player_name: "Trustworthy Skater",
              s_100: 67.2,
              luck_pressure: -1.2
            }
          ]
        });
      }
      if (url.includes("direction=hot")) {
        return jsonResponse({
          snapshot_date: "2026-03-12",
          rows: [
            {
              player_id: 202,
              player_name: "Overheated Skater",
              s_100: 38.8,
              luck_pressure: 1.5
            }
          ]
        });
      }
      return jsonResponse({}, false);
    });

    vi.stubGlobal("fetch", fetchMock);

    render(<FORGEPage />);

    expect(await screen.findByText("Using latest available slate from 2026-03-12.")).toBeTruthy();
    expect(
      screen.getByText("Top Adds preview unavailable. Open the dashboard for live retry.")
    ).toBeTruthy();
    expect(
      screen.getByText("Using latest available sustainability snapshot from 2026-03-12.")
    ).toBeTruthy();
    expect(screen.getAllByText("Trustworthy Skater").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Overheated Skater").length).toBeGreaterThan(0);
  });
});
