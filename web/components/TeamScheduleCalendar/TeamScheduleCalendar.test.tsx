import React from "react";
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ScheduleGame, TeamStandingsDetails } from "hooks/useTeamSchedule";

vi.mock("lib/supabase", () => ({
  default: {
    from: () => {
      const query = {
        select: () => query,
        in: () => query,
        order: () => query,
        range: async () => ({ data: [], error: null }),
      };
      return query;
    },
  },
}));

vi.mock("hooks/useTeamScheduleWgoStats", () => ({
  useTeamScheduleWgoStats: () => ({ stats: [], loading: false, error: null }),
}));

import { TeamScheduleCalendar } from "./TeamScheduleCalendar";

function game(index: number, overrides: Partial<ScheduleGame> = {}): ScheduleGame {
  return {
    id: 2024020001 + index,
    season: 20242025,
    gameType: 2,
    gameDate: `2025-01-${String(index + 1).padStart(2, "0")}`,
    venue: { default: "Test arena" },
    startTimeUTC: "2025-01-01T19:00:00Z",
    easternUTCOffset: "-05:00",
    venueUTCOffset: "-05:00",
    tvBroadcasts: [],
    gameState: "FINAL",
    gameScheduleState: "OK",
    homeTeamScore: index < 2 ? 3 : 1,
    awayTeamScore: 2,
    periodDescriptor: { number: index >= 8 ? 4 : 3, periodType: index >= 8 ? "OT" : "REG" },
    homeTeam: { id: 22, placeName: { default: "Edmonton" }, abbrev: "EDM", logo: "", darkLogo: "" },
    awayTeam: { id: 6, placeName: { default: "Boston" }, abbrev: "BOS", logo: "", darkLogo: "" },
    ...overrides,
  };
}

function standings(overrides: Partial<TeamStandingsDetails> = {}): TeamStandingsDetails {
  return {
    season_id: 20242025,
    date: "2025-01-15",
    team_abbrev: "EDM",
    wins: 2,
    losses: 6,
    ot_losses: 3,
    points: 7,
    games_played: 11,
    home_wins: 2,
    home_losses: 6,
    home_ot_losses: 3,
    home_games_played: 11,
    road_wins: 0,
    road_losses: 0,
    road_ot_losses: 0,
    road_games_played: 0,
    goal_differential: -5,
    goal_for: 15,
    goal_against: 20,
    streak_code: "L",
    streak_count: 3,
    l10_wins: 1,
    l10_losses: 6,
    l10_ot_losses: 3,
    l10_games_played: 10,
    l10_points: 5,
    l10_goal_differential: -6,
    home_goals_for: 15,
    home_goals_against: 20,
    road_goals_for: 0,
    road_goals_against: 0,
    league_sequence: 30,
    ...overrides,
  };
}

function card(heading: string) {
  return within(screen.getByRole("heading", { name: heading }).parentElement!);
}

function renderCalendar(games: ScheduleGame[], details: TeamStandingsDetails | null) {
  return render(
    <TeamScheduleCalendar games={games} teamId={22} teamAbbreviation="EDM" seasonId="20242025" standingsDetails={details} />,
  );
}

describe("TeamScheduleCalendar season standings", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2025-01-20T12:00:00Z"));
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("shows 7 NHL points for a 2–6–3 record across eleven completed games", () => {
    renderCalendar(Array.from({ length: 11 }, (_, index) => game(index)), standings());

    expect(card("Season Record").getByText("2-6-3")).toBeTruthy();
    expect(card("Season Record").getByText("7 pts")).toBeTruthy();
    expect(card("Season Record").getByText("31.8%")).toBeTruthy();
    expect(card("Season Overview").getByText("11")).toBeTruthy();
  });

  it("keeps the season summary authoritative when calendar coverage is sparse and mixed", () => {
    renderCalendar([
      game(0),
      game(1, { gameType: 1 }),
      game(2, { gameType: 3 }),
      game(3, { gameType: 0 }),
      game(4, { gameState: "LIVE", homeTeamScore: 4 }),
      game(5, { gameState: "FUT", gameScheduleState: "PPD" }),
      game(6, { homeTeamScore: undefined }),
      game(7, { gameDate: "2025-01-30", gameState: "FUT" }),
    ], standings({ wins: 3, losses: 0, ot_losses: 2, points: 8, games_played: 5 }));

    expect(card("Season Record").getByText("3-0-2")).toBeTruthy();
    expect(card("Season Record").getByText("8 pts")).toBeTruthy();
    expect(card("Season Record").getByText("80.0%")).toBeTruthy();
    expect(card("Season Overview").getByText("5")).toBeTruthy();
    expect(card("Season Overview").getByText("60.0%")).toBeTruthy();
    expect(card("Season Overview").getByText("80.0%")).toBeTruthy();
  });

  it.each([
    null,
    standings({ season_id: 20232024 }),
    standings({ team_abbrev: "BOS" }),
    standings({ points: null as unknown as number }),
    standings({ games_played: 10 }),
  ])("does not reconstruct an authoritative record when its snapshot is unavailable or invalid", (details) => {
    renderCalendar([game(0)], details);
    expect(card("Season Record").getByText("Standings unavailable")).toBeTruthy();
    expect(card("Season Overview").getByText("Standings unavailable")).toBeTruthy();
    expect(card("Season Record").queryByText(/pts$/)).toBeNull();
  });

  it("retains genuine zero points and leaves zero-game percentages unavailable", () => {
    renderCalendar([game(0, { gameState: "FUT", gameDate: "2025-01-30" })], standings({
      wins: 0, losses: 0, ot_losses: 0, points: 0, games_played: 0,
    }));
    expect(card("Season Record").getByText("0-0-0")).toBeTruthy();
    expect(card("Season Record").getByText("0 pts")).toBeTruthy();
    expect(card("Season Record").queryByText("0.0%")).toBeNull();
    expect(card("Season Overview").getByText("0")).toBeTruthy();
  });
});
