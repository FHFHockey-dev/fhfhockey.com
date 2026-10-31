// @vitest-environment jsdom
import { createElement } from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { BSH_LEADER_ROWS, BSH_MOVER_ROWS, bshBoardModule, bshGameStacks, bshStackTops, buildBshBoard, skaterSeasonEvidence, skaterSeasonScope, type BshBoardData, type BshBoardSettings, type SkaterSeason } from "./bshBoard";
import { parseShareSettings, sharePostExportBlock, type SharePostSnapshot } from "./contract";
import { skaterBoardModules } from "./lanes/skaterBoards";
import type { SkaterAppearance } from "./shared/skaterAppearances";

const settings = (over: Partial<BshBoardSettings> = {}): BshBoardSettings => ({ view: "leaders", window: "l5", comparison: "previous", minGp: 1, position: "all", ...over });
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

describe("BSH game stacks", () => {
  it("stacks blocks, shots and hits per game, with BSH on top", () => {
    const [stack] = bshGameStacks([game(1, 0, { blocks: 2, shots: 3, hits: 1 })]);
    expect(stack).toEqual({ date: "2026-10-01", blocks: 2, shots: 3, hits: 1, bsh: 6 });
    expect(bshStackTops(stack)).toEqual([2, 5, 6]);
  });
  it("makes a missing component a gap and keeps a known 0", () => {
    expect(bshStackTops(bshGameStacks([game(1, 0, { shots: null })])[0])).toBeNull();
    expect(bshStackTops(bshGameStacks([game(1, 0, { blocks: 0, shots: 0, hits: 0 })])[0])).toEqual([0, 0, 0]);
  });
  it("carries the leaders' window oldest to newest", () => {
    const { data } = buildBshBoard(season(games(1, 12, index => ({ shots: index }))), settings());
    expect(data!.rows[0].games.map(entry => entry.date)).toEqual(["2026-10-08", "2026-10-09", "2026-10-10", "2026-10-11", "2026-10-12"]);
    expect(data!.rows[0].games.map(entry => entry.shots)).toEqual([7, 8, 9, 10, 11]);
    expect(data!.rows[0].recentFrom).toBe(0);
  });
  it("spans both comparison windows for movers and says where the recent one starts", () => {
    const rows = games(1, 12, index => ({ shots: index }));
    const previous = buildBshBoard(season(rows), settings({ view: "movers" })).data!.risers[0];
    expect(previous.games.map(entry => entry.shots)).toEqual([2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
    expect(previous.recentFrom).toBe(5);
    const earlier = buildBshBoard(season(rows), settings({ view: "movers", comparison: "std" })).data!.risers[0];
    expect(earlier.games.map(entry => entry.shots)).toEqual(rows.map((_, index) => index));
    expect(earlier.recentFrom).toBe(7);
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
    expect(parseShareSettings(bshBoardModule, {})).toEqual({ view: "leaders", window: "l10", comparison: "previous", minGp: 5, position: "all" });
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
    for (const label of ["BLK /G", "SOG /G", "HITS /G", "BSH /G", "Skater 1", "10 2.00", "15 3.00", "5 1.00", "6.00", "30 total", "BY GAME", "L5", "1 of 2 ranked"]) expect(text).toContain(label);
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
  describe("chart and tile", () => {
    const chart = () => document.querySelector("[data-testid=bsh-stack]")!;
    it("draws one shape of three layers oldest first, with a tile scaling with value", async () => {
      const active = settings(), { data } = buildBshBoard(season([...games(1, 5, index => ({ blocks: index, shots: 2, hits: 1 })), ...games(2, 5, { blocks: 0, shots: 1, hits: 0 })]), active);
      await show(data!, active);
      expect(chart().getAttribute("data-stack")).toBe("0+2+1,1+2+1,2+2+1,3+2+1,4+2+1");
      expect([...chart().querySelectorAll("[data-layer]")].map(path => path.getAttribute("data-layer"))).toEqual(["b", "s", "h"]);
      expect(chart().querySelectorAll("[data-edge]")).toHaveLength(1);
      const alphas = screen.getAllByTestId("heat-tile").map(tile => Number(tile.getAttribute("data-alpha")));
      expect(alphas[0]).toBe(0.8);
      expect(alphas[1]).toBeLessThan(alphas[0]);
    });
    it("breaks the shape at a missing game and draws a known 0 on the baseline", async () => {
      const active = settings(), { data } = buildBshBoard(season(games(1, 5, { blocks: 1, shots: 1, hits: 1 })), active), row = data!.rows[0];
      const gapped = { ...data!, rows: [{ ...row, games: [row.games[0], row.games[1], { ...row.games[2], shots: null, bsh: null }, { ...row.games[3], blocks: 0, shots: 0, hits: 0, bsh: 0 }, row.games[4]] }] };
      await show(gapped, active);
      expect(chart().getAttribute("data-stack")).toBe("1+1+1,1+1+1,gap,0+0+0,1+1+1");
      const edges = [...chart().querySelectorAll("[data-edge]")].map(path => path.getAttribute("d")!);
      expect(edges).toHaveLength(2);
      expect(edges[1]).toContain("L"); // The 0 joins the next game, so it is drawn, not dropped.
      expect(edges[1].startsWith("M126.00 46.00")).toBe(true); // Fourth of five games, on the chart's baseline.
    });
    it("marks where the recent window starts, and scales the change tile on both sides", async () => {
      const active = settings({ view: "movers" }), { data } = buildBshBoard(season([...games(1, 10, index => ({ shots: index >= 5 ? 4 : 1 })), ...games(2, 10, index => ({ shots: index >= 5 ? 1 : 2 }))]), active);
      await show(data!, active);
      const charts = screen.getAllByTestId("bsh-stack");
      expect(charts[0].getAttribute("data-stack")).toBe("1+1+1,1+1+1,1+1+1,1+1+1,1+1+1,1+4+1,1+4+1,1+4+1,1+4+1,1+4+1");
      expect(charts[0].getAttribute("data-recent-from")).toBe("5");
      expect(charts[0].querySelector("[data-recent-mark]")!.getAttribute("d")).toBe("M90.00 0V48");
      const tiles = screen.getAllByTestId("heat-tile");
      expect(tiles.map(tile => tile.getAttribute("data-tone"))).toEqual(["better", "worse"]);
      expect(Number(tiles[1].getAttribute("data-alpha"))).toBeLessThan(Number(tiles[0].getAttribute("data-alpha")));
    });
    it("has no window mark on leaders", async () => {
      const active = settings(), { data } = buildBshBoard(season(games(1, 5)), active);
      await show(data!, active);
      expect(document.querySelector("[data-recent-mark]")).toBeNull();
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
    expect(skaterBoardModules.map(entry => entry.id)).toEqual(["bsh-board", "category-blueprint", "nightly-floor"]);
    for (const entry of skaterBoardModules) { expect(entry.basis).toBe("observed"); expect(entry.suggestedUse).toMatch(/any day/); expect(entry.fields.some(field => field.kind === "date")).toBe(false); }
  });
});
