// @vitest-environment jsdom
import { createElement } from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { BSH_BAR_PX, BSH_LEADER_ROWS, BSH_LETTER_PX, BSH_MOVER_ROWS, bshBar, bshBoardModule, buildBshBoard, rangeMinGp, skaterSeasonEvidence, skaterSeasonScope, type BshBoardData, type BshBoardSettings, type SkaterSeason } from "./bshBoard";
import { loadBshBoard } from "./bshBoard.sources";
import { parseShareSettings, sharePostExportBlock, type SharePostSnapshot } from "./contract";
import { skaterBoardModules } from "./lanes/skaterBoards";
import type { SkaterAppearance } from "./shared/skaterAppearances";

const settings = (over: Partial<BshBoardSettings> = {}): BshBoardSettings => ({ period: "rolling", week: null, start: null, end: null, minGpRange: null, view: "leaders", window: "l5", comparison: "previous", minGp: 1, position: "all", ...over });
const game = (playerId: number, index: number, stats: Partial<SkaterAppearance> = {}): SkaterAppearance => ({
  playerId, name: `Skater ${playerId}`, position: "C", group: "F", gameId: 1000 + index, date: `2026-10-${String(index + 1).padStart(2, "0")}`, team: "NJD", opponent: "NYR", home: true,
  goals: 0, assists: 0, points: 0, shots: 1, hits: 1, blocks: 1, ppPoints: 0, toiSeconds: 900, ppToiSeconds: 0, penaltyMinutes: 0, ...stats,
});
const games = (playerId: number, count: number, stats: Partial<SkaterAppearance> | ((index: number) => Partial<SkaterAppearance>) = {}) => Array.from({ length: count }, (_, index) => game(playerId, index, typeof stats === "function" ? stats(index) : stats));
/** Complete coverage for whatever games the appearances name. */
const season = (appearances: SkaterAppearance[]): SkaterSeason => {
  const teamGames = [...new Map(appearances.map(row => [`${row.team}:${row.gameId}`, { gameId: row.gameId, date: row.date, team: row.team! }])).values()];
  return { appearances, teamGames, scheduledGames: teamGames.length / 2, through: "2026-10-30" };
};

describe("BSH leaderboard", () => {
  it("ranks per game over the window and shows all three components", () => {
    const { data, state } = buildBshBoard(season([...games(1, 6, { blocks: 2, shots: 3, hits: 1 }), ...games(2, 5, { blocks: 0, shots: 1, hits: 0 })]), settings());
    expect(state).toBe("ready");
    expect(data!.rows.map(row => [row.playerId, row.rank, row.recent.games, row.recent.bsh, row.recent.bshPerGame])).toEqual([[1, 1, 5, 30, 6], [2, 2, 5, 5, 1]]);
    expect(data!.rows[0].recent).toMatchObject({ blocks: 10, shots: 15, hits: 5, blocksPerGame: 2, shotsPerGame: 3, hitsPerGame: 1 });
  });
  it("keeps a skater with a missing component unranked, and never fills it from shot attempts", () => {
    const withAttempts = { shots: null, shotAttempts: 9 } as Partial<SkaterAppearance>;
    const { data } = buildBshBoard(season([...games(1, 5, index => index === 4 ? withAttempts : {}), ...games(2, 5)]), settings());
    expect(data!.rows.map(row => row.playerId)).toEqual([2]);
    expect(data!.cohort).toMatchObject({ eligible: 2, ranked: 1, missingComponent: 1 });
  });
  it("ignores a missing game outside the window", () => {
    const { data } = buildBshBoard(season(games(1, 6, index => index === 0 ? { hits: null } : {})), settings());
    expect(data!.rows.map(row => row.playerId)).toEqual([1]);
  });
  it("shares tied ranks and counts ties below the cut", () => {
    const tied = buildBshBoard(season([...games(1, 5, { shots: 5 }), ...games(2, 5), ...games(3, 5), ...games(4, 5, { shots: 0 })]), settings());
    expect(tied.data!.rows.map(row => row.rank)).toEqual([1, 2, 2, 4]);
    const many = buildBshBoard(season(Array.from({ length: 22 }, (_, index) => games(index + 1, 5)).flat()), settings());
    expect(many.data).toMatchObject({ notShown: 10, tiedBeyondCut: 10 });
    expect(many.data!.rows).toHaveLength(BSH_LEADER_ROWS);
    expect(many.data!.rows.every(row => row.rank === 1)).toBe(true);
    expect(many.evidence.cohort).toContain("10 more below the card, 10 tied with the last row");
  });
  it("shows the actual count for a short window and applies season GP and position", () => {
    const { data } = buildBshBoard(season([...games(1, 3), ...games(2, 8, { position: "D", group: "D" })]), settings({ window: "l10", minGp: 5, position: "D" }));
    expect(data!.rows.map(row => [row.playerId, row.recent.games])).toEqual([[2, 8]]);
    expect(buildBshBoard(season(games(1, 3)), settings({ window: "l10" })).data!.rows[0].recent.games).toBe(3);
    expect(data!.cohort.eligible).toBe(1);
  });
  it("binds a traded skater's games to the team of each game", () => {
    const rows = games(1, 5, index => ({ team: index < 2 ? "NYR" : "NJD" }));
    const { data, teams } = buildBshBoard(season(rows), settings());
    expect(data!.rows[0]).toMatchObject({ team: "NJD", teams: ["NJD", "NYR"] });
    expect(teams).toEqual(["NJD"]);
  });
  it("has no rank and nothing to export for an empty pool", () => {
    const empty = buildBshBoard(season(games(1, 2)), settings({ minGp: 5 }));
    expect(empty.data!.rows).toEqual([]);
    expect(bshBoardModule.hasRows(empty.data, settings({ minGp: 5 }))).toBe(false);
  });
});

