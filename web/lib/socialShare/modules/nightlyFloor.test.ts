// @vitest-environment jsdom
import { createElement } from "react";
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import type { SkaterSeason } from "./bshBoard";
import { SKATER_CATEGORIES, type SkaterCategoryId } from "./categoryBlueprint";
import { parseShareSettings, type SharePostSnapshot } from "./contract";
import { buildNightlyFloor, floorAdmitted, floorAverage, floorHeadline, floorMetricLabels, floorOutcome, nightlyFloorModule, ownershipByPlayer, type NightlyFloorData, type NightlyFloorSettings } from "./nightlyFloor";
import { ownershipOf, type OwnershipState } from "./shared/definitions";
import type { SkaterAppearance } from "./shared/skaterAppearances";

const settings = (over: Partial<NightlyFloorSettings> = {}): NightlyFloorSettings => ({ view: "sog", xSog: 2, xHits: 2, xBlk: 1, zeroCategory: "hits", window: "l10", minGp: 1, position: "all", ownMin: 0, ownMax: 100, unknownOwnership: "include", minCoverage: 90, ...over });
const game = (playerId: number, index: number, stats: Partial<SkaterAppearance> = {}): SkaterAppearance => ({
  playerId, name: `Skater ${playerId}`, position: "L", group: "F", gameId: 1000 + index, date: `2026-10-${String(index + 1).padStart(2, "0")}`, team: "NJD", opponent: "NYR", home: true,
  goals: 0, assists: 0, points: 0, shots: 0, hits: 0, blocks: 0, ppPoints: 0, toiSeconds: 900, ppToiSeconds: 0, penaltyMinutes: 0, ...stats,
});
const games = (playerId: number, values: readonly Partial<SkaterAppearance>[]) => values.map((stats, index) => game(playerId, index, stats));
const season = (appearances: SkaterAppearance[]): SkaterSeason => ({ appearances, teamGames: [], scheduledGames: 0, through: "2026-10-30" });
const none = { byPlayer: new Map<number, OwnershipState>(), updatedAt: null };
const owned = (entries: [number, number | null][]) => ({ byPlayer: new Map(entries.map(([id, pct]) => [id, ownershipOf(pct)])), updatedAt: "2026-10-31T08:00:00" });

describe("Nightly Floor thresholds", () => {
  it("fails exactly X and passes above it for each stat", () => {
    expect(floorOutcome(settings(), game(1, 0, { shots: 2 }))).toBe(false);
    expect(floorOutcome(settings(), game(1, 0, { shots: 3 }))).toBe(true);
    expect(floorOutcome(settings({ view: "hits", xHits: 4 }), game(1, 0, { hits: 4 }))).toBe(false);
    expect(floorOutcome(settings({ view: "hits", xHits: 4 }), game(1, 0, { hits: 5 }))).toBe(true);
    expect(floorOutcome(settings({ view: "blk" }), game(1, 0, { blocks: 1 }))).toBe(false);
    expect(floorOutcome(settings({ view: "blk", xBlk: 0 }), game(1, 0, { blocks: 1 }))).toBe(true);
  });
  it("counts a missing stat as neither pass nor fail", () => {
    for (const view of ["sog", "hits", "blk", "point", "cardio", "zero"] as const) expect(floorOutcome(settings({ view }), game(1, 0, { shots: null, hits: null, blocks: null, points: null }))).toBeNull();
    const { data } = buildNightlyFloor(season(games(1, [{ shots: 3 }, { shots: 2 }, { shots: null }, { shots: 3 }, { shots: 3 }, { shots: 3 }, { shots: 3 }, { shots: 3 }, { shots: 3 }, { shots: 3 }])), settings(), none);
    expect(data!.rows[0]).toMatchObject({ appearances: 10, numerator: 8, denominator: 9, missing: 1 });
    expect(data!.rows[0].pct).toBeCloseTo(8 / 9);
  });
  it("treats a DNP as no appearance: a skipped game moves neither count", () => {
    const played = [{ shots: 3 }, { shots: 1 }, { shots: 3 }, { shots: 3 }];
    const { data } = buildNightlyFloor(season(played.map((stats, index) => game(1, index * 2, stats))), settings(), none);
    expect(data!.rows[0]).toMatchObject({ appearances: 4, numerator: 3, denominator: 4, missing: 0, pct: 0.75 });
  });
});

