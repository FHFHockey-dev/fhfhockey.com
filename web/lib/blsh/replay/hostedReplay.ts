/** BLSH v6 hosted fixture replay of the 2026-11-19 slate (TJ, 2026-11-20). Test mode only.
 *
 * Runs the real v6 native handler + core + packet sink + capture store, the real request-context handler + store, and the
 * held ledger readers, inside one cron-authenticated request. Exactly four things are substituted:
 *   1. input transport: a fixture adapter serves the hash-pinned frozen bytes; it opens no connection. Every transport and
 *      admission record it produces says "replay-fixture", and its TLS facts are unauthorized placeholders;
 *   2. the gate clock: only the native handler's window gate sees 2026-11-20T12:05:03Z (the slate's v6 window); all else is real time;
 *   3. keys: the request-context approval is signed by an Ed25519 key generated in memory for this request only;
 *   4. storage: both stores reach the private sandbox (Data API schema blsh_replay_api) with the sandbox token. The service-role
 *      key is never read; the stores receive a placeholder string and the sandbox transports discard their auth headers.
 * Nothing here can reach a live table: the token's role has no grant outside blsh_replay_api, and the transports refuse any
 * URL other than the sandbox RPCs and the two sandbox storage shapes. */
import { AsyncLocalStorage } from "node:async_hooks";
import { createHash, generateKeyPairSync, sign } from "node:crypto";
import { channel } from "node:diagnostics_channel";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { Readable } from "node:stream";
import type { NextApiRequest, NextApiResponse } from "next";
import { PINNED_SUPABASE_ORIGIN, runNativeCaptureV6, runtimePrecheckV6, type CaptureDispatch, type NativeCaptureAdapterV6 } from "../nativeCaptureV6/core";
import { createBlshNativeCaptureHandler } from "../nativeCaptureV6/handler";
import { createPacketSink } from "../nativeCaptureV6/sink";
import { observerSelfTest } from "../nativeCaptureV6/tlsObservation";
import { createCaptureStore, type WriterTransport } from "../nativeCaptureV6/writer";
import liveRequestContextHandler, { createRequestContextHandler, requestContextApprovalBytes } from "../nativeCaptureV6/requestContextHandler";
import { createRequestContextStore, type ContextTransport } from "../nativeCaptureV6/requestContextStore";

export const REPLAY_MARK = "replay-fixture";
export const REPLAY_SOURCE_DATE = "2026-11-19";
export const REPLAY_GATE_CLOCK_START = Date.parse("2026-11-20T12:05:03Z");
export const REPLAY_API_SCHEMA = "blsh_replay_api";
export const REPLAY_RECEIPT_KEY = "hosted-replay-2026-11-19";
/** fixtures/FIXTURES.json of refs/rc/blsh-v6-replay-20261120 (Drive envelope f2525c71...): the only bytes the adapter serves. */
export const REPLAY_FIXTURE_PINS: Readonly<Record<string, string>> = Object.freeze({
  "FIXTURES.json": "1d660d3ef5ff3f5a0cbebae3ff438e6af499d2d994265faae7ddc7f617576404",
  "reconstructed/schedule-2026-11-19.json": "4097ee82069bbaeee807b79829da60906d6b10e00f0a55237a98e9a74b17a146",
  "synthetic/nst-individual-2026-11-19.html": "6b56920095aef1485715e5ff9130136410a87ba23c36f23e7dcb260bf6d61ada",
  "synthetic/nst-onIce-2026-11-19.html": "caca24b5c69ef7d843e507c8a5cb93f5acd3e821da00916d04df438ec229d832",
  "synthetic/context-seed-2026-11-19.sql": "e3f2d9de600788f2f48bc76e9836fc44f2944713f668b326062b3d043ff25209",
});
/** What the stores receive instead of the service-role key. The sandbox transports never forward it. */
export const NO_SERVICE_KEY = "blsh-replay-no-service-key";
const SUPABASE_HOST = new URL(PINNED_SUPABASE_ORIGIN).hostname;
const sha = (bytes: Uint8Array | Buffer) => createHash("sha256").update(new Uint8Array(bytes)).digest("hex");
const need = (ok: unknown, code: string): void => { if (!ok) throw new Error(code); };

