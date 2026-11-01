import { describe, expect, it } from "vitest";
import { parseShareSettings, sharePostExportBlock, type SharePostSnapshot } from "./contract";
import { buildLastNightsStandouts, goalieRanking, goalLine, lastNightsStandoutsModule, latestEarlierLines, lineChipText, lineRowsFromCombinations, parsePicks, ppContradicted, percentChange, percentLabel, ppChipText, rankingText, slateCoverage, sortStandouts, STANDOUT_MAX_ROWS, standoutPool, standoutRows, statText, togglePick, type LastNightsStandoutsData, type LastNightsStandoutsInput, type LastNightsStandoutsSettings, type StandoutSkater } from "./lastNightsStandouts";
import { loadLastNightsStandouts } from "./lastNightsStandouts.sources";
import { ownershipOf } from "./shared/definitions";
import type { GoalieAppearance } from "./shared/goalieLedger";
import type { SkaterAppearance } from "./shared/skaterAppearances";

const SLATE = "2026-10-31", SEASON = 20262027;
const defaults = parseShareSettings(lastNightsStandoutsModule, {}) as LastNightsStandoutsSettings;
const settings = (over: Partial<LastNightsStandoutsSettings> = {}): LastNightsStandoutsSettings => ({ ...defaults, ...over });
const game = (playerId: number, date: string, gameId: number, over: Partial<SkaterAppearance> = {}): SkaterAppearance => ({
  playerId, name: `Fictional ${playerId}`, position: "C", group: "F", gameId, date, team: "NJD", opponent: "NYR", home: true,
  goals: 0, assists: 0, points: 0, shots: 2, hits: 1, blocks: 1, ppPoints: 0, toiSeconds: 1000, ppToiSeconds: 100, penaltyMinutes: 0, ...over,
});
const counts = (playerId: number, date: string, ixg: number | null = 0.5) => ({ player_id: playerId, date_scraped: date, season: SEASON, ixg, iscfs: 2, icf: 4 });
const onIce = (playerId: number, date: string, xgf = 1, xga = 1) => ({ player_id: playerId, date_scraped: date, season: SEASON, xgf, xga });
const shared = (over: Partial<LastNightsStandoutsInput> = {}): LastNightsStandoutsInput => ({ slate: SLATE, season: SEASON, settings: settings(), completedTeamGames: [{ gameId: 9 }, { gameId: 9 }], scheduledGameIds: [9], ownership: { byPlayer: new Map(), updatedAt: null }, ...over });
const stat = (row: StandoutSkater, id: StandoutSkater["stats"][number]["id"]) => row.stats.find(entry => entry.id === id)!;

/** One skater: three earlier games at 2 SOG, then 6 SOG on the slate. */
const season = (shots = 6) => [game(1, "2026-10-20", 1), game(1, "2026-10-22", 2), game(1, "2026-10-24", 3), game(1, SLATE, 9, { shots, goals: 1, assists: 2, points: 3, ppPoints: 2 })];
const nstFor = (dates: readonly string[]) => ({ nstCounts: dates.map(date => counts(1, date)), nstOnIce: dates.map(date => onIce(1, date)) });
const DATES = ["2026-10-20", "2026-10-22", "2026-10-24", SLATE];
const built = (over: Partial<LastNightsStandoutsInput> = {}) => buildLastNightsStandouts(shared({ appearances: season(), ...nstFor(DATES), ...over }));
const dataOf = (over: Partial<LastNightsStandoutsInput> = {}) => built(over).data!;
const person = (over: Partial<StandoutSkater> & { playerId: number }): StandoutSkater => {
  const { stats } = dataOf().skaters[0];
  return { ...dataOf().skaters[0], ...over, stats: stats.map(entry => ({ ...entry })) };
};
const withStat = (row: StandoutSkater, id: StandoutSkater["stats"][number]["id"], last: number | null, change: number | null) => ({ ...row, stats: row.stats.map(entry => entry.id === id ? { ...entry, last, change } : entry) });