describe("Nightly Floor views", () => {
  it("counts at least one point with its boundary", () => {
    expect(floorOutcome(settings({ view: "point" }), game(1, 0, { points: 1 }))).toBe(true);
    expect(floorOutcome(settings({ view: "point" }), game(1, 0, { points: 0 }))).toBe(false);
  });
  it("Cardio Masters needs a known zero", () => {
    expect(floorOutcome(settings({ view: "cardio" }), game(1, 0, { points: 0 }))).toBe(true);
    expect(floorOutcome(settings({ view: "cardio" }), game(1, 0, { points: 1 }))).toBe(false);
    const { data } = buildNightlyFloor(season(games(1, [{ points: 0 }, { points: 0 }, { points: 1 }, { points: 0 }])), settings({ view: "cardio" }), none);
    expect(data).toMatchObject({ viewLabel: "Cardio Masters", test: "Cardio Masters: appeared with exactly 0 points." });
    expect(data!.rows[0]).toMatchObject({ numerator: 3, denominator: 4 });
  });
  it("selected-category zero uses the chosen category and keeps zero apart from missing", () => {
    const active = settings({ view: "zero", zeroCategory: "blocks", minCoverage: 50 });
    expect(floorOutcome(active, game(1, 0, { blocks: 0, hits: 5 }))).toBe(true);
    expect(floorOutcome(active, game(1, 0, { blocks: 1, hits: 0 }))).toBe(false);
    const { data } = buildNightlyFloor(season(games(1, [{ blocks: 0 }, { blocks: null }, { blocks: 2 }])), active, none);
    expect(data!.rows[0]).toMatchObject({ numerator: 1, denominator: 2, missing: 1 });
    expect(data!.viewLabel).toBe("Zero blocks");
  });
});

describe("Nightly Floor headline and metric", () => {
  it("names the metric and the true threshold for each setting", () => {
    expect(floorHeadline(settings({ view: "sog", xSog: 2 }))).toBe("GP% WITH 3+ SOG");
    expect(floorHeadline(settings({ view: "sog", xSog: 0 }))).toBe("GP% WITH 1+ SOG");
    expect(floorHeadline(settings({ view: "hits", xHits: 4 }))).toBe("GP% WITH 5+ HITS");
    expect(floorHeadline(settings({ view: "blk", xBlk: 1 }))).toBe("GP% WITH 2+ BLK");
    expect(floorHeadline(settings({ view: "point" }))).toBe("GP% WITH 1+ PTS");
    expect(floorHeadline(settings({ view: "zero", zeroCategory: "ppPoints" }))).toBe("GP% WITH 0 PPP");
  });
  it("agrees with the strict test at its boundary", () => {
    const active = settings({ xSog: 2 });
    expect(floorOutcome(active, game(1, 0, { shots: 3 }))).toBe(true);
    expect(floorOutcome(active, game(1, 0, { shots: 2 }))).toBe(false);
  });
  it("prints the exact rule when a threshold is not whole", () => {
    expect(floorHeadline(settings({ xSog: 2.5 }))).toBe("GP% WITH OVER 2.5 SOG");
    expect(floorMetricLabels(settings({ xSog: 2.5 })).metricLabel).toBe("METRIC: SOG, over 2.5 per game");
  });
  it("titles Cardio Masters by name", () => {
    expect(floorHeadline(settings({ view: "cardio" }))).toBe("CARDIO MASTERS");
  });
  it("gives the post header its headline and keeps the post's name for the studio", () => {
    expect(nightlyFloorModule.headline?.(settings())).toBe("GP% WITH 3+ SOG");
    expect(nightlyFloorModule.title).toBe("Nightly Floor");
    expect(nightlyFloorModule.headline?.(settings({ view: "cardio" }))).toBe("CARDIO MASTERS");
  });
  it("reads correctly once the header uppercases it, and is never longer than the longest post title", () => {
    const every = [
      ...(["sog", "hits", "blk", "point", "cardio"] as const).flatMap(view => [0, 10, 9.5].map(x => settings({ view, xSog: x, xHits: x, xBlk: x }))),
      ...(Object.keys(SKATER_CATEGORIES) as SkaterCategoryId[]).map(zeroCategory => settings({ view: "zero", zeroCategory })),
    ].map(floorHeadline);
    for (const headline of every) expect(headline.toUpperCase()).toBe(headline);
    // "Goalie Category Rescue" is 22 characters. The longest whole-number headline is shorter still.
    expect(Math.max(...every.map(headline => headline.length))).toBe("GP% WITH OVER 9.5 HITS".length);
    expect("GP% WITH OVER 9.5 HITS".length).toBeLessThanOrEqual(22);
    expect(floorHeadline(settings({ view: "hits", xHits: 10 }))).toBe("GP% WITH 11+ HITS");
  });
  it("states the metric and the average's name", () => {
    expect(floorMetricLabels(settings())).toEqual({ metricLabel: "METRIC: SOG, 3+ per game", averageLabel: "SOG/G" });
    expect(floorMetricLabels(settings({ view: "blk" }))).toEqual({ metricLabel: "METRIC: BLOCKS, 2+ per game", averageLabel: "BLK/G" });
    expect(floorMetricLabels(settings({ view: "cardio" }))).toEqual({ metricLabel: "METRIC: POINTS, exactly 0", averageLabel: "PTS/G" });
    expect(floorMetricLabels(settings({ view: "zero", zeroCategory: "hits" }))).toEqual({ metricLabel: "METRIC: HITS, exactly 0", averageLabel: "HITS/G" });
  });
  it("averages known games only, and has no average with no known game", () => {
    const rows = games(1, [{ shots: 4 }, { shots: null }, { shots: 1 }]);
    expect(floorAverage(settings(), rows)).toBe(2.5);
    expect(floorAverage(settings({ view: "cardio" }), games(1, [{ points: 2 }, { points: null }, { points: 0 }]))).toBe(1);
    expect(floorAverage(settings(), games(1, [{ shots: null }]))).toBeNull();
    expect(floorAverage(settings(), games(1, [{ shots: 0 }]))).toBe(0);
    expect(buildNightlyFloor(season(rows), settings({ minCoverage: 50 }), none).data!.rows[0].average).toBe(2.5);
  });
});

