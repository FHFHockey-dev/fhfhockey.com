import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import RoleWatchCard from "components/SocialShare/modules/RoleWatchCard";
import type { SkaterAppearance } from "./shared/skaterAppearances";
import { buildRoleWatch, ROLE_WATCH_COPY, roleChange, roleSlotLabel, roleSlotReader, roleWatchModule, roleWatchShown, type RoleWatchInput, type RoleWatchSettings } from "./roleWatch";
import { loadRoleWatch } from "./roleWatch.sources";

vi.mock("lib/supabase/public-client", () => ({ default: {} }));

const settings: RoleWatchSettings = { window: "l5", board: "toi", minToiChange: 60, minPpChange: 30 };
const dateOf = (index: number) => new Date(Date.UTC(2026, 9, 1 + index)).toISOString().slice(0, 10);
/** Fictional skater: `toi(i)` and `pp(i)` are seconds in game i. */
function games(playerId: number, count: number, toi: (index: number) => number | null, pp: (index: number) => number | null = () => 120, over: Partial<SkaterAppearance> = {}): SkaterAppearance[] {
  return Array.from({ length: count }, (_, index) => ({ playerId, name: `Skater ${playerId}`, position: "C", group: "F" as const, gameId: 1000 + index, date: dateOf(index), team: "NJD", opponent: "NYR", home: true, goals: 0, assists: 0, points: 0, shots: 2, hits: 1, blocks: 1, ppPoints: 0, toiSeconds: toi(index), ppToiSeconds: pp(index), penaltyMinutes: 0, ...over }));
}
const base = (over: Partial<RoleWatchInput> & { appearances: SkaterAppearance[] }): RoleWatchInput => ({ evidence: { rolling: [], pp: [] }, completedTeamGames: [], scheduledGames: [], through: "2026-10-30", settings, ...over });

describe("Role Watch coverage", () => {
  const home = games(1, 12, index => index >= 7 ? 1200 : 1000), appearances = [...home, ...games(2, 12, () => 1000, () => 120, { team: "NYR" })];
  const completedTeamGames = home.flatMap(game => [{ gameId: game.gameId, team: "NJD" }, { gameId: game.gameId, team: "NYR" }]), scheduledGames = home.map(game => ({ gameId: game.gameId, date: game.date }));
  it("is ready when both teams have skater rows in every completed game", () => {
    const result = buildRoleWatch(base({ appearances, completedTeamGames, scheduledGames }));
    expect(result.state).toBe("ready");
    expect(result.reasons ?? []).toEqual([]);
    expect(result.evidence.coverage).toEqual({ observed: 24, expected: 24, missing: 0, unit: "team games" });
  });
  it("is partial and says so when one team's skater rows are missing from a game, and keeps the board", () => {
    const result = buildRoleWatch(base({ appearances: appearances.filter(game => !(game.team === "NYR" && game.gameId === 1005)), completedTeamGames, scheduledGames }));
    expect(result.state).toBe("partial");
    expect(result.reasons).toEqual(["1 of 24 completed team games have no skater rows."]);
    expect(result.evidence.coverage).toEqual({ observed: 23, expected: 24, missing: 1, unit: "team games" });
    expect(result.evidence.sources.find(source => source.tables.includes("wgo_team_stats"))!.state).toBe("ready");
    expect(result.data!.risers[0]).toMatchObject({ playerId: 1 });
  });
  it("names a scheduled game with no reported result", () => {
    const result = buildRoleWatch(base({ appearances, completedTeamGames, scheduledGames: [...scheduledGames, { gameId: 9999, date: dateOf(3) }] }));
    expect(result.state).toBe("partial");
    expect(result.reasons).toEqual(["2 of 26 scheduled team games have no reported result."]);
    expect(result.evidence.coverage).toEqual({ observed: 24, expected: 26, missing: 2, unit: "team games" });
    expect(result.evidence.sources.find(source => source.tables.includes("wgo_team_stats"))!.state).toBe("partial");
  });
  it("ends at the last complete night when only the newest is late, and an older gap still blocks", () => {
    const lateNight = completedTeamGames.filter(game => game.gameId !== 1011);
    const late = buildRoleWatch(base({ appearances, completedTeamGames: lateNight, scheduledGames }));
    expect(late.state).toBe("ready");
    expect(late.pageNotes).toEqual(["Oct 12 is not fully reported yet, so this card ends Oct 11."]);
    expect(late.data!.through).toBe(dateOf(10));
    expect(late.data!.risers[0]).toMatchObject({ playerId: 1, recentGames: 5, baselineGames: 6, toi: { recentSeconds: 1160, baselineSeconds: 1000 } });
    expect(late.evidence.coverage).toEqual({ observed: 22, expected: 22, missing: 0, unit: "team games" });
    const older = buildRoleWatch(base({ appearances, completedTeamGames: lateNight, scheduledGames: [...scheduledGames, { gameId: 9999, date: dateOf(3) }] }));
    expect(older.state).toBe("partial");
    expect(older.reasons).toEqual(["2 of 24 scheduled team games have no reported result."]);
  });
});

