import { describe, expect, it } from "vitest";
import {
  aggregateNstTeamCounts,
  aggregateWgoTeamGames,
  formatFractionPercent,
  ratio,
  shareOfSums,
  sumField,
  toFraction,
  type NstTeamCountRow,
  type WgoTeamGameRow
} from "./percentUnits";

describe("declared percentage units", () => {
  it("treats the same share identically whatever its declared unit", () => {
    expect(formatFractionPercent(toFraction(0.41583, "fraction"))).toBe("41.6%");
    expect(formatFractionPercent(toFraction(41.583, "percentagePoints"))).toBe(
      "41.6%"
    );
  });

  it("never guesses the unit from magnitude", () => {
    expect(formatFractionPercent(toFraction(0.5, "percentagePoints"))).toBe(
      "0.5%"
    );
    expect(formatFractionPercent(toFraction(0.5, "fraction"))).toBe("50.0%");
    expect(formatFractionPercent(toFraction(1, "fraction"))).toBe("100.0%");
    expect(formatFractionPercent(toFraction(1, "percentagePoints"))).toBe("1.0%");
  });

  it("keeps zero and missing distinct", () => {
    expect(toFraction(0, "percentagePoints")).toBe(0);
    expect(formatFractionPercent(0)).toBe("0.0%");
    expect(toFraction(null, "fraction")).toBeNull();
    expect(toFraction(undefined, "fraction")).toBeNull();
    expect(formatFractionPercent(null)).toBe("—");
  });

  it("returns null instead of dividing by zero exposure", () => {
    expect(ratio(3, 0)).toBeNull();
    expect(ratio(null, 10)).toBeNull();
    expect(shareOfSums(0, 0)).toBeNull();
    expect(shareOfSums(0, 10)).toBe(0);
  });
});

describe("full-window count completeness", () => {
  const nst: NstTeamCountRow = {
    gp: 1, toi: 3000, cf: 10, ca: 20, xgf: 1, xga: 2,
    hdcf: 3, hdca: 4, scf: 5, sca: 6, gf: 0, ga: 1, sf: 10, sa: 20
  };
  const wgo: WgoTeamGameRow = {
    games_played: 1, shots_for_per_game: 30, shots_against_per_game: 20,
    power_play_goals_for: 1, pp_opportunities: 5, pp_goals_against: 1,
    times_shorthanded: 4, sh_goals_for: 0, sh_goals_against: 0,
    faceoffs_won: 10, faceoffs_lost: 20
  };

  it("does not silently sum a partial field", () => {
    expect(sumField([1, null, 2], (value) => value)).toBeNull();
    expect(sumField([1, undefined, 2], (value) => value)).toBeNull();
    expect(sumField([1, NaN, 2], (value) => value)).toBeNull();
    expect(sumField([0, 0], (value) => value)).toBe(0);
    expect(sumField([], (value: number) => value)).toBeNull();
  });

  it.each([
    ["cf", "cfPct"], ["ca", "cfPct"], ["xgf", "xgfPct"], ["xga", "xgfPct"],
    ["hdcf", "hdcfPct"], ["hdca", "hdcfPct"], ["scf", "scfPct"], ["sca", "scfPct"],
    ["gf", "shootingPct"], ["sf", "shootingPct"], ["ga", "savePct"], ["sa", "savePct"],
    ["xgf", "xgfPerGame"], ["xga", "xgaPerGame"], ["toi", "toiSeconds"]
  ] as const)("keeps asymmetric NST %s missingness unknown in %s", (field, metric) => {
    const totals = aggregateNstTeamCounts([nst, { ...nst, [field]: null }]);
    expect(totals[metric]).toBeNull();
    expect(totals.games).toBe(2);
  });

  it.each([
    ["power_play_goals_for", "powerPlayPct"], ["pp_opportunities", "powerPlayPct"],
    ["pp_goals_against", "penaltyKillPct"], ["times_shorthanded", "penaltyKillPct"],
    ["faceoffs_won", "faceoffWinPct"], ["faceoffs_lost", "faceoffWinPct"],
    ["shots_for_per_game", "shotsFor"], ["shots_against_per_game", "shotsAgainst"],
    ["pp_opportunities", "ppOpportunitiesPerGame"], ["sh_goals_for", "shGoalsFor"],
    ["sh_goals_against", "shGoalsAgainst"]
  ] as const)("keeps asymmetric WGO %s missingness unknown in %s", (field, metric) => {
    const totals = aggregateWgoTeamGames([wgo, { ...wgo, [field]: null }]);
    expect(totals[metric]).toBeNull();
    expect(totals.games).toBe(2);
  });

  it.each([null, undefined, NaN, -1])("does not discard unknown game exposure (%s)", (games) => {
    const nstTotals = aggregateNstTeamCounts([nst, { ...nst, gp: games }]);
    expect(nstTotals.games).toBeNull();
    expect(nstTotals.cfPct).toBeNull();
    expect(nstTotals.xgfPerGame).toBeNull();
    expect(nstTotals.goalsFor).toBeNull();
    expect(nstTotals.toiSeconds).toBeNull();
    const wgoTotals = aggregateWgoTeamGames([wgo, { ...wgo, games_played: games as number | null }]);
    expect(wgoTotals.games).toBeNull();
    expect(wgoTotals.powerPlayPct).toBeNull();
    expect(wgoTotals.shotsFor).toBeNull();
    expect(wgoTotals.shGoalsFor).toBeNull();
  });

  it("retains complete metrics and real zeros without inventing missing exposure", () => {
    const totals = aggregateNstTeamCounts([nst, { ...nst, toi: null }]);
    expect(totals.toiSeconds).toBeNull();
    expect(totals.cfPct).toBeCloseTo(1 / 3);
    expect(totals.goalsFor).toBe(0);
    expect(totals.shootingPct).toBe(0);
    expect(totals.xgfPerGame).toBe(1);

    const zeroEvent = { ...wgo, shots_for_per_game: 0, power_play_goals_for: 0, pp_opportunities: 0 };
    expect(aggregateWgoTeamGames([zeroEvent]).powerPlayPct).toBeNull();
    const combined = aggregateWgoTeamGames([zeroEvent, wgo, { games_played: 0 }]);
    expect(combined.games).toBe(2);
    expect(combined.powerPlayPct).toBeCloseTo(1 / 5);
    expect(combined.shotsFor).toBe(15);
    expect(combined.shGoalsFor).toBe(0);
    expect(aggregateWgoTeamGames([]).games).toBe(0);
  });

  it("does not combine complementary missing sides or publish derived partial metrics", () => {
    const nstTotals = aggregateNstTeamCounts([{ ...nst, gf: null }, { ...nst, sf: null }]);
    expect(nstTotals.shootingPct).toBeNull();
    expect(nstTotals.pdo).toBeNull();
    const wgoTotals = aggregateWgoTeamGames([{ ...wgo, shots_for_per_game: null }, wgo]);
    expect(wgoTotals.shotsFor).toBeNull();
    expect(wgoTotals.shotsAgainst).toBe(20);
    expect(wgoTotals.shotDifferential).toBeNull();
  });
});

