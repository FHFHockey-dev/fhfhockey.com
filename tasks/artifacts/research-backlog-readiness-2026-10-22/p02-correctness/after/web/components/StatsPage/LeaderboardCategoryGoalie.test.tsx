import React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import LeaderboardCategoryGoalie from "./LeaderboardCategoryGoalie";
import type { GoalieStat } from "lib/NHL/statsPageTypes";

vi.mock("./LeaderboardHeadshot", () => ({ default: () => null }));
vi.mock("next/link", () => ({ default: ({ children, href }: any) => <a href={href}>{children}</a> }));
afterEach(cleanup);

const goalie: GoalieStat = { goalie_id: 999001, fullName: "Synthetic Goalie", current_team_abbreviation: "SYN",
  wins: 0, save_pct: 0, goals_against_avg: 0, quality_starts_pct: 0, games_played: 1, image_url: "" };

it.each([
  ["save_pct", ".000"], ["goals_against_avg", "0.00"], ["quality_starts_pct", "0.0"]
] as const)("P02: renders observed zero %s instead of unavailable", (statKey, displayed) => {
  render(<LeaderboardCategoryGoalie title="Goalies" leaders={[goalie]} statKey={statKey} />);
  expect(screen.getByText(displayed)).toBeTruthy();
});

it("P02: empty qualified ranking has an unavailable state", () => {
  render(<LeaderboardCategoryGoalie title="GAA" leaders={[]} statKey="goals_against_avg" />);
  expect(screen.getByText("No goalie data available.")).toBeTruthy();
});