describe("Role Watch changes", () => {
  it("compares in seconds against a baseline that shares no game, with direction and magnitude", () => {
    const data = buildRoleWatch(base({ appearances: games(1, 12, index => index >= 7 ? 1200 : 1080) })).data!;
    expect(data.risers[0]).toMatchObject({ playerId: 1, rank: 1, recentGames: 5, baselineGames: 7, overlap: 0, toi: { recentSeconds: 1200, baselineSeconds: 1080, changeSeconds: 120, direction: "up", qualifies: true } });
  });
  it("qualifies at exactly the minimum, not a second under it, and never on no change", () => {
    expect(roleChange(1060, 1000, 60).qualifies).toBe(true);
    expect(roleChange(1059, 1000, 60).qualifies).toBe(false);
    expect(roleChange(940, 1000, 60)).toMatchObject({ qualifies: true, direction: "down", changeSeconds: -60 });
    expect(roleChange(1000, 1000, 0)).toMatchObject({ qualifies: false, direction: "flat" });
  });
  it("keeps a missing value unknown and the post partial, and a known 0 PP baseline is a real change", () => {
    const missing = buildRoleWatch(base({ appearances: games(1, 12, index => index === 11 ? null : 1000) }));
    expect(missing.data!.risers).toEqual([]);
    expect(missing.state).toBe("partial");
    expect(missing.data!.cohort.unknownChange).toBe(1);
    const known = buildRoleWatch(base({ appearances: games(1, 12, () => 1000, index => index >= 7 ? 90 : 0), settings: { ...settings, board: "pp" } })).data!;
    expect(known.risers[0].pp).toMatchObject({ recentSeconds: 90, baselineSeconds: 0, changeSeconds: 90, direction: "up" });
  });
  it("excludes short samples, requiring a full window and a baseline at least that long", () => {
    const appearances = [...games(1, 4, () => 2000), ...games(2, 9, index => index >= 4 ? 2000 : 1000), ...games(3, 10, index => index >= 5 ? 2000 : 1000)];
    const data = buildRoleWatch(base({ appearances })).data!;
    expect(data.risers.map(row => row.playerId)).toEqual([3]);
    expect(data.cohort).toMatchObject({ players: 3, compared: 1, shortSample: 2 });
  });
  it("flags a traded player's new team and binds it to the game teams", () => {
    const appearances = games(1, 12, index => index >= 9 ? 1300 : 1000).map((game, index) => ({ ...game, team: index >= 9 ? "NYR" : "NJD" }));
    const row = buildRoleWatch(base({ appearances })).data!.risers[0];
    expect(row.team).toBe("NYR");
    expect(row.teamChange).toEqual({ from: "NJD", to: "NYR", recentGamesWithNewTeam: 3 });
  });
  it("uses L10 when asked", () => {
    const data = buildRoleWatch(base({ appearances: games(1, 20, index => index >= 10 ? 1200 : 1000), settings: { ...settings, window: "l10" } })).data!;
    expect(data.risers[0]).toMatchObject({ recentGames: 10, baselineGames: 10, toi: { changeSeconds: 200 } });
  });
  it("ranks each side on its own, with ties sharing a rank, and stops at 5 rows saying who a tie left off", () => {
    const appearances = [...games(1, 12, index => index >= 7 ? 1100 : 1000), ...games(2, 12, index => index >= 7 ? 900 : 1000), ...games(3, 12, index => index >= 7 ? 1070 : 1000), ...games(4, 12, index => index >= 7 ? 1100 : 1000)];
    const data = buildRoleWatch(base({ appearances })).data!;
    expect(data.risers.map(row => [row.playerId, row.rank])).toEqual([[1, 1], [4, 1], [3, 3]]);
    expect(data.fallers.map(row => [row.playerId, row.rank])).toEqual([[2, 1]]);
    const tied = buildRoleWatch(base({ appearances: [1, 2, 3, 4, 5, 6, 7, 8].flatMap(id => games(id, 12, index => index >= 7 ? 1200 : 1000)) })).data!;
    expect(tied.risers).toHaveLength(5);
    expect(tied.moreTied).toEqual({ up: 3, down: 0 });
    expect(tied.cohort).toMatchObject({ qualified: 8, unlisted: 3 });
  });
  it("keeps both measures reachable: the Board field picks which one ranks, on its own minimum", () => {
    expect(roleWatchModule.fields.find(field => field.id === "board")).toMatchObject({ default: "toi", options: [{ value: "toi" }, { value: "pp" }] });
    const appearances = [...games(1, 12, index => index >= 7 ? 1200 : 1000, () => 100), ...games(2, 12, () => 1000, index => index >= 7 ? 60 : 120)];
    const toi = buildRoleWatch(base({ appearances })).data!;
    expect(toi).toMatchObject({ board: "toi", minimum: 60 });
    expect(toi.risers.map(row => row.playerId)).toEqual([1]);
    expect(toi.fallers).toEqual([]);
    const pp = buildRoleWatch(base({ appearances, settings: { ...settings, board: "pp" } })).data!;
    expect(pp).toMatchObject({ board: "pp", minimum: 30 });
    expect(pp.risers).toEqual([]);
    expect(pp.fallers.map(row => row.playerId)).toEqual([2]);
    expect(roleWatchShown(appearances, { ...settings, board: "pp" }).playerIds).toEqual([2]);
  });
  it("carries the board's measure over the last 10 appearances, marking where the recent window starts", () => {
    const appearances = games(1, 12, index => index >= 7 ? 1200 : 1000, index => index >= 7 ? 90 : 30);
    const row = buildRoleWatch(base({ appearances })).data!.risers[0];
    expect(row.series.map(point => point.gameId)).toEqual(appearances.slice(-10).map(game => game.gameId));
    expect(row.series.map(point => point.value)).toEqual([1000, 1000, 1000, 1000, 1000, 1200, 1200, 1200, 1200, 1200]);
    expect(row.recentFrom).toBe(5);
    expect(buildRoleWatch(base({ appearances, settings: { ...settings, board: "pp" } })).data!.risers[0].series[9].value).toBe(90);
    expect(buildRoleWatch(base({ appearances: games(1, 20, index => index >= 10 ? 1200 : 1000), settings: { ...settings, window: "l10" } })).data!.risers[0].recentFrom).toBe(0);
  });
});

