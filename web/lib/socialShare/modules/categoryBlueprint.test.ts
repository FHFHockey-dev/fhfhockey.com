// @vitest-environment jsdom
import { createElement } from "react";
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import type { SkaterSeason } from "./bshBoard";
import { buildCategoryBlueprint, categoryBlueprintModule, categoryPercentileBand, categoryPercentiles, multiCatScore, type CategoryBlueprintData, type CategoryBlueprintSettings } from "./categoryBlueprint";
import { BAND_FILL, bandText, SQUARE_SHADE } from "components/SocialShare/modules/CategoryBlueprintCard";
import { parseShareSettings, type SharePostSnapshot } from "./contract";
import type { SkaterAppearance } from "./shared/skaterAppearances";

const settings = (over: Partial<CategoryBlueprintSettings> = {}): CategoryBlueprintSettings => ({ view: "standard", window: "l5", minGp: 1, position: "all", ...over });
const game = (playerId: number, index: number, stats: Partial<SkaterAppearance> = {}): SkaterAppearance => ({
  playerId, name: `Skater ${playerId}`, position: "D", group: "D", gameId: 1000 + index, date: `2026-10-${String(index + 1).padStart(2, "0")}`, team: "NJD", opponent: "NYR", home: true,
  goals: 0, assists: 0, points: 0, shots: 0, hits: 0, blocks: 0, ppPoints: 0, toiSeconds: 900, ppToiSeconds: 0, penaltyMinutes: 0, ...stats,
});
const games = (playerId: number, count: number, stats: Partial<SkaterAppearance> | ((index: number) => Partial<SkaterAppearance>) = {}) => Array.from({ length: count }, (_, index) => game(playerId, index, typeof stats === "function" ? stats(index) : stats));
const season = (appearances: SkaterAppearance[]): SkaterSeason => ({ appearances, teamGames: [], scheduledGames: 0, through: "2026-10-30" });
const scores = (data: CategoryBlueprintData) => data.rows.map(row => [row.playerId, row.rank, row.score]);

describe("Multi Cat percentiles", () => {
  it("is the share of the others beaten, from 0 to 100", () => {
    expect(categoryPercentiles([1, 2, 3, 4, 5])).toEqual([0, 25, 50, 75, 100]);
  });
  it("counts a tie as half, so tied skaters share one percentile", () => {
    expect(categoryPercentiles([1, 1, 2, 3, 3])).toEqual([12.5, 12.5, 50, 87.5, 87.5]);
    expect(categoryPercentiles([0, 0, 0])).toEqual([50, 50, 50]);
  });
  it("averages 50 however many skaters tie", () => {
    const percentiles = categoryPercentiles([0, 0, 0, 0, 1, 1, 2, 5]) as number[];
    expect(percentiles.reduce((total, value) => total + value, 0) / percentiles.length).toBeCloseTo(50);
  });
  it("leaves a missing value out of the pool and gives it no percentile", () => {
    expect(categoryPercentiles([1, null, 3])).toEqual([0, null, 100]);
    expect(categoryPercentiles([7])).toEqual([50]);
  });
});

describe("Multi Cat score", () => {
  const percentiles = { points: 90, shots: 50, hits: 30, blocks: 10 };
  it("averages the four percentiles", () => {
    expect(multiCatScore(percentiles, "standard")).toBe(45);
  });
  it("counts points twice on Points-First", () => {
    expect(multiCatScore(percentiles, "points-first")).toBe(54);
  });
  it("has no score with a missing category, on either view", () => {
    for (const view of ["standard", "points-first"] as const) expect(multiCatScore({ ...percentiles, hits: null }, view)).toBeNull();
    expect(multiCatScore({ ...percentiles, hits: 0 }, "standard")).toBe(37.5);
  });
});

