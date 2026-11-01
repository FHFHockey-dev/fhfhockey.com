import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { GoalieWeeklyAggregate, LeagueWeeklyAverage } from "components/GoaliePage/goalieTypes";
import { teamsInfo } from "lib/teamsInfo";
import { parseShareSettings } from "./contract";
import { adpLine, buildGoaliePeriod, goaliePeriodHeadline, goaliePeriodModule, goaliePicks, numericPick, periodReadRange, resolvePeriod, TGV_LABEL, tgvSeasonWeeks, undraftedAdp, type GoalieAdpRows, type GoaliePeriodData, type GoaliePeriodSettings } from "./goaliePeriod";
import { LONG_PERIOD_ROW_LIMIT, loadGoaliePeriod, readPeriodAdp } from "./goaliePeriod.sources";
import { cellTone, monthPeriod, rangePeriod, seasonPeriod, spanDays, weekPeriod, type MatchupWeek } from "./shared/categoryCounts";
import { heatLevel } from "./shared/goalieBoards";
import type { GoalieAppearance } from "./shared/goalieLedger";

const weeks: MatchupWeek[] = [{ week: 4, start: "2026-10-19", end: "2026-10-25" }, { week: 5, start: "2026-10-26", end: "2026-11-01" }];
const settings: GoaliePeriodSettings = { period: "week", week: 4, month: "", start: null, end: null, minStartsWeek: 2, minStartsMonth: 5, minStartsRange: 2, minStartsSeason: 1, board: "both", categories: "wins,saves,svPct,gaa,shutouts" };
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
/** Goalie `id` has Yahoo row 465.p.`id` with this pick; `undefined` leaves the goalie without a Yahoo row. */
const adpRows = (picks: Record<number, string | number | null | undefined>, averagePicks: (string | number | null)[] = ["192.0", "84.3", "-"]): GoalieAdpRows => {
  const owned = Object.entries(picks).filter(([, pick]) => pick !== undefined);
  return { goalies: owned.map(([id, pick]) => ({ player_key: `465.p.${id}`, player_id: id, average_pick: pick ?? null })), map: owned.map(([id]) => ({ yahoo_player_id: `465.p.${id}`, nhl_player_id: id })), averagePicks };
};
const base = { settings, period: weekPeriod(weeks[0], "2026-10-30"), appearances, reported, scheduled, tgv, adp: adpRows({ 1: "84.3", 2: "156.0" }) };

