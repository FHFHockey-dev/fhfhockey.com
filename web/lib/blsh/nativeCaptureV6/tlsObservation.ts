/** BLSH native capture v6: the TLS observer, attributed by async context (M1-FIX-DESIGN parts 1 and 3).
 * Fluid compute lets other invocations share this process, so v5's rule "exactly one undici request
 * in the process during the action" can be broken by traffic that is not ours. This observer counts
 * only requests CREATED inside the observed action's own async context (undici:request:create, read
 * through an AsyncLocalStorage token) and matches their undici:client:sendHeaders events by request
 * object identity. Requests from any other context are ignored. Exactly one attributed request is
 * still required, and v5's origin/path/method match and socket facts apply to it unchanged.
 * The block between the markers is byte-identical to lines 14-52 of the reviewed v5 adapter
 * (web/scripts/blsh/nativeProcessCaptureAdapter.ts, sha256 aa6237bd...); tlsObservation.test.ts pins
 * its sha256 (f05d54f6...). Only withTlsObservation (v5 lines 54-73) is replaced. */
import { AsyncLocalStorage } from "node:async_hooks";
import { channel } from "node:diagnostics_channel";

const need = (ok: unknown, code: string): void => { if (!ok) throw new Error(code); };
// ---- BEGIN VERBATIM v5 nativeProcessCaptureAdapter.ts lines 14-52 (348a122d6) ----

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
// ---- END VERBATIM v5 ----

/** Published by undici's Request constructor, synchronously in the dispatching caller's async context. */
export const REQUEST_CREATE_CHANNEL = "undici:request:create";
const attribution = new AsyncLocalStorage<object>();

/** Runs `action` under a fresh context token. Every undici request created inside it is attributed;
 * `onAttributed` receives only the sendHeaders events of those requests. Listeners never throw. */
export async function withAttributedRequests<T>(action: () => Promise<T>, onAttributed: (message: unknown) => void): Promise<{ result: T; created: number }> {
  const token = {}, created = new Set<object>();
  const requestOf = (message: unknown) => {
    const request = (message as { request?: unknown } | null)?.request;
    return typeof request === "object" && request !== null ? request : null;
  };
  const onCreate = (message: unknown) => {
    try { const request = requestOf(message); if (request && attribution.getStore() === token) created.add(request); } catch { /* never throws */ }
  };
  const onSend = (message: unknown) => {
    try { const request = requestOf(message); if (request && created.has(request)) onAttributed(message); } catch { /* never throws */ }
  };
  const create = channel(REQUEST_CREATE_CHANNEL), send = channel(TLS_OBSERVATION_CHANNEL);
  create.subscribe(onCreate); send.subscribe(onSend);
  try { return { result: await attribution.run(token, action), created: created.size }; }
  finally { create.unsubscribe(onCreate); send.unsubscribe(onSend); }
}

/** Runs one HTTPS action and attaches the TLS facts of the single request it created and sent
 * to this origin, path and method. Requests created outside the action's context are ignored.
 * Records in the listener (which never throws); enforces after the action settles. Anything
 * other than exactly one attributed, matching, observed request fails closed. */
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
  const { result, created } = await withAttributedRequests(action, listener);
  need(created === 1 && events.length === 1 && events[0] !== null, "capture_tls_observation_missing");
  return { ...result, tls: events[0]! };
}

export const OBSERVER_SELFTEST_PATH = "/blsh-observer-selftest";
const SELFTEST_TIMEOUT_MS = 3_000;

/** Pre-claim self-test (gate 5.5): proves, in this runtime and bundle, that a global fetch made inside
 * an attributed action is tagged, and that concurrent untagged traffic is ignored. Plain HTTP on a
 * loopback server this function owns; no external network and no TLS (socketTls is not involved, so
 * nothing is registered in `connections`). Returns null on success or a refusal code; never throws. */
export async function observerSelfTest(): Promise<string | null> {
  const FAIL = "observer_selftest_failed";
  let server: import("node:http").Server | undefined;
  const timer = new AbortController(), timeout = setTimeout(() => timer.abort(), SELFTEST_TIMEOUT_MS);
  try {
    const { createServer } = await import("node:http");
    const live = createServer((req, res) => { req.resume(); req.on("end", () => { res.setHeader("connection", "close"); res.end("ok"); }); });
    server = live;
    await new Promise<void>((resolve, reject) => { live.once("error", reject); live.listen(0, "127.0.0.1", () => resolve()); });
    const address = live.address();
    if (!address || typeof address === "string") return FAIL;
    const url = `http://127.0.0.1:${address.port}${OBSERVER_SELFTEST_PATH}`;
    const fetchText = (path: string) => fetch(`http://127.0.0.1:${address.port}${path}`, { method: "GET", cache: "no-store", redirect: "error", signal: timer.signal })
      .then(response => response.text().then(text => ({ status: response.status, text })));
    const seen: { origin: unknown; path: unknown; method: unknown }[] = [];
    // One untagged request runs alongside the tagged one; it must not be attributed. Its outcome is
    // handled at creation, so a failure on any path can never become an unhandled rejection.
    const untagged = fetchText(`${OBSERVER_SELFTEST_PATH}-untagged`).then(() => true, () => false);
    const { result, created } = await withAttributedRequests(() => fetchText(OBSERVER_SELFTEST_PATH), message => {
      const request = (message as { request?: { origin?: unknown; path?: unknown; method?: unknown } }).request;
      seen.push({ origin: request?.origin, path: request?.path, method: request?.method });
    });
    await untagged;
    const ok = result.status === 200 && result.text === "ok" && created === 1 && seen.length === 1
      && new URL(String(seen[0].origin)).origin === new URL(url).origin && seen[0].path === OBSERVER_SELFTEST_PATH && seen[0].method === "GET";
    return ok ? null : FAIL;
  } catch {
    return FAIL;
  } finally {
    clearTimeout(timeout);
    if (server) { server.closeAllConnections(); server.close(); }
  }
}
