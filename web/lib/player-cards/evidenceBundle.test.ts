import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import type { CardSettings, MetricId } from "./contracts";
import { METRICS, REGISTRY_VERSION } from "./registry";
import { adaptLocalSnapshot, type LocalCardInput } from "./adapter";
import type { Components, GameMetricRecord } from "./aggregation";
import type { Appearance } from "./windows";
import { validateEvidenceBundle, type DefinitionReceipt, type EvidenceBundle, type FinalityReceipt, type HistoryReceipt, type PopulationReceipt, type ReceiptRef, type RetainedReceipt } from "./evidenceBundle";

// SYNTHETIC: every player, game, value and receipt below is fabricated. Nothing here is NHL/NST evidence.
const settings: CardSettings = { season: 20262027, gameType: "regular", strength: "all", cutoff: "2026-10-24T00:00:00Z", period: { mode: "appearances", count: 5 }, seasonPolicy: "season-only-proposed", shortSamplePolicy: "allow-known-short-proposed", rankPolicy: "competition-midrank-proposed" };
const PLAYERS = [1001, 1002, 1003];
const DAYS = [14, 16, 18, 20, 22];
const SELECTED = 1001;
const sha = (id: string) => createHash("sha256").update(`synthetic:${id}`).digest("hex");
const ref = (receiptId: string): ReceiptRef => ({ receiptId, sha256: sha(receiptId) });
const retainedBase = (receiptId: string) => ({ receiptId, sha256: sha(receiptId), retainedPath: `synthetic/receipts/${receiptId}.json`, origin: "synthetic" as const, capturedAt: "2026-10-24T06:00:00Z" });
const date = (day: number) => `2026-10-${String(day).padStart(2, "0")}`;
const gameId = (playerId: number, day: number) => 2026020000 + (playerId - 1000) * 100 + day;

function components(playerId: number): Components {
  const k = playerId - 1000;
  return { toiUnit: "seconds", individual: { toi: 1000 + 100 * k, shots: 2 + k, icf: 4 + k, iscfs: 1 + k, ixg: 0.1 * k, total_points: 1, goals: 1 }, onIce: { toi: 1000 + 100 * k, cf: 15 + k, scf: 6 + k, xgf: 0.5 + 0.1 * k, xga: 0.6, gf: 2, sf: 12 + k } };
}
type Options = { components?: (playerId: number, day: number) => Components };
function world(options: Options = {}) {
  const players = PLAYERS.map(playerId => {
    const appearances: Appearance[] = DAYS.map(day => ({ playerId, gameId: gameId(playerId, day), season: 20262027, gameType: "regular", date: date(day), played: true, completion: { status: "unverified" } }));
    const records: GameMetricRecord[] = appearances.map(game => ({ ...(options.components?.(playerId, Number(game.date.slice(8))) ?? components(playerId)), playerId, gameId: game.gameId, season: game.season, date: game.date, strength: "all", sourceDefinition: "synthetic-nst-contract", sourceVersion: "synthetic-v1", capturedAt: "2026-10-24T03:00:00Z", state: "ready" }));
    return { frame: { playerId, season: 20262027, gameType: "regular" as const, dateBasis: "UTC" as const, completeHistory: false, historyThrough: "", historyReference: "", appearances }, records };
  });
  const input: LocalCardInput = { id: "synthetic-card-input", origin: "synthetic", capturedAt: "2026-10-24T04:00:00Z", settings, source: { definition: "synthetic-nst-contract", version: "synthetic-v1", definitionReference: "", verifiedMetrics: [] }, population: { scope: "synthetic-all-values", complete: false, reference: "", expectedPlayerIds: PLAYERS }, players };
  const history: HistoryReceipt[] = PLAYERS.map(playerId => ({ ...retainedBase(`history-${playerId}`), kind: "appearance-history", subject: { playerId, season: 20262027, gameType: "regular", dateBasis: "UTC", sourceClass: "complete-official-log", through: "2026-10-24T05:00:00Z", appearances: DAYS.map(day => ({ gameId: gameId(playerId, day), date: date(day), played: true })) } }));
  const finality: FinalityReceipt[] = PLAYERS.flatMap(playerId => DAYS.map(day => ({ ...retainedBase(`final-${gameId(playerId, day)}`), kind: "game-finality" as const, subject: { gameId: gameId(playerId, day), season: 20262027, date: date(day), endedAt: `${date(day)}T22:30:00Z`, sourceClass: "official-game-end" as const } })));
  const definitions: DefinitionReceipt[] = METRICS.map(metric => ({ ...retainedBase(`definition-${metric.id}`), kind: "metric-definition", subject: { metricId: metric.id, registryVersion: REGISTRY_VERSION, sourceDefinition: "synthetic-nst-contract", sourceVersion: "synthetic-v1", definitionVersion: "synthetic-def-1", zeroSemantics: "verified-distinct" } }));
  const populations: PopulationReceipt[] = METRICS.map(metric => ({ ...retainedBase(`population-${metric.id}`), kind: "population-membership", subject: { metricId: metric.id, scope: "synthetic-all-values", definitionVersion: "synthetic-def-1", sourceClass: "metric-population-inventory", season: 20262027, gameType: "regular", strength: "all", period: { mode: "appearances", count: 5 }, cutoff: settings.cutoff, memberIds: PLAYERS } }));
  const bundle: EvidenceBundle = {
    id: "synthetic-bundle", origin: "synthetic",
    selection: { playerId: SELECTED, season: 20262027, gameType: "regular", strength: "all", period: { mode: "appearances", count: 5 }, cutoff: settings.cutoff },
    history: history.map(receipt => ({ playerId: receipt.subject.playerId, receipt: ref(receipt.receiptId) })),
    finality: finality.map(receipt => ({ gameId: receipt.subject.gameId, receipt: ref(receipt.receiptId) })),
    definitions: definitions.map(receipt => ({ metricId: receipt.subject.metricId, definitionVersion: "synthetic-def-1", receipt: ref(receipt.receiptId) })),
    populations: populations.map(receipt => ({ metricId: receipt.subject.metricId, receipt: ref(receipt.receiptId) })),
  };
  return { input, bundle, history, finality, definitions, populations, retained: (): RetainedReceipt[] => [...history, ...finality, ...definitions, ...populations] };
}
type World = ReturnType<typeof world>;
const run = (w: World, retained = w.retained()) => validateEvidenceBundle(w.input, w.bundle, retained);
const codes = (result: ReturnType<typeof run>) => result.issues.map(issue => issue.code);
const reading = (result: ReturnType<typeof run>, id: MetricId) => result.card!.readings.find(r => r.id === id)!;
function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object") { Object.values(value).forEach(deepFreeze); Object.freeze(value); }
  return value;
}