describe("Last Nights Standouts baseline", () => {
  it("excludes last night from the season per game", () => {
    const row = dataOf().skaters[0], sog = stat(row, "sog");
    expect(row.priorGames).toBe(3);
    expect(sog.last).toBe(6);
    // 2 per game before the slate. With last night in it, the baseline would be 3 and the change +100%.
    expect(sog.baseline).toBe(2);
    expect(sog.change).toBe(200);
  });
  it("gives a zero baseline no percent, and prints a dash", () => {
    const appearances = season().map(row => row.date === SLATE ? row : { ...row, ppToiSeconds: 0 });
    const pp = stat(dataOf({ appearances }).skaters[0], "ppToi");
    expect(pp.baseline).toBe(0);
    expect(pp.change).toBeNull();
    expect(percentLabel(pp.change)).toBe("—");
    expect(percentChange(5, 0)).toBeNull();
  });
  it("gives a missing baseline or a debut no percent", () => {
    expect(stat(dataOf({ appearances: [game(1, SLATE, 9)], ...nstFor([SLATE]) }).skaters[0], "sog").change).toBeNull();
    const twoPrior = season().slice(1);
    expect(stat(dataOf({ appearances: twoPrior }).skaters[0], "sog").change).toBeNull();
    const gap = season().map(row => row.gameId === 2 ? { ...row, shots: null } : row);
    expect(stat(dataOf({ appearances: gap }).skaters[0], "sog").baseline).toBeNull();
  });
  it("admits an NST baseline only at the post's coverage, and keeps last night's value", () => {
    const row = dataOf({ nstCounts: [counts(1, DATES[0]), counts(1, SLATE)] }).skaters[0];
    expect(stat(row, "xg").last).toBe(0.5);
    expect(stat(row, "xg").baseline).toBeNull();
    expect(stat(row, "xg").change).toBeNull();
  });
  it("prints a missing NST value as a dash, never zero", () => {
    const row = dataOf({ nstCounts: DATES.slice(0, 3).map(date => counts(1, date)), nstOnIce: DATES.slice(0, 3).map(date => onIce(1, date)) }).skaters[0];
    expect(stat(row, "icf").last).toBeNull();
    expect(statText(stat(row, "icf"))).toBe("—");
    expect(percentLabel(stat(row, "icf").change)).toBe("—");
  });
  it("pools xG% across prior games and compares it as a percent change", () => {
    const row = dataOf({ nstOnIce: [onIce(1, DATES[0], 3, 1), onIce(1, DATES[1], 1, 3), onIce(1, DATES[2], 2, 2), onIce(1, SLATE, 3, 1)] }).skaters[0], share = stat(row, "xgPct");
    expect(share.baseline).toBe(50);
    expect(share.last).toBe(75);
    expect(share.change).toBe(50);
  });
  it("labels changes with a sign and rounds to whole percents", () => {
    expect(percentLabel(59.6)).toBe("+60%");
    expect(percentLabel(-20.4)).toBe("−20%");
    expect(percentLabel(0.2)).toBe("0%");
  });
});

describe("goal line", () => {
  it("prints exactly 1G-2A-3P-2PPP, with PPP only above zero", () => {
    expect(goalLine({ goals: 1, assists: 2, points: 3, ppPoints: 2 })).toBe("1G-2A-3P-2PPP");
    expect(goalLine({ goals: 1, assists: 2, points: 3, ppPoints: 0 })).toBe("1G-2A-3P");
    expect(goalLine({ goals: 1, assists: 2, points: 3, ppPoints: null })).toBe("1G-2A-3P");
    expect(goalLine({ goals: 0, assists: 0, points: 0, ppPoints: 0 })).toBe("0G-0A-0P");
    expect(goalLine({ goals: null, assists: 2, points: 3, ppPoints: 0 })).toBe("—");
  });
  it("reaches the row, with line and PP context", () => {
    const row = dataOf({ role: { rolling: [{ player_id: 1, game_id: 9, line_combo_slot: 2, line_combo_group: "forward" }], pp: [{ gameId: 9, playerId: 1, unit: 1 }] } }).skaters[0];
    expect(row.goalLine).toBe("1G-2A-3P-2PPP");
    expect(row.role).toEqual({ line: "L2", pp: 1 });
    expect(dataOf().skaters[0].role).toEqual({ line: "unknown", pp: "unknown" });
  });
});

