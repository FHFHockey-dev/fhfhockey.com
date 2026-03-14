import React from "react";
import { describe, expect, it, beforeEach, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

vi.mock("next/image", () => ({
  default: (props: any) => {
    const { alt, objectFit: _objectFit, ...rest } = props;
    return <img alt={alt ?? ""} {...rest} />;
  }
}));

vi.mock("next/head", () => ({
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>
}));

import FORGEPage from "../../pages/FORGE";
import { teamsInfo } from "lib/teamsInfo";

function mockFetchResponse(data: unknown, ok = true) {
  return {
    ok,
    json: async () => data
  } as Response;
}

describe("FORGE goalie UI states", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("renders goalie disclosure and starter confidence blocks", async () => {
    const njdTeam =
      Object.values(teamsInfo).find((team) => team.abbrev === "NJD") ??
      Object.values(teamsInfo)[0];
    const nyiTeam =
      Object.values(teamsInfo).find((team) => team.abbrev === "NYI") ??
      Object.values(teamsInfo)[1];

    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/api/v1/forge/players")) {
        return mockFetchResponse({ data: [] });
      }
      if (url.includes("/api/v1/forge/accuracy")) {
        return mockFetchResponse({
          data: [
            { date: "2026-02-05", accuracy: 42 },
            { date: "2026-02-06", accuracy: 44 }
          ]
        });
      }
      if (url.includes("/api/v1/forge/goalies")) {
        return mockFetchResponse({
          modelVersion: "starter-scenario-v1",
          scenarioCount: 2,
          calibrationHints: { starterBrier: 0.19 },
          diagnostics: { notes: ["No NHL games scheduled on requested date."] },
          data: [
            {
              goalie_id: 8474593,
              goalie_name: "Jacob Markstrom",
              team_name: "New Jersey Devils",
              team_abbreviation: "NJD",
              opponent_team_name: "New York Islanders",
              opponent_team_abbreviation: "NYI",
              starter_probability: 0.61,
              proj_shots_against: 27.2,
              proj_saves: 24.1,
              proj_goals_allowed: 3.1,
              proj_win_prob: 0.53,
              proj_shutout_prob: 0.05,
              modeled_save_pct: 0.892,
              volatility_index: 1.28,
              blowup_risk: 0.27,
              confidence_tier: "MEDIUM",
              quality_tier: "ABOVE_AVERAGE",
              reliability_tier: "MODERATE",
              recommendation: "START",
              uncertainty: {
                saves: { p10: 18, p50: 24, p90: 31 },
                goals_allowed: { p10: 1, p50: 3, p90: 5 },
                model: {
                  starter_selection: {
                    model_context: {
                      is_back_to_back: false,
                      opponent_is_weak: true
                    },
                    opponent_offense_context: {
                      context_adjustment_pct: -0.04
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
      if (url.includes("/api/v1/start-chart")) {
        return mockFetchResponse({
          dateUsed: "2026-02-08",
          games: [
            {
              id: 1,
              date: "2026-02-08",
              homeTeamId: njdTeam?.id,
              awayTeamId: nyiTeam?.id,
              homeRating: { offRating: 82, defRating: 77 },
              awayRating: { offRating: 79, defRating: 81 },
              homeGoalies: [
                {
                  player_id: 8474593,
                  name: "Jacob Markstrom",
                  start_probability: 0.72,
                  projected_gsaa_per_60: 0.1,
                  confirmed_status: false
                }
              ],
              awayGoalies: [
                {
                  player_id: 8478406,
                  name: "Ilya Sorokin",
                  start_probability: 0.81,
                  projected_gsaa_per_60: 0.2,
                  confirmed_status: false
                }
              ]
            }
          ]
        });
      }
      return mockFetchResponse({}, false);
    });

    vi.stubGlobal("fetch", fetchMock);

    const { asFragment } = render(<FORGEPage />);

    fireEvent.click(screen.getByRole("button", { name: "Goalies" }));

    await waitFor(() => {
      expect(screen.getByText("Goalie Model Disclosure")).toBeTruthy();
    });

    expect(screen.getByText(/Today's Slate/i)).toBeTruthy();
    expect(screen.getAllByText("OFF").length).toBeGreaterThan(0);
    expect(screen.getAllByText("DEF").length).toBeGreaterThan(0);
    if (njdTeam?.abbrev) {
      expect(screen.getByAltText(njdTeam.abbrev)).toBeTruthy();
    }
    if (nyiTeam?.abbrev) {
      expect(screen.getByAltText(nyiTeam.abbrev)).toBeTruthy();
    }
    expect(screen.getByText("Starter Confidence Drivers")).toBeTruthy();
    expect(screen.getByText("Recency")).toBeTruthy();
    expect(screen.getByText("L10 Starts")).toBeTruthy();
    expect(screen.getByText("Back-to-Back")).toBeTruthy();
    expect(screen.getByText("Opponent Context")).toBeTruthy();
    expect(screen.getByText(/Model: starter-scenario-v1/i)).toBeTruthy();
    expect(screen.getByText(/Starter scenarios: 2/i)).toBeTruthy();
    expect(screen.getByText(/Starter calibration \(Brier\): 0.190/i)).toBeTruthy();

    expect(asFragment()).toMatchSnapshot();
  });
});
