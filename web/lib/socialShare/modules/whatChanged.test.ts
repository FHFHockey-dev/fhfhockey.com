import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import WhatChangedCard from "components/SocialShare/modules/WhatChangedCard";
import { lastN, previousN } from "./shared/definitions";
import type { SkaterAppearance } from "./shared/skaterAppearances";
import { buildWhatChanged, changeWindows, coverageAdmits, formatSeconds, joinNst, matchPlayer, seriesRuns, shareThrough, tileMetrics, type NstCountRow, type NstOnIceRow, type WhatChangedInput, type WhatChangedSettings, whatChangedModule } from "./whatChanged";
import { loadWhatChanged } from "./whatChanged.sources";

vi.mock("lib/supabase/public-client", () => ({ default: {} }));

const settings: WhatChangedSettings = { window: "l5", comparison: "std", minGp: 10, minCoverage: 90, metric: "points", basis: "perGame", player: "" };
const dateOf = (index: number) => new Date(Date.UTC(2026, 9, 1 + index)).toISOString().slice(0, 10);
/** Fictional: `points(i)` is that game's points, game ids are per date. */
function games(playerId: number, count: number, points: (index: number) => number | null, over: Partial<SkaterAppearance> = {}): SkaterAppearance[] {
  return Array.from({ length: count }, (_, index) => ({ playerId, name: `Skater ${playerId}`, position: "C", group: "F" as const, gameId: 1000 + index, date: dateOf(index), team: "NJD", opponent: "NYR", home: true, goals: 0, assists: 0, points: points(index), shots: 2, hits: 1, blocks: 1, ppPoints: 0, toiSeconds: 1200, ppToiSeconds: 120, penaltyMinutes: 0, ...over }));
}
const nstRow = (playerId: number, index: number, ixg: number | null = 0.5): NstCountRow => ({ player_id: playerId, date_scraped: dateOf(index), season: 20262027, ixg, iscfs: 1, icf: 3 });
const base = (over: Partial<WhatChangedInput> & { appearances: SkaterAppearance[] }): WhatChangedInput => ({ nstCounts: null, nstOnIce: null, completedTeamGames: [], scheduledGameIds: [], through: "2026-10-30", settings, ...over });

