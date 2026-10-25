// @vitest-environment node
import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm, unlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CardSettings, MetricId } from "./contracts";
import type { LocalCardInput } from "./adapter";
import type { Components, GameMetricRecord } from "./aggregation";
import type { Admission, VerifiedClaim } from "./evidenceAdmissions";
import type { EvidenceBundle, EvidenceResult } from "./evidenceBundle";
import { loadAdmittedEvidence, validateAdmittedEvidence, type AdmittedEvidence } from "./evidenceLoader";
import { METRICS, REGISTRY_VERSION } from "./registry";
import type { Appearance } from "./windows";

// The reviewed ledger stays as shipped; tests append SYNTHETIC admissions for files they write and remove them afterwards.
const ledger = vi.hoisted(() => [] as Admission[]);
vi.mock("./evidenceAdmissions", async importOriginal => {
  const actual = await importOriginal<typeof import("./evidenceAdmissions")>();
  ledger.push(...actual.EVIDENCE_ADMISSIONS);
  return { ...actual, EVIDENCE_ADMISSIONS: ledger };
});
const REVIEWED = [...ledger];
const sha = (bytes: ArrayLike<number>) => createHash("sha256").update(new Uint8Array(bytes)).digest("hex");
const codes = (result: EvidenceResult) => result.issues.map(issue => issue.code);
const ranked = (result: EvidenceResult) => result.card?.readings.filter(reading => reading.rank !== null).length ?? 0;

// SYNTHETIC: every player, game, value and receipt below is fabricated. Nothing here is NHL/NST evidence.
const settings: CardSettings = { season: 20262027, gameType: "regular", strength: "all", cutoff: "2026-10-24T00:00:00Z", period: { mode: "appearances", count: 5 }, seasonPolicy: "season-only-proposed", shortSamplePolicy: "allow-known-short-proposed", rankPolicy: "competition-midrank-proposed" };
const PLAYERS = [1001, 1002, 1003];
const DAYS = [14, 16, 18, 20, 22];
const SELECTED = 1001;
const date = (day: number) => `2026-10-${String(day).padStart(2, "0")}`;
const gameId = (playerId: number, day: number) => 2026020000 + (playerId - 1000) * 100 + day;
const components = (playerId: number): Components => {
  const k = playerId - 1000;
  return { toiUnit: "seconds", individual: { toi: 1000 + 100 * k, shots: 2 + k, icf: 4 + k, iscfs: 1 + k, ixg: 0.1 * k, total_points: 1, goals: 1 }, onIce: { toi: 1000 + 100 * k, cf: 15 + k, scf: 6 + k, xgf: 0.5 + 0.1 * k, xga: 0.6, gf: 2, sf: 12 + k } };
};
const syntheticInput = (): LocalCardInput => ({
  id: "synthetic-card-input", origin: "synthetic", capturedAt: "2026-10-24T04:00:00Z", settings,
  source: { definition: "synthetic-nst-contract", version: "synthetic-v1", definitionReference: "", verifiedMetrics: [] },
  population: { scope: "synthetic-all-values", complete: false, reference: "", expectedPlayerIds: PLAYERS },
  players: PLAYERS.map(playerId => {
    const appearances: Appearance[] = DAYS.map(day => ({ playerId, gameId: gameId(playerId, day), season: 20262027, gameType: "regular", date: date(day), played: true, completion: { status: "unverified" } }));
    const records: GameMetricRecord[] = appearances.map(game => ({ ...components(playerId), playerId, gameId: game.gameId, season: game.season, date: game.date, strength: "all", sourceDefinition: "synthetic-nst-contract", sourceVersion: "synthetic-v1", capturedAt: "2026-10-24T03:00:00Z", state: "ready" }));
    return { frame: { playerId, season: 20262027, gameType: "regular" as const, dateBasis: "UTC" as const, completeHistory: false, historyThrough: "", historyReference: "", appearances }, records };
  }),
});

