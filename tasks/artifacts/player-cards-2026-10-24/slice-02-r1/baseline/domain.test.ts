import { describe, expect, it } from "vitest";
import type { CardSettings, MetricId } from "./contracts";
import { METRICS } from "./registry";
import { selectWindow, type Appearance, type AppearanceFrame } from "./windows";
import { aggregateWindow, pooledMetric, type Components, type GameMetricRecord } from "./aggregation";
import { adaptLocalSnapshot, type LocalCardInput } from "./adapter";

const settings: CardSettings = { season: 20262027, gameType: "regular", strength: "all", cutoff: "2026-10-24T00:00:00Z", period: { mode: "appearances", count: 5 }, seasonPolicy: "season-only-proposed", shortSamplePolicy: "allow-known-short-proposed", rankPolicy: "competition-midrank-proposed" };
const source = { definition: "synthetic-nst-contract", version: "fixture-v1", capturedAt: "2026-10-24T02:00:00Z" };
function game(day: number, playerId = 1001): Appearance {
  const date = `2026-10-${String(day).padStart(2, "0")}`;
  return { playerId, gameId: 2026020000 + day, season: 20262027, gameType: "regular", date, played: true, completion: { status: "verified-final", completedAt: `${date}T22:00:00Z`, reference: "synthetic-final-proof" } };
}
function frame(appearances: readonly Appearance[], playerId = 1001): AppearanceFrame {
  return { playerId, season: 20262027, gameType: "regular", dateBasis: "UTC", completeHistory: true, historyThrough: settings.cutoff, historyReference: "synthetic-complete-history", appearances };
}
function components(): Components {
  return { toiUnit: "seconds", individual: { toi: 1200, shots: 4, icf: 8, iscfs: 3, ixg: 0.4, total_points: 1, goals: 1 }, onIce: { toi: 1200, cf: 20, scf: 10, xgf: 1, xga: 0.5, gf: 2, sf: 15 } };
}
function record(appearance: Appearance): GameMetricRecord {
  return { ...components(), playerId: appearance.playerId, gameId: appearance.gameId, season: appearance.season, date: appearance.date, strength: "all", sourceDefinition: source.definition, sourceVersion: source.version, capturedAt: "2026-10-24T01:00:00Z", state: "ready" };
}
const metric = (id: MetricId) => METRICS.find(metric => metric.id === id)!;
function input(): LocalCardInput {
  const players = [1001, 1002].map(id => {
    const games = [game(20, id), game(21, id)];
    return { frame: frame(games, id), records: games.map(record) };
  });
  return { id: "synthetic-snapshot", origin: "synthetic", capturedAt: source.capturedAt, settings, source: { definition: source.definition, version: source.version, definitionReference: "synthetic-definition-proof", verifiedMetrics: METRICS.map(metric => metric.id) }, population: { scope: "synthetic-all-values", complete: true, reference: "synthetic-full-population-proof", expectedPlayerIds: [1001, 1002] }, players };
}

