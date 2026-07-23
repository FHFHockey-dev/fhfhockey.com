import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const swrState = vi.hoisted(() => ({
  data: null as any,
  mutate: vi.fn(),
}));

const buildApiData = () => ({
  dateUsed: "2026-02-07",
  projections: 0,
  players: [],
  ctpi: [],
  games: [],
  fantasyScoringContract: {
    version: "fixture-scoring-v9",
    label: "Fixture scoring",
    weights: {
      goals: 4,
      assists: 3,
      powerPlayPoints: 2,
      shotsOnGoal: 0.33,
      hits: 0.44,
      blockedShots: 0.55,
    },
  },
});

vi.mock("next/head", () => ({
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock("swr", () => ({
  default: () => ({
    data: swrState.data,
    isLoading: false,
    mutate: swrState.mutate,
  }),
}));

vi.mock("recharts", () => ({
  LineChart: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  Line: () => null,
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  ),
  Tooltip: () => null,
  XAxis: () => null,
  YAxis: () => null,
}));

import StartChartPage from "../../pages/start-chart";

describe("StartChartPage", () => {
  beforeEach(() => {
    swrState.data = buildApiData();
    window.history.replaceState({}, "", "/start-chart");
  });

  afterEach(() => {
    cleanup();
    swrState.mutate.mockClear();
  });

  it("displays the versioned fantasy scoring formula supplied by the API", () => {
    render(<StartChartPage />);

    expect(
      screen.getByText(
        /Fixture scoring \[fixture-scoring-v9\] \(G=4, A=3, PPP=2, SOG=0\.33, HIT=0\.44, BLK=0\.55\)/,
      ),
    ).toBeTruthy();
  });

  it("uses keyboard-native controls, exposes unavailable model controls, and syncs date state to the URL", () => {
    swrState.data = {
      ...buildApiData(),
      projections: 1,
      players: [
        {
          player_id: 8478402,
          name: "Nick Suzuki",
          positions: ["C"],
          ownership: 25,
          percent_ownership: 25,
          opponent_abbrev: "TOR",
          team_id: 8,
          team_abbrev: "MTL",
          proj_fantasy_points: 4.2,
          proj_goals: 0.6,
          proj_assists: 0.6,
          proj_shots: 3.5,
          matchup_grade: 62,
          games_remaining_week: 3,
        },
      ],
      games: [
        {
          id: 1001,
          date: "2026-02-07",
          homeTeamId: 10,
          awayTeamId: 8,
          homeGoalies: [],
          awayGoalies: [],
        },
      ],
    };

    render(<StartChartPage />);

    const gameFilter = screen.getByRole("button", {
      name: /MTL at TOR; apply game filter/,
    });
    expect(gameFilter.getAttribute("aria-pressed")).toBe("false");
    fireEvent.click(gameFilter);
    expect(gameFilter.getAttribute("aria-pressed")).toBe("true");

    expect(screen.getByLabelText("Mode").hasAttribute("disabled")).toBe(true);
    expect(screen.getByLabelText("Profile").hasAttribute("disabled")).toBe(
      true,
    );
    expect(
      screen.getByText(
        /Tau, category mode, and P75 risk controls are unavailable/,
      ),
    ).toBeTruthy();

    fireEvent.change(screen.getByLabelText("Date"), {
      target: { value: "2026-02-08" },
    });
    expect(window.location.search).toBe("?date=2026-02-08");

    const explanation = screen.getByText("i").closest("details");
    expect(explanation?.hasAttribute("open")).toBe(false);
    fireEvent.click(screen.getByLabelText("Explain metrics"));
    expect(explanation?.hasAttribute("open")).toBe(true);

    expect(
      screen
        .getByRole("link", { name: /FORGE Command Center/ })
        .getAttribute("href"),
    ).toBe("/forge/command-center");
    expect(
      screen.getByRole("img", { name: /Thirty-day team power trend/ }),
    ).toBeTruthy();
  });
});
