// @vitest-environment node
import { createHash, generateKeyPairSync, sign } from "node:crypto";
import { EventEmitter } from "node:events";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { request } from "node:https";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Readable } from "node:stream";
import type { NextApiRequest, NextApiResponse } from "next";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import route from "../../../pages/api/v1/db/blsh-request-context";
import { capture, sourceDate } from "../../../scripts/blsh/prepareV6ObservationCapture.testHelper";
import { readRequestContextV6Export } from "../../../scripts/blsh/readRequestContextV6";
import { buildRequestFromContextV1 } from "./requestContext";
import { createRequestContextStore, REQUEST_CONTEXT_FILES } from "./requestContextStore";
import { requestContextApprovalBytes } from "./requestContextHandler";
import { PINNED_SUPABASE_ORIGIN } from "./core";

vi.mock("node:https", async importOriginal => ({ ...await importOriginal<typeof import("node:https")>(), request: vi.fn() }));
const hash = (bytes: Buffer) => createHash("sha256").update(new Uint8Array(bytes)).digest("hex");
const json = (value: unknown) => Buffer.from(JSON.stringify(value) + "\n");
const contextRunId = "77777777-bbbb-4aaa-8ccc-000000000001";
const deployment = { deploymentId: "dpl_context", gitCommitSha: "a".repeat(40) };
const ingress = "2026-11-21T12:35:00.000Z", retrieved = "2026-11-21T12:35:01.000Z", from = "2026-10-23";
const rpc = "/rest/v1/rpc/", sourceBucket = "/storage/v1/object/authenticated/blsh-native-packets/";
const bucket = "/storage/v1/object/blsh-request-context/";
type Capture = Awaited<ReturnType<typeof capture>>;
type Attempt = { path: string; method: string; headers: Record<string, string>; body?: Buffer; atUTC: string };
type Reply = { bytes?: Buffer; status?: number; headers?: Record<string, string>; stop?: "response_aborted" | "request_closed" };

/** Node 22 marks req.destroyed before reporting an incomplete received message. In
 * that sequence calling destroy() again emits no request error. No socket is opened. */
function fakeHTTPS(reply: (attempt: Attempt) => Reply) {
  const attempts: Attempt[] = [];
  function intercepted(url: string, options: { method: string; headers: Record<string, string> }, callback: (res: EventEmitter) => void) {
    class FakeRequest extends EventEmitter {
      destroyed = false;
      destroy() { if (!this.destroyed) { this.destroyed = true; this.emit("close"); } return this; }
      end(body?: Buffer) {
        const path = url.startsWith(PINNED_SUPABASE_ORIGIN + "/") ? url.slice(PINNED_SUPABASE_ORIGIN.length) : url;
        const attempt = { path, ...options, body, atUTC: new Date().toISOString() };
        attempts.push(attempt);
        queueMicrotask(() => {
          const answer = reply(attempt), bytes = answer.bytes ?? Buffer.alloc(0);
          if (answer.stop === "request_closed") { this.destroy(); return; }
          const res = Object.assign(new EventEmitter(), { statusCode: answer.status ?? 200, headers: answer.headers ?? { "content-length": String(bytes.length) }, complete: false });
          callback(res);
          if (this.destroyed) return;
          res.emit("data", bytes);
          if (answer.stop === "response_aborted") {
            this.destroyed = true; res.emit("aborted"); this.emit("close"); res.emit("error", new Error("untrusted transport contents")); return;
          }
          res.complete = true; res.emit("end"); this.destroy();
        });
      }
    }
    return new FakeRequest();
  }
  vi.mocked(request).mockImplementation(intercepted as unknown as typeof request);
  return attempts;
}

let native: Capture;
beforeAll(async () => { native = await capture(); });
beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] }); vi.setSystemTime(ingress);
  vi.stubGlobal("fetch", () => { throw new Error("unexpected_fetch"); });
});
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.useRealTimers(); vi.mocked(request).mockReset(); });

