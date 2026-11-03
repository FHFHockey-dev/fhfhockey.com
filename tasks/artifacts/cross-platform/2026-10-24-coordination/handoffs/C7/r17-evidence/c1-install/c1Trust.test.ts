// @vitest-environment node
// C7 adversarial controls for C1 evidenceBundle (installed 9dbc55afb). Fixture lines copied from the owner test (synthetic only).
import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import type { CardSettings, MetricId } from "lib/player-cards/contracts";
import { METRICS, REGISTRY_VERSION } from "lib/player-cards/registry";
import { adaptLocalSnapshot, type LocalCardInput } from "lib/player-cards/adapter";
import type { Components, GameMetricRecord } from "lib/player-cards/aggregation";
import type { Appearance } from "lib/player-cards/windows";
import { validateEvidenceBundle, type DefinitionReceipt, type EvidenceBundle, type FinalityReceipt, type HistoryReceipt, type PopulationReceipt, type ReceiptRef, type RetainedReceipt } from "lib/player-cards/evidenceBundle";

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
import { afterAll } from "vitest";
import { writeFileSync } from "node:fs";
const observed: Record<string, unknown> = {};
afterAll(() => { if (process.env.C7_C1_OUT) writeFileSync(process.env.C7_C1_OUT, JSON.stringify(observed, null, 2)); });
const ranks = (r: ReturnType<typeof run>) => r.card ? r.card.readings.filter(x => x.rank).length : 0;
const note = (k: string, r: ReturnType<typeof run>) => { observed[k] = { state: r.state, ranks: ranks(r), codes: [...new Set(codes(r))] }; return r; };
describe("C7 C1 trust controls", () => {
  it("A0 baseline: the full synthetic world is eligible with ranks", () => { const r = note("A0", run(world())); expect(r.state).toBe("eligible"); expect(ranks(r)).toBeGreaterThan(0); });
  it("A1 hash-only: refs match but every retained entry has an empty retainedPath → no ranks", () => {
    const w = world(); const r = note("A1", run(w, w.retained().map(x => ({ ...x, retainedPath: "" })))); expect(ranks(r)).toBe(0); expect(r.state).not.toBe("eligible"); });
  it("A2 references only: nothing retained → no ranks", () => { const w = world(); const r = note("A2", run(w, [])); expect(ranks(r)).toBe(0); });
  it("A3 caller proof flags with nothing retained → no ranks", () => {
    const w = world(); const input: any = { ...w.input, population: { ...w.input.population, complete: true, reference: "caller" }, source: { ...w.input.source, definitionReference: "caller", verifiedMetrics: METRICS.map(m => m.id) },
      players: w.input.players.map(p => ({ ...p, frame: { ...p.frame, completeHistory: true, historyThrough: "2026-10-24T05:00:00Z", historyReference: "caller", appearances: p.frame.appearances.map(g => ({ ...g, completion: { status: "verified-final", completedAt: `${g.date}T22:30:00Z`, reference: "caller" } })) } })) };
    const r = note("A3", validateEvidenceBundle(input, w.bundle, [])); expect(ranks(r)).toBe(0); });
  it("A4 one non-selected pool member's history is latest-n → no ranks for anyone", () => {
    const w = world(); w.history[1].subject = { ...w.history[1].subject, sourceClass: "latest-n" }; const r = note("A4", run(w)); expect(ranks(r)).toBe(0); });
  it("A5 one non-selected member's game has only ingestion-completion finality → no ranks", () => {
    const w = world(); const f = w.finality.find(x => x.subject.gameId === gameId(1002, 22))!; f.subject = { ...f.subject, sourceClass: "ingestion-completion" }; const r = note("A5", run(w)); expect(ranks(r)).toBe(0); });
  it("A6 roster-snapshot population for every metric → no ranks", () => {
    const w = world(); w.populations.forEach(p => { p.subject = { ...p.subject, sourceClass: "roster-snapshot" }; }); const r = note("A6", run(w)); expect(ranks(r)).toBe(0); });
  it("A7 duplicate retained id (one good, one forged) → rejected, no card", () => {
    const w = world(); const forged = { ...w.history[0], retainedPath: "forged.json" }; const r = note("A7", run(w, [...w.retained(), forged])); expect(r.state).toBe("rejected"); expect(r.card).toBeNull(); });
  it("A8 one history receipt reused for two players → rejected", () => {
    const w = world(); (w.bundle as any).history = w.bundle.history.map(h => h.playerId === 1002 ? { ...h, receipt: ref("history-1001") } : h); const r = note("A8", run(w)); expect(r.state).toBe("rejected"); expect(ranks(r)).toBe(0); });
  it("A9 one metric lacks a definition receipt → that metric has no rank; others may", () => {
    const w = world(); const id = METRICS[0].id; (w.bundle as any).definitions = w.bundle.definitions.filter(d => d.metricId !== id); const r = note("A9", run(w));
    expect(r.card!.readings.find(x => x.id === id)!.rank).toBeNull(); expect(r.metrics[id].state).toBe("incomplete"); });
  it("A10 zero semantics placeholder-coerced on one metric → no rank for that metric", () => {
    const w = world(); const id = METRICS[1].id; const d = w.definitions.find(x => x.subject.metricId === id)!; d.subject = { ...d.subject, zeroSemantics: "placeholder-coerced" }; const r = note("A10", run(w));
    expect(r.card!.readings.find(x => x.id === id)!.rank).toBeNull(); });
  it("A11 F1 by construction: a caller-built index carrying the right self-labels is indistinguishable from admitted receipts", () => {
    const w = world(); const callerBuilt = JSON.parse(JSON.stringify(w.retained())); const r = note("A11", run(w, callerBuilt)); expect(r.state).toBe("eligible"); expect(ranks(r)).toBeGreaterThan(0); });
  it("A12 a history receipt claiming coverage after its own capture → rejected", () => {
    const w = world(); w.history[0].subject = { ...w.history[0].subject, through: "2026-10-24T07:00:00Z" }; const r = note("A12", run(w)); expect(r.state).toBe("rejected"); });
});
