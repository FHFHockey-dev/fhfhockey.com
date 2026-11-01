import { describe, expect, it } from "vitest";
import { calculateWeeklyRanking } from "components/GoaliePage/goalieCalculations";
import type { GoalieWeeklyAggregate, LeagueWeeklyAverage, StatColumn } from "components/GoaliePage/goalieTypes";
import { buildWeekLedger, buildWeekLedgers, categoryBaseline, cellOutcome, compareToBaseline, countCells, CATEGORIES, DEFAULT_CATEGORY_IDS, defaultMonth, defaultWeek, monthPeriod, partsOf, periodGoalies, rankPeriodGoalies, toMatchupWeeks, weekMonth, weekPeriod, type CategoryId, type MatchupWeek } from "./categoryCounts";
import type { GoalieAppearance } from "./goalieLedger";

const week: MatchupWeek = { week: 4, start: "2026-10-19", end: "2026-10-25" };
let nextGame = 100;
const row = (goalieId: number, values: Partial<GoalieAppearance> = {}): GoalieAppearance => ({
  goalieId, name: `G${goalieId}`, gameId: nextGame++, date: "2026-10-20", team: "NJD", opponent: null, home: null, started: true,
  wins: 0, losses: 0, otLosses: 0, saves: 28, shotsAgainst: 31, goalsAgainst: 3, toiSeconds: 3600, shutouts: 0, qualityStart: 0, ...values,
});
const cell = (ledger: ReturnType<typeof buildWeekLedger>, goalieId: number, category: CategoryId, unit: "gameCells" | "weekCells" = "gameCells") => ledger.goalies.find(goalie => goalie.goalieId === goalieId)![unit].find(entry => entry.category === category)!;

describe("categories and direction", () => {
  it("has the contract's eight categories, default five, and no workload category", () => {
    expect(CATEGORIES.map(category => category.id)).toEqual(["wins", "saves", "svPct", "gaa", "shutouts", "goalsAgainst", "losses", "qualityStarts"]);
    expect(DEFAULT_CATEGORY_IDS).toEqual(["wins", "saves", "svPct", "gaa", "shutouts"]);
    expect(CATEGORIES.filter(category => category.direction === "lower").map(category => category.id)).toEqual(["gaa", "goalsAgainst", "losses"]);
  });
  it("keeps above and below numeric, and better and worse directional; a tie is neither", () => {
    expect(cellOutcome("above", "higher")).toBe("better");
    expect(cellOutcome("below", "higher")).toBe("worse");
    expect(cellOutcome("above", "lower")).toBe("worse");
    expect(cellOutcome("below", "lower")).toBe("better");
    expect(cellOutcome("tied", "lower")).toBe("tied");
    const ledger = buildWeekLedger(week, [row(1, { goalsAgainst: 1 }), row(2, { goalsAgainst: 5 }), row(3, { goalsAgainst: 3 })], ["goalsAgainst"]);
    expect(cell(ledger, 1, "goalsAgainst")).toMatchObject({ result: "below", outcome: "better" });
    expect(cell(ledger, 2, "goalsAgainst")).toMatchObject({ result: "above", outcome: "worse" });
    expect(cell(ledger, 3, "goalsAgainst")).toMatchObject({ result: "tied", outcome: "tied" });
    expect(countCells(ledger.goalies.flatMap(goalie => goalie.gameCells))).toEqual({ above: 1, below: 1, tied: 1, unavailable: 0, better: 1, worse: 1, compared: 3 });
  });
  it("counts losses as L + OTL, and a null in either as missing", () => {
    expect(partsOf([row(1, { losses: 1, otLosses: 1 })]).losses).toBe(2);
    expect(partsOf([row(1, { losses: 1, otLosses: null })]).losses).toBeNull();
  });
});