describe("evidence bundle: explicitly qualified synthetic positive", () => {
  it("is eligible only when every claim resolves to a matching retained receipt", () => {
    const result = run(world());
    expect(result.issues).toEqual([]);
    expect(result.state).toBe("eligible");
    expect(Object.values(result.metrics).every(metric => metric.state === "eligible")).toBe(true);
    expect(result.card).toMatchObject({ state: "ready", liveActivation: false, premiumActivation: false, selection: { actualGp: 5, knownShort: false } });
    expect(result.card!.readings.every(r => r.state === "valid" && r.rank?.population === 3)).toBe(true);
    expect(result.card!.selection.games.every(game => game.completion.status === "verified-final" && game.completion.reference.startsWith("final-"))).toBe(true);
  });
  it("produces the same readings as the accepted adapter given the same receipt-derived proof", () => {
    const w = world(), result = run(w);
    const qualified: LocalCardInput = { ...w.input, source: { ...w.input.source, definitionReference: "evidence-bundle:synthetic-bundle", verifiedMetrics: METRICS.map(metric => metric.id) }, population: { scope: "synthetic-all-values", complete: true, reference: "evidence-bundle:synthetic-bundle", expectedPlayerIds: PLAYERS },
      players: w.input.players.map(player => ({ records: player.records, frame: { ...player.frame, completeHistory: true, historyThrough: "2026-10-24T05:00:00Z", historyReference: `history-${player.frame.playerId}`, appearances: player.frame.appearances.map(game => ({ ...game, completion: { status: "verified-final" as const, completedAt: `${game.date}T22:30:00Z`, reference: `final-${game.gameId}` } })) } })) };
    const direct = adaptLocalSnapshot(qualified, SELECTED);
    expect(direct.state).toBe("ready");
    expect(result.card!.readings).toEqual(direct.state === "rejected" ? null : direct.readings);
  });
});