export type ReplayApi = { url: string; anonKey: string; token: string };

/** One call into the sandbox Data API schema, as the sandbox role. */
export async function callReplayApi(api: ReplayApi, name: string, args: unknown, timeoutMs: number): Promise<{ status: number; body: Buffer }> {
  need(/^[a-z0-9_]{3,64}$/.test(name), "replay_rpc_name_invalid");
  const response = await fetch(`${api.url}/rest/v1/rpc/${name}`, {
    method: "POST", cache: "no-store", redirect: "error", signal: AbortSignal.timeout(timeoutMs),
    headers: { apikey: api.anonKey, Authorization: `Bearer ${api.token}`, "Content-Type": "application/json", Accept: "application/json",
      "Content-Profile": REPLAY_API_SCHEMA, "Accept-Profile": REPLAY_API_SCHEMA },
    body: JSON.stringify(args ?? {}),
  });
  return { status: response.status, body: Buffer.from(await response.arrayBuffer()) };
}

/** URL shapes the live stores produce, mapped onto sandbox RPCs. Anything else is refused. */
function sandboxRoute(url: string, method: string, body: Buffer | undefined, contentType: string | undefined) {
  const u = new URL(url);
  need(u.origin === PINNED_SUPABASE_ORIGIN && !u.search, "replay_transport_origin_refused");
  const rpc = /^\/rest\/v1\/rpc\/([a-z0-9_]+)$/.exec(u.pathname);
  if (rpc && method === "POST") {
    need(/^blsh_(capture|context)_[a-z_]+_v1$|^blsh_request_context_v1$/.test(rpc[1]), "replay_transport_rpc_refused");
    return { name: rpc[1], args: JSON.parse((body ?? Buffer.from("{}")).toString("utf8")), kind: "rpc" as const };
  }
  const get = /^\/storage\/v1\/object\/authenticated\/(blsh-native-packets|blsh-request-context)\/(.+)$/.exec(u.pathname);
  if (get && method === "GET") return { name: "blsh_replay_storage_get_v1", args: { p_bucket: get[1], p_name: decodeURIComponent(get[2]) }, kind: "get" as const };
  const put = /^\/storage\/v1\/object\/(blsh-native-packets|blsh-request-context)\/(.+)$/.exec(u.pathname);
  if (put && method === "POST") {
    return { name: "blsh_replay_storage_put_v1", kind: "put" as const, args: { p_bucket: put[1], p_name: decodeURIComponent(put[2]),
      p_mime: String(contentType ?? "").split(";")[0], p_b64: (body ?? Buffer.alloc(0)).toString("base64") } };
  }
  throw new Error("replay_transport_path_refused");
}

export function sandboxWriterTransport(api: ReplayApi): WriterTransport {
  return async request => {
    const route = sandboxRoute(request.url, request.method, request.body, request.headers["Content-Type"]);
    need(route.kind !== "get", "replay_transport_path_refused");
    const result = await callReplayApi(api, route.name, route.args, request.timeoutMs);
    // The live Storage API answers an upload with {"Key": ...}; the writer only reads the status.
    return route.kind === "put" && result.status === 200 ? { status: 200, body: Buffer.from(JSON.stringify({ Key: `${route.args.p_bucket}/${route.args.p_name}` })) } : result;
  };
}

