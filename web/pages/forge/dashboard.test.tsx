import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

import { clearClientFetchCache } from "lib/dashboard/clientFetchCache";

vi.mock("next/head", () => ({
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>
}));

import ForgeDashboardPage from "./dashboard";

function jsonResponse(data: unknown, ok = true, status = ok ? 200 : 500): Response {
  return {
    ok,
    status,
    json: async () => data
  } as Response;
}

describe("Forge dashboard render states", () => {
  beforeEach(() => {
    clearClientFetchCache();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it("renders loading states while module fetches are in flight", async () => {
    const pendingFetch = vi.fn(
      () => new Promise<Response>(() => undefined)
    );
    vi.stubGlobal("fetch", pendingFetch);

    render(<ForgeDashboardPage />);

    expect(await screen.findByText("Loading team power...")).toBeTruthy();
    expect(screen.getByText("Loading sustainability signals...")).toBeTruthy();
    expect(screen.getByText("Loading goalie projections...")).toBeTruthy();
    expect(screen.getByText("Loading game slate...")).toBeTruthy();
  });

  it("renders empty states when endpoints return no usable rows", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/api/team-ratings")) {
        return jsonResponse([]);
      }
      if (url.includes("/api/v1/sustainability/trends")) {
        return jsonResponse({ snapshot_date: "2026-02-07", rows: [] });
      }
      if (url.includes("/api/v1/forge/goalies")) {
        return jsonResponse({ asOfDate: "2026-02-07", data: [] });
      }
      if (url.includes("/api/v1/trends/team-ctpi")) {
        return jsonResponse({ generatedAt: "2026-02-07T12:00:00.000Z", teams: [] });
      }
      if (url.includes("/api/v1/start-chart")) {
        return jsonResponse({ dateUsed: "2026-02-07", games: [] });
      }
      if (url.includes("/api/v1/trends/skater-power")) {
        return jsonResponse({
          generatedAt: "2026-02-07T12:00:00.000Z",
          categories: { all: { rankings: [] } },
          playerMetadata: {}
        });
      }
      return jsonResponse({}, false);
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<ForgeDashboardPage />);

    await waitFor(() => {
      expect(screen.getByText("No team power data for this date.")).toBeTruthy();
      expect(
        screen.getByText("No sustainability signals available for this date.")
      ).toBeTruthy();
      expect(
        screen.getByText("No goalie projections for this filter/date.")
      ).toBeTruthy();
      expect(screen.getByText("No trend streak data available.")).toBeTruthy();
      expect(screen.getByText("No games match this filter/date.")).toBeTruthy();
      expect(screen.getByText("No mover data available.")).toBeTruthy();
    });
  });

  it("renders error states when endpoints fail", async () => {
    const fetchMock = vi.fn(async () => jsonResponse({}, false, 500));
    vi.stubGlobal("fetch", fetchMock);

    render(<ForgeDashboardPage />);

    await waitFor(() => {
      const allErrors = screen.getAllByText(/Error: Request failed \(500\)/i);
      expect(allErrors.length).toBeGreaterThanOrEqual(6);
    });
  });

  it("renders partial-data view when only some modules have results", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/api/team-ratings")) {
        return jsonResponse([
          {
            teamAbbr: "NJD",
            date: "2026-02-07",
            offRating: 82.1,
            defRating: 79.2,
            paceRating: 80.4,
            ppTier: 1,
            pkTier: 2,
            trend10: 1.3
          }
        ]);
      }
      if (url.includes("/api/v1/sustainability/trends")) {
        return jsonResponse({ snapshot_date: "2026-02-07", rows: [] });
      }
      if (url.includes("/api/v1/forge/goalies")) {
        return jsonResponse({
          asOfDate: "2026-02-07",
          data: [
            {
              goalie_id: 8474593,
              goalie_name: "Jacob Markstrom",
              team_abbreviation: "NJD",
              team_name: "New Jersey Devils",
              opponent_team_abbreviation: "NYI",
              opponent_team_name: "New York Islanders",
              starter_probability: 0.61,
              proj_win_prob: 0.53,
              proj_shutout_prob: 0.05,
              volatility_index: 1.18,
              blowup_risk: 0.22
            }
          ]
        });
      }
      if (url.includes("/api/v1/trends/team-ctpi")) {
        return jsonResponse({
          generatedAt: "2026-02-07T12:00:00.000Z",
          teams: [
            {
              team: "NJD",
              ctpi_0_to_100: 64,
              offense: 67,
              defense: 61,
              luck: 54,
              sparkSeries: [
                { date: "2026-02-01", value: 60 },
                { date: "2026-02-07", value: 64 }
              ]
            }
          ]
        });
      }
      if (url.includes("/api/v1/start-chart")) {
        return jsonResponse({ dateUsed: "2026-02-07", games: [] });
      }
      if (url.includes("/api/v1/trends/skater-power")) {
        return jsonResponse({}, false, 500);
      }
      return jsonResponse({}, false);
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<ForgeDashboardPage />);

    await waitFor(() => {
      expect(screen.getByTitle("New Jersey Devils")).toBeTruthy();
      expect(screen.getByText("Jacob Markstrom")).toBeTruthy();
      expect(
        screen.getByText("No sustainability signals available for this date.")
      ).toBeTruthy();
      expect(screen.getByText("No games match this filter/date.")).toBeTruthy();
      expect(screen.getByText(/Error: Request failed \(500\)/i)).toBeTruthy();
    });
  });

  it("updates team-filtered modules when global team selection changes", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/api/team-ratings")) {
        return jsonResponse([
          {
            teamAbbr: "ANA",
            date: "2026-02-07",
            offRating: 70.1,
            defRating: 69.8,
            paceRating: 71.2,
            ppTier: 2,
            pkTier: 2,
            trend10: -0.2
          },
          {
            teamAbbr: "NJD",
            date: "2026-02-07",
            offRating: 82.1,
            defRating: 79.2,
            paceRating: 80.4,
            ppTier: 1,
            pkTier: 2,
            trend10: 1.3
          }
        ]);
      }
      if (url.includes("/api/v1/sustainability/trends")) {
        return jsonResponse({ snapshot_date: "2026-02-07", rows: [] });
      }
      if (url.includes("/api/v1/forge/goalies")) {
        return jsonResponse({
          asOfDate: "2026-02-07",
          data: [
            {
              goalie_id: 8474593,
              goalie_name: "Jacob Markstrom",
              team_abbreviation: "NJD",
              team_name: "New Jersey Devils",
              opponent_team_abbreviation: "NYI",
              opponent_team_name: "New York Islanders",
              starter_probability: 0.61,
              proj_win_prob: 0.53,
              proj_shutout_prob: 0.05,
              volatility_index: 1.18,
              blowup_risk: 0.22
            },
            {
              goalie_id: 8476452,
              goalie_name: "John Gibson",
              team_abbreviation: "ANA",
              team_name: "Anaheim Ducks",
              opponent_team_abbreviation: "LAK",
              opponent_team_name: "Los Angeles Kings",
              starter_probability: 0.59,
              proj_win_prob: 0.45,
              proj_shutout_prob: 0.03,
              volatility_index: 1.31,
              blowup_risk: 0.31
            }
          ]
        });
      }
      if (url.includes("/api/v1/trends/team-ctpi")) {
        return jsonResponse({
          generatedAt: "2026-02-07T12:00:00.000Z",
          teams: [
            {
              team: "NJD",
              ctpi_0_to_100: 64,
              offense: 67,
              defense: 61,
              luck: 54,
              sparkSeries: [
                { date: "2026-02-01", value: 60 },
                { date: "2026-02-07", value: 64 }
              ]
            },
            {
              team: "ANA",
              ctpi_0_to_100: 48,
              offense: 45,
              defense: 50,
              luck: 49,
              sparkSeries: [
                { date: "2026-02-01", value: 51 },
                { date: "2026-02-07", value: 48 }
              ]
            }
          ]
        });
      }
      if (url.includes("/api/v1/start-chart")) {
        return jsonResponse({
          dateUsed: "2026-02-07",
          games: [
            {
              id: 1,
              homeTeamId: 1,
              awayTeamId: 2,
              homeGoalies: [{ player_id: 1, name: "Jacob Markstrom", start_probability: 0.61 }],
              awayGoalies: [{ player_id: 2, name: "Ilya Sorokin", start_probability: 0.7 }]
            },
            {
              id: 2,
              homeTeamId: 3,
              awayTeamId: 4,
              homeGoalies: [{ player_id: 3, name: "John Gibson", start_probability: 0.59 }],
              awayGoalies: [{ player_id: 4, name: "Cam Talbot", start_probability: 0.64 }]
            }
          ]
        });
      }
      if (url.includes("/api/v1/trends/skater-power")) {
        return jsonResponse({
          generatedAt: "2026-02-07T12:00:00.000Z",
          categories: { all: { rankings: [] } },
          playerMetadata: {}
        });
      }
      return jsonResponse({}, false);
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<ForgeDashboardPage />);

    await waitFor(() => {
      expect(screen.getAllByText("Jacob Markstrom").length).toBeGreaterThan(0);
      expect(screen.getAllByText("John Gibson").length).toBeGreaterThan(0);
    });

    fireEvent.change(screen.getByLabelText("Team"), {
      target: { value: "NJD" }
    });

    await waitFor(() => {
      expect(screen.getAllByText("Jacob Markstrom").length).toBeGreaterThan(0);
      expect(screen.queryByText("John Gibson")).toBeNull();
      expect(screen.getByTitle("New Jersey Devils")).toBeTruthy();
      expect(screen.queryByTitle("Anaheim Ducks")).toBeNull();
    });
  });

  it("re-fetches date-scoped modules and remaps position-scoped modules when filters change", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/api/team-ratings")) {
        return jsonResponse([
          {
            teamAbbr: "NJD",
            date: "2026-02-07",
            offRating: 82.1,
            defRating: 79.2,
            paceRating: 80.4,
            ppTier: 1,
            pkTier: 2,
            trend10: 1.3
          }
        ]);
      }
      if (url.includes("/api/v1/sustainability/trends")) {
        return jsonResponse({ snapshot_date: "2026-02-07", rows: [] });
      }
      if (url.includes("/api/v1/forge/goalies")) {
        return jsonResponse({ asOfDate: "2026-02-07", data: [] });
      }
      if (url.includes("/api/v1/start-chart")) {
        return jsonResponse({ dateUsed: "2026-02-07", games: [] });
      }
      if (url.includes("/api/v1/trends/team-ctpi")) {
        return jsonResponse({ generatedAt: "2026-02-07T12:00:00.000Z", teams: [] });
      }
      if (url.includes("/api/v1/trends/skater-power")) {
        return jsonResponse({
          generatedAt: "2026-02-07T12:00:00.000Z",
          categories: { all: { rankings: [] } },
          playerMetadata: {}
        });
      }
      return jsonResponse({}, false);
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<ForgeDashboardPage />);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalled();
    });

    fireEvent.change(screen.getByLabelText("Date"), {
      target: { value: "2026-02-07" }
    });
    fireEvent.change(screen.getByLabelText("Position"), {
      target: { value: "f" }
    });

    await waitFor(() => {
      const urls = fetchMock.mock.calls.map(([input]) => String(input));
      expect(urls.some((u) => u.includes("/api/team-ratings?date=2026-02-07"))).toBe(true);
      expect(
        urls.some((u) =>
          u.includes("/api/v1/sustainability/trends?") &&
          u.includes("snapshot_date=2026-02-07") &&
          u.includes("pos=F")
        )
      ).toBe(true);
      expect(
        urls.some((u) =>
          u.includes("/api/v1/trends/skater-power?") && u.includes("position=forward")
        )
      ).toBe(true);
      expect(urls.some((u) => u.includes("/api/v1/forge/goalies?date=2026-02-07"))).toBe(true);
      expect(urls.some((u) => u.includes("/api/v1/start-chart?date=2026-02-07"))).toBe(true);
    });
  });

  it("supports top-16 and bottom-16 team power views", async () => {
    const teamRows = Array.from({ length: 32 }, (_, index) => ({
      teamAbbr: `T${String(index + 1).padStart(2, "0")}`,
      date: "2026-02-07",
      offRating: 132 - index,
      defRating: 120 - index * 0.5,
      paceRating: 110 - index * 0.25,
      ppTier: 2,
      pkTier: 2,
      trend10: index % 3 === 0 ? 1.2 : -0.4,
      finishingRating: 100 - index * 0.2,
      goalieRating: 98 - index * 0.2,
      varianceFlag: index % 2
    }));

    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/api/team-ratings")) return jsonResponse(teamRows);
      if (url.includes("/api/v1/sustainability/trends")) {
        return jsonResponse({ snapshot_date: "2026-02-07", rows: [] });
      }
      if (url.includes("/api/v1/forge/goalies")) {
        return jsonResponse({ asOfDate: "2026-02-07", data: [] });
      }
      if (url.includes("/api/v1/start-chart")) {
        return jsonResponse({ dateUsed: "2026-02-07", games: [] });
      }
      if (url.includes("/api/v1/trends/team-ctpi")) {
        return jsonResponse({ generatedAt: "2026-02-07T12:00:00.000Z", teams: [] });
      }
      if (url.includes("/api/v1/trends/skater-power")) {
        return jsonResponse({
          generatedAt: "2026-02-07T12:00:00.000Z",
          categories: { all: { rankings: [] } },
          playerMetadata: {}
        });
      }
      return jsonResponse({}, false);
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<ForgeDashboardPage />);

    expect(await screen.findByRole("button", { name: "Top 16" })).toBeTruthy();
    expect(screen.getByText("T01")).toBeTruthy();
    expect(screen.queryByText("T32")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Bottom 16" }));

    await waitFor(() => {
      expect(screen.getByText("T32")).toBeTruthy();
      expect(screen.queryByText("T01")).toBeNull();
    });
  });

  it("renders stale sustainability fallback when latest available snapshot is older than selected date", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/api/team-ratings")) {
        return jsonResponse([]);
      }
      if (url.includes("/api/v1/sustainability/trends")) {
        return jsonResponse({
          requested_snapshot_date: "2026-02-07",
          snapshot_date: "2025-10-14",
          rows: [
            {
              player_id: 1,
              player_name: "Test Skater",
              position_group: "F",
              position_code: "C",
              window_code: "l10",
              s_100: 61.2,
              luck_pressure: -1.22
            }
          ]
        });
      }
      if (url.includes("/api/v1/forge/goalies")) {
        return jsonResponse({ asOfDate: "2026-02-07", data: [] });
      }
      if (url.includes("/api/v1/start-chart")) {
        return jsonResponse({ dateUsed: "2026-02-07", games: [] });
      }
      if (url.includes("/api/v1/trends/team-ctpi")) {
        return jsonResponse({ generatedAt: "2026-02-07T12:00:00.000Z", teams: [] });
      }
      if (url.includes("/api/v1/trends/skater-power")) {
        return jsonResponse({
          generatedAt: "2026-02-07T12:00:00.000Z",
          categories: { all: { rankings: [] } },
          playerMetadata: {}
        });
      }
      return jsonResponse({}, false);
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<ForgeDashboardPage />);

    expect((await screen.findAllByText("Test Skater")).length).toBeGreaterThan(0);
    expect(screen.getByText("Showing nearest available snapshot (2025-10-14).")).toBeTruthy();
  });
});
