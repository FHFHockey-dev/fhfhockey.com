/** Explicitly constructed adapter; no CLI or automatic invocation. Running it
 * reaches providers and the production admission ledger and needs separate approval.
 * Tests use the real NST client/lifecycle with mocked fetch and local ledger.
 */
import { channel } from "node:diagnostics_channel";
import { fetchNstTextByUrl, type NstOperationHook } from "../../lib/nst/client";
import { runNstJob } from "../../lib/nst/jobLifecycle.server";
import { NST_ADMISSION_PROJECT_HOST, nstAdmissionOrigin } from "../../lib/nst/admissionOrigin";
import type { Captured, CaptureDispatchSpec, CaptureResponse, NativeCaptureAdapter } from "./nativeProcessCaptureRunner";

const ORIGIN = `https://${NST_ADMISSION_PROJECT_HOST}`;
const need = (ok: unknown, code: string): void => { if (!ok) throw new Error(code); };
type TransportFacts = Omit<CaptureResponse, "bytes"> & { decodedBytes: number; tls: TlsObservation };

// Node 22.23.4's bundled undici publishes this per request, after the connection
// is up and before headers go out: { request, headers, socket }. It survives
// keep-alive reuse. Only socket facts are read; request paths and headers can
// carry the NST key or the service-role bearer and are never kept.
export const TLS_OBSERVATION_CHANNEL = "undici:client:sendHeaders";
type Peer = { fingerprint256?: unknown; valid_from?: unknown; valid_to?: unknown; subject?: { CN?: unknown }; issuer?: { CN?: unknown }; issuerCertificate?: Peer };
type SocketLike = { encrypted?: unknown; authorized?: unknown; authorizationError?: unknown; servername?: unknown; alpnProtocol?: unknown;
  isSessionReused?: () => unknown; getProtocol?: () => unknown; getCipher?: () => { name?: unknown; standardName?: unknown; version?: unknown } | undefined; getPeerCertificate?: (detailed: boolean) => Peer };
const str = (value: unknown) => typeof value === "string" ? value : null;
export type TlsObservation = NonNullable<ReturnType<typeof socketTls>>;
// Opaque per-process connection numbers, so the runner can bind a keep-alive reuse
// to the operation that opened the connection. Never a socket address or port.
const connections = new WeakMap<object, number>();
let connectionCount = 0;
function socketTls(socket: SocketLike | undefined) {
  // Duck-typed: importing node:tls here would load TLS for every adapter caller.
  if (!socket || socket.encrypted !== true || typeof socket.getPeerCertificate !== "function"
    || typeof socket.getProtocol !== "function" || typeof socket.getCipher !== "function") return null;
  const sessionReused = typeof socket.isSessionReused === "function" && socket.isSessionReused() === true;
  const leaf = socket.getPeerCertificate(true);
  const hasLeaf = !!leaf && typeof leaf.fingerprint256 === "string";
  // Node 22.23.4 exposes no peer certificate on a resumed session ({}). Only then is
  // it absent; the runner binds the resumption to this run's earlier full handshake.
  if (!hasLeaf && !sessionReused) return null;
  const connectionReused = connections.has(socket);
  if (!connectionReused) connections.set(socket, ++connectionCount);
  const issuerCNChain: (string | null)[] = [], seen = new Set<Peer>();
  for (let cert: Peer | undefined = hasLeaf ? leaf : undefined; cert && !seen.has(cert) && issuerCNChain.length < 10; cert = cert.issuerCertificate) {
    seen.add(cert); issuerCNChain.push(str(cert.issuer?.CN));
  }
  const cipher = socket.getCipher();
  return { channel: TLS_OBSERVATION_CHANNEL, authorized: socket.authorized === true,
    authorizationError: socket.authorizationError == null ? null : String(socket.authorizationError),
    servername: str(socket.servername), alpnProtocol: str(socket.alpnProtocol), protocol: str(socket.getProtocol()),
    cipher: { name: str(cipher?.name), standardName: str(cipher?.standardName), version: str(cipher?.version) },
    sessionReused, connectionReused, connectionSequence: connections.get(socket)!,
    peerCertificate: hasLeaf ? { fingerprint256: leaf.fingerprint256 as string, valid_from: str(leaf.valid_from), valid_to: str(leaf.valid_to), subjectCN: str(leaf.subject?.CN), issuerCNChain } : null };
}