describe("the contract's worked example", () => {
  // 40 starts, 1,120 saves on 1,240 shots: 28.00 saves a start, SV% 1120 ÷ 1240 = .903.
  const pool = [row(1, { saves: 28, shotsAgainst: 31 }), row(2, { saves: 0, shotsAgainst: 0, goalsAgainst: 0, toiSeconds: 0 })];
  const filler = Array.from({ length: 38 }, (_, index) => row(10 + index, index === 0 ? { saves: 56, shotsAgainst: 62 } : { saves: 28, shotsAgainst: 31 }));
  const totals = [...pool, ...filler];
  it("has the stated pool totals", () => {
    expect(totals).toHaveLength(40);
    expect(totals.reduce((sum, entry) => sum + entry.saves!, 0)).toBe(1120);
    expect(totals.reduce((sum, entry) => sum + entry.shotsAgainst!, 0)).toBe(1240);
  });
  it("ties a 28-save start on saves and SV%, and leaves the 0 SA, 0 TOI start's rates unavailable", () => {
    const ledger = buildWeekLedger(week, totals, ["saves", "svPct", "gaa"]);
    expect(ledger.gameBaselines.saves.value).toBe(28);
    expect(ledger.gameBaselines.svPct.comparable).toBe(903);
    expect(cell(ledger, 1, "saves")).toMatchObject({ result: "tied" });
    expect(cell(ledger, 1, "svPct")).toMatchObject({ result: "tied" });
    expect(cell(ledger, 2, "saves")).toMatchObject({ result: "below" });
    expect(cell(ledger, 2, "svPct").result).toBe("unavailable");
    expect(cell(ledger, 2, "gaa").result).toBe("unavailable");
  });
});

describe("precision and pooling", () => {
  it("ties SV% and GAA that differ only past the compared decimal", () => {
    const baseline = categoryBaseline("svPct", [partsOf([row(1, { saves: 9031, shotsAgainst: 10000 })])]);
    expect(compareToBaseline("svPct", partsOf([row(2, { saves: 9034, shotsAgainst: 10000 })]), baseline).result).toBe("tied");
    expect(compareToBaseline("svPct", partsOf([row(2, { saves: 9035, shotsAgainst: 10000 })]), baseline).result).toBe("above");
    const gaa = categoryBaseline("gaa", [partsOf([row(1, { goalsAgainst: 3, toiSeconds: 3600 })])]);
    expect(gaa.comparable).toBe(300);
    expect(compareToBaseline("gaa", partsOf([row(2, { goalsAgainst: 3, toiSeconds: 3601 })]), gaa).result).toBe("tied");
    expect(compareToBaseline("gaa", partsOf([row(2, { goalsAgainst: 3, toiSeconds: 3500 })]), gaa)).toMatchObject({ result: "above", outcome: "worse" });
  });
  it("rounds half up exactly, where a float product would land either side", () => {
    // 1807 ÷ 2000 is exactly .9035.
    const baseline = categoryBaseline("svPct", [partsOf([row(1, { saves: 1807, shotsAgainst: 2000 })])]);
    expect(baseline.comparable).toBe(904);
  });
  it("pools rates from summed parts, never a mean of rates", () => {
    const ledger = buildWeekLedger(week, [row(1, { saves: 9, shotsAgainst: 10 }), row(2, { saves: 80, shotsAgainst: 100 })], ["svPct"]);
    expect(ledger.gameBaselines.svPct.value).toBeCloseTo(89 / 110, 10);
    expect(ledger.gameBaselines.svPct.value).not.toBeCloseTo((0.9 + 0.8) / 2, 3);
  });
  it("divides a game baseline by official starts and a week baseline by pool goalies", () => {
    const ledger = buildWeekLedger(week, [row(1, { saves: 20 }), row(1, { saves: 30 }), row(2, { saves: 10 })], ["saves"]);
    expect(ledger.gameBaselines.saves.value).toBe(20);
    expect(ledger.weekBaselines.saves.value).toBe(30);
    expect(cell(ledger, 1, "saves", "weekCells")).toMatchObject({ value: 50, result: "above" });
    expect(cell(ledger, 2, "saves", "weekCells")).toMatchObject({ value: 10, result: "below" });
  });
  it("keeps relief out of game cells and game baselines, but in that goalie's week totals", () => {
    const ledger = buildWeekLedger(week, [row(1, { saves: 20 }), row(1, { saves: 10, started: false }), row(2, { saves: 20 })], ["saves"]);
    expect(ledger.gameBaselines.saves.value).toBe(20);
    expect(ledger.goalies.find(goalie => goalie.goalieId === 1)!.gameCells).toHaveLength(1);
    expect(ledger.goalies.find(goalie => goalie.goalieId === 1)!.relief).toHaveLength(1);
    expect(cell(ledger, 1, "saves", "weekCells").value).toBe(30);
    expect(ledger.weekBaselines.saves.value).toBe(25);
  });
});