describe("Multi Cat Monsters", () => {
  // 1 scores only, 2 does everything but score, and 3 is middling everywhere.
  const pool = () => season([...games(1, 5, { points: 3, shots: 1, hits: 1, blocks: 1 }), ...games(2, 5, { points: 1, shots: 3, hits: 3, blocks: 3 }), ...games(3, 5, { points: 2, shots: 2, hits: 2, blocks: 2 })]);
  it("ranks by the average percentile and prints per-game values with them", () => {
    const { data } = buildCategoryBlueprint(pool(), settings());
    expect(scores(data!)).toEqual([[2, 1, 75], [3, 2, 50], [1, 3, 25]]);
    expect(data!.rows[0].cells.map(cell => [cell.category, cell.perGame, cell.percentile])).toEqual([["points", 1, 0], ["shots", 3, 100], ["hits", 3, 100], ["blocks", 3, 100]]);
  });
  it("re-ranks on Points-First with points counted twice", () => {
    const { data } = buildCategoryBlueprint(pool(), settings({ view: "points-first" }));
    expect(scores(data!)).toEqual([[2, 1, 60], [3, 2, 50], [1, 3, 40]]);
    const scorers = buildCategoryBlueprint(season([...games(1, 5, { points: 3, shots: 2, hits: 2, blocks: 2 }), ...games(2, 5, { points: 1, shots: 3, hits: 3, blocks: 1 }), ...games(3, 5, { points: 2, shots: 1, hits: 1, blocks: 3 })]), settings({ view: "points-first" }));
    expect(scorers.data!.rows.map(row => row.playerId)).toEqual([1, 2, 3]);
    expect(buildCategoryBlueprint(season([...games(1, 5, { points: 3, shots: 2, hits: 2, blocks: 2 }), ...games(2, 5, { points: 1, shots: 3, hits: 3, blocks: 1 }), ...games(3, 5, { points: 2, shots: 1, hits: 1, blocks: 3 })]), settings()).data!.rows.map(row => row.score)).toEqual([62.5, 50, 37.5]);
  });
  it("shares a rank on an equal score", () => {
    const { data } = buildCategoryBlueprint(season([...games(1, 5, { points: 2, shots: 1 }), ...games(2, 5, { points: 1, shots: 2 })]), settings());
    expect(data!.rows.map(row => row.rank)).toEqual([1, 1]);
  });
  it("leaves a missing category unranked, not zero, and counts it", () => {
    const { data, evidence } = buildCategoryBlueprint(season([...games(1, 5, index => index === 2 ? { hits: null, points: 9 } : { hits: 3, points: 9 }), ...games(2, 5, { hits: 0 }), ...games(3, 5, { hits: 1 })]), settings());
    expect(data!.rows.map(row => row.playerId)).toEqual([3, 2]);
    expect(data).toMatchObject({ cohortSize: 3, ranked: 2, unranked: 1 });
    expect(data!.categories.find(category => category.id === "hits")!.missing).toBe(1);
    // The missing skater still counts in the categories it has, and is out of the hits pool.
    expect(data!.rows.find(row => row.playerId === 2)!.cells.map(cell => cell.percentile)).toEqual([25, 50, 0, 50]);
    expect(evidence.cohort).toContain("1 unranked for a missing category");
    expect(evidence.cohort).toContain("Hits missing for 1");
  });
  it("takes percentiles among the eligible skaters only, and needs no category gate", () => {
    const { data, evidence } = buildCategoryBlueprint(season([...games(1, 7, index => ({ points: index >= 2 ? 1 : 9 })), ...games(2, 3, { points: 0 }), ...games(3, 5, { position: "C", group: "F", points: 5 })]), settings({ position: "D", minGp: 3 }));
    expect(data!.cohortSize).toBe(2);
    expect(evidence.cohort).toContain("Defensemen, 3+ season GP: 2 eligible, 2 ranked");
    expect(data!.rows.map(row => [row.playerId, row.games, row.cells[0].perGame, row.cells[0].percentile])).toEqual([[1, 5, 1, 100], [2, 3, 0, 0]]);
  });
  it("counts what falls below the card", () => {
    const { data, evidence } = buildCategoryBlueprint(season(Array.from({ length: 23 }, (_, index) => games(index + 1, 5, { points: index })).flat()), settings());
    expect(data!.rows).toHaveLength(20);
    expect(data).toMatchObject({ ranked: 23, notShown: 3 });
    expect(evidence.cohort).toContain("3 more below the card");
  });
  it("has one view setting, no category or top-N settings, and an empty pool cannot export", () => {
    expect(parseShareSettings(categoryBlueprintModule, {})).toEqual({ view: "standard", window: "l10", minGp: 5, position: "all" });
    expect(parseShareSettings(categoryBlueprintModule, { view: "points-first" })).toMatchObject({ view: "points-first" });
    expect(() => parseShareSettings(categoryBlueprintModule, { view: "other" })).toThrow();
    const active = settings({ minGp: 9 }), { data } = buildCategoryBlueprint(pool(), active);
    expect(data!.rows).toEqual([]);
    expect(categoryBlueprintModule.hasRows(data, active)).toBe(false);
  });
  it("titles each view for the header and the post for the studio", () => {
    expect(categoryBlueprintModule.title).toBe("Multi Cat Monsters");
    expect(categoryBlueprintModule.headline?.(settings())).toBe("MULTI CAT MONSTERS");
    expect(categoryBlueprintModule.headline?.(settings({ view: "points-first" }))).toBe("POINTS-FIRST MULTI CAT MONSTERS");
  });
  it("says what the score is in its evidence and alt text", () => {
    const active = settings({ view: "points-first" }), result = buildCategoryBlueprint(pool(), active);
    expect(result.evidence.sample).toContain("points counted twice");
    const alt = categoryBlueprintModule.altText({ evidence: result.evidence } as unknown as SharePostSnapshot, result.data, active);
    for (const text of ["Points-First Multi Cat Monsters", "(2×PTS + SOG + HITS + BLK) / 5", "score 60.0", "percentile 100"]) expect(alt).toContain(text);
  });
});