describe("Nightly Floor filters", () => {
  const ten = (nulls: number) => Array.from({ length: 10 }, (_, index) => index < nulls ? { shots: null } : { shots: 3 });
  it("admits exactly at min coverage and leaves below it unranked", () => {
    expect(floorAdmitted(9, 10, 90)).toBe(true);
    expect(floorAdmitted(8, 10, 90)).toBe(false);
    expect(floorAdmitted(0, 10, 50)).toBe(false);
    const { data } = buildNightlyFloor(season([...games(1, ten(1)), ...games(2, ten(2))]), settings(), none);
    expect(data!.rows.map(row => row.playerId)).toEqual([1]);
    expect(data!.cohort).toMatchObject({ pool: 2, unadmitted: 1, ranked: 1 });
    expect(buildNightlyFloor(season(games(2, ten(2))), settings({ minCoverage: 80 }), none).data!.rows.map(row => row.playerId)).toEqual([2]);
  });
  it("excludes unknown ownership unless the visible setting includes it, and never reads it as 0%", () => {
    const appearances = [...games(1, [{ shots: 3 }]), ...games(2, [{ shots: 3 }]), ...games(3, [{ shots: 3 }])], ownership = owned([[1, 40], [2, null], [3, 80]]);
    const excluded = buildNightlyFloor(season(appearances), settings({ unknownOwnership: "exclude", ownMax: 50 }), ownership);
    expect(excluded.data!.rows.map(row => row.playerId)).toEqual([1]);
    expect(excluded.data!.cohort).toMatchObject({ outOfOwnershipRange: 1, unknownOwnershipExcluded: 1 });
    expect(excluded.evidence.cohort).toContain("1 unknown rostered % excluded");
    const included = buildNightlyFloor(season(appearances), settings({ unknownOwnership: "include", ownMax: 50 }), ownership);
    expect(included.data!.rows.map(row => [row.playerId, row.ownership.state])).toEqual([[1, "known"], [2, "unknown"]]);
  });
  it("keeps range ends inclusive and a stated 0 as known", () => {
    const { data } = buildNightlyFloor(season([...games(1, [{ shots: 3 }]), ...games(2, [{ shots: 3 }]), ...games(3, [{ shots: 3 }])]), settings({ unknownOwnership: "exclude", ownMin: 0, ownMax: 40 }), owned([[1, 0], [2, 40], [3, 41]]));
    expect(data!.rows.map(row => [row.playerId, row.ownership.pct])).toEqual([[1, 0], [2, 40]]);
  });
  it("applies season GP, position and window", () => {
    const rows = Array.from({ length: 6 }, (_, index) => ({ shots: index < 1 ? 0 : 3 }));
    const { data } = buildNightlyFloor(season([...games(1, rows), ...games(2, rows.slice(0, 3)), ...games(3, rows).map(row => ({ ...row, position: "D", group: "D" as const }))]), settings({ window: "l5", minGp: 4, position: "F" }), none);
    expect(data!.rows.map(row => [row.playerId, row.appearances, row.numerator])).toEqual([[1, 5, 5]]);
  });
  it("shares ranks on an equal percentage and counts ties below the cut", () => {
    const { data } = buildNightlyFloor(season([...games(1, [{ shots: 3 }, { shots: 3 }]), ...games(2, [{ shots: 3 }]), ...games(3, [{ shots: 3 }, { shots: 1 }])]), settings(), none);
    expect(data!.rows.map(row => [row.playerId, row.rank])).toEqual([[1, 1], [2, 1], [3, 3]]);
    const many = buildNightlyFloor(season(Array.from({ length: 21 }, (_, index) => games(index + 1, [{ shots: 3 }])).flat()), settings(), none);
    expect(many.data).toMatchObject({ notShown: 7, tiedBeyondCut: 7 });
  });
  it("keeps an empty pool empty and refuses to export a board nobody clears", () => {
    const active = settings({ minGp: 5 }), empty = buildNightlyFloor(season(games(1, [{ shots: 3 }])), active, none);
    expect(empty.data!.rows).toEqual([]);
    expect(nightlyFloorModule.hasRows(empty.data, active)).toBe(false);
    const nobody = settings(), zero = buildNightlyFloor(season(games(1, [{ shots: 2 }])), nobody, none);
    expect(zero.data!.rows[0].numerator).toBe(0);
    expect(nightlyFloorModule.hasRows(zero.data, nobody)).toBe(false);
  });
  it("has the contract's visible defaults and refuses an inverted range", () => {
    expect(parseShareSettings(nightlyFloorModule, {})).toEqual({ view: "sog", xSog: 2, xHits: 2, xBlk: 1, zeroCategory: "shots", window: "l10", minGp: 5, position: "all", ownMin: 0, ownMax: 100, unknownOwnership: "exclude", minCoverage: 90 });
    expect(() => parseShareSettings(nightlyFloorModule, { ownMin: "60", ownMax: "50" })).toThrow(/rostered/);
    expect(() => parseShareSettings(nightlyFloorModule, { minCoverage: "49" })).toThrow();
  });
});

