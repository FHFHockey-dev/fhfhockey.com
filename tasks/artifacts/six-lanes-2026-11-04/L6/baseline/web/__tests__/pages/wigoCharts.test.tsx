import React from "react";
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const routerState = vi.hoisted(() => ({ query: {} as Record<string, string> }));
const dashboardState = vi.hoisted(() => ({
  selectedPlayer: null as null | { id: number; fullName: string },
  teamAbbreviation: null as string | null,
}));

vi.mock("next/router", () => ({
  useRouter: () => ({ query: routerState.query }),
}));

vi.mock("components/WiGO/WigoDashboardSections", () => ({
  WigoDashboardHeader: () => <div data-testid="wigo-header" />,
  WigoOverviewSection: () => <div data-testid="wigo-overview" />,
  WigoTrendsSection: () => <div data-testid="wigo-trends" />,
  WigoPercentilesSection: () => <div data-testid="wigo-percentiles" />,
  WigoComparisonSection: () => <div data-testid="wigo-comparison" />,
}));

vi.mock("hooks/useWigoPlayerDashboard", () => ({
  default: () => ({
    selectedPlayer: dashboardState.selectedPlayer,
    headshotUrl: null,
    currentSeasonId: 20262027,
    teamColors: {
      primaryColor: "#000",
      secondaryColor: "#111",
      accentColor: "#222",
      altColor: "#333",
      jerseyColor: "#444",
    },
    teamName: "",
    teamAbbreviation: dashboardState.teamAbbreviation,
    teamIdForLog: null,
    rawCombinedData: [],
    isLoadingAggData: false,
    aggDataError: null,
    playerDataError: null,
    handlePlayerSelect: vi.fn(),
    updateUrlWith: vi.fn(async () => true),
  }),
}));

import WigoCharts from "pages/wigoCharts";

const setViewport = (width: number) => {
  Object.defineProperty(window, "innerWidth", { configurable: true, value: width });
};

beforeEach(() => {
  routerState.query = {};
  dashboardState.selectedPlayer = null;
  dashboardState.teamAbbreviation = null;
  setViewport(1280);
});

afterEach(cleanup);

// TJ removed the WiGO workflow link block (2026-10-25); the dashboard ends at its own panels.
describe("WiGO page without workflow links", () => {
  const expectNoWorkflowLinks = () => {
    expect(screen.queryByText("WiGO workflow")).toBeNull();
    expect(screen.queryByRole("heading", { name: /keep exploring|read further/i })).toBeNull();
    expect(screen.queryAllByRole("link")).toHaveLength(0);
  };

  it("renders no workflow links on desktop, with or without a selected player", () => {
    render(<WigoCharts />);
    expectNoWorkflowLinks();
    cleanup();

    dashboardState.selectedPlayer = { id: 8479318, fullName: "Auston Matthews" };
    dashboardState.teamAbbreviation = "TOR";
    render(<WigoCharts />);
    expect(screen.getByTestId("wigo-comparison")).toBeTruthy();
    expectNoWorkflowLinks();
  });

  it("renders no workflow links beneath the mobile tabs or after a resize", () => {
    setViewport(375);
    routerState.query = { tab: "comparison" };
    dashboardState.selectedPlayer = { id: 8479318, fullName: "Auston Matthews" };
    dashboardState.teamAbbreviation = "TOR";
    render(<WigoCharts />);
    expect(screen.getByTestId("wigo-comparison")).toBeTruthy();
    expectNoWorkflowLinks();

    act(() => {
      setViewport(1280);
      window.dispatchEvent(new Event("resize"));
    });
    expectNoWorkflowLinks();
  });
});
