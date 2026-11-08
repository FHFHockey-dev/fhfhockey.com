// @vitest-environment node
// C7 adversarial controls for the PC retained-evidence loader. Synthetic files only, written to a temp root.
import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm, writeFile, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, afterEach, describe, expect, it, vi } from "vitest";
import { writeFileSync } from "node:fs";
import type { Admission } from "lib/player-cards/evidenceAdmissions";
const ledger = vi.hoisted(() => [] as any[]);
vi.mock("lib/player-cards/evidenceAdmissions", async o => { const a: any = await o(); ledger.push(...a.EVIDENCE_ADMISSIONS); return { ...a, EVIDENCE_ADMISSIONS: ledger }; });
import { loadAdmittedEvidence, validateAdmittedEvidence } from "lib/player-cards/evidenceLoader";
const REVIEWED = [...ledger];
const W = "/Users/tim/Code/fhfhockey.com/web", FIXTURE_ROOT = `${W}/lib/player-cards/__fixtures__/retained`;
const observed: Record<string, unknown> = {};
afterAll(() => { if (process.env.C7_PC_OUT) writeFileSync(process.env.C7_PC_OUT, JSON.stringify(observed, null, 2)); });
afterEach(() => { ledger.splice(0, ledger.length, ...REVIEWED); });
const sha = (b: Uint8Array) => createHash("sha256").update(b).digest("hex");
const enc = (v: unknown) => new TextEncoder().encode(JSON.stringify(v));
async function root(files: Record<string, Uint8Array>) { const r = await mkdtemp(path.join(tmpdir(), "c7-pc-")); for (const [p, b] of Object.entries(files)) { await mkdir(path.dirname(path.join(r, p)), { recursive: true }); await writeFile(path.join(r, p), b); } return r; }
const finality = (receiptId: string, origin: string, extra: Record<string, unknown> = {}, envelopeExtra: Record<string, unknown> = {}) => ({ kind: "game-finality", receiptId, origin, capturedAt: "2026-10-24T06:00:00Z", subject: { gameId: 2026029001, season: 20262027, date: "2026-10-20", endedAt: "2026-10-20T22:30:00Z", ...extra }, ...envelopeExtra });
const adm = (p: string, bytes: Uint8Array, origin: string, authority: string, claims: any[], format = "receipt-v1"): Admission => ({ path: p, sha256: sha(bytes), format: format as any, origin: origin as any, authority, claims });
const codes = (e: any) => e.issues.map((i: any) => i.code);