describe("missing and zero", () => {
  it("makes SA of 0 and TOI of 0 unavailable, which is neither tied nor worse", () => {
    const ledger = buildWeekLedger(week, [row(1), row(2, { shotsAgainst: 0, saves: 0 }), row(3, { toiSeconds: 0 })], ["svPct", "gaa"]);
    expect(cell(ledger, 2, "svPct")).toMatchObject({ result: "unavailable", outcome: "unavailable" });
    expect(cell(ledger, 3, "gaa")).toMatchObject({ result: "unavailable", outcome: "unavailable" });
    expect(countCells(ledger.goalies.find(goalie => goalie.goalieId === 2)!.gameCells.filter(entry => entry.category === "svPct"))).toMatchObject({ unavailable: 1, tied: 0, worse: 0, compared: 0 });
  });
  it("makes a null stat unavailable, and keeps it out of the baseline rather than counting it as 0", () => {
    const ledger = buildWeekLedger(week, [row(1, { saves: 30 }), row(2, { saves: null }), row(3, { saves: 10 })], ["saves"]);
    expect(cell(ledger, 2, "saves").result).toBe("unavailable");
    expect(ledger.gameBaselines.saves).toMatchObject({ value: 20, known: 2, excluded: 1 });
  });
  it("makes a week total with one null row unavailable", () => {
    const ledger = buildWeekLedger(week, [row(1, { saves: 30 }), row(1, { saves: null }), row(2, { saves: 10 })], ["saves"]);
    expect(cell(ledger, 1, "saves", "weekCells").result).toBe("unavailable");
    expect(ledger.weekBaselines.saves).toMatchObject({ value: 10, excluded: 1 });
  });
  it("has no baseline for an empty pool or a zero denominator, so every cell is unavailable", () => {
    expect(categoryBaseline("saves", [])).toMatchObject({ value: null, comparable: null });
    expect(categoryBaseline("svPct", [])).toMatchObject({ value: null });
    const zero = buildWeekLedger(week, [row(1, { saves: 0, shotsAgainst: 0 }), row(2, { saves: 0, shotsAgainst: 0 })], ["svPct"]);
    expect(zero.gameBaselines.svPct.value).toBeNull();
    expect(zero.goalies.flatMap(goalie => goalie.gameCells).every(entry => entry.result === "unavailable")).toBe(true);
    expect(buildWeekLedger(week, [], DEFAULT_CATEGORY_IDS).goalies).toEqual([]);
  });
  it("treats a baseline of 0 as valid: with no shutouts all week, a 0 ties", () => {
    const ledger = buildWeekLedger(week, [row(1), row(2)], ["shutouts"]);
    expect(ledger.gameBaselines.shutouts.value).toBe(0);
    expect(cell(ledger, 1, "shutouts")).toMatchObject({ result: "tied", outcome: "tied", value: 0, baseline: 0 });
    expect(cell(ledger, 1, "shutouts", "weekCells").result).toBe("tied");
  });
  it("gives a relief-only week no cells and counts it apart", () => {
    const ledger = buildWeekLedger(week, [row(1), row(2, { started: false })], ["saves"]);
    expect(ledger.poolGoalies).toBe(1);
    expect(ledger.goalies.map(goalie => goalie.goalieId)).toEqual([1]);
    expect(ledger.reliefOnly).toMatchObject([{ goalieId: 2 }]);
    expect(ledger.weekBaselines.saves.known).toBe(1);
    expect(periodGoalies([ledger], weekPeriod(week, "2026-10-30"), ["saves"]).find(goalie => goalie.goalieId === 2)).toMatchObject({ starts: 0, relief: 1, reliefOnlyWeeks: [4], game: { compared: 0 }, week: { compared: 0 } });
  });
  it("does not treat an unlabeled row as a start or as relief", () => {
    const ledger = buildWeekLedger(week, [row(1), row(2, { started: null })], ["saves"]);
    expect(ledger).toMatchObject({ officialStarts: 1, poolGoalies: 1, reliefOnly: [], unlabeled: 1 });
  });
});

