// @vitest-environment jsdom
import { createElement } from "react";
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import type { SkaterSeason } from "./bshBoard";
import { buildCategoryBlueprint, categoryBlueprintModule, categoryPercentileBand, categoryPercentiles, multiCatScore, type CategoryBlueprintData, type CategoryBlueprintSettings } from "./categoryBlueprint";
import { BAND_FILL, bandText, SQUARE_SHADE } from "components/SocialShare/modules/CategoryBlueprintCard";
import { parseShareSettings, type SharePostSnapshot } from "./contract";
import type { SkaterAppearance } from "./shared/skaterAppearances";

const settings = (over: Partial<CategoryBlueprintSettings> = {}): CategoryBlueprintSettings => ({ period: "rolling", week: null, start: null, end: null, minGpRange: null, view: "standard", window: "l5", minGp: 1, position: "all", ...over });
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
  it("re-ranks on Points-First with points counted twice, from 1 among those who clear the floor", () => {
    // Points percentile is index × 5, so 17 and up clear P85. The others run the other way, so the lowest of those four leads.
    const ladder = season(Array.from({ length: 21 }, (_, index) => games(index + 1, 5, { points: index, shots: 20 - index, hits: 20 - index, blocks: 20 - index })).flat());
    const { data } = buildCategoryBlueprint(ladder, settings({ view: "points-first" }));
    expect(data!.rows.map(row => [row.playerId, row.rank, row.score])).toEqual([[18, 1, 43], [19, 2, 42], [20, 3, 41], [21, 4, 40]]);
  });
  describe("Points-First floor", () => {
    const ladder = (over: (index: number) => Partial<SkaterAppearance> = () => ({})) => season(Array.from({ length: 21 }, (_, index) => games(index + 1, 5, { points: index, ...over(index) })).flat());
    it("ranks a skater at exactly P85 and leaves out the one just below", () => {
      const { data, evidence } = buildCategoryBlueprint(ladder(), settings({ view: "points-first" }));
      const points = (id: number) => categoryPercentiles(Array.from({ length: 21 }, (_, index) => index))[id - 1];
      expect([points(18), points(17)]).toEqual([85, 80]);
      expect(data!.rows.map(row => row.playerId).sort((a, b) => a - b)).toEqual([18, 19, 20, 21]);
      expect(data).toMatchObject({ cohortSize: 21, ranked: 4, belowFloor: 17, unranked: 0, notShown: 0 });
      expect(evidence.cohort).toContain("21 eligible, 4 ranked, 17 below points P85");
      expect(evidence.sample).toContain("Only skaters at P85 or better in points are ranked: 4 of 21 eligible; percentiles stay over all 21.");
    });
    it("takes percentiles over the whole cohort, not those who clear the floor", () => {
      const floored = buildCategoryBlueprint(ladder(index => ({ shots: 20 - index })), settings({ view: "points-first" })).data!.rows;
      const points = categoryPercentiles(Array.from({ length: 21 }, (_, index) => index));
      for (const row of floored) expect(row.cells[0].percentile).toBe(points[row.playerId - 1]);
      // Over only the four who clear the floor, this skater would be last in points and first in shots.
      expect(floored.find(row => row.playerId === 18)!.cells.map(cell => cell.percentile)).toEqual([85, 15, 50, 50]);
    });
    it("leaves the straight view unaffected", () => {
      const { data } = buildCategoryBlueprint(ladder(), settings());
      expect(data).toMatchObject({ ranked: 21, belowFloor: 0, unranked: 0, notShown: 1 });
      expect(data!.rows.map(row => row.playerId)).toContain(2); // P5 in points, well below the floor.
    });
    it("keeps missing points unranked and apart from the floor's count", () => {
      const { data, evidence } = buildCategoryBlueprint(ladder(index => index === 20 ? { points: null } : {}), settings({ view: "points-first" }));
      expect(data!.rows.map(row => row.playerId)).not.toContain(21);
      expect(data).toMatchObject({ cohortSize: 21, unranked: 1 });
      expect(data!.ranked + data!.belowFloor + data!.unranked).toBe(21);
      expect(evidence.cohort).toContain("1 unranked for a missing category");
    });
    it("has nothing to export when nobody clears the floor", () => {
      const active = settings({ view: "points-first" }), { data } = buildCategoryBlueprint(season([...games(1, 5), ...games(2, 5)]), active);
      expect(data!.rows).toEqual([]);
      expect(categoryBlueprintModule.hasRows(data, active)).toBe(false);
    });
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
    expect(parseShareSettings(categoryBlueprintModule, {})).toEqual({ period: "rolling", week: null, start: null, end: null, minGpRange: null, view: "standard", window: "l10", minGp: 5, position: "all" });
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
    for (const text of ["Points-First Multi Cat Monsters", "(2×PTS + SOG + HITS + BLK) / 5", "percentile 85 or better", "score 40.0", "percentile 100"]) expect(alt).toContain(text);
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
  it("states the 2x weight and the floor on Points-First only", async () => {
    const active = settings({ view: "points-first" }), { data } = buildCategoryBlueprint(trio(), active), text = await show(data!, active);
    expect(text).toContain("(2×PTS + SOG + HITS + BLK) / 5");
    expect(text).toContain("Points P85+ only.");
    cleanup();
    expect(await show(buildCategoryBlueprint(trio(), settings()).data!, settings())).not.toContain("P85");
    cleanup();
    const tied = settings({ view: "points-first" });
    expect(await show(buildCategoryBlueprint(season([...games(1, 5), ...games(2, 5)]), tied).data!, tied)).toContain("points P85+");
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

describe("a period's cohort", () => {
  const skater = (playerId: number, games: number, points: number): SkaterAppearance[] => Array.from({ length: games }, (_, index) => ({ playerId, name: `Skater ${playerId}`, position: "C", group: "F", gameId: 1000 + index, date: `2026-10-${String(index + 19).padStart(2, "0")}`, team: "NJD", opponent: "NYR", home: true, goals: 0, assists: points, points, shots: 1, hits: 1, blocks: 1, ppPoints: 0, toiSeconds: 900, ppToiSeconds: 0, penaltyMinutes: 0 }));
  const period = { label: "Oct 19 to Oct 22", from: "2026-10-19", through: "2026-10-22" };
  const seasonOf = (appearances: SkaterAppearance[]): SkaterSeason => ({ appearances, teamGames: [], scheduledGames: 0, through: period.through, period });
  // Most played is 4, so 2 GP: skater 21 is out of the cohort and of its percentiles.
  const players = [...Array.from({ length: 20 }, (_, index) => skater(index + 1, 4, index)).flat(), ...skater(21, 1, 50)];
  it("takes percentiles over the skaters eligible in those dates", () => {
    const { data } = buildCategoryBlueprint(seasonOf(players), settings({ period: "custom", start: period.from, end: period.through }));
    expect(data!.cohortSize).toBe(20);
    expect(data!.periodLabel).toBe(period.label);
    expect(data!.rows.some(row => row.playerId === 21)).toBe(false);
    expect(data!.rows[0].playerId).toBe(20);
    expect(data!.rows[0].cells[0].percentile).toBe(100);
  });
  it("sets the points P85 floor from the same dates", () => {
    const { data, evidence } = buildCategoryBlueprint(seasonOf(players), settings({ view: "points-first", period: "custom", start: period.from, end: period.through }));
    // Of 20 skaters with distinct points, the top 3 beat at least 85% of the other 19.
    expect(data!.rows.map(row => row.playerId)).toEqual([20, 19, 18]);
    expect(data!.belowFloor).toBe(17);
    expect(evidence.sample).toContain("3 of 20 eligible");
  });
  it("prints the dates in the legend and alt text in place of a window", () => {
    const { data } = buildCategoryBlueprint(seasonOf(players), settings({ period: "custom", start: period.from, end: period.through }));
    expect(categoryBlueprintModule.altText({ evidence: { cohort: "c" } } as unknown as SharePostSnapshot, data!, settings())).toContain("per game over Oct 19 to Oct 22, through");
  });
  it("keeps old URLs and both landing views on recent games", () => {
    for (const view of ["standard", "points-first"]) expect(parseShareSettings(categoryBlueprintModule, { view, window: "std" })).toMatchObject({ view, window: "std", period: "rolling" });
    expect(parseShareSettings(categoryBlueprintModule, {})).toMatchObject({ window: "l10", period: "rolling", minGp: 5 });
    expect(categoryBlueprintModule.periodControl?.mode).toBe("past-only");
  });
});
