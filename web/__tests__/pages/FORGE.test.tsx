import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";

import { clearClientFetchCache } from "lib/dashboard/clientFetchCache";

const routerState = vi.hoisted(() => ({
  query: {},
  isReady: true,
}));

vi.mock("next/head", () => ({
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock("next/router", () => ({
  useRouter: () => routerState,
}));

import FORGEPage from "../../pages/FORGE";

function jsonResponse(
  data: unknown,
  ok = true,
  status = ok ? 200 : 500,
): Response {
  return {
    ok,
    status,
    json: async () => data,
  } as Response;
}

describe("FORGE landing page", () => {
  beforeEach(() => {
    clearClientFetchCache();
    vi.restoreAllMocks();
    routerState.query = { date: "2026-03-14" };
    routerState.isReady = true;
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
              awayGoalies: [
                { player_id: 10, name: "Away Goalie", start_probability: 0.64 },
              ],
              homeGoalies: [
                { player_id: 11, name: "Home Goalie", start_probability: 0.71 },
              ],
            },
          ],
        });
      }
      if (url.includes("/api/v1/forge/players")) {
        return jsonResponse({
          asOfDate: "2026-03-14",
          modelMetadata: {
            modelVersion: "skater-role-scenario-v1",
            scenarioCount: 2,
            calibrationHints: {
              sourceDate: "2026-03-13",
              sampleCount30d: 420,
              pointsMae30d: 1.25,
              pointsIntervalHitRate: 0.81,
            },
          },
          disclosures: [
            "Role, power-play share, matchup, and rest inputs can change after the projection run.",
            "Floor, typical, and ceiling are P10/P50/P90 model outcomes, not guaranteed bounds.",
          ],
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
              uncertainty: 0.3,
              confidenceDrivers: {
                role: { evenStrength: "L1", unitTier: "PP1" },
                powerPlay: { allocatedShare: 0.58 },
                matchup: {
                  opponentGoalieGoalRateMultiplier: 1.03,
                  opponentStarterCertainty: 0.76,
                },
                rest: { teamRestDays: 2, opponentRestDays: 1 },
              },
            },
          ],
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
              teamAbbrev: "NJD",
            },
          ],
          fallers: [],
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
              luck_pressure: -1.2,
            },
          ],
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
              luck_pressure: 1.5,
            },
          ],
        });
      }
      return jsonResponse({}, false);
    });

    vi.stubGlobal("fetch", fetchMock);

    render(<FORGEPage />);

    expect(await screen.findByText("Tonight's Games")).toBeTruthy();
    expect(screen.getByText("Best Waiver Adds")).toBeTruthy();
    expect(screen.getByText("Trust Or Fade")).toBeTruthy();
    expect(screen.getByText("Top Add")).toBeTruthy();
    expect(screen.getByText("Trustworthy Skater")).toBeTruthy();
    expect(screen.getByText("Overheated Skater")).toBeTruthy();
    expect(screen.getByText("Skater Projection Confidence")).toBeTruthy();
    expect(screen.getByText("skater-role-scenario-v1")).toBeTruthy();
    expect(
      screen.getByText(
        /L1\/PP1 • 58% PP share • 76% goalie certainty • 2d rest/,
      ),
    ).toBeTruthy();
    expect(
      screen.getByText(/30-day points sample: 420; MAE 1.25/),
    ).toBeTruthy();
    expect(screen.getByRole("link", { name: "Open Dashboard" })).toBeTruthy();
    expect(
      screen.getByRole("link", { name: "Dashboard" }).getAttribute("href"),
    ).toBe("/forge/dashboard?date=2026-03-14");
    expect(
      screen.getByRole("link", { name: "Goalie Starts" }).getAttribute("href"),
    ).toBe("/start-chart?date=2026-03-14");
    expect(
      screen.getByRole("link", { name: "Player Trends" }).getAttribute("href"),
    ).toBe("/trends?date=2026-03-14");
    expect(
      screen
        .getByRole("link", { name: "See Goalie Starts" })
        .getAttribute("href"),
    ).toBe("/start-chart?date=2026-03-14");
  });

  it("shows unavailable preview states when preview fetches fail", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => jsonResponse({}, false, 500)),
    );

    render(<FORGEPage />);

    await waitFor(() => {
      expect(
        screen.getByText(
          "Game preview unavailable. Open goalie starts for a live retry.",
        ),
      ).toBeTruthy();
      expect(
        screen.getByText(
          "Top Adds preview unavailable. Open the dashboard for live retry.",
        ),
      ).toBeTruthy();
      expect(
        screen.getByText(
          "Trust and fade preview is partial. Open the dashboard for the full view.",
        ),
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
              awayGoalies: [
                { player_id: 10, name: "Away Goalie", start_probability: 0.64 },
              ],
              homeGoalies: [
                { player_id: 11, name: "Home Goalie", start_probability: 0.71 },
              ],
            },
          ],
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
              uncertainty: 0.3,
            },
          ],
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
              luck_pressure: -1.2,
            },
          ],
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
              luck_pressure: 1.5,
            },
          ],
        });
      }
      return jsonResponse({}, false);
    });

    vi.stubGlobal("fetch", fetchMock);

    render(<FORGEPage />);

    expect(
      await screen.findByText("Using latest available slate from 2026-03-12."),
    ).toBeTruthy();
    expect(
      screen.getByText(
        "Top Adds preview unavailable. Open the dashboard for live retry.",
      ),
    ).toBeTruthy();
    expect(
      screen.getByText(
        "Using latest available trust and fade data from 2026-03-12.",
      ),
    ).toBeTruthy();
    expect(screen.getAllByText("Trustworthy Skater").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Overheated Skater").length).toBeGreaterThan(0);
  });

  it("warns when landing previews are backed by materially different dates", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/api/v1/start-chart")) {
        return jsonResponse({ dateUsed: "2026-03-14", games: [] });
      }
      if (url.includes("/api/v1/forge/players")) {
        return jsonResponse({ asOfDate: "2026-03-10", data: [] });
      }
      if (url.includes("/api/v1/transactions/ownership-trends")) {
        return jsonResponse({ success: true, risers: [], fallers: [] });
      }
      if (url.includes("/api/v1/sustainability/trends")) {
        return jsonResponse({ snapshot_date: "2026-03-14", rows: [] });
      }
      return jsonResponse({}, false);
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<FORGEPage />);

    expect(
      await screen.findByText(
        "Dashboard modules are using mixed source dates (2026-03-10 to 2026-03-14, 4 days apart). Review each panel's date before comparing signals."
      )
    ).toBeTruthy();
  });
});