describe("supplied official appearance windows with explicit proposed policies", () => {
  it("applies completion/cutoff and season before own N, preserving actual dates", () => {
    const future = game(23); future.completion = { status: "verified-final", completedAt: "2026-10-25T00:00:00Z", reference: "synthetic-future-final" };
    const old = { ...game(2), season: 20252026 };
    const scratch = { ...game(10), played: false, completion: { status: "unverified" as const } };
    const selected = selectWindow(frame([game(21), game(18), game(22), game(19), game(20), game(17), future, old, scratch]), settings);
    expect(selected.state).toBe("ready");
    expect(selected.games.map(game => game.date)).toEqual(["2026-10-22", "2026-10-21", "2026-10-20", "2026-10-19", "2026-10-18"]);
    expect(selected.actualGp).toBe(5); expect(selected.firstDate).toBe("2026-10-18"); expect(selected.lastDate).toBe("2026-10-22");
  });
  it("uses an inclusive UTC calendar interval and the same completion cutoff", () => {
    const range: CardSettings = { ...settings, period: { mode: "calendar", start: "2026-10-20", end: "2026-10-22", timezone: "UTC" } };
    const games = [19, 20, 21, 22, 23].map(day => game(day));
    const selected = selectWindow(frame(games), range);
    expect(selected.games.map(game => game.date)).toEqual(["2026-10-22", "2026-10-21", "2026-10-20"]);
    expect(selected.requestedN).toBeNull();
    expect(selectWindow(frame(games), { ...range, cutoff: "2026-10-22T20:00:00Z" }).games.map(game => game.date)).toEqual(["2026-10-21", "2026-10-20"]);
  });
  it("orders same-date appearances by verified completion time before game identity", () => {
    const games = Array.from({ length: 6 }, (_, i) => ({ ...game(20), gameId: 100 - i, completion: { status: "verified-final" as const, completedAt: `2026-10-20T${10 + i}:00:00Z`, reference: "synthetic-final" } }));
    expect(selectWindow(frame(games), settings).games.map(game => game.gameId)).toEqual([95, 96, 97, 98, 99]);
  });
  it("distinguishes a known short season from unknown/missing history", () => {
    const short = frame([game(20), game(21)]);
    expect(selectWindow(short, settings)).toMatchObject({ state: "ready", actualGp: 2, requestedN: 5, knownShort: true });
    expect(selectWindow(short, { ...settings, shortSamplePolicy: "require-full-proposed" })).toMatchObject({ state: "undefined", actualGp: 2, knownShort: true });
    expect(selectWindow({ ...short, completeHistory: false }, settings)).toMatchObject({ state: "missing", knownShort: false });
    expect(selectWindow({ ...short, historyThrough: "2026-10-20T00:00:00Z" }, settings).state).toBe("missing");
  });
  it("does not infer completion, participation or unique identity from a date", () => {
    expect(selectWindow(frame([{ ...game(20), completion: { status: "unverified" } }]), settings).state).toBe("missing");
    expect(selectWindow(frame([{ ...game(20), played: null }]), settings).state).toBe("missing");
    expect(selectWindow(frame([game(20), game(20)]), settings).state).toBe("missing");
    expect(selectWindow(frame([{ ...game(20), date: "2026-02-30" }]), settings).state).toBe("missing");
    expect(selectWindow(frame([game(20)]), { ...settings, cutoff: "2026-02-30T00:00:00Z" }).state).toBe("missing");
    expect(selectWindow(frame([game(20)]), { ...settings, seasonPolicy: "unapproved-carryover" as CardSettings["seasonPolicy"] }).state).toBe("missing");
    expect(selectWindow(frame([]), settings).state).toBe("undefined");
  });
  it("supports independent L10/L20 samples without borrowing previous seasons", () => {
    const games = Array.from({ length: 22 }, (_, i) => game(i + 1));
    expect(selectWindow(frame(games), { ...settings, period: { mode: "appearances", count: 10 } }).actualGp).toBe(10);
    expect(selectWindow(frame(games), { ...settings, period: { mode: "appearances", count: 20 } }).actualGp).toBe(20);
    const second = selectWindow(frame([game(20, 1002), game(22, 1002)], 1002), settings);
    const first = selectWindow(frame([game(18), game(22)]), settings);
    expect(second.firstDate).not.toBe(first.firstDate); expect(second.settings.cutoff).toBe(first.settings.cutoff);
  });
});