/** One retained file: its JSON body (self-labels included, as a producer would write them) and the claims its review verified. */
type Spec = { name: string; kind: "history" | "finality" | "definition" | "population"; key: number | MetricId; body: { receiptId: string; subject: Record<string, unknown> } & Record<string, unknown>; claims: VerifiedClaim[]; authority?: string };
const envelope = (kind: string, receiptId: string, subject: Record<string, unknown>) => ({ kind, receiptId, origin: "synthetic", capturedAt: "2026-10-24T06:00:00Z", subject });
function specs(): Spec[] {
  return [
    ...PLAYERS.map((playerId): Spec => ({ name: `history-${playerId}.json`, kind: "history", key: playerId,
      body: envelope("appearance-history", `history-${playerId}`, { playerId, season: 20262027, gameType: "regular", dateBasis: "UTC", sourceClass: "complete-official-log", through: "2026-10-24T05:00:00Z", appearances: DAYS.map(day => ({ gameId: gameId(playerId, day), date: date(day), played: true })) }),
      claims: [{ receiptId: `history-${playerId}`, kind: "appearance-history", sourceClass: "complete-official-log", dateBasis: "UTC" }] })),
    ...PLAYERS.flatMap(playerId => DAYS.map((day): Spec => ({ name: `final-${gameId(playerId, day)}.json`, kind: "finality", key: gameId(playerId, day),
      body: envelope("game-finality", `final-${gameId(playerId, day)}`, { gameId: gameId(playerId, day), season: 20262027, date: date(day), endedAt: `${date(day)}T22:30:00Z`, sourceClass: "official-game-end" }),
      claims: [{ receiptId: `final-${gameId(playerId, day)}`, kind: "game-finality", sourceClass: "official-game-end" }] }))),
    ...METRICS.map((metric): Spec => ({ name: `definition-${metric.id}.json`, kind: "definition", key: metric.id,
      body: envelope("metric-definition", `definition-${metric.id}`, { metricId: metric.id, registryVersion: REGISTRY_VERSION, sourceDefinition: "synthetic-nst-contract", sourceVersion: "synthetic-v1", definitionVersion: "synthetic-def-1", zeroSemantics: "verified-distinct" }),
      claims: [{ receiptId: `definition-${metric.id}`, kind: "metric-definition", zeroSemantics: "verified-distinct" }] })),
    ...METRICS.map((metric): Spec => ({ name: `population-${metric.id}.json`, kind: "population", key: metric.id,
      body: envelope("population-membership", `population-${metric.id}`, { metricId: metric.id, scope: "synthetic-all-values", definitionVersion: "synthetic-def-1", sourceClass: "metric-population-inventory", season: 20262027, gameType: "regular", strength: "all", period: { mode: "appearances", count: 5 }, cutoff: settings.cutoff, memberIds: PLAYERS }),
      claims: [{ receiptId: `population-${metric.id}`, kind: "population-membership", sourceClass: "metric-population-inventory" }] })),
  ];
}

const roots: string[] = [];
/** Writes the files, pins a SYNTHETIC admission for each spec that has claims, and builds the card's bundle from the written bytes. */
async function stage(mutate: (files: Spec[]) => void = () => {}) {
  const root = await mkdtemp(path.join(tmpdir(), "pc-evidence-loader-"));
  roots.push(root);
  const files = specs();
  mutate(files);
  const refs = new Map<string, string>();
  for (const file of files) {
    const bytes = new TextEncoder().encode(JSON.stringify(file.body));
    await writeFile(path.join(root, file.name), bytes);
    refs.set(file.name, sha(bytes));
    if (file.claims.length) ledger.push({ path: file.name, sha256: sha(bytes), format: "receipt-v1", origin: "synthetic", authority: file.authority ?? "SYNTHETIC", claims: file.claims });
  }
  const entry = (kind: Spec["kind"]) => files.filter(file => file.kind === kind).map(file => ({ key: file.key, receipt: { receiptId: file.body.receiptId, sha256: refs.get(file.name)! } }));
  const bundle: EvidenceBundle = {
    id: "synthetic-bundle", origin: "synthetic",
    selection: { playerId: SELECTED, season: 20262027, gameType: "regular", strength: "all", period: { mode: "appearances", count: 5 }, cutoff: settings.cutoff },
    history: entry("history").map(({ key, receipt }) => ({ playerId: key as number, receipt })),
    finality: entry("finality").map(({ key, receipt }) => ({ gameId: key as number, receipt })),
    definitions: entry("definition").map(({ key, receipt }) => ({ metricId: key as MetricId, definitionVersion: "synthetic-def-1", receipt })),
    populations: entry("population").map(({ key, receipt }) => ({ metricId: key as MetricId, receipt })),
  };
  return { root, bundle, input: syntheticInput(), load: () => loadAdmittedEvidence({ root, origin: "synthetic" }) };
}
beforeEach(() => { ledger.splice(0, ledger.length, ...REVIEWED); });
afterEach(async () => { await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true }))); });
const edit = (files: Spec[], name: string, change: (file: Spec) => void) => change(files.find(file => file.name === name)!);