describe("PP chip against NHL.com time", () => {
  it("flags Off PP above 1:00 and PP1 or PP2 under 0:30, each boundary allowed", () => {
    expect(ppContradicted("off", 61)).toBe(true);
    expect(ppContradicted("off", 60)).toBe(false);
    expect(ppContradicted(1, 29)).toBe(true);
    expect(ppContradicted(2, 29)).toBe(true);
    expect(ppContradicted(1, 30)).toBe(false);
    expect(ppContradicted(2, 0)).toBe(true);
  });
  it("never flags an unknown unit or an unknown time", () => {
    expect(ppContradicted("unknown", 200)).toBe(false);
    expect(ppContradicted("off", null)).toBe(false);
    expect(ppContradicted(1, null)).toBe(false);
  });
  const withUnit = (unit: number | null, ppToiSeconds: number, others: object[] = []) => dataOf({ appearances: season().map(row => row.date === SLATE ? { ...row, ppToiSeconds } : row), role: { rolling: [], pp: [...(unit === null ? [] : [{ gameId: 9, playerId: 1, unit }]), ...others] as { gameId: number; playerId: number; unit: number }[] } }).skaters[0];
  const teammate = { gameId: 9, playerId: 2, unit: 1 };
  it("prints a contradicted unit as unknown and says why, never swapping in another unit", () => {
    const off = withUnit(3, 174);
    expect(off.role.pp).toBe("unknown");
    expect(off.ppConflict).toBe(true);
    expect(ppChipText(off.role)).toBe("PP —");
    expect(ppChipText(withUnit(1, 3).role)).toBe("PP —");
  });
  it("keeps a unit the time agrees with, and a truthful Off PP", () => {
    expect(withUnit(1, 174)).toMatchObject({ role: { pp: 1 }, ppConflict: false });
    expect(withUnit(3, 12)).toMatchObject({ role: { pp: "off" }, ppConflict: false });
    expect(withUnit(null, 0, [teammate])).toMatchObject({ role: { pp: "off" }, ppConflict: false });
  });
  it("counts conflicts apart from games with no rows", () => {
    const { evidence } = built({ appearances: season().map(row => row.date === SLATE ? { ...row, ppToiSeconds: 174 } : row), role: { rolling: [], pp: [{ gameId: 9, playerId: 1, unit: 3 }] } });
    expect(evidence.sources.find(source => source.name === "FHFH lines and PP units")?.reasons?.join(" ")).toContain("1 because NHL.com PP time contradicts the unit, 0 with no rows");
  });
});

describe("lines", () => {
  it("reads forwards in threes and defensemen in pairs from the game's own row", () => {
    const rows = lineRowsFromCombinations([{ gameId: 9, forwards: [1, 2, 3, 4], defensemen: [5, 6, 7] }]);
    expect(rows.map(row => [row.player_id, row.line_combo_group, row.line_combo_slot])).toEqual([[1, "forward", 1], [2, "forward", 1], [3, "forward", 1], [4, "forward", 2], [5, "defense", 1], [6, "defense", 1], [7, "defense", 2]]);
    expect(lineRowsFromCombinations([{ gameId: 9, forwards: null, defensemen: null }])).toEqual([]);
  });
  const older = (date: string, slot: number | null) => ({ player_id: 1, game_date: date, line_combo_slot: slot, line_combo_group: "forward" });
  it("keeps last night's line undated, even with an older one known", () => {
    const row = dataOf({ role: { rolling: [{ player_id: 1, game_id: 9, line_combo_slot: 1, line_combo_group: "forward" }], pp: [] }, earlierLines: [older("2026-10-24", 3)] }).skaters[0];
    expect(row.role.line).toBe("L1");
    expect(row.lineAsOf).toBeNull();
    expect(lineChipText(row)).toBe("L1");
  });
  it("uses the newest earlier line when last night's is absent, and prints its date", () => {
    const row = dataOf({ earlierLines: [older("2026-10-20", 3), older("2026-10-24", 2), older("2026-10-22", 1)] }).skaters[0];
    expect(row.role.line).toBe("L2");
    expect(row.lineAsOf).toBe("2026-10-24");
    expect(lineChipText(row)).toBe("L2 · Oct 24");
  });
  it("never takes a line from the slate or later as an earlier one, and never guesses", () => {
    expect(latestEarlierLines([older(SLATE, 1), older("2026-11-02", 1), older("2026-10-24", null)], SLATE).size).toBe(0);
    const row = dataOf({ earlierLines: [] }).skaters[0];
    expect(lineChipText(row)).toBe("Line —");
    expect(built({ earlierLines: [older("2026-10-24", 2)] }).evidence.sources.find(source => source.name === "FHFH lines and PP units")?.reasons?.join(" ")).toContain("1 of 1 lines are from an earlier game");
  });
});

