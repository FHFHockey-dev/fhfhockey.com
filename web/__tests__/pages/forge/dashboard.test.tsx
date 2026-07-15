import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";

import { clearClientFetchCache } from "lib/dashboard/clientFetchCache";

const routerState = vi.hoisted(() => ({
  query: {},
  isReady: true
}));

vi.mock("next/head", () => ({
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>
}));

vi.mock("next/router", () => ({
  useRouter: () => routerState
}));

vi.mock("components/GameGrid/utils/useSchedule", () => ({
  default: () => [
    [
      {
        teamId: 1,
        MON: {
          id: 1,
          season: 20252026,
          gameType: 2,
          homeTeam: { id: 1 },
          awayTeam: { id: 2 }
        },
        WED: {
          id: 2,
          season: 20252026,
          gameType: 2,
          homeTeam: { id: 3 },
          awayTeam: { id: 1 }
        }
      }
    ],
    [7, 10, 6, 9, 8, 11, 5],
    false
  ]
}));

import ForgeDashboardPage from "../../../pages/forge/dashboard";

function jsonResponse(data: unknown, ok = true, status = ok ? 200 : 500): Response {
  return {
    ok,
    status,
    json: async () => data
  } as Response;
}

function emptyForgePlayersResponse(date = "2026-02-07") {
  return {
    asOfDate: date,
    requestedDate: date,
    horizonGames: 1,
    data: []
  };
}

function emptyOwnershipResponse() {
  return {
    success: true,
    windowDays: 5,
    generatedAt: "2026-02-07T12:00:00.000Z",
    risers: [],
    fallers: []
  };
}

function stubMatchMedia(matches = false) {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: vi.fn().mockImplementation(() => ({
      matches,
      media: "(max-width: 767px)",
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn()
    }))
  });
}