describe("aggregateNstTeamCounts", () => {
  it("uses the ratio of summed counts, not the mean of per-game shares", () => {
    // Game 1: 10 of 40 attempts (25%); game 2: 60 of 100 (60%).
    // Mean of shares would be 42.5%; the season share is 70 / 140 = 50%.
    const totals = aggregateNstTeamCounts([
      { gp: 1, cf: 10, ca: 30, xgf: 0.5, xga: 1.5, gf: 1, ga: 2, sf: 10, sa: 20, toi: 3000 },
      { gp: 1, cf: 60, ca: 40, xgf: 3, xga: 1, gf: 3, ga: 0, sf: 30, sa: 20, toi: 2900 }
    ]);
    expect(totals.games).toBe(2);
    expect(totals.cfPct).toBeCloseTo(0.5);
    expect(totals.xgfPct).toBeCloseTo(3.5 / 6);
    expect(totals.shootingPct).toBeCloseTo(4 / 40);
    expect(totals.savePct).toBeCloseTo(1 - 2 / 40);
    expect(totals.pdo).toBeCloseTo(0.1 + 0.95);
    expect(totals.goalsFor).toBe(4);
    expect(totals.goalsAgainst).toBe(2);
    expect(totals.toiSeconds).toBe(5900);
    expect(totals.xgfPerGame).toBeCloseTo(1.75);
  });

  it("excludes rows without games and leaves missing counts unavailable", () => {
    const totals = aggregateNstTeamCounts([
      { gp: 0, cf: 99, ca: 1 },
      { gp: 1, cf: null, ca: null, gf: 0, ga: 0, sf: 0, sa: 0 }
    ]);
    expect(totals.games).toBe(1);
    expect(totals.cfPct).toBeNull();
    expect(totals.hdcfPct).toBeNull();
    expect(totals.shootingPct).toBeNull();
    expect(totals.pdo).toBeNull();
    expect(totals.goalsFor).toBe(0);
  });

  it("returns an empty aggregate for no rows", () => {
    const totals = aggregateNstTeamCounts([]);
    expect(totals.games).toBe(0);
    expect(totals.cfPct).toBeNull();
    expect(totals.xgfPerGame).toBeNull();
  });
});
