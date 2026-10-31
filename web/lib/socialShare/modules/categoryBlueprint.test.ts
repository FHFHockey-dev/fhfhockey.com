// @vitest-environment jsdom
import { createElement } from "react";
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import type { SkaterSeason } from "./bshBoard";
import { buildCategoryBlueprint, categoryBlueprintModule, chosenCategories, type CategoryBlueprintData, type CategoryBlueprintSettings } from "./categoryBlueprint";
import { parseShareSettings, type SharePostSnapshot } from "./contract";
import type { SkaterAppearance } from "./shared/skaterAppearances";

const settings = (over: Partial<CategoryBlueprintSettings> = {}): CategoryBlueprintSettings => ({ cat1: "points", cat2: "shots", cat3: "hits", cat4: "none", window: "l5", minGp: 1, position: "all", topIn: 1000, ...over });
const game = (playerId: number, index: number, stats: Partial<SkaterAppearance> = {}): SkaterAppearance => ({
  playerId, name: `Skater ${playerId}`, position: "D", group: "D", gameId: 1000 + index, date: `2026-10-${String(index + 1).padStart(2, "0")}`, team: "NJD", opponent: "NYR", home: true,
  goals: 0, assists: 0, points: 0, shots: 0, hits: 0, blocks: 0, ppPoints: 0, toiSeconds: 900, ppToiSeconds: 0, penaltyMinutes: 0, ...stats,
});
const games = (playerId: number, count: number, stats: Partial<SkaterAppearance> | ((index: number) => Partial<SkaterAppearance>) = {}) => Array.from({ length: count }, (_, index) => game(playerId, index, typeof stats === "function" ? stats(index) : stats));
const season = (appearances: SkaterAppearance[]): SkaterSeason => ({ appearances, teamGames: [], scheduledGames: 0, through: "2026-10-30" });
const cells = (data: CategoryBlueprintData, playerId: number) => data.rows.find(row => row.playerId === playerId)!.cells.map(cell => [cell.category, cell.perGame, cell.rank]);

describe("Category Blueprint", () => {
  const pool = () => season([...games(1, 5, { points: 2, shots: 1, hits: 0, blocks: 3 }), ...games(2, 5, { points: 1, shots: 3, hits: 4, blocks: 0 }), ...games(3, 5, { points: 1, shots: 2, hits: 4, blocks: 1 })]);
  it("gives each chosen category its own per-game value and rank", () => {
    const { data } = buildCategoryBlueprint(pool(), settings());
    expect(data!.rows.map(row => row.playerId)).toEqual([1, 2, 3]);
    expect(cells(data!, 1)).toEqual([["points", 2, 1], ["shots", 1, 3], ["hits", 0, 3]]);
    expect(cells(data!, 2)).toEqual([["points", 1, 2], ["shots", 3, 1], ["hits", 4, 1]]);
    expect(cells(data!, 3)).toEqual([["points", 1, 2], ["shots", 2, 2], ["hits", 4, 1]]);
  });
  it("honours the chosen combination and order", () => {
    const active = settings({ cat1: "blocks", cat2: "points", cat3: "none" }), { data } = buildCategoryBlueprint(pool(), active);
    expect(chosenCategories(active)).toEqual(["blocks", "points"]);
    expect(data!.categories.map(category => category.label)).toEqual(["BLK", "PTS"]);
    expect(data!.rows.map(row => row.playerId)).toEqual([1, 3, 2]);
    expect(data!.rows[0].cells).toHaveLength(2);
  });
  it("keeps one basis and cohort for every category", () => {
    const { data, evidence } = buildCategoryBlueprint(season([...games(1, 7, index => ({ points: index >= 2 ? 1 : 9, shots: index >= 2 ? 2 : 9 })), ...games(2, 3, { points: 1 }), ...games(3, 5, { position: "C", group: "F", points: 5 })]), settings({ position: "D", minGp: 3 }));
    expect(data!.cohortSize).toBe(2);
    expect(evidence.cohort).toContain("Defensemen, 3+ season GP: 2 skaters");
    expect(data!.rows.find(row => row.playerId === 1)!.games).toBe(5);
    expect(cells(data!, 1).slice(0, 2)).toEqual([["points", 1, 1], ["shots", 2, 1]]);
    expect(data!.rows.find(row => row.playerId === 2)!.games).toBe(3);
  });
  it("shows a missing category as missing, not zero, and counts it", () => {
    const { data } = buildCategoryBlueprint(season([...games(1, 5, index => index === 2 ? { hits: null, points: 1 } : { hits: 3, points: 1 }), ...games(2, 5, { hits: 0 })]), settings());
    expect(data!.rows[0].cells.find(cell => cell.category === "hits")).toEqual({ category: "hits", total: null, perGame: null, rank: null });
    expect(data!.rows[1].cells.find(cell => cell.category === "hits")).toMatchObject({ total: 0, perGame: 0, rank: 1 });
    expect(data!.categories.find(category => category.id === "hits")!.missing).toBe(1);
  });
  it("filters on every category's own rank, and a missing category neither passes nor fails", () => {
    const { data } = buildCategoryBlueprint(pool(), settings({ topIn: 2 }));
    expect(data!.rows.map(row => row.playerId)).toEqual([2, 3]);
    expect(data!.qualifying).toBe(2);
    const withMissing = buildCategoryBlueprint(season([...games(1, 5, { points: 2, hits: null }), ...games(2, 5, { points: 1, hits: 1 })]), settings({ topIn: 1, cat2: "goals" }));
    expect(withMissing.data!.rows.map(row => row.playerId)).toEqual([1]);
  });
  it("has no universal score, rating or overall rank", () => {
    const { data } = buildCategoryBlueprint(pool(), settings());
    expect(JSON.stringify(data)).not.toMatch(/score|rating|overall|composite|total_?rank/i);
    expect(Object.keys(data!.rows[0]).sort()).toEqual(["cells", "games", "name", "playerId", "position", "team", "teams"]);
  });
  it("refuses a repeated category and an empty pool cannot export", () => {
    expect(() => parseShareSettings(categoryBlueprintModule, { cat2: "points" })).toThrow(/only once/);
    expect(parseShareSettings(categoryBlueprintModule, {})).toMatchObject({ cat1: "points", cat2: "shots", cat3: "hits", cat4: "blocks", window: "l10", minGp: 5, position: "all", topIn: 250 });
    const active = settings({ minGp: 9 }), { data } = buildCategoryBlueprint(pool(), active);
    expect(data!.rows).toEqual([]);
    expect(categoryBlueprintModule.hasRows(data, active)).toBe(false);
  });
});