describe("picks", () => {
  const data: LastNightsStandoutsData = { ...dataOf(), skaters: [person({ playerId: 1 }), person({ playerId: 2 }), person({ playerId: 3 })] };
  it("follows pick order, not sort order, and drops an id not on the slate", () => {
    expect(standoutRows(data, settings({ view: "all", picks: "3,1,99" })).map(row => row.playerId)).toEqual([3, 1]);
    expect(parsePicks("3, 1,3,abc,,2")).toEqual([3, 1, 2]);
  });
  it("adds at the end, removes in place, and refuses past the card's limit", () => {
    expect(togglePick("", 5)).toBe("5");
    expect(togglePick("5,6", 7)).toBe("5,6,7");
    expect(togglePick("5,6,7", 6)).toBe("5,7");
    const full = Array.from({ length: STANDOUT_MAX_ROWS }, (_, index) => index + 1).join(",");
    expect(togglePick(full, 99)).toBe(full);
    expect(togglePick(full, 1).split(",")).toHaveLength(STANDOUT_MAX_ROWS - 1);
  });
  it("keeps a full card within the picks field's length", () => {
    const longest = Array.from({ length: STANDOUT_MAX_ROWS }, (_, index) => 8400000 + index).join(",");
    expect(() => parseShareSettings(lastNightsStandoutsModule, { view: "all", picks: longest })).not.toThrow();
  });
  it("never sends picks or the roster limit to the server", () => {
    const fields = lastNightsStandoutsModule.fields.filter(field => field.clientOnly).map(field => field.id);
    expect(fields).toEqual(expect.arrayContaining(["picks", "rosterMax"]));
    expect(lastNightsStandoutsModule.fields.find(field => field.id === "picks")?.panelOnly).toBe(true);
  });
});

describe("blank state", () => {
  const snapshot = (data: LastNightsStandoutsData, active: LastNightsStandoutsSettings, generatedAt = new Date().toISOString()): SharePostSnapshot => ({ schemaVersion: 1, id: "e", post: "last-nights-standouts", state: "ready", reasons: [], generatedAt, expiresAt: new Date(Date.now() + 60000).toISOString(), timeZone: "America/New_York", settings: active, evidence: built().evidence, data, teams: [], fixture: false });
  it.each(["under", "all"] as const)("blocks the %s view until a pick exists", view => {
    const data = dataOf({ settings: settings({ view }), ownership: { byPlayer: new Map([[1, ownershipOf(10)]]), updatedAt: null } }), blank = settings({ view });
    expect(lastNightsStandoutsModule.hasRows(data, blank)).toBe(false);
    expect(sharePostExportBlock(lastNightsStandoutsModule, snapshot(data, blank), blank)).toBe("Nothing qualifies with these settings.");
    const picked = settings({ view, picks: "1" });
    expect(lastNightsStandoutsModule.hasRows(data, picked)).toBe(true);
    expect(sharePostExportBlock(lastNightsStandoutsModule, snapshot(data, blank), picked)).toBeNull();
  });
  it("needs no picks for an auto-ranked view", () => {
    const active = settings({ view: "forwards" });
    expect(lastNightsStandoutsModule.hasRows(dataOf({ settings: active }), active)).toBe(true);
  });
  it("blocks a card built under other server settings", () => {
    const data = dataOf({ settings: settings({ view: "all" }) });
    expect(lastNightsStandoutsModule.hasRows(data, settings({ view: "all", minPriorGp: 5, picks: "1" }))).toBe(false);
  });
});

