import { describe, expect, it } from "vitest";
import { DAYS, EXTENDED_DAYS, GameData, WeekData } from "lib/NHL/types";
import { calcTotalGP } from "../TotalGamesPerDayRow";
import { convertTeamRowToWinOddsList } from "./calcWinOdds";
import { getRegularGamesPerDay } from "./helper";
import { getSelectedOpponentIds, getTeamScheduleSummary, getOpponentPointPct, getFourWeekAverages, getFourWeekScore } from "./scheduleSummary";
import { buildOpponentRatings, buildScheduleOpportunity, fourWeekStart, opportunityScale, percentileMap, remainingEligibility } from "./scheduleOpportunity";
import type { ExtendedWeekData, TeamDataWithTotals } from "lib/NHL/types";
import { computeOpponentMetrics, type TeamStats } from "./useOpponentMetricsData";

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

const cutoff = "2026-10-25T23:00:00Z";
const future = (overrides: Partial<GameData> = {}): GameData => ({ ...game(100), gameDate: "2026-10-25", startTimeUTC: "2026-10-26T02:00:00Z", gameState: "FUT", gameScheduleState: "OK", ...overrides });
const universe = Array.from({ length: 32 }, (_, i) => ({ id: i + 1, abbreviation: `T${i + 1}` }));
function opportunityRows(games: GameData[] = [future()]): ExtendedWeekData[] {
  return universe.flatMap((team) => [1, 2, 3, 4].map((weekNumber) => ({ teamId: team.id, weekNumber, totalGamesPlayed: 0, totalOffNights: 0, weekScore: -100,
    scheduleCoverage: { known: 7, expected: 7 }, ...(weekNumber === 4 ? Object.fromEntries(games.filter((g) => [g.homeTeam.id, g.awayTeam.id].includes(team.id)).map((g) => ["SUN", g])) : {}) })));
}
describe("remaining four-week opportunity", () => {
  it("uses UTC start and known states, keeping unknowns distinct from exclusions", () => {
    expect(remainingEligibility(future(), cutoff)).toBe("eligible");
    for (const startTimeUTC of [cutoff, "2026-10-25T22:59:59Z"]) expect(remainingEligibility(future({ startTimeUTC }), cutoff)).toBe("excluded");
    for (const gameState of ["LIVE", "CRIT", "FINAL", "OFF", "PPD", "CNCL"]) expect(remainingEligibility(future({ gameState }), cutoff)).toBe("excluded");
    for (const gameState of [undefined, "UNKNOWN"]) expect(remainingEligibility(future({ gameState }), cutoff)).toBe("unknown");
    for (const startTimeUTC of [undefined, "bad", "2026-10-26T02:00:00"]) expect(remainingEligibility(future({ startTimeUTC }), cutoff)).toBe("unknown");
    expect(remainingEligibility(future({ gameScheduleState: undefined }), cutoff)).toBe("unknown");
  });
  it.each(["UTC", "America/New_York", "America/Los_Angeles", "Asia/Tokyo", "Pacific/Auckland"])("keeps upcoming Sunday in an apparently elapsed fourth bucket in %s", (timezone) => {
    const old = process.env.TZ;
    try {
      process.env.TZ = timezone;
      const result = buildScheduleOpportunity(opportunityRows(), universe, "2026-09-28", cutoff);
      expect(Object.keys(result)).toHaveLength(32);
      expect(result[1].weeks.map((w) => [w.start, w.gamesPlayed, w.offNights, w.opportunity, w.coverage.known])).toEqual([
        ["2026-09-28", 0, 0, 0, 7], ["2026-10-05", 0, 0, 0, 7], ["2026-10-12", 0, 0, 0, 7], ["2026-10-19", 1, 1, 1.25, 7]
      ]);
      expect(result[1].opportunity).toBe(1.25);
      expect(result[32].opportunity).toBe(0);
      expect(opportunityScale(result)).toBe(2);
    } finally { if (old == null) delete process.env.TZ; else process.env.TZ = old; }
  });
  it("retains an October 22 fixture after viewer midnight without rebucketing its UTC start", () => {
    const rows = opportunityRows([future({ gameDate: "2026-10-22", startTimeUTC: "2026-10-23T02:00:00Z" })]);
    expect(buildScheduleOpportunity(rows, universe, "2026-09-28", "2026-10-22T23:00:00Z")[1].weeks[3]).toMatchObject({ gamesPlayed: 1, opportunity: 1.25 });
  });
  it.each([7, 8])("uses full-slate density with %s completed games and deduplicates both appearances", (completed) => {
    const other = Array.from({ length: completed }, (_, i) => future({ id: 200 + i, gameState: "FINAL", homeTeam: { id: 3 + 2 * i }, awayTeam: { id: 4 + 2 * i } }));
    const result = buildScheduleOpportunity(opportunityRows([...other, future()]), universe, "2026-09-28", cutoff);
    expect(result[1].opportunity).toBe(completed === 7 ? 1.25 : 1);
  });
  it("preserves covered zero and unknowns; missing matchup data does not suppress opportunity", () => {
    const rows = opportunityRows([future({ gameState: "UNKNOWN" })]);
    const result = buildScheduleOpportunity(rows, universe, "2026-09-28", cutoff);
    expect(result[1].opportunity).toBeNull();
    expect(result[1].weeks[3]).toMatchObject({ opportunity: null, unknown: 1 });
    expect(result[32].opportunity).toBe(0);
    rows.find((r) => r.teamId === 32 && r.weekNumber === 2)!.scheduleCoverage = undefined;
    expect(buildScheduleOpportunity(rows, universe, "2026-09-28", cutoff)[32].weeks[1].opportunity).toBeNull();
    const known = buildScheduleOpportunity(opportunityRows(), universe, "2026-09-28", cutoff)[1];
    expect(known.opportunity).toBe(1.25);
    expect(known.weeks[3].xgf).toBeNull();
  });
  it("keeps DST/year transitions on literal date boundaries", () => {
    expect(fourWeekStart("2026-10-25")).toBe("2026-10-19");
    expect(fourWeekStart("2026-03-08")).toBe("2026-03-02");
    expect(fourWeekStart("2027-01-01")).toBe("2026-12-28");
  });
});
describe("xG-only opponent ratings", () => {
  it("uses average-rank ties and handles equal and singleton cohorts", () => {
    expect([...percentileMap([0, 1, 1, 2].map((value, teamId) => ({ teamId, value }))).values()]).toEqual([0, 50, 50, 100]);
    expect([...percentileMap([1, 1].map((value, teamId) => ({ teamId, value }))).values()]).toEqual([50, 50]);
    expect(percentileMap([{ teamId: 1, value: 0 }]).get(1)).toBe(50);
  });
  it("weights repeats before ranking, retains zero, separates axes and rejects invalid observations", () => {
    const source = (xgf: number | null, xga: number | null): TeamStats => ({ team_abbreviation: "B", team_name: "B", gp: 2, xgf, xga, sf: 0, sa: 0, gf: 0, ga: 0, points: 0 });
    const stats = { B: source(0, 8), C: source(6, 2), BAD: source(-1, null) };
    const entries = [["B", "B", "C"], ["C"], [], ["BAD"]].map((names, index) => {
      const opponents = names.map((abbreviation) => ({ abbreviation, teamId: 2 }));
      const totals = { gamesPlayed: names.length, offNights: 0, opponents, scheduleCoverage: { known: 7, expected: 7 } };
      const team: TeamDataWithTotals = { teamId: index, teamAbbreviation: `T${index}`, weeks: [{ weekNumber: 1, ...totals }], totals, avgOpponentPointPct: null };
      return { team, ...computeOpponentMetrics(team, stats) };
    });
    expect(entries[0].averages.avgXgf).toBe(1);
    const ratings = buildOpponentRatings(entries, stats);
    expect(ratings[0]).toMatchObject({ atk: 0, def: 0, sampleMin: 2, sampleMax: 2 });
    expect(ratings[1]).toMatchObject({ atk: 100, def: 100 });
    expect(ratings[2]).toMatchObject({ atk: null, def: null, reason: "No included games" });
    expect(ratings[3]).toMatchObject({ atk: null, def: null });
  });
});