export function sandboxContextTransport(api: ReplayApi): ContextTransport {
  return async ({ method, url, body, headers, limit, timeoutMs }) => {
    const route = sandboxRoute(url, method, body, headers["Content-Type"] ?? headers["content-type"]);
    const result = await callReplayApi(api, route.name, route.args, timeoutMs);
    need(result.status >= 200 && result.status <= 299, "replay_transport_status");
    if (route.kind === "get") {
      const b64 = JSON.parse(result.body.toString("utf8"));
      need(typeof b64 === "string", "replay_storage_object_missing");
      const bytes = Buffer.from(b64, "base64");
      need(bytes.length <= limit, "replay_storage_object_limit");
      return bytes;
    }
    if (route.kind === "put") return Buffer.from(JSON.stringify({ Key: `${route.args.p_bucket}/${route.args.p_name}` }));
    need(result.body.length <= limit, "replay_rpc_response_limit");
    return result.body;
  };
}

/** Placeholder TLS facts: the shape the core records, every free-text field "replay-fixture", authorized false, no real certificate. */
function fixtureTls(url: string, connectionSequence: number) {
  return { channel: "undici:client:sendHeaders", authorized: false, authorizationError: `${REPLAY_MARK}: no network connection was made`,
    servername: new URL(url).hostname, alpnProtocol: REPLAY_MARK, protocol: REPLAY_MARK, cipher: { name: REPLAY_MARK, standardName: null, version: null },
    sessionReused: false, connectionReused: false, connectionSequence,
    peerCertificate: { fingerprint256: Array(32).fill("00").join(":"), valid_from: REPLAY_MARK, valid_to: REPLAY_MARK, subjectCN: REPLAY_MARK, issuerCNChain: [REPLAY_MARK] } };
}

/** The v6 adapter contract over frozen bytes: schedule, then per group one admission and one NST response, in the core's order. */
export function createReplayFixtureAdapterV6(sourceDate: string, bytes: { schedule: Buffer; individual: Buffer; onIce: Buffer }): NativeCaptureAdapterV6 {
  need(sourceDate === REPLAY_SOURCE_DATE, "replay_adapter_date_invalid");
  let sequence = 0;
  const scheduleUrl = `https://api-web.nhle.com/v1/schedule/${sourceDate}`;
  return {
    sourceDate,
    supabaseOrigin: PINNED_SUPABASE_ORIGIN,
    schedule(dispatch: CaptureDispatch) {
      return dispatch("schedule", async spec => {
        need(spec.method === "GET" && spec.url === scheduleUrl, "capture_schedule_scope_invalid");
        return { bytes: new Uint8Array(bytes.schedule), status: 200, finalUrl: spec.url, redirected: false, tls: fixtureTls(spec.url, ++sequence) };
      });
    },
    async nst(group, url, options) {
      await options.dispatch(`admission:${group}`, async spec => ({ kind: "admission", httpStatus: 200, valid: true, allowed: true, waitMs: 0,
        source: REPLAY_MARK, tls: fixtureTls(spec.url, ++sequence) }));
      const body = group === "individual" ? bytes.individual : bytes.onIce;
      const provider = await options.dispatch(`nst:${group}`, async spec => {
        need(spec.method === "GET" && spec.url === url, "capture_provider_scope_invalid");
        return { status: 200, finalUrl: spec.url, redirected: false, decodedBytes: body.length, tls: fixtureTls(spec.url, ++sequence) };
      });
      return { ...provider, value: { status: 200, finalUrl: url, redirected: false, bytes: new Uint8Array(body) } };
    },
  };
}

/** A NextApiResponse stand-in that captures one status + JSON body. */
function captureResponse() {
  let settle!: (value: { http: number; body: unknown }) => void;
  const done = new Promise<{ http: number; body: unknown }>(resolve => { settle = resolve; });
  let code = 200;
  const res = { setHeader() { return res; }, status(value: number) { code = value; return res; }, json(body: unknown) { settle({ http: code, body }); return res; } };
  return { res: res as unknown as NextApiResponse, done };
}
async function invokeHandler(handler: (req: NextApiRequest, res: NextApiResponse) => unknown, req: NextApiRequest) {
  const { res, done } = captureResponse();
  await Promise.resolve(handler(req, res));
  return done;
}
/** A raw POST body stream, as Next delivers it to a route with bodyParser disabled. */
function rawJsonRequest(authorization: string, body: Buffer): NextApiRequest {
  const stream = Readable.from([body]) as Readable & Record<string, unknown>;
  Object.assign(stream, { method: "POST", query: {}, body: undefined, aborted: false, complete: false,
    headers: { authorization, "content-type": "application/json", "content-length": String(body.length) } });
  stream.on("end", () => { stream.complete = true; });
  return stream as unknown as NextApiRequest;
}

