import { describe, expect, it } from "vitest";
import { DAYS, EXTENDED_DAYS, GameData, WeekData } from "lib/NHL/types";
import { calcTotalGP } from "../TotalGamesPerDayRow";
import { convertTeamRowToWinOddsList } from "./calcWinOdds";
import { getRegularGamesPerDay } from "./helper";
import { getSelectedOpponentIds, getTeamScheduleSummary } from "./scheduleSummary";

function game(id: number, winOdds: number | null = 50, gameType = 2, opponent = 2): GameData {
  return { id, season: 20262027, gameType,
    homeTeam: { id: 1, winOdds }, awayTeam: { id: opponent, winOdds: 50 } };
}

describe("selected Game Grid scoring period", () => {
  const row: WeekData & { teamId: number; weekNumber: number } = {
    teamId: 1, weekNumber: 1,
    MON: game(1, 20), TUE: game(2, 80), SUN: game(3, 60),
    nMON: game(4, 40, 2, 3), nWED: game(5, 100, 2, 4)
  };
  const counts = [7, 9, 0, 0, 0, 0, 8, 7, 0, 1];

  it("keeps every score input inside the seven-day horizon", () => {
    const summary = getTeamScheduleSummary(row, counts, [], DAYS);
    expect(summary.totalGamesPlayed).toBe(3);
    expect(summary.totalOffNights).toBe(2);
    expect(convertTeamRowToWinOddsList(row)).toEqual([20, 60, null, null, null, null, 60]);
    expect(summary.weekScore).toBeCloseTo(6 * (3 - 24 / 16) + 4 * (4 / 7) + .15 * (140 / 3));
    expect(getTeamScheduleSummary({ ...row, nWED: game(5, 0) }, counts)).toEqual(summary);
    expect(getSelectedOpponentIds(row)).toEqual([2, 2, 2]);
  });

  it("includes all ten days, including a Sunday-to-next-Monday back-to-back", () => {
    const odds = convertTeamRowToWinOddsList(row, [], EXTENDED_DAYS);
    expect(odds).toEqual([20, 60, null, null, null, null, 60, 30, null, 100]);
    const summary = getTeamScheduleSummary(row, counts, [], EXTENDED_DAYS);
    expect(summary.totalGamesPlayed).toBe(5);
    expect(summary.totalOffNights).toBe(4);
    expect(summary.weekScore).toBeCloseTo(6 * (5 - 32 / 16) + 4 * (3 * 2 / 7 + 11 / 28) + .15 * 54);
    expect(getSelectedOpponentIds(row, [], EXTENDED_DAYS)).toEqual([2, 2, 2, 3, 4]);
  });

  it("removes an excluded extended day from counts, odds, normalization, and opponents", () => {
    const summary = getTeamScheduleSummary(row, counts, ["nMON"], EXTENDED_DAYS);
    expect(summary.totalGamesPlayed).toBe(4);
    expect(summary.totalOffNights).toBe(3);
    expect(summary.weekScore).toBeCloseTo(6 * (4 - 25 / 16) + 4 * (4 / 7 + 11 / 28) + .15 * 60);
    expect(calcTotalGP(counts, ["nMON"], EXTENDED_DAYS)).toBe(25);
    expect(getSelectedOpponentIds(row, ["nMON"], EXTENDED_DAYS)).toEqual([2, 2, 2, 4]);
  });

  it("excludes Monday odds but retains Tuesday's existing schedule fatigue", () => {
    expect(convertTeamRowToWinOddsList(row, ["MON"]).slice(0, 2)).toEqual([null, 60]);
    const summary = getTeamScheduleSummary(row, counts, ["MON"]);
    expect(summary.totalGamesPlayed).toBe(2);
    expect(summary.totalOffNights).toBe(1);
    expect(summary.weekScore).toBeCloseTo(6 * (2 - 17 / 16) + 4 * (2 / 7) + .15 * 60);
    expect(getTeamScheduleSummary({ ...row, MON: game(1, 99) }, counts, ["MON"])).toEqual(summary);
  });

  it("retains the zero-games sentinel and existing missing-odds behavior", () => {
    expect(getTeamScheduleSummary(row, counts, [...EXTENDED_DAYS], EXTENDED_DAYS).weekScore).toBe(-100);
    const missing = { teamId: 1, MON: game(1, null), WED: game(2, 40) };
    expect(getTeamScheduleSummary(missing, [7, 0, 7, 0, 0, 0, 0]).weekScore)
      .toBeCloseTo(6 * (2 - 14 / 16) + 4 * (4 / 7) + .15 * 40);
  });

  it("uses the same regular-season definition and 8-game off-night threshold", () => {
    const mixed = { teamId: 1, MON: game(1), TUE: game(2), WED: game(3, 50, 1), THU: game(4, 50, 3) };
    const summary = getTeamScheduleSummary(mixed, [8, 9, 1, 1, 0, 0, 0]);
    expect(summary.totalGamesPlayed).toBe(2);
    expect(summary.totalOffNights).toBe(1);
    expect(getSelectedOpponentIds(mixed)).toEqual([2, 2]);
    expect(convertTeamRowToWinOddsList({ ...mixed, weekNumber: 1 })).toEqual([50, 37.5, null, null, null, null, null]);
  });

  it("deduplicates both team appearances and excludes preseason/playoff league games", () => {
    const regular = game(1);
    const rows = [{ MON: regular, TUE: game(2, 50, 1), nMON: game(4) },
      { MON: regular, WED: game(3, 50, 3), nMON: game(4) }];
    expect(getRegularGamesPerDay(rows)).toEqual([1, 0, 0, 0, 0, 0, 0]);
    expect(getRegularGamesPerDay(rows, EXTENDED_DAYS)).toEqual([1, 0, 0, 0, 0, 0, 0, 1, 0, 0]);
  });
});