describe("goalie of the period", () => {
  it("ranks best and worst from one ranking, with evidence on every row", () => {
    const { data, state, evidence } = buildGoaliePeriod(base);
    expect(state).toBe("ready");
    expect(evidence.sample).toContain("Week 4, 2026-10-19 to 2026-10-25: 4 official starts in the 1 matchup week used.");
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
    expect(parseShareSettings(goaliePeriodModule, {})).toEqual({ period: "week", week: null, month: "", start: null, end: null, minStartsWeek: 2, minStartsMonth: 5, minStartsRange: 2, minStartsSeason: 1, board: "both", categories: "wins,saves,svPct,gaa,shutouts" });
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
  const pool = (n: number, values: (goalie: number) => Partial<GoalieAppearance> = goalie => ({ saves: 40 - goalie, shotsAgainst: 42 }), adp: GoalieAdpRows | null = base.adp) => {
    const games = Array.from({ length: n }, (_, index) => ({ id: index + 1, date: `2026-10-${String(19 + index % 7)}` }));
    const sched = games.map(game => ({ ...game, homeTeamId: NJD, awayTeamId: NYR }));
    const rep = games.flatMap(game => [{ gameId: game.id, date: game.date, team: "NJD" }, { gameId: game.id, date: game.date, team: "NYR" }]);
    const stats = rep.map((game, index) => stat(index % n + 1, game.team, game.gameId, game.date, values(index % n + 1)));
    return buildGoaliePeriod({ ...base, appearances: stats, reported: rep, scheduled: sched, adp });
  };
  it("shows both boards by default, Best first, with rank from the same ranking", async () => {
    expect(parseShareSettings(goaliePeriodModule, {}).board).toBe("both");
    const { data } = pool(20), root = await render(data!);
    const names = (board: string) => [...root.querySelectorAll(`[data-board="${board}"] [data-testid="goalie-period-row"] b:not([class*="heat"])`)].map(entry => entry.textContent).filter(text => text?.startsWith("G"));
    expect(names("best")).toEqual(["G1", "G2", "G3", "G4", "G5", "G6", "G7", "G8"]);
    // Ranked from the same order: the eight with the lowest worst rank, and nobody on both sides.
    const bottom = [...data!.rows].sort((a, b) => a.categoryCounts.worstRank! - b.categoryCounts.worstRank! || a.goalieId - b.goalieId).slice(0, 8).map(row => row.name);
    expect(names("worst")).toEqual(bottom);
    expect(names("worst").filter(name => names("best").includes(name))).toEqual([]);
    expect(root.querySelector('[data-testid="board-best"] h4 span')!.textContent).toBe("Best");
    expect(root.querySelector('[data-testid="board-worst"] h4 span')!.textContent).toBe("Worst");
    expect(root.body.textContent).not.toMatch(/Showing/);
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
    const result = pool(11, () => ({}));
    expect(result.data!.rows.every(row => row.categoryCounts.rank === 1 && row.categoryCounts.worstRank === 1)).toBe(true);
    const text = (await render(result.data!)).body.textContent!;
    expect(text).toContain("Best: 3 more tied at rank 1.");
    expect(result.data!.winners).toHaveLength(11);
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
    expect(root.querySelector('[data-testid="board-best"] h4')!.textContent).toContain("TGV grade (existing method)");
    for (const group of root.querySelectorAll('[data-testid="goalie-period-row"] [data-group="category-counts"]')) expect(group.textContent).not.toMatch(/TGV|Elite|Abysmal|pts/);
    for (const group of root.querySelectorAll('[data-testid="goalie-period-row"] [data-group="tgv"]')) expect(group.textContent).not.toMatch(/net|SV%|GAA/);
    expect(root.querySelector('[data-group="category-counts"] [data-selected-grade]')).toBeNull();
  });
  it("removes the league-wide grade section, and still labels each row's grade", async () => {
    for (const period of [weekPeriod(weeks[0], "2026-10-30"), monthPeriod([...seasonWeeks], "2026-10", "2026-11-08")]) {
      const root = await render(buildGoaliePeriod({ ...base, period, settings: { ...settings, period: period.kind, minStartsMonth: 2 }, tgv: season }).data!);
      expect(root.querySelector('[data-testid="tgv-existing"]')).toBeNull();
      expect(root.querySelector("[data-strip-grade]")).toBeNull();
      expect(root.body.textContent).not.toContain("at each grade");
      expect(root.querySelector("[data-selected-grade]")).not.toBeNull();
      expect(root.querySelector('[data-testid="board-worst"] h4')!.textContent).toContain(TGV_LABEL);
    }
    expect(buildGoaliePeriod(base).evidence.cohort).toContain("Average cannot occur");
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
  it("shows grades and the line as unavailable when TGV could not be read", async () => {
    const root = await render(buildGoaliePeriod({ ...base, tgv: null }).data!), row = root.querySelector('[data-testid="goalie-period-row"]')!;
    expect(row.querySelector('[data-group="tgv"]')!.textContent).toBe("Unavailable");
    expect(row.querySelector("svg[data-sparkline]")).toBeNull();
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
    expect(text).toContain("2 starts · week net");
    const { evidence } = buildGoaliePeriod(base);
    expect(evidence.sample).toContain("Week 4: 2 goalies, 4 starts");
    expect(evidence.sample).toContain("Comparisons not available: 0");
    expect(evidence.cohort).toContain("Ranked by Category Counts");
    expect(text).not.toMatch(/forecast|probab|likely/i);
  });
  it("says why a pool is empty", async () => {
    expect((await render(buildGoaliePeriod({ ...base, settings: { ...settings, minStartsWeek: 3 } }).data!)).body.textContent).toContain("No goalie has 3 official starts");
  });
  it("keeps one legend line, and writes one start and one relief in the singular", async () => {
    const root = await render(buildGoaliePeriod(base).data!);
    expect(root.querySelector('[data-testid="category-counts"]')!.textContent).toBe("Category Counts: W 2/2 = better than league average in 2 of 2 starts.");
    expect(root.body.textContent).not.toMatch(/Ranked by|Average cannot|Week 4: 2 goalies/);
    const one = buildGoaliePeriod({ ...base, settings: { ...settings, minStartsWeek: 1 }, appearances: [stat(1, "NJD", 1, "2026-10-20"), stat(2, "NYR", 1, "2026-10-20")], reported: reported.slice(0, 2), scheduled: scheduled.slice(0, 1) });
    expect((await render(one.data!)).body.textContent).toContain("1 start · week net");
    expect((await render(one.data!)).body.textContent).not.toContain("1 starts");
    expect(goaliePeriodModule.altText({ evidence: one.evidence } as never, one.data, settings)).not.toMatch(/\b1 starts/);
    expect(one.evidence.sample).toContain("2 official starts in the 1 matchup week used");
    expect(one.evidence.cohort).toContain("with at least 1 official start;");
    expect((await render(buildGoaliePeriod({ ...base, settings: { ...settings, minStartsWeek: 1 }, appearances: [] }).data!)).body.textContent).toContain("No goalie has 1 official start in");
  });
  describe("average ADP", () => {
    const line = async (data: GoaliePeriodData) => (await render(data)).querySelector('[data-testid="goalie-period-adp"]')!.textContent;
    const picks = (pick: (goalie: number) => string | number | null | undefined) => adpRows(Object.fromEntries(Array.from({ length: 20 }, (_, index) => [index + 1, pick(index + 1)])));
    it("averages every shown goalie on each board when all are drafted", async () => {
      const { data } = pool(20, undefined, picks(goalie => goalie * 10));
      const worst = data!.adp!.sides.find(side => side.kind === "worst")!;
      expect(data!.adp!.sides[0]).toEqual({ kind: "best", goalies: 8, undrafted: 0, average: 45 });
      expect(worst).toMatchObject({ goalies: 8, undrafted: 0 });
      expect(await line(data!)).toBe(`Avg ADP: Best 45.0 · Worst ${worst.average.toFixed(1)}. Counted as undrafted (200): Best 0 of 8 · Worst 0 of 8.`);
    });
    it("counts undrafted goalies at the fallback in a mean, not a median, and says how many", async () => {
      const { data } = pool(20, undefined, picks(goalie => goalie <= 4 ? "10" : "-"));
      expect(data!.adp!.sides).toEqual([{ kind: "best", goalies: 8, undrafted: 4, average: 105 }, { kind: "worst", goalies: 8, undrafted: 8, average: 200 }]);
      expect(await line(data!)).toBe("Avg ADP: Best 105.0 · Worst 200.0. Counted as undrafted (200): Best 4 of 8 · Worst 8 of 8.");
    });
    it("treats 0, a dash, null, blank and no Yahoo match as undrafted", () => {
      for (const pick of [0, "0", "0.0", "-", null, "", "n/a"]) expect(numericPick(pick)).toBeNull();
      expect(numericPick("84.3")).toBe(84.3);
      expect(numericPick(150)).toBe(150);
      const { data } = pool(20, undefined, picks(goalie => goalie === 1 ? "0" : goalie === 2 ? "-" : goalie === 3 ? null : goalie === 4 ? undefined : "20"));
      expect(data!.adp!.sides[0]).toEqual({ kind: "best", goalies: 8, undrafted: 4, average: 110 });
    });
    it("rounds the highest pick up to the next 10, and leaves an exact multiple", () => {
      expect(undraftedAdp(["192.0", "84.3", "-"])).toEqual({ highestPick: 192, undraftedValue: 200 });
      expect(undraftedAdp(["190.0", "-", null])).toEqual({ highestPick: 190, undraftedValue: 190 });
      expect(undraftedAdp(["190.1"])).toEqual({ highestPick: 190.1, undraftedValue: 200 });
      expect(pool(20, undefined, adpRows({}, ["190"])).data!.adp).toMatchObject({ undraftedValue: 190, sides: [{ average: 190 }, { average: 190 }] });
    });
    it("prints unavailable, never a guess, when the highest pick can't be read, and that is partial", async () => {
      expect(undraftedAdp(["-", null, 0])).toBeNull();
      for (const adp of [null, adpRows({ 1: "84.3" }, ["-"]), adpRows({ 1: "84.3" }, [])]) {
        const result = buildGoaliePeriod({ ...base, adp });
        expect(result.data!.adp).toBeNull();
        expect(result.state).toBe("partial");
        expect(result.reasons).toContain("Average draft position could not be read.");
        expect(result.evidence.sources.find(source => source.name === "Yahoo average pick")!.state).toBe("missing");
        expect(await line(result.data!)).toBe("Avg ADP: unavailable");
      }
      expect(adpLine(null)).not.toMatch(/\d/);
    });
    it("gives no value when an id is ambiguous, as Goalie Rescue's join does", () => {
      const row = (key: string, id: string, pick: string) => ({ player_key: key, player_id: id, average_pick: pick });
      const twoRows = { goalies: [row("465.p.1", "1", "50"), row("465.p.9", "9", "60")], map: [{ yahoo_player_id: "465.p.1", nhl_player_id: "1" }, { yahoo_player_id: "465.p.9", nhl_player_id: "1" }], averagePicks: [] };
      expect(goaliePicks(twoRows).has(1)).toBe(false);
      const twoIds = { goalies: [row("465.p.1", "1", "50")], map: [{ yahoo_player_id: "465.p.1", nhl_player_id: "1" }, { yahoo_player_id: "1", nhl_player_id: "2" }], averagePicks: [] };
      expect(goaliePicks(twoIds).size).toBe(0);
      expect(goaliePicks({ goalies: [row("465.p.1", "1", "50")], map: [{ yahoo_player_id: "1", nhl_player_id: "1" }], averagePicks: [] }).get(1)).toBe(50);
    });
    it("averages only the board shown", async () => {
      const data = buildGoaliePeriod({ ...base, settings: { ...settings, board: "worst" } }).data!;
      expect(data.adp!.sides.map(side => side.kind)).toEqual(["worst"]);
      expect(await line(data)).toMatch(/^Avg ADP: Worst [\d.]+\. Counted as undrafted \(200\): Worst 0 of 2\.$/);
    });
    it("works for a month", () => {
      const period = monthPeriod([...seasonWeeks], "2026-10", "2026-11-08");
      expect(buildGoaliePeriod({ ...base, period, settings: { ...settings, period: "month", minStartsMonth: 2 }, tgv: season }).data!.adp!.sides).toHaveLength(2);
    });
    it("states the fallback rule in the evidence and the line in the alt text, and keeps it off the card", async () => {
      const result = buildGoaliePeriod(base);
      expect(result.evidence.sample).toContain('no numeric pick, 0, "-", null or no Yahoo match, counts as the highest average pick of any player in yahoo_players, in any season, rounded up to the next 10: 192 gives 200');
      expect(result.evidence.sample).toContain("this season's Yahoo row only");
      expect(goaliePeriodModule.altText({ evidence: result.evidence } as never, result.data, settings)).toContain("Avg ADP: Best");
      expect((await render(result.data!)).body.textContent).not.toContain("rounded up");
    });
    /** Serves the rows it is given, recording each read's filters, in the shape `bounded` needs. */
    const fakeClient = (rows: Record<string, unknown[]>, fail?: string) => {
      const calls: { table: string; columns: string; filters: string[] }[] = [];
      return { calls, client: { from: (table: string) => {
        const call = { table, columns: "", filters: [] as string[] }; calls.push(call);
        const chain: Record<string, unknown> = {
          select: (columns: string) => { call.columns = columns; return chain; },
          eq: (column: string, value: unknown) => { call.filters.push(`eq:${column}:${value}`); return chain; },
          neq: (column: string, value: unknown) => { call.filters.push(`neq:${column}:${value}`); return chain; },
          in: (column: string) => { call.filters.push(`in:${column}`); return chain; },
          order: () => chain,
          range: async () => table === fail ? { data: null, error: { message: "read failed" }, count: null } : { data: rows[table] ?? [], error: null, count: (rows[table] ?? []).length },
        };
        return chain;
      } } };
    };
    it("reads a goalie's value from this Yahoo season only, and the highest pick across all", async () => {
      const yahoo = [{ player_key: "465.p.1", player_id: "1", average_pick: "84.3" }];
      const { client, calls } = fakeClient({ yahoo_players: yahoo, yahoo_nhl_player_map_read: [{ yahoo_player_id: "465.p.1", nhl_player_id: "1" }] });
      expect(await readPeriodAdp(client, 2026)).toMatchObject({ goalies: yahoo, averagePicks: ["84.3"] });
      const [goalieRead, pickRead] = calls.filter(call => call.table === "yahoo_players");
      expect(goalieRead.filters).toEqual(["eq:season:2026", "eq:display_position:G"]);
      expect(goalieRead.columns).toContain("average_pick:draft_analysis->>average_pick");
      expect(pickRead.filters).toEqual(["neq:draft_analysis->>average_pick:-"]);
      expect(calls.some(call => call.columns.includes("average_draft_pick"))).toBe(false);
    });
    it("reads as unavailable when any Yahoo read fails", async () => {
      expect(await readPeriodAdp(fakeClient({}, "yahoo_players").client, 2026)).toBeNull();
      expect(await readPeriodAdp(fakeClient({ yahoo_players: [{ player_key: "465.p.1", player_id: "1", average_pick: "1" }] }, "yahoo_nhl_player_map_read").client, 2026)).toBeNull();
    });
  });
  describe("custom range and season to date", () => {
    const week = (number: number, start: string, end: string): MatchupWeek => ({ week: number, start, end });
    const calendar = [week(1, "2026-10-05", "2026-10-11"), week(2, "2026-10-12", "2026-10-18"), week(3, "2026-10-19", "2026-10-25"), week(4, "2026-10-26", "2026-11-01")];
    const at = (start: string, end: string) => ({ period: weekPeriod(week(9, start, end), "2027-01-01") });
    const headlineOf = (period: Parameters<typeof goaliePeriodHeadline>[1]) => goaliePeriodHeadline(settings, period);
    it("prints the headline for each view, from the matchup's real dates", () => {
      expect(spanDays("2026-10-05", "2026-10-11")).toBe(7);
      expect(headlineOf(at("2026-10-05", "2026-10-10"))).toBe("Goalie of the Week");
      expect(headlineOf(at("2026-10-05", "2026-10-11"))).toBe("Goalie of the Week");
      expect(headlineOf(at("2026-10-05", "2026-10-12"))).toBe("Goalie of the Matchup");
      expect(headlineOf({ period: monthPeriod(calendar, "2026-10", "2026-11-08") })).toBe("Goalie of the Month");
      expect(headlineOf({ period: rangePeriod(calendar, "2026-10-08", "2026-10-20", "2026-11-01") })).toBe("Goalie of the Period");
      expect(headlineOf({ period: seasonPeriod(calendar, "2026-10-30") })).toBe("Goalie of the Season");
      expect(goaliePeriodHeadline({ period: "season" }, null)).toBe("Goalie of the Season");
      expect(goaliePeriodHeadline({ period: "week" }, null)).toBe("Goalie of the Week");
    });
    it("validates a custom range before reading", () => {
      const parse = (query: Record<string, string>) => parseShareSettings(goaliePeriodModule, { period: "custom", ...query });
      expect(() => parse({})).toThrow(/needs a start date and an end date/);
      expect(() => parse({ start: "2026-10-08" })).toThrow(/needs a start date/);
      expect(() => parse({ start: "2026-10-20", end: "2026-10-08" })).toThrow(/before the end date/);
      expect(() => parse({ start: "2026-10-20", end: "2026-10-20" })).toThrow(/before the end date/);
      expect(() => parse({ start: "2026-02-31", end: "2026-10-20" })).toThrow();
      expect(parse({ start: "2026-10-08", end: "2026-10-20" })).toMatchObject({ start: "2026-10-08", end: "2026-10-20" });
    });
    it("refuses a range outside the season or past the completed games", () => {
      const resolve = (start: string, end: string, through = "2026-10-20") => resolvePeriod({ period: "custom", week: null, month: "", start, end }, calendar, through);
      expect(resolve("2026-10-08", "2026-10-20")).toMatchObject({ period: { kind: "custom", label: "2026-10-08 to 2026-10-20" } });
      expect(resolve("2026-09-01", "2026-10-20")).toEqual({ reason: "The range must fall inside the season, 2026-10-05 to 2026-11-01." });
      expect(resolve("2026-10-08", "2026-11-20", "2026-12-01")).toEqual({ reason: "The range must fall inside the season, 2026-10-05 to 2026-11-01." });
      expect(resolve("2026-10-08", "2026-10-21")).toEqual({ reason: "The end date 2026-10-21 is past the last completed games, 2026-10-20." });
      expect(resolvePeriod({ period: "season", week: null, month: "" }, calendar, "2026-10-01")).toEqual({ reason: "No matchup week has started." });
    });
    it("gives a range the month's rules: baselines from whole weeks, week cells by most days", () => {
      const range = rangePeriod(calendar, "2026-10-08", "2026-10-22", "2026-11-01");
      // Oct 8-11 is 4 of 7 days of week 1, week 2 is whole, and Oct 19-22 is 4 of 7 of week 3.
      expect(range.touchedWeeks.map(entry => entry.week)).toEqual([1, 2, 3]);
      expect(range.cellWeeks.map(entry => entry.week)).toEqual([1, 2, 3]);
      expect(rangePeriod(calendar, "2026-10-10", "2026-10-20", "2026-11-01").cellWeeks.map(entry => entry.week)).toEqual([2]);
      expect(rangePeriod(calendar, "2026-10-06", "2026-10-07", "2026-11-01").cellWeeks).toEqual([]);
      expect(periodReadRange(range)).toEqual({ from: "2026-10-05", through: "2026-10-25" });
      // An even split goes to the side with the later days.
      const six = [week(1, "2026-10-05", "2026-10-10")];
      expect(rangePeriod(six, "2026-10-08", "2026-10-10", "2026-11-01").cellWeeks).toHaveLength(1);
      expect(rangePeriod(six, "2026-10-05", "2026-10-07", "2026-11-01").cellWeeks).toHaveLength(0);
    });
    const twoWeeks = [week(1, "2026-10-05", "2026-10-11"), week(2, "2026-10-12", "2026-10-18")];
    /** Goalie 1 wins on Oct 6 and 13, in two different weeks. Goalies 2 and 3 have one start each, on Oct 6 and Oct 13. */
    const fixture = () => {
      const games = [{ id: 11, date: "2026-10-06" }, { id: 12, date: "2026-10-13" }];
      return {
        scheduled: games.map(game => ({ ...game, homeTeamId: NJD, awayTeamId: NYR })),
        reported: games.flatMap(game => [{ gameId: game.id, date: game.date, team: "NJD" }, { gameId: game.id, date: game.date, team: "NYR" }]),
        appearances: [stat(1, "NJD", 11, "2026-10-06", { wins: 1, saves: 40, shotsAgainst: 41, goalsAgainst: 1 }), stat(2, "NYR", 11, "2026-10-06", { losses: 1, saves: 20, shotsAgainst: 25, goalsAgainst: 5 }), stat(1, "NJD", 12, "2026-10-13", { wins: 1, saves: 35, shotsAgainst: 36, goalsAgainst: 1 }), stat(3, "NYR", 12, "2026-10-13", { losses: 1, saves: 18, shotsAgainst: 24, goalsAgainst: 6 })],
      };
    };
    it("ranks every goalie with a start for the season at the default minimum of 1, and states it", async () => {
      const season = { ...settings, period: "season" };
      const result = buildGoaliePeriod({ ...base, ...fixture(), settings: season, period: seasonPeriod(twoWeeks, "2026-10-18"), tgv: null, adp: base.adp });
      expect(result.data!.minStarts).toBe(1);
      expect(result.data!.rows.map(row => [row.goalieId, row.categoryCounts.starts, row.categoryCounts.rank !== null])).toEqual(expect.arrayContaining([[1, 2, true], [2, 1, true], [3, 1, true]]));
      expect(result.data!.ranked).toBe(3);
      expect(buildGoaliePeriod({ ...base, ...fixture(), settings: { ...season, minStartsSeason: 2 }, period: seasonPeriod(twoWeeks, "2026-10-18") }).data!.ranked).toBe(1);
      const root = await render(result.data!);
      expect(root.body.textContent).toContain("Season to date, through 2026-10-18. Min 1 start.");
      expect(root.body.textContent).toContain("Goalie of the Season");
      expect(result.evidence.cohort).toContain("Season to date uses Category Counts' month rules");
      expect(result.data!.adp).not.toBeNull();
    });
    it("keeps a range's game cells to its dates, against the same baselines as the whole week", async () => {
      const range = rangePeriod(twoWeeks, "2026-10-07", "2026-10-14", "2026-10-18");
      const result = buildGoaliePeriod({ ...base, ...fixture(), settings: { ...settings, period: "custom", start: "2026-10-07", end: "2026-10-14", minStartsRange: 1 }, period: range, tgv: null });
      const one = (id: number, data = result.data!) => data.rows.find(row => row.goalieId === id)!.categoryCounts;
      expect(one(1).starts).toBe(1);
      expect(result.data!.rows.some(row => row.goalieId === 2)).toBe(false);
      const whole = buildGoaliePeriod({ ...base, ...fixture(), period: weekPeriod(twoWeeks[1], "2026-10-18"), settings: { ...settings, minStartsWeek: 1 }, tgv: null }).data!;
      expect(one(1).game).toEqual(one(1, whole).game);
      expect(result.evidence.cohort).toContain("in the range or not");
      const text = (await render(result.data!)).body.textContent!;
      expect(text).toContain("2026-10-07 to 2026-10-14. Min 1 start.");
      expect(text).toContain("Goalie of the Period");
    });
    it("draws a long season as readable bars with its gaps, and a short range's chip as a dash", async () => {
      const weeks26 = Array.from({ length: 26 }, (_, index) => { const start = new Date(Date.UTC(2026, 9, 5 + index * 7)).toISOString().slice(0, 10), end = new Date(Date.UTC(2026, 9, 11 + index * 7)).toISOString().slice(0, 10); return week(index + 1, start, end); });
      const league = weeks26.map(entry => ({ ...tgv.league[0], week: entry.week }));
      const goalies = weeks26.filter(entry => entry.week !== 5).flatMap(entry => [{ ...tgv.goalies[0], week: entry.week }, { ...tgv.goalies[1], week: entry.week }]);
      const data = buildGoaliePeriod({ ...base, ...fixture(), settings: { ...settings, period: "season" }, period: seasonPeriod(weeks26, "2027-04-04"), tgv: { weeks: weeks26, league, goalies } }).data!;
      const row = (await render(data)).querySelector('[data-testid="goalie-period-row"]')!, spark = row.querySelector("svg[data-sparkline]")!;
      expect(spark.hasAttribute("data-bars")).toBe(true);
      expect(spark.querySelectorAll("[data-point]")).toHaveLength(25);
      expect(spark.querySelectorAll("[data-gap]")).toHaveLength(1);
      expect(spark.querySelector("[data-selected-week]")).toBeNull();
      expect(spark.querySelector("[data-point]")!.getAttribute("fill")).toBe("#63D2F5");
      expect(row.querySelector("[data-selected-grade]")!.textContent).toBe("25 wks");
      const short = rangePeriod(twoWeeks, "2026-10-06", "2026-10-07", "2026-10-18");
      const dash = (await render(buildGoaliePeriod({ ...base, ...fixture(), settings: { ...settings, period: "custom", minStartsRange: 1 }, period: short, tgv: { weeks: tgvSeasonWeeks(twoWeeks, short), league: [{ ...tgv.league[0], week: 1 }], goalies: [{ ...tgv.goalies[0], week: 1 }] } }).data!)).querySelector("[data-selected-grade]")!;
      expect(dash.textContent).toBe("–");
      expect(tgvSeasonWeeks(twoWeeks, short).map(entry => entry.week)).toEqual([1]);
    });
    it("keeps a week's and a month's minimums where they were", () => {
      expect(buildGoaliePeriod(base).data!.minStarts).toBe(2);
      expect(buildGoaliePeriod({ ...base, settings: { ...settings, period: "month" }, period: monthPeriod(calendar, "2026-10", "2026-11-08") }).data!.minStarts).toBe(5);
    });
    /** Every table's rows through `range`, with the exact count `bounded` needs. */
    const pagedClient = (rows: Record<string, unknown[]>) => ({ from: (table: string) => {
      const chain: Record<string, unknown> = {};
      for (const method of ["select", "eq", "neq", "gte", "lte", "in", "order"]) chain[method] = () => chain;
      chain.range = async (start: number, end: number) => ({ data: (rows[table] ?? []).slice(start, end + 1), error: null, count: (rows[table] ?? []).length });
      return chain;
    } });
    const matchups = [{ week: 1, start_date: "2026-10-05", end_date: "2026-10-11" }];
    const loadSeason = (rows: Record<string, unknown[]>) => loadGoaliePeriod({ client: pagedClient({ yahoo_matchup_weeks: matchups, ...rows }), generatedAt: "2026-10-20T16:00:00Z" }, { ...settings, period: "season" });
    it("fails visibly when a season read is over its ceiling", async () => {
      const over = Array.from({ length: LONG_PERIOD_ROW_LIMIT + 1 }, (_, index) => ({ goalie_id: index }));
      const result = await loadSeason({ wgo_goalie_stats: over });
      expect(result.state).toBe("missing");
      expect(result.data).toBeNull();
      expect(result.reasons![0]).toBe(`Season to date, through 2026-10-19 is too large to read: Goalie appearances response was incomplete or over its ${LONG_PERIOD_ROW_LIMIT}-row limit.`);
    });
    it("explains a refused range through the same state", async () => {
      const result = await loadGoaliePeriod({ client: pagedClient({ yahoo_matchup_weeks: matchups }), generatedAt: "2026-10-20T16:00:00Z" }, { ...settings, period: "custom", start: "2026-10-06", end: "2026-11-20" });
      expect(result).toMatchObject({ state: "missing", data: null });
      expect(result.reasons![0]).toMatch(/inside the season/);
    });
  });
});
