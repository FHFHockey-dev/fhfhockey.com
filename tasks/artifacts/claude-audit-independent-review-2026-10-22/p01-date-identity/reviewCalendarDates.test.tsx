import React from "react";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { ScheduleGame } from "hooks/useTeamSchedule";
import type { TeamPowerRatingRow } from "lib/teamOpponentStrength";

const mocks = vi.hoisted(() => ({ from: vi.fn(), in: vi.fn(), range: vi.fn(), wgo: vi.fn() }));
vi.mock("lib/supabase", () => ({ default: { from: mocks.from } }));
vi.mock("hooks/useTeamScheduleWgoStats", () => ({ useTeamScheduleWgoStats: mocks.wgo }));
import { TeamScheduleCalendar } from "components/TeamScheduleCalendar/TeamScheduleCalendar";

function game(gameDate: string, startTimeUTC: string): ScheduleGame {
  const year = Number(gameDate.slice(0, 4));
  const seasonStart = Number(gameDate.slice(5, 7)) >= 7 ? year : year - 1;
  return {
    id: 2026020001, season: Number(`${seasonStart}${seasonStart + 1}`), gameType: 2,
    gameDate, startTimeUTC, venue: { default: "Fixture arena" },
    easternUTCOffset: "-05:00", venueUTCOffset: "-05:00", tvBroadcasts: [],
    gameState: "FINAL", gameScheduleState: "OK", homeTeamScore: 1, awayTeamScore: 2,
    periodDescriptor: { number: 3, periodType: "REG" },
    homeTeam: { id: 22, placeName: { default: "Edmonton" }, abbrev: "EDM", logo: "", darkLogo: "" },
    awayTeam: { id: 6, placeName: { default: "Boston" }, abbrev: "BOS", logo: "", darkLogo: "" },
  };
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2028-03-05T12:00:00Z"));
  mocks.wgo.mockReturnValue({ stats: [], loading: false, error: null });
  const query = { select: () => query, in: mocks.in, order: () => query, range: mocks.range };
  mocks.from.mockReturnValue(query);
  mocks.in.mockReturnValue(query);
  mocks.range.mockResolvedValue({ data: [], error: null });
});
afterEach(() => { cleanup(); vi.useRealTimers(); });

async function mount(value: ScheduleGame) {
  await act(async () => {
    render(<TeamScheduleCalendar games={[value]} teamId={22} teamAbbreviation="EDM" seasonId={String(value.season)} />);
  });
  return screen.getByText("vs BOS").parentElement!.parentElement!;
}

it.each([
  ["2026-10-19", "2026-10-20T02:00:00Z", "Oct 19, 2026", "Monday, October 19, 2026", "10:00 PM EDT"],
  ["2026-03-08", "2026-03-08T06:30:00Z", "Mar 8, 2026", "Sunday, March 8, 2026", "1:30 AM EST"],
  ["2026-03-08", "2026-03-08T07:30:00Z", "Mar 8, 2026", "Sunday, March 8, 2026", "3:30 AM EDT"],
  ["2026-11-01", "2026-11-01T05:30:00Z", "Nov 1, 2026", "Sunday, November 1, 2026", "1:30 AM EDT"],
  ["2026-11-01", "2026-11-01T06:30:00Z", "Nov 1, 2026", "Sunday, November 1, 2026", "1:30 AM EST"],
  ["2026-12-31", "2027-01-01T02:00:00Z", "Dec 31, 2026", "Thursday, December 31, 2026", "9:00 PM EST"],
  ["2028-02-29", "2028-03-01T00:30:00Z", "Feb 29, 2028", "Tuesday, February 29, 2028", "7:30 PM EST"],
])("retains date %s and formats instant %s independently of the host zone", async (date, instant, shortDate, longDate, time) => {
  const day = await mount(game(date, instant));
  expect(within(day).getByText(String(Number(date.slice(8, 10))))).toBeTruthy();
  fireEvent.mouseEnter(day);
  expect(screen.getByText(shortDate)).toBeTruthy();
  fireEvent.mouseLeave(day);
  fireEvent.click(day);
  expect(screen.getByText(longDate)).toBeTruthy();
  expect(screen.getByText(time)).toBeTruthy();
});

function league(date: string, bostonStrong: boolean): TeamPowerRatingRow[] {
  return Array.from({ length: 32 }, (_, index) => ({
    date, team_abbreviation: index === 0 ? "BOS" : `T${String(index).padStart(2, "0")}`,
    off_rating: index === 0 ? (bostonStrong ? 100 : -100) : 0,
    def_rating: 0, pace_rating: 0, pp_tier: 0, pk_tier: 0, trend10: 0,
  }));
}

it.each([true, false])("selects the October 19 opponent-strength snapshot (BOS strong=%s), not October 18", async (strong) => {
  const rows = [...league("2026-10-18", !strong), ...league("2026-10-19", strong)];
  let dates: string[] = [];
  const query = { select: () => query, in: mocks.in, order: () => query, range: mocks.range };
  mocks.from.mockReturnValue(query);
  mocks.in.mockImplementation((column: string, values: string[]) => {
    expect(column).toBe("date"); dates = values; return query;
  });
  mocks.range.mockImplementation(async () => ({ data: rows.filter(row => dates.includes(row.date)), error: null }));
  const day = await mount(game("2026-10-19", "2026-10-19T23:00:00Z"));
  expect(mocks.from).toHaveBeenCalledWith("team_power_ratings_daily");
  expect(dates).toEqual(["2026-10-19"]);
  fireEvent.mouseEnter(day);
  expect(screen.getByText(strong ? "STRONG" : "WEAK", { exact: true })).toBeTruthy();
});

it("selects October 19 WGO result and performance values together", async () => {
  // Synthetic cumulative rows isolate date-key selection only; grain is not certified.
  mocks.wgo.mockReturnValue({ stats: [
    { date: "2026-10-18", points: 0, games_played: 1, goals_for: 1, goals_against: 2, shots_for_per_game: 20, shots_against_per_game: 30 },
    { date: "2026-10-19", points: 2, games_played: 2, goals_for: 6, goals_against: 3, shots_for_per_game: 35, shots_against_per_game: 30 },
  ], loading: false, error: null });
  const day = await mount(game("2026-10-19", "2026-10-19T23:00:00Z"));
  fireEvent.mouseEnter(day);
  const header = screen.getByText("Oct 19, 2026").parentElement!;
  expect(within(header).getByText("Win", { exact: true })).toBeTruthy();
  expect(within(screen.getByText("Goal Diff:").parentElement!).getByText("+4")).toBeTruthy();
  expect(within(screen.getByText("Shots:").parentElement!).getByText("50-30")).toBeTruthy();
});