/** Real native-writer fixture, in the shape actually returned by the source SQL. */
function backend(snapshotUTC = "2026-11-21T12:35:00.000145+00:00", statementUTC = "2026-11-21T12:35:00.000780+00:00") {
  const rows = native.objects.map(o => ({ ordinal: o.ordinal, path: o.path, bytes: o.bytes, sha256: o.sha256, writtenAtUTC: o.written_at }));
  const sourceFiles = new Map(native.bytes);
  const target = { sourceDate, nativeRunId: native.run.run_id, nativeManifestSHA256: native.run.manifest_sha256! };
  const metadata = { ...target, objects: rows, claimedAtUTC: native.run.claimed_at, closedAtUTC: native.run.closed_at };
  const db = JSON.parse(readFileSync(join(__dirname, "__fixtures__/request-context-v1.sample.json"), "utf8"));
  Object.assign(db, { dateFrom: from, eventThroughDate: sourceDate, snapshotUTC, statementUTC });
  const original = Buffer.from(JSON.stringify(db, null, 2) + "\r\n");
  const args = { p_source_date: sourceDate, p_native_run_id: target.nativeRunId, p_native_manifest_sha256: target.nativeManifestSHA256 };
  function reply({ path }: Attempt): Reply {
    if (path === rpc + "blsh_context_source_v1") return { bytes: json(metadata) };
    if (path.startsWith(sourceBucket)) return { bytes: sourceFiles.get(path.slice(sourceBucket.length)) };
    if (path === rpc + "blsh_context_claim_v1") return { bytes: json({ claimed: true, runId: contextRunId }) };
    if (path === rpc + "blsh_request_context_v1") { vi.setSystemTime(retrieved); return { bytes: original }; }
    if (path.startsWith(bucket)) return { bytes: json({ Key: "blsh-request-context/" + path.slice(bucket.length), Id: contextRunId }) };
    if ([rpc + "blsh_context_object_v1", rpc + "blsh_context_close_v1"].includes(path)) return { bytes: json(true) };
    return { status: 404 };
  }
  return { target, args, rows, metadata, sourceFiles, db, original, reply };
}

function signedBody(target: ReturnType<typeof backend>["target"]) {
  const approval = { ...target, ...deployment };
  const { publicKey, privateKey } = generateKeyPairSync("ed25519");
  const signature = sign(null, new Uint8Array(requestContextApprovalBytes(approval)), privateKey).toString("base64");
  for (const [key, value] of Object.entries({ BLSH_REQUEST_CONTEXT_APPROVAL_PUBLIC_KEY: publicKey.export({ type: "spki", format: "pem" }).toString(),
    VERCEL_ENV: "production", VERCEL_DEPLOYMENT_ID: deployment.deploymentId, VERCEL_GIT_COMMIT_SHA: deployment.gitCommitSha, CRON_SECRET: "fixture-cron",
    SUPABASE_SERVICE_ROLE_KEY: "fixture-service", NEXT_PUBLIC_SUPABASE_URL: PINNED_SUPABASE_ORIGIN })) vi.stubEnv(key, value);
  return json({ approval, signature });
}

async function invoke(target: ReturnType<typeof backend>["target"], body = signedBody(target)) {
  const response = { code: 0, value: {} as Record<string, unknown>, setHeader: vi.fn(),
    status(code: number) { this.code = code; return this; }, json(value: Record<string, unknown>) { this.value = value; } };
  const req = Object.assign(Readable.from([body]), {
    method: "POST", headers: { authorization: "Bearer fixture-cron", "content-type": "application/json" }, query: {},
  });
  await route(req as unknown as NextApiRequest, response as unknown as NextApiResponse);
  return response;
}