describe("TGV and Category Counts side by side", () => {
  const columns: StatColumn[] = [
    { label: "W", value: "wins", dbFieldGoalie: "weekly_wins", dbFieldAverage: "avg_league_weekly_wins" },
    { label: "SO", value: "shutouts", dbFieldGoalie: "weekly_so", dbFieldAverage: "avg_league_weekly_so" },
  ];
  const goalieWeek = { weekly_wins: 1, weekly_so: 0 } as GoalieWeeklyAggregate;
  it("differs on a tie: TGV counts it as better, Category Counts as tied", () => {
    const tgv = calculateWeeklyRanking(goalieWeek, { avg_league_weekly_wins: 1 } as LeagueWeeklyAverage, ["wins"], columns);
    expect(tgv).toMatchObject({ percentage: 100, ranking: "Elite" });
    const ledger = buildWeekLedger(week, [row(1, { wins: 1 }), row(2, { wins: 1 })], ["wins"]);
    expect(cell(ledger, 1, "wins")).toMatchObject({ result: "tied", outcome: "tied" });
    expect(countCells(ledger.goalies[0].gameCells)).toMatchObject({ better: 0, tied: 1 });
  });
  it("differs on a zero baseline: TGV skips it, Category Counts keeps it", () => {
    const tgv = calculateWeeklyRanking(goalieWeek, { avg_league_weekly_so: 0 } as LeagueWeeklyAverage, ["shutouts"], columns);
    expect(tgv).toMatchObject({ percentage: 0, ranking: "Abysmal" });
    const ledger = buildWeekLedger(week, [row(1), row(2)], ["shutouts"]);
    expect(countCells(ledger.goalies[0].gameCells)).toMatchObject({ tied: 1, compared: 1 });
  });
});