describe("BSH bar", () => {
  const rates = (blocksPerGame: number | null, shotsPerGame: number | null, hitsPerGame: number | null) => ({ blocksPerGame, shotsPerGame, hitsPerGame });
  it("gives each section its share of the total, B then S then H", () => {
    const bar = bshBar(rates(2, 3, 1), BSH_BAR_PX.leaders);
    expect(bar.state).toBe("split");
    expect(bar.sections.map(section => section.layer)).toEqual(["b", "s", "h"]);
    expect(bar.sections.map(section => section.value)).toEqual([2, 3, 1]);
    expect(bar.sections.map(section => section.share)).toEqual([2 / 6, 3 / 6, 1 / 6]);
    expect(bar.sections.reduce((total, section) => total + section.share, 0)).toBeCloseTo(1);
  });
  it("hides a letter only when its section is too narrow at that bar's width", () => {
    const letters = (barPx: number, blocks: number) => (bshBar(rates(blocks, 6 - blocks, 0), barPx).sections as { letter: boolean }[]).map(section => section.letter);
    expect(letters(BSH_BAR_PX.movers, 0.1)).toEqual([false, true]);
    expect(letters(BSH_BAR_PX.leaders, 0.1)).toEqual([false, true]);
    expect(letters(BSH_BAR_PX.movers, 0.15)).toEqual([false, true]);
    expect(letters(BSH_BAR_PX.leaders, 0.15)).toEqual([true, true]);
    expect(letters(BSH_LETTER_PX * 6, 1)).toEqual([true, true]); // Exactly the letter's width holds it.
  });
  it("gives a zero no section, and all zeros no split", () => {
    expect(bshBar(rates(0, 3, 1), BSH_BAR_PX.leaders).sections.map(section => section.layer)).toEqual(["s", "h"]);
    expect(bshBar(rates(0, 0, 0), BSH_BAR_PX.leaders)).toEqual({ state: "empty", sections: [] });
  });
  it("never shares out a missing value", () => {
    for (const missing of [rates(null, 3, 1), rates(2, null, 1), rates(2, 3, null)]) expect(bshBar(missing, BSH_BAR_PX.leaders)).toEqual({ state: "missing", sections: [] });
  });
  it("holds 12 leaders and 7 risers and fallers a side", () => {
    const moving = (id: number, up: boolean) => games(id, 10, entry => ({ shots: entry >= 5 === up ? 4 : 1 }));
    const many = season(Array.from({ length: 22 }, (_, index) => moving(index + 1, index % 2 === 0)).flat());
    expect(buildBshBoard(many, settings()).data!.rows).toHaveLength(12);
    const { data, evidence, teams } = buildBshBoard(many, settings({ view: "movers" }));
    expect([data!.risers.length, data!.fallers.length]).toEqual([BSH_MOVER_ROWS, BSH_MOVER_ROWS]);
    expect(data!.rows).toEqual([]);
    expect(data!.cohort).toMatchObject({ risers: 11, fallers: 11, ranked: 22 });
    expect(data).toMatchObject({ notShown: 8, tiedBeyondCut: 8 });
    expect(evidence.cohort).toContain("risers: 4 more below the card, 4 tied with the last row, fallers: 4 more below the card");
    expect(teams).toEqual(["NJD"]);
  });
});