describe("caller claims, hashes and row counts are not proof", () => {
  it("ignores caller complete:true / verified-final / verifiedMetrics with no receipts", () => {
    const w = world();
    const claimed: LocalCardInput = { ...w.input, source: { ...w.input.source, definitionReference: "caller-says-verified", verifiedMetrics: METRICS.map(metric => metric.id) }, population: { scope: "synthetic-all-values", complete: true, reference: "caller-says-complete", expectedPlayerIds: PLAYERS },
      players: w.input.players.map(player => ({ records: player.records, frame: { ...player.frame, completeHistory: true, historyThrough: "2026-10-24T05:00:00Z", historyReference: "caller", appearances: player.frame.appearances.map(game => ({ ...game, completion: { status: "verified-final" as const, completedAt: `${game.date}T22:30:00Z`, reference: "caller" } })) } })) };
    const empty: EvidenceBundle = { ...w.bundle, history: [], finality: [], definitions: [], populations: [] };
    const result = validateEvidenceBundle(claimed, empty, []);
    expect(result.state).toBe("incomplete");
    expect(new Set(codes(result))).toEqual(new Set(["appearance-history-missing", "game-finality-missing", "metric-definition-missing", "population-membership-missing"]));
    expect(result.card!.readings.every(r => r.state === "missing" && r.rank === null)).toBe(true);
  });
  it("treats a reference whose hash matches nothing retained as missing, and a wrong hash as rejected", () => {
    const w = world();
    const unretained = run(w, w.retained().filter(receipt => receipt.receiptId !== "history-1002"));
    expect(unretained.state).toBe("incomplete");
    expect(unretained.issues).toContainEqual(expect.objectContaining({ code: "receipt-not-retained", playerId: 1002, receiptId: "history-1002" }));
    expect(unretained.card!.readings.every(r => r.rank === null)).toBe(true);
    w.bundle = { ...w.bundle, history: w.bundle.history.map(entry => entry.playerId === 1002 ? { ...entry, receipt: { ...entry.receipt, sha256: sha("other") } } : entry) };
    expect(run(w)).toMatchObject({ state: "rejected", card: null });
    expect(codes(run(w))).toContain("receipt-hash");
  });
  it("does not accept a five-successful-rows history or ingestion completion as finality", () => {
    const w = world();
    w.history[0].subject = { ...w.history[0].subject, sourceClass: "row-count" };
    w.finality.filter(receipt => Math.floor((receipt.subject.gameId - 2026020000) / 100) === 1).forEach(receipt => { receipt.subject = { ...receipt.subject, sourceClass: "ingestion-completion" }; });
    const result = run(w);
    expect(result.state).toBe("incomplete");
    expect(result.issues).toContainEqual({ severity: "incomplete", code: "history-not-complete", reason: 'History source "row-count" does not establish complete appearance history', playerId: 1001 });
    expect(result.issues.filter(issue => issue.code === "finality-not-actual-end").map(issue => [issue.gameId, issue.reason])).toEqual(DAYS.map(day => [gameId(1001, day), "Ingestion completion is not an actual game-end time"]));
    expect(reading(result, "atoi")).toMatchObject({ state: "missing", value: null, rank: null });
  });
  it("keeps receipts with mixed origin out of a synthetic bundle", () => {
    const w = world();
    w.definitions[0] = { ...w.definitions[0], origin: "local-observed" };
    expect(codes(run(w))).toContain("receipt-origin");
  });
});

