import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { GoalieWeeklyAggregate, LeagueWeeklyAverage } from "components/GoaliePage/goalieTypes";
import { teamsInfo } from "lib/teamsInfo";
import { parseShareSettings } from "./contract";
import { buildGoaliePeriod, goaliePeriodModule, periodReadRange, resolvePeriod, TGV_LABEL, tgvSeasonWeeks, type GoaliePeriodData, type GoaliePeriodSettings } from "./goaliePeriod";
import { cellTone, monthPeriod, weekPeriod, type MatchupWeek } from "./shared/categoryCounts";
import { heatLevel } from "./shared/goalieBoards";
import type { GoalieAppearance } from "./shared/goalieLedger";

const weeks: MatchupWeek[] = [{ week: 4, start: "2026-10-19", end: "2026-10-25" }, { week: 5, start: "2026-10-26", end: "2026-11-01" }];
const settings: GoaliePeriodSettings = { period: "week", week: 4, month: "", minStartsWeek: 2, minStartsMonth: 5, board: "both", categories: "wins,saves,svPct,gaa,shutouts" };
const stat = (goalieId: number, team: string, gameId: number, date: string, values: Partial<GoalieAppearance> = {}): GoalieAppearance => ({ goalieId, name: `G${goalieId}`, gameId, date, team, opponent: null, home: null, started: true, wins: 0, losses: 0, otLosses: 0, saves: 25, shotsAgainst: 28, goalsAgainst: 3, toiSeconds: 3600, shutouts: 0, qualityStart: 0, ...values });
const NJD = teamsInfo.NJD.id, NYR = teamsInfo.NYR.id;
const games = [{ id: 1, date: "2026-10-20" }, { id: 2, date: "2026-10-22" }];
const scheduled = games.map(game => ({ ...game, homeTeamId: NJD, awayTeamId: NYR }));
const reported = games.flatMap(game => [{ gameId: game.id, date: game.date, team: "NJD" }, { gameId: game.id, date: game.date, team: "NYR" }]);
const appearances = [
  stat(1, "NJD", 1, "2026-10-20", { wins: 1, saves: 35, shotsAgainst: 36, goalsAgainst: 1, shutouts: 0 }), stat(1, "NJD", 2, "2026-10-22", { wins: 1, saves: 30, shotsAgainst: 30, goalsAgainst: 0, shutouts: 1 }),
  stat(2, "NYR", 1, "2026-10-20", { losses: 1, saves: 20, shotsAgainst: 24, goalsAgainst: 4 }), stat(2, "NYR", 2, "2026-10-22", { losses: 1, saves: 18, shotsAgainst: 22, goalsAgainst: 4 }),
];
const tgv = {
  goalies: [
    { goalie_id: 1, week: 4, weekly_gs: 2, weekly_toi_seconds: 7200, weekly_wins: 2, weekly_saves: 65, weekly_sv_pct: 0.98 },
    { goalie_id: 2, week: 4, weekly_gs: 2, weekly_toi_seconds: 7200, weekly_wins: 0, weekly_saves: 38, weekly_sv_pct: 0.82 },
  ] as GoalieWeeklyAggregate[],
  league: [{ week: 4, avg_league_weekly_wins: 1, avg_league_weekly_saves: 51.5, avg_league_weekly_sv_pct: 0.92 }] as LeagueWeeklyAverage[],
  weeks: [weeks[0]],
};
const seasonWeeks: MatchupWeek[] = [{ week: 1, start: "2026-09-29", end: "2026-10-04" }, { week: 2, start: "2026-10-05", end: "2026-10-11" }, { week: 3, start: "2026-10-12", end: "2026-10-18" }, weeks[0]];
const seasonLeague = [1, 3, 4].map(week => ({ ...tgv.league[0], week }));
/** Goalie 1: Elite in week 1, no row in week 2, Good in week 3 (2 of 3 stats), Elite in week 4. */
const season = { weeks: seasonWeeks, league: seasonLeague, goalies: [{ ...tgv.goalies[0], week: 1 }, { ...tgv.goalies[0], week: 3, weekly_wins: 0 }, ...tgv.goalies] };
const base = { settings, period: weekPeriod(weeks[0], "2026-10-30"), appearances, reported, scheduled, tgv };