describe("role context", () => {
  it("separates unknown from off PP", () => {
    const slot = roleSlotReader({ rolling: [{ player_id: 1, game_id: 5, line_combo_slot: 2, line_combo_group: "forward" }, { player_id: 3, game_id: 5, line_combo_slot: 1, line_combo_group: "defense" }], pp: [{ gameId: 5, playerId: 1, unit: 1 }, { gameId: 5, playerId: 2, unit: 3 }] });
    expect(slot(1, 5)).toEqual({ line: "L2", pp: 1 });
    expect(slot(3, 5)).toEqual({ line: "P1", pp: "off" });
    expect(slot(2, 5)).toEqual({ line: "unknown", pp: "off" });
    expect(slot(1, 6)).toEqual({ line: "unknown", pp: "unknown" });
    expect(roleSlotLabel(slot(1, 6))).toBe("Line unknown · PP unknown");
    expect(roleSlotLabel(slot(3, 5))).toBe("P1 · Off PP");
  });
  it("reads the latest game and the game before the window, and marks rolling's first-week gap unknown", () => {
    const appearances = games(1, 12, index => index >= 7 ? 1200 : 1000);
    const result = buildRoleWatch(base({ appearances, evidence: { rolling: [{ player_id: 1, game_id: 1011, line_combo_slot: 1, line_combo_group: "forward" }], pp: [{ gameId: 1011, playerId: 1, unit: 1 }, { gameId: 1006, playerId: 9, unit: 1 }] } }));
    const row = result.data!.risers[0];
    expect(row.latest).toMatchObject({ gameId: 1011, role: { line: "L1", pp: 1 } });
    expect(row.before).toMatchObject({ gameId: 1006, role: { line: "unknown", pp: "off" } });
    expect(result.state).toBe("ready");
    expect(result.evidence.sources.find(source => source.tables[0] === "rolling_player_game_metrics")).toMatchObject({ state: "partial", reasons: ["1 line slots are unknown; rolling has no first-week rows."] });
    expect(result.evidence.sources.find(source => source.tables[0] === "powerPlayCombinations")!.state).toBe("ready");
  });
  it("asks only for the listed players' two games", () => {
    const appearances = [...games(1, 12, index => index >= 7 ? 1200 : 1000), ...games(2, 12, () => 1000)];
    expect(roleWatchShown(appearances, settings)).toEqual({ playerIds: [1], gameIds: [1011, 1006] });
  });
});

