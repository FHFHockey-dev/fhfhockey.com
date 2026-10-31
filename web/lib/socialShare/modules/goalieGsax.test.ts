import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { parseShareSettings } from "./contract";
import { buildGoalieGsax, fhfhModelStatus, goalieGsaxModule, NST_GSAX_COLUMNS, NST_GSAX_TABLES, toNstGoalieGames, type GoalieGsaxData, type GoalieGsaxInput, type NstGoalieGame, type NstGsaxRow } from "./goalieGsax";
import type { GoalieAppearance } from "./shared/goalieLedger";

const date = (index: number) => `2026-10-${String(index + 1).padStart(2, "0")}`;
const appearance = (goalieId: number, index: number, values: Partial<GoalieAppearance> = {}): GoalieAppearance => ({ goalieId, name: `G${goalieId}`, gameId: goalieId * 100 + index, date: date(index), team: "NJD", opponent: null, home: null, started: true, wins: 0, losses: 0, otLosses: 0, saves: 25, shotsAgainst: 28, goalsAgainst: 3, toiSeconds: 3600, shutouts: 0, qualityStart: 0, ...values });
const nst = (goalieId: number, index: number, values: Partial<NstGoalieGame> = {}): NstGoalieGame => ({ goalieId, date: date(index), toiSeconds: 3600, xgAgainst: 3, goalsAgainst: 2, shotsAgainst: 28, ...values });
const base: GoalieGsaxInput = { appearances: [], nstGames: [], strength: "all", window: 10, board: "best", minAppearances: 3, minCoverage: 90, reported: [], scheduled: [], fhfhRows: 0 };
const three = (goalieId: number) => [0, 1, 2].map(index => appearance(goalieId, index));