describe("trusted loader: genuinely admitted evidence", () => {
  it("hashes and parses the retained bytes and makes a fully admitted synthetic card eligible", async () => {
    const { root, bundle, input, load } = await stage();
    const evidence = await load();
    expect(evidence.issues).toEqual([]);
    expect(evidence.receipts).toHaveLength(3 + 15 + 12 + 12);
    for (const receipt of evidence.receipts) expect(receipt.sha256).toBe(sha(await readFile(path.join(root, receipt.retainedPath))));
    const result = validateAdmittedEvidence(input, bundle, evidence);
    expect(result).toMatchObject({ state: "eligible", issues: [], liveActivation: false, premiumActivation: false });
    expect(result.card!.readings.every(reading => reading.state === "valid" && reading.rank?.population === 3)).toBe(true);
    expect(result.card!.selection.games.every(game => game.completion.status === "verified-final")).toBe(true);
  });
  it("admits nothing when the reviewed ledger has no entry for the origin", async () => {
    const { bundle, input } = await stage();
    ledger.splice(0, ledger.length, ...REVIEWED);
    const result = validateAdmittedEvidence(input, bundle, await loadAdmittedEvidence({ root: tmpdir(), origin: "synthetic" }));
    expect(result.state).toBe("incomplete");
    expect(new Set(codes(result))).toEqual(new Set(["receipt-not-retained"]));
    expect(ranked(result)).toBe(0);
  });
});

describe("trusted loader: a caller-built index is rejected", () => {
  it("rejects plain objects, copies and JSON clones of admitted receipts", async () => {
    const { bundle, input, load } = await stage();
    const evidence = await load();
    const forged = [
      { ...evidence },
      { origin: "synthetic", receipts: JSON.parse(JSON.stringify(evidence.receipts)), issues: [] },
    ] as unknown as AdmittedEvidence[];
    for (const index of forged) {
      const result = validateAdmittedEvidence(input, bundle, index);
      expect(result).toMatchObject({ state: "rejected", card: null });
      expect(result.issues[0]).toMatchObject({ severity: "rejected", code: "untrusted-evidence" });
      expect(Object.values(result.metrics).every(metric => metric.state === "rejected")).toBe(true);
    }
  });
  it("freezes the admitted handle so labels cannot be raised after loading", async () => {
    const { load } = await stage(files => edit(files, "final-2026020114.json", file => {
      file.body.subject.sourceClass = "ingestion-completion";
      file.claims = [{ receiptId: "final-2026020114", kind: "game-finality", sourceClass: "ingestion-completion" }];
    }));
    const evidence = await load();
    const receipt = evidence.receipts.find(entry => entry.receiptId === "final-2026020114")!;
    expect(() => { (receipt.subject as { sourceClass: string }).sourceClass = "official-game-end"; }).toThrow(TypeError);
    expect(() => { (evidence.receipts as unknown[]).push(receipt); }).toThrow(TypeError);
  });
});

