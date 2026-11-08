// @vitest-environment node
import { createHash } from "node:crypto";
import * as fs from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { executeNativeProcessCapture, NATIVE_PROCESS_RETENTION_BYTES, prepareNativeProcessCapture, retainNativeProcessPacket, type NativeProcessObservation } from "./nativeProcessCapturePreparation";
vi.mock("node:fs", async original => ({ ...await original<typeof import("node:fs")>() }));
vi.mock("../../lib/nst/client", () => { throw new Error("client forbidden"); });
vi.mock("../../lib/nst/requestBudget", () => { throw new Error("budget forbidden"); });
vi.mock("../../lib/nst/sharedAdmission", () => { throw new Error("shared admission forbidden"); });
vi.mock("node:http", () => { throw new Error("HTTP forbidden"); });
vi.mock("node:https", () => { throw new Error("HTTPS forbidden"); });
vi.mock("node:net", () => { throw new Error("sockets forbidden"); });
vi.mock("node:tls", () => { throw new Error("TLS sockets forbidden"); });
const sha = (bytes: Buffer) => createHash("sha256").update(new Uint8Array(bytes)).digest("hex");
const NOW = "2026-11-07T12:00:00.000Z";
const request = () => ({ seasonId: 20262027, date: "2026-11-06", plannedAtUTC: "2026-11-07T11:59:00.000Z", groups: ["individual", "onIce"] });
const observations = (): NativeProcessObservation[] => ["individual", "onIce"].map(group => ({ group: group as "individual" | "onIce", state: "observed", retrievedAtUTC: "2026-11-07T11:59:30.125Z", parserInputText: `<!doctype html>\r\n<table>synthetic ${group}: é 🏒 &key=[REDACTED]</table>\n` }));
let directory: string;
const out = () => join(directory, "packet");
const read = (file: string) => JSON.parse(fs.readFileSync(join(out(), file), "utf8"));
beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(NOW); vi.stubGlobal("fetch", vi.fn(() => { throw new Error("network forbidden"); })); directory = fs.mkdtempSync(join(tmpdir(), "blsh-native-preparation-test-")); });
afterEach(() => { expect(fetch).not.toHaveBeenCalled(); vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.useRealTimers(); fs.rmSync(directory, { recursive: true, force: true }); });
describe("blocked native process capture preparation", () => {
  it("plans exactly two canonical authenticated all-strength/count pages and refuses execution", () => {
    const plan = prepareNativeProcessCapture(request());
    expect(plan.pages.map(page => page.group)).toEqual(["individual", "onIce"]);
    for (const [index, page] of plan.pages.entries()) {
      const url = new URL(page.url);
      expect(url.origin).toBe("https://data.naturalstattrick.com"); expect(url.pathname).toBe("/playerteams.php");
      expect(Object.fromEntries(url.searchParams)).toEqual({ fromseason: "20262027", thruseason: "20262027", stype: "2", sit: "all", score: "all", stdoi: index === 0 ? "std" : "oi", rate: "n", team: "ALL", pos: "S", loc: "B", toi: "0", gpfilt: "gpdate", fd: "2026-11-06", td: "2026-11-06", lines: "single", draftteam: "ALL" });
    }
    expect(plan.futureExecution).toMatchObject({ plannedProviderPages: 2, maxProviderAttempts: 2, concurrency: 1, retries: 0, maxAttempts: 2, plannedRequestCount: 2, allowQueryKeyFallback: false, sharedControls: ["withNstRequestBudget", "admitSharedNstAttempt"] });
    expect(plan).toMatchObject({ executionAllowed: false, completionVerified: false, independentlyAccepted: false, advancedAdmission: false, score: null });
    expect(plan.futureExecution.sharedAdmissionRPC).toEqual({ maxCalls: null, deadlineBounded: true, mayWriteProductionLedger: true });
    expect(plan.limits.responseConsumptionBytes).toBeNull(); expect(() => executeNativeProcessCapture(plan)).toThrow("native_capture_not_implemented");
  });
  it.each([{ seasonId: 20252026 }, { date: "2025-11-06" }, { date: "2026-02-30" }, { date: "2026-11-07" }, { date: "2026-11-08" }, { date: "2026-10-30" }, { plannedAtUTC: "2026-11-07T12:00:00.001Z" }, { plannedAtUTC: "2026-11-07T11:44:59.999Z" }, { groups: ["individual", "individual"] }, { groups: ["onIce", "individual"] }, { groups: ["individual"] }, { groups: ["individual", "onIce", "extra"] }, { url: "https://example.org" }, { TLSVerified: true }, { date: "2026-11-06&key=secret" }])("rejects invalid/extra scope %j", change => { expect(() => prepareNativeProcessCapture({ ...request(), ...change })).toThrow(); });
  it("rechecks plan freshness and integrity before writing", () => {
    const plan = prepareNativeProcessCapture(request()); plan.pages[0].url = "https://example.org";
    expect(() => retainNativeProcessPacket(out(), plan, [])).toThrow("plan_modified");
    const fresh = prepareNativeProcessCapture(request()); vi.setSystemTime("2026-11-07T12:14:00.001Z");
    expect(() => retainNativeProcessPacket(out(), fresh, [])).toThrow("future_or_stale_plan"); expect(fs.existsSync(out())).toBe(false);
  });
  it("retains exact UTF-8 bytes, original reported clock and source bindings, never a NativeReceipt", () => {
    const source = observations(), result = retainNativeProcessPacket(out(), prepareNativeProcessCapture(request()), source);
    expect(result).toMatchObject({ state: "offline_packet_retained", captureCompleted: false, liveRequests: 0, score: null, advancedAdmission: false });
    const metadata = read("individual.UNVERIFIED-OBSERVATION.json"), bytes = fs.readFileSync(join(out(), "individual.parser-input.html"));
    expect(bytes.toString("utf8")).toBe((source[0] as Extract<NativeProcessObservation, {state: "observed"}>).parserInputText);
    expect(metadata).toMatchObject({ status: "retained_unverified", parserInputBytes: bytes.length, parserInputSHA256: sha(bytes), reportedRetrievedAtUTC: "2026-11-07T11:59:30.125Z", retainedAtUTC: NOW, transport: { httpStatus: null, TLSVerified: null, finalOrigin: null, redirected: null }, originalPublicationUTC: null, modelDefinition: "unknown", nativeValuesMatched: null, independentlyAccepted: false });
    expect(metadata.retrievedAtUTC).toBeUndefined(); expect(metadata.producerSHA256).toBeUndefined(); expect(metadata.redactorSHA256).toBeUndefined();
    for (const binding of metadata.codeBindings) { const bytes = fs.readFileSync(join(out(), binding.file)); expect({ sha256: sha(bytes), bytes: bytes.length }).toEqual({ sha256: binding.sha256, bytes: binding.bytes }); }
    expect(fs.readFileSync(join(out(), "client.ts"))).toEqual(fs.readFileSync(resolve(__dirname, "../../lib/nst/client.ts")));
    expect(fs.statSync(out()).mode & 0o777).toBe(0o700); expect(fs.statSync(join(out(), "individual.parser-input.html")).mode & 0o777).toBe(0o600);
  });
  it("writes new only, including refusing an existing symlink", () => {
    const plan = prepareNativeProcessCapture(request()); retainNativeProcessPacket(out(), plan, observations()); const before = fs.readFileSync(join(out(), "RESULT.json"));
    expect(() => retainNativeProcessPacket(out(), plan, [])).toThrow(); expect(fs.readFileSync(join(out(), "RESULT.json"))).toEqual(before);
    fs.symlinkSync(out(), join(directory, "linked")); expect(() => retainNativeProcessPacket(join(directory, "linked"), plan, [])).toThrow();
  });
  it.each([
    { group: "onIce", state: "failed", reason: "transport_failed" },
    { group: "onIce", state: "observed", parserInputText: "x".repeat(NATIVE_PROCESS_RETENTION_BYTES + 1), retrievedAtUTC: "2026-11-07T11:59:30.125Z" },
    { group: "onIce", state: "observed", parserInputText: "\ud800", retrievedAtUTC: "2026-11-07T11:59:30.125Z" },
    { group: "onIce", state: "observed", parserInputText: "synthetic", retrievedAtUTC: "2026-11-07T12:00:00.001Z" },
    { group: "onIce", state: "observed", parserInputText: "synthetic", retrievedAtUTC: "2026-11-07T11:59:30.125Z", TLSVerified: true, token: "do-not-copy" },
  ])("preserves first page after second failure", second => {
    const result = retainNativeProcessPacket(out(), prepareNativeProcessCapture(request()), [observations()[0], second] as NativeProcessObservation[]);
    expect(result).toMatchObject({ state: "partial_offline_packet", captureCompleted: false }); expect(result.retained.map(item => item.state)).toEqual(["retained_unverified", "failed"]);
    expect(fs.existsSync(join(out(), "individual.parser-input.html"))).toBe(true); expect(JSON.stringify(read("RESULT.json"))).not.toContain("do-not-copy");
  });
  it("stops after failure and records missing observations", () => {
    const result = retainNativeProcessPacket(out(), prepareNativeProcessCapture(request()), [{ group: "individual", state: "failed", reason: "capture_interrupted" }, observations()[1]]);
    expect(result.retained.map(item => item.state)).toEqual(["failed", "not_retained"]); expect(fs.existsSync(join(out(), "onIce.parser-input.html"))).toBe(false);
  });
  it("preserves partial files and no success record on terminal write failure", () => {
    const original = fs.writeFileSync; vi.spyOn(fs, "writeFileSync").mockImplementation((file, data, options) => { if (String(file).endsWith("RESULT.json")) throw new Error("synthetic disk error"); return original(file, data, options); });
    expect(() => retainNativeProcessPacket(out(), prepareNativeProcessCapture(request()), observations())).toThrow("synthetic disk error");
    expect(fs.existsSync(join(out(), "STARTED.json"))).toBe(true); expect(fs.existsSync(join(out(), "RESULT.json"))).toBe(false);
  });
  it("rejects duplicate and extra groups before creating output", () => { const input = observations(); expect(() => retainNativeProcessPacket(out(), prepareNativeProcessCapture(request()), [input[0], input[0]])).toThrow(); expect(() => retainNativeProcessPacket(out(), prepareNativeProcessCapture(request()), [...input, input[1]])).toThrow(); expect(fs.existsSync(out())).toBe(false); });
});
