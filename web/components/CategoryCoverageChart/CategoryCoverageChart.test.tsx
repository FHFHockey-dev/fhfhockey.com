import React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import CategoryCoverageChart from "./CategoryCoverageChart";

const { mockUsePercentileRank } = vi.hoisted(() => ({ mockUsePercentileRank: vi.fn() }));
vi.mock("hooks/usePercentileRank", () => ({ default: mockUsePercentileRank }));
vi.mock("react-chartjs-2", () => ({ Radar: () => <div data-testid="radar" /> }));
vi.mock("hooks/useScreenSize", () => ({ default: () => ({ screen: "l" }), BreakPoint: { l: "l" } }));
afterEach(cleanup);

const percentiles = { goals: 96, assists: 99.9, powerPlayPoints: 90, shots: 90.7, plusMinus: 60, pim: 40, blockedShots: 20, hits: 58.9 };

describe("CategoryCoverageChart sample label", () => {
  it("states the player's games and the all-skater cohort it ranks against", () => {
    mockUsePercentileRank.mockReturnValue({
      data: percentiles, sample: { playerGames: 2, cohortSize: 644, minGames: 5 },
      loading: false, error: null, retry: vi.fn(), retrying: false
    });
    render(<CategoryCoverageChart playerId={8483428} timeOption="SEASON" compact />);
    expect(screen.getByTestId("radar")).toBeTruthy();
    expect(screen.getByText("2 GP · vs 644 skaters with 5+ GP")).toBeTruthy();
  });
});