describe("goalie of the period", () => {
  it("ranks best and worst from one ranking, with evidence on every row", () => {
    const { data, state, evidence } = buildGoaliePeriod(base);
    expect(state).toBe("ready");
    expect(evidence.sample).toBe("Week 4, 2026-10-19 to 2026-10-25: 4 official starts in the 1 matchup week used");
    expect(data!.rows.map(row => [row.goalieId, row.categoryCounts.rank, row.categoryCounts.worstRank])).toEqual([[1, 1, 2], [2, 2, 1]]);
    expect(data!.winners).toEqual([1]);
    expect(data!.rows[0].categoryCounts).toMatchObject({ starts: 2, relief: 0, game: { compared: 10 }, week: { compared: 5 } });
    expect(data!.period.weeks).toEqual([{ ...weeks[0], poolGoalies: 2, officialStarts: 4 }]);
    const worst = buildGoaliePeriod({ ...base, settings: { ...settings, board: "worst" } }).data!;
    expect(worst.winners).toEqual([2]);
    expect(worst.rows[0].goalieId).toBe(2);
  });
  it("is partial and unexportable when a game lacks exactly one labeled starter", () => {
    const doubled = buildGoaliePeriod({ ...base, appearances: [...appearances, stat(3, "NJD", 1, "2026-10-20")] });
    expect(doubled.state).toBe("partial");
    expect(doubled.reasons?.[0]).toBe("Team games in this period's weeks lacking exactly one labeled starter: 1.");
    const unlabeled = buildGoaliePeriod({ ...base, appearances: appearances.map((row, index) => index === 0 ? { ...row, started: null } : row) });
    expect(unlabeled.state).toBe("partial");
    const absent = buildGoaliePeriod({ ...base, appearances: appearances.slice(1) });
    expect(absent.state).toBe("partial");
  });
  it("is partial when a scheduled game has no result", () => {
    const result = buildGoaliePeriod({ ...base, reported: reported.slice(1) });
    expect(result.state).toBe("partial");
    expect(result.evidence.coverage).toEqual({ observed: 3, expected: 4, missing: 1, unit: "team games" });
  });
  it("has nothing to export below the minimum starts", () => {
    const { data } = buildGoaliePeriod({ ...base, settings: { ...settings, minStartsWeek: 3 } });
    expect(data!.ranked).toBe(0);
    expect(goaliePeriodModule.hasRows(data, settings)).toBe(false);
    expect(data!.rows.every(row => row.categoryCounts.rank === null)).toBe(true);
  });
  it("counts relief apart and lists a relief-only goalie with no cells", () => {
    const relief = stat(3, "NJD", 1, "2026-10-20", { started: false, saves: 2, shotsAgainst: 2, goalsAgainst: 0, toiSeconds: 300 });
    const { data } = buildGoaliePeriod({ ...base, appearances: [...appearances, relief] });
    expect(data!.reliefOnly).toEqual([{ goalieId: 3, name: "G3", weeks: [4] }]);
    expect(data!.rows.some(row => row.goalieId === 3)).toBe(false);
    expect(data!.period.weeks[0].poolGoalies).toBe(2);
  });
  it("labels an in-progress week, and reads only the dates its baselines use", () => {
    const period = weekPeriod(weeks[1], "2026-10-30");
    expect(buildGoaliePeriod({ ...base, period, appearances: [], reported: [], scheduled: [], tgv }).data!.period).toMatchObject({ inProgress: true, label: "Week 5, 2026-10-26 to 2026-11-01, through 2026-10-30" });
    expect(periodReadRange(period)).toEqual({ from: "2026-10-26", through: "2026-10-30" });
    const october = monthPeriod([{ week: 1, start: "2026-09-29", end: "2026-10-04" }, ...weeks], "2026-10", "2026-11-08");
    expect(periodReadRange(october)).toEqual({ from: "2026-09-29", through: "2026-11-01" });
  });
  it("defaults to the last completed period and refuses one that has not started", () => {
    expect(resolvePeriod({ period: "week", week: null, month: "" }, weeks, "2026-10-30")).toMatchObject({ period: { key: "4", inProgress: false } });
    expect(resolvePeriod({ period: "week", week: 5, month: "" }, weeks, "2026-10-20")).toEqual({ reason: "Week 5 has not started; data runs through 2026-10-20." });
    expect(resolvePeriod({ period: "week", week: 9, month: "" }, weeks, "2026-10-30")).toEqual({ reason: "Week 9 is not on the matchup calendar." });
    expect(resolvePeriod({ period: "month", week: null, month: "2026-12" }, weeks, "2026-10-30")).toEqual({ reason: "2026-12 has no matchup weeks." });
    expect(resolvePeriod({ period: "month", week: null, month: "2026-10" }, weeks, "2026-10-30")).toMatchObject({ period: { inProgress: true, label: "October 2026, through 2026-10-30" } });
  });
  it("validates its settings, with the contract's defaults", () => {
    expect(parseShareSettings(goaliePeriodModule, {})).toEqual({ period: "week", week: null, month: "", minStartsWeek: 2, minStartsMonth: 5, board: "both", categories: "wins,saves,svPct,gaa,shutouts" });
    expect(() => parseShareSettings(goaliePeriodModule, { categories: "wins,grit" })).toThrow(/Categories must come from/);
    expect(() => parseShareSettings(goaliePeriodModule, { categories: " " })).toThrow(/at least one/);
    expect(() => parseShareSettings(goaliePeriodModule, { month: "2026-13" })).toThrow(/Month/);
    expect(() => parseShareSettings(goaliePeriodModule, { minStartsWeek: "8" })).toThrow();
  });
});