describe("request/context through the concrete, socket-isolated store", () => {
  it.each([
    ["2026-11-21T12:35:00.000145+00:00", "2026-11-21T12:35:00.000780+00:00"],
    ["2026-11-21T07:35:00.000145-05:00", "2026-11-21T07:35:00.000780-05:00"],
  ])("round-trips the original SQL clocks %s / %s and all eight indexed objects", async (snapshotUTC, statementUTC) => {
    const f = backend(snapshotUTC, statementUTC), attempts = fakeHTTPS(f.reply), result = await invoke(f.target);
    expect(result.code).toBe(200); expect(result.value.state).toBe("packet_complete_pending_review");
    const prefix = "request-context-v1/" + sourceDate + "/" + contextRunId + "/";
    const sourceGets = [20, 13, 19].map(i => sourceBucket + f.rows[i - 1].path);
    const writes = REQUEST_CONTEXT_FILES.flatMap(file => [bucket + prefix + file, rpc + "blsh_context_object_v1"]);
    expect(attempts.map(a => a.path)).toEqual([rpc + "blsh_context_source_v1", ...sourceGets, rpc + "blsh_context_claim_v1", rpc + "blsh_request_context_v1", ...writes, rpc + "blsh_context_close_v1"]);
    expect(attempts.filter(a => a.method === "GET").map(a => a.path)).toEqual(sourceGets);
    for (const i of [0, 4]) expect(JSON.parse(attempts[i].body!.toString())).toEqual(f.args);
    expect(JSON.parse(attempts[5].body!.toString())).toEqual({ p_date_from: from, p_event_through: sourceDate });
    const built = buildRequestFromContextV1(f.db, { capturedAtUTC: retrieved });
    const uploads = attempts.filter(a => a.path.startsWith(bucket)), index = attempts.filter(a => a.path === rpc + "blsh_context_object_v1");
    expect(uploads[0].body).toEqual(f.original);
    expect(uploads.slice(1, 5).map(a => a.body)).toEqual(REQUEST_CONTEXT_FILES.slice(1, 5).map(name => built.rawFiles[name]));
    expect(uploads[5].body).toEqual(json(built.request));
    const descriptors = uploads.map((a, i) => {
      const file = REQUEST_CONTEXT_FILES[i], bytes = a.body!.length, sha256 = hash(a.body!);
      expect(a.headers["x-upsert"]).toBe("false");
      expect(JSON.parse(index[i].body!.toString())).toEqual({ p_run_id: contextRunId, p_ordinal: i + 1, p_path: prefix + file, p_sha256: sha256, p_bytes: bytes });
      return { file, bytes, sha256 };
    });
    const final = uploads[7].body!;
    expect(JSON.parse(final.toString())).toEqual({ version: "fhfh.blsh.request-context-manifest.v1", runId: contextRunId, ...f.target, files: descriptors.slice(0, 7) });
    expect(JSON.parse(attempts.at(-1)!.body!.toString())).toEqual({ p_run_id: contextRunId, p_state: "packet_complete_pending_review", p_reason: null,
      p_manifest_sha256: hash(final), p_manifest_text: final.toString("utf8") });
    expect(result.value.manifestSHA256).toBe(hash(final));

    const dir = mkdtempSync(join(tmpdir(), "context-emitted-export-"));
    try {
      mkdirSync(join(dir, "objects", prefix), { recursive: true });
      for (const upload of uploads) writeFileSync(join(dir, "objects", upload.path.slice(bucket.length)), new Uint8Array(upload.body!));
      const close = attempts.at(-1)!, terminal = JSON.parse(close.body!.toString());
      writeFileSync(join(dir, "run.json"), JSON.stringify({ run_id: contextRunId, source_date: sourceDate, native_run_id: f.target.nativeRunId,
        native_manifest_sha256: f.target.nativeManifestSHA256, state: terminal.p_state, reason: terminal.p_reason, manifest_sha256: terminal.p_manifest_sha256,
        claimed_at: attempts[4].atUTC, closed_at: close.atUTC }));
      const rows = index.map(a => {
        const record = JSON.parse(a.body!.toString());
        return { run_id: record.p_run_id, ordinal: record.p_ordinal, path: record.p_path, sha256: record.p_sha256, bytes: record.p_bytes, written_at: a.atUTC };
      });
      writeFileSync(join(dir, "objects.json"), JSON.stringify(rows));
      const read = readRequestContextV6Export(dir, { ...f.target, ...deployment, runId: contextRunId, manifestSHA256: hash(final) });
      expect(read.files.get("DB-CONTEXT.json")).toEqual(f.original);
      expect(read.files.get("RESULT.json")).toEqual(uploads[6].body);
      const originalRetrieval = (i: number) => JSON.parse(f.sourceFiles.get(f.rows[i - 1].path)!.toString()).retrievedAtUTC;
      expect(read.receipt).toMatchObject({ status: "request_context_readback_pending_review", asOfUTC: retrieved, snapshotUTC, statementUTC,
        claimedAtUTC: ingress, closedAtUTC: retrieved, nativeRetrievedAtUTC: { individual: originalRetrieval(13), onIce: originalRetrieval(19) } });
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });

  it.each(["saved", "lost claim acknowledgement", "lost completion acknowledgement"])(
    "a duplicate signed delivery cannot repeat the database read after %s", async mode => {
      const f = backend(), body = signedBody(f.target);
      let claimed = false;
      let terminal: string | null = null;
      const attempts = fakeHTTPS(a => {
        if (a.path === rpc + "blsh_context_claim_v1") {
          if (claimed) return { bytes: json({ claimed: false }) };
          claimed = true; // The durable operation happened before its HTTP acknowledgement.
          if (mode === "lost claim acknowledgement") return { stop: "request_closed" };
        }
        if (a.path === rpc + "blsh_context_close_v1") {
          terminal = JSON.parse(a.body!.toString()).p_state;
          if (mode === "lost completion acknowledgement") return { stop: "request_closed" };
        }
        return f.reply(a);
      });
      const first = await invoke(f.target, body);
      if (mode === "lost claim acknowledgement") {
        expect(first.value).toEqual({ state: "uncertain", reason: "claim_unacknowledged", ...f.target });
      } else if (mode === "lost completion acknowledgement") {
        expect(first.value).toEqual({ state: "uncertain", reason: "completion_close_unacknowledged", sourceDate, runId: contextRunId });
      } else {
        expect(first.value.state).toBe("packet_complete_pending_review");
      }
      const afterFirst = attempts.length;
      const duplicate = await invoke(f.target, body);
      expect(duplicate.value).toEqual({ state: "skipped", reason: "already_claimed", ...f.target });
      expect(attempts.slice(afterFirst).at(-1)?.path).toBe(rpc + "blsh_context_claim_v1");
      const reads = attempts.filter(a => a.path === rpc + "blsh_request_context_v1");
      const closes = attempts.filter(a => a.path === rpc + "blsh_context_close_v1");
      const uploaded = attempts.filter(a => a.path.startsWith(bucket));
      const executed = mode !== "lost claim acknowledgement";
      expect(reads).toHaveLength(executed ? 1 : 0);
      expect(closes).toHaveLength(executed ? 1 : 0);
      expect(uploaded).toHaveLength(executed ? 8 : 0);
      expect(terminal).toBe(executed ? "packet_complete_pending_review" : null);
    });
  it("checks every native index ordinal, including unrequested bodies", async () => {
    const store = createRequestContextStore({ serviceKey: "fixture" });
    for (let i = 0; i < 20; i++) {
      const f = backend(); f.rows[i].path += ".changed";
      const attempts = fakeHTTPS(f.reply);
      await expect(store.source(f.target)).rejects.toThrow("context_native_index_invalid");
      expect(attempts.map(a => a.path)).toEqual([rpc + "blsh_context_source_v1"]);
    }
  });

  it.each([13, 19, 20])("refuses a same-size byte change at native ordinal %i", async ordinal => {
    const f = backend(), path = f.rows[ordinal - 1].path, changed = Buffer.from(new Uint8Array(f.sourceFiles.get(path)!));
    changed[0] ^= 1; f.sourceFiles.set(path, changed);
    const attempts = fakeHTTPS(f.reply), result = await invoke(f.target);
    expect(result.value.reason).toBe("native_source_unverified");
    expect(attempts.some(a => a.path === rpc + "blsh_context_claim_v1")).toBe(false);
  });

  it("refuses a digest-correct native manifest that places completion after its indexed write", async () => {
    const f = backend(), last = f.rows[19], manifest = JSON.parse(f.sourceFiles.get(last.path)!.toString());
    manifest.completedAtUTC = new Date(Date.parse(last.writtenAtUTC) + 1).toISOString();
    const b = json(manifest); f.sourceFiles.set(last.path, b); last.sha256 = f.target.nativeManifestSHA256 = f.metadata.nativeManifestSHA256 = hash(b);
    last.bytes = b.length; f.metadata.closedAtUTC = manifest.completedAtUTC;
    fakeHTTPS(f.reply);
    await expect(createRequestContextStore({ serviceKey: "fixture" }).source(f.target)).rejects.toThrow("context_native_manifest_clock");
  });

  it.each<[string, Reply]>([
    ["an incomplete received message", { bytes: Buffer.from("partial"), headers: { "content-length": "20" }, stop: "response_aborted" }],
    ["request close before any response", { stop: "request_closed" }],
    ["a redirect", { status: 302, headers: { location: "https://other.invalid/never-fetched" } }],
    ["an oversized Content-Length", { headers: { "content-length": "8388609" } }],
    ["an oversized unannounced body", { headers: {}, bytes: Buffer.alloc(8388609) }],
  ])("settles once with a safe failure on %s", async (_label, reply) => {
    const attempts = fakeHTTPS(() => reply);
    await expect(createRequestContextStore({ serviceKey: "fixture" }).readContext(from, sourceDate)).rejects.toThrow("context_transport_failed");
    expect(attempts.map(a => a.path)).toEqual([rpc + "blsh_request_context_v1"]);
  });

  it("reports uncertainty after a partial upload followed by a lost failed-close acknowledgement", async () => {
    const f = backend();
    const attempts = fakeHTTPS(a => a.path.endsWith("/RAW-individual.json") || a.path === rpc + "blsh_context_close_v1" ? { stop: "response_aborted" } : f.reply(a));
    const result = await invoke(f.target);
    expect(result.value).toMatchObject({ state: "uncertain", reason: "failure_close_unacknowledged" });
    expect(attempts.filter(a => a.path.startsWith(bucket))).toHaveLength(3);
    expect(attempts.filter(a => a.path === rpc + "blsh_context_object_v1")).toHaveLength(2);
    expect(attempts.filter(a => a.path === rpc + "blsh_context_close_v1")).toHaveLength(1);
    expect(JSON.parse(attempts.at(-1)!.body!.toString())).toEqual({ p_run_id: contextRunId, p_state: "failed", p_reason: "context_write_unacknowledged", p_manifest_sha256: null, p_manifest_text: null });
  });
});
