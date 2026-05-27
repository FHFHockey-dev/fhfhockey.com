import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import MobileTabInterface from "./MobileTabInterface";
import type { GoalieStat, SkaterStat } from "lib/NHL/statsPageTypes";

vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: any) => (
    <a href={href} {...props}>
      {children}
    </a>
  )
}));

afterEach(() => {
  cleanup();
});

const skater = (overrides: Partial<SkaterStat>): SkaterStat => ({
  player_id: 1,
  fullName: "Connor McDavid",
  current_team_abbreviation: "EDM",
  points: 120,
  goals: 40,
  pp_points: 45,
  blocked_shots: 20,
  shots: 260,
  hits: 50,
  bsh: 330,
  total_primary_assists: 45,
  total_secondary_assists: 35,
  pp_goals: 12,
  sh_goals: 1,
  pp_primary_assists: 20,
  pp_secondary_assists: 13,
  image_url: "",
  sweater_number: 97,
  position: "C",
  ...overrides
});

const goalie = (overrides: Partial<GoalieStat>): GoalieStat => ({
  goalie_id: 30,
  fullName: "Igor Shesterkin",
  current_team_abbreviation: "NYR",
  wins: 36,
  save_pct: 0.921,
  goals_against_avg: 2.32,
  quality_starts_pct: 0.64,
  games_played: 58,
  image_url: "",
  sweater_number: 31,
  ...overrides
});

function renderMobileTabs() {
  return render(
    <MobileTabInterface
      pointsLeaders={[
        skater({ player_id: 97, fullName: "Connor McDavid" }),
        skater({ player_id: 29, fullName: "Nathan MacKinnon", points: 116 })
      ]}
      goalsLeaders={[skater({ player_id: 34, fullName: "Auston Matthews", goals: 69 })]}
      pppLeaders={[skater({ player_id: 86, fullName: "Nikita Kucherov", pp_points: 53 })]}
      bshLeaders={[skater({ player_id: 8, fullName: "Alex Ovechkin", bsh: 390 })]}
      goalieLeadersWins={[goalie({ goalie_id: 35, fullName: "Connor Hellebuyck", wins: 42 })]}
      goalieLeadersSavePct={[goalie({ goalie_id: 31, fullName: "Igor Shesterkin" })]}
      goalieLeadersGAA={[goalie({ goalie_id: 72, fullName: "Sergei Bobrovsky", goals_against_avg: 2.19 })]}
      goalieLeadersQS={[goalie({ goalie_id: 1, fullName: "Jeremy Swayman", quality_starts_pct: 0.711 })]}
    />
  );
}

describe("MobileTabInterface", () => {
  it("renders skater leaderboards as touch-friendly player links by default", () => {
    renderMobileTabs();

    expect(
      screen.getByRole("tab", { name: "Skaters" }).getAttribute("aria-selected")
    ).toBe("true");

    const pointsLink = screen.getByRole("link", { name: /Connor McDavid/i });
    expect(pointsLink.getAttribute("href")).toBe("/stats/player/97");
    expect(within(pointsLink).getByText("120")).toBeDefined();
    expect(screen.queryByText("Auston Matthews")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: /Goals/i }));

    const goalsLink = screen.getByRole("link", { name: /Auston Matthews/i });
    expect(goalsLink.getAttribute("href")).toBe("/stats/player/34");
    expect(within(goalsLink).getByText("69")).toBeDefined();
  });

  it("switches to goalie leaderboards and keeps stat groups expandable", () => {
    renderMobileTabs();

    fireEvent.click(screen.getByRole("tab", { name: "Goalies" }));

    expect(
      screen.getByRole("tab", { name: "Goalies" }).getAttribute("aria-selected")
    ).toBe("true");

    const savePctLink = screen.getByRole("link", { name: /Igor Shesterkin/i });
    expect(savePctLink.getAttribute("href")).toBe("/stats/player/31");
    expect(within(savePctLink).getByText(".921")).toBeDefined();
    expect(screen.queryByText("Connor Hellebuyck")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: /Wins/i }));

    const winsLink = screen.getByRole("link", { name: /Connor Hellebuyck/i });
    expect(winsLink.getAttribute("href")).toBe("/stats/player/35");
    expect(within(winsLink).getByText("42")).toBeDefined();
  });

  it("shows a compact empty state when a mobile section has no rows", () => {
    render(
      <MobileTabInterface
        pointsLeaders={[]}
        goalsLeaders={[]}
        pppLeaders={[]}
        bshLeaders={[]}
        goalieLeadersWins={[]}
        goalieLeadersSavePct={[]}
        goalieLeadersGAA={[]}
        goalieLeadersQS={[]}
      />
    );

    expect(screen.getByText("No leaders available.")).toBeDefined();
  });
});