describe("Multi Cat percentile bands", () => {
  it("changes band exactly at each boundary", () => {
    const bands = [[100, "p95"], [95, "p95"], [94.99, "p85"], [85, "p85"], [84.99, "p70"], [70, "p70"], [69.99, "p50"], [50, "p50"], [49.99, "lower"], [0, "lower"]] as const;
    for (const [percentile, band] of bands) expect(categoryPercentileBand(percentile)).toBe(band);
  });
  it("gives a missing category no band", () => {
    expect(categoryPercentileBand(null)).toBeNull();
  });
});

const POST_SURFACE = "#1a1d21"; // $background-dark, the post's background.
describe("Multi Cat card", () => {
  afterEach(cleanup);
  const show = async (data: CategoryBlueprintData, active: CategoryBlueprintSettings) => {
    const Card = await categoryBlueprintModule.card();
    render(createElement(Card, { snapshot: { settings: active } as unknown as SharePostSnapshot, data, settings: active, logos: {} }));
    return document.body.textContent!;
  };
  const trio = () => season([...games(1, 5, { points: 3, shots: 1, hits: 1, blocks: 1 }), ...games(2, 5, { points: 1, shots: 3, hits: 3, blocks: 3 }), ...games(3, 5, { points: 2, shots: 2, hits: 2, blocks: 2 })]);
  it("prints each category's value and percentile, the score, the window and the formula", async () => {
    const active = settings(), { data } = buildCategoryBlueprint(trio(), active);
    const text = await show(data!, active);
    for (const label of ["RK", "PTS/G", "SOG/G", "HITS/G", "BLK/G", "SCORE", "3.00 P100", "75.0", "L5", "percentile of 3", "ties half", "average of the four"]) expect(text).toContain(label);
    expect(text).not.toContain("no combined score");
    expect(document.querySelectorAll("p")).toHaveLength(1);
  });
  it("states the 2x weight on Points-First", async () => {
    const active = settings({ view: "points-first" }), { data } = buildCategoryBlueprint(trio(), active);
    expect(await show(data!, active)).toContain("(2×PTS + SOG + HITS + BLK) / 5");
  });
  it("colours each cell by its own percentile, with the colour on the element", async () => {
    const active = settings(), { data } = buildCategoryBlueprint(trio(), active);
    await show(data!, active);
    const first = [...document.querySelectorAll<HTMLElement>("[data-testid=rank-cell]")].slice(0, 4);
    expect(first.map(cell => [cell.textContent, cell.getAttribute("data-band")])).toEqual([["1.00 P0", "lower"], ["3.00 P100", "p95"], ["3.00 P100", "p95"], ["3.00 P100", "p95"]]);
    expect(first[0].style.backgroundColor).toBe("rgba(255, 99, 132, 0.42)");
    expect(first[1].style.backgroundColor).toBe("rgba(0, 255, 153, 0.8)");
  });
  it("puts the percentile in its own square, in a shade of the chip's colour, on every band", async () => {
    const active = settings(), { data } = buildCategoryBlueprint(season(Array.from({ length: 21 }, (_, index) => games(index + 1, 5, { points: index, shots: index, hits: index, blocks: index })).flat()), active);
    await show(data!, active);
    const chips = [...document.querySelectorAll<HTMLElement>("[data-testid=rank-cell]")];
    expect(new Set(chips.map(chip => chip.getAttribute("data-band")))).toEqual(new Set(["p95", "p85", "p70", "p50", "lower"]));
    for (const chip of chips) {
      const square = chip.querySelector<HTMLElement>("[data-testid=rank-percentile]")!;
      expect(chip.firstElementChild!.textContent).toMatch(/^\d+\.\d\d$/); // The value comes first, on the left.
      expect(chip.lastElementChild).toBe(square);
      expect(square.textContent).toMatch(/^P\d+$/);
      expect(square.style.backgroundColor).toBe(SQUARE_SHADE);
      expect(square.style.color).toBe(chip.style.color);
    }
  });
  it("keeps text readable on the chip and its square, on every band", () => {
    const parse = (color: string) => { const hex = color.match(/^#(..)(..)(..)$/); if (hex) return [...hex.slice(1).map(part => parseInt(part, 16)), 1]; return color.match(/[\d.]+/g)!.map(Number); };
    const over = (top: string, under: number[]) => { const [r, g, b, a] = parse(top); return [r, g, b].map((channel, index) => channel * a + under[index] * (1 - a)); };
    const luminance = (rgb: number[]) => { const [r, g, b] = rgb.map(value => { const unit = value / 255; return unit <= 0.03928 ? unit / 12.92 : ((unit + 0.055) / 1.055) ** 2.4; }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
    const contrast = (a: number[], b: number[]) => { const [high, low] = [luminance(a), luminance(b)].sort((x, y) => y - x); return (high + 0.05) / (low + 0.05); };
    const surface = parse(POST_SURFACE).slice(0, 3);
    for (const band of ["p95", "p85", "p70", "p50", "lower"] as const) {
      const chip = over(BAND_FILL[band], surface), square = over(SQUARE_SHADE, chip), text = parse(bandText(band)).slice(0, 3);
      expect(contrast(text, chip)).toBeGreaterThanOrEqual(4.5);
      expect(contrast(text, square)).toBeGreaterThanOrEqual(4.5);
    }
  });
  it("draws a missing cell with no fill", async () => {
    const active = settings(), { data } = buildCategoryBlueprint(trio(), active), row = data!.rows[0];
    await show({ ...data!, rows: [{ ...row, cells: [{ ...row.cells[0], total: null, perGame: null, percentile: null }, ...row.cells.slice(1)] }] }, active);
    const missing = document.querySelector("[data-band=missing]")!;
    expect(missing.textContent).toBe("missing");
    expect(missing.getAttribute("style")).toBeNull();
  });
  it("says why nobody ranks and asks for a refresh after a settings change", async () => {
    const active = settings({ minGp: 9 }), { data } = buildCategoryBlueprint(season(games(1, 2)), active);
    expect(await show(data!, active)).toContain("No skater has all four categories");
    cleanup();
    expect(await show(data!, settings({ minGp: 8 }))).toContain("Refresh this post");
  });
});