describe("TGV beside Category Counts", () => {
  it("keeps the two methods in separate objects, each with its own label", () => {
    const { data } = buildGoaliePeriod(base), row = data!.rows[0];
    expect(data!.method).toBe("Category Counts");
    expect(row.tgv).toMatchObject({ label: TGV_LABEL, state: "ready", points: 20, counts: { Elite: 1, Good: 0, Average: 0, Bad: 0, Abysmal: 0 } });
    expect(row.categoryCounts).not.toHaveProperty("counts");
    expect(row.tgv).not.toHaveProperty("gameNet");
  });
  it("counts each goalie's graded weeks per grade through the period's end, and sums the points", () => {
    const series = buildGoaliePeriod({ ...base, tgv: season }).data!.rows.find(row => row.goalieId === 1)!.tgv;
    expect(series.counts).toEqual({ Elite: 2, Good: 1, Average: 0, Bad: 0, Abysmal: 0 });
    expect(series.points).toBe(50);
    expect(series.series.map(week => [week.week, week.ranking, week.points, week.selected])).toEqual([[1, "Elite", 20, false], [2, null, null, false], [3, "Good", 10, false], [4, "Elite", 20, true]]);
    expect(series.unclassified).toBe(0);
  });
  it("never reads a week past the period's end", () => {
    const later: MatchupWeek[] = [{ week: 3, start: "2026-10-12", end: "2026-10-18" }, ...weeks];
    expect(tgvSeasonWeeks(later, weekPeriod(weeks[0], "2026-10-30")).map(week => week.week)).toEqual([3, 4]);
    expect(tgvSeasonWeeks(later, { cellWeeks: [] })).toEqual([]);
  });
  it("can never give Average with the method's default three stats: 0, 33, 67 or 100% only", () => {
    const seen = new Set<string>();
    for (const wins of [0, 2]) for (const saves of [0, 99]) for (const svPct of [0.5, 0.99]) {
      const week = { ...tgv.goalies[0], weekly_wins: wins, weekly_saves: saves, weekly_sv_pct: svPct };
      seen.add(buildGoaliePeriod({ ...base, tgv: { ...tgv, goalies: [week] } }).data!.rows.find(row => row.goalieId === 1)!.tgv.series[0].ranking!);
    }
    expect([...seen].sort()).toEqual(["Abysmal", "Bad", "Elite", "Good"]);
  });
  it("keeps an unclassified week out of the counts and the points, as the existing method does", () => {
    const short = { ...tgv, goalies: [{ ...tgv.goalies[0], weekly_toi_seconds: 600 }, tgv.goalies[1]] };
    expect(buildGoaliePeriod({ ...base, tgv: short }).data!.rows[0].tgv).toMatchObject({ points: 0, unclassified: 1, counts: { Elite: 0 }, series: [{ week: 4, ranking: null, points: null, selected: true }] });
  });
  it("marks TGV unavailable without touching the counts, and that is partial", () => {
    const result = buildGoaliePeriod({ ...base, tgv: null });
    expect(result.state).toBe("partial");
    expect(result.data!.rows[0].tgv).toEqual({ label: TGV_LABEL, state: "unavailable", counts: null, points: null, unclassified: 0, series: [] });
    expect(result.data!.rows[0].categoryCounts).toEqual(buildGoaliePeriod(base).data!.rows[0].categoryCounts);
  });
  const render = async (data: GoaliePeriodData) => {
    const Card = await goaliePeriodModule.card();
    return new DOMParser().parseFromString(renderToStaticMarkup(createElement(Card, { data, logos: {}, settings, snapshot: {} as never })), "text/html");
  };
  /** n goalies with two starts each, one game a side, better goalies first. */
  const pool = (n: number, values: (goalie: number) => Partial<GoalieAppearance> = goalie => ({ saves: 40 - goalie, shotsAgainst: 42 })) => {
    const games = Array.from({ length: n }, (_, index) => ({ id: index + 1, date: `2026-10-${String(19 + index % 7)}` }));
    const sched = games.map(game => ({ ...game, homeTeamId: NJD, awayTeamId: NYR }));
    const rep = games.flatMap(game => [{ gameId: game.id, date: game.date, team: "NJD" }, { gameId: game.id, date: game.date, team: "NYR" }]);
    const stats = rep.map((game, index) => stat(index % n + 1, game.team, game.gameId, game.date, values(index % n + 1)));
    return buildGoaliePeriod({ ...base, appearances: stats, reported: rep, scheduled: sched });
  };
  it("shows both boards by default, Best first, with rank from the same ranking", async () => {
    expect(parseShareSettings(goaliePeriodModule, {}).board).toBe("both");
    const { data } = pool(12), root = await render(data!);
    const names = (board: string) => [...root.querySelectorAll(`[data-board="${board}"] [data-testid="goalie-period-row"] b:not([class*="heat"])`)].map(entry => entry.textContent).filter(text => text?.startsWith("G"));
    expect(names("best")).toEqual(["G1", "G2", "G3", "G4", "G5"]);
    // Ranked from the same order: the five with the lowest worst rank, and nobody on both sides.
    const bottom = [...data!.rows].sort((a, b) => a.categoryCounts.worstRank! - b.categoryCounts.worstRank! || a.goalieId - b.goalieId).slice(0, 5).map(row => row.name);
    expect(names("worst")).toEqual(bottom);
    expect(names("worst").filter(name => names("best").includes(name))).toEqual([]);
    expect(root.querySelector('[data-testid="board-best"] h4')!.textContent).toBe("Best");
    expect(root.querySelector('[data-testid="board-worst"] h4')!.textContent).toBe("Worst");
    expect(root.body.textContent).toMatch(/Showing 5 of 12/);
    expect(root.body.textContent).not.toContain("on both sides");
  });
  it("can still show one board", async () => {
    const root = await render(buildGoaliePeriod({ ...base, settings: { ...settings, board: "worst" } }).data!);
    expect(root.querySelector('[data-board="best"]')).toBeNull();
    expect(root.querySelector('[data-testid="goalie-period-winners"]')!.textContent).toBe("G2");
    expect(root.body.textContent).toContain("Worst of the Week");
  });
  it("says so when a small pool puts a goalie on both sides", async () => {
    const root = await render(buildGoaliePeriod(base).data!);
    expect(root.querySelectorAll('[data-board="best"] [data-testid="goalie-period-row"]')).toHaveLength(2);
    expect(root.querySelectorAll('[data-board="worst"] [data-testid="goalie-period-row"]')).toHaveLength(2);
    expect(root.body.textContent).toContain("Only 2 goalies qualified, so 2 appear on both sides.");
  });
  it("shares ties, and says when a tie runs past the rows shown", async () => {
    const result = pool(8, () => ({}));
    expect(result.data!.rows.every(row => row.categoryCounts.rank === 1 && row.categoryCounts.worstRank === 1)).toBe(true);
    const text = (await render(result.data!)).body.textContent!;
    expect(text).toContain("Showing 5 of 8; 3 more tied at rank 1.");
    expect(result.data!.winners).toHaveLength(8);
    const tied = appearances.map(row => ({ ...row, wins: 0, losses: 0, saves: 25, shotsAgainst: 28, goalsAgainst: 3, shutouts: 0 }));
    expect(buildGoaliePeriod({ ...base, appearances: tied }).data!.winners).toEqual([1, 2]);
  });
  it("writes each tile as better in N of M starts, coloured the same way for GAA and shutouts", async () => {
    const root = await render(buildGoaliePeriod(base).data!);
    const row = (board: string, n: number) => root.querySelectorAll(`[data-board="${board}"] [data-testid="goalie-period-row"]`)[n];
    const tile = (element: Element, id: string) => element.querySelector(`[data-category="${id}"]`)!;
    expect(tile(row("best", 0), "gaa").textContent).toBe("GAA 2/2");
    expect(tile(row("best", 0), "gaa").getAttribute("data-tone")).toBe("better");
    expect(tile(row("best", 0), "shutouts").textContent).toBe("SO 1/2");
    expect(tile(row("best", 0), "shutouts").getAttribute("data-tone")).toBe("level");
    expect(tile(row("best", 1), "gaa").textContent).toBe("GAA 0/2");
    expect(tile(row("best", 1), "gaa").getAttribute("data-tone")).toBe("worse");
    expect(tile(row("best", 1), "shutouts").textContent).toBe("SO 0/2");
    expect(tile(row("best", 1), "shutouts").getAttribute("data-tone")).toBe("worse");
    expect(root.body.textContent).toContain("W 2/2 = better than league average in 2 of 2 starts.");
    expect(root.body.textContent).not.toMatch(/\d[–-]\d[–-]\d/);
    expect(root.body.textContent).not.toContain("CMP");
    const raw = buildGoaliePeriod(base).data!.rows[0].categoryCounts.byCategory.find(entry => entry.category === "gaa")!.game;
    expect(raw).toMatchObject({ below: 2, above: 0, better: 2, worse: 0 });
  });
  it("calls a tile better or worse only when most starts were", () => {
    const counts = (better: number, worse: number, tied: number) => ({ above: better, below: worse, tied, unavailable: 0, better, worse, compared: better + worse + tied });
    expect(cellTone(counts(2, 1, 0))).toBe("better");
    expect(cellTone(counts(1, 0, 3))).toBe("level");
    expect(cellTone(counts(1, 1, 0))).toBe("level");
    expect(cellTone(counts(0, 2, 1))).toBe("worse");
    expect(cellTone(counts(0, 0, 0))).toBe("none");
  });
  it("heads the row with games net in a tile that says so, stronger for a bigger value", async () => {
    const root = await render(buildGoaliePeriod(base).data!), tiles = [...root.querySelectorAll('[data-board="best"] [data-testid="heat-tile"]')];
    const winner = buildGoaliePeriod(base).data!.rows[0].categoryCounts.gameNet;
    expect(tiles[0].textContent).toBe(`+${winner}games net`);
    expect(tiles[0].getAttribute("data-tone")).toBe("better");
    expect(tiles[1].getAttribute("data-tone")).toBe("worse");
    expect(heatLevel(10, 10)).toEqual({ tone: "better", alpha: 0.8 });
    expect(heatLevel(5, 10)).toEqual({ tone: "better", alpha: 0.5 });
    expect(heatLevel(-1, 10)).toEqual({ tone: "worse", alpha: 0.26 });
    expect(heatLevel(0, 10)).toEqual({ tone: "level", alpha: 0 });
    expect(heatLevel(null, 10)).toEqual({ tone: "none", alpha: 0 });
  });
  it("keeps week counts out of the tiles, with a compact week net", async () => {
    const root = await render(buildGoaliePeriod(base).data!), row = root.querySelector('[data-testid="goalie-period-row"]')!;
    expect(row.querySelectorAll("[data-category]")).toHaveLength(5);
    expect(row.textContent).toMatch(/week net [+−0]/);
  });
  it("never merges the labels on the card", async () => {
    const root = await render(buildGoaliePeriod(base).data!);
    expect(root.querySelector('[data-testid="category-counts"]')!.textContent).toContain("Category Counts");
    expect(root.querySelector('[data-testid="tgv-existing"]')!.textContent).toContain("TGV grade (existing method)");
    expect(root.querySelector('[data-testid="tgv-existing"]')!.textContent).not.toMatch(/net|SV%/);
    for (const group of root.querySelectorAll('[data-testid="goalie-period-row"] [data-group="category-counts"]')) expect(group.textContent).not.toMatch(/TGV|Elite|Abysmal|pts/);
    for (const group of root.querySelectorAll('[data-testid="goalie-period-row"] [data-group="tgv"]')) expect(group.textContent).not.toMatch(/net|SV%|GAA/);
    expect(root.querySelector('[data-group="category-counts"] [data-selected-grade]')).toBeNull();
  });
  it("counts goalies per grade league-wide for the period, with each grade's points", async () => {
    const root = await render(buildGoaliePeriod({ ...base, tgv: season }).data!);
    const strip = (grade: string) => root.querySelector(`[data-strip-grade="${grade}"]`)!;
    expect(["Elite", "Good", "Average", "Bad", "Abysmal"].map(grade => strip(grade).querySelector("b")!.textContent)).toEqual(["1", "0", "0", "0", "1"]);
    expect(strip("Elite").textContent).toContain("20 pts");
    expect(strip("Abysmal").textContent).toContain("1 pts");
    expect(buildGoaliePeriod({ ...base, tgv: season }).data!.tgvLeague).toMatchObject({ label: TGV_LABEL, weeks: [4], unclassified: 0 });
    expect(root.body.textContent).toContain("Average cannot occur");
  });
  it("keeps each goalie's selected grade, season points and line in the row", async () => {
    const root = await render(buildGoaliePeriod({ ...base, tgv: season }).data!), row = root.querySelector('[data-testid="goalie-period-row"]')!;
    expect(row.querySelector("[data-selected-grade]")!.textContent).toBe("Elite");
    expect(row.querySelector('[data-group="tgv"]')!.textContent).toContain("50 pts");
  });
  it("shows a month's selected grades by week", async () => {
    const period = monthPeriod([...seasonWeeks], "2026-10", "2026-11-08");
    const root = await render(buildGoaliePeriod({ ...base, period, settings: { ...settings, period: "month", minStartsMonth: 2 }, tgv: season }).data!);
    expect(root.querySelector('[data-board="best"] [data-selected-grade]')!.textContent).toBe("E – G E");
    expect(root.body.textContent).toContain("Goalie of the Month");
  });
  it("draws a gap as a break, never as 0, and marks the selected week", async () => {
    const root = await render(buildGoaliePeriod({ ...base, tgv: season }).data!), spark = root.querySelector('[data-testid="goalie-period-row"] svg[data-sparkline]')!;
    expect(spark.getAttribute("data-sparkline")).toBe("20,gap,10,20");
    expect(spark.querySelectorAll("[data-point]")).toHaveLength(3);
    expect(spark.querySelectorAll("[data-gap]")).toHaveLength(1);
    // Weeks 3 to 4 join; nothing crosses week 2.
    expect(spark.querySelectorAll('path[fill="none"]')).toHaveLength(1);
    expect(spark.querySelector("[data-selected-week]")!.getAttribute("data-selected-week")).toBe("4");
    expect(spark.getAttribute("aria-label")).toContain("week 2 no grade");
  });
  it("shows grades, the line and the strip as unavailable when TGV could not be read", async () => {
    const root = await render(buildGoaliePeriod({ ...base, tgv: null }).data!), row = root.querySelector('[data-testid="goalie-period-row"]')!;
    expect(row.querySelector('[data-group="tgv"]')!.textContent).toBe("Unavailable");
    expect(row.querySelector("svg[data-sparkline]")).toBeNull();
    expect(root.querySelector('[data-testid="tgv-existing"]')!.textContent).toContain("Unavailable");
    expect(root.querySelector("[data-strip-grade]")).toBeNull();
  });
  it("asks the shell for each shown goalie's latest team logo", () => {
    expect(buildGoaliePeriod(base).teams).toEqual(["NJD", "NYR"]);
  });
  it("keeps the exact above, below and tied counts, weeks included, in the data and the alt text", () => {
    const result = buildGoaliePeriod(base), alt = goaliePeriodModule.altText({ evidence: result.evidence } as never, result.data, settings);
    expect(alt).toContain("Best: 1. G1");
    expect(alt).toContain("Worst: 1. G2");
    expect(alt).toContain("GAA: games 0 above, 2 below, 0 tied; weeks 0 above, 1 below, 0 tied");
    expect(alt).toContain("SO: games 1 above, 1 below, 0 tied");
    expect(alt).toContain("TGV grade (existing method): Elite 1, Good 0, Average 0, Bad 0, Abysmal 0, 20 points.");
    expect(alt).not.toMatch(/probab|likely/i);
  });
  it("shows starts, relief and N, in plain words", async () => {
    const root = await render(buildGoaliePeriod(base).data!), text = root.body.textContent!;
    expect(text).toContain("Goalie of the Week");
    expect(text).toContain("2 starts · 0 relief");
    expect(text).toContain("Week 4: 2 goalies, 4 starts");
    expect(text).toContain("Results not comparable: 0");
    expect(text).not.toMatch(/forecast|probab|likely/i);
  });
  it("says why a pool is empty", async () => {
    expect((await render(buildGoaliePeriod({ ...base, settings: { ...settings, minStartsWeek: 3 } }).data!)).body.textContent).toContain("No goalie has 3 official starts");
  });
});
