import { describe, expect, it } from "vitest";
import { parseShareSettings, sharePostExportBlock, type SharePostSnapshot } from "./contract";
import { averageChange, buildLastNightsStandouts, goalieChangeText, goalieLastText, goalieRank, goalieRanking, goalieRankingText, goalieStdText, goalieTone, goalLine, isOlderSlate, lastNightsStandoutsModule, latestEarlierLines, scheduledTeamGames, slateWord, standoutsCurrent, standoutsHeadline, lineChipText, lineRowsFromCombinations, parsePicks, ppContradicted, percentChange, percentLabel, ppChipText, rankingText, slateCoverage, sortStandouts, STANDOUT_AVERAGE_FLOORS, STANDOUT_AVERAGE_RULE, STANDOUT_GOALIE_ROWS, STANDOUT_MAX_ROWS, standoutPool, standoutRows, statText, stdText, togglePick, type GoalieStat, type LastNightsStandoutsData, type LastNightsStandoutsInput, type LastNightsStandoutsSettings, type StandoutGoalie, type StandoutSkater } from "./lastNightsStandouts";
import { FALLBACK_NIGHTS, loadLastNightsStandouts } from "./lastNightsStandouts.sources";
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
const shared = (over: Partial<LastNightsStandoutsInput> = {}): LastNightsStandoutsInput => ({ slate: SLATE, season: SEASON, settings: settings(), scheduledTeamGames: [{ gameId: 9, team: "NJD" }, { gameId: 9, team: "NJD" }], scheduledGameIds: [9], ownership: { byPlayer: new Map(), updatedAt: null }, ...over });
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

describe("STD on every chip", () => {
  it("is the per-game value without last night, and it is the base of the %", () => {
    const sog = stat(dataOf().skaters[0], "sog");
    expect(stdText(sog)).toBe("2.0");
    expect(statText(sog)).toBe("6");
    expect(percentLabel(sog.change)).toBe("+200%");
  });
  it("prints each stat in its own form, and a dash with no baseline", () => {
    const row = dataOf().skaters[0];
    expect(stdText(stat(row, "toi"))).toBe("16:40");
    expect(stdText(stat(row, "xg"))).toBe("0.50");
    expect(stdText(stat(row, "xgPct"))).toBe("50.0%");
    expect(stdText(stat(row, "icf"))).toBe("4.0");
    expect(stdText({ id: "sog", baseline: null })).toBe("—");
  });
});

