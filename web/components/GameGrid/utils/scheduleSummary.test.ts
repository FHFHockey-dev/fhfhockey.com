import { describe, expect, it } from "vitest";
import { DAYS, EXTENDED_DAYS, GameData, WeekData } from "lib/NHL/types";
import { calcTotalGP } from "../TotalGamesPerDayRow";
import { convertTeamRowToWinOddsList } from "./calcWinOdds";
import { getRegularGamesPerDay } from "./helper";
import { getSelectedOpponentIds, getTeamScheduleSummary, getOpponentPointPct, getFourWeekAverages, getFourWeekScore } from "./scheduleSummary";

function game(id: number, winOdds: number | null = 50, gameType = 2, opponent = 2): GameData {
  return { id, season: 20262027, gameType,
    homeTeam: { id: 1, winOdds }, awayTeam: { id: opponent, winOdds: 50 } };
}

describe("selected Game Grid scoring period", () => {
  it("preserves repeated standings weighting, real zero and unknown coverage", () => {
    expect(getOpponentPointPct([{ teamId: 2 }, { teamId: 2 }, { teamId: 3 }], { 2: 0, 3: .6 }))
      .toEqual({ value: .6 / 3, coverage: { known: 3, expected: 3 } });
    expect(getOpponentPointPct([{ teamId: 2 }, { teamId: 3 }], { 2: .6, 3: NaN }))
      .toEqual({ value: null, coverage: { known: 1, expected: 2 } });
  });
  it("excludes unknown OPP from the league mean and makes its score contribution neutral", () => {
    const teams = [0.4, 0.8, null].map((avgOpponentPointPct, i) => ({
      teamId: i, teamAbbreviation: `T${i}`, weeks: [], avgOpponentPointPct,
      totals: { gamesPlayed: 4, offNights: 2, opponents: [] }
    }));
    const averages = getFourWeekAverages(teams);
    expect(averages.avgOpponentPointPct).toBeCloseTo(.6);
    expect(getFourWeekScore(teams[0], averages)).toBeCloseTo(.2);
    expect(getFourWeekScore(teams[2], averages)).toBe(0);
    const unknown = { ...teams[2], totals: { ...teams[2].totals, scheduleCoverage: { known: 21, expected: 28 } } };
    expect(getFourWeekScore(unknown, averages)).toBeNull();
    expect(getFourWeekAverages([unknown]).gamesPlayed).toBeNull();
  });

  it.each(["PPD", "CNCL", "POSTPONED", "CANCELLED"])("excludes %s from every opportunity and score input", (state) => {
    for (const field of ["gameScheduleState", "gameState"] as const) {
      const inactive = { ...game(1), [field]: state };
      const row = { teamId: 1, weekNumber: 1, MON: inactive, TUE: game(2) };
      const counts = getRegularGamesPerDay([row]);
      expect(counts).toEqual([0, 1, 0, 0, 0, 0, 0]);
      expect(getTeamScheduleSummary(row, counts)).toMatchObject({ totalGamesPlayed: 1, totalOffNights: 1 });
      expect(getSelectedOpponentIds(row)).toEqual([2]);
      expect(convertTeamRowToWinOddsList(row)).toEqual([null, 50, null, null, null, null, null]);
    }
  });

  it("retains completed games in full-calendar inputs", () => {
    const row = { teamId: 1, MON: { ...game(1), gameState: "FINAL", gameScheduleState: "OK" } };
    expect(getTeamScheduleSummary(row, getRegularGamesPerDay([row])).totalGamesPlayed).toBe(1);
  });

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
    expect(summary.weekScore).toBeCloseTo(6 * (3 - 24 / 16) + 4 * 2 + (140 / 3) / 100 - .5);
    expect(getTeamScheduleSummary({ ...row, nWED: game(5, 0) }, counts)).toEqual(summary);
    expect(getSelectedOpponentIds(row)).toEqual([2, 2, 2]);
  });

  it("includes all ten days, including a Sunday-to-next-Monday back-to-back", () => {
    const odds = convertTeamRowToWinOddsList(row, [], EXTENDED_DAYS);
    expect(odds).toEqual([20, 60, null, null, null, null, 60, 30, null, 100]);
    const summary = getTeamScheduleSummary(row, counts, [], EXTENDED_DAYS);
    expect(summary.totalGamesPlayed).toBe(5);
    expect(summary.totalOffNights).toBe(4);
    expect(summary.weekScore).toBeCloseTo(6 * (5 - 32 / 16) + 4 * 4 + .54 - .5);
    expect(getSelectedOpponentIds(row, [], EXTENDED_DAYS)).toEqual([2, 2, 2, 3, 4]);
  });

  it("removes an excluded extended day from counts, odds, normalization, and opponents", () => {
    const summary = getTeamScheduleSummary(row, counts, ["nMON"], EXTENDED_DAYS);
    expect(summary.totalGamesPlayed).toBe(4);
    expect(summary.totalOffNights).toBe(3);
    expect(summary.weekScore).toBeCloseTo(6 * (4 - 25 / 16) + 4 * 3 + .60 - .5);
    expect(calcTotalGP(counts, ["nMON"], EXTENDED_DAYS)).toBe(25);
    expect(getSelectedOpponentIds(row, ["nMON"], EXTENDED_DAYS)).toEqual([2, 2, 2, 4]);
  });

  it("excludes Monday odds but retains Tuesday's existing schedule fatigue", () => {
    expect(convertTeamRowToWinOddsList(row, ["MON"]).slice(0, 2)).toEqual([null, 60]);
    const summary = getTeamScheduleSummary(row, counts, ["MON"]);
    expect(summary.totalGamesPlayed).toBe(2);
    expect(summary.totalOffNights).toBe(1);
    expect(summary.weekScore).toBeCloseTo(6 * (2 - 17 / 16) + 4 + .60 - .5);
    expect(getTeamScheduleSummary({ ...row, MON: game(1, 99) }, counts, ["MON"])).toEqual(summary);
  });

  it("retains the zero-games sentinel and gives missing game odds a neutral contribution", () => {
    expect(getTeamScheduleSummary(row, counts, [...EXTENDED_DAYS], EXTENDED_DAYS).weekScore).toBe(-100);
    const missing = { teamId: 1, MON: game(1, null), WED: game(2, 40) };
    expect(getTeamScheduleSummary(missing, [7, 0, 7, 0, 0, 0, 0]).weekScore)
      .toBeCloseTo(6 * (2 - 14 / 16) + 4 * 2 + (.40 - .5) / 2);
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

  it("counts all off nights equally despite different league-night density", () => {
    const row = { teamId: 1, MON: game(1), WED: game(2) };
    // Keep total league games equal so only off-night density changes.
    expect(getTeamScheduleSummary(row, [1, 15, 1, 15, 0, 0, 0]).weekScore)
      .toBe(getTeamScheduleSummary(row, [8, 8, 8, 8, 0, 0, 0]).weekScore);
  });
  it("adds one crowding term from included games only and keeps the exact decomposition", () => {
    const row = { teamId: 1, MON: game(1), WED: game(2), nMON: game(3) };
    const counts = [2, 8, 7, 9, 0, 0, 0, 16, 0, 0];
    const covered = Array(10).fill(true);
    const week = getTeamScheduleSummary(row, counts, [], DAYS, covered);
    const extended = getTeamScheduleSummary(row, counts, [], EXTENDED_DAYS, covered);
    expect(week.crowding.adjustment).toBeCloseTo((13 / 60 + .05) / 2);
    expect(extended.crowding.adjustment).toBeCloseTo((13 / 60 + .05 - .25) / 3);
    const excluded = getTeamScheduleSummary(row, counts, ["MON"], EXTENDED_DAYS, covered);
    expect(excluded.crowding.adjustment).toBeCloseTo((.05 - .25) / 2);
    expect(getTeamScheduleSummary(row, counts, [], EXTENDED_DAYS, [false, ...covered.slice(1)]).crowding)
      .toMatchObject({ adjustment: 0, status: "unavailable", knownGames: 2, expectedGames: 3 });
    const { games, offNights, matchup, crowding } = extended.scoreDecomposition;
    expect(games + offNights + matchup + crowding).toBe(extended.weekScore);
  });

  it("reverses the recorded PIT 4GP/3ON versus CAR 4GP/1ON inversion", () => {
    // Production schedule captured Oct 5, 2026; odds are percentages.
    const matchup = (id: number, homeId: number, homeOdds: number, awayId: number, awayOdds: number): GameData => ({
      id, season: 20262027, gameType: 2,
      homeTeam: { id: homeId, winOdds: homeOdds }, awayTeam: { id: awayId, winOdds: awayOdds }
    });
    const pit = { teamId: 5,
      MON: matchup(2026020042, 5, 26.27, 52, 73.73),
      WED: matchup(2026020053, 15, 68.74, 5, 31.26),
      FRI: matchup(2026020068, 29, 58.44, 5, 41.56),
      SAT: matchup(2026020077, 5, 32.09, 25, 67.91)
    };
    const car = { teamId: 12,
      TUE: matchup(2026020045, 8, 39.66, 12, 60.34),
      THU: matchup(2026020061, 12, 60.49, 23, 39.51),
      SAT: matchup(2026020078, 16, 30.83, 12, 69.17),
      SUN: matchup(2026020086, 4, 33.7, 12, 66.30)
    };
    const counts = [4, 9, 3, 10, 4, 14, 3];
    const pitSummary = getTeamScheduleSummary(pit, counts);
    const carSummary = getTeamScheduleSummary(car, counts);
    expect(pitSummary).toMatchObject({ totalGamesPlayed: 4, totalOffNights: 3 });
    expect(carSummary).toMatchObject({ totalGamesPlayed: 4, totalOffNights: 1 });
    expect(pitSummary.weekScore).toBeCloseTo(18.18289375);
    expect(carSummary.weekScore).toBeCloseTo(10.4743125);
    expect(pitSummary.weekScore).toBeGreaterThan(carSummary.weekScore);
    expect(getTeamScheduleSummary(pit, counts, ["MON"]).weekScore).toBeCloseTo(9.6979583333);
  });
});
