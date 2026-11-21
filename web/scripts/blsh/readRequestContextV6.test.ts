// @vitest-environment node
import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { buildRequestFromContextV1, REQUEST_CONTEXT_CAPTURE } from "../../lib/blsh/nativeCaptureV6/requestContext";
import { REQUEST_CONTEXT_FILES } from "../../lib/blsh/nativeCaptureV6/requestContextStore";
import { readRequestContextV6Export } from "./readRequestContextV6";

const temps: string[] = [];
afterEach(() => { for (const dir of temps.splice(0)) rmSync(dir, { recursive: true, force: true }); });
const sourceDate = "2026-11-19", runId = "abcdefab-1234-4567-8abc-123456789abc", nativeRunId = "12345678-1234-4567-8abc-123456789abc";
const nativeManifestSHA256 = "9".repeat(64), deploymentId = "dpl_test", gitCommitSha = "a".repeat(40);
const identity = { runId, sourceDate, nativeRunId, nativeManifestSHA256 };
const claimedAtUTC = "2026-11-20T12:39:59.999999+00:00", asOfUTC = "2026-11-20T12:40:05.000Z", asOfUTCDefault = asOfUTC;
const nativeRetrievedAtUTC = { individual: "2026-11-20T12:05:20.001Z", onIce: "2026-11-20T12:05:45.003Z" }, nativeRetrievedDefault = nativeRetrievedAtUTC;
const hash = (b: Buffer) => createHash("sha256").update(new Uint8Array(b)).digest("hex");
const json = (v: unknown) => Buffer.from(JSON.stringify(v) + "\n");
type Change = { file?: (file: string, b: Buffer) => Buffer; result?: Record<string, unknown>; manifest?: Record<string, unknown>; day?: string };

function fixture(change: Change = {}) {
  // Every recorded clock moved to another real day (a hosted replay run later than sourceDate + 1).
  const at = (value: string) => change.day ? value.replaceAll("2026-11-20T", change.day + "T") : value;
  const asOfUTC = at(asOfUTCDefault), nativeRetrievedAtUTC = { individual: at(nativeRetrievedDefault.individual), onIce: at(nativeRetrievedDefault.onIce) };
  const dir = mkdtempSync(join(tmpdir(), "context-v6-readback-"));
  temps.push(dir);
  const prefix = ["request-context-v1", sourceDate, runId].join("/");
  const fileDir = join(dir, "objects", prefix);
  mkdirSync(fileDir, { recursive: true });
  const db = Buffer.from(at(readFileSync(join(__dirname, "../../lib/blsh/nativeCaptureV6/__fixtures__/request-context-v1.sample.json")).toString()));
  const context = JSON.parse(db.toString());
  const projected = buildRequestFromContextV1(context, { capturedAtUTC: asOfUTC });
  const files: Record<string, Buffer> = { "DB-CONTEXT.json": db, ...projected.rawFiles, "CURRENT-REQUEST.json": json(projected.request) };
  const records: { file: string; bytes: number; sha256: string }[] = [];
  function emit(file: string, original: Buffer) {
    const b = change.file?.(file, original) ?? original;
    writeFileSync(join(fileDir, file), new Uint8Array(b));
    records.push({ file, bytes: b.length, sha256: hash(b) });
  }
  for (const file of REQUEST_CONTEXT_FILES.slice(0, 6)) emit(file, files[file]);
  emit("RESULT.json", json({ version: "fhfh.blsh.request-context-result.v1", state: "CAPTURED_READ_ONLY_UNQUALIFIED", ...identity,
    requestDeployment: { deploymentId, gitCommitSha }, executionMode: REQUEST_CONTEXT_CAPTURE, captureContext: REQUEST_CONTEXT_CAPTURE,
    atomicDatabaseSnapshot: true, sessionClosed: true, dateFrom: context.dateFrom, eventThroughDate: sourceDate,
    snapshotUTC: context.snapshotUTC, statementUTC: context.statementUTC, nativeRetrievedAtUTC, asOfUTC, rows: projected.rows,
    independentlyAccepted: false, advancedAdmission: false, score: null, artifacts: Object.fromEntries(records.map(r => [r.file, r.sha256])), ...change.result }));
  emit("MANIFEST.json", json({ version: "fhfh.blsh.request-context-manifest.v1", ...identity, files: records, ...change.manifest }));
  const pins = { ...identity, manifestSHA256: records[7].sha256, deploymentId, gitCommitSha };
  const run = { run_id: runId, source_date: sourceDate, native_run_id: nativeRunId, native_manifest_sha256: nativeManifestSHA256,
    state: "packet_complete_pending_review", reason: null, claimed_at: at(claimedAtUTC), closed_at: at("2026-11-20T12:40:05.000009+00:00"),
    manifest_sha256: pins.manifestSHA256 };
  const rows = records.map((r, i) => ({ ordinal: i + 1, path: prefix + "/" + r.file, bytes: r.bytes, sha256: r.sha256, run_id: runId,
    written_at: at("2026-11-20T12:40:05.00000" + (i + 1) + "+00:00") }));
  function metadata() {
    writeFileSync(join(dir, "run.json"), JSON.stringify(run));
    writeFileSync(join(dir, "objects.json"), JSON.stringify(rows));
  }
  metadata();
  return { dir, fileDir, pins, rows, run, metadata, read: () => readRequestContextV6Export(dir, pins) };
}