describe("Role Watch card and export gates", () => {
  const render = (input: RoleWatchInput) => {
    const result = buildRoleWatch(input), snapshot = { schemaVersion: 1 as const, id: "x", post: "role-watch", state: result.state, reasons: [], generatedAt: "2026-10-31T16:00:00Z", expiresAt: null, timeZone: "America/New_York" as const, settings: input.settings, evidence: result.evidence, data: result.data, teams: [], fixture: true };
    return { html: renderToStaticMarkup(createElement(RoleWatchCard, { snapshot, data: result.data!, settings: input.settings, logos: {} })), snapshot, result };
  };
  const appearances = games(1, 12, index => index >= 7 ? 1200 : 1080, index => index >= 7 ? 150 : 90);
  it("prints units, samples, role and the observed-opportunity copy, with no forecast wording", () => {
    const { html, snapshot, result } = render(base({ appearances, evidence: { rolling: [], pp: [{ gameId: 1011, playerId: 2, unit: 1 }] } }));
    for (const text of ["20:00 vs 18:00 BASE", "+2:00", "5 vs 7 GP", "Before", "Latest", "Line unknown · PP unknown", "Line unknown · Off PP", ROLE_WATCH_COPY, "TOI per game, all situations", "1:00+ change", "TOI/G", "PP TOI", "2:30"]) expect(html).toContain(text);
    expect(html).toContain('data-sparkline="1080,1080,1080,1080,1080,1200,1200,1200,1200,1200"');
    expect(html).toContain('data-recent-from="5"');
    expect([...html.matchAll(/<text[^>]*data-axis="value"[^>]*>([^<]*)</g)].map(mark => mark[1]).slice(0, 2)).toEqual(["20:00", "18:00"]);
    const pp = render(base({ appearances, settings: { ...settings, board: "pp" } })).html;
    for (const text of ["PP TOI per game, power play", "0:30+ change", "PP TOI/G", "+1:00"]) expect(pp).toContain(text);
    const alt = roleWatchModule.altText(snapshot, result.data!, settings);
    expect(alt).toContain(ROLE_WATCH_COPY);
    const claims = `${html} ${alt}`.replaceAll(ROLE_WATCH_COPY, "");
    expect(claims).not.toMatch(/forecast|project|predict|expect|will |breakout|likely/i);
  });
  it("colours the change tile by direction and scales it, on side-by-side boards", () => {
    const { html } = render(base({ appearances: [...games(1, 12, index => index >= 7 ? 1200 : 1000), ...games(2, 12, index => index >= 7 ? 900 : 1000)] }));
    const up = html.slice(html.indexOf('data-testid="board-up"'), html.indexOf('data-testid="board-down"')), down = html.slice(html.indexOf('data-testid="board-down"'));
    expect(up).toContain('data-tone="better"');
    expect(up).toContain('data-alpha="0.8"');
    expect(up).toContain("+3:20");
    expect(down).toContain('data-tone="worse"');
    expect(down).toContain('data-alpha="0.5"');
    expect(down).toContain("−1:40");
  });
  it("leaves a gap for a missing game in the line, and prints an unknown other measure as a dash, never 0", () => {
    const result = buildRoleWatch(base({ appearances: games(1, 12, index => index >= 7 ? 1200 : 1000, index => index === 2 ? null : 100) }));
    const row = result.data!.risers[0];
    expect(row.pp).toMatchObject({ recentSeconds: 100, baselineSeconds: null, changeSeconds: null });
    const series = row.series.map((point, index) => index === 3 ? { ...point, value: null } : point);
    const data = { ...result.data!, risers: [{ ...row, series }] };
    const snapshot = { schemaVersion: 1 as const, id: "x", post: "role-watch", state: result.state, reasons: [], generatedAt: "2026-10-31T16:00:00Z", expiresAt: null, timeZone: "America/New_York" as const, settings, evidence: result.evidence, data, teams: [], fixture: true };
    const html = renderToStaticMarkup(createElement(RoleWatchCard, { snapshot, data, settings, logos: {} }));
    expect(html).toContain('data-sparkline="1000,1000,1000,gap,1000,1200,1200,1200,1200,1200"');
    expect(html).toContain("data-gap");
    expect(html).toContain('data-metric="PP TOI" data-direction="none"');
    expect(html).toContain("1:40</b><i>—</i>");
  });
  it("marks a traded player on the card and names the teams in the evidence", () => {
    const traded = appearances.map((game, index) => ({ ...game, team: index >= 9 ? "NYR" : "NJD" }));
    const { html, snapshot } = render(base({ appearances: traded }));
    expect(html).toContain("† new team");
    expect(snapshot.evidence.sample).toContain("New team: Skater 1 NJD to NYR, 3 of 5 recent games");
  });
  it("is empty, and not exportable, when nothing meets the minimums", () => {
    const { html, result } = render(base({ appearances: games(1, 12, () => 1000) }));
    expect(html).toContain("No TOI change meets the minimums");
    expect(roleWatchModule.hasRows(result.data!, settings)).toBe(false);
    expect(roleWatchModule.hasRows(buildRoleWatch(base({ appearances })).data!, settings)).toBe(true);
  });
});

