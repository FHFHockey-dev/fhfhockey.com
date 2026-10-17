import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import StatsPage from "pages/stats";
import type { GoalieStat, SkaterStat, StatsProps } from "lib/NHL/statsPageTypes";

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

vi.mock("components/StatsPage/MobileTeamList", () => ({
  default: ({ teamsGridState }: { teamsGridState: string }) => (
    <div data-grid-state={teamsGridState} data-testid="mobile-team-list" />
  ),
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

const emptyStatsProps: StatsProps = {
  skaterSeasonLabel: "2025-26",
  goalieSeasonLabel: "2025-26",
  pointsLeaders: [],
  goalsLeaders: [],
  pppLeaders: [],
  bshLeaders: [],
  skaterLeadersByPosition: {},
  goalieLeadersWins: [],
  goalieLeadersSavePct: [],
  goalieLeadersGAA: [],
  goalieLeadersQS: [],
};

const makeSkater = (position: string, points: number): SkaterStat => ({
  player_id: points,
  fullName: `${position} Leader`,
  current_team_abbreviation: "BOS",
  position,
  points,
  goals: points - 1,
  pp_points: 1,
  blocked_shots: 1,
  shots: 2,
  hits: 3,
  bsh: 6,
  total_primary_assists: 1,
  total_secondary_assists: 0,
  pp_goals: 0,
  sh_goals: 0,
  image_url: "",
});

const leaders = (player: SkaterStat) => ({
  pointsLeaders: [player],
  goalsLeaders: [player],
  pppLeaders: [player],
  bshLeaders: [player],
});

const goalie: GoalieStat = {
  goalie_id: 30,
  fullName: "Goalie Leader",
  current_team_abbreviation: "BOS",
  wins: 3,
  save_pct: 0.925,
  goals_against_avg: 2.1,
  quality_starts_pct: 0.75,
  games_played: 4,
  image_url: "",
};

const populatedStatsProps: StatsProps = {
  ...emptyStatsProps,
  ...leaders(makeSkater("Overall", 20)),
  skaterLeadersByPosition: {
    C: leaders(makeSkater("C", 10)),
    LW: leaders(makeSkater("LW", 9)),
    RW: leaders(makeSkater("RW", 8)),
    D: leaders(makeSkater("D", 7)),
  },
  goalieLeadersWins: [goalie],
  goalieLeadersSavePct: [goalie],
  goalieLeadersGAA: [goalie],
  goalieLeadersQS: [goalie],
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

describe("StatsPage position filtering", () => {
  it.each([
    ["Center", "C", "10"],
    ["Left Wing", "LW", "9"],
    ["Right Wing", "RW", "8"],
    ["Defense", "D", "7"],
  ])("shows %s leaders in desktop, mobile, and key metrics", (label, position, points) => {
    render(<StatsPage {...populatedStatsProps} teams={[]} />);
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Player & Team Stats");

    fireEvent.click(screen.getByRole("radio", { name: label }));

    const skaters = within(screen.getByRole("complementary", { name: "Skater Statistics" }));
    expect(skaters.getAllByText(`${position} Leader`)).toHaveLength(4);
    expect(screen.queryByText("Overall Leader")).toBeNull();
    expect(screen.queryByText("Goalie Leader")).toBeNull();
    expect(screen.getByLabelText("Points Leader value").textContent).toBe(points);
    expect(screen.queryByLabelText("Save Percentage value")).toBeNull();
    const mobile = within(screen.getByRole("region", { name: "Mobile leaderboards" }));
    expect(mobile.getByRole("link", { name: new RegExp(`${position} Leader`) })).toBeDefined();
    expect(mobile.queryByRole("tab", { name: "Goalies" })).toBeNull();

    fireEvent.click(screen.getByRole("radio", { name: "All Players" }));

    expect(skaters.getAllByText("Overall Leader")).toHaveLength(4);
    expect(screen.getByLabelText("Points Leader value").textContent).toBe("20");
    expect(screen.getByLabelText("Save Percentage value").textContent).toBe(".925");
    expect(mobile.getByRole("tab", { name: "Goalies" })).toBeDefined();
  });

  it("shows only goalie leaders and metrics when Goalie is selected", () => {
    render(<StatsPage {...populatedStatsProps} teams={[]} />);
    fireEvent.click(screen.getByRole("radio", { name: "Goalie" }));

    expect(screen.queryByText("Overall Leader")).toBeNull();
    expect(screen.queryByLabelText("Points Leader value")).toBeNull();
    expect(screen.getByLabelText("Save Percentage value").textContent).toBe(".925");
    const goalies = within(screen.getByRole("complementary", { name: "Goaltender Statistics" }));
    expect(goalies.getAllByText("Goalie Leader")).toHaveLength(4);
    const mobile = within(screen.getByRole("region", { name: "Mobile leaderboards" }));
    expect(mobile.getByRole("tab", { name: "Goalies" }).getAttribute("aria-selected")).toBe("true");
    expect(mobile.getByRole("link", { name: /Goalie Leader/ })).toBeDefined();
    expect(mobile.queryByRole("tab", { name: "Skaters" })).toBeNull();
  });

  it("shows position-specific empty states without inventing zero stats", () => {
    render(<StatsPage {...populatedStatsProps} skaterLeadersByPosition={{}} teams={[]} />);
    fireEvent.click(screen.getByRole("radio", { name: "Defense" }));

    expect(screen.getAllByText("No defense leaders available for this season.")).toHaveLength(2);
    expect(screen.getByLabelText("Points Leader value").textContent).toBe("—");
    expect(screen.getByLabelText("Goals Leader value").textContent).toBe("—");
    expect(screen.queryByText("Overall Leader")).toBeNull();
  });

  it("moves keyboard focus with the selected radio and wraps through filters", () => {
    render(<StatsPage {...populatedStatsProps} teams={[]} />);
    const allPlayers = screen.getByRole("radio", { name: "All Players" });
    allPlayers.focus();
    fireEvent.keyDown(allPlayers, { key: "ArrowLeft" });

    const goalieFilter = screen.getByRole("radio", { name: "Goalie" });
    expect(document.activeElement).toBe(goalieFilter);
    expect(goalieFilter.getAttribute("aria-checked")).toBe("true");
    expect(screen.queryByLabelText("Points Leader value")).toBeNull();

    fireEvent.keyDown(goalieFilter, { key: "ArrowRight" });
    expect(document.activeElement).toBe(allPlayers);
    expect(allPlayers.getAttribute("aria-checked")).toBe("true");
    expect(screen.getByLabelText("Points Leader value").textContent).toBe("20");
  });
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
