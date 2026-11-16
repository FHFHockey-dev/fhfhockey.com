/* Loopback-only: does the patched adapter's TLS observation survive (A) keep-alive socket reuse and
 * (B) a new connection that resumes the TLS session (undici's session cache)? Ops 4/5 of the pilot
 * re-contact hosts after >= 22 s, so (B) is the realistic path.
 * Run from the patched export's web/: node --require ./node_modules/ts-node/register/transpile-only <this> <certDir>
 * certDir holds ca.pem (throwaway root, trusted IN-PROCESS only), cert.pem (leaf signed by it), key.pem.
 * A side subscriber (not the adapter) logs socket identity and isSessionReused(). Non-loopback connects are refused.
 */
/* eslint-disable @typescript-eslint/no-require-imports */
const net = require("node:net") as typeof import("node:net");
const tls = require("node:tls") as typeof import("node:tls");
const https = require("node:https") as typeof import("node:https");
const fs = require("node:fs") as typeof import("node:fs");
const { channel } = require("node:diagnostics_channel") as typeof import("node:diagnostics_channel");
import { resolve } from "node:path";

const connect = net.Socket.prototype.connect as (...args: unknown[]) => unknown;
(net.Socket.prototype as unknown as { connect: unknown }).connect = function (this: unknown, ...args: unknown[]) {
  const first = args[0] as { host?: string } | number;
  const host = typeof first === "object" ? first.host : args[1];
  if (host !== "127.0.0.1" && host !== "localhost" && host !== "::1") throw new Error("non-loopback connect refused");
  return connect.apply(this, args);
};

const adapter = require(resolve(process.cwd(), "scripts/blsh/nativeProcessCaptureAdapter.ts"));
const dir = process.argv[2];
const ca = fs.readFileSync(`${dir}/ca.pem`, "utf8"), cert = fs.readFileSync(`${dir}/cert.pem`), key = fs.readFileSync(`${dir}/key.pem`);
tls.setDefaultCACertificates([...tls.getCACertificates("default"), ca]);

// Side observer: socket identity and resumption, never request paths/headers.
const ids = new WeakMap<object, number>(); let nextId = 0;
const side: { socket: number; sessionReused: boolean }[] = [];
channel("undici:client:sendHeaders").subscribe(message => {
  const socket = (message as { socket: object & { isSessionReused?: () => boolean } }).socket;
  if (!ids.has(socket)) ids.set(socket, ++nextId);
  side.push({ socket: ids.get(socket)!, sessionReused: socket.isSessionReused?.() === true });
});

// The runner's acceptance rule (tlsFacts in nativeProcessCaptureRunner.ts), restated for this check.
// Full-handshake shape (peer certificate present); resumed sessions are bound by the runner instead.
const runnerAccepts = (t: Record<string, any> | undefined, host: string) => !!t && t.channel === "undici:client:sendHeaders" && typeof t.authorized === "boolean"
  && t.servername === host && /^(?:[0-9A-F]{2}:){31}[0-9A-F]{2}$/.test(t.peerCertificate?.fingerprint256 ?? "") && Array.isArray(t.peerCertificate?.issuerCNChain)
  && t.peerCertificate.issuerCNChain.length > 0 && !!t.protocol && !!t.cipher?.name && !!t.peerCertificate.valid_from && !!t.peerCertificate.valid_to;

(async () => {
  let closeEach = false, connections = 0, tlsHandshakes = 0;
  const server = https.createServer({ key, cert }, (request, response) => {
    if (closeEach) response.setHeader("Connection", "close");
    response.end(JSON.stringify({ ok: true }));
  });
  server.on("connection", () => { connections++; });
  server.on("secureConnection", () => { tlsHandshakes++; });
  await new Promise<void>(done => server.listen(0, "127.0.0.1", done));
  const base = `https://localhost:${(server.address() as import("node:net").AddressInfo).port}`;
  const op = async (label: string, path: string, method: "GET" | "POST") => {
    const before = side.length;
    try {
      const value = await adapter.withTlsObservation(`${base}${path}`, method, async () => {
        const response = await fetch(`${base}${path}`, method === "POST" ? { method, body: "{}" } : {}); return { status: response.status, body: await response.text() };
      });
      return { label, ok: true, side: side.slice(before), fullHandshakeShape: runnerAccepts(value.tls, "localhost"),
        authorized: value.tls.authorized, sessionReused: value.tls.sessionReused, connectionReused: value.tls.connectionReused, connectionSequence: value.tls.connectionSequence, peerCertificateNull: value.tls.peerCertificate === null, protocol: value.tls.protocol, fingerprint256: value.tls.peerCertificate?.fingerprint256,
        subjectCN: value.tls.peerCertificate?.subjectCN, issuerCNChain: value.tls.peerCertificate?.issuerCNChain };
    } catch (error) { return { label, ok: false, error: (error as Error).message, side: side.slice(before) }; }
  };
  const results = [];
  results.push(await op("A1_first_connection", "/rest/v1/rpc/nst_admit_attempt_v1", "POST"));
  results.push(await op("A2_keepalive_same_socket", "/rest/v1/rpc/nst_admit_attempt_v1", "POST"));
  const keepAlive = { connections, tlsHandshakes };
  closeEach = true;
  results.push(await op("B1_closes_after_response", "/playerteams.php", "GET"));
  results.push(await op("B2_new_connection_resumed_session", "/playerteams.php", "GET"));
  results.push(await op("B3_new_connection_resumed_session", "/playerteams.php", "GET"));
  server.close();
  process.stdout.write(`${JSON.stringify({ node: process.version, undici: process.versions.undici, keepAlivePhase: keepAlive, total: { connections, tlsHandshakes }, results }, null, 1)}\n`);
  process.exit(0);
})();
