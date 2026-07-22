import { cleanup, fireEvent, render, screen } from "@testing-library/react";
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
  default: () => null,
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
