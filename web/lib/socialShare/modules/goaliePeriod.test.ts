import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { GoalieWeeklyAggregate, LeagueWeeklyAverage } from "components/GoaliePage/goalieTypes";
import { teamsInfo } from "lib/teamsInfo";
import { parseShareSettings } from "./contract";
import { buildGoaliePeriod, goaliePeriodModule, periodReadRange, resolvePeriod, TGV_LABEL, type GoaliePeriodData, type GoaliePeriodSettings } from "./goaliePeriod";
import { monthPeriod, weekPeriod, type MatchupWeek } from "./shared/categoryCounts";
import type { GoalieAppearance } from "./shared/goalieLedger";

const weeks: MatchupWeek[] = [{ week: 4, start: "2026-10-19", end: "2026-10-25" }, { week: 5, start: "2026-10-26", end: "2026-11-01" }];
const settings: GoaliePeriodSettings = { period: "week", week: 4, month: "", minStartsWeek: 2, minStartsMonth: 5, board: "best", categories: "wins,saves,svPct,gaa,shutouts" };
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
};
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
    expect(parseShareSettings(goaliePeriodModule, {})).toEqual({ period: "week", week: null, month: "", minStartsWeek: 2, minStartsMonth: 5, board: "best", categories: "wins,saves,svPct,gaa,shutouts" });
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
    expect(row.tgv).toEqual({ label: TGV_LABEL, state: "ready", grades: [{ week: 4, ranking: "Elite" }] });
    expect(row.categoryCounts).not.toHaveProperty("ranking");
    expect(row.tgv).not.toHaveProperty("gameNet");
  });
  it("marks TGV unavailable without touching the counts, and that is partial", () => {
    const result = buildGoaliePeriod({ ...base, tgv: null });
    expect(result.state).toBe("partial");
    expect(result.data!.rows[0].tgv).toEqual({ label: TGV_LABEL, state: "unavailable", grades: [] });
    expect(result.data!.rows[0].categoryCounts).toEqual(buildGoaliePeriod(base).data!.rows[0].categoryCounts);
  });
  it("leaves an ineligible week unclassified, as the existing method does", () => {
    const short = { ...tgv, goalies: [{ ...tgv.goalies[0], weekly_toi_seconds: 600 }, tgv.goalies[1]] };
    expect(buildGoaliePeriod({ ...base, tgv: short }).data!.rows[0].tgv.grades).toEqual([{ week: 4, ranking: null }]);
  });
  const render = async (data: GoaliePeriodData) => {
    const Card = await goaliePeriodModule.card();
    return renderToStaticMarkup(createElement(Card, { data, logos: {}, settings, snapshot: {} as never }));
  };
  it("never merges the labels on the card", async () => {
    const html = await render(buildGoaliePeriod(base).data!), root = new DOMParser().parseFromString(html, "text/html");
    const counts = root.querySelector('[data-testid="category-counts"]')!.textContent!, existing = root.querySelector('[data-testid="tgv-existing"]')!.textContent!;
    expect(counts).toContain("Category Counts");
    expect(counts).not.toMatch(/TGV|Elite|Good|Abysmal/);
    expect(existing).toContain("TGV grade (existing method)");
    expect(existing).toContain("W4 Elite");
    expect(existing).not.toMatch(/Category Counts|above|NET/);
  });
  it("shows per-category above, below and tied, compared cells, starts and N", async () => {
    const html = await render(buildGoaliePeriod(base).data!);
    expect(html).toContain("Goalie of the Week");
    expect(html).toContain("G1");
    expect(html).toContain("2–0–0");
    expect(html).toContain("Week 4: 2 goalies, 4 starts");
    expect(html).toContain("Unavailable cells: 0");
    expect(html).toContain("GAA ↓");
    expect(html).not.toMatch(/forecast|probab|likely/i);
  });
  it("names co-winners and says why a pool is empty", async () => {
    const tied = appearances.map(row => ({ ...row, wins: 0, losses: 0, saves: 25, shotsAgainst: 28, goalsAgainst: 3, shutouts: 0 }));
    const html = await render(buildGoaliePeriod({ ...base, appearances: tied }).data!);
    expect(html).toContain("2 tied");
    expect(html).toContain("G1 · G2");
    expect(await render(buildGoaliePeriod({ ...base, settings: { ...settings, minStartsWeek: 3 } }).data!)).toContain("No goalie has 3 official starts");
  });
});