/** Every outbound HTTP request created inside the replay's async scope (undici and node:http), by origin. */
async function withOutboundLog<T>(action: () => Promise<T>) {
  const scope = new AsyncLocalStorage<object>(), token = {}, seen: string[] = [];
  const onUndici = (message: unknown) => {
    try { if (scope.getStore() === token) { const r = (message as { request?: { origin?: unknown } }).request; seen.push(new URL(String(r?.origin)).host); } } catch { seen.push("unparsed"); }
  };
  const onHttp = (message: unknown) => {
    try { if (scope.getStore() === token) { const r = (message as { request?: { host?: unknown; getHeader?: (n: string) => unknown } }).request; seen.push(String(r?.getHeader?.("host") ?? r?.host)); } } catch { seen.push("unparsed"); }
  };
  const undici = channel("undici:request:create"), http = channel("http.client.request.start");
  undici.subscribe(onUndici); http.subscribe(onHttp);
  try { return { result: await scope.run(token, action), outbound: seen }; }
  finally { undici.unsubscribe(onUndici); http.unsubscribe(onHttp); }
}

/** Writes the sandbox export in the layout the held readers take (export dir: run.json, objects.json, objects/<path>). */
function writeExport(dir: string, part: { run: Record<string, unknown>; objects: ({ path: string; b64: string | null } & Record<string, unknown>)[] }) {
  mkdirSync(join(dir, "objects"), { recursive: true });
  writeFileSync(join(dir, "run.json"), JSON.stringify(part.run) + "\n");
  writeFileSync(join(dir, "objects.json"), JSON.stringify(part.objects.map(({ b64: _b64, ...row }) => row)) + "\n");
  for (const object of part.objects) {
    need(typeof object.b64 === "string" && !object.path.includes(".."), "replay_export_object_missing");
    const file = join(dir, "objects", object.path);
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, new Uint8Array(Buffer.from(object.b64 as string, "base64")));
  }
}

async function heldReaders(exported: { native?: Parameters<typeof writeExport>[1]; context?: Parameters<typeof writeExport>[1] },
  pins: { sourceDate: string; deploymentId: string; gitCommitSha: string; nativeManifestSHA256?: string }) {
  const root = mkdtempSync(join(tmpdir(), "blsh-replay-"));
  const out: Record<string, unknown> = {};
  try {
    const { readRequestContextV6Export } = await import("../../../scripts/blsh/readRequestContextV6");
    if (!exported.native) return { error: "replay_native_export_missing" };
    // Native stages 1 and 2 (scripts/blsh/readNativeV6Ledger.ts, reviewNativeV6Packet.mjs) read repository files and cannot be
    // bundled into a function; the operator runs them over this sandbox's read-only export (hosted/readback_export.py).
    out.native = { offline: "operator_readback" };
    if (exported.context) {
      writeExport(join(root, "context"), exported.context);
      const contextPins = { sourceDate: pins.sourceDate, nativeRunId: String(exported.native.run.run_id), nativeManifestSHA256: String(pins.nativeManifestSHA256),
        runId: String(exported.context.run.run_id), manifestSHA256: String(exported.context.run.manifest_sha256), deploymentId: pins.deploymentId, gitCommitSha: pins.gitCommitSha };
      try { out.context = { ok: true, receipt: readRequestContextV6Export(join(root, "context"), contextPins).receipt }; }
      catch (error) { out.context = { ok: false, error: (error as Error).message?.slice(0, 200) }; }
    }
    return out;
  } finally { rmSync(root, { recursive: true, force: true }); }
}

