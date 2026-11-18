// @vitest-environment node
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { capture, deploymentId, now } from "./prepareV6ObservationCapture.testHelper";
import { reviewNativeV6Packet } from "./reviewNativeV6Packet.mjs";
import { readNativeV6Ledger, readNativeV6LedgerExport } from "./readNativeV6Ledger";

vi.mock("node:https", () => ({ Agent: class { constructor() { throw new Error("real HTTPS forbidden"); } } }));
vi.mock("node:tls", () => ({ rootCertificates: ["fixture CA"], getCACertificates: () => ["fixture CA"] }));
const digest = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");
const json = (data: unknown) => Buffer.from(JSON.stringify(data, null, 2) + "\n");

type Fixture = Awaited<ReturnType<typeof capture>>;
let source: Fixture;
beforeAll(async () => { source = await capture(); });
function fixture(): Fixture {
  return { run: structuredClone(source.run), objects: structuredClone(source.objects), pins: { ...source.pins }, bytes: new Map(source.bytes) };
}
const read = ({ run, objects, pins, bytes }: Fixture) => readNativeV6Ledger(run, objects, pins, path => bytes.get(path)!);

// Keep the index, object bytes, manifest and close hash consistent. This forces
// negative cases to exercise the claimed contents beyond the hash check.
function replace(f: Fixture, file: string, transform: (text: string) => string) {
  const index = f.objects.findIndex(row => row.path.endsWith("/" + file));
  const row = f.objects[index], bytes = Buffer.from(transform(f.bytes.get(row.path)!.toString("utf8")));
  f.bytes.set(row.path, bytes);
  row.bytes = bytes.length;
  row.sha256 = digest(new Uint8Array(bytes));
  if (file === "MANIFEST.json") f.run.manifest_sha256 = row.sha256;
  else replace(f, "MANIFEST.json", text => {
    const manifest = JSON.parse(text);
    manifest.files[index] = { file, bytes: row.bytes, sha256: row.sha256 };
    return json(manifest).toString("utf8");
  });
}