describe("request context export readback", () => {
  it("preserves both original metadata buffers and exactly eight verified bodies", () => {
    const f = fixture();
    f.rows.reverse();
    f.metadata();
    const result = f.read();
    expect([...result.files.keys()]).toEqual(REQUEST_CONTEXT_FILES);
    expect(result.receipt).toMatchObject({ ...f.pins, asOfUTC, claimedAtUTC, nativeRetrievedAtUTC,
      status: "request_context_readback_pending_review", independentlyAccepted: false, advancedAdmission: false, score: null });
    expect(result.runBytes.toString()).toBe(JSON.stringify(f.run));
    expect(result.objectRowsBytes.toString()).toBe(JSON.stringify(f.rows));
    writeFileSync(join(f.fileDir, "CURRENT-REQUEST.json"), "replaced after verification");
    expect(JSON.parse(result.files.get("CURRENT-REQUEST.json")!.toString()).asOfUTC).toBe(asOfUTC);
  });
  it.each([{ runId: nativeRunId }, { nativeRunId: runId }, { sourceDate: "2026-11-20" }, { manifestSHA256: "c".repeat(64) },
    { nativeManifestSHA256: "d".repeat(64) }, { deploymentId: "dpl_other" }, { gitCommitSha: "b".repeat(40) }])("binds external pins %j", p => {
    const f = fixture();
    expect(() => readRequestContextV6Export(f.dir, { ...f.pins, ...p })).toThrow();
  });
  it.each(["claimed", "failed"])("refuses a %s run even with a complete manifest", state => {
    const f = fixture();
    f.run.state = state;
    f.metadata();
    expect(f.read).toThrow("context_run_mismatch");
  });
  it("refuses a successful ledger that spans more than one invocation", () => {
    const f = fixture();
    f.run.closed_at = "2026-11-20T12:44:00.000000Z";
    f.metadata();
    expect(f.read).toThrow("context_clock_mismatch");
  });
  it.each(["missing", "ordinal", "cross-run", "path", "early", "late", "reordered", "per-file-limit", "aggregate-limit"])("checks %s index input", kind => {
    const f = fixture();
    if (kind === "missing") f.rows.pop();
    if (kind === "ordinal") f.rows[7].ordinal = 7;
    if (kind === "cross-run") f.rows[2].run_id = nativeRunId;
    if (kind === "path") f.rows[2].path += "/../DB-CONTEXT.json";
    if (kind === "early") f.rows[0].written_at = "2026-11-20T12:39:59.999998Z";
    if (kind === "late") f.rows[7].written_at = "2026-11-20T12:40:05.000010Z";
    if (kind === "reordered") f.rows[1].written_at = "2026-11-20T12:40:05.000000Z";
    if (kind === "per-file-limit") f.rows[0].bytes = 8 * 1024 * 1024 + 1;
    if (kind === "aggregate-limit") f.rows.slice(1, 5).forEach(r => { r.bytes = 16 * 1024 * 1024; });
    f.metadata();
    expect(f.read).toThrow(/context_(index|clock|export_file_size|packet_size)/);
  });
  it("detects same-length body changes and symlink substitution", () => {
    const f = fixture(), p = join(f.fileDir, "RAW-wgo.json"), bytes = readFileSync(p);
    const changed = Buffer.from(new Uint8Array(bytes));
    changed[0] ^= 1;
    writeFileSync(p, new Uint8Array(changed));
    expect(f.read).toThrow("context_object_digest_mismatch");
    rmSync(p);
    writeFileSync(join(f.dir, "other"), new Uint8Array(bytes));
    symlinkSync(join(f.dir, "other"), p);
    expect(f.read).toThrow("context_export_path_mismatch");
  });
  it.each([{ advancedAdmission: true }, { independentlyAccepted: true }, { score: 0 }, { rows: {} }, { artifacts: {} },
    { snapshotUTC: asOfUTC }, { eventThroughDate: "2026-11-18" }, { atomicDatabaseSnapshot: false },
    { nativeRetrievedAtUTC: { individual: "2026-11-20T00:40:04.999999Z", onIce: nativeRetrievedAtUTC.onIce } }])("rejects resealed RESULT %j", result => {
    expect(fixture({ result }).read).toThrow(/context_(result|clock|scope)_mismatch/);
  });
  it("checks the exact DB snapshot against the SQL claim microsecond", () => {
    const f = fixture();
    f.run.claimed_at = "2026-11-20T12:40:00.000001Z";
    f.metadata();
    expect(f.read).toThrow("context_clock_mismatch");
  });
  it.each(["RAW-wgo.json", "RAW-individual.json", "RAW-onIce.json", "RAW-calendar.json", "CURRENT-REQUEST.json"])("reconstructs resealed %s", target => {
    expect(fixture({ file: (file, b) => file === target ? json({ ...JSON.parse(b.toString()), unexpected: true }) : b }).read).toThrow("context_projection_mismatch");
  });
  it("rejects a separately resealed manifest that drops indexed descriptors", () => {
    expect(fixture({ manifest: { files: [] } }).read).toThrow("context_manifest_mismatch");
  });
  it.each(["MANIFEST.json", "RESULT.json", "DB-CONTEXT.json"])("rejects duplicate or invalid UTF-8 in %s even if all hashes match", target => {
    const duplicate = (b: Buffer) => Buffer.from(b.toString().replace("{", '{"version":1,'));
    expect(fixture({ file: (file, b) => file === target ? duplicate(b) : b }).read).toThrow("duplicate_json_member");
    expect(fixture({ file: (file, b) => file === target ? Buffer.from([0xff]) : b }).read).toThrow();
  });
});