describe("What Changed windows and samples", () => {
  it("reads through yesterday in New York", () => {
    expect(shareThrough("2026-11-01T02:00:00Z")).toEqual({ through: "2026-10-30", season: 20262027, from: "2026-07-01" });
  });
  it("ranks recent versus STD and discloses the overlap count", () => {
    const appearances = [...games(1, 10, index => index >= 5 ? 2 : 0), ...games(2, 10, index => index >= 5 ? 0 : 2)];
    const data = buildWhatChanged(base({ appearances })).data!;
    expect(data.risers[0]).toMatchObject({ playerId: 1, rank: 1, recentGames: 5, baselineGames: 10, overlap: 5 });
    expect(data.risers[0].change).toMatchObject({ unit: "per game", delta: 1, recent: { value: 2 }, baseline: { value: 1 } });
    expect(data.fallers[0]).toMatchObject({ playerId: 2, overlap: 5 });
    expect(data.fallers[0].change.delta).toBe(-1);
  });
  it("keeps a short sample unranked with its actual count, and an STD that is the same games is no comparison", () => {
    const appearances = [...games(1, 3, () => 2), ...games(2, 10, index => index >= 5 ? 2 : 0)];
    const result = buildWhatChanged(base({ appearances, settings: { ...settings, minGp: 1 } })).data!;
    expect(result.risers.map(row => row.playerId)).toEqual([2]);
    expect(result.cohort).toMatchObject({ eligible: 2, ranked: 1, shortSample: 1 });
    const focused = buildWhatChanged(base({ appearances, settings: { ...settings, minGp: 1, player: "1" } })).data!.focus!;
    expect(focused).toMatchObject({ recentGames: 3, baselineGames: 3, overlap: 3, short: true });
  });
  it("applies the minimum season GP at the boundary", () => {
    const appearances = [...games(1, 10, index => index >= 5 ? 2 : 0), ...games(2, 9, index => index >= 4 ? 2 : 0)];
    expect(buildWhatChanged(base({ appearances })).data!.cohort.eligible).toBe(1);
  });
  it("never reads a missing stat as zero: the window is unadmitted and the post partial", () => {
    const appearances = games(1, 10, index => index === 9 ? null : index >= 5 ? 2 : 0);
    const result = buildWhatChanged(base({ appearances }));
    expect(result.data!.risers).toEqual([]);
    expect(result.data!.cohort).toMatchObject({ unadmitted: 1, ranked: 0 });
    expect(result.state).toBe("partial");
    const focus = buildWhatChanged(base({ appearances, settings: { ...settings, player: "1" } })).data!.focus!;
    const points = focus.changes.find(change => change.metric === "points")!;
    expect(points.recent).toMatchObject({ value: null, admitted: false, coverage: { observed: 4, expected: 5, missing: 1 } });
    expect(points.delta).toBeNull();
  });
  it("shares competition ranks on the printed value", () => {
    const appearances = [1, 2, 3].flatMap(id => games(id, 10, index => index >= 5 ? (id === 3 ? 1 : 2) : 0));
    expect(buildWhatChanged(base({ appearances })).data!.risers.map(row => row.rank)).toEqual([1, 1, 3]);
  });
  it("pools per 60 over summed TOI, with PP points over PP time and an off-PP player unknown rather than 0", () => {
    const appearances = games(1, 10, () => 1, { toiSeconds: 1800, goals: 1, ppToiSeconds: 0 });
    const focus = buildWhatChanged(base({ appearances, settings: { ...settings, basis: "per60", player: "1" } })).data!.focus!;
    expect(focus.changes.find(change => change.metric === "goals")).toMatchObject({ unit: "per 60", recent: { value: 2 } });
    expect(focus.changes.find(change => change.metric === "ppPoints")).toMatchObject({ unit: "per 60 PP min", recent: { value: null } });
    expect(focus.changes.find(change => change.metric === "toi")).toMatchObject({ unit: "m:ss per game", recent: { value: 1800 } });
    expect(formatSeconds(1800)).toBe("30:00");
    expect(formatSeconds(-65, true)).toBe("−1:05");
  });
});

describe("matched recent versus previous", () => {
  it("has no game in both windows and uses previousN's definition", () => {
    const rows = games(1, 12, () => 1);
    const { recent, baseline, overlap } = changeWindows(rows, 5, "previous");
    expect(overlap).toBe(0);
    expect(recent.rows).toEqual(lastN(rows, 5).rows);
    expect(baseline.rows).toEqual(previousN(rows, 5, 5).rows);
    expect(new Set([...recent.rows, ...baseline.rows].map(game => game.gameId)).size).toBe(10);
  });
  it("is selectable, and a short previous window stays unranked", () => {
    const appearances = [...games(1, 10, index => index >= 5 ? 2 : 0), ...games(2, 8, index => index >= 3 ? 2 : 0)];
    const data = buildWhatChanged(base({ appearances, settings: { ...settings, comparison: "previous", minGp: 1 } })).data!;
    expect(data.risers.map(row => [row.playerId, row.recentGames, row.baselineGames, row.overlap])).toEqual([[1, 5, 5, 0]]);
    expect(data.cohort.shortSample).toBe(1);
  });
});

