// @vitest-environment jsdom
import { createElement } from "react";
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import type { SkaterSeason } from "./bshBoard";
import { parseShareSettings, type SharePostSnapshot } from "./contract";
import { buildNightlyFloor, floorAdmitted, floorOutcome, nightlyFloorModule, ownershipByPlayer, type NightlyFloorData, type NightlyFloorSettings } from "./nightlyFloor";
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
    expect(data).toMatchObject({ viewLabel: "Cardio Masters", test: "Appeared and scored exactly 0 points." });
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
    const many = buildNightlyFloor(season(Array.from({ length: 13 }, (_, index) => games(index + 1, [{ shots: 3 }])).flat()), settings(), none);
    expect(many.data).toMatchObject({ notShown: 1, tiedBeyondCut: 1 });
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
  it("prints the test, numerator, denominator, missing and unknown ownership", async () => {
    const active = settings({ minCoverage: 50 }), { data } = buildNightlyFloor(season(games(1, [{ shots: 3 }, { shots: 2 }, { shots: null }])), active, none);
    const text = await show(data!, active);
    for (const label of ["SOG above 2.", "Exactly 2 fails.", "last 10 appearances", "A DNP is not an appearance", "MET / KNOWN", "1 / 2", "MISSING", "50%", "—", "1 ranked of 1 eligible"]) expect(text).toContain(label);
  });
  it("labels Cardio Masters and an empty board, and asks for a refresh after a settings change", async () => {
    const active = settings({ view: "cardio" }), { data } = buildNightlyFloor(season(games(1, [{ points: 1 }])), active, none);
    const text = await show(data!, active);
    expect(text).toContain("Cardio Masters.");
    expect(text).toContain("No skater meets this test");
    cleanup();
    expect(await show(data!, settings({ view: "point" }))).toContain("Refresh this post");
  });
});