describe("Ownership join", () => {
  const yahoo = (key: string, pct: number | null, id: string | null = null) => ({ player_key: key, player_id: id, percent_ownership: pct, last_updated: "2026-10-31T08:40:43" });
  it("joins on player key or bare id, and states 0 as known", () => {
    const result = ownershipByPlayer([{ yahoo_player_id: "465.p.1", nhl_player_id: "8" }, { yahoo_player_id: "2", nhl_player_id: 9 }], [yahoo("465.p.1", 0), yahoo("465.p.2", 55, "2")]);
    expect(result.get(8)).toEqual({ state: "known", pct: 0, asOf: "2026-10-31" });
    expect(result.get(9)?.pct).toBe(55);
  });
  it("drops a Yahoo id on two NHL ids, and leaves null or conflicting values unknown", () => {
    const result = ownershipByPlayer([{ yahoo_player_id: "a", nhl_player_id: 1 }, { yahoo_player_id: "a", nhl_player_id: 2 }, { yahoo_player_id: "b", nhl_player_id: 3 }, { yahoo_player_id: "c", nhl_player_id: 4 }, { yahoo_player_id: "d", nhl_player_id: 4 }], [yahoo("a", 50), yahoo("b", null), yahoo("c", 10), yahoo("d", 20)]);
    expect(result.has(1)).toBe(false);
    expect(result.has(2)).toBe(false);
    expect(result.has(3)).toBe(false);
    expect(result.get(4)?.state).toBe("unknown");
  });
});