describe("NST coverage admission", () => {
  it("admits 90% and refuses 89%", () => {
    expect(coverageAdmits(90, 100, 90)).toBe(true);
    expect(coverageAdmits(89, 100, 90)).toBe(false);
    expect(coverageAdmits(0, 0, 90)).toBe(false);
  });
  it("leaves a player with a game missing from NST unranked in L5, and admits 9 of 10 in L10, with counts", () => {
    const appearances = games(1, 20, () => 1);
    const counts = Array.from({ length: 20 }, (_, index) => index).filter(index => index !== 19).map(index => nstRow(1, index, index >= 15 ? 1 : 0.2));
    const l5 = buildWhatChanged(base({ appearances, nstCounts: counts, settings: { ...settings, metric: "ixg" } }));
    expect(l5.data!.risers).toEqual([]);
    expect(l5.data!.cohort.unadmitted).toBe(1);
    expect(l5.state).toBe("ready");
    expect(l5.evidence.coverage).toEqual({ observed: 19, expected: 20, missing: 1, unit: "Individual xG (ixG) appearances" });
    const l10 = buildWhatChanged(base({ appearances, nstCounts: counts, settings: { ...settings, metric: "ixg", window: "l10" } })).data!;
    expect(l10.risers[0].change.recent).toMatchObject({ admitted: true, coverage: { observed: 9, expected: 10, missing: 1 } });
  });
  it("treats a date with two joinable games or two NST rows as unresolved, never a value", () => {
    const doubled = [...games(1, 2, () => 1), { ...games(1, 1, () => 1)[0], gameId: 2000 }];
    const join = joinNst(doubled, [nstRow(1, 0), nstRow(1, 1)]);
    expect(join(doubled[0]).state).toBe("unresolved");
    expect(join(doubled[1]).state).toBe("found");
    const twoRows = joinNst(games(1, 1, () => 1), [nstRow(1, 0), nstRow(1, 0)]);
    expect(twoRows(games(1, 1, () => 1)[0]).state).toBe("unresolved");
    const focus = buildWhatChanged(base({ appearances: doubled, nstCounts: [nstRow(1, 0), nstRow(1, 1)], settings: { ...settings, minGp: 1, player: "1", metric: "ixg" } })).data!.focus!;
    expect(focus.changes.find(change => change.metric === "ixg")!.baseline.coverage).toMatchObject({ observed: 1, expected: 3, unresolved: 2 });
  });
  it("pools on-ice xGF% from sums, and keeps NST and WGO names apart in the sources", () => {
    const appearances = games(1, 10, () => 1);
    const onIce: NstOnIceRow[] = Array.from({ length: 10 }, (_, index) => ({ player_id: 1, date_scraped: dateOf(index), season: 20262027, xgf: index >= 5 ? 3 : 1, xga: 1 }));
    const result = buildWhatChanged(base({ appearances, nstOnIce: onIce, settings: { ...settings, metric: "xgfPct" } }));
    expect(result.data!.risers[0].change).toMatchObject({ recent: { value: 75 }, baseline: { value: 66.7 }, delta: 8.3 });
    expect(result.evidence.sources.map(source => source.tables[0])).toEqual(["wgo_skater_stats", "wgo_team_stats", "nst_gamelog_as_counts_oi"]);
  });
});

describe("game completeness and identity", () => {
  it("is partial when a scheduled game has no result or a completed team game no skater rows", () => {
    const home = games(1, 10, index => index >= 5 ? 1 : 0), appearances = [...home, ...games(2, 10, () => 0, { team: "NYR" })];
    const completed = home.flatMap(game => [{ gameId: game.gameId, team: "NJD" }, { gameId: game.gameId, team: "NYR" }]);
    const scheduledGameIds = home.map(game => game.gameId);
    const complete = buildWhatChanged(base({ appearances, completedTeamGames: completed, scheduledGameIds }));
    expect(complete.state).toBe("ready");
    expect(complete.evidence.coverage).toEqual({ observed: 20, expected: 20, missing: 0, unit: "team games" });
    const short = buildWhatChanged(base({ appearances, completedTeamGames: completed, scheduledGameIds: [...scheduledGameIds, 9999] }));
    expect(short.state).toBe("partial");
    expect(short.reasons![0]).toMatch(/2 of 22/);
    expect(short.reasons).toHaveLength(1);
    const silent = buildWhatChanged(base({ appearances, completedTeamGames: [...completed, { gameId: 8888, team: "NJD" }, { gameId: 8888, team: "NYR" }], scheduledGameIds: [...scheduledGameIds, 8888] }));
    expect(silent.reasons![0]).toMatch(/2 of 22 completed team games have no skater rows/);
    const oneTeam = buildWhatChanged(base({ appearances: appearances.filter(game => !(game.team === "NYR" && game.gameId === 1009)), completedTeamGames: completed, scheduledGameIds }));
    expect(oneTeam.state).toBe("partial");
    expect(oneTeam.reasons).toEqual(["1 of 20 completed team games have no skater rows."]);
    expect(oneTeam.evidence.coverage).toEqual({ observed: 20, expected: 20, missing: 0, unit: "team games" });
    expect(oneTeam.data!.risers[0]).toMatchObject({ playerId: 1 });
  });
  it("selects one player by id or a unique name, and never guesses between two", () => {
    const appearances = [...games(1, 3, () => 1), ...games(2, 3, () => 1, { name: "Skater 12" })];
    expect(matchPlayer(appearances, "2").playerId).toBe(2);
    expect(matchPlayer(appearances, "skater 12").playerId).toBe(2);
    expect(matchPlayer(appearances, "skater")).toMatchObject({ playerId: null, candidates: [{ playerId: 1 }, { playerId: 2 }] });
    expect(buildWhatChanged(base({ appearances, settings: { ...settings, player: "skater" } })).data!.focus).toBeNull();
  });
  it("flags a traded player from the game teams", () => {
    const appearances = games(1, 10, index => index >= 5 ? 2 : 0).map((game, index) => ({ ...game, team: index >= 7 ? "NYR" : "NJD" }));
    expect(buildWhatChanged(base({ appearances })).data!.risers[0].teamChange).toEqual({ from: "NJD", to: "NYR", recentGamesWithNewTeam: 3 });
  });
});