describe("roster boundary", () => {
  const owned = (id: number, pct: number | null) => person({ playerId: id, ownership: ownershipOf(pct) });
  const data = { skaters: [owned(1, 49.9), owned(2, 50), owned(3, 50.1), owned(4, null)] };
  it("is strictly under X, and an unknown rostered % stays out", () => {
    expect(standoutPool(data, { view: "under", rosterMax: 50 }).map(row => row.playerId)).toEqual([1]);
    expect(standoutPool(data, { view: "under", rosterMax: 51 }).map(row => row.playerId)).toEqual([1, 2, 3]);
  });
  it("has no limit in the second view, and takes a pick off the card when X drops below it", () => {
    expect(standoutPool(data, { view: "all", rosterMax: 50 })).toHaveLength(4);
    const full = { ...dataOf(), skaters: data.skaters };
    expect(standoutRows(full, settings({ view: "under", rosterMax: 50, picks: "2,1" })).map(row => row.playerId)).toEqual([1]);
    expect(standoutRows(full, settings({ view: "all", rosterMax: 50, picks: "2,4" })).map(row => row.playerId)).toEqual([2, 4]);
  });
});

describe("sorting and auto-ranked views", () => {
  const base = person({ playerId: 1 });
  const a = { ...withStat(base, "sog", 3, 200), playerId: 10, points: 2 }, b = { ...withStat(base, "sog", 7, 40), playerId: 11, points: 1 }, c = { ...withStat(base, "sog", null, null), playerId: 12, points: 4 };
  it("sorts by the night's value or by the jump, with missing values last", () => {
    expect(sortStandouts([a, b, c], "sog", "value").map(row => row.playerId)).toEqual([11, 10, 12]);
    expect(sortStandouts([a, b, c], "sog", "jump").map(row => row.playerId)).toEqual([10, 11, 12]);
  });
  it("ranks forwards and defensemen apart, by points by default", () => {
    const d = { ...c, playerId: 13, group: "D" as const };
    const data = { ...dataOf(), skaters: [a, b, c, d] };
    expect(standoutRows(data, settings({ view: "forwards" })).map(row => row.playerId)).toEqual([12, 10, 11]);
    expect(standoutRows(data, settings({ view: "defensemen" })).map(row => row.playerId)).toEqual([13]);
    expect(standoutRows(data, settings({ view: "forwards", rankBy: "sog" })).map(row => row.playerId)).toEqual([11, 10, 12]);
  });
  it("states the ranking with each key once", () => {
    expect(rankingText("points")).toBe("points, then SOG, xG, TOI");
    expect(rankingText("sog")).toBe("SOG, then points, xG, TOI");
    expect(rankingText("iscf")).toBe("iSCF, then points, SOG, xG, TOI");
  });
  it("names the goalie view in the kicker", () => {
    expect(lastNightsStandoutsModule.kicker?.(settings({ view: "goalies" }))).toBe("Goalies");
    expect(lastNightsStandoutsModule.kicker?.(settings({ view: "forwards" }))).toBe("Skaters");
  });
  it("holds to the card's limit", () => {
    const many = Array.from({ length: STANDOUT_MAX_ROWS + 4 }, (_, index) => ({ ...a, playerId: 100 + index }));
    expect(standoutRows({ ...dataOf(), skaters: many }, settings({ view: "forwards" }))).toHaveLength(STANDOUT_MAX_ROWS);
  });
});