it("adds volume and off-night opportunity once, independently of Week Score and matchup rates", () => {
  const rows = opportunityRows();
  rows.filter((r) => r.weekNumber === 4 && [1, 2].includes(r.teamId)).forEach((r) => { r.THU = future({ id: 101, gameDate: "2026-10-22" }); r.weekScore = 999; });
  const result = buildScheduleOpportunity(rows, universe, "2026-09-28", cutoff);
  expect(result[1].opportunity).toBe(2.5);
  expect(result[1].weeks[3]).toMatchObject({ gamesPlayed: 2, offNights: 2 });
});

it("labels relative skater defense difficulty without changing opportunity, preserves ties and missingness", () => {
  const games = Array.from({ length: 16 }, (_, index) => future({ id: 500 + index, homeTeam: { id: 2 * index + 1 }, awayTeam: { id: 2 * index + 2 } }));
  const rows = opportunityRows(games);
  const stats = Object.fromEntries(universe.map((team, index) => [team.abbreviation, { gp: 2, xga: 2 * index, xgf: 4 }])) as Record<string, TeamStats>;
  const graded = buildScheduleOpportunity(rows, universe, "2026-09-28", cutoff, stats);
  expect(graded[1].weeks[3].skaterMatchup).toBe("harder");
  expect(graded[16].weeks[3].skaterMatchup).toBe("average");
  expect(graded[32].weeks[3].skaterMatchup).toBe("easier");
  expect(graded[1].weeks[0].skaterMatchup).toBe("no_games");
  expect(Object.values(graded).every((v) => v.opportunity === 1)).toBe(true);
  for (const stat of Object.values(stats)) stat.xga = 4;
  expect(Object.values(buildScheduleOpportunity(rows, universe, "2026-09-28", cutoff, stats)).every((v) => v.weeks[3].skaterMatchup === "average")).toBe(true);
  stats.T2.xga = null;
  expect(buildScheduleOpportunity(rows, universe, "2026-09-28", cutoff, stats)[1].weeks[3]).toMatchObject({ opportunity: 1, skaterMatchup: "unknown" });
});