describe("periods", () => {
  const weeks: MatchupWeek[] = [
    { week: 1, start: "2026-09-29", end: "2026-10-04" }, { week: 2, start: "2026-10-05", end: "2026-10-11" }, { week: 3, start: "2026-10-12", end: "2026-10-18" }, { week: 4, start: "2026-10-19", end: "2026-10-25" },
    { week: 5, start: "2026-10-26", end: "2026-11-01" }, { week: 6, start: "2026-11-02", end: "2026-11-08" },
  ];
  it("assigns a spanning week to the month with most of its days", () => {
    expect(weekMonth(weeks[0])).toBe("2026-10");
    expect(weekMonth(weeks[4])).toBe("2026-10");
    expect(weekMonth({ week: 9, start: "2026-11-28", end: "2026-12-04" })).toBe("2026-12");
  });
  it("gives an even split to the later month", () => {
    expect(weekMonth({ week: 9, start: "2026-10-29", end: "2026-11-03" })).toBe("2026-11");
  });
  it("counts a month's games by calendar date and its weeks by assignment", () => {
    const period = monthPeriod(weeks, "2026-10", "2026-11-08");
    expect(period.cellWeeks.map(week => week.week)).toEqual([1, 2, 3, 4, 5]);
    expect(period.touchedWeeks.map(week => week.week)).toEqual([1, 2, 3, 4, 5]);
    expect(period).toMatchObject({ gameFrom: "2026-10-01", gameTo: "2026-10-31", inProgress: false });
    const rows = [row(1, { date: "2026-09-30" }), row(1, { date: "2026-10-02" }), row(1, { date: "2026-10-30" }), row(1, { date: "2026-11-01" })];
    const { ledgers } = buildWeekLedgers(period.touchedWeeks, rows, ["saves"]);
    const [goalie] = periodGoalies(ledgers, period, ["saves"]);
    expect(goalie.starts).toBe(2);
    expect(goalie.game.compared).toBe(2);
    // Week cells for weeks 1 and 5 use their full totals, including the September and November games.
    expect(goalie.week.compared).toBe(2);
  });
  it("gives November its games from a week assigned to October, with no week cell for it", () => {
    const period = monthPeriod(weeks, "2026-11", "2026-11-08");
    expect(period.cellWeeks.map(week => week.week)).toEqual([6]);
    expect(period.touchedWeeks.map(week => week.week)).toEqual([5, 6]);
    const { ledgers } = buildWeekLedgers(period.touchedWeeks, [row(1, { date: "2026-11-01" }), row(2, { date: "2026-10-30" }), row(1, { date: "2026-11-03" })], ["saves"]);
    const goalies = periodGoalies(ledgers, period, ["saves"]);
    expect(goalies.map(goalie => goalie.goalieId)).toEqual([1]);
    expect(goalies[0]).toMatchObject({ starts: 2, game: { compared: 2 }, week: { compared: 1 } });
  });
  it("uses each game's own week baseline in a month", () => {
    const period = monthPeriod(weeks, "2026-10", "2026-11-08");
    const { ledgers } = buildWeekLedgers(period.touchedWeeks, [row(1, { date: "2026-10-06", saves: 20 }), row(2, { date: "2026-10-07", saves: 40 }), row(1, { date: "2026-10-13", saves: 20 }), row(2, { date: "2026-10-14", saves: 10 })], ["saves"]);
    const one = periodGoalies(ledgers, period, ["saves"]).find(goalie => goalie.goalieId === 1)!;
    expect(one.game).toMatchObject({ below: 1, above: 1, compared: 2 });
  });
  it("labels a period past the cutoff, and defaults to the last completed one", () => {
    expect(weekPeriod(weeks[4], "2026-10-30")).toMatchObject({ inProgress: true, label: "Week 5, 2026-10-26 to 2026-11-01, through 2026-10-30" });
    expect(weekPeriod(weeks[3], "2026-10-30")).toMatchObject({ inProgress: false, label: "Week 4, 2026-10-19 to 2026-10-25" });
    expect(defaultWeek(weeks, "2026-10-30")?.week).toBe(4);
    expect(defaultWeek(weeks, "2026-10-02")?.week).toBe(1);
    expect(defaultWeek(weeks, "2026-09-01")).toBeNull();
    expect(monthPeriod(weeks, "2026-10", "2026-10-30")).toMatchObject({ inProgress: true, label: "October 2026, through 2026-10-30" });
    expect(defaultMonth(weeks, "2026-11-08")).toBe("2026-10");
    expect(defaultMonth(weeks, "2026-09-29")).toBe("2026-09");
  });
  it("marks a month in progress while an assigned week is unfinished", () => {
    expect(monthPeriod(weeks, "2026-10", "2026-10-31").inProgress).toBe(true);
    expect(monthPeriod(weeks, "2026-10", "2026-11-01").inProgress).toBe(false);
  });
  it("refuses overlapping weeks, and counts rows in no week", () => {
    expect(() => toMatchupWeeks([{ week: 1, start_date: "2026-10-01", end_date: "2026-10-07" }, { week: 2, start_date: "2026-10-07", end_date: "2026-10-14" }])).toThrow(/overlap/);
    expect(toMatchupWeeks([{ week: 2, start_date: "2026-10-08", end_date: "2026-10-14" }, { week: 1, start_date: "2026-10-01", end_date: "2026-10-07" }, { week: 3, start_date: null, end_date: null }]).map(entry => entry.week)).toEqual([1, 2]);
    expect(buildWeekLedgers([week], [row(1, { date: "2026-12-01" })], ["saves"]).unassigned).toBe(1);
  });
});