describe("Category Blueprint default on a specialist-heavy pool", () => {
  // Shaped like 2026-10-31: 120 specialists lead each category, 20 all-rounders sit just behind them in all four, and the rest spread out.
  const categories = ["points", "shots", "hits", "blocks"] as const;
  const steps = { points: 7, shots: 11, hits: 13, blocks: 17 };
  const specialists = categories.flatMap((specialty, group) => Array.from({ length: 120 }, (_, index) => {
    const id = 1000 + group * 1000 + index, stats = Object.fromEntries(categories.map(category => [category, category === specialty ? 3 : 1 - ((id * steps[category]) % 360) / 400]));
    return games(id, 5, stats);
  })).flat();
  const allRounders = Array.from({ length: 20 }, (_, index) => games(index + 1, 5, { points: 2, shots: 2, hits: 2, blocks: 2 })).flat();
  const pool = season([...specialists, ...allRounders]);
  const defaults = parseShareSettings(categoryBlueprintModule, {}) as CategoryBlueprintSettings;

  it("publishes rows on the visible default, led by the skaters who contribute everywhere", () => {
    const { data } = buildCategoryBlueprint(pool, defaults);
    expect(data!.cohortSize).toBe(500);
    expect(data!.qualifying).toBeGreaterThanOrEqual(20);
    expect(data!.qualifying).toBeLessThan(250);
    expect(data!.rows.every(row => row.cells.every(cell => cell.rank !== null && cell.rank <= defaults.topIn))).toBe(true);
    expect(categoryBlueprintModule.hasRows(data, defaults)).toBe(true);
    expect(JSON.stringify(data)).not.toMatch(/score|rating|overall|composite/i);
  });
  it("finds the all-rounders by each category's own rank, with no combined value", () => {
    const { data } = buildCategoryBlueprint(pool, { ...defaults, topIn: 121 });
    expect(data!.qualifying).toBe(20);
    expect(data!.rows.every(row => row.playerId <= 20 && row.cells.every(cell => cell.rank === 121 && cell.perGame === 2))).toBe(true);
  });
  it("keeps the honest empty state where nobody qualifies", () => {
    const strict = { ...defaults, topIn: 100 }, { data } = buildCategoryBlueprint(pool, strict);
    expect(data!.qualifying).toBe(0);
    expect(data!.rows).toEqual([]);
    expect(categoryBlueprintModule.hasRows(data, strict)).toBe(false);
  });
});

describe("Category Blueprint card", () => {
  afterEach(cleanup);
  const show = async (data: CategoryBlueprintData, active: CategoryBlueprintSettings) => {
    const Card = await categoryBlueprintModule.card();
    render(createElement(Card, { snapshot: { settings: active } as unknown as SharePostSnapshot, data, settings: active, logos: {} }));
    return document.body.textContent!;
  };
  it("prints each category, rank, window, cohort and missing", async () => {
    const active = settings(), { data } = buildCategoryBlueprint(season([...games(1, 5, { points: 2, hits: null }), ...games(2, 5, { points: 1, hits: 2 })]), active);
    const text = await show(data!, active);
    for (const label of ["PTS/G", "SOG/G", "HITS/G", "2.00 #1", "missing", "L5", "among 2", "no combined score"]) expect(text).toContain(label);
    expect(document.querySelectorAll("p")).toHaveLength(1);
    expect(buildCategoryBlueprint(season([...games(1, 5, { hits: null }), ...games(2, 5)]), active).evidence.cohort).toContain("Hits missing for 1");
  });
  it("says why nobody qualifies and asks for a refresh after a settings change", async () => {
    const active = settings({ minGp: 9 }), { data } = buildCategoryBlueprint(season(games(1, 2)), active);
    expect(await show(data!, active)).toContain("No skater is in the top");
    cleanup();
    expect(await show(data!, settings({ minGp: 8 }))).toContain("Refresh this post");
  });
});