/** Runs one HTTPS action and attaches the TLS facts of the single request it sent
 * to this origin, path and method. Records in the listener (which never throws);
 * enforces after the action settles. No matching TLS observation fails closed. */
export async function withTlsObservation<T extends object>(url: string, method: string, action: () => Promise<T>): Promise<T & { tls: TlsObservation }> {
  const expected = new URL(url), events: (TlsObservation | null)[] = [];
  const listener = (message: unknown) => {
    try {
      const { request, socket } = message as { request?: { origin?: unknown; path?: unknown; method?: unknown }; socket?: SocketLike };
      const path = typeof request?.path === "string" ? request.path.split("?")[0] : null;
      const matches = request?.origin != null && new URL(String(request.origin)).origin === expected.origin && path === expected.pathname && request.method === method;
      events.push(matches ? socketTls(socket) : null);
    } catch { events.push(null); }
  };
  const observation = channel(TLS_OBSERVATION_CHANNEL);
  observation.subscribe(listener);
  let result: T;
  try { result = await action(); } finally { observation.unsubscribe(listener); }
  need(events.length === 1 && events[0] !== null, "capture_tls_observation_missing");
  return { ...result, tls: events[0]! };
}

/** Bounded schedule/lifecycle transport. The NST body path stays in its client. */
async function boundedFetch(spec: CaptureDispatchSpec, init: Pick<RequestInit, "headers" | "body"> = {}) {
  const controller = new AbortController();
  const abort = () => controller.abort();
  if (spec.signal.aborted) abort(); else spec.signal.addEventListener("abort", abort, { once: true });
  let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
  const cancel = () => { void reader?.cancel().catch(() => {}); };
  controller.signal.addEventListener("abort", cancel, { once: true });
  try {
    need(!controller.signal.aborted, "capture_transport_aborted");
    const response = await fetch(spec.url, { ...init, method: spec.method, redirect: spec.redirect, cache: "no-store", signal: controller.signal });
    need(response.status === 200 && response.url === spec.url && !response.redirected, "capture_transport_response_invalid");
    need(response.body, "capture_transport_body_missing");
    reader = response.body!.getReader();
    const chunks: Uint8Array[] = [];
    let size = 0;
    while (true) {
      need(!controller.signal.aborted, "capture_transport_aborted");
      const { done, value } = await reader.read();
      need(!controller.signal.aborted, "capture_transport_aborted");
      if (done) break;
      need(value.byteLength <= spec.maxResponseBytes - size, "capture_transport_body_limit");
      size += value.byteLength; chunks.push(value.slice());
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    return { bytes, status: response.status, finalUrl: response.url, redirected: response.redirected };
  } catch {
    controller.abort(); cancel();
    throw new Error("capture_transport_failed");
  } finally {
    spec.signal.removeEventListener("abort", abort);
    controller.signal.removeEventListener("abort", cancel);
    reader?.releaseLock();
  }
}

export function createNativeProcessCaptureAdapter(expected: Pick<NativeCaptureAdapter, "supabaseOrigin" | "lifecycleMode">): NativeCaptureAdapter {
  need(expected.supabaseOrigin === ORIGIN && ["enabled", "disabled"].includes(expected.lifecycleMode), "capture_adapter_target_invalid");
  const mode = expected.lifecycleMode;
  const assertEnvironment = () => {
    const raw = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const origin = nstAdmissionOrigin(raw);
    // The shared helper allows reserved offline hosts. This specific pilot does
    // not: tests mock fetch at the exact proposed production-shaped origin.
    need(origin?.origin === ORIGIN && raw?.trim() === ORIGIN, "capture_adapter_project_changed");
    need((process.env.NST_JOB_LIFECYCLE_ENABLED === "true" ? "enabled" : "disabled") === mode, "capture_adapter_mode_changed");
    need(process.env.NST_KEY?.trim() && process.env.SUPABASE_SERVICE_ROLE_KEY?.trim(), "capture_adapter_credentials_missing");
  };
  assertEnvironment();
  return {
    sourcePath: __filename,
    get supabaseOrigin() { assertEnvironment(); return ORIGIN; },
    get lifecycleMode() { assertEnvironment(); return mode; },
    schedule(dispatch) {
      assertEnvironment();
      return dispatch("schedule", spec => {
        assertEnvironment();
        need(spec.method === "GET" && spec.url === "https://api-web.nhle.com/v1/schedule/2026-11-11", "capture_schedule_scope_invalid");
        return withTlsObservation(spec.url, spec.method, () => boundedFetch(spec, { headers: { Accept: "application/json" } }));
      });
    },
    async withJob({ deadlineAt, settled, dispatch }, work) {
      assertEnvironment();
      await runNstJob({ owner: "blsh-native-process-pilot", deadlineAt, settled, rpc: async (name, args, rpcDeadline) => {
        assertEnvironment();
        const operations = { nst_job_begin_v1: "begin", nst_job_finish_v1: "finish", nst_job_hold_v1: "hold" } as const;
        const operation = operations[name as keyof typeof operations];
        need(operation, "capture_lifecycle_operation_invalid");
        need(typeof args.p_token === "string", "capture_lifecycle_reference_invalid");
        const captured = await dispatch(operation, async spec => {
          assertEnvironment();
          need(spec.method === "POST" && spec.url === `${ORIGIN}/rest/v1/rpc/${name}` && Date.now() < rpcDeadline, "capture_lifecycle_scope_invalid");
          const key = process.env.SUPABASE_SERVICE_ROLE_KEY!.trim();
          const response = await boundedFetch(spec, { headers: { "Content-Type": "application/json", apikey: key, Authorization: `Bearer ${key}` }, body: JSON.stringify(args) });
          const receipt = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(response.bytes)) as Record<string, unknown>;
          const status = { begin: "started", finish: "finished", hold: "held" }[operation];
          need(receipt?.status === status && receipt.token === args.p_token, "capture_lifecycle_unacknowledged");
          return receipt;
        }, { jobToken: args.p_token as string });
        return captured.value;
      } }, async () => { assertEnvironment(); await work(); });
    },
    async nst(group, url, options) {
      assertEnvironment();
      let provider: Captured<TransportFacts> | undefined;
      const operationHook: NstOperationHook = async (operation, perform) => {
        assertEnvironment();
        need(operation.attempt === 1, "capture_nst_repeat_forbidden");
        if (operation.kind === "admission") {
          await options.dispatch(`admission:${group}`, async spec => {
            assertEnvironment();
            need(operation.method === spec.method && operation.redactedUrl === spec.url, "capture_admission_scope_invalid");
            const settlement = await withTlsObservation(spec.url, spec.method, () => perform({ signal: spec.signal }));
            need(settlement.kind === "admission", "capture_admission_settlement_invalid");
            return settlement;
          });
        } else {
          provider = await options.dispatch(`nst:${group}`, async spec => {
            assertEnvironment();
            need(operation.method === spec.method && operation.redactedUrl === spec.url && spec.url === url, "capture_provider_scope_invalid");
            const settlement = await withTlsObservation(spec.url, spec.method, () => perform({ signal: spec.signal }));
            need(settlement.kind === "provider", "capture_provider_settlement_invalid");
            if (settlement.kind !== "provider") throw new Error("capture_provider_settlement_invalid");
            need(settlement.decodedBytes > 0 && settlement.decodedBytes <= spec.maxResponseBytes, "capture_provider_byte_limit");
            return { status: settlement.httpStatus, finalUrl: settlement.finalUrl, redirected: settlement.redirected, decodedBytes: settlement.decodedBytes, tls: settlement.tls };
          });
        }
      };
      const result = await fetchNstTextByUrl(url, { requestControl: options.requestControl, retries: options.retries,
        allowQueryKeyFallback: options.allowQueryKeyFallback, timeoutMs: options.timeoutMs,
        maxResponseBytes: options.maxResponseBytes, maxAdmissionCalls: options.maxAdmissionCalls, operationHook });
      assertEnvironment();
      need(provider && result.redactedUrl === url, "capture_provider_witness_missing");
      // Reject credential echoes; never alter the client's exact parser input or
      // put a secret/response excerpt into a failure message. Runtime review is
      // still required; these comparisons are not proof of every redaction form.
      for (const value of [process.env.NST_KEY!, process.env.SUPABASE_SERVICE_ROLE_KEY!]) {
        const secret = value.trim();
        need(!result.text.includes(secret) && !result.text.includes(encodeURIComponent(secret)), "capture_credential_echo");
      }
      return { ...provider!, value: { status: result.response.status, finalUrl: result.response.url,
        redirected: result.response.redirected, bytes: Buffer.from(result.text, "utf8") } };
    },
  };
}