describe("Nightly Floor card", () => {
  afterEach(cleanup);
  const show = async (data: NightlyFloorData, active: NightlyFloorSettings) => {
    const Card = await nightlyFloorModule.card();
    render(createElement(Card, { snapshot: { settings: active } as unknown as SharePostSnapshot, data, settings: active, logos: {} }));
    return document.body.textContent!;
  };
  it("prints the metric, test, average, numerator, denominator and unknown ownership, with no missing column", async () => {
    const active = settings({ minCoverage: 50 }), { data } = buildNightlyFloor(season(games(1, [{ shots: 3 }, { shots: 2 }, { shots: null }])), active, none);
    const text = await show(data!, active);
    for (const label of ["More than 2 SOG.", "Exactly 2 fails.", "L10", "SOG/G", "2.50", "MET / KNOWN", "1 / 2", "missing", "50%", "—", "1 of 1 ranked"]) expect(text).toContain(label);
    expect(text).not.toContain("MISSING");
    expect(document.querySelector("[data-testid=floor-metric]")!.textContent).toBe("METRIC: SOG, 3+ per game");
    expect(document.querySelector("[data-testid=floor-strip] [data-mark=gap]")!.getAttribute("stroke")).toBe("#ffcc33");
    expect(document.querySelectorAll("p")).toHaveLength(1);
    expect(buildNightlyFloor(season(games(1, [{ shots: 3 }])), active, none).evidence.sample).toContain("A DNP is not an appearance");
  });
  it("prints a dash for a skater with no known game", async () => {
    const active = settings(), { data } = buildNightlyFloor(season(games(1, [{ shots: 3 }])), active, none);
    const text = await show({ ...data!, rows: [{ ...data!.rows[0], average: null, ownership: ownershipOf(40) }] }, active);
    expect(text).toContain("—");
    expect(text).not.toContain("3.00");
  });
  describe("strip and tile", () => {
    const marks = () => [...document.querySelectorAll("[data-mark]")].filter(mark => mark.closest("[data-testid=floor-strip]")).map(mark => mark.getAttribute("data-mark"));
    it("marks oldest to newest with the count's strict test: exactly X is not met, missing is a gap", async () => {
      const active = settings({ minCoverage: 50 }), { data } = buildNightlyFloor(season(games(1, [{ shots: 3 }, { shots: 2 }, { shots: null }, { shots: 0 }, { shots: 5 }])), active, none);
      await show(data!, active);
      expect(marks()).toEqual(["met", "not", "gap", "not", "met"]);
      // A stylesheet fill is lost in the PNG capture and draws black, so colours must be attributes.
      expect([...document.querySelectorAll("[data-testid=floor-strip] [data-mark]")].map(mark => mark.getAttribute("fill")).slice(0, 3)).toEqual(["#00ff99", "rgba(255,255,255,0.28)", "none"]);
      expect(data!.rows[0]).toMatchObject({ numerator: 2, denominator: 4, missing: 1, marks: [true, false, null, false, true] });
    });
    it("has as many met marks as the numerator on every view", async () => {
      const line = (index: number) => ({ shots: index % 4, hits: (index + 1) % 4, blocks: (index + 2) % 4, points: index % 3 === 0 ? 0 : 1 });
      const rows = Array.from({ length: 10 }, (_, index) => line(index));
      for (const view of ["sog", "hits", "blk", "point", "cardio", "zero"] as const) {
        const active = settings({ view }), { data } = buildNightlyFloor(season(games(1, rows)), active, none);
        await show(data!, active);
        expect(marks().filter(mark => mark === "met")).toHaveLength(data!.rows[0].numerator);
        expect(marks()).toHaveLength(10);
        cleanup();
      }
    });
    it("marks Cardio Masters' scoreless games, in red, with a missing points line as a gap", async () => {
      const active = settings({ view: "cardio", minCoverage: 50 }), { data } = buildNightlyFloor(season(games(1, [{ points: 0 }, { points: 2 }, { points: null }, { points: 0 }])), active, none);
      await show(data!, active);
      expect(marks()).toEqual(["met", "not", "gap", "met"]);
      expect(data!.rows[0].numerator).toBe(2);
      const tile = document.querySelector("[data-testid=heat-tile]")!;
      expect(tile.getAttribute("data-tone")).toBe("worse");
      expect(tile.textContent).toBe("67%of GP");
    });
    it("scales the tile with the value on one absolute scale", async () => {
      const active = settings(), { data } = buildNightlyFloor(season([...games(1, [{ shots: 3 }, { shots: 3 }]), ...games(2, [{ shots: 3 }, { shots: 0 }])]), active, none);
      await show(data!, active);
      expect([...document.querySelectorAll("[data-testid=heat-tile]")].map(tile => [tile.getAttribute("data-tone"), Number(tile.getAttribute("data-alpha"))])).toEqual([["better", 0.8], ["better", 0.5]]);
    });
  });
  it("labels Cardio Masters and an empty board, and asks for a refresh after a settings change", async () => {
    const active = settings({ view: "cardio" }), { data } = buildNightlyFloor(season(games(1, [{ points: 1 }])), active, none);
    const text = await show(data!, active);
    expect(text).toContain("Cardio Masters: appeared with exactly 0 points.");
    expect(text).toContain("No skater meets this test");
    cleanup();
    expect(await show(data!, settings({ view: "point" }))).toContain("Refresh this post");
  });
});