/** First call: the slate's v6 window (2026-11-20T12:05:03Z). Every later call: real time. */
function gateClock() {
  let gate = true;
  return () => { if (gate) { gate = false; return REPLAY_GATE_CLOCK_START; } return Date.now(); };
}

export type ReplayContext = { api: ReplayApi; cronAuthorization: string; deploymentId: string; gitCommitSha: string; enteredAt: number; contextCutoffMs: number };

export async function runHostedReplay(ctx: ReplayContext) {
  const timings: Record<string, number> = {};
  const mark = (name: string) => { timings[name] = Date.now() - ctx.enteredAt; };
  const { result, outbound } = await withOutboundLog(async () => {
    // 1. The frozen fixture, re-verified here against the pins compiled into this route.
    const fixtureCall = await callReplayApi(ctx.api, "blsh_replay_fixture_v1", {}, 10_000);
    need(fixtureCall.status === 200, "replay_fixture_unreadable");
    const files = new Map<string, Buffer>((JSON.parse(fixtureCall.body.toString("utf8")).files as { path: string; b64: string }[]).map(f => [f.path, Buffer.from(f.b64, "base64")]));
    const fixture = Object.entries(REPLAY_FIXTURE_PINS).map(([path, pin]) => ({ path, pin, ok: files.has(path) && sha(files.get(path)!) === pin }));
    need(fixture.every(f => f.ok), "replay_fixture_hash_mismatch");
    mark("fixtureVerified");

    // 2. Native v6: the real handler, core, sink and store; fixture transport, gate clock, sandbox store.
    const adapter = createReplayFixtureAdapterV6(REPLAY_SOURCE_DATE, { schedule: files.get("reconstructed/schedule-2026-11-19.json")!,
      individual: files.get("synthetic/nst-individual-2026-11-19.html")!, onIce: files.get("synthetic/nst-onIce-2026-11-19.html")! });
    const nativeHandler = createBlshNativeCaptureHandler({
      // The handler reads deps.now() twice: first for the window gate (selectSourceDate), then for the plan's plannedAtUTC,
      // which prepareNativeProcessCapture checks against the real Date.now(). Only the gate sees the slate's v6 window;
      // the plan, the core, the database and every recorded timestamp stay on real hosted time.
      now: gateClock(),
      precheck: runtimePrecheckV6,
      createStore: () => createCaptureStore({ origin: PINNED_SUPABASE_ORIGIN, serviceKey: NO_SERVICE_KEY, transport: sandboxWriterTransport(ctx.api) }),
      createAdapter: () => adapter,
      createSink: (store, runId, sourceDate) => createPacketSink({ store, runId, sourceDate }),
      run: runNativeCaptureV6,
      selfTest: observerSelfTest,
      routeBundlePath: null,
    });
    const native = await invokeHandler(nativeHandler, { method: "POST", query: {}, headers: { authorization: ctx.cronAuthorization } } as unknown as NextApiRequest);
    mark("native");

    // 3. Request context: the real handler and store, an in-memory test key, the sandbox store.
    const exportCall = async () => {
      const call = await callReplayApi(ctx.api, "blsh_replay_export_v1", { p_source_date: REPLAY_SOURCE_DATE }, 15_000);
      need(call.status === 200, "replay_export_unreadable");
      return JSON.parse(call.body.toString("utf8")) as { native: { run: Record<string, unknown> & { run_id: string; manifest_sha256: string | null }; objects: never[] } | null; context: { run: Record<string, unknown> & { run_id: string; manifest_sha256: string }; objects: never[] } | null };
    };
    const afterNative = await exportCall();
    const nativeRun = afterNative.native?.run;
    let context: Record<string, unknown> = { skipped: "native_not_complete" };
    if (nativeRun?.state === "packet_complete_pending_review" && nativeRun.manifest_sha256) {
      if (Date.now() - ctx.enteredAt > ctx.contextCutoffMs) context = { skipped: "route_budget" };
      else {
        const { privateKey, publicKey } = generateKeyPairSync("ed25519");
        const approval = { sourceDate: REPLAY_SOURCE_DATE, nativeRunId: nativeRun.run_id, nativeManifestSHA256: nativeRun.manifest_sha256,
          deploymentId: ctx.deploymentId, gitCommitSha: ctx.gitCommitSha };
        const grant = (a: typeof approval) => Buffer.from(JSON.stringify({ approval: a, signature: sign(null, requestContextApprovalBytes(a), privateKey).toString("base64") }));
        const tampered = Buffer.from(JSON.stringify({ approval: { ...approval, nativeManifestSHA256: approval.nativeManifestSHA256.replace(/.$/, c => c === "0" ? "1" : "0") },
          signature: sign(null, requestContextApprovalBytes(approval), privateKey).toString("base64") }));
        const contextHandler = createRequestContextHandler({
          approvalPublicKeyPem: () => publicKey.export({ type: "spki", format: "pem" }).toString().trim(),
          createStore: async () => createRequestContextStore({ serviceKey: NO_SERVICE_KEY, transport: sandboxContextTransport(ctx.api) }),
        });
        const tamperedResult = await invokeHandler(contextHandler, rawJsonRequest(ctx.cronAuthorization, tampered));
        // The live route with this test-key grant: no live key (skipped) or a different live key (approval_invalid); never I/O.
        const liveRoute = await invokeHandler(liveRequestContextHandler, rawJsonRequest(ctx.cronAuthorization, grant(approval)));
        const valid = await invokeHandler(contextHandler, rawJsonRequest(ctx.cronAuthorization, grant(approval)));
        context = { tamperedGrant: tamperedResult, liveRouteWithTestGrant: liveRoute, grant: valid };
      }
    }
    mark("context");

    // 4. Held readers over the stored sandbox packets.
    const exported = await exportCall();
    const readers = await heldReaders({ native: exported.native ?? undefined, context: exported.context ?? undefined },
      { sourceDate: REPLAY_SOURCE_DATE, deploymentId: ctx.deploymentId, gitCommitSha: ctx.gitCommitSha, nativeManifestSHA256: exported.native?.run.manifest_sha256 ?? undefined });
    mark("readers");
    const summary = {
      native: exported.native ? { runId: exported.native.run.run_id, state: exported.native.run.state, reason: exported.native.run.reason, manifestSHA256: exported.native.run.manifest_sha256,
        objects: exported.native.objects.length } : null,
      context: exported.context ? { runId: exported.context.run.run_id, state: exported.context.run.state, manifestSHA256: exported.context.run.manifest_sha256,
        objects: exported.context.objects.length } : null,
    };
    return { fixture, native, context, readers, summary };
  });
  const receipt = { version: "fhfh.blsh.hosted-replay-receipt.v1", label: REPLAY_MARK, sourceDate: REPLAY_SOURCE_DATE, deploymentId: ctx.deploymentId,
    gitCommitSha: ctx.gitCommitSha, gateClockStartUTC: new Date(REPLAY_GATE_CLOCK_START).toISOString(), ...result, timings,
    outboundHosts: [...new Set(outbound)].sort(), outboundRequests: outbound.length,
    nonSandboxOutbound: outbound.filter(host => host !== SUPABASE_HOST && !/^127\.0\.0\.1(:\d+)?$/.test(host)) };
  const stored = await callReplayApi(ctx.api, "blsh_replay_receipt_put_v1", { p_key: REPLAY_RECEIPT_KEY, p_receipt: receipt }, 10_000);
  timings.total = Date.now() - ctx.enteredAt;
  return { ...receipt, receiptWritten: stored.status === 200 ? JSON.parse(stored.body.toString("utf8")) === true : `http_${stored.status}` };
}