describe("BSH risers and fallers", () => {
  const rising = (id: number, recent: number, before: number) => games(id, 10, index => ({ shots: index >= 5 ? recent : before }));
  it("compares with the previous N, with no shared game", () => {
    const { data } = buildBshBoard(season([...rising(1, 4, 1), ...rising(2, 1, 4), ...rising(3, 2, 2), ...rising(4, 2, 4)]), settings({ view: "movers" }));
    expect(data!.risers.map(row => [row.playerId, row.rank, row.delta, row.recent.games, row.baseline!.games])).toEqual([[1, 1, 3, 5, 5]]);
    expect(data!.fallers.map(row => [row.playerId, row.rank, row.delta])).toEqual([[2, 1, -3], [4, 2, -2]]);
    expect(data!.comparisonLabel).toBe("the previous 5 appearances");
    expect(data!.cohort).toMatchObject({ comparable: 4, ranked: 3, risers: 1, fallers: 2, flat: 1 });
  });
  it("compares with the season excluding the recent window", () => {
    const rows = games(1, 12, index => ({ shots: index >= 7 ? 3 : 1 }));
    const { data } = buildBshBoard(season(rows), settings({ view: "movers", comparison: "std" }));
    expect(data!.risers[0].baseline!.games).toBe(7);
    expect(data!.risers[0].delta).toBe(2);
    expect(data!.comparisonLabel).toBe("season to date excluding the recent window");
  });
  it("excludes short windows under both baselines", () => {
    for (const comparison of ["previous", "std"] as const) {
      const { data } = buildBshBoard(season(games(1, 8, index => ({ shots: index >= 3 ? 3 : 1 }))), settings({ view: "movers", comparison }));
      expect(data!.risers).toEqual([]);
      expect(data!.cohort.shortWindow).toBe(1);
    }
  });
  it("keeps a known zero and leaves a missing baseline unranked", () => {
    const zeros = { shots: 0, hits: 0, blocks: 0 };
    const known = buildBshBoard(season(games(1, 10, index => index >= 5 ? zeros : {})), settings({ view: "movers" }));
    expect(known.data!.fallers[0]).toMatchObject({ delta: -3 });
    expect(known.data!.fallers[0].recent).toMatchObject({ bsh: 0, bshPerGame: 0, shots: 0 });
    const missing = buildBshBoard(season(games(1, 10, index => index === 0 ? { hits: null } : {})), settings({ view: "movers" }));
    expect(missing.data!.fallers).toEqual([]);
    expect(missing.data!.cohort.missingComponent).toBe(1);
  });
  it("ties equal changes despite floating-point noise", () => {
    // 0.3 - 0.1 and 2.2 - 2.0 differ in binary but are the same change.
    expect(0.3 - 0.1).not.toBe(2.2 - 2.0);
    const shots = (id: number, values: number[]) => games(id, 20, index => ({ blocks: 0, hits: 0, shots: values[index] }));
    const { data } = buildBshBoard(season([...shots(1, [1, ...Array(9).fill(0), 1, 1, 1, ...Array(7).fill(0)]), ...shots(2, [...Array(10).fill(2), 3, 3, ...Array(8).fill(2)])]), settings({ view: "movers", window: "l10" }));
    expect(data!.risers.map(row => row.rank)).toEqual([1, 1]);
  });
  it("refuses risers or fallers without a recent window", () => {
    expect(() => parseShareSettings(bshBoardModule, { view: "movers", window: "std" })).toThrow(/recent window/);
    expect(parseShareSettings(bshBoardModule, {})).toEqual({ period: "rolling", week: null, start: null, end: null, minGpRange: null, view: "leaders", window: "l10", comparison: "previous", minGp: 5, position: "all" });
  });
});