describe("What Changed card and export gates", () => {
  const snapshotFor = (result: ReturnType<typeof buildWhatChanged>, active: WhatChangedSettings) => ({ schemaVersion: 1 as const, id: "x", post: "what-changed", state: result.state, reasons: [], generatedAt: "2026-10-31T16:00:00Z", expiresAt: null, timeZone: "America/New_York" as const, settings: active, evidence: result.evidence, data: result.data, teams: result.teams ?? [], fixture: true });
  const render = (input: WhatChangedInput) => {
    const result = buildWhatChanged(input);
    return renderToStaticMarkup(createElement(WhatChangedCard, { snapshot: snapshotFor(result, input.settings), data: result.data!, settings: input.settings, logos: {} }));
  };
  it("prints values, samples and overlap, and no rank without an admitted population", () => {
    const appearances = [...games(1, 10, index => index >= 5 ? 2 : 0), ...games(2, 10, index => index >= 5 ? 0 : 2)];
    const html = render(base({ appearances }));
    for (const text of ["Points per game", "L5 versus season to date", "+1.00", "−1.00", "5 of 10 GP", "Skater 1", "L5 games are inside STD", "Production", "Opportunity", "Underlying", "Points/G", "TOI", "ixG/G"]) expect(html).toContain(text);
    expect(html).not.toMatch(/forecast|predict|will /i);
    const empty = render(base({ appearances: games(1, 4, () => 1) }));
    expect(empty).toContain("No player qualifies");
    expect(empty).not.toContain("RK");
  });
  it("prints coverage on NST rows and every metric for one player", () => {
    const appearances = games(1, 20, index => index);
    const counts = Array.from({ length: 20 }, (_, index) => nstRow(1, index, index >= 15 ? 1 : 0.2));
    const ranked = render(base({ appearances, nstCounts: counts, settings: { ...settings, metric: "ixg" } }));
    expect(ranked).toContain("NST 5/5 · 20/20");
    const focus = render(base({ appearances, nstCounts: counts, nstOnIce: [], settings: { ...settings, player: "1" } }));
    for (const text of ["Goals", "PP TOI", "Individual xG (ixG)", "On-ice xGF%", "0/5 · 0/20", "20:00"]) expect(focus).toContain(text);
  });
  it("says why when a named player is not selected", () => {
    const appearances = [...games(1, 3, () => 1), ...games(2, 3, () => 1)];
    expect(render(base({ appearances, settings: { ...settings, player: "skater" } }))).toContain("More than one player matches");
    expect(render(base({ appearances, settings: { ...settings, player: "nobody" } }))).toContain("No skater this season matches");
  });
  it("gates export on real rows and writes alt text with samples", () => {
    const appearances = games(1, 10, index => index >= 5 ? 2 : 0);
    const result = buildWhatChanged(base({ appearances }));
    expect(whatChangedModule.hasRows(result.data!, settings)).toBe(true);
    expect(whatChangedModule.hasRows(result.data!, { ...settings, player: "nobody" })).toBe(false);
    expect(whatChangedModule.hasRows(buildWhatChanged(base({ appearances: games(1, 4, () => 1) })).data!, settings)).toBe(false);
    expect(whatChangedModule.altText(snapshotFor(result, settings), result.data!, settings)).toMatch(/Skater 1: 2\.00 versus 1\.00 \(5 and 10 GP, overlap 5\)/);
  });
});