describe("pooled component mathematics and exact source joins", () => {
  it("pools seconds and counts rather than averaging game rates or percentages", () => {
    const a = components(), b = components();
    a.individual = { ...a.individual, toi: 60, shots: 1, goals: 1 };
    b.individual = { ...b.individual, toi: 3540, shots: 2, goals: 0 };
    expect(pooledMetric(metric("sog60"), [a, b], 2).value).toBe(3);
    expect(pooledMetric(metric("atoi"), [a, b], 2).value).toBe(30);
    expect(pooledMetric(metric("shPct"), [a, b], 2).value).toBeCloseTo(100 / 3);
    expect(pooledMetric(metric("ixg60"), [a, b], 2).value).toBeCloseTo(0.8);
    expect(pooledMetric(metric("xgPct"), [a, b], 2).value).toBeCloseTo(200 / 3);
  });
  it("retains zero-PP-time appearances in GP and distinguishes zero from undefined", () => {
    const games = [game(20), game(21)];
    const selected = selectWindow(frame(games), { ...settings, strength: "pp" });
    const records = games.map(record).map((row, i) => ({ ...row, strength: "pp" as const, individual: { ...row.individual, toi: i ? 600 : 0, shots: 0, goals: 0 } }));
    records[0].individual = { toi: 0, shots: 0, goals: 0, total_points: 0, ixg: 0, icf: 0, iscfs: 0 };
    records[0].onIce = { toi: 0, cf: 0, scf: 0, xgf: 0, xga: 0, gf: 0, sf: 0 };
    const result = aggregateWindow(selected, records, source);
    expect(selected.actualGp).toBe(2); expect(result.values.atoi.value).toBe(5);
    expect(result.values.sog60).toMatchObject({ state: "valid", value: 0 });
    expect(result.values.shPct).toMatchObject({ state: "undefined", value: null });
  });
  it("keeps incomplete source rows separate from an honestly short appearance frame", () => {
    const games = [game(20), game(21)]; const selected = selectWindow(frame(games), settings);
    expect(selected).toMatchObject({ state: "ready", actualGp: 2, knownShort: true });
    expect(aggregateWindow(selected, [record(games[0])], source).values.sog60.state).toBe("missing");
    const rows = games.map(record); rows[0].individual.ixg = null;
    expect(aggregateWindow(selected, rows, source).values.ixg60.state).toBe("missing");
    expect(aggregateWindow(selected, rows, source).values.sog60.state).toBe("valid");
  });
  it.each(["stale", "source-error", "null-overwrite"] as const)("withholds a %s source instead of filling from another table", state => {
    const g = game(20);
    expect(aggregateWindow(selectWindow(frame([g]), settings), [{ ...record(g), state }], source).values.atoi.state).toBe("missing");
  });
  it("rejects duplicate, wrong-season, wrong-strength, mixed-definition and mistimed joins", () => {
    const g = game(20); const selected = selectWindow(frame([g]), settings); const r = record(g);
    const bad = [
      { ...r, season: 20252026 }, { ...r, strength: "5v5" as const }, { ...r, sourceDefinition: "different-xg-model" },
      { ...r, sourceVersion: "older-version" }, { ...r, capturedAt: "2026-10-25T00:00:00Z" },
      { ...r, capturedAt: "2026-10-19T00:00:00Z" }, { ...r, toiUnit: "minutes" as "seconds" },
    ];
    for (const row of bad) expect(aggregateWindow(selected, [row], source).values.sog60.state).toBe("missing");
    expect(aggregateWindow(selected, [r, r], source).values.sog60.state).toBe("missing");
  });
  it("withholds impossible, nonfinite and missing components without manufacturing zero", () => {
    const a = components(); a.individual.shots = 0;
    expect(pooledMetric(metric("shPct"), [a], 1).state).toBe("undefined");
    a.individual.shots = 1; a.individual.goals = 2;
    expect(pooledMetric(metric("shPct"), [a], 1).state).toBe("missing");
    a.individual.ixg = Infinity;
    expect(pooledMetric(metric("ixg60"), [a], 1).state).toBe("missing");
    delete a.individual.toi;
    expect(pooledMetric(metric("atoi"), [a], 1).state).toBe("missing");
  });
});