describe("Role Watch read plan", () => {
  it("reads role context bounded to shown ids at strength all, and skips it with nothing to show", async () => {
    const asked: { table: string; calls: unknown[][] }[] = [];
    const skater = (date: string, game_id: number, toi: number) => ({ player_id: 1, player_name: "Skater 1", position_code: "C", date, season_id: 20262027, game_id, team_abbrev: "NJD", opponent_team_abbrev: "NYR", home_road: "H", games_played: 1, goals: 0, assists: 0, points: 0, shots: 1, hits: 0, blocked_shots: 0, pp_points: 0, toi_per_game: toi, pp_toi: 0, penalty_minutes: 0 });
    const client = (rows: unknown[]) => ({ from: (table: string) => {
      const entry = { table, calls: [] as unknown[][] }; asked.push(entry);
      const builder: Record<string, unknown> = {};
      for (const method of ["select", "eq", "gte", "lte", "order", "in"]) builder[method] = (...args: unknown[]) => { entry.calls.push([method, ...args]); return builder; };
      const data = table === "wgo_skater_stats" ? rows : [];
      builder.range = () => Promise.resolve({ data, error: null, count: data.length });
      return builder;
    } });
    const rows = Array.from({ length: 10 }, (_, index) => skater(dateOf(index), 1000 + index, index >= 5 ? 1200 : 1000));
    await loadRoleWatch({ client: client(rows), generatedAt: "2026-10-31T16:00:00Z" }, settings);
    const rolling = asked.find(entry => entry.table === "rolling_player_game_metrics")!;
    expect(rolling.calls).toContainEqual(["eq", "strength_state", "all"]);
    expect(rolling.calls).toContainEqual(["in", "player_id", [1]]);
    expect(rolling.calls).toContainEqual(["in", "game_id", [1009, 1004]]);
    expect(asked.find(entry => entry.table === "powerPlayCombinations")!.calls).toContainEqual(["in", "gameId", [1009, 1004]]);
    asked.length = 0;
    await loadRoleWatch({ client: client([]), generatedAt: "2026-10-31T16:00:00Z" }, settings);
    expect(asked.map(entry => entry.table)).toEqual(["wgo_skater_stats", "wgo_team_stats", "games"]);
  });
});