describe("native v6 offline ledger", () => {
  it("uses stored ordinals, checks the complete real packet and preserves exact original bytes", () => {
    const f = fixture();
    f.objects.reverse();
    const result = read(f);
    expect(result.receipt).toMatchObject({ ...f.pins, objectCount: 20, independentlyAccepted: false, advancedAdmission: false, score: null });
    expect(result.files.get("individual.parser-input.html")).toEqual(Buffer.from("<table><tr><td>é 🏒</td></tr></table>\r\n"));
  });

  it.each(["claimed", "failed", "no_slate", "refused_schedule", "abandoned_uncertain"])("refuses %s even with a recorded complete manifest", state => {
    const f = fixture();
    f.run.state = state;
    expect(() => read(f)).toThrow(`run_state_${state}`);
  });

  it.each([
    ["missing indexed file", (f: Fixture) => f.objects.splice(0, 1), "object_count_mismatch"],
    ["duplicate ordinal", (f: Fixture) => { f.objects[4].ordinal = 4; }, "object_ordinal_or_run_mismatch"],
    ["substituted path", (f: Fixture) => { f.objects[0].path = f.objects[1].path; }, "object_path_mismatch"],
    ["cross-run object", (f: Fixture) => { f.objects[0].run_id = "other"; }, "object_ordinal_or_run_mismatch"],
    ["substituted bytes", (f: Fixture) => { const row = f.objects[5]; f.bytes.set(row.path, Buffer.alloc(row.bytes)); }, "object_digest_mismatch"],
    ["truncated bytes", (f: Fixture) => f.bytes.set(f.objects[5].path, Buffer.alloc(0)), "object_size_mismatch"],
    ["wrong closing hash", (f: Fixture) => { f.run.manifest_sha256 = "f".repeat(64); }, "closed_manifest_digest_mismatch"],
    ["missing close", (f: Fixture) => { f.run.closed_at = ""; }, "invalid_utc_time"],
    ["wrong pin", (f: Fixture) => { f.pins.deploymentId += "1"; }, "claim_deployment_mismatch"],
    ["wrong date", (f: Fixture) => { f.pins.sourceDate = "2026-11-19"; }, "run_identity_mismatch"],
    ["wrong run", (f: Fixture) => { f.pins.runId = "00000000-0000-0000-0000-000000000000"; }, "run_identity_mismatch"],
    ["pruned run", (f: Fixture) => { f.run.pruned_at = now; }, "run_pruned_or_retention_unknown"],
    ["wrong DB intent", (f: Fixture) => { f.run.operation_intents.reverse(); }, "run_intent_checkpoint_mismatch"],
    ["intent before preceding checkpoint", (f: Fixture) => { f.objects[6].written_at = now.replace(".000Z", ".000001Z");
      f.objects.slice(7, 13).forEach(row => { row.written_at = f.objects[6].written_at; }); }, "run_intent_checkpoint_mismatch"],
    ["reversed SQL microseconds", (f: Fixture) => { f.objects[2].written_at = now.replace(".000Z", ".000001Z"); }, "object_time_mismatch"],
    ["oversize body metadata", (f: Fixture) => { f.objects[5].bytes = 1024 * 1024 + 1; }, "object_metadata_invalid"],
    ["wrong manifest entry", (f: Fixture) => replace(f, "MANIFEST.json", text => text.replace("STARTED.json", "ABSENT.json")), "manifest_file_mismatch"],
    ["false admission", (f: Fixture) => replace(f, "MANIFEST.json", text => text.replace('"advancedAdmission": false', '"advancedAdmission": true')), "manifest_identity_or_state_mismatch"],
    ["wrong deployment on one observation", (f: Fixture) => replace(f, "onIce.TRANSPORT-OBSERVATION.json", text => text.replace(deploymentId, "other")), "packet_deployment_binding_mismatch"],
    ["wrong capture day", (f: Fixture) => replace(f, "PLAN.json", text => text.replace(now, "2026-11-20T12:05:00.000Z")), "packet_time_or_source_date_mismatch"],
    ["plan after the ingress window", (f: Fixture) => replace(f, "PLAN.json", text => text.replace(now, "2026-11-21T12:30:00.100Z")), "capture_ingress_window_unconfirmed"],
    ["ambiguous duplicate key", (f: Fixture) => replace(f, "MANIFEST.json", text => text.replace('"state":', '"st\\u0061te":"failed","state":')), "duplicate_json_member"],
  ] as const)("rejects %s", (_label, mutate, code) => {
    const f = fixture();
    mutate(f);
    expect(() => read(f)).toThrow(code);
  });

  it.each([
    ["RUNTIME.json", '"NODE_OPTIONS": false', '"NODE_OPTIONS": true', "runtime_environment_profile"],
    ["RUNTIME.json", '"defaultCACertificateCount": 1', '"defaultCACertificateCount": 2', "runtime_trust_profile"],
    ["operation-4-STARTED.json", "admission:onIce", "admission:individual", "journal_operation_scope"],
    ["operation-2-SETTLED.json", '"allowed"', '"denied"', "journal_admission"],
    ["schedule.TRANSPORT-OBSERVATION.json", '"sha256": "', '"sha256": "f', "observation_binding"],
    ["PLAN.json", '"retries": 0', '"retries": 3', /plan/],
    ["PLAN.json", "12:20:00.000Z", "12:04:00.000Z", "capture_plan_scope_or_expiry"],
  ] as const)("refuses resealed profile corruption in %s (%s)", (file, before, after, code) => {
    const f = fixture();
    replace(f, file, text => {
      expect(text).toContain(before);
      return text.replace(before, after);
    });
    expect(() => reviewNativeV6Packet(read(f))).toThrow(code);
  });

  it("reads a local export with independent pins and hands the hashed original bytes to the next stage", () => {
    const f = fixture(), root = mkdtempSync(join(tmpdir(), "blsh-offline-readback-")), dir = join(root, "export");
    try {
      for (const [path, bytes] of f.bytes) {
        const local = join(dir, "objects", path);
        mkdirSync(dirname(local), { recursive: true });
        writeFileSync(local, new Uint8Array(bytes));
      }
      for (const [file, value] of [["run.json", f.run], ["objects.json", f.objects], ["packet-pins.json", f.pins]]) {
        writeFileSync(join(dir, String(file)), JSON.stringify(value));
      }
      const external = join(root, "pins.json");
      writeFileSync(external, JSON.stringify(f.pins));
      const result = readNativeV6LedgerExport(dir, external);
      expect(result.receipt).toEqual(read(f).receipt);
      expect(reviewNativeV6Packet(result)).toMatchObject({ status: "v6_packet_profile_checked_pending_independent_review",
        completedGameIds: [2026020301], currentUseQualified: false, independentlyAccepted: false, advancedAdmission: false, score: null });
      const cli = execFileSync(process.execPath, ["./node_modules/.bin/ts-node", "--transpile-only", "--compiler-options",
        '{"module":"Node16","moduleResolution":"Node16"}', "scripts/blsh/readNativeV6Ledger.ts", dir, external], { encoding: "utf8" });
      expect(JSON.parse(cli)).toEqual(reviewNativeV6Packet(result));
      expect(() => readNativeV6LedgerExport(dir, join(dir, "packet-pins.json"))).toThrow("pins_must_be_external_to_export");
    } finally { rmSync(root, { recursive: true, force: true }); }
  });
});