describe("skater board coverage", () => {
  const complete = (): SkaterSeason => ({ appearances: [game(1, 0), game(2, 0, { team: "NYR" })], teamGames: [{ gameId: 1000, date: "2026-10-01", team: "NJD" }, { gameId: 1000, date: "2026-10-01", team: "NYR" }], scheduledGames: 1, through: "2026-10-30" });
  it("is ready when every scheduled team game has skater rows", () => {
    const result = skaterSeasonEvidence(complete(), { windowLabel: "L5", cohort: "All" });
    expect(result.state).toBe("ready");
    expect(result.evidence.coverage).toEqual({ observed: 2, expected: 2, missing: 0, unit: "team games" });
    expect(result.evidence.strength).toBe("All situations");
    expect(result.evidence.sources[0].asOf).toBe("2026-10-01");
  });
  it("is partial when a team game has no skater rows or no result", () => {
    const noSkaters = { ...complete(), appearances: [game(1, 0)] };
    expect(skaterSeasonEvidence(noSkaters, { windowLabel: "L5", cohort: "All" })).toMatchObject({ state: "partial", reasons: ["1 of 2 scheduled team games have reported skater results."] });
    expect(skaterSeasonEvidence({ ...complete(), scheduledGames: 2 }, { windowLabel: "L5", cohort: "All" }).state).toBe("partial");
  });
  it("runs through yesterday in New York over the whole season", () => {
    expect(skaterSeasonScope("2026-11-01T02:00:00Z")).toEqual({ season: 20262027, from: "2026-07-01", through: "2026-10-30" });
  });
});

