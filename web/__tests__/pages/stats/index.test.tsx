import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import StatsPage from "pages/stats";

vi.mock("next/image", () => ({
  default: ({
    priority: _priority,
    fill: _fill,
    alt = "",
    ...props
  }: React.ImgHTMLAttributes<HTMLImageElement> & {
    fill?: boolean;
    priority?: boolean;
  }) => React.createElement("img", { ...props, alt }),
}));

vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: React.ComponentProps<"a">) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock("components/StatsPage/LeaderboardCategory", () => ({
  default: () => null,
}));
vi.mock("components/StatsPage/LeaderboardCategoryBSH", () => ({
  default: () => null,
}));
vi.mock("components/StatsPage/LeaderboardCategoryGoalie", () => ({
  default: () => null,
}));
vi.mock("components/StatsPage/MobileTeamList", () => ({
  default: ({ teamsGridState }: { teamsGridState: string }) => (
    <div data-grid-state={teamsGridState} data-testid="mobile-team-list" />
  ),
}));
vi.mock("components/StatsPage/MobileTabInterface", () => ({
  default: () => null,
}));
vi.mock("components/StatsPage/PlayerSearchBar", () => ({
  default: () => null,
}));
vi.mock("components/GoalieShareChart", () => ({
  default: () => null,
}));
vi.mock("lib/supabase", () => ({ default: {} }));
vi.mock("lib/NHL/client", () => ({ getCurrentSeason: vi.fn() }));
vi.mock("lib/NHL/server", () => ({ getTeams: vi.fn() }));

const emptyStatsProps = {
  skaterSeasonLabel: "2025-26",
  goalieSeasonLabel: "2025-26",
  pointsLeaders: [],
  goalsLeaders: [],
  pppLeaders: [],
  bshLeaders: [],
  goalieLeadersWins: [],
  goalieLeadersSavePct: [],
  goalieLeadersGAA: [],
  goalieLeadersQS: [],
};

beforeEach(() => {
  Object.defineProperty(window, "innerWidth", {
    configurable: true,
    value: 1024,
  });
  Object.defineProperty(window, "scrollY", {
    configurable: true,
    value: 0,
  });
  vi.spyOn(console, "log").mockImplementation(() => undefined);
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("StatsPage team logos", () => {
  it("uses the shared wrapper fallback for desktop failures and blank abbreviations", () => {
    render(
      <StatsPage
        {...emptyStatsProps}
        teams={[
          {
            team_id: 6,
            name: "Boston Bruins",
            abbreviation: "BOS",
          },
          {
            team_id: 999,
            name: "Unknown Team",
            abbreviation: "",
          },
        ]}
      />,
    );

    const bruinsLogo = screen.getByRole("img", { name: "Boston Bruins" });
    expect(bruinsLogo.getAttribute("src")).toBe("/teamLogos/BOS.png");

    fireEvent.error(bruinsLogo);

    expect(
      screen.getByRole("img", { name: "Boston Bruins" }).getAttribute("src"),
    ).toBe("/teamLogos/FHFH.png");
    expect(
      screen.getByRole("img", { name: "Unknown Team" }).getAttribute("src"),
    ).toBe("/teamLogos/FHFH.png");
    expect(document.querySelector('img[src*="default.png"]')).toBeNull();
  });
});

describe("StatsPage mobile team grid", () => {
  it("morphs through one stable passive scroll listener and cancels pending work", async () => {
    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      value: 430,
    });

    let nextFrameId = 0;
    const callbacks = new Map<number, FrameRequestCallback>();
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
      nextFrameId += 1;
      callbacks.set(nextFrameId, callback);
      return nextFrameId;
    });
    const cancelFrame = vi
      .spyOn(window, "cancelAnimationFrame")
      .mockImplementation((frameId) => {
        callbacks.delete(frameId);
      });
    const addEventListener = vi.spyOn(window, "addEventListener");

    const { unmount } = render(<StatsPage {...emptyStatsProps} teams={[]} />);
    const mobileTeamList = await screen.findByTestId("mobile-team-list");

    const runLatestFrame = () => {
      const frameId = nextFrameId;
      const callback = callbacks.get(frameId);
      expect(callback).toBeDefined();
      callbacks.delete(frameId);
      act(() => callback?.(frameId));
    };

    Object.defineProperty(window, "scrollY", {
      configurable: true,
      value: 100,
    });
    fireEvent.scroll(window);
    runLatestFrame();
    await waitFor(() =>
      expect(mobileTeamList.getAttribute("data-grid-state")).toBe("collapsed"),
    );

    Object.defineProperty(window, "scrollY", {
      configurable: true,
      value: 0,
    });
    fireEvent.scroll(window);
    runLatestFrame();
    await waitFor(() =>
      expect(mobileTeamList.getAttribute("data-grid-state")).toBe("expanded"),
    );

    expect(
      addEventListener.mock.calls.filter(([event]) => event === "scroll"),
    ).toHaveLength(1);

    fireEvent.scroll(window);
    const pendingFrameId = nextFrameId;
    unmount();
    expect(cancelFrame).toHaveBeenCalledWith(pendingFrameId);
  });
});