describe("Forge dashboard render states", () => {
  beforeEach(() => {
    clearClientFetchCache();
    vi.restoreAllMocks();
    routerState.query = { date: "2026-02-07" };
    routerState.isReady = true;
    stubMatchMedia(false);
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
    expect(screen.getByText("Loading trust calls...")).toBeTruthy();
    expect(screen.getByText("Loading goalie projections...")).toBeTruthy();
    expect(screen.getByText("Loading game slate...")).toBeTruthy();
    expect(screen.getByText("Loading top adds...")).toBeTruthy();
  });

  it("does not mount data modules until the requested route state is applied", async () => {
    const pendingFetch = vi.fn(
      (_input: RequestInfo | URL) => new Promise<Response>(() => undefined)
    );
    vi.stubGlobal("fetch", pendingFetch);
    routerState.query = {};
    routerState.isReady = false;

    const { rerender } = render(<ForgeDashboardPage />);

    expect(screen.getByText("Loading selected dashboard context...")).toBeTruthy();
    expect(pendingFetch).not.toHaveBeenCalled();

    routerState.query = { date: "2026-02-07" };
    routerState.isReady = true;
    rerender(<ForgeDashboardPage />);

    await waitFor(() => expect(pendingFetch).toHaveBeenCalled());
    const dateScopedUrls = pendingFetch.mock.calls
      .map(([input]) => String(input))
      .filter((url) => url.includes("date=") || url.includes("snapshot_date="));
    expect(dateScopedUrls.length).toBeGreaterThan(0);
    expect(
      dateScopedUrls.every((url) => url.includes("2026-02-07"))
    ).toBe(true);
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
      if (url.includes("/api/v1/forge/players")) {
        return jsonResponse(emptyForgePlayersResponse());
      }
      if (url.includes("/api/v1/transactions/ownership-trends")) {
        return jsonResponse(emptyOwnershipResponse());
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
        screen.getByText("No trust or fade calls available for this date.")
      ).toBeTruthy();
      expect(
        screen.getByText("No goalie projections for this filter/date.")
      ).toBeTruthy();
      expect(
        screen.getByText("No player form data available for this filter.")
      ).toBeTruthy();
      expect(screen.getByText("No games match this filter/date.")).toBeTruthy();
      expect(
        screen.getByText("No add candidates for this ownership band yet.")
      ).toBeTruthy();
    });
  });

  it("keeps placeholder goalie rows out of lead start calls", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/api/team-ratings")) return jsonResponse([]);
      if (url.includes("/api/v1/trends/team-ctpi")) {
        return jsonResponse({ generatedAt: "2026-02-07T12:00:00.000Z", teams: [] });
      }
      if (url.includes("/api/v1/start-chart")) {
        return jsonResponse({ dateUsed: "2026-02-07", games: [] });
      }
      if (url.includes("/api/v1/forge/goalies")) {
        return jsonResponse({
          asOfDate: "2026-02-07",
          data: [
            {
              goalie_id: 8470001,
              goalie_name: "Placeholder Goalie",
              team_abbreviation: "NJD",
              opponent_team_abbreviation: "NYI",
              starter_probability: 0.5,
              proj_win_prob: 0.5,
              proj_shutout_prob: 0,
              volatility_index: null,
              blowup_risk: null,
              confidence_tier: null,
              recommendation: null,
              uncertainty: {}
            }
          ]
        });
      }
      if (url.includes("/api/v1/forge/players")) {
        return jsonResponse(emptyForgePlayersResponse());
      }
      if (url.includes("/api/v1/transactions/ownership-trends")) {
        return jsonResponse(emptyOwnershipResponse());
      }
      if (url.includes("/api/v1/sustainability/trends")) {
        return jsonResponse({ snapshot_date: "2026-02-07", rows: [] });
      }
      if (url.includes("/api/v1/trends/skater-power")) {
        return jsonResponse({ categories: { all: { rankings: [] } }, playerMetadata: {} });
      }
      return jsonResponse({}, false);
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<ForgeDashboardPage />);

    expect(
      await screen.findByText(/placeholder 50% starter probability/i)
    ).toBeTruthy();
    expect(screen.getByText("Placeholder Goalie")).toBeTruthy();
    expect(screen.getByText("Context unavailable")).toBeTruthy();
    expect(screen.queryByText("Confidence --")).toBeNull();
  });

  it("warns at page level when module source dates materially diverge", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/api/team-ratings")) return jsonResponse([]);
      if (url.includes("/api/v1/trends/team-ctpi")) {
        return jsonResponse({
          generatedAt: "2026-02-01T23:59:59.999Z",
          dateUsed: "2026-02-01",
          teams: []
        });
      }
      if (url.includes("/api/v1/start-chart")) {
        return jsonResponse({ dateUsed: "2026-02-07", games: [] });
      }
      if (url.includes("/api/v1/forge/goalies")) {
        return jsonResponse({ asOfDate: "2026-02-07", data: [] });
      }
      if (url.includes("/api/v1/forge/players")) {
        return jsonResponse(emptyForgePlayersResponse());
      }
      if (url.includes("/api/v1/transactions/ownership-trends")) {
        return jsonResponse(emptyOwnershipResponse());
      }
      if (url.includes("/api/v1/sustainability/trends")) {
        return jsonResponse({ snapshot_date: "2026-02-07", rows: [] });
      }
      if (url.includes("/api/v1/trends/skater-power")) {
        return jsonResponse({
          generatedAt: "2026-02-07T23:59:59.999Z",
          dateUsed: "2026-02-07",
          categories: { all: { rankings: [] } },
          playerMetadata: {}
        });
      }
      return jsonResponse({}, false);
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<ForgeDashboardPage />);

    expect(
      await screen.findByText(
        "Dashboard modules are using mixed source dates (2026-02-01 to 2026-02-07, 6 days apart). Review each panel's date before comparing signals."
      )
    ).toBeTruthy();
  });

  it("suppresses team form and matchup context when their dates do not align with ratings", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/api/team-ratings")) {
        return jsonResponse([
          {
            teamAbbr: "NJD",
            date: "2026-02-07",
            offRating: 82,
            defRating: 79,
            paceRating: 80,
            ppTier: 1,
            pkTier: 2,
            trend10: 1.2
          }
        ]);
      }
      if (url.includes("/api/v1/trends/team-ctpi")) {
        return jsonResponse({
          generatedAt: "2026-03-29T12:00:00.000Z",
          dateUsed: "2026-03-29",
          teams: [
            {
              team: "NJD",
              ctpi_0_to_100: 88,
              offense: 90,
              defense: 82,
              luck: 70,
              sparkSeries: []
            }
          ]
        });
      }
      if (url.includes("/api/v1/start-chart")) {
        return jsonResponse({ dateUsed: "2026-02-05", games: [] });
      }
      if (url.includes("/api/v1/forge/goalies")) {
        return jsonResponse({ asOfDate: "2026-02-07", data: [] });
      }
      if (url.includes("/api/v1/forge/players")) {
        return jsonResponse(emptyForgePlayersResponse());
      }
      if (url.includes("/api/v1/transactions/ownership-trends")) {
        return jsonResponse(emptyOwnershipResponse());
      }
      if (url.includes("/api/v1/sustainability/trends")) {
        return jsonResponse({ snapshot_date: "2026-02-07", rows: [] });
      }
      if (url.includes("/api/v1/trends/skater-power")) {
        return jsonResponse({ categories: { all: { rankings: [] } }, playerMetadata: {} });
      }
      return jsonResponse({}, false);
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<ForgeDashboardPage />);

    expect(
      await screen.findByText(/Team form from 2026-03-29 suppressed; ratings use 2026-02-07/)
    ).toBeTruthy();
    expect(
      screen.getByText(/Game matchups from 2026-02-05 suppressed; ratings use 2026-02-07/)
    ).toBeTruthy();
    expect(screen.getAllByText("Form --").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Off slate").length).toBeGreaterThan(0);
  });

  it("does not merge Top Adds ownership by matching player name when stable ids differ", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/api/team-ratings")) return jsonResponse([]);
      if (url.includes("/api/v1/sustainability/trends")) {
        return jsonResponse({ snapshot_date: "2026-02-07", rows: [] });
      }
      if (url.includes("/api/v1/forge/goalies")) {
        return jsonResponse({ asOfDate: "2026-02-07", data: [] });
      }
      if (url.includes("/api/v1/trends/team-ctpi")) {
        return jsonResponse({ dateUsed: "2026-02-07", teams: [] });
      }
      if (url.includes("/api/v1/start-chart")) {
        return jsonResponse({ dateUsed: "2026-02-07", games: [] });
      }
      if (url.includes("/api/v1/forge/players")) {
        return jsonResponse({
          asOfDate: "2026-02-07",
          requestedDate: "2026-02-07",
          data: [
            {
              player_id: 100,
              player_name: "Same Name",
              team_name: "NJD",
              position: "C",
              pts: 2,
              ppp: 0,
              sog: 2,
              hit: 0,
              blk: 0,
              uncertainty: 0.2
            }
          ]
        });
      }
      if (url.includes("/api/v1/transactions/ownership-snapshots")) {
        return jsonResponse({ success: true, players: [{ playerId: 100, ownership: null }] });
      }
      if (url.includes("/api/v1/transactions/ownership-trends")) {
        return jsonResponse({
          success: true,
          risers: [{ playerId: 200, name: "Same Name", latest: 40, delta: 5, sparkline: [] }],
          fallers: []
        });
      }
      if (url.includes("/api/v1/trends/skater-power")) {
        return jsonResponse({
          dateUsed: "2026-02-07",
          categories: { all: { rankings: [] } },
          playerMetadata: {}
        });
      }
      return jsonResponse({}, false);
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<ForgeDashboardPage />);

    expect(
      await screen.findByText(
        "Ownership is missing for 1 projected candidates, so they are hidden by this ownership range."
      )
    ).toBeTruthy();
    expect(screen.getByText("No add candidates for this ownership band yet.")).toBeTruthy();
  });

  it("renders error states when endpoints fail", async () => {
    const fetchMock = vi.fn(async () => jsonResponse({}, false, 500));
    vi.stubGlobal("fetch", fetchMock);

    render(<ForgeDashboardPage />);

    await waitFor(() => {
      const allErrors = screen.getAllByText(/Error: Request failed \(500\)/i);
      expect(allErrors.length).toBeGreaterThanOrEqual(5);
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
              modeled_save_pct: 0.918,
              volatility_index: 1.18,
              blowup_risk: 0.22,
              confidence_tier: "HIGH",
              quality_tier: "A",
              reliability_tier: "B",
              recommendation: "Start",
              uncertainty: {
                model: {
                  starter_selection: {
                    model_context: {
                      is_back_to_back: false,
                      opponent_is_weak: true
                    },
                    opponent_offense_context: {
                      context_adjustment_pct: -0.042
                    },
                    candidate_goalies: [
                      {
                        goalie_id: 8474593,
                        days_since_last_played: 2,
                        l10_starts: 7
                      }
                    ]
                  }
                }
              }
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
      if (url.includes("/api/v1/forge/players")) {
        return jsonResponse(emptyForgePlayersResponse());
      }
      if (url.includes("/api/v1/transactions/ownership-trends")) {
        return jsonResponse(emptyOwnershipResponse());
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
      expect(screen.getAllByText("Jacob Markstrom").length).toBeGreaterThan(0);
      expect(screen.getByText("Starter trust")).toBeTruthy();
      expect(screen.getByText("Confidence HIGH")).toBeTruthy();
      expect(screen.getByText("Call Start")).toBeTruthy();
      expect(
        screen.getByText("No trust or fade calls available for this date.")
      ).toBeTruthy();
      expect(screen.getByText("No games match this filter/date.")).toBeTruthy();
      expect(
        screen.getByText("No add candidates for this ownership band yet.")
      ).toBeTruthy();
    });
  });

  it("builds a focused slate hero and switches matchups when a tile is selected", async () => {
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
      if (url.includes("/api/v1/trends/team-ctpi")) {
        return jsonResponse({ generatedAt: "2026-02-07T12:00:00.000Z", teams: [] });
      }
      if (url.includes("/api/v1/start-chart")) {
        return jsonResponse({
          dateUsed: "2026-02-07",
          games: [
            {
              id: 1,
              date: "2026-02-07",
              homeTeamId: 1,
              awayTeamId: 2,
              homeRating: {
                offRating: 82,
                defRating: 79,
                paceRating: 80,
                trend10: 1.2,
                ppTier: 1,
                pkTier: 2
              },
              awayRating: {
                offRating: 76,
                defRating: 74,
                paceRating: 77,
                trend10: -0.4,
                ppTier: 2,
                pkTier: 2
              },
              homeGoalies: [
                {
                  player_id: 1,
                  name: "Jacob Markstrom",
                  start_probability: 0.61,
                  projected_gsaa_per_60: 0.13,
                  confirmed_status: true,
                  percent_ownership: 62
                }
              ],
              awayGoalies: [
                {
                  player_id: 2,
                  name: "Ilya Sorokin",
                  start_probability: 0.7,
                  projected_gsaa_per_60: 0.19,
                  confirmed_status: false,
                  percent_ownership: 93
                }
              ]
            },
            {
              id: 2,
              date: "2026-02-07",
              homeTeamId: 24,
              awayTeamId: 26,
              homeRating: {
                offRating: 71,
                defRating: 69,
                paceRating: 70,
                trend10: -0.9,
                ppTier: 2,
                pkTier: 2
              },
              awayRating: {
                offRating: 83,
                defRating: 81,
                paceRating: 79,
                trend10: 0.8,
                ppTier: 1,
                pkTier: 2
              },
              homeGoalies: [
                {
                  player_id: 3,
                  name: "John Gibson",
                  start_probability: 0.59,
                  projected_gsaa_per_60: -0.04,
                  confirmed_status: false,
                  percent_ownership: 21
                }
              ],
              awayGoalies: [
                {
                  player_id: 4,
                  name: "Cam Talbot",
                  start_probability: 0.64,
                  projected_gsaa_per_60: 0.08,
                  confirmed_status: false,
                  percent_ownership: 18
                }
              ]
            }
          ]
        });
      }
      if (url.includes("/api/v1/forge/players")) {
        return jsonResponse(emptyForgePlayersResponse());
      }
      if (url.includes("/api/v1/transactions/ownership-trends")) {
        return jsonResponse(emptyOwnershipResponse());
      }
      return jsonResponse({}, false);
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<ForgeDashboardPage />);

    expect(await screen.findByText("Focus")).toBeTruthy();
    expect(screen.getAllByText("Jacob Markstrom").length).toBeGreaterThan(0);
    expect(screen.getByText("See Goalie Starts")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /Focus LAK at ANA/i }));

    await waitFor(() => {
      expect(screen.getAllByText("John Gibson").length).toBeGreaterThan(0);
      expect(screen.getAllByText("LAK @ ANA").length).toBeGreaterThan(0);
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
              modeled_save_pct: 0.918,
              volatility_index: 1.18,
              blowup_risk: 0.22,
              confidence_tier: "HIGH",
              recommendation: "Start",
              uncertainty: {
                model: {
                  starter_selection: {
                    model_context: {
                      is_back_to_back: false,
                      opponent_is_weak: true
                    },
                    candidate_goalies: [
                      {
                        goalie_id: 8474593,
                        days_since_last_played: 2,
                        l10_starts: 7
                      }
                    ]
                  }
                }
              }
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
              modeled_save_pct: 0.907,
              volatility_index: 1.31,
              blowup_risk: 0.31,
              confidence_tier: "MEDIUM",
              recommendation: "Watch"
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
      if (url.includes("/api/v1/forge/players")) {
        return jsonResponse(emptyForgePlayersResponse());
      }
      if (url.includes("/api/v1/transactions/ownership-trends")) {
        return jsonResponse(emptyOwnershipResponse());
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
      if (url.includes("/api/v1/forge/players")) {
        return jsonResponse(emptyForgePlayersResponse());
      }
      if (url.includes("/api/v1/transactions/ownership-trends")) {
        return jsonResponse(emptyOwnershipResponse());
      }
      if (url.includes("/api/v1/transactions/ownership-snapshots")) {
        return jsonResponse({
          success: true,
          players: [{ playerId: 1, ownership: 34 }]
        });
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
        urls.some((u) => u.includes("/api/v1/forge/goalies?date=2026-02-07"))
      ).toBe(true);
      expect(urls.some((u) => u.includes("/api/v1/start-chart?date=2026-02-07"))).toBe(true);
      expect(
        urls.some((u) =>
          u.includes("/api/v1/forge/players?") &&
          u.includes("date=2026-02-07") &&
          u.includes("horizon=1")
        )
      ).toBe(true);
      expect(
        urls.some((u) =>
          u.includes("/api/v1/transactions/ownership-trends?") &&
          u.includes("pos=F")
        )
      ).toBe(true);
    });
  });

  it("renders the compact secondary nav and updates the team-detail shortcut from shared filters", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/api/team-ratings")) return jsonResponse([]);
      if (url.includes("/api/v1/sustainability/trends")) {
        return jsonResponse({ snapshot_date: "2026-02-07", rows: [] });
      }
      if (url.includes("/api/v1/forge/goalies")) {
        return jsonResponse({ asOfDate: "2026-02-07", data: [] });
      }
      if (url.includes("/api/v1/start-chart")) {
        return jsonResponse({ dateUsed: "2026-02-07", games: [] });
      }
      if (url.includes("/api/v1/forge/players")) {
        return jsonResponse(emptyForgePlayersResponse());
      }
      if (url.includes("/api/v1/transactions/ownership-trends")) {
        return jsonResponse(emptyOwnershipResponse());
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

    expect(await screen.findByRole("link", { name: "Legacy Dashboard" })).toBeTruthy();
    expect(
      screen
        .getByRole("link", { name: "Legacy Dashboard" })
        .getAttribute("aria-current")
    ).toBe("page");
    expect(screen.queryByRole("link", { name: "Team Detail" })).toBeNull();
    expect(screen.getByText("Team Detail").getAttribute("aria-disabled")).toBe("true");

    fireEvent.change(screen.getByLabelText("Team"), {
      target: { value: "NJD" }
    });

    await waitFor(() => {
      expect(
        screen.getByRole("link", { name: "Team Detail" }).getAttribute("href")
      ).toBe("/forge/team/NJD?date=2026-02-07&team=NJD&position=all");
    });
  });

  it("resets shared filters back to the default dashboard context", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/api/team-ratings")) return jsonResponse([]);
      if (url.includes("/api/v1/sustainability/trends")) {
        return jsonResponse({ snapshot_date: "2026-02-07", rows: [] });
      }
      if (url.includes("/api/v1/forge/goalies")) {
        return jsonResponse({ asOfDate: "2026-02-07", data: [] });
      }
      if (url.includes("/api/v1/start-chart")) {
        return jsonResponse({ dateUsed: "2026-02-07", games: [] });
      }
      if (url.includes("/api/v1/forge/players")) {
        return jsonResponse(emptyForgePlayersResponse());
      }
      if (url.includes("/api/v1/transactions/ownership-trends")) {
        return jsonResponse(emptyOwnershipResponse());
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

    const dateInput = (await screen.findByLabelText("Date")) as HTMLInputElement;
    const teamSelect = screen.getByLabelText("Team") as HTMLSelectElement;
    const positionSelect = screen.getByLabelText("Position") as HTMLSelectElement;
    const resetButton = screen.getByRole("button", { name: "Reset Filters" });
    const todayEtParts = new Intl.DateTimeFormat("en-US", {
      timeZone: "America/New_York",
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    }).formatToParts(new Date());
    const resetDate = `${todayEtParts.find((part) => part.type === "year")?.value ?? "1970"}-${
      todayEtParts.find((part) => part.type === "month")?.value ?? "01"
    }-${todayEtParts.find((part) => part.type === "day")?.value ?? "01"}`;

    fireEvent.change(dateInput, {
      target: { value: "2026-02-07" }
    });
    fireEvent.change(teamSelect, {
      target: { value: "NJD" }
    });
    fireEvent.change(positionSelect, {
      target: { value: "f" }
    });

    await waitFor(() => {
      expect(resetButton.hasAttribute("disabled")).toBe(false);
    });

    fireEvent.click(resetButton);

    await waitFor(() => {
      expect(dateInput.value).toBe(resetDate);
      expect(teamSelect.value).toBe("all");
      expect(positionSelect.value).toBe("all");
      expect(resetButton.hasAttribute("disabled")).toBe(true);
    });
  });

  it("keeps the core dashboard modules visible on mobile", async () => {
    stubMatchMedia(true);

    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/api/team-ratings")) return jsonResponse([]);
      if (url.includes("/api/v1/sustainability/trends")) {
        return jsonResponse({ snapshot_date: "2026-02-07", rows: [] });
      }
      if (url.includes("/api/v1/forge/goalies")) {
        return jsonResponse({ asOfDate: "2026-02-07", data: [] });
      }
      if (url.includes("/api/v1/start-chart")) {
        return jsonResponse({ dateUsed: "2026-02-07", games: [] });
      }
      if (url.includes("/api/v1/forge/players")) {
        return jsonResponse(emptyForgePlayersResponse());
      }
      if (url.includes("/api/v1/transactions/ownership-trends")) {
        return jsonResponse(emptyOwnershipResponse());
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

    expect(await screen.findByText("Team Power Snapshot")).toBeTruthy();
    expect(screen.getByText("Tonight's Games")).toBeTruthy();
    expect(screen.getByText("Goalie Start Calls")).toBeTruthy();
    expect(screen.getByText("Best Waiver Adds")).toBeTruthy();
    expect(screen.getByText("Trust Or Fade")).toBeTruthy();
    expect(screen.getByText("Who's Hot, Cold, Or Moving")).toBeTruthy();
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
      if (url.includes("/api/v1/forge/players")) {
        return jsonResponse(emptyForgePlayersResponse());
      }
      if (url.includes("/api/v1/transactions/ownership-trends")) {
        return jsonResponse(emptyOwnershipResponse());
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

    expect(await screen.findByRole("button", { name: "Best 6" })).toBeTruthy();
    expect(screen.getAllByText("T01").length).toBeGreaterThan(0);
    expect(screen.queryByText("T32")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Weakest 6" }));

    await waitFor(() => {
      expect(screen.getAllByText("T32").length).toBeGreaterThan(0);
      expect(screen.queryAllByText("T01")).toHaveLength(0);
    });
  });

  it("renders team trend context with CTPI, matchup edge, and team-detail links", async () => {
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
            trend10: 1.3,
            finishingRating: 101.4,
            goalieRating: 97.2,
            varianceFlag: 1
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
        return jsonResponse({
          dateUsed: "2026-02-07",
          games: [
            {
              id: 1,
              date: "2026-02-07",
              homeTeamId: 1,
              awayTeamId: 2,
              homeRating: {
                offRating: 82,
                defRating: 79,
                paceRating: 80,
                trend10: 1.2,
                ppTier: 1,
                pkTier: 2
              },
              awayRating: {
                offRating: 76,
                defRating: 74,
                paceRating: 77,
                trend10: -0.4,
                ppTier: 2,
                pkTier: 2
              },
              homeGoalies: [],
              awayGoalies: []
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
              ctpi_0_to_100: 68,
              offense: 70,
              defense: 64,
              luck: 55,
              sparkSeries: [
                { date: "2026-02-03", value: 61 },
                { date: "2026-02-04", value: 63 },
                { date: "2026-02-05", value: 65 },
                { date: "2026-02-06", value: 66 },
                { date: "2026-02-07", value: 68 }
              ]
            }
          ]
        });
      }
      if (url.includes("/api/v1/forge/players")) {
        return jsonResponse(emptyForgePlayersResponse());
      }
      if (url.includes("/api/v1/transactions/ownership-trends")) {
        return jsonResponse(emptyOwnershipResponse());
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

    const teamLink = await screen.findByRole("link", {
      name: /NJD New Jersey Devils/i
    });
    expect(within(teamLink).getByText(/Form\s+68/)).toBeTruthy();
    expect(screen.getByText("Momentum +7.0")).toBeTruthy();
    expect(screen.getAllByText(/NYI \+/).length).toBeGreaterThan(0);
    expect(
      screen.getByText("Top cards show the teams with the clearest fantasy environment.")
    ).toBeTruthy();
    expect(teamLink).toBeTruthy();
  });

  it("renders the top adds rail controls, filters by ownership band, and switches to weekly mode", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/api/team-ratings")) return jsonResponse([]);
      if (url.includes("/api/v1/sustainability/trends")) {
        return jsonResponse({ snapshot_date: "2026-02-07", rows: [] });
      }
      if (url.includes("/api/v1/forge/goalies")) {
        return jsonResponse({ asOfDate: "2026-02-07", data: [] });
      }
      if (url.includes("/api/v1/start-chart")) {
        return jsonResponse({ dateUsed: "2026-02-07", games: [] });
      }
      if (url.includes("/api/v1/forge/players")) {
        return jsonResponse({
          asOfDate: "2026-02-07",
          requestedDate: "2026-02-07",
          horizonGames: url.includes("horizon=5") ? 5 : 1,
          data: [
            {
              player_id: 11,
              player_name: "Mason Lohrei",
              team_name: "Boston Bruins",
              position: "D",
              pts: 2.4,
              ppp: 0.6,
              sog: 3.2,
              hit: 1.1,
              blk: 1.8,
              uncertainty: 0.32
            },
            {
              player_id: 12,
              player_name: "Leo Carlsson",
              team_name: "Anaheim Ducks",
              position: "C",
              pts: 2.1,
              ppp: 0.4,
              sog: 3.5,
              hit: 0.8,
              blk: 0.4,
              uncertainty: 0.41
            },
            {
              player_id: 13,
              player_name: "Victor Olofsson",
              team_name: "Vegas Golden Knights",
              position: "LW",
              pts: 1.8,
              ppp: 0.5,
              sog: 2.7,
              hit: 0.2,
              blk: 0.1,
              uncertainty: 0.37
            }
          ]
        });
      }
      if (url.includes("/api/v1/transactions/ownership-trends")) {
        return jsonResponse({
          success: true,
          windowDays: 5,
          generatedAt: "2026-02-07T12:00:00.000Z",
          risers: [
            {
              playerKey: "nhl.p.11",
              playerId: 11,
              name: "Mason Lohrei",
              headshot: null,
              displayPosition: "D",
              teamAbbrev: "BOS",
              latest: 44,
              previous: 37,
              delta: 7,
              deltaPct: 7,
              sparkline: [
                { date: "2026-02-03", value: 36 },
                { date: "2026-02-04", value: 37 },
                { date: "2026-02-05", value: 39 },
                { date: "2026-02-06", value: 41 },
                { date: "2026-02-07", value: 44 }
              ]
            },
            {
              playerKey: "nhl.p.12",
              playerId: 12,
              name: "Leo Carlsson",
              headshot: null,
              displayPosition: "C",
              teamAbbrev: "ANA",
              latest: 81,
              previous: 72,
              delta: 9,
              deltaPct: 9,
              sparkline: [
                { date: "2026-02-03", value: 71 },
                { date: "2026-02-04", value: 73 },
                { date: "2026-02-05", value: 76 },
                { date: "2026-02-06", value: 79 },
                { date: "2026-02-07", value: 81 }
              ]
            },
            {
              playerKey: "nhl.p.13",
              playerId: 13,
              name: "Victor Olofsson",
              headshot: null,
              displayPosition: "LW",
              teamAbbrev: "VGK",
              latest: 32,
              previous: 28,
              delta: 4,
              deltaPct: 4,
              sparkline: [
                { date: "2026-02-03", value: 27 },
                { date: "2026-02-04", value: 28 },
                { date: "2026-02-05", value: 29 },
                { date: "2026-02-06", value: 31 },
                { date: "2026-02-07", value: 32 }
              ]
            }
          ],
          fallers: []
        });
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

    expect(await screen.findByText("Mason Lohrei")).toBeTruthy();
    expect(screen.getByText("Victor Olofsson")).toBeTruthy();
    expect(screen.queryByText("Leo Carlsson")).toBeNull();
    expect(
      screen.getByText(
        "Higher add scores combine opportunity, recent demand, projection, schedule, and risk."
      )
    ).toBeTruthy();
    expect(screen.getAllByText("Ownership 5D").length).toBeGreaterThan(0);
    expect(screen.getAllByText("+7.0 pts").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Why This Add").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Fantasy Line").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Add Score").length).toBeGreaterThan(0);
    expect(screen.getByText("Demand 35.0")).toBeTruthy();
    expect(screen.getByText("Risk -0.5")).toBeTruthy();

    fireEvent.change(screen.getByLabelText("Maximum ownership"), {
      target: { value: "35" }
    });

    await waitFor(() => {
      expect(screen.queryByText("Mason Lohrei")).toBeNull();
      expect(screen.getByText("Victor Olofsson")).toBeTruthy();
    });

    fireEvent.click(screen.getByRole("button", { name: "This Week" }));

    await waitFor(() => {
      const urls = fetchMock.mock.calls.map(([input]) => String(input));
      expect(
        urls.some((u) =>
          u.includes("/api/v1/forge/players?") && u.includes("horizon=5")
        )
      ).toBe(true);
    });
  });

  it("shows a blocked weekly projection contract instead of a healthy empty rail", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/api/team-ratings")) return jsonResponse([]);
      if (url.includes("/api/v1/sustainability/trends")) {
        return jsonResponse({ snapshot_date: "2026-02-07", rows: [] });
      }
      if (url.includes("/api/v1/forge/goalies")) {
        return jsonResponse({ asOfDate: "2026-02-07", data: [] });
      }
      if (url.includes("/api/v1/start-chart")) {
        return jsonResponse({ dateUsed: "2026-02-07", games: [] });
      }
      if (url.includes("/api/v1/forge/players")) {
        if (url.includes("horizon=5")) {
          return jsonResponse({
            asOfDate: "2026-02-07",
            requestedDate: "2026-02-07",
            horizonGames: 5,
            diagnostics: {
              state: "blocked",
              missingRequestedHorizon: true,
              message:
                "No genuine 5-game projection output is available for 2026-02-07; one-game output exists but is not relabeled or scaled."
            },
            data: []
          });
        }
        return jsonResponse(emptyForgePlayersResponse());
      }
      if (url.includes("/api/v1/transactions/ownership-trends")) {
        return jsonResponse(emptyOwnershipResponse());
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
    fireEvent.click(await screen.findByRole("button", { name: "This Week" }));

    expect(
      await screen.findByText(
        /Error: No genuine 5-game projection output is available/
      )
    ).toBeTruthy();
    expect(screen.queryByText("No players matched this ownership range.")).toBeNull();
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
      if (url.includes("/api/v1/forge/players")) {
        return jsonResponse(emptyForgePlayersResponse());
      }
      if (url.includes("/api/v1/transactions/ownership-trends")) {
        return jsonResponse(emptyOwnershipResponse());
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

  it("renders sustainable risers and unsustainable heaters with trends-player drill-ins", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/api/team-ratings")) {
        return jsonResponse([]);
      }
      if (url.includes("/api/v1/sustainability/trends") && url.includes("direction=hot")) {
        return jsonResponse({
          requested_snapshot_date: "2026-02-07",
          snapshot_date: "2026-02-07",
          rows: [
            {
              player_id: 16,
              player_name: "Heater Skater",
              position_group: "F",
              position_code: "RW",
              window_code: "l10",
              s_100: 44.3,
              luck_pressure: 1.36,
              z_shp: 1.8,
              z_oishp: 0.4,
              z_ipp: 0.1,
              z_ppshp: 0.3
            }
          ]
        });
      }
      if (url.includes("/api/v1/sustainability/trends") && url.includes("direction=cold")) {
        return jsonResponse({
          requested_snapshot_date: "2026-02-07",
          snapshot_date: "2026-02-07",
          rows: [
            {
              player_id: 12,
              player_name: "Trustworthy Skater",
              position_group: "F",
              position_code: "C",
              window_code: "l10",
              s_100: 72.4,
              luck_pressure: -1.1,
              z_shp: -0.2,
              z_oishp: -0.1,
              z_ipp: -0.3,
              z_ppshp: 0
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
      if (url.includes("/api/v1/forge/players")) {
        return jsonResponse(emptyForgePlayersResponse());
      }
      if (url.includes("/api/v1/transactions/ownership-trends")) {
        return jsonResponse(emptyOwnershipResponse());
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

    expect(await screen.findByText("Trust These Risers")).toBeTruthy();
    expect(screen.getByText("Fade These Heaters")).toBeTruthy();
    expect(screen.getByText("Trustworthy")).toBeTruthy();
    expect(screen.getByText("Overheated")).toBeTruthy();
    expect(screen.getByText("The rise looks supported by more than luck.")).toBeTruthy();
    expect(
      screen.getByText("The hot streak may cool off.")
    ).toBeTruthy();
    expect(screen.getByText("Trustworthy Skater")).toBeTruthy();
    expect(screen.getByText("Heater Skater")).toBeTruthy();
    expect(screen.getByText("Mostly believable")).toBeTruthy();
    expect(screen.getByText("Likely to cool")).toBeTruthy();
    expect(screen.getByText(/biggest reason this hot streak may cool off/i)).toBeTruthy();

    const trustworthyLink = screen.getByRole("link", { name: /Trustworthy Skater/i });
    const heaterLink = screen.getByRole("link", { name: /Heater Skater/i });
    expect(trustworthyLink.getAttribute("href")).toBe(
      "/trends/player/12?date=2026-02-07&metricGroup=finishing&metrics=shooting_pct%2Con_ice_sh_pct%2Cpdo%2Cipp&origin=forge-dashboard&returnTo=%2Fforge%2Fdashboard%3Fdate%3D2026-02-07%26team%3Dall%26position%3Dall"
    );
    expect(heaterLink.getAttribute("href")).toBe(
      "/trends/player/16?date=2026-02-07&metricGroup=finishing&metrics=shooting_pct%2Con_ice_sh_pct%2Cpdo%2Cipp&origin=forge-dashboard&returnTo=%2Fforge%2Fdashboard%3Fdate%3D2026-02-07%26team%3Dall%26position%3Dall"
    );
  });

  it("renders player hot/cold and trending up/down as separate companion states", async () => {
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
      if (url.includes("/api/v1/start-chart")) {
        return jsonResponse({ dateUsed: "2026-02-07", games: [] });
      }
      if (url.includes("/api/v1/forge/players")) {
        return jsonResponse(emptyForgePlayersResponse());
      }
      if (url.includes("/api/v1/transactions/ownership-trends")) {
        return jsonResponse(emptyOwnershipResponse());
      }
      if (url.includes("/api/v1/trends/team-ctpi")) {
        return jsonResponse({ generatedAt: "2026-02-07T12:00:00.000Z", teams: [] });
      }
      if (url.includes("/api/v1/trends/skater-power")) {
        return jsonResponse({
          generatedAt: "2026-02-07T12:00:00.000Z",
          categories: {
            shotsPer60: {
              rankings: [
                {
                  playerId: 101,
                  percentile: 92,
                  gp: 5,
                  rank: 1,
                  previousRank: 3,
                  delta: 2,
                  latestValue: 10.2
                },
                {
                  playerId: 202,
                  percentile: 18,
                  gp: 5,
                  rank: 20,
                  previousRank: 17,
                  delta: -3,
                  latestValue: 4.1
                }
              ],
              series: {
                "101": [
                  { gp: 1, percentile: 68 },
                  { gp: 2, percentile: 74 },
                  { gp: 3, percentile: 82 },
                  { gp: 4, percentile: 88 },
                  { gp: 5, percentile: 92 }
                ],
                "202": [
                  { gp: 1, percentile: 34 },
                  { gp: 2, percentile: 30 },
                  { gp: 3, percentile: 27 },
                  { gp: 4, percentile: 22 },
                  { gp: 5, percentile: 18 }
                ]
              }
            },
            ixgPer60: {
              rankings: [
                {
                  playerId: 101,
                  percentile: 88,
                  gp: 5,
                  rank: 2,
                  previousRank: 6,
                  delta: 4,
                  latestValue: 1.1
                },
                {
                  playerId: 202,
                  percentile: 24,
                  gp: 5,
                  rank: 19,
                  previousRank: 13,
                  delta: -6,
                  latestValue: 0.3
                }
              ],
              series: {
                "101": [
                  { gp: 1, percentile: 61 },
                  { gp: 2, percentile: 70 },
                  { gp: 3, percentile: 79 },
                  { gp: 4, percentile: 84 },
                  { gp: 5, percentile: 88 }
                ],
                "202": [
                  { gp: 1, percentile: 40 },
                  { gp: 2, percentile: 34 },
                  { gp: 3, percentile: 30 },
                  { gp: 4, percentile: 27 },
                  { gp: 5, percentile: 24 }
                ]
              }
            }
          },
          playerMetadata: {
            "101": {
              id: 101,
              fullName: "Arrow Up",
              position: "RW",
              teamAbbrev: "NJD",
              imageUrl: null
            },
            "202": {
              id: 202,
              fullName: "Fading Skater",
              position: "LW",
              teamAbbrev: "BUF",
              imageUrl: null
            }
          }
        });
      }
      return jsonResponse({}, false);
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<ForgeDashboardPage />);

    expect(await screen.findByText("Heating Up")).toBeTruthy();
    expect(screen.getByText("Short-term only")).toBeTruthy();
    expect(
      screen.getByText(
        "Hot and cold show current form. Use Trust Or Fade to judge whether it can last."
      )
    ).toBeTruthy();
    expect(
      screen.getByText("The first row in each column includes a small form chart.")
    ).toBeTruthy();
    expect(screen.getByText("Cooling Off")).toBeTruthy();
    expect(screen.getAllByText("Hot stretch").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Cold stretch").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Arrow Up").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Fading Skater").length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole("tab", { name: "Fast Movers" }));

    await waitFor(() => {
      expect(screen.getByText("Moving Up")).toBeTruthy();
      expect(screen.getByText("Moving Down")).toBeTruthy();
      expect(
        screen.getByText(
          "Fast movers show who changed quickest. Use Trust Or Fade to judge whether it can last."
        )
      ).toBeTruthy();
      expect(screen.getAllByText("Moving up fast").length).toBeGreaterThan(0);
      expect(screen.getAllByText("Dropping fast").length).toBeGreaterThan(0);
      expect(screen.getAllByText(/improving fastest/i).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/falling fastest/i).length).toBeGreaterThan(0);
    });

    const upLinks = screen.getAllByRole("link", { name: /Arrow Up/i });
    expect(
      upLinks.some(
        (link) =>
          link.getAttribute("href") ===
          "/trends/player/101?date=2026-02-07&metricGroup=rates&metrics=goals_per_60%2Csog_per_60%2Cixg_per_60&origin=forge-dashboard&returnTo=%2Fforge%2Fdashboard%3Fdate%3D2026-02-07%26team%3Dall%26position%3Dall"
      )
    ).toBe(true);
  });

  it("applies the default 25 to 50 ownership band to player insight sections and lets the band expand", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/api/team-ratings")) {
        return jsonResponse([]);
      }
      if (url.includes("/api/v1/sustainability/trends") && url.includes("direction=hot")) {
        return jsonResponse({
          requested_snapshot_date: "2026-02-07",
          snapshot_date: "2026-02-07",
          rows: [
            {
              player_id: 16,
              player_name: "Midband Heater",
              position_group: "F",
              position_code: "RW",
              window_code: "l10",
              s_100: 44.3,
              luck_pressure: 1.36,
              z_shp: 1.8,
              z_oishp: 0.4,
              z_ipp: 0.1,
              z_ppshp: 0.3
            }
          ]
        });
      }
      if (url.includes("/api/v1/sustainability/trends") && url.includes("direction=cold")) {
        return jsonResponse({
          requested_snapshot_date: "2026-02-07",
          snapshot_date: "2026-02-07",
          rows: [
            {
              player_id: 12,
              player_name: "Low Owned Riser",
              position_group: "F",
              position_code: "C",
              window_code: "l10",
              s_100: 72.4,
              luck_pressure: -1.1,
              z_shp: -0.2,
              z_oishp: -0.1,
              z_ipp: -0.3,
              z_ppshp: 0
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
      if (url.includes("/api/v1/forge/players")) {
        return jsonResponse(emptyForgePlayersResponse());
      }
      if (url.includes("/api/v1/transactions/ownership-trends")) {
        return jsonResponse(emptyOwnershipResponse());
      }
      if (url.includes("/api/v1/transactions/ownership-snapshots")) {
        return jsonResponse({
          success: true,
          players: [
            { playerId: 12, ownership: 12 },
            { playerId: 16, ownership: 34 },
            { playerId: 303, ownership: 14 },
            { playerId: 404, ownership: 41 }
          ]
        });
      }
      if (url.includes("/api/v1/trends/team-ctpi")) {
        return jsonResponse({ generatedAt: "2026-02-07T12:00:00.000Z", teams: [] });
      }
      if (url.includes("/api/v1/trends/skater-power")) {
        return jsonResponse({
          generatedAt: "2026-02-07T12:00:00.000Z",
          categories: {
            shotsPer60: {
              rankings: [
                {
                  playerId: 303,
                  percentile: 86,
                  gp: 5,
                  rank: 1,
                  previousRank: 3,
                  delta: 3,
                  latestValue: 9.8
                },
                {
                  playerId: 404,
                  percentile: 73,
                  gp: 5,
                  rank: 6,
                  previousRank: 8,
                  delta: 1,
                  latestValue: 8.1
                }
              ],
              series: {
                "303": [
                  { gp: 1, percentile: 60 },
                  { gp: 2, percentile: 66 },
                  { gp: 3, percentile: 74 },
                  { gp: 4, percentile: 81 },
                  { gp: 5, percentile: 86 }
                ],
                "404": [
                  { gp: 1, percentile: 58 },
                  { gp: 2, percentile: 61 },
                  { gp: 3, percentile: 66 },
                  { gp: 4, percentile: 70 },
                  { gp: 5, percentile: 73 }
                ]
              }
            }
          },
          playerMetadata: {
            "303": {
              id: 303,
              fullName: "Low Owned Trend",
              position: "LW",
              teamAbbrev: "SEA",
              imageUrl: null
            },
            "404": {
              id: 404,
              fullName: "Midband Trend",
              position: "RW",
              teamAbbrev: "NJD",
              imageUrl: null
            }
          }
        });
      }
      return jsonResponse({}, false);
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<ForgeDashboardPage />);

    expect(await screen.findByText("Show Players Owned In")).toBeTruthy();
    expect(screen.getByText("25% - 50%")).toBeTruthy();
    expect(screen.getByText("Midband Heater")).toBeTruthy();
    expect(screen.getAllByText("Midband Trend").length).toBeGreaterThan(0);
    expect(screen.queryByText("Low Owned Riser")).toBeNull();
    expect(screen.queryByText("Low Owned Trend")).toBeNull();

    fireEvent.change(screen.getByLabelText("Player insight minimum ownership"), {
      target: { value: "0" }
    });

    await waitFor(() => {
      expect(screen.getByText("0% - 50%")).toBeTruthy();
      expect(screen.getByText("Low Owned Riser")).toBeTruthy();
      expect(screen.getAllByText("Low Owned Trend").length).toBeGreaterThan(0);
    });
  });

  it("surfaces materially stale skater-trend fallback scope as degraded contract text", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/api/team-ratings")) return jsonResponse([]);
      if (url.includes("/api/v1/sustainability/trends")) {
        return jsonResponse({ snapshot_date: "2026-02-07", rows: [] });
      }
      if (url.includes("/api/v1/forge/goalies")) {
        return jsonResponse({ asOfDate: "2026-02-07", data: [] });
      }
      if (url.includes("/api/v1/start-chart")) {
        return jsonResponse({ dateUsed: "2026-02-07", games: [] });
      }
      if (url.includes("/api/v1/forge/players")) {
        return jsonResponse(emptyForgePlayersResponse());
      }
      if (url.includes("/api/v1/transactions/ownership-trends")) {
        return jsonResponse(emptyOwnershipResponse());
      }
      if (url.includes("/api/v1/transactions/ownership-snapshots")) {
        return jsonResponse({ success: true, players: [] });
      }
      if (url.includes("/api/v1/trends/team-ctpi")) {
        return jsonResponse({ generatedAt: "2026-02-07T12:00:00.000Z", teams: [] });
      }
      if (url.includes("/api/v1/trends/skater-power")) {
        return jsonResponse({
          generatedAt: "2026-02-07T12:00:00.000Z",
          requestedDate: "2026-02-07",
          dateUsed: "2025-10-16",
          fallbackApplied: true,
          serving: {
            requestedDate: "2026-02-07",
            resolvedDate: "2025-10-16",
            fallbackApplied: true,
            isSameDay: false,
            state: "fallback",
            strategy: "latest_available_with_data",
            gapDays: 114,
            severity: "error",
            status: "blocked",
            message:
              "Trend movement fallback is materially stale: requested 2026-02-07, but latest available scope is 2025-10-16 (114 days old). Treat this module as degraded until fresher trend rows exist."
          },
          categories: {},
          playerMetadata: {}
        });
      }
      return jsonResponse({}, false);
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<ForgeDashboardPage />);

    expect(
      await screen.findByText(/Trend movement fallback is materially stale:/)
    ).toBeTruthy();
    expect(
      screen.getByText(/Latest refresh timestamp: 2026-02-07T12:00:00.000Z/)
    ).toBeTruthy();
  });

  it("withholds blocked skater-trend rows when the fallback scope is materially stale", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/api/team-ratings")) return jsonResponse([]);
      if (url.includes("/api/v1/sustainability/trends")) {
        return jsonResponse({ snapshot_date: "2026-02-07", rows: [] });
      }
      if (url.includes("/api/v1/forge/goalies")) {
        return jsonResponse({ asOfDate: "2026-02-07", data: [] });
      }
      if (url.includes("/api/v1/start-chart")) {
        return jsonResponse({ dateUsed: "2026-02-07", games: [] });
      }
      if (url.includes("/api/v1/forge/players")) {
        return jsonResponse(emptyForgePlayersResponse());
      }
      if (url.includes("/api/v1/transactions/ownership-trends")) {
        return jsonResponse(emptyOwnershipResponse());
      }
      if (url.includes("/api/v1/transactions/ownership-snapshots")) {
        return jsonResponse({ success: true, players: [] });
      }
      if (url.includes("/api/v1/trends/team-ctpi")) {
        return jsonResponse({ generatedAt: "2026-02-07T12:00:00.000Z", teams: [] });
      }
      if (url.includes("/api/v1/trends/skater-power")) {
        return jsonResponse({
          generatedAt: "2026-02-07T12:00:00.000Z",
          requestedDate: "2026-02-07",
          dateUsed: "2025-10-16",
          fallbackApplied: true,
          serving: {
            requestedDate: "2026-02-07",
            resolvedDate: "2025-10-16",
            fallbackApplied: true,
            isSameDay: false,
            state: "fallback",
            strategy: "latest_available_with_data",
            gapDays: 114,
            severity: "error",
            status: "blocked",
            message:
              "Trend movement fallback is materially stale: requested 2026-02-07, but latest available scope is 2025-10-16 (114 days old). Treat this module as degraded until fresher trend rows exist."
          },
          categories: {
            shotsPer60: {
              rankings: [
                {
                  playerId: 101,
                  percentile: 92,
                  gp: 5,
                  rank: 1,
                  previousRank: 3,
                  delta: 4,
                  latestValue: 10.2
                }
              ],
              series: {
                "101": [
                  { gp: 1, percentile: 68 },
                  { gp: 2, percentile: 74 },
                  { gp: 3, percentile: 82 },
                  { gp: 4, percentile: 88 },
                  { gp: 5, percentile: 92 }
                ]
              }
            }
          },
          playerMetadata: {
            "101": {
              id: 101,
              fullName: "Blocked Trend Skater",
              position: "C",
              teamAbbrev: "NJD",
              imageUrl: null
            }
          }
        });
      }
      return jsonResponse({}, false);
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<ForgeDashboardPage />);

    expect(
      await screen.findByText(/Trend movement fallback is materially stale:/)
    ).toBeTruthy();
    expect(screen.queryByText("Blocked Trend Skater")).toBeNull();
  });

  it("surfaces blocked goalie fallback and recent slate fallback with contract-aware messaging", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/api/team-ratings")) return jsonResponse([]);
      if (url.includes("/api/v1/sustainability/trends")) {
        return jsonResponse({ snapshot_date: "2026-02-07", rows: [] });
      }
      if (url.includes("/api/v1/forge/goalies")) {
        return jsonResponse({
          asOfDate: "2026-02-06",
          requestedDate: "2026-02-07",
          fallbackApplied: true,
          serving: {
            requestedDate: "2026-02-07",
            resolvedDate: "2026-02-06",
            fallbackApplied: true,
            isSameDay: false,
            state: "fallback",
            strategy: "latest_available_with_data",
            gapDays: 1,
            severity: "error",
            status: "blocked",
            message:
              "Goalie projections is serving 2026-02-06 even though 6 games were scheduled on requested date 2026-02-07. Treat this module as degraded until same-day data is available."
          },
          data: []
        });
      }
      if (url.includes("/api/v1/start-chart")) {
        return jsonResponse({
          dateUsed: "2026-02-06",
          requestedDate: "2026-02-07",
          fallbackApplied: true,
          serving: {
            requestedDate: "2026-02-07",
            resolvedDate: "2026-02-06",
            fallbackApplied: true,
            isSameDay: false,
            state: "fallback",
            strategy: "previous_date_with_games",
            gapDays: 1,
            severity: "warn",
            status: "fallback_recent",
            message:
              "Start-chart slate is serving the nearest available date (2026-02-06), 1 day behind the requested date."
          },
          games: []
        });
      }
      if (url.includes("/api/v1/forge/players")) {
        return jsonResponse(emptyForgePlayersResponse());
      }
      if (url.includes("/api/v1/transactions/ownership-trends")) {
        return jsonResponse(emptyOwnershipResponse());
      }
      if (url.includes("/api/v1/transactions/ownership-snapshots")) {
        return jsonResponse({ success: true, players: [] });
      }
      if (url.includes("/api/v1/trends/team-ctpi")) {
        return jsonResponse({ generatedAt: "2026-02-07T12:00:00.000Z", teams: [] });
      }
      if (url.includes("/api/v1/trends/skater-power")) {
        return jsonResponse({
          generatedAt: "2026-02-07T12:00:00.000Z",
          requestedDate: "2026-02-07",
          dateUsed: "2026-02-07",
          fallbackApplied: false,
          serving: {
            requestedDate: "2026-02-07",
            resolvedDate: "2026-02-07",
            fallbackApplied: false,
            isSameDay: true,
            state: "same_day",
            strategy: "requested_date",
            gapDays: 0,
            severity: "none",
            status: "requested_date",
            message: null
          },
          categories: {},
          playerMetadata: {}
        });
      }
      return jsonResponse({}, false);
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<ForgeDashboardPage />);

    expect(
      await screen.findByText(
        /Goalie projections is serving 2026-02-06 even though 6 games were scheduled/
      )
    ).toBeTruthy();
    expect(
      screen.getAllByText(
        /Start-chart slate is serving the nearest available date \(2026-02-06\), 1 day behind/
      ).length
    ).toBeGreaterThan(0);
  });
});