describe("trusted loader: bytes, files and labels are not verification", () => {
  it("does not admit tampered bytes, even a whitespace-only rewrite of a pinned file", async () => {
    const { root, bundle, input, load } = await stage();
    const name = `final-${gameId(1002, 18)}.json`;
    await writeFile(path.join(root, name), JSON.stringify(JSON.parse(await readFile(path.join(root, name), "utf8")), null, 2));
    const result = validateAdmittedEvidence(input, bundle, await load());
    expect(result.state).toBe("incomplete");
    expect(result.issues).toContainEqual(expect.objectContaining({ code: "receipt-not-retained", gameId: gameId(1002, 18) }));
    expect(result.issues).toContainEqual(expect.objectContaining({ severity: "incomplete", code: "retained-bytes-mismatch", receiptId: `final-${gameId(1002, 18)}` }));
    expect(ranked(result)).toBe(0);
  });
  it("leaves a card incomplete when an admitted receipt's file is missing", async () => {
    const { root, bundle, input, load } = await stage();
    await unlink(path.join(root, "history-1003.json"));
    const result = validateAdmittedEvidence(input, bundle, await load());
    expect(result.state).toBe("incomplete");
    expect(result.issues).toContainEqual(expect.objectContaining({ code: "receipt-not-retained", playerId: 1003 }));
    expect(result.issues).toContainEqual(expect.objectContaining({ code: "retained-file-missing", receiptId: "history-1003" }));
    expect(ranked(result)).toBe(0);
  });
  it("never reads a self-labelled file that has no admission", async () => {
    const { bundle, input, load } = await stage(files => edit(files, "final-2026020114.json", file => { file.claims = []; }));
    const evidence = await load();
    expect(evidence.receipts.some(receipt => receipt.receiptId === "final-2026020114")).toBe(false);
    const result = validateAdmittedEvidence(input, bundle, evidence);
    expect(result.state).toBe("incomplete");
    expect(result.issues).toContainEqual(expect.objectContaining({ code: "receipt-not-retained", gameId: 2026020114 }));
    expect(ranked(result)).toBe(0);
  });
  it("writes the reviewed label, not the file's own, when a file claims more than was verified", async () => {
    const { bundle, input, load } = await stage(files => {
      edit(files, "final-2026020114.json", file => { file.claims = [{ receiptId: "final-2026020114", kind: "game-finality", sourceClass: "ingestion-completion" }]; });
      edit(files, "definition-atoi.json", file => { file.claims = [{ receiptId: "definition-atoi", kind: "metric-definition", zeroSemantics: "unknown" }]; });
    });
    const evidence = await load();
    expect(evidence.receipts.find(receipt => receipt.receiptId === "final-2026020114")!.subject).toMatchObject({ sourceClass: "ingestion-completion" });
    const result = validateAdmittedEvidence(input, bundle, evidence);
    expect(result.state).toBe("incomplete");
    expect(result.issues).toContainEqual(expect.objectContaining({ code: "finality-not-actual-end", gameId: 2026020114 }));
    expect(result.issues).toContainEqual(expect.objectContaining({ code: "self-label-unverified", receiptId: "final-2026020114", reason: 'File asserts sourceClass "official-game-end"; review verified only "ingestion-completion"' }));
    expect(result.issues).toContainEqual(expect.objectContaining({ code: "zero-semantics", metricId: "atoi" }));
    expect(ranked(result)).toBe(0);
  });
  it.each([
    ["self-label-conflict", (files: Spec[]) => edit(files, "history-1002.json", file => { file.body.subject.sourceClass = "latest-n"; })],
    ["admission-authority", (files: Spec[]) => edit(files, "history-1002.json", file => { file.authority = "CODEX-20261025-080"; })],
    ["claim-absent", (files: Spec[]) => edit(files, "history-1002.json", file => { file.body.receiptId = "history-1002-other"; })],
    ["claim-identity", (files: Spec[]) => edit(files, "history-1002.json", file => { file.body.origin = "local-observed"; })],
    ["retained-schema", (files: Spec[]) => edit(files, "history-1002.json", file => { file.body.sha256 = "0".repeat(64); })],
    ["retained-schema", (files: Spec[]) => edit(files, "history-1002.json", file => { delete file.body.subject.through; })],
    ["claim-label", (files: Spec[]) => edit(files, "history-1002.json", file => { file.claims = [{ receiptId: "history-1002", kind: "appearance-history", sourceClass: "complete-official-log" } as VerifiedClaim]; })],
  ])("does not admit history-1002 on %s", async (code, mutate) => {
    const { bundle, input, load } = await stage(mutate);
    const evidence = await load();
    expect(evidence.receipts.some(receipt => receipt.receiptId === "history-1002")).toBe(false);
    expect(evidence.issues).toContainEqual(expect.objectContaining({ code, receiptId: "history-1002" }));
    const result = validateAdmittedEvidence(input, bundle, evidence);
    expect(result.state).toBe("incomplete");
    expect(ranked(result)).toBe(0);
  });
});