describe("goalies", () => {
  const goalie = (goalieId: number, saves: number | null, shotsAgainst: number | null, goalsAgainst = 1): GoalieAppearance => ({ goalieId, name: `Fictional Goalie ${goalieId}`, gameId: 9, date: SLATE, team: "NJD", opponent: "NYR", home: true, started: true, wins: 1, losses: 0, otLosses: 0, saves, shotsAgainst, goalsAgainst, toiSeconds: 3600, shutouts: 0, qualityStart: 1 });
  const nstRow = (playerId: number, xg: number, ga: number, date = SLATE) => ({ player_id: playerId, player_name: "Fictional", date_scraped: date, season: SEASON, toi: 60, xg_against: xg, goals_against: ga, shots_against: 30 });
  const active = settings({ view: "goalies" });
  it("computes GSAx from NST for that slate only, and leaves a lagging row missing", () => {
    const result = buildLastNightsStandouts(shared({ settings: active, goalies: [goalie(1, 29, 30), goalie(2, 19, 20)], nstGoalies: [nstRow(1, 3.25, 1), nstRow(2, 9, 1, "2026-10-30")] }));
    const [first, second] = result.data!.goalies;
    expect(first.gsax).toBe(2.25);
    expect(second.gsax).toBeNull();
    expect(result.state).toBe("ready");
    expect(result.evidence.sources.find(source => source.name === "Natural Stat Trick")?.state).toBe("partial");
    expect(result.evidence.cohort).toBe("2 goalies on the slate, 1 with NST GSAx");
  });
  it("ranks by SV% over the shots minimum, then saves", () => {
    const { data } = buildLastNightsStandouts(shared({ settings: active, goalies: [goalie(1, 29, 30), goalie(2, 19, 20), goalie(3, 5, 5, 0), goalie(4, 38, 40), goalie(5, null, null)] }));
    const ranking = goalieRanking(data!, { minShotsAgainst: 15 });
    expect(ranking.rows.map(row => row.goalieId)).toEqual([1, 4, 2]);
    expect(ranking.qualified).toBe(3);
  });
});

describe("slate coverage and evidence", () => {
  it("is partial when a scheduled game has no result or no player rows", () => {
    expect(slateCoverage({ playerGameIds: [9], completedTeamGames: [{ gameId: 9 }, { gameId: 9 }], scheduledGameIds: [9] }).reasons).toEqual([]);
    const short = slateCoverage({ playerGameIds: [9], completedTeamGames: [{ gameId: 9 }, { gameId: 9 }], scheduledGameIds: [9, 10] });
    expect(short).toMatchObject({ observed: 2, expected: 4, missing: 2 });
    expect(short.reasons).toHaveLength(2);
    expect(built({ scheduledGameIds: [9, 10] }).state).toBe("partial");
  });
  it("says last night is excluded and uses no forecast wording", () => {
    const { evidence } = built();
    expect(evidence.sample).toContain("last night excluded");
    expect(`${evidence.sample} ${evidence.cohort}`).not.toMatch(/forecast|project|expect|monstrous/i);
    expect(lastNightsStandoutsModule.basis).toBe("observed");
  });
  it("does not mark the slate partial for line slots that are not written yet", () => {
    const { state, evidence } = built();
    expect(state).toBe("ready");
    expect(evidence.sources.find(source => source.name === "FHFH lines and PP units")?.state).toBe("partial");
  });
});