describe("NST-model GSAx", () => {
  it("is xG against minus goals against, with a sign both ways", () => {
    const { data } = buildGoalieGsax({ ...base, appearances: [...three(1), ...three(2)], nstGames: [...[0, 1, 2].map(index => nst(1, index, { xgAgainst: 3.2, goalsAgainst: 2 })), ...[0, 1, 2].map(index => nst(2, index, { xgAgainst: 2, goalsAgainst: 3 }))] });
    expect(data!.rows.map(row => [row.goalieId, row.gsax, row.rank])).toEqual([[1, 3.6, 1], [2, -3, 2]]);
    expect(data!.rows[1].gsaxPer60).toBe(-1);
  });
  it("never reads gsaa, the above-average metric", () => {
    expect(NST_GSAX_COLUMNS).not.toContain("gsaa");
    expect(readFileSync("lib/socialShare/modules/goalieGsax.sources.ts", "utf8")).not.toMatch(/gsaa/);
  });
  it("keeps strengths apart: one table per setting, labeled on every output", () => {
    expect(NST_GSAX_TABLES).toEqual({ all: "nst_gamelog_goalie_all_counts", "5v5": "nst_gamelog_goalie_5v5_counts" });
    const input = { ...base, appearances: three(1), nstGames: [0, 1, 2].map(index => nst(1, index)) };
    const all = buildGoalieGsax(input), even = buildGoalieGsax({ ...input, strength: "5v5" });
    expect(all.evidence.strength).toBe("All situations");
    expect(even.evidence.strength).toBe("5 on 5");
    expect(even.evidence.sources[0]).toMatchObject({ name: "NST 5 on 5 goalie logs (NST model)", tables: ["nst_gamelog_goalie_5v5_counts"] });
    expect(even.data!.strengthLabel).toBe("5 on 5");
  });
  it("converts NST minutes to seconds once", () => {
    const row: NstGsaxRow = { player_id: 1, player_name: "G1", date_scraped: "2026-10-01", season: 20262027, toi: 60.5, xg_against: 2, goals_against: 1, shots_against: 20 };
    expect(toNstGoalieGames([row], { season: 20262027, through: "2026-10-30" })[0].toiSeconds).toBe(3630);
    const { data } = buildGoalieGsax({ ...base, minAppearances: 1, appearances: [appearance(1, 0)], nstGames: toNstGoalieGames([row], { season: 20262027, through: "2026-10-30" }) });
    expect(data!.rows[0].toiSeconds).toBe(3630);
    expect(data!.rows[0].gsaxPer60).toBeCloseTo(3600 / 3630, 10);
  });
  it("drops other seasons and refuses a duplicate goalie date", () => {
    const row: NstGsaxRow = { player_id: 1, player_name: "G1", date_scraped: "2026-10-01", season: 20262027, toi: 60, xg_against: 2, goals_against: 1, shots_against: 20 };
    expect(toNstGoalieGames([{ ...row, season: 20252026 }, { ...row, date_scraped: "2026-11-01" }], { season: 20262027, through: "2026-10-30" })).toEqual([]);
    expect(() => toNstGoalieGames([row, row], { season: 20262027, through: "2026-10-30" })).toThrow(/duplicate/);
  });
  it("shows NST's lag, stops windows at its through-date and counts later appearances", () => {
    const { data, evidence } = buildGoalieGsax({ ...base, appearances: [...three(1), appearance(1, 3), appearance(2, 3)], nstGames: [0, 1, 2].map(index => nst(1, index)) });
    expect(data).toMatchObject({ nstThrough: "2026-10-03", wgoThrough: "2026-10-04", lagDays: 1, appearancesBehindNst: 2 });
    expect(data!.rows.map(row => [row.goalieId, row.appearances, row.lastDate])).toEqual([[1, 3, "2026-10-03"]]);
    expect(evidence.sources[0]).toMatchObject({ asOf: "2026-10-03", reasons: ["1 day behind NHL.com"] });
  });
  it("ranks only goalies admitted on coverage and sample, never zero-filling the rest", () => {
    const appearances = [...Array.from({ length: 10 }, (_, index) => appearance(1, index)), ...Array.from({ length: 10 }, (_, index) => appearance(2, index)), appearance(3, 9)];
    const nstGames = [...Array.from({ length: 9 }, (_, index) => nst(1, index)), nst(2, 9), ...Array.from({ length: 8 }, (_, index) => nst(2, index)), nst(3, 9)];
    const { data, evidence } = buildGoalieGsax({ ...base, appearances, nstGames });
    const row = (id: number) => data!.rows.find(entry => entry.goalieId === id)!;
    expect(row(1)).toMatchObject({ covered: 9, appearances: 10, missing: 1, coveragePct: 90, admitted: true, gsax: 9, rank: 1 });
    expect(row(2)).toMatchObject({ covered: 9, appearances: 10, admitted: true });
    expect(row(3)).toMatchObject({ covered: 1, appearances: 1, short: true, admitted: false, gsax: null, gsaxPer60: null, rank: null });
    expect(evidence.coverage).toEqual({ observed: 19, expected: 21, missing: 2, unit: "goalie appearances" });
    const strict = buildGoalieGsax({ ...base, appearances, nstGames, minCoverage: 95 }).data!;
    expect(strict.rows.every(entry => entry.rank === null && entry.gsax === null)).toBe(true);
    expect(goalieGsaxModule.hasRows(strict, {} as never)).toBe(false);
  });
  it("treats a row with null xG as missing, not as zero", () => {
    const { data } = buildGoalieGsax({ ...base, minCoverage: 50, appearances: three(1), nstGames: [nst(1, 0), nst(1, 1), nst(1, 2, { xgAgainst: null })] });
    expect(data!.rows[0]).toMatchObject({ covered: 2, missing: 1, gsax: 2, xgAgainst: 6, goalsAgainst: 4 });
  });
  it("drops an NST row with no matching NHL.com appearance and counts it", () => {
    const { data } = buildGoalieGsax({ ...base, appearances: three(1), nstGames: [...[0, 1, 2].map(index => nst(1, index)), nst(9, 1)] });
    expect(data!.unmatchedNstRows).toBe(1);
    expect(data!.rows.map(row => row.goalieId)).toEqual([1]);
  });
  it("counts starts and relief apart, inside the window", () => {
    const appearances = [appearance(1, 0), appearance(1, 1, { started: false }), appearance(1, 2)];
    expect(buildGoalieGsax({ ...base, appearances, nstGames: [0, 1, 2].map(index => nst(1, index)) }).data!.rows[0]).toMatchObject({ starts: 2, relief: 1 });
  });
  it("ranks ties together and can sort from the bottom", () => {
    const input = { ...base, appearances: [...three(1), ...three(2), ...three(3)], nstGames: [1, 2].flatMap(id => [0, 1, 2].map(index => nst(id, index, { xgAgainst: 2.1, goalsAgainst: 2 }))).concat([0, 1, 2].map(index => nst(3, index, { xgAgainst: 1, goalsAgainst: 2 }))) };
    expect(buildGoalieGsax(input).data!.rows.map(row => [row.goalieId, row.rank])).toEqual([[1, 1], [2, 1], [3, 3]]);
    expect(buildGoalieGsax({ ...input, board: "worst" }).data!.rows.map(row => [row.goalieId, row.rank])).toEqual([[3, 1], [1, 2], [2, 2]]);
  });
  it("is missing with no NST rows, and partial on a schedule gap", () => {
    expect(buildGoalieGsax({ ...base, appearances: three(1) })).toMatchObject({ state: "missing", data: null });
    const gap = buildGoalieGsax({ ...base, appearances: three(1), nstGames: [0, 1, 2].map(index => nst(1, index)), scheduled: [{ id: 5, date: "2026-10-01", homeTeamId: 1, awayTeamId: 2 }] });
    expect(gap.state).toBe("partial");
  });
  it("reports the FHFH model as unavailable this season, and does not mix it in", () => {
    expect(fhfhModelStatus(0)).toEqual({ state: "unavailable", rows: 0, reason: "FHFH xG model: unavailable this season, 0 goalie games." });
    expect(fhfhModelStatus(null).state).toBe("unavailable");
    expect(fhfhModelStatus(12).state).toBe("not-used");
    const { evidence, data } = buildGoalieGsax({ ...base, appearances: three(1), nstGames: [0, 1, 2].map(index => nst(1, index)) });
    expect(evidence.sources.find(source => source.name === "FHFH xG model")).toMatchObject({ state: "missing", reasons: [data!.fhfhModel.reason] });
  });
  it("has visible defaults", () => {
    expect(parseShareSettings(goalieGsaxModule, {})).toEqual({ window: "10", strength: "all", board: "best", minAppearances: 3, minCoverage: 90 });
  });
});