describe("BSH card", () => {
  afterEach(cleanup);
  const snapshot = (data: BshBoardData, active: BshBoardSettings, state: SharePostSnapshot["state"] = "ready") => ({ schemaVersion: 1, id: "bsh-1", post: "bsh-board", state, reasons: [], generatedAt: "2026-10-31T12:00:00Z", expiresAt: new Date(Date.now() + 600000).toISOString(), timeZone: "America/New_York", settings: active, evidence: { sources: [{ name: "x", tables: [], state: "ready", asOf: null, updatedAt: null }], sample: "s", strength: "All situations", cohort: "c", coverage: null }, data, teams: [], fixture: false }) as SharePostSnapshot;
  const show = async (data: BshBoardData, active: BshBoardSettings) => {
    const Card = await bshBoardModule.card();
    render(createElement(Card, { snapshot: snapshot(data, active), data, settings: active, logos: {} }));
    return document.body.textContent!;
  };
  it("prints components, per-game values, window and cohort", async () => {
    const active = settings(), { data } = buildBshBoard(season([...games(1, 5, { blocks: 2, shots: 3, hits: 1 }), ...games(2, 5, index => index === 0 ? { hits: null } : {})]), active);
    const text = await show(data!, active);
    for (const label of ["BLK /G", "SOG /G", "HITS /G", "BSH /G", "Skater 1", "10 2.00", "15 3.00", "5 1.00", "6.00", "30 total", "share of BSH/G", "L5", "1 of 2 ranked"]) expect(text).toContain(label);
    expect(text).not.toContain("Skater 2");
    expect(document.querySelectorAll("p")).toHaveLength(1);
  });
  it("prints risers and fallers side by side with both windows and the short count", async () => {
    const active = settings({ view: "movers" }), { data, evidence } = buildBshBoard(season([...games(1, 10, index => ({ shots: index >= 5 ? 4 : 1 })), ...games(2, 10, index => ({ shots: index >= 5 ? 1 : 3 })), ...games(3, 7)]), active);
    const text = await show(data!, active);
    for (const label of ["L5 vs previous 5", "1 up, 1 down of 2, 1 short", "Up", "Down", "SOG/G4.00 1.00", "6.00 vs 3.00 BSH/G", "5 vs 5 GP", "+3.00", "-2.00"]) expect(text).toContain(label);
    expect(screen.getByTestId("board-up").textContent).toContain("Skater 1");
    expect(screen.getByTestId("board-down").textContent).toContain("Skater 2");
    expect(document.querySelectorAll("p")).toHaveLength(1);
    expect(evidence.sample).toContain("last 5 appearances vs the previous 5 appearances");
    expect(evidence.cohort).toContain("1 short of a full comparison");
  });
  describe("bar and tile", () => {
    const sections = (bar: Element) => [...bar.querySelectorAll<HTMLElement>("[data-layer]")];
    it("draws one bar per leader from the shown per-game values, with colours on the element", async () => {
      const active = settings(), { data } = buildBshBoard(season([...games(1, 5, { blocks: 2, shots: 3, hits: 1 }), ...games(2, 5, { blocks: 0, shots: 1, hits: 0 })]), active);
      await show(data!, active);
      const bars = screen.getAllByTestId("bsh-bar");
      expect(bars).toHaveLength(2);
      expect(sections(bars[0]).map(section => [section.textContent, section.style.width, section.style.backgroundColor])).toEqual([["B", "33.333%", "rgb(77, 166, 222)"], ["S", "50.000%", "rgb(229, 174, 91)"], ["H", "16.667%", "rgb(199, 91, 82)"]]);
      expect(sections(bars[1]).map(section => [section.textContent, section.style.width])).toEqual([["S", "100.000%"]]);
      expect(document.querySelector("svg")).toBeNull();
      const alphas = screen.getAllByTestId("heat-tile").map(tile => Number(tile.getAttribute("data-alpha")));
      expect(alphas[0]).toBe(0.8);
      expect(alphas[1]).toBeLessThan(alphas[0]);
    });
    it("hides a letter too narrow for its section instead of clipping it", async () => {
      const active = settings(), { data } = buildBshBoard(season(games(1, 5, { blocks: 1, shots: 99, hits: 0 })), active);
      await show(data!, active);
      expect(sections(screen.getByTestId("bsh-bar")).map(section => [section.getAttribute("data-layer"), section.textContent])).toEqual([["b", ""], ["s", "S"]]);
    });
    it("draws an all-zero skater as a neutral empty bar", async () => {
      const active = settings(), { data } = buildBshBoard(season(games(1, 5, { blocks: 0, shots: 0, hits: 0 })), active);
      await show(data!, active);
      const bar = screen.getByTestId("bsh-bar");
      expect(bar.getAttribute("data-state")).toBe("empty");
      expect(bar.style.backgroundColor).toBe("rgba(255, 255, 255, 0.08)");
      expect(sections(bar)).toEqual([]);
    });
    it("keeps a missing value visibly missing", async () => {
      const active = settings(), { data } = buildBshBoard(season(games(1, 5)), active), row = data!.rows[0];
      await show({ ...data!, rows: [{ ...row, recent: { ...row.recent, shots: null, shotsPerGame: null } }] }, active);
      const bar = screen.getByTestId("bsh-bar");
      expect(bar.getAttribute("data-state")).toBe("missing");
      expect(bar.textContent).toBe("missing");
      expect(sections(bar)).toEqual([]);
    });
    it("splits risers and fallers on the recent values, keeps the earlier ones in the tiles, and scales the change tile", async () => {
      const active = settings({ view: "movers" }), { data } = buildBshBoard(season([...games(1, 10, index => ({ shots: index >= 5 ? 4 : 1 })), ...games(2, 10, index => ({ shots: index >= 5 ? 1 : 2 }))]), active);
      const text = await show(data!, active);
      const bars = screen.getAllByTestId("bsh-bar");
      expect(sections(bars[0]).map(section => section.style.width)).toEqual(["16.667%", "66.667%", "16.667%"]);
      expect(sections(bars[1]).map(section => section.style.width)).toEqual(["33.333%", "33.333%", "33.333%"]);
      expect(text).toContain("SOG/G4.00 1.00");
      expect(document.querySelector("[data-recent-mark]")).toBeNull();
      const tiles = screen.getAllByTestId("heat-tile");
      expect(tiles.map(tile => tile.getAttribute("data-tone"))).toEqual(["better", "worse"]);
      expect(Number(tiles[1].getAttribute("data-alpha"))).toBeLessThan(Number(tiles[0].getAttribute("data-alpha")));
    });
  });
  it("says why an empty board is empty", async () => {
    const active = settings({ view: "movers" }), { data } = buildBshBoard(season(games(1, 6)), active);
    expect(await show(data!, active)).toContain("No risers or fallers qualify");
  });
  it("refuses to show or export data built for other settings", async () => {
    const { data } = buildBshBoard(season(games(1, 5)), settings()), changed = settings({ window: "l10" });
    expect(await show(data!, changed)).toContain("Refresh this post");
    expect(sharePostExportBlock(bshBoardModule, snapshot(data!, changed), changed)).toMatch(/Nothing qualifies/);
    expect(sharePostExportBlock(bshBoardModule, snapshot(data!, settings()), settings())).toBeNull();
  });
  it("is registered with no calendar and states its basis", () => {
    expect(skaterBoardModules.map(entry => entry.id)).toEqual(["bsh-board", "category-blueprint", "nightly-floor", "multi-cat-stars", "last-nights-standouts"]);
    for (const entry of skaterBoardModules) { expect(entry.basis).toBe("observed"); expect(entry.suggestedUse).toMatch(/any day/); expect(entry.fields.some(field => field.kind === "date" && !field.panelOnly)).toBe(false); }
  });
});