describe("rankings", () => {
  const counts = (better: number, worse: number, tied = 0) => ({ above: better, below: worse, tied, unavailable: 0, better, worse, compared: better + worse + tied });
  const goalie = (goalieId: number, game: ReturnType<typeof counts>, week = counts(0, 0), starts = 3) => ({ goalieId, name: `G${goalieId}`, teams: ["NJD"], starts, relief: 0, reliefOnlyWeeks: [], game, week, byCategory: [], gameNet: game.better - game.worse, weekNet: week.better - week.worse, betterRate: game.compared ? game.better / game.compared : null });
  const ranks = (rows: ReturnType<typeof rankPeriodGoalies>) => Object.fromEntries(rows.map(row => [row.goalieId, [row.rank, row.worstRank]]));
  it("orders by game net first, not by better alone", () => {
    expect(ranks(rankPeriodGoalies([goalie(1, counts(6, 5)), goalie(2, counts(3, 0)), goalie(3, counts(1, 4))], 2))).toEqual({ 1: [2, 2], 2: [1, 3], 3: [3, 1] });
  });
  it("breaks a net tie with week net, then better ÷ compared", () => {
    const week = ranks(rankPeriodGoalies([goalie(1, counts(3, 1), counts(2, 0)), goalie(2, counts(3, 1), counts(1, 0))], 2));
    expect(week).toEqual({ 1: [1, 2], 2: [2, 1] });
    const rate = ranks(rankPeriodGoalies([goalie(1, counts(3, 1, 0)), goalie(2, counts(3, 1, 4))], 2));
    expect(rate).toEqual({ 1: [1, 2], 2: [2, 1] });
  });
  it("shares a rank when everything is equal, so co-winners and co-worst exist, with competition ranks after them", () => {
    const rows = rankPeriodGoalies([goalie(1, counts(4, 1)), goalie(2, counts(4, 1)), goalie(3, counts(2, 2)), goalie(4, counts(1, 3)), goalie(5, counts(1, 3))], 2);
    expect(ranks(rows)).toEqual({ 1: [1, 4], 2: [1, 4], 3: [3, 3], 4: [4, 1], 5: [4, 1] });
  });
  it("treats equal better rates on different cell counts as a tie", () => {
    expect(ranks(rankPeriodGoalies([goalie(1, counts(2, 0, 2)), goalie(2, counts(2, 0, 2))], 2))).toEqual({ 1: [1, 1], 2: [1, 1] });
  });
  it("gives no rank below the minimum starts or with no compared game cell", () => {
    const rows = rankPeriodGoalies([goalie(1, counts(9, 0), counts(0, 0), 1), goalie(2, counts(1, 1)), goalie(3, counts(0, 0))], 2);
    expect(rows.find(row => row.goalieId === 1)).toMatchObject({ eligible: false, rank: null, worstRank: null });
    expect(rows.find(row => row.goalieId === 3)).toMatchObject({ eligible: false, rank: null });
    expect(rows.find(row => row.goalieId === 2)).toMatchObject({ eligible: true, rank: 1, worstRank: 1 });
  });
  it("runs from appearances through to a co-winner", () => {
    const ledger = buildWeekLedger(week, [row(1, { saves: 40 }), row(1, { saves: 40 }), row(2, { saves: 40 }), row(2, { saves: 40 }), row(3, { saves: 10 }), row(3, { saves: 10 })], ["saves"]);
    const rows = rankPeriodGoalies(periodGoalies([ledger], weekPeriod(week, "2026-10-30"), ["saves"]), 2);
    expect(rows.map(entry => [entry.goalieId, entry.rank, entry.worstRank])).toEqual([[1, 1, 2], [2, 1, 2], [3, 3, 1]]);
  });
});