describe("What Changed boards", () => {
  const snapshotOf = (result: ReturnType<typeof buildWhatChanged>, active: WhatChangedSettings) => ({ schemaVersion: 1 as const, id: "x", post: "what-changed", state: result.state, reasons: [], generatedAt: "2026-10-31T16:00:00Z", expiresAt: null, timeZone: "America/New_York" as const, settings: active, evidence: result.evidence, data: result.data, teams: [], fixture: true });
  const html = (input: WhatChangedInput) => { const result = buildWhatChanged(input); return renderToStaticMarkup(createElement(WhatChangedCard, { snapshot: snapshotOf(result, input.settings), data: result.data!, settings: input.settings, logos: {} })); };
  const tileOf = (markup: string, metric: string) => markup.match(new RegExp(`<span[^>]*data-testid="group-tile"[^>]*data-metric="${metric}"[^>]*>.*?</span></span>`))![0];
  it("draws the ranked metric's last 10 appearances, with a missing game a gap and the recent window marked", () => {
    expect(seriesRuns([1, null, 2, 3, null])).toEqual([[0], [2, 3]]);
    const appearances = games(1, 20, () => 1);
    const counts = Array.from({ length: 20 }, (_, index) => index).filter(index => index !== 13).map(index => nstRow(1, index, index >= 15 ? 1 : 0.5));
    const row = buildWhatChanged(base({ appearances, nstCounts: counts, settings: { ...settings, metric: "ixg" } })).data!.risers[0];
    expect(row.series.map(point => point.date)).toEqual(appearances.slice(-10).map(game => game.date));
    expect(row.series.map(point => point.value)).toEqual([0.5, 0.5, 0.5, null, 0.5, 1, 1, 1, 1, 1]);
    expect(row.recentFrom).toBe(5);
    const markup = html(base({ appearances, nstCounts: counts, settings: { ...settings, metric: "ixg" } }));
    expect(markup).toContain('data-sparkline="0.5,0.5,0.5,gap,0.5,1,1,1,1,1"');
    expect(markup).toContain('data-recent-from="5"');
    expect(markup).toContain("data-gap");
    const spark = markup.match(/<svg[^>]*data-sparkline.*?<\/svg>/)![0];
    expect([...spark.matchAll(/<text[^>]*data-axis="value"[^>]*>([^<]*)</g)].map(mark => mark[1])).toEqual(["1.00", "0.50"]);
    expect(spark.match(/<text[^>]*data-axis="date"/g)).toHaveLength(2);
    expect(spark).not.toMatch(/<(?:path|circle|rect|text)[^>]*class=/);
    for (const mark of spark.match(/<(?:circle|rect|text)[^>]*>/g)!) expect(mark).toContain('fill="#ffffff"');
    const l10 = buildWhatChanged(base({ appearances: games(1, 30, index => index >= 20 ? 2 : 0), settings: { ...settings, window: "l10" } })).data!.risers[0];
    expect(l10).toMatchObject({ recentFrom: 0 });
    expect(l10.series).toHaveLength(10);
  });
  it("reads a share game by game and per 60 on the chosen basis, with no denominator a gap", () => {
    const appearances = games(1, 20, () => 1, { toiSeconds: 1800 }).map((game, index) => index === 13 ? { ...game, toiSeconds: null } : game);
    const counts = Array.from({ length: 20 }, (_, index) => nstRow(1, index, index >= 15 ? 1 : 0.5));
    expect(buildWhatChanged(base({ appearances, nstCounts: counts, settings: { ...settings, metric: "ixg", basis: "per60" } })).data!.risers[0].series.map(point => point.value)).toEqual([1, 1, 1, null, 1, 2, 2, 2, 2, 2]);
    const onIce: NstOnIceRow[] = Array.from({ length: 12 }, (_, index) => ({ player_id: 1, date_scraped: dateOf(index), season: 20262027, xgf: index >= 7 ? 3 : 1, xga: index === 2 ? 0 : 1 }));
    onIce[3] = { ...onIce[3], xgf: 0, xga: 0 };
    const row = buildWhatChanged(base({ appearances: games(1, 12, () => 1), nstOnIce: onIce, settings: { ...settings, metric: "xgfPct" } })).data!.risers[0];
    expect(row.series.slice(0, 3).map(point => point.value)).toEqual([100, null, 50]);
    expect(row.series[row.series.length - 1].value).toBe(75);
  });
  it("shows one metric per group, swapping in the ranked metric, and a null stays a dash, never 0", () => {
    expect(tileMetrics("points").map(metric => metric.id)).toEqual(["points", "toi", "ixg"]);
    expect(tileMetrics("ppToi").map(metric => metric.id)).toEqual(["points", "ppToi", "ixg"]);
    expect(tileMetrics("xgfPct").map(metric => metric.id)).toEqual(["points", "toi", "xgfPct"]);
    const appearances = games(1, 20, index => index >= 15 ? 2 : 0);
    const unread = base({ appearances });
    expect(buildWhatChanged(unread).data!.risers[0].tiles[2]).toMatchObject({ metric: "ixg", delta: null, recent: { value: null, admitted: false, coverage: { observed: 0, expected: 5 } } });
    const tile = tileOf(html(unread), "ixg");
    expect(tile).toContain("—");
    expect(tile).toContain("0/5");
    expect(tile).not.toContain("0.00");
    expect(tile).toContain('data-direction="none"');
  });
  it("admits each tile on the post's minimum coverage: a baseline below it prints the recent value and its mark", () => {
    const appearances = games(1, 20, index => index >= 15 ? 2 : 0);
    const counts = Array.from({ length: 20 }, (_, index) => index).filter(index => index > 2).map(index => nstRow(1, index, 0.5));
    const strict = buildWhatChanged(base({ appearances, nstCounts: counts })).data!.risers[0].tiles[2];
    expect(strict).toMatchObject({ delta: null, recent: { value: 0.5, admitted: true }, baseline: { value: null, admitted: false, coverage: { observed: 17, expected: 20 } } });
    expect(tileOf(html(base({ appearances, nstCounts: counts })), "ixg")).toContain("17/20");
    const loose = { ...settings, minCoverage: 80 };
    expect(buildWhatChanged(base({ appearances, nstCounts: counts, settings: loose })).data!.risers[0].tiles[2]).toMatchObject({ baseline: { admitted: true }, delta: 0 });
    expect(tileOf(html(base({ appearances, nstCounts: counts, settings: loose })), "ixg")).not.toContain("17/20");
  });
  it("lays Up and Down side by side, stops at 5 rows, shares tied ranks and says who a tie left off", () => {
    const appearances = [1, 2, 3, 4, 5, 6, 7, 8].flatMap(id => games(id, 10, index => index >= 5 ? 2 : 0)).concat(games(9, 10, index => index >= 5 ? 0 : 2));
    const { data } = buildWhatChanged(base({ appearances }));
    expect(data!.risers.map(row => row.rank)).toEqual([1, 1, 1, 1, 1]);
    expect(data!.fallers.map(row => row.rank)).toEqual([1]);
    expect(data!.moreTied).toEqual({ up: 3, down: 0 });
    expect(data!.cohort).toMatchObject({ unlisted: 3, listedLimit: 5 });
    const markup = html(base({ appearances }));
    expect(markup).toContain('data-testid="board-up"');
    expect(markup).toContain('data-testid="board-down"');
    expect(markup.match(/data-testid="change-row"/g)).toHaveLength(6);
    expect(markup).toContain("Up: 3 more tied at rank 1");
    expect(html(base({ appearances: games(1, 10, index => index >= 5 ? 2 : 0) }))).toContain("No faller qualifies");
  });
  it("colours the change tile by direction and scales it by size, and each group tile by its own sign", () => {
    const appearances = [...games(1, 10, index => index >= 5 ? 2 : 0), ...games(2, 10, index => index >= 5 ? 0 : 1)];
    const markup = html(base({ appearances }));
    const up = markup.slice(markup.indexOf('data-testid="board-up"'), markup.indexOf('data-testid="board-down"')), down = markup.slice(markup.indexOf('data-testid="board-down"'));
    expect(up).toContain('data-tone="better"');
    expect(up).toContain('data-alpha="0.8"');
    expect(down).toContain('data-tone="worse"');
    expect(down).toContain('data-alpha="0.5"');
    expect(tileOf(up, "points")).toContain('data-direction="up"');
    expect(tileOf(down, "points")).toContain('data-direction="down"');
    expect(tileOf(up, "toi")).toContain('data-direction="flat"');
  });
  it("carries tiles and the line into the alt text, and fills the evidence rather than the card", () => {
    const appearances = games(1, 12, index => index >= 7 ? 2 : 0);
    const result = buildWhatChanged(base({ appearances }));
    const alt = whatChangedModule.altText(snapshotOf(result, settings), result.data!, settings);
    expect(alt).toContain("Points/G 2.00, change +");
    expect(alt).toContain("Last 10 games: 0.00, 0.00, 0.00, 0.00, 0.00, 2.00");
    expect(result.evidence.sample).toContain("a gap is a game with no value");
  });
});