describe("existing five-row completion read (reviewed ledger, real retained bytes)", () => {
  const ROOT = fileURLToPath(new URL("./__fixtures__/retained", import.meta.url));
  const FILE = "player-cards-2026-10-25/completion-read-01/RESULT.json";
  const GAMES = [[2026020095, "2026-10-13"], [2026020111, "2026-10-15"], [2026020123, "2026-10-17"], [2026020151, "2026-10-20"], [2026020167, "2026-10-23"]] as const;
  // Local test frame: the retained rows identify games only, so the frame's player id is a placeholder.
  const observed = (): { input: LocalCardInput; bundle: EvidenceBundle } => {
    const cutoff = "2026-10-25T00:00:00Z", period = { mode: "appearances" as const, count: 5 as const };
    const appearances: Appearance[] = GAMES.map(([id, day]) => ({ playerId: 1, gameId: id, season: 20262027, gameType: "regular", date: day, played: true, completion: { status: "unverified" } }));
    return {
      input: { id: "five-row-check", origin: "local-observed", capturedAt: "2026-10-25T06:10:23Z", settings: { ...settings, cutoff, period },
        source: { definition: "local-observed-check", version: "v0", definitionReference: "", verifiedMetrics: [] },
        population: { scope: "all-nhl", complete: false, reference: "", expectedPlayerIds: [1] },
        players: [{ frame: { playerId: 1, season: 20262027, gameType: "regular", dateBasis: "UTC", completeHistory: false, historyThrough: "", historyReference: "", appearances }, records: [] }] },
      bundle: { id: "five-row-bundle", origin: "local-observed", selection: { playerId: 1, season: 20262027, gameType: "regular", strength: "all", period, cutoff },
        history: [], definitions: [], populations: [],
        finality: GAMES.map(([id]) => ({ gameId: id, receipt: { receiptId: `${FILE}#game-${id}`, sha256: "6ee7b37d6f6d075557d9987599043ba09320ca9d66e9c9a6bbdf75bf5dd5dae2" } })) },
    };
  };

  it("keeps the retained bytes identical to the CODEX-080 pin", async () => {
    expect(sha(await readFile(path.join(ROOT, FILE)))).toBe("6ee7b37d6f6d075557d9987599043ba09320ca9d66e9c9a6bbdf75bf5dd5dae2");
  });
  it("admits the five rows only as ingestion observed, never as game ended", async () => {
    const evidence = await loadAdmittedEvidence({ root: ROOT, origin: "local-observed" });
    expect(evidence.issues).toEqual([]);
    expect(evidence.receipts.map(receipt => [receipt.kind, receipt.subject])).toEqual(GAMES.map(([id, day]) => ["game-finality", expect.objectContaining({ gameId: id, date: day, season: 20262027, sourceClass: "ingestion-completion" })]));
    expect(evidence.receipts.at(-1)!.subject).toMatchObject({ endedAt: "2026-10-24T10:20:04.585Z" });
    const { input, bundle } = observed();
    const result = validateAdmittedEvidence(input, bundle, evidence);
    expect(result).toMatchObject({ state: "incomplete", liveActivation: false, premiumActivation: false });
    expect(result.issues.filter(issue => issue.code === "finality-not-actual-end").map(issue => [issue.gameId, issue.reason])).toEqual(GAMES.map(([id]) => [id, "Ingestion completion is not an actual game-end time"]));
    expect(result.card!.selection.games.some(game => game.completion.status === "verified-final")).toBe(false);
    expect(ranked(result)).toBe(0);
  });
  it("refuses an admission that would read the rows as game ended", async () => {
    ledger.splice(0, ledger.length, { ...REVIEWED[0], claims: [{ receiptId: `${FILE}#game-2026020095`, kind: "game-finality", sourceClass: "official-game-end" }] });
    const evidence = await loadAdmittedEvidence({ root: ROOT, origin: "local-observed" });
    expect(evidence.receipts).toEqual([]);
    expect(evidence.issues).toEqual([expect.objectContaining({ code: "authority-exceeds-format", receiptId: `${FILE}#game-2026020095` })]);
    const { input, bundle } = observed();
    expect(validateAdmittedEvidence(input, bundle, evidence).issues).toContainEqual(expect.objectContaining({ code: "receipt-not-retained", gameId: 2026020095 }));
  });
});