describe("average % change", () => {
  const IDS = ["sog", "toi", "icf", "iscf", "xg", "xgPct", "ppToi"] as const;
  /** Baselines well above every floor unless a test sets one. */
  const changes = (...values: (number | null)[]) => values.map((change, index) => ({ id: IDS[index], baseline: 1000, change }));
  it("is the mean across the stats that have a change", () => {
    expect(averageChange(changes(10, 20, 30, 40, null, null, null))).toBe(25);
  });
  it("needs 4 of the 7 stats", () => {
    expect(averageChange(changes(10, 20, 30, null, null, null, null))).toBeNull();
    expect(averageChange(changes(10, 20, 30, 0, null, null, null))).toBe(15);
    expect(STANDOUT_AVERAGE_RULE).toContain("at least 4 of 7 left");
  });
  it("caps each stat at 200% either way", () => {
    expect(averageChange(changes(5000, 0, 0, 0))).toBe(50);
    expect(averageChange(changes(-5000, 0, 0, 0))).toBe(-50);
  });
  it.each([["sog", 0.75], ["toi", 600], ["icf", 2], ["iscf", 0.75], ["xg", 0.05], ["xgPct", 35], ["ppToi", 30]] as const)("counts %s at its floor of %s and leaves it out just below", (id, floor) => {
    const others = IDS.filter(entry => entry !== id).slice(0, 4).map(entry => ({ id: entry, baseline: 1000, change: 0 }));
    expect(STANDOUT_AVERAGE_FLOORS[id]).toBe(floor);
    expect(averageChange([...others, { id, baseline: floor, change: 100 }])).toBe(20);
    expect(averageChange([...others, { id, baseline: floor - 0.001, change: 100 }])).toBe(0);
  });
  it("states every floor in the rule", () => {
    for (const text of ["SOG 0.75", "TOI 10:00", "iCF 2.0", "iSCF 0.75", "xG 0.05", "xG% 35.0%", "PPTOI 0:30"]) expect(STANDOUT_AVERAGE_RULE).toContain(text);
  });
  it("needs 4 stats after the floor, not before", () => {
    const stats = [{ id: "sog" as const, baseline: 2, change: 50 }, { id: "toi" as const, baseline: 900, change: 10 }, { id: "icf" as const, baseline: 4, change: 20 }, { id: "xg" as const, baseline: 0.01, change: 300 }, { id: "ppToi" as const, baseline: 5, change: 400 }];
    expect(stats.filter(stat => stat.change !== null)).toHaveLength(5);
    expect(averageChange(stats)).toBeNull();
    expect(averageChange([...stats, { id: "iscf" as const, baseline: 1, change: 40 }])).toBe(30);
  });
  const skater = (playerId: number, values: (number | null)[], baselines: Partial<Record<typeof IDS[number], number>> = {}) => {
    const base = person({ playerId });
    return { ...base, playerId, stats: base.stats.map((entry, index) => ({ ...entry, baseline: baselines[entry.id] ?? 1000, change: values[index] ?? null })) };
  };
  it("sorts a mostly negative player low, even with one big value and a big night by value", () => {
    const anderson = { ...skater(1, [-7, 4, -49, -23, -60, 4, -7]), points: 3 }, above = { ...skater(2, [30, 20, 40, 10, 25, 5, 0]), points: 0 }, thin = skater(3, [500, 500, null, null, null, null, null]);
    expect(sortStandouts([anderson, thin, above], "points", "average").map(row => row.playerId)).toEqual([2, 1, 3]);
    expect(sortStandouts([anderson, thin, above], "points", "value")[0].playerId).toBe(1);
  });
  it("drops a Carrick-style player whose jumps sit on tiny baselines, while the true % still prints", () => {
    const carrick = skater(1, [200, 5, 150, 150, 2000, 10, 300], { xg: 0.01, ppToi: 4, icf: 1, iscf: 0.4 }), steady = skater(2, [40, 10, 30, 30, 40, 10, 20]);
    expect(averageChange(carrick.stats.map(stat => ({ ...stat, baseline: 1000 })))).toBeGreaterThan(averageChange(steady.stats)!);
    // Only SOG, TOI and xG% clear their floors: three stats, so no average.
    expect(averageChange(carrick.stats)).toBeNull();
    expect(sortStandouts([carrick, steady], "points", "average").map(row => row.playerId)).toEqual([2, 1]);
    expect(percentLabel(carrick.stats.find(stat => stat.id === "xg")!.change)).toBe("+2000%");
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
  const goalie = (goalieId: number, saves: number | null, shotsAgainst: number | null, goalsAgainst: number | null = 1, date = SLATE, gameId = 9): GoalieAppearance => ({ goalieId, name: `Fictional Goalie ${goalieId}`, gameId, date, team: "NJD", opponent: "NYR", home: true, started: true, wins: 1, losses: 0, otLosses: 0, saves, shotsAgainst, goalsAgainst, toiSeconds: 3600, shutouts: 0, qualityStart: 1 });
  const nstRow = (playerId: number, xg: number, ga: number, date = SLATE) => ({ player_id: playerId, player_name: "Fictional", date_scraped: date, season: SEASON, toi: 60, xg_against: xg, goals_against: ga, shots_against: 30 });
  const active = settings({ view: "goalies" });
  const EARLIER = ["2026-10-20", "2026-10-22", "2026-10-24"];
  /** Three earlier games at 18 saves on 20 shots. */
  const season = (id: number) => EARLIER.map((date, index) => goalie(id, 18, 20, 2, date, index + 1));
  const statsOf = (over: Partial<LastNightsStandoutsInput>) => buildLastNightsStandouts(shared({ settings: active, ...over })).data!.goalies;
  const stat = (row: StandoutGoalie, id: GoalieStat["id"]) => row.stats.find(entry => entry.id === id)!;
  it("computes GSAx from NST for that slate only, and leaves a lagging row missing", () => {
    const result = buildLastNightsStandouts(shared({ settings: active, goalies: [goalie(1, 29, 30), goalie(2, 19, 20)], nstGoalies: [nstRow(1, 3.25, 1), nstRow(2, 9, 1, "2026-10-30")] }));
    const [first, second] = result.data!.goalies;
    expect(first.gsax).toBe(2.25);
    expect(second.gsax).toBeNull();
    expect(result.state).toBe("ready");
    expect(result.evidence.sources.find(source => source.name === "Natural Stat Trick")?.state).toBe("partial");
    expect(result.evidence.cohort).toBe("2 goalies on the slate, 1 with NST GSAx");
  });
  const rankingOf = (goalies: GoalieAppearance[], nstGoalies: ReturnType<typeof nstRow>[]) => goalieRanking(buildLastNightsStandouts(shared({ settings: active, goalies, nstGoalies })).data!, { minShotsAgainst: 15 });
  it("ranks known GSAx, and an unknown GSAx is unranked rather than worst", () => {
    const ranking = rankingOf([goalie(1, 29, 30), goalie(2, 19, 20), goalie(3, 5, 5, 0), goalie(4, 38, 40), goalie(5, 25, 26), goalie(6, null, null), goalie(7, 40, 41)], [nstRow(1, 0.5, 1), nstRow(2, 3, 1), nstRow(3, 9, 0), nstRow(7, 1, 4)]);
    // +2.00, -0.50, then -3.00 with a rank; goalies 4 and 5 have no row, so no rank, by SV%. Goalie 3 faced too few shots, however good.
    expect(ranking.rows.map(row => row.goalieId)).toEqual([2, 1, 7, 5, 4]);
    expect(ranking.rows.map(goalieRank)).toEqual([1, 2, 3, null, null]);
    expect(ranking).toMatchObject({ qualified: 5, ranked: 3, withoutGsax: 2 });
    expect(goalieRankingText(ranking, 15)).toEqual({ lead: "Top 3 of 3 by GSAx, with 15+ shots against.", note: "2 of 5 qualified goalies have no GSAx yet, so no rank; 2 shown last." });
  });
  it("still counts unknown goalies when ranked ones fill the card", () => {
    const ids = Array.from({ length: 10 }, (_, index) => index + 1);
    const ranking = rankingOf(ids.map(id => goalie(id, 25, 26)), ids.slice(0, 9).map(id => nstRow(id, id, 1)));
    expect(ranking.rows).toHaveLength(STANDOUT_GOALIE_ROWS);
    expect(ranking.rows.every(row => row.gsax !== null)).toBe(true);
    expect(goalieRankingText(ranking, 15)).toEqual({ lead: "Top 8 of 9 by GSAx, with 15+ shots against.", note: "1 of 10 qualified goalies have no GSAx yet, so no rank; none shown." });
  });
  it("claims no GSAx ranking when no goalie has one, and the card can still export", () => {
    const ranking = rankingOf([goalie(1, 29, 30), goalie(2, 19, 20), goalie(3, 4, 5)], []);
    expect(ranking.rows.map(row => row.goalieId)).toEqual([1, 2]);
    expect(ranking.rows.map(goalieRank)).toEqual([null, null]);
    const text = goalieRankingText(ranking, 15);
    expect(text.lead).toBe("GSAx isn't available for this slate, so these 2 of 2 goalies with 15+ shots against are unranked, by SV%, then saves.");
    expect(text.note).toBeNull();
    expect(text.lead).not.toMatch(/by GSAx|Top/);
    const data = buildLastNightsStandouts(shared({ settings: active, goalies: [goalie(1, 29, 30)] })).data!;
    expect(lastNightsStandoutsModule.hasRows(data, active)).toBe(true);
  });
  it("has six chips and no TOI, and keeps TOI on the row for evidence", () => {
    const [row] = statsOf({ goalies: [...season(1), goalie(1, 29, 30)] });
    expect(row.stats.map(entry => entry.label)).toEqual(["SV", "SA", "GA", "SV%", "GAA", "GSAx"]);
    expect(row.toiSeconds).toBe(3600);
  });
  it("holds the card to its row limit", () => {
    const { data } = buildLastNightsStandouts(shared({ settings: active, goalies: Array.from({ length: 12 }, (_, index) => goalie(index + 1, 25, 26)) }));
    expect(goalieRanking(data!, { minShotsAgainst: 15 }).rows).toHaveLength(STANDOUT_GOALIE_ROWS);
  });
  it("keeps last night out of every STD", () => {
    const [row] = statsOf({ goalies: [...season(1), goalie(1, 40, 41, 1)], nstGoalies: [...EARLIER.map(date => nstRow(1, 3, 2, date)), nstRow(1, 9, 1)] });
    expect(row.priorGames).toBe(3);
    expect(stat(row, "saves")).toMatchObject({ last: 40, baseline: 18 });
    expect(stat(row, "shotsAgainst").baseline).toBe(20);
    expect(stat(row, "savePct").baseline).toBe(0.9);
    expect(stat(row, "gaa").baseline).toBe(2);
    expect(stat(row, "gsax")).toMatchObject({ last: 8, baseline: 1, change: 7 });
  });
  it("needs prior games and NST coverage for an STD", () => {
    expect(stat(statsOf({ goalies: [goalie(1, 18, 20, 2, EARLIER[0], 1), goalie(1, 29, 30)] })[0], "saves").baseline).toBeNull();
    const thin = statsOf({ goalies: [...season(1), goalie(1, 29, 30)], nstGoalies: [nstRow(1, 3, 1, EARLIER[0]), nstRow(1, 3, 1)] })[0];
    expect(stat(thin, "gsax")).toMatchObject({ last: 2, baseline: null, change: null });
  });
  const one = (over: Partial<GoalieStat>): GoalieStat => ({ id: "saves", label: "SV", direction: "higher", last: 1, baseline: 1, change: 10, ...over });
  it("colours each change by what is better", () => {
    const [row] = statsOf({ goalies: [...season(1), goalie(1, 39, 40, 1)], nstGoalies: [...EARLIER.map(date => nstRow(1, 2, 2, date)), nstRow(1, 3, 1)] });
    expect(goalieTone(stat(row, "saves"))).toBe("good");
    expect(goalieTone(stat(row, "goalsAgainst"))).toBe("good");
    expect(goalieTone(stat(row, "gaa"))).toBe("good");
    expect(goalieTone(stat(row, "savePct"))).toBe("good");
    expect(goalieTone(stat(row, "gsax"))).toBe("good");
    const [worse] = statsOf({ goalies: [...season(1), goalie(1, 10, 15, 5)], nstGoalies: [...EARLIER.map(date => nstRow(1, 2, 2, date)), nstRow(1, 2, 5)] });
    for (const id of ["saves", "goalsAgainst", "gaa", "savePct", "gsax"] as const) expect(goalieTone(stat(worse, id))).toBe("bad");
  });
  it("leaves workload and no change uncoloured", () => {
    expect(goalieTone(one({ id: "shotsAgainst", direction: "neutral", change: 50 }))).toBe("neutral");
    expect(goalieTone(one({ id: "shotsAgainst", direction: "neutral", change: -50 }))).toBe("neutral");
    expect(goalieTone(one({ change: null }))).toBe("neutral");
    expect(goalieTone(one({ change: 0.2 }))).toBe("neutral");
  });
  it("prints rates in their own units, never a percent", () => {
    expect(goalieChangeText(one({ id: "savePct", change: 0.012 }))).toBe("+.012");
    expect(goalieChangeText(one({ id: "savePct", change: -0.04 }))).toBe("−.040");
    expect(goalieChangeText(one({ id: "gaa", change: -0.85 }))).toBe("−0.85");
    expect(goalieChangeText(one({ id: "gsax", change: 1.25 }))).toBe("+1.25");
    expect(goalieChangeText(one({ change: 12.4 }))).toBe("+12%");
    expect(goalieChangeText(one({ id: "gsax", change: null }))).toBe("—");
    expect(goalieLastText(one({ id: "savePct", last: 0.917 }))).toBe(".917");
    expect(goalieStdText(one({ id: "saves", baseline: 24.33 }))).toBe("24.3");
    expect(goalieLastText(one({ id: "gsax", last: -0.5 }))).toBe("−0.50");
  });
});

describe("slate coverage and evidence", () => {
  const both = [{ gameId: 9, team: "NJD" }, { gameId: 9, team: "NYR" }];
  it("is complete when the card's own rows cover both sides of every scheduled game, with no team results needed", () => {
    expect(slateCoverage({ playerTeamGames: both, scheduledTeamGames: both })).toEqual({ observed: 2, expected: 2, missing: 0, complete: true, reasons: [] });
  });
  it("is partial when one team's rows are missing from a scheduled game", () => {
    const short = slateCoverage({ playerTeamGames: [both[0]], scheduledTeamGames: both });
    expect(short).toMatchObject({ observed: 1, expected: 2, missing: 1, complete: false });
    expect(short.reasons).toEqual(["1 of 2 scheduled team games on this slate have no skater rows."]);
    const result = buildLastNightsStandouts(shared({ appearances: season(), ...nstFor(DATES), scheduledTeamGames: both }));
    expect(result.state).toBe("partial");
    expect(result.reasons).toEqual(["1 of 2 scheduled team games on this slate have no skater rows."]);
    expect(result.evidence.coverage).toMatchObject({ observed: 1, expected: 2, missing: 1 });
  });
  it("never counts a side whose team id has no code", () => {
    expect(scheduledTeamGames([{ id: 9, date: SLATE, homeTeamId: 1, awayTeamId: 999 }])).toEqual([{ gameId: 9, date: SLATE, team: "NJD" }, { gameId: 9, date: SLATE, team: null }]);
    expect(slateCoverage({ playerTeamGames: both, scheduledTeamGames: [{ gameId: 9, team: "NJD" }, { gameId: 9, team: null }] }).complete).toBe(false);
  });
  it("is partial for the goalie view by team game too", () => {
    const appearance = { goalieId: 1, name: "Fictional", gameId: 9, date: SLATE, team: "NJD", opponent: "NYR", home: true, started: true, wins: 1, losses: 0, otLosses: 0, saves: 20, shotsAgainst: 21, goalsAgainst: 1, toiSeconds: 3600, shutouts: 0, qualityStart: 1 };
    const result = buildLastNightsStandouts(shared({ settings: settings({ view: "goalies" }), goalies: [appearance], scheduledTeamGames: both }));
    expect(result.state).toBe("partial");
    expect(result.reasons).toEqual(["1 of 2 scheduled team games on this slate have no goalie rows."]);
  });
  it("says last night is excluded and uses no forecast wording", () => {
    const { evidence } = built();
    expect(evidence.sample).toContain("that slate and later games excluded");
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
  /** Applies a read's date filters and direction, so a slate lookup answers as the table would. */
  const byDate = (rows: unknown[], filters: unknown[][]) => {
    const test: Record<string, (date: string, bound: string) => boolean> = { gte: (date, bound) => date >= bound, lte: (date, bound) => date <= bound, lt: (date, bound) => date < bound, gt: (date, bound) => date > bound };
    const dated = rows.filter(row => filters.every(([method, column, bound]) => column !== "date" || !test[method as string] || test[method as string]((row as { date: string }).date, bound as string)));
    const order = filters.find(([method, column]) => method === "order" && column === "date")?.[2] as { ascending?: boolean } | undefined;
    return order?.ascending === false ? [...dated].reverse() : dated;
  };
  /** Exact-count PostgREST fake that records each table's filters. */
  function fakeClient(tables: Record<string, unknown[]>) {
    const calls: { table: string; filters: unknown[][] }[] = [];
    return { calls, client: { from(table: string) {
      const filters: unknown[][] = [], rows = tables[table] ?? [];
      const chain: any = { then: (resolve: (value: unknown) => void) => { const kept = byDate(rows, filters); resolve({ data: kept, error: null, count: kept.length }); } };
      for (const method of ["select", "eq", "gte", "lte", "lt", "gt", "in", "not", "order", "limit", "range"]) chain[method] = (...args: unknown[]) => { filters.push([method, ...args]); return chain; };
      calls.push({ table, filters });
      return chain;
    } } };
  }
  const row = (playerId: number, gameId: number, date: string) => ({ player_id: playerId, player_name: `Fictional ${playerId}`, position_code: "D", date, season_id: SEASON, game_id: gameId, team_abbrev: "NJD", opponent_team_abbrev: "NYR", home_road: "H", games_played: 1, goals: 1, assists: 0, points: 1, shots: 3, hits: 1, blocked_shots: 1, pp_points: 0, toi_per_game: 1200, pp_toi: 60, penalty_minutes: 0 });
  /**
   * A scheduled game for the loader fixtures. Both sides are NJD, so one fictional NJD skater or goalie covers it; the
   * coverage tests below schedule NJD at NYR properly.
   */
  const sched = (id: number, date: string) => ({ id, date, homeTeamId: 1, awayTeamId: 1 });
  /** Both teams' results for a game. The loader no longer reads them; fixtures keep them to show they change nothing. */
  const teamRows = (gameId: number, date: string) => [1, 3].map(team_id => ({ team_id, game_id: gameId, date, season_id: SEASON, opponent_id: team_id === 1 ? 3 : 1 }));
  const context = (tables: Record<string, unknown[]>) => { const fake = fakeClient(tables); return { fake, context: { client: fake.client, generatedAt: "2026-11-01T14:00:00Z" } }; };
  it("reads the newest slate, then the season for those players only", async () => {
    const { fake, context: ctx } = context({ wgo_skater_stats: [row(1, 9, SLATE)], games: [sched(9, SLATE)], wgo_team_stats: teamRows(9, SLATE), nst_gamelog_as_counts: [counts(1, SLATE)], nst_gamelog_as_counts_oi: [onIce(1, SLATE)], lineCombinations: [{ gameId: 9, forwards: [], defensemen: [1] }], powerPlayCombinations: [], yahoo_players: [], yahoo_nhl_player_map_read: [] });
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
  const skaterTables = { wgo_skater_stats: [row(1, 9, SLATE)], games: [sched(9, SLATE)], wgo_team_stats: teamRows(9, SLATE), nst_gamelog_as_counts: [], nst_gamelog_as_counts_oi: [], lineCombinations: [], powerPlayCombinations: [], yahoo_players: [], yahoo_nhl_player_map_read: [] };
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
    const { fake, context: ctx } = context({ wgo_skater_stats: [row(1, 9, SLATE)], games: [sched(9, SLATE)], wgo_team_stats: teamRows(9, SLATE), wgo_goalie_stats: [{ goalie_id: 7, goalie_name: "Fictional", date: SLATE, season_id: SEASON, game_id: 9, team_abbreviation: "NJD", opponent_team_abbrev: "NYR", home_road: "H", games_played: 1, games_started: 1, wins: 1, losses: 0, ot_losses: 0, saves: 20, shots_against: 21, goals_against: 1, time_on_ice: 3600, shutouts: 0, quality_start: 1 }], nst_gamelog_goalie_all_counts: [], yahoo_players: [], yahoo_nhl_player_map_read: [] });
    const result = await loadLastNightsStandouts(ctx, settings({ view: "goalies" }));
    expect(result.data?.goalies.map(row => row.goalieId)).toEqual([7]);
    expect(fake.calls.some(call => call.table === "nst_gamelog_as_counts")).toBe(false);
    expect(fake.calls.find(call => call.table === "nst_gamelog_goalie_all_counts")!.filters).toContainEqual(["in", "player_id", [7]]);
  });
  it("is missing, not empty, before the season's first slate", async () => {
    const { context: ctx } = context({ wgo_skater_stats: [] });
    const result = await loadLastNightsStandouts(ctx, settings());
    expect(result.state).toBe("missing");
    expect(result.data).toBeNull();
  });
  describe("a chosen slate", () => {
    const LATER = "2026-11-01", EARLIER = "2026-10-20", NO_GAMES = "2026-10-25";
    /** Three slates, and player 1 played all of them. The middle one is chosen. */
    const tables = { wgo_skater_stats: [row(1, 1, EARLIER), row(1, 9, SLATE)], games: [sched(1, EARLIER), sched(9, SLATE)], wgo_team_stats: [...teamRows(1, EARLIER), ...teamRows(9, SLATE)], nst_gamelog_as_counts: [], nst_gamelog_as_counts_oi: [], lineCombinations: [], powerPlayCombinations: [], yahoo_players: [], yahoo_nhl_player_map_read: [] };
    const atNoon = (date: string) => `${date}T14:00:00Z`;
    it("defaults to the latest scheduled night, reading the schedule once and no team results", async () => {
      const { fake, context: ctx } = context(tables);
      const { data, state } = await loadLastNightsStandouts(ctx, settings());
      expect(state).toBe("ready");
      expect(data).toMatchObject({ slate: SLATE, games: 1, fallback: null, slates: { previous: EARLIER, next: null } });
      expect(fake.calls.filter(call => call.table === "games")).toHaveLength(1);
      expect(fake.calls.some(call => call.table === "wgo_team_stats")).toBe(false);
    });
    it("reads through the chosen slate only, and finds its neighbours", async () => {
      const { fake, context: ctx } = context({ ...tables, wgo_skater_stats: [...tables.wgo_skater_stats, row(1, 20, LATER)], games: [...tables.games, sched(20, LATER)], wgo_team_stats: [...tables.wgo_team_stats, ...teamRows(20, LATER)] });
      const { data } = await loadLastNightsStandouts({ ...ctx, generatedAt: atNoon("2026-11-02") }, settings({ slate: SLATE }));
      expect(data).toMatchObject({ slate: SLATE, slates: { previous: EARLIER, next: LATER } });
      const seasonRead = fake.calls.filter(call => call.table === "wgo_skater_stats").find(call => call.filters.some(([method]) => method === "in"))!;
      expect(seasonRead.filters).toContainEqual(["lte", "date", SLATE]);
      expect(isOlderSlate(data!)).toBe(true);
      expect(slateWord(data!)).toBe("Oct 31");
      expect(standoutsHeadline({ slate: SLATE }, data)).toBe("Oct 31 Standouts");
    });
    it("gives a date with no games a clear reason and keeps the chooser's data", async () => {
      const { fake, context: ctx } = context(tables);
      const result = await loadLastNightsStandouts(ctx, settings({ slate: NO_GAMES }));
      expect(result.state).toBe("missing");
      expect(result.reasons).toEqual(["No games on Oct 25. Choose another slate."]);
      expect(result.data).toMatchObject({ slate: NO_GAMES, skaters: [], slates: { previous: EARLIER, next: SLATE } });
      expect(fake.calls.some(call => call.table === "yahoo_players")).toBe(false);
    });
    it("refuses a date past the completed slates or outside the season", async () => {
      for (const slate of ["2026-11-01", "2026-06-01"]) {
        const result = await loadLastNightsStandouts(context(tables).context, settings({ slate }));
        expect(result.state).toBe("missing");
        expect(result.reasons?.[0]).toContain("outside this season's completed slates");
      }
    });
    it("fails visibly when the schedule cannot be read", async () => {
      const { fake } = context(tables);
      const client = { from: (table: string) => { const chain = fake.client.from(table); if (table === "games") chain.then = (resolve: (value: unknown) => void) => resolve({ data: null, error: { message: "nope" }, count: null }); return chain; } };
      await expect(loadLastNightsStandouts({ client, generatedAt: "2026-11-01T14:00:00Z" }, settings())).rejects.toThrow();
    });
    it("renders a night whose team results are late when its own rows cover every scheduled game", async () => {
      // TJ, 11-03: Nov 2's team fetch failed, but its skater and goalie rows had landed.
      const late = { ...tables, wgo_team_stats: teamRows(1, EARLIER) };
      for (const slate of [SLATE, null]) {
        const result = await loadLastNightsStandouts(context(late).context, settings({ view: "all", slate }));
        expect(result.state).toBe("ready");
        expect(result.data).toMatchObject({ slate: SLATE, fallback: null });
        expect(result.data!.skaters.map(row => row.playerId)).toEqual([1]);
      }
    });
  });
  describe("a played slate with a missing feed", () => {
    const EARLIER = "2026-10-29", GAP = "2026-10-30", OFF_DAY = "2026-10-28", FIRST = "2026-10-27";
    const goalieRow = (goalieId: number, gameId: number, date: string) => ({ goalie_id: goalieId, goalie_name: `Fictional ${goalieId}`, date, season_id: SEASON, game_id: gameId, team_abbreviation: goalieId % 2 ? "NJD" : "NYR", opponent_team_abbrev: goalieId % 2 ? "NYR" : "NJD", home_road: "H", games_played: 1, games_started: 1, wins: 1, losses: 0, ot_losses: 0, saves: 25, shots_against: 27, goals_against: 2, time_on_ice: 3600, shutouts: 0, quality_start: 1 });
    /** Reviewer's case: Oct 31 has a scheduled game, two team rows and goalie rows, and no skater row at all. */
    const gap = { wgo_skater_stats: [row(1, 1, FIRST)], games: [sched(1, FIRST), sched(9, SLATE)], wgo_team_stats: [...teamRows(1, FIRST), ...teamRows(9, SLATE)], wgo_goalie_stats: [goalieRow(7, 9, SLATE), goalieRow(8, 9, SLATE)], nst_gamelog_goalie_all_counts: [], yahoo_players: [], yahoo_nhl_player_map_read: [] };
    it("is not available on a chosen night with no skater rows, naming the missing feed, never an off day", async () => {
      const result = await loadLastNightsStandouts(context(gap).context, settings({ view: "all", slate: SLATE }));
      expect(result.state).toBe("missing");
      expect(result.reasons).toEqual(["Skater data is missing for Oct 31: 1 game was scheduled, and no skater rows have been reported."]);
      expect(result.reasons?.join(" ")).not.toContain("No games");
      expect(result.data).toMatchObject({ slate: SLATE, games: 1, skaters: [], fallback: null, slates: { previous: FIRST, next: null } });
      expect(result.pageNotes).toEqual([]);
      expect(result.evidence.coverage).toMatchObject({ observed: 0, expected: 2, missing: 2 });
      expect(result.evidence.sources).toEqual([expect.objectContaining({ state: "partial", asOf: null })]);
    });
    it("falls back from a blank date's incomplete night to the last complete one, which carries its date", async () => {
      const { data, state, pageNotes, reasons } = await loadLastNightsStandouts(context(gap).context, settings({ view: "forwards" }));
      expect(state).toBe("ready");
      expect(reasons).toEqual([]);
      expect(data).toMatchObject({ slate: FIRST, fallback: { trimmed: [SLATE] }, slates: { previous: null, next: SLATE } });
      // Beside the card only: the PNG carries the date, not the note.
      expect(pageNotes).toEqual(["Oct 31 is not fully reported yet, so this card ends Oct 27."]);
      expect(slateWord(data!)).toBe("Oct 27");
      expect(standoutsHeadline({ slate: null }, data)).toBe("Oct 27 Standouts");
    });
    it("looks back over at most a week of incomplete nights, then shows the latest as it is", async () => {
      const dates = Array.from({ length: 10 }, (_, index) => `2026-10-${String(20 + index).padStart(2, "0")}`);
      const { fake, context: ctx } = context({ ...gap, wgo_skater_stats: [row(1, 1, dates[0])], games: dates.map((date, index) => sched(index + 1, date)) });
      const result = await loadLastNightsStandouts({ ...ctx, generatedAt: "2026-10-30T14:00:00Z" }, settings({ view: "all" }));
      expect(result.state).toBe("missing");
      expect(result.data).toMatchObject({ slate: dates[9], fallback: null });
      expect(result.pageNotes).toEqual([]);
      expect(fake.calls.filter(call => call.table === "wgo_skater_stats")).toHaveLength(1 + FALLBACK_NIGHTS);
    });
    it("keeps the goalie view working from its own complete sources", async () => {
      for (const slate of [SLATE, null]) {
        const result = await loadLastNightsStandouts(context(gap).context, settings({ view: "goalies", slate }));
        expect(result.state).toBe("ready");
        expect(result.data!.slate).toBe(SLATE);
        expect(result.data!.goalies.map(row => row.goalieId)).toEqual([7, 8]);
      }
    });
    it("is not available in the goalie view when goalie rows are the missing feed", async () => {
      const result = await loadLastNightsStandouts(context({ ...gap, wgo_goalie_stats: [] }).context, settings({ view: "goalies" }));
      expect(result.state).toBe("missing");
      expect(result.reasons).toEqual(["Goalie data is missing for Oct 31: 1 game was scheduled, and no goalie rows have been reported."]);
    });
    it("still counts one missing team on a slate that has skater rows", async () => {
      const result = await loadLastNightsStandouts(context({ ...gap, games: [sched(1, FIRST), { id: 9, date: SLATE, homeTeamId: 1, awayTeamId: 3 }], wgo_skater_stats: [row(1, 9, SLATE)], lineCombinations: [], powerPlayCombinations: [], nst_gamelog_as_counts: [], nst_gamelog_as_counts_oi: [] }).context, settings({ view: "all", slate: SLATE }));
      expect(result.state).toBe("partial");
      expect(result.reasons).toEqual(["1 of 2 scheduled team games on this slate have no skater rows."]);
      expect(result.pageNotes).toEqual([]);
    });
    it("walks neighbours over a true off day but stops on a missing-feed day", async () => {
      const tables = { wgo_skater_stats: [row(1, 1, FIRST), row(1, 2, EARLIER), row(1, 9, SLATE)], games: [sched(1, FIRST), sched(2, EARLIER), sched(3, GAP), sched(9, SLATE)], wgo_team_stats: [...teamRows(1, FIRST), ...teamRows(2, EARLIER), ...teamRows(3, GAP), ...teamRows(9, SLATE)], nst_gamelog_as_counts: [], nst_gamelog_as_counts_oi: [], lineCombinations: [], powerPlayCombinations: [], yahoo_players: [], yahoo_nhl_player_map_read: [] };
      expect((await loadLastNightsStandouts(context(tables).context, settings({ slate: SLATE }))).data!.slates).toMatchObject({ previous: GAP, next: null });
      expect((await loadLastNightsStandouts(context(tables).context, settings({ slate: GAP }))).data!.slates).toMatchObject({ previous: EARLIER, next: SLATE });
      expect((await loadLastNightsStandouts(context(tables).context, settings({ slate: EARLIER }))).data!.slates).toMatchObject({ previous: FIRST, next: GAP });
      const off = await loadLastNightsStandouts(context(tables).context, settings({ slate: OFF_DAY }));
      expect(off.reasons).toEqual(["No games on Oct 28. Choose another slate."]);
      expect(off.data!.slates).toMatchObject({ previous: FIRST, next: EARLIER });
    });
  });
});

describe("a slate's baseline and URLs", () => {
  it("excludes that slate and every later game from the baseline, and the card's date follows it", () => {
    const older = "2026-10-24", games = [game(1, "2026-10-20", 1), game(1, "2026-10-22", 2), game(1, "2026-10-23", 3), game(1, older, 4, { shots: 8 }), game(1, SLATE, 9, { shots: 40 })];
    const { data } = buildLastNightsStandouts(shared({ slate: older, slates: { previous: "2026-10-23", next: SLATE, first: "2026-07-01", last: SLATE }, settings: settings({ slate: older }), appearances: games }));
    const sog = stat(data!.skaters[0], "sog");
    expect(data!.slate).toBe(older);
    expect(sog).toMatchObject({ last: 8, baseline: 2, change: 300 });
    expect(data!.skaters[0].priorGames).toBe(3);
  });
  it("calls the latest slate last night, even when it was chosen", () => {
    const data = { slate: SLATE, slates: { previous: "2026-10-30", next: null, first: "2026-07-01", last: SLATE } };
    expect(slateWord(data)).toBe("Last night");
    expect(standoutsHeadline({ slate: SLATE }, data)).toBe("Last Nights Standouts");
    expect(standoutsHeadline({ slate: null }, data)).toBe("Last Nights Standouts");
  });
  it("follows the settings until the new edition loads", () => {
    expect(standoutsHeadline({ slate: "2026-10-20" }, { slate: SLATE, slates: { previous: null, next: null, first: SLATE, last: SLATE } })).toBe("Oct 20 Standouts");
    expect(standoutsHeadline({ slate: "2026-10-20" }, null)).toBe("Oct 20 Standouts");
  });
  it("keeps old URLs on the latest slate and round trips an old slate with its picks", () => {
    expect(parseShareSettings(lastNightsStandoutsModule, { view: "under", picks: "1,2" })).toMatchObject({ slate: null, picks: "1,2" });
    expect(parseShareSettings(lastNightsStandoutsModule, { view: "all", slate: "2026-10-20", picks: "3" })).toMatchObject({ slate: "2026-10-20", picks: "3" });
    expect(() => parseShareSettings(lastNightsStandoutsModule, { slate: "not-a-date" })).toThrow();
  });
  it("makes the slate a server setting, so changing it stops the export until it is refreshed", () => {
    const { data } = buildLastNightsStandouts(shared({ settings: settings({ slate: SLATE }), appearances: season() }));
    expect(standoutsCurrent(data!, settings({ slate: SLATE }))).toBe(true);
    expect(standoutsCurrent(data!, settings({ slate: "2026-10-20" }))).toBe(false);
  });
});