describe("the period control", () => {
  const seasonOf = (appearances: SkaterAppearance[], period?: SkaterSeason["period"]): SkaterSeason => {
    const teamGames = [...new Map(appearances.map(row => [`${row.team}:${row.gameId}`, { gameId: row.gameId, date: row.date, team: row.team! }])).values()];
    return { appearances, teamGames, scheduledGames: teamGames.length / 2, through: appearances[appearances.length - 1]?.date ?? "2026-10-25", period };
  };
  const WEEK = { label: "Week 2 · Oct 19 to Oct 25", from: "2026-10-19", through: "2026-10-25" };
  const week = [18, 20, 22, 24].flatMap(index => [game(1, index, { shots: 5 }), game(2, index, { team: "NYR", shots: 1 })]);
  const CALENDAR = [{ week: 1, start_date: "2026-10-05", end_date: "2026-10-11" }, { week: 2, start_date: "2026-10-12", end_date: "2026-10-18" }, { week: 3, start_date: "2026-10-19", end_date: "2026-11-01" }, { week: 4, start_date: "2026-11-02", end_date: "2026-11-08" }];
  /** Exact-count PostgREST fake that records each table's filters. */
  function fakeClient(tables: Record<string, unknown[]>) {
    const calls: { table: string; filters: unknown[][] }[] = [];
    return { calls, client: { from(table: string) {
      const filters: unknown[][] = [], rows = tables[table] ?? [];
      const chain: any = { then: (resolve: (value: unknown) => void) => resolve({ data: rows, error: null, count: rows.length }) };
      for (const method of ["select", "eq", "gte", "lte", "in", "not", "order", "limit", "range"]) chain[method] = (...args: unknown[]) => { filters.push([method, ...args]); return chain; };
      calls.push({ table, filters });
      return chain;
    } } };
  }
  const GENERATED = "2026-10-29T14:00:00Z";

  it("halves the most games played for default min GP, and never goes above 5", () => {
    expect([0, 1, 2, 3, 4, 7, 9, 10, 60].map(rangeMinGp)).toEqual([1, 1, 1, 2, 2, 4, 5, 5, 5]);
  });
  it("ranks a period over its own games, with its min GP, and prints its dates", () => {
    const short = [game(3, 18, { team: "BOS", shots: 9 })];
    const { data, evidence } = buildBshBoard(seasonOf([...week, ...short], WEEK), settings({ period: "matchup", minGp: 50 }));
    // Most played is 4, so 2 GP: the one-game skater is out, and the season min GP does not apply.
    expect(data!.rows.map(row => row.playerId)).toEqual([1, 2]);
    expect(data!.periodLabel).toBe(WEEK.label);
    expect(data!.rows[0].recent.games).toBe(4);
    expect(evidence.cohort).toContain("2+ GP in these dates");
    expect(evidence.sample).toContain(WEEK.label);
  });
  it("honours an explicit min GP for the period", () => {
    const { data } = buildBshBoard(seasonOf(week, WEEK), settings({ period: "matchup", minGpRange: 5 }));
    expect(data!.rows).toEqual([]);
  });
  it("counts coverage over the period's games", () => {
    const { state, evidence } = buildBshBoard({ ...seasonOf(week, WEEK), scheduledGames: 5 }, settings({ period: "matchup" }));
    expect(state).toBe("partial");
    expect(evidence.coverage).toMatchObject({ expected: 10, missing: 2 });
  });
  it("keeps every old URL on recent games", () => {
    expect(parseShareSettings(bshBoardModule, { view: "leaders", window: "l5", minGp: "3" })).toMatchObject({ period: "rolling", window: "l5", minGp: 3, week: null, start: null, end: null, minGpRange: null });
    expect(parseShareSettings(bshBoardModule, { view: "movers" })).toMatchObject({ period: "rolling", window: "l10" });
  });
  it("defaults to L10 recent games, and leaves risers and fallers on their windows", () => {
    expect(parseShareSettings(bshBoardModule, {})).toMatchObject({ period: "rolling", window: "l10" });
    expect(() => parseShareSettings(bshBoardModule, { view: "movers", period: "matchup" })).toThrow("Risers and fallers keep their recent windows");
    expect(() => parseShareSettings(bshBoardModule, { period: "custom", start: "2026-10-20" })).toThrow("needs a start date and an end date");
    expect(() => parseShareSettings(bshBoardModule, { period: "custom", start: "2026-10-20", end: "2026-10-20" })).toThrow("must be before");
  });
  it("reads nothing extra on recent games", async () => {
    const fake = fakeClient({});
    const result = await loadBshBoard({ client: fake.client, generatedAt: GENERATED }, settings());
    expect(fake.calls.some(call => call.table === "yahoo_matchup_weeks")).toBe(false);
    expect(fake.calls.find(call => call.table === "wgo_skater_stats")!.filters).toContainEqual(["gte", "date", "2026-07-01"]);
    expect(result.data!.periodLabel).toBeNull();
  });
  it("reads a matchup week's dates only, and counts a week under way through the last completed games", async () => {
    const fake = fakeClient({ yahoo_matchup_weeks: CALENDAR });
    const result = await loadBshBoard({ client: fake.client, generatedAt: GENERATED }, settings({ period: "matchup", week: 3 }));
    for (const table of ["wgo_skater_stats", "wgo_team_stats", "games"]) {
      const { filters } = fake.calls.find(call => call.table === table)!;
      expect(filters).toContainEqual(["gte", "date", "2026-10-19"]);
      expect(filters).toContainEqual(["lte", "date", "2026-10-28"]);
    }
    expect(result.data!.periodLabel).toBe("Week 3 · Oct 19 to Oct 28 so far");
  });
  it("takes the last completed week for a blank, and reads a custom range's dates", async () => {
    const blank = await loadBshBoard({ client: fakeClient({ yahoo_matchup_weeks: CALENDAR }).client, generatedAt: GENERATED }, settings({ period: "matchup" }));
    expect(blank.data!.periodLabel).toBe("Week 2 · Oct 12 to Oct 18");
    const fake = fakeClient({ yahoo_matchup_weeks: CALENDAR });
    const custom = await loadBshBoard({ client: fake.client, generatedAt: GENERATED }, settings({ period: "custom", start: "2026-10-14", end: "2026-10-16" }));
    expect(custom.data!.periodLabel).toBe("Oct 14 to Oct 16");
    expect(fake.calls.find(call => call.table === "wgo_skater_stats")!.filters).toContainEqual(["lte", "date", "2026-10-16"]);
  });
  it("is missing with the reason for a week not started, or dates past the last games, and reads no games", async () => {
    for (const [over, reason] of [[{ period: "matchup", week: 4 }, "Week 4 has not started"], [{ period: "matchup", week: 9 }, "Week 9 is not on the matchup calendar"], [{ period: "custom", start: "2026-10-14", end: "2026-10-30" }, "past the last completed games"], [{ period: "custom", start: "2026-09-01", end: "2026-09-05" }, "must fall inside the season"]] as const) {
      const fake = fakeClient({ yahoo_matchup_weeks: CALENDAR });
      const result = await loadBshBoard({ client: fake.client, generatedAt: GENERATED }, settings(over));
      expect(result.state).toBe("missing");
      expect(result.data).toBeNull();
      expect(result.reasons?.join(" ")).toContain(reason);
      expect(fake.calls.some(call => call.table === "wgo_skater_stats")).toBe(false);
    }
  });
  it("fails visibly when the calendar cannot be read", async () => {
    const client = { from: () => { const chain: any = { then: (resolve: (value: unknown) => void) => resolve({ data: null, error: { message: "nope" }, count: null }) }; for (const method of ["select", "eq", "order", "range"]) chain[method] = () => chain; return chain; } };
    await expect(loadBshBoard({ client, generatedAt: GENERATED }, settings({ period: "matchup" }))).rejects.toThrow();
  });
});