describe("identity and selection mismatches are rejected", () => {
  it.each([
    ["selection-season", (b: EvidenceBundle) => ({ ...b, selection: { ...b.selection, season: 20252026 } })],
    ["selection-strength", (b: EvidenceBundle) => ({ ...b, selection: { ...b.selection, strength: "5v5" as const } })],
    ["selection-cutoff", (b: EvidenceBundle) => ({ ...b, selection: { ...b.selection, cutoff: "2026-10-23T00:00:00Z" } })],
    ["selection-window", (b: EvidenceBundle) => ({ ...b, selection: { ...b.selection, period: { mode: "appearances" as const, count: 10 as const } } })],
    ["selection-player", (b: EvidenceBundle) => ({ ...b, selection: { ...b.selection, playerId: 9999 } })],
  ])("%s", (code, mutate) => {
    const w = world(); w.bundle = mutate(w.bundle);
    expect(run(w)).toMatchObject({ state: "rejected", card: null });
    expect(codes(run(w))).toEqual([code]);
  });
  it("rejects receipts whose subject identity differs from the reference subject", () => {
    const history = world(); history.history[1].subject = { ...history.history[1].subject, playerId: 1003 };
    expect(codes(run(history))).toContain("history-identity");
    const final = world(); final.finality[0].subject = { ...final.finality[0].subject, gameId: 2026029999 };
    expect(codes(run(final))).toContain("finality-identity");
    const season = world(); season.history[0].subject = { ...season.history[0].subject, season: 20252026 };
    expect(codes(run(season))).toContain("history-identity");
  });
  it("rejects a population built for another strength/cutoff or definition version", () => {
    const strength = world(); strength.populations[2].subject = { ...strength.populations[2].subject, strength: "pp" };
    expect(run(strength).issues).toContainEqual(expect.objectContaining({ severity: "rejected", code: "population-selection", metricId: METRICS[2].id }));
    const cutoff = world(); cutoff.populations[0].subject = { ...cutoff.populations[0].subject, cutoff: "2026-10-25T00:00:00Z" };
    expect(codes(run(cutoff))).toContain("population-selection");
    const version = world(); version.populations[0].subject = { ...version.populations[0].subject, definitionVersion: "synthetic-def-0" };
    expect(codes(run(version))).toContain("population-definition");
    const definition = world(); definition.definitions[0].subject = { ...definition.definitions[0].subject, sourceVersion: "synthetic-v0" };
    expect(codes(run(definition))).toContain("definition-mismatch");
  });
});

describe("history, finality and date evidence", () => {
  it("excludes a game whose actual end follows the cutoff instead of counting it", () => {
    const w = world();
    const last = w.finality.find(receipt => receipt.subject.gameId === gameId(SELECTED, 22))!;
    last.subject = { ...last.subject, date: "2026-10-22", endedAt: "2026-10-24T01:30:00Z" };
    last.capturedAt = "2026-10-24T06:00:00Z";
    const result = run(w);
    expect(result.state).toBe("eligible");
    expect(result.card!.selection).toMatchObject({ actualGp: 4, knownShort: true, lastDate: "2026-10-20" });
  });
  it("marks missing or short-of-cutoff appearance history incomplete", () => {
    const none = world(); none.bundle = { ...none.bundle, history: none.bundle.history.filter(entry => entry.playerId !== 1003) };
    const result = run(none);
    expect(result.state).toBe("incomplete");
    expect(result.issues).toEqual([{ severity: "incomplete", code: "appearance-history-missing", reason: "No appearance-history receipt is referenced", playerId: 1003 }]);
    expect(reading(result, "sog60")).toMatchObject({ state: "valid", rank: null, rankReason: "League rank unavailable: incomplete coverage" });
    const short = world(); short.history[0].subject = { ...short.history[0].subject, through: "2026-10-23T00:00:00Z" };
    expect(codes(run(short))).toEqual(["history-through"]);
  });
  it("flags receipt appearances absent from the frame as incomplete and extra frame appearances as rejected", () => {
    const absent = world();
    absent.history[0].subject = { ...absent.history[0].subject, appearances: [...absent.history[0].subject.appearances, { gameId: 2026020199, date: "2026-10-23", played: true }] };
    expect(run(absent).issues).toContainEqual(expect.objectContaining({ severity: "incomplete", code: "history-appearance-absent", gameId: 2026020199 }));
    const extra = world();
    extra.history[0].subject = { ...extra.history[0].subject, appearances: extra.history[0].subject.appearances.slice(1) };
    expect(codes(run(extra))).toContain("history-extra-appearance");
  });
  it("does not label a provider game date as a UTC date", () => {
    const w = world(); w.history[0].subject = { ...w.history[0].subject, dateBasis: "provider-game-date" };
    expect(run(w).issues).toEqual([{ severity: "incomplete", code: "date-basis", reason: "Game dates are not established as UTC calendar dates", playerId: 1001 }]);
  });
  it("rejects duplicate appearance dates in the receipt or the supplied frame", () => {
    const receipt = world();
    const listed = receipt.history[0].subject.appearances;
    receipt.history[0].subject = { ...receipt.history[0].subject, appearances: [...listed.slice(0, 4), { ...listed[4], date: listed[3].date }] };
    expect(run(receipt).issues).toContainEqual(expect.objectContaining({ severity: "rejected", code: "duplicate-date", playerId: 1001 }));
    const frame = world();
    const games = frame.input.players[0].frame.appearances as Appearance[];
    games[4] = { ...games[4], date: games[3].date };
    expect(codes(run(frame))).toContain("duplicate-date");
  });
});