describe("request context export readback of a hosted replay run on a later real day", () => {
  it("accepts it only with the independently pinned replay capture day, and echoes that pin", () => {
    const f = fixture({ day: "2026-11-21" });
    expect(f.read).toThrow("context_clock_mismatch");
    const result = readRequestContextV6Export(f.dir, { ...f.pins, replayCaptureDay: "2026-11-21" });
    expect(result.receipt).toMatchObject({ ...f.pins, replayCaptureDay: "2026-11-21", claimedAtUTC: "2026-11-21T12:39:59.999999+00:00" });
    for (const replayCaptureDay of ["2026-11-20", "2026-11-22"]) {
      expect(() => readRequestContextV6Export(f.dir, { ...f.pins, replayCaptureDay })).toThrow("context_clock_mismatch");
    }
    for (const replayCaptureDay of ["2026-11-19", "2026-11-31", "2026-11-21T00:00:00Z", "", "2027-07-01"]) {
      expect(() => readRequestContextV6Export(f.dir, { ...f.pins, replayCaptureDay })).toThrow("context_date_invalid");
    }
  });
  it("leaves a live export's receipt unchanged without the pin and accepts sourceDate + 1 as an explicit pin", () => {
    const f = fixture();
    expect(Object.keys(f.read().receipt)).not.toContain("replayCaptureDay");
    expect(readRequestContextV6Export(f.dir, { ...f.pins, replayCaptureDay: "2026-11-20" }).receipt.replayCaptureDay).toBe("2026-11-20");
  });
});