describe("GSAx card", () => {
  const render = async (data: GoalieGsaxData) => {
    const Card = await goalieGsaxModule.card();
    return renderToStaticMarkup(createElement(Card, { data, logos: {}, settings: {} as never, snapshot: {} as never }));
  };
  const ready = buildGoalieGsax({ ...base, appearances: [...three(1), appearance(1, 3)], nstGames: [0, 1, 2].map(index => nst(1, index, { xgAgainst: 2, goalsAgainst: 3 })) }).data!;
  it("prints the model, strength, sign, lag, sample and the FHFH model's state", async () => {
    const html = await render(ready);
    expect(html).toContain("NST model, All situations.");
    expect(html).toContain("−3.00");
    expect(html).toContain("through 2026-10-03, 1 day behind NHL.com (2026-10-04); later appearances not counted: 1");
    expect(html).toContain("3/3");
    expect(html).toContain("FHFH xG model: unavailable this season, 0 goalie games.");
    expect(html).not.toMatch(/gsaa|probab|likely|will start/i);
  });
  it("says why an empty pool is empty", async () => {
    expect(await render(buildGoalieGsax({ ...base, minAppearances: 9, appearances: three(1), nstGames: [0, 1, 2].map(index => nst(1, index)) }).data!)).toContain("No goalie has 9 appearances at 90% NST coverage");
  });
});
