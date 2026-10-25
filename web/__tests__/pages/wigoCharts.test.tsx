import React from "react";
import { act, cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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

// The shared section is unnamed, so locate it from its heading.
const workflowSections = (name: RegExp) =>
  screen.getAllByRole("heading", { name }).map((heading) => heading.closest("section")!);

const workflowHrefs = () =>
  within(workflowSections(/keep exploring|read further/i)[0])
    .getAllByRole("link")
    .map((link) => link.getAttribute("href"));

beforeEach(() => {
  routerState.query = {};
  dashboardState.selectedPlayer = null;
  dashboardState.teamAbbreviation = null;
  setViewport(1280);
});

afterEach(cleanup);

describe("WiGO workflow links", () => {
  it("offers only league-wide destinations before a player is selected", () => {
    render(<WigoCharts />);

    expect(screen.getByRole("heading", { name: "Keep exploring" })).toBeTruthy();
    expect(screen.getByText(/^Select a player to add their team HQ and lines/)).toBeTruthy();
    expect(workflowHrefs()).toEqual([
      "/trends",
      "/game-grid/7-Day-Forecast",
      "/start-chart",
    ]);
    expect(screen.queryByRole("link", { name: /team hq/i })).toBeNull();
  });

  it("keeps team links hidden while the selected player's team is unresolved", () => {
    dashboardState.selectedPlayer = { id: 8478402, fullName: "Connor McDavid" };

    render(<WigoCharts />);

    expect(workflowHrefs()).not.toContain("/stats/team/null");
    expect(screen.queryByRole("link", { name: /team lines/i })).toBeNull();
    expect(screen.getByRole("heading", { name: "Take the Connor McDavid read further" })).toBeTruthy();
    expect(screen.getByText(/appear once this player's team is known/)).toBeTruthy();
    expect(screen.queryByText(/Select a player/)).toBeNull();
  });

  it("carries the resolved team into Team HQ and Team Lines without nesting anchors", () => {
    dashboardState.selectedPlayer = {
      id: 8480012,
      fullName: "Jean-Sébastien Dea-Longname-Hyphenated-Placeholder",
    };
    dashboardState.teamAbbreviation = "UTA";

    const { container } = render(<WigoCharts />);

    expect(
      screen.getByRole("heading", {
        name: "Take the Jean-Sébastien Dea-Longname-Hyphenated-Placeholder read further",
      }),
    ).toBeTruthy();
    expect(workflowHrefs()).toEqual([
      "/stats/team/UTA",
      "/lines/UTA",
      "/trends",
      "/game-grid/7-Day-Forecast",
      "/start-chart",
    ]);
    expect(container.querySelector("a a")).toBeNull();
    expect(workflowSections(/read further/i)).toHaveLength(1);
  });

  it("reaches the links by keyboard from the desktop layout", async () => {
    dashboardState.selectedPlayer = { id: 8479318, fullName: "Auston Matthews" };
    dashboardState.teamAbbreviation = "TOR";
    const user = userEvent.setup();

    render(<WigoCharts />);
    await user.tab();

    expect(document.activeElement).toBe(screen.getByRole("link", { name: /team hq/i }));
    await user.tab();
    expect(document.activeElement).toBe(screen.getByRole("link", { name: /team lines/i }));
  });

  it("shows one set of links on narrow screens beneath every mobile tab", () => {
    setViewport(375);
    routerState.query = { tab: "comparison" };
    dashboardState.selectedPlayer = { id: 8479318, fullName: "Auston Matthews" };
    dashboardState.teamAbbreviation = "TOR";

    render(<WigoCharts />);

    expect(screen.getByTestId("wigo-comparison")).toBeTruthy();
    expect(workflowSections(/read further/i)).toHaveLength(1);
    expect(workflowHrefs()[0]).toBe("/stats/team/TOR");
  });

  it("switches layouts on resize without duplicating the links", () => {
    render(<WigoCharts />);
    expect(workflowSections(/keep exploring/i)).toHaveLength(1);

    act(() => {
      setViewport(375);
      window.dispatchEvent(new Event("resize"));
    });

    expect(workflowSections(/keep exploring/i)).toHaveLength(1);
  });
});