describe("metric-specific population membership", () => {
  it("leaves only the metric with an incomplete population unranked", () => {
    const w = world(); w.populations[1].subject = { ...w.populations[1].subject, memberIds: [...PLAYERS, 1004] };
    const result = run(w);
    expect(result.state).toBe("incomplete");
    expect(result.metrics[METRICS[1].id]).toEqual({ state: "incomplete", reasons: ["1 population member(s) lack supplied card inputs: 1004", "League rank unavailable: incomplete coverage"] });
    expect(reading(result, METRICS[1].id).rank).toBeNull();
    expect(METRICS.filter((_, index) => index !== 1).every(metric => result.metrics[metric.id].state === "eligible")).toBe(true);
  });
  it("ranks each metric against its own verified population", () => {
    const w = world(); w.populations[0].subject = { ...w.populations[0].subject, memberIds: [1001, 1002] };
    const result = run(w);
    expect(result.state).toBe("eligible");
    expect(reading(result, METRICS[0].id).rank?.population).toBe(2);
    expect(reading(result, METRICS[1].id).rank?.population).toBe(3);
  });
  it("rejects a population that excludes the selected player and does not accept a position-filtered pool", () => {
    const excluded = world(); excluded.populations[0].subject = { ...excluded.populations[0].subject, memberIds: [1002, 1003] };
    expect(codes(run(excluded))).toContain("population-selected-player");
    const filtered = world(); filtered.populations[0].subject = { ...filtered.populations[0].subject, sourceClass: "ingestion-position-filter" };
    expect(run(filtered).metrics[METRICS[0].id].state).toBe("incomplete");
  });
});

describe("valid zero versus undefined or missing", () => {
  const variant = (individual: Partial<Components["individual"]>) => (playerId: number): Components => {
    const base = components(playerId);
    return playerId === SELECTED ? { ...base, individual: { ...base.individual, ...individual } } : base;
  };
  it("keeps a measured zero valid and ranked when zero semantics are verified", () => {
    const result = run(world({ components: variant({ goals: 0 }) }));
    expect(result.state).toBe("eligible");
    expect(reading(result, "shPct")).toMatchObject({ state: "valid", value: 0, rank: { ordinal: 3, population: 3 } });
  });
  it("keeps a zero-denominator metric undefined, not zero and not missing", () => {
    const result = run(world({ components: variant({ shots: 0, goals: 0 }) }));
    expect(result.metrics.shPct).toEqual({ state: "eligible", reasons: [] });
    expect(reading(result, "shPct")).toMatchObject({ state: "undefined", value: null, rank: null });
    expect(reading(result, "sog60")).toMatchObject({ state: "valid", value: 0 });
  });
  it("keeps a missing component missing", () => {
    const result = run(world({ components: variant({ goals: null }) }));
    expect(result.state).toBe("incomplete");
    expect(result.metrics.shPct).toEqual({ state: "incomplete", reasons: ["Required component is missing, invalid or has incompatible TOI units"] });
    expect(reading(result, "shPct")).toMatchObject({ state: "missing", value: null, rank: null });
  });
  it("does not treat stored zeros as measured when provider placeholder semantics are unverified", () => {
    const w = world(); const index = METRICS.findIndex(metric => metric.id === "shPct");
    w.definitions[index].subject = { ...w.definitions[index].subject, zeroSemantics: "placeholder-coerced" };
    const result = run(w);
    expect(result.metrics.shPct.state).toBe("incomplete");
    expect(reading(result, "shPct")).toMatchObject({ state: "missing", reason: "Metric provider/model definition is unverified" });
  });
});

describe("existing adapter behaviour is unchanged", () => {
  it("does not mutate supplied inputs or receipts and leaves direct adapter output identical", () => {
    const w = world();
    const before = adaptLocalSnapshot(w.input, SELECTED);
    deepFreeze(w);
    expect(() => run(w)).not.toThrow();
    expect(adaptLocalSnapshot(w.input, SELECTED)).toEqual(before);
    expect(before).toMatchObject({ state: "unavailable" });
  });
});