describe("loader", () => {
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
  const row = (playerId: number, gameId: number, date: string) => ({ player_id: playerId, player_name: `Fictional ${playerId}`, position_code: "D", date, season_id: SEASON, game_id: gameId, team_abbrev: "NJD", opponent_team_abbrev: "NYR", home_road: "H", games_played: 1, goals: 1, assists: 0, points: 1, shots: 3, hits: 1, blocked_shots: 1, pp_points: 0, toi_per_game: 1200, pp_toi: 60, penalty_minutes: 0 });
  const context = (tables: Record<string, unknown[]>) => { const fake = fakeClient(tables); return { fake, context: { client: fake.client, generatedAt: "2026-11-01T14:00:00Z" } }; };
  it("reads the newest slate, then the season for those players only", async () => {
    const { fake, context: ctx } = context({ wgo_skater_stats: [row(1, 9, SLATE)], games: [{ id: 9 }], wgo_team_stats: [], nst_gamelog_as_counts: [counts(1, SLATE)], nst_gamelog_as_counts_oi: [onIce(1, SLATE)], lineCombinations: [{ gameId: 9, forwards: [], defensemen: [1] }], powerPlayCombinations: [], yahoo_players: [], yahoo_nhl_player_map_read: [] });
    const result = await loadLastNightsStandouts(ctx, settings({ view: "defensemen" }));
    expect(result.data?.slate).toBe(SLATE);
    expect(result.data?.skaters.map(skater => skater.playerId)).toEqual([1]);
    const nst = fake.calls.find(call => call.table === "nst_gamelog_as_counts")!;
    expect(nst.filters).toContainEqual(["in", "player_id", [1]]);
    expect(fake.calls.some(call => call.table === "wgo_goalie_stats")).toBe(false);
    // Everyone has last night's line, so the slow rolling table is not read.
    expect(fake.calls.some(call => call.table === "rolling_player_game_metrics")).toBe(false);
    expect(result.data?.skaters[0].role.line).toBe("P1");
  });
  const skaterTables = { wgo_skater_stats: [row(1, 9, SLATE)], games: [{ id: 9 }], wgo_team_stats: [], nst_gamelog_as_counts: [], nst_gamelog_as_counts_oi: [], lineCombinations: [], powerPlayCombinations: [], yahoo_players: [], yahoo_nhl_player_map_read: [] };
  /** Answers rolling from a queue of results; every other table comes from the fake. */
  function withRolling(results: object[]) {
    const { fake } = context(skaterTables);
    let reads = 0;
    const client = { from(table: string) {
      if (table !== "rolling_player_game_metrics") return fake.client.from(table);
      const chain: any = { then: (resolve: (value: unknown) => void) => resolve(results[Math.min(reads++, results.length - 1)]) };
      for (const method of ["select", "eq", "lte", "in", "not", "order", "range"]) chain[method] = () => chain;
      return chain;
    } };
    return { reads: () => reads, ctx: { client, generatedAt: "2026-11-01T14:00:00Z" } };
  }
  const timedOut = { data: null, error: { code: "57014", message: "statement timeout" }, count: null };
  it("retries rolling once after a statement timeout", async () => {
    const line = { player_id: 1, game_date: "2026-10-24", line_combo_slot: 2, line_combo_group: "defense" };
    const { ctx, reads } = withRolling([timedOut, { data: [line], error: null, count: 1 }]);
    const result = await loadLastNightsStandouts(ctx, settings({ view: "defensemen" }));
    expect(reads()).toBe(2);
    expect(result.data?.skaters[0]).toMatchObject({ role: { line: "P2" }, lineAsOf: "2026-10-24" });
  });
  it("keeps the post when rolling keeps failing, with the line unknown", async () => {
    const { ctx, reads } = withRolling([timedOut, timedOut]);
    const result = await loadLastNightsStandouts(ctx, settings({ view: "defensemen" }));
    expect(reads()).toBe(2);
    expect(result.data?.skaters[0].role.line).toBe("unknown");
  });
  it("reads only goalie tables for the goalie view's players", async () => {
    const { fake, context: ctx } = context({ wgo_skater_stats: [row(1, 9, SLATE)], games: [{ id: 9 }], wgo_team_stats: [], wgo_goalie_stats: [], nst_gamelog_goalie_all_counts: [], yahoo_players: [], yahoo_nhl_player_map_read: [] });
    const result = await loadLastNightsStandouts(ctx, settings({ view: "goalies" }));
    expect(result.data?.goalies).toEqual([]);
    expect(fake.calls.some(call => call.table === "nst_gamelog_as_counts")).toBe(false);
    expect(fake.calls.find(call => call.table === "nst_gamelog_goalie_all_counts")!.filters).toContainEqual(["eq", "date_scraped", SLATE]);
  });
  it("is missing, not empty, before the season's first slate", async () => {
    const { context: ctx } = context({ wgo_skater_stats: [] });
    const result = await loadLastNightsStandouts(ctx, settings());
    expect(result.state).toBe("missing");
    expect(result.data).toBeNull();
  });
});
