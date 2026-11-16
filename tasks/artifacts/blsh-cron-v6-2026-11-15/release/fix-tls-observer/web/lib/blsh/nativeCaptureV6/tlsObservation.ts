/** BLSH native capture v6: the reviewed v5 TLS observer, copied VERBATIM (release fix, 2026-11-15).
 * origin/master's web/scripts/blsh/nativeProcessCaptureAdapter.ts predates v5 and has no
 * withTlsObservation, so v6 cannot import it there. The block between the markers below is
 * byte-identical to lines 14-73 of the v5 adapter at 348a122d6 (sha256 aa6237bd...);
 * tlsObservation.test.ts pins that block's sha256 (c01da6d8...) and, where the v5 file is
 * present at aa6237bd, compares the bytes directly. Nothing else is copied or changed. */
import { channel } from "node:diagnostics_channel";

const need = (ok: unknown, code: string): void => { if (!ok) throw new Error(code); };
// ---- BEGIN VERBATIM v5 nativeProcessCaptureAdapter.ts lines 14-73 (348a122d6) ----

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
// ---- END VERBATIM v5 ----