describe("What Changed read plan", () => {
  const tables = (rows: Record<string, unknown[]>) => {
    const asked: { table: string; calls: unknown[][] }[] = [];
    return { asked, client: { from: (table: string) => {
      const entry = { table, calls: [] as unknown[][] };
      asked.push(entry);
      const builder: Record<string, unknown> = {};
      for (const method of ["select", "eq", "gte", "lte", "order", "in"]) builder[method] = (...args: unknown[]) => { entry.calls.push([method, ...args]); return builder; };
      builder.range = () => Promise.resolve({ data: rows[table] ?? [], error: null, count: (rows[table] ?? []).length });
      return builder;
    } } };
  };
  const skater = { player_id: 1, player_name: "Skater 1", position_code: "C", date: "2026-10-30", season_id: 20262027, game_id: 5, team_abbrev: "NJD", opponent_team_abbrev: "NYR", home_road: "H", games_played: 1, goals: 0, assists: 0, points: 0, shots: 1, hits: 0, blocked_shots: 0, pp_points: 0, toi_per_game: 900, pp_toi: 0, penalty_minutes: 0 };
  const context = (client: unknown) => ({ client: client as never, generatedAt: "2026-10-31T16:00:00Z" });
  it("reads no NST with nobody listed, and reads it for the whole league only when an NST metric ranks", async () => {
    const nobodyListed = tables({ wgo_skater_stats: [skater] });
    await loadWhatChanged(context(nobodyListed.client), settings);
    expect(nobodyListed.asked.map(entry => entry.table)).toEqual(["wgo_skater_stats", "wgo_team_stats", "games"]);
    const ranking = tables({ wgo_skater_stats: [skater] });
    await loadWhatChanged(context(ranking.client), { ...settings, metric: "ixg" });
    expect(ranking.asked.map(entry => entry.table)).toContain("nst_gamelog_as_counts");
    expect(ranking.asked.map(entry => entry.table)).not.toContain("nst_gamelog_as_counts_oi");
  });
  it("narrows a production ranking's NST to the players on the boards", async () => {
    const rows = Array.from({ length: 10 }, (_, index) => ({ ...skater, date: dateOf(index), game_id: 1000 + index, points: index >= 5 ? 2 : 0 }));
    const listed = tables({ wgo_skater_stats: rows });
    const result = await loadWhatChanged(context(listed.client), settings);
    expect(listed.asked.find(entry => entry.table === "nst_gamelog_as_counts")!.calls).toContainEqual(["in", "player_id", [1]]);
    expect(listed.asked.map(entry => entry.table)).not.toContain("nst_gamelog_as_counts_oi");
    expect(result.data!.risers[0].tiles[2].metric).toBe("ixg");
  });
  it("narrows NST to the one selected player", async () => {
    const focus = tables({ wgo_skater_stats: [skater] });
    await loadWhatChanged(context(focus.client), { ...settings, player: "1" });
    for (const table of ["nst_gamelog_as_counts", "nst_gamelog_as_counts_oi"]) expect(focus.asked.find(entry => entry.table === table)!.calls).toContainEqual(["eq", "player_id", 1]);
  });
});