describe("C7 PC loader", () => {
  it("K1 only the exact issued object passes: Proxy, Object.create, structuredClone and spread are rejected", async () => {
    const ev = await loadAdmittedEvidence({ root: FIXTURE_ROOT, origin: "local-observed" });
    // run1 used a settings-less dummy input, which made the validator throw (reviewer error); use well-formed settings.
    const settings = { season: 20262027, gameType: "regular", strength: "all", cutoff: "2026-10-24T00:00:00Z", period: { mode: "appearances", count: 5 }, seasonPolicy: "season-only-proposed", shortSamplePolicy: "allow-known-short-proposed", rankPolicy: "competition-midrank-proposed" };
    const dummyInput: any = { id: "c7", origin: "local-observed", capturedAt: "2026-10-24T04:00:00Z", settings, source: { definition: "d", version: "v", definitionReference: "", verifiedMetrics: [] }, population: { scope: "all-nhl", complete: false, reference: "", expectedPlayerIds: [1] },
      players: [{ frame: { playerId: 1, season: 20262027, gameType: "regular", dateBasis: "UTC", completeHistory: false, historyThrough: "", historyReference: "", appearances: [] }, records: [] }] };
    const dummyBundle: any = { id: "b", origin: "local-observed", selection: { playerId: 1, season: 20262027, gameType: "regular", strength: "all", period: settings.period, cutoff: settings.cutoff }, history: [], finality: [], definitions: [], populations: [] };
    const genuine = validateAdmittedEvidence(dummyInput, dummyBundle, ev); observed.K1genuine = { state: genuine.state, firstCode: genuine.issues[0]?.code ?? null };
    const variants: Record<string, any> = { proxy: new Proxy(ev, {}), objectCreate: Object.create(ev), clone: structuredClone(ev), spread: { ...ev } };
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(variants)) { const r = validateAdmittedEvidence(dummyInput, dummyBundle, v); out[k] = `${r.state}:${r.issues[0]?.code}:${r.card === null}`; }
    observed.K1 = out;
    for (const v of Object.values(out)) expect(v).toBe("rejected:untrusted-evidence:true");
  });
  it("K2 real ledger + fixture: exactly 5 game-finality receipts, ingestion-completion, endedAt = ingestion time (not scheduled start)", async () => {
    const ev: any = await loadAdmittedEvidence({ root: FIXTURE_ROOT, origin: "local-observed" });
    const rows = JSON.parse(await readFile(`${FIXTURE_ROOT}/player-cards-2026-10-25/completion-read-01/RESULT.json`, "utf8"));
    const bad = ev.receipts.filter((r: any) => { const row = rows.find((x: any) => x.matched_game_id === r.subject.gameId);
      return r.kind !== "game-finality" || r.subject.sourceClass !== "ingestion-completion" || !row || Date.parse(r.subject.endedAt) !== Date.parse(row.ingestion_completed_at.replace(" ", "T").replace("+00", "Z")); });
    observed.K2 = { receipts: ev.receipts.length, issues: codes(ev), bad: bad.length, sample: ev.receipts[0] };
    expect(ev.receipts).toHaveLength(5); expect(bad).toEqual([]); expect(Object.isFrozen(ev.receipts[0].subject)).toBe(true);
  });
  it("K3 authority, path and duplicate gates", async () => {
    const b = enc(finality("f-1", "synthetic")), b2 = enc(finality("f-2", "local-observed"));
    const r = await root({ "a/f1.json": b, "a/f2.json": b2 });
    const claim = (id: string) => ({ receiptId: id, kind: "game-finality", sourceClass: "official-game-end" });
    const cases: Record<string, any> = {};
    ledger.push(adm("a/f1.json", b, "synthetic", "CODEX-20261025-080", [claim("f-1")])); cases.syntheticWithCodexAuthority = await loadAdmittedEvidence({ root: r, origin: "synthetic" }); ledger.splice(REVIEWED.length);
    ledger.push(adm("a/f2.json", b2, "local-observed", "SYNTHETIC", [claim("f-2")])); cases.observedWithSyntheticAuthority = await loadAdmittedEvidence({ root: r, origin: "local-observed" }); ledger.splice(REVIEWED.length);
    ledger.push(adm("a/f2.json", b2, "local-observed", "CODEX-2026-1", [claim("f-2")])); cases.malformedAuthority = await loadAdmittedEvidence({ root: r, origin: "local-observed" }); ledger.splice(REVIEWED.length);
    ledger.push(adm("../a/f1.json", b, "synthetic", "SYNTHETIC", [claim("f-1")])); cases.traversal = await loadAdmittedEvidence({ root: r, origin: "synthetic" }); ledger.splice(REVIEWED.length);
    ledger.push(adm("a/f1.json", b, "synthetic", "SYNTHETIC", [claim("f-1")]), adm("a/f1.json", b, "synthetic", "SYNTHETIC", [claim("f-1")])); cases.duplicate = await loadAdmittedEvidence({ root: r, origin: "synthetic" }); ledger.splice(REVIEWED.length);
    ledger.push(adm("a/f1.json", b, "synthetic", "SYNTHETIC", [claim("f-1")])); cases.good = await loadAdmittedEvidence({ root: r, origin: "synthetic" });
    await rm(r, { recursive: true });
    observed.K3 = Object.fromEntries(Object.entries(cases).map(([k, v]: any) => [k, { receipts: v.receipts.length, codes: codes(v) }]));
    expect(cases.syntheticWithCodexAuthority.receipts).toHaveLength(0); expect(cases.observedWithSyntheticAuthority.receipts.filter((x: any) => x.receiptId === "f-2")).toHaveLength(0);
    expect(cases.malformedAuthority.receipts.filter((x: any) => x.receiptId === "f-2")).toHaveLength(0); expect(cases.traversal.receipts).toHaveLength(0); expect(cases.duplicate.receipts).toHaveLength(0); expect(cases.good.receipts).toHaveLength(1);
  });
  it("K4 self-labels: file says official-game-end but review verified ingestion-completion → admitted at the reviewed label; reverse → conflict, not admitted; envelope sha256 → schema refusal; tampered byte → mismatch", async () => {
    const up = enc(finality("f-up", "synthetic", { sourceClass: "official-game-end" })), down = enc(finality("f-down", "synthetic", { sourceClass: "ingestion-completion" }));
    const extra = enc(finality("f-x", "synthetic", {}, { sha256: "0".repeat(64) })), orig = enc(finality("f-t", "synthetic"));
    const tampered = new Uint8Array(orig); tampered[tampered.length - 3] = tampered[tampered.length - 3] === 48 ? 49 : 48;
    const r = await root({ "up.json": up, "down.json": down, "extra.json": extra, "t.json": tampered });
    ledger.push(adm("up.json", up, "synthetic", "SYNTHETIC", [{ receiptId: "f-up", kind: "game-finality", sourceClass: "ingestion-completion" }]),
      adm("down.json", down, "synthetic", "SYNTHETIC", [{ receiptId: "f-down", kind: "game-finality", sourceClass: "official-game-end" }]),
      adm("extra.json", extra, "synthetic", "SYNTHETIC", [{ receiptId: "f-x", kind: "game-finality", sourceClass: "official-game-end" }]),
      adm("t.json", orig, "synthetic", "SYNTHETIC", [{ receiptId: "f-t", kind: "game-finality", sourceClass: "official-game-end" }]));
    const ev: any = await loadAdmittedEvidence({ root: r, origin: "synthetic" }); await rm(r, { recursive: true });
    const by = (id: string) => ev.receipts.find((x: any) => x.receiptId === id);
    observed.K4 = { admitted: ev.receipts.map((x: any) => [x.receiptId, x.subject.sourceClass]), issues: ev.issues.map((i: any) => [i.receiptId, i.code]) };
    expect(by("f-up")?.subject.sourceClass).toBe("ingestion-completion"); expect(by("f-down")).toBeUndefined(); expect(by("f-x")).toBeUndefined(); expect(by("f-t")).toBeUndefined();
    expect(ev.issues.map((i: any) => i.code)).toEqual(expect.arrayContaining(["self-label-unverified", "self-label-conflict", "retained-schema", "retained-bytes-mismatch"]));
  });
});