describe("local adapter coverage and inactive integration boundaries", () => {
  it("uses the complete declared same-definition population with no GP/TOI/position threshold", () => {
    const data = input(); data.players[1].records.forEach(row => { row.individual.toi = 1; row.individual.shots = 0; });
    const result = adaptLocalSnapshot(data, 1001);
    expect(result.state).not.toBe("rejected"); if (result.state === "rejected") return;
    expect(result.readings.find(row => row.id === "sog60")?.rank).toMatchObject({ ordinal: 1, population: 2, percentile: 75 });
    expect(result.coverage.shPct).toMatchObject({ valid: 1, knownUndefined: 1, missingIncomplete: 0, knownShort: 2 });
    expect(result.readings.find(row => row.id === "shPct")?.rank?.population).toBe(1);
    expect(result.liveActivation).toBe(false); expect(result.premiumActivation).toBe(false); expect(result.retrospective).toBe(true);
  });
  it("keeps valid individual values while suppressing incomplete or narrower league pools", () => {
    const data = input(); data.population.complete = false;
    const result = adaptLocalSnapshot(data, 1001);
    if (result.state === "rejected") throw new Error(result.reason);
    expect(result.readings[0].value).not.toBeNull(); expect(result.readings.every(row => row.rank === null)).toBe(true);
    data.population.complete = true; data.population.expectedPlayerIds = [1001, 1002, 1003];
    const missing = adaptLocalSnapshot(data, 1001);
    if (missing.state === "rejected") throw new Error(missing.reason);
    expect(missing.coverage.atoi.missingIncomplete).toBe(1); expect(missing.readings[0].rank).toBeNull();
    data.population.expectedPlayerIds = [1001, 1002]; data.origin = "local-observed";
    const wrongScope = adaptLocalSnapshot(data, 1001);
    if (wrongScope.state === "rejected") throw new Error(wrongScope.reason);
    expect(wrongScope.readings.every(row => row.rank === null)).toBe(true);
  });
  it("uses metric-specific valid/undefined/missing coverage and gates source definitions", () => {
    const data = input(); data.players[1].records.forEach(row => { row.individual.ixg = null; });
    const result = adaptLocalSnapshot(data, 1001);
    if (result.state === "rejected") throw new Error(result.reason);
    expect(result.coverage.ixg60).toMatchObject({ valid: 1, missingIncomplete: 1, fullEligiblePopulationVerified: false });
    expect(result.readings.find(row => row.id === "ixg60")?.rank).toBeNull();
    expect(result.readings.find(row => row.id === "sog60")?.rank?.population).toBe(2);
    data.source.verifiedMetrics = ["atoi"];
    const restricted = adaptLocalSnapshot(data, 1001);
    if (restricted.state === "rejected") throw new Error(restricted.reason);
    expect(restricted.state).toBe("partial"); expect(restricted.readings.find(row => row.id === "ixg60")?.reason).toContain("definition is unverified");
  });
  it("rejects identity conflicts and snapshots preceding the common cutoff", () => {
    const data = input(); data.players = [data.players[0], data.players[0]];
    expect(adaptLocalSnapshot(data, 1001).state).toBe("rejected");
    expect(adaptLocalSnapshot({ ...input(), capturedAt: "2026-10-23T00:00:00Z" }, 1001).state).toBe("rejected");
  });
  it("does not let a local-observed label or complete population claim bypass missing game proof", () => {
    const data = input(); data.origin = "local-observed"; data.population.scope = "all-nhl";
    data.players[0].frame = { ...data.players[0].frame, completeHistory: false };
    const missing = adaptLocalSnapshot(data, 1001);
    if (missing.state === "rejected") throw new Error(missing.reason);
    expect(missing.state).toBe("unavailable"); expect(missing.readings.every(row => row.rank === null)).toBe(true);
    data.players[0].frame = { ...data.players[0].frame, completeHistory: true, appearances: [{ ...game(20), completion: { status: "unverified" } }] };
    const unverified = adaptLocalSnapshot(data, 1001);
    if (unverified.state === "rejected") throw new Error(unverified.reason);
    expect(unverified.selection.reason).toContain("Completed-game evidence");
    expect(unverified.state).toBe("unavailable"); expect(unverified.liveActivation).toBe(false);
  });
});
