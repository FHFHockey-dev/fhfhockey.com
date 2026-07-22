import React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const swrState = vi.hoisted(() => ({
  data: {
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
  },
  mutate: vi.fn(),
}));

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
});
