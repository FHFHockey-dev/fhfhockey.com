/* Loopback-only: what does the adapter's TLS extraction record on a RESUMED TLS session?
 * (1) raw tls.connect resumption (TLS 1.3 and TLS 1.2), the real socket fed to the adapter's
 *     withTlsObservation via a synthetic sendHeaders publish (exercises the adapter's own extraction);
 * (2) Node's bundled fetch against a TLS 1.2-only server, side-logging isSessionReused().
 * Run from the patched export's web/ with ts-node transpile-only; arg = certDir (ca.pem, cert.pem, key.pem).
 */
/* eslint-disable @typescript-eslint/no-require-imports */
const tls = require("node:tls") as typeof import("node:tls");
const https = require("node:https") as typeof import("node:https");
const fs = require("node:fs") as typeof import("node:fs");
const { channel } = require("node:diagnostics_channel") as typeof import("node:diagnostics_channel");
import { resolve } from "node:path";

const adapter = require(resolve(process.cwd(), "scripts/blsh/nativeProcessCaptureAdapter.ts"));
const dir = process.argv[2];
const ca = fs.readFileSync(`${dir}/ca.pem`, "utf8"), cert = fs.readFileSync(`${dir}/cert.pem`), key = fs.readFileSync(`${dir}/key.pem`);
tls.setDefaultCACertificates([...tls.getCACertificates("default"), ca]);
const sendHeaders = channel("undici:client:sendHeaders");
// Full-handshake shape (peer certificate present); resumed sessions are bound by the runner instead.
const runnerAccepts = (t: Record<string, any> | undefined) => !!t && t.servername === "localhost" && /^(?:[0-9A-F]{2}:){31}[0-9A-F]{2}$/.test(t.peerCertificate?.fingerprint256 ?? "")
  && Array.isArray(t.peerCertificate?.issuerCNChain) && t.peerCertificate.issuerCNChain.length > 0 && !!t.protocol && !!t.cipher?.name && !!t.peerCertificate.valid_from && !!t.peerCertificate.valid_to;

const observe = async (socket: tls.TLSSocket, origin: string) => {
  try {
    const value = await adapter.withTlsObservation(`${origin}/x`, "GET", async () => {
      sendHeaders.publish({ request: { origin, path: "/x?key=STANDIN", method: "GET" }, headers: [], socket }); return {};
    });
    return { ok: true, fullHandshakeShape: runnerAccepts(value.tls), authorized: value.tls.authorized, sessionReused: value.tls.sessionReused, connectionReused: value.tls.connectionReused, connectionSequence: value.tls.connectionSequence, peerCertificateNull: value.tls.peerCertificate === null, protocol: value.tls.protocol,
      fingerprint256: value.tls.peerCertificate?.fingerprint256?.slice(0, 11), subjectCN: value.tls.peerCertificate?.subjectCN, issuerCNChain: value.tls.peerCertificate?.issuerCNChain };
  } catch (error) { return { ok: false, error: (error as Error).message }; }
};

const rawPair = async (maxVersion: "TLSv1.3" | "TLSv1.2") => {
  // Server writes, then the CLIENT ends after the ticket arrives (TLS 1.3 tickets are post-handshake).
  const server = tls.createServer({ key, cert, maxVersion }, socket => { socket.write("ok"); socket.on("end", () => socket.end()); });
  await new Promise<void>(done => server.listen(0, "127.0.0.1", done));
  const port = (server.address() as import("node:net").AddressInfo).port, origin = `https://localhost:${port}`;
  const once = (session?: Buffer) => new Promise<{ socket: tls.TLSSocket; ticket?: Buffer }>((done, fail) => {
    let ticket: Buffer | undefined;
    const socket = tls.connect({ host: "localhost", port, servername: "localhost", session, maxVersion });
    let finished = false;
    const finish = () => { if (finished) return; finished = true; ticket = ticket ?? socket.getSession(); done({ socket, ticket }); };
    socket.on("session", s => { ticket = s; });
    socket.on("error", fail);
    socket.on("data", () => setTimeout(finish, 200)); // give the post-handshake ticket time to arrive
  });
  const first = await once();
  const firstObs = { sessionReused: first.socket.isSessionReused(), ...(await observe(first.socket, origin)) };
  const second = await once(first.ticket);
  const secondObs = { ticketReceived: !!first.ticket, sessionReused: second.socket.isSessionReused(), ...(await observe(second.socket, origin)) };
  first.socket.destroy(); second.socket.destroy(); server.close();
  return { maxVersion, first: firstObs, resumed: secondObs };
};

const fetchTls12 = async () => {
  const server = https.createServer({ key, cert, maxVersion: "TLSv1.2" }, (_request, response) => { response.setHeader("Connection", "close"); response.end("ok"); });
  await new Promise<void>(done => server.listen(0, "127.0.0.1", done));
  const base = `https://localhost:${(server.address() as import("node:net").AddressInfo).port}`;
  const out = [];
  for (let i = 0; i < 3; i++) {
    let reused: boolean | null = null;
    const listener = (message: unknown) => { reused = (message as { socket: tls.TLSSocket }).socket.isSessionReused(); };
    sendHeaders.subscribe(listener);
    try {
      const value = await adapter.withTlsObservation(`${base}/playerteams.php`, "GET", async () => { const r = await fetch(`${base}/playerteams.php`); return { status: r.status, body: await r.text() }; });
      out.push({ request: i + 1, sessionReused: reused, fullHandshakeShape: runnerAccepts(value.tls), protocol: value.tls.protocol, issuerCNChain: value.tls.peerCertificate?.issuerCNChain });
    } catch (error) { out.push({ request: i + 1, sessionReused: reused, ok: false, error: (error as Error).message }); }
    finally { sendHeaders.unsubscribe(listener); }
  }
  server.close();
  return out;
};

(async () => {
  const result = { node: process.version, undici: process.versions.undici, raw13: await rawPair("TLSv1.3"), raw12: await rawPair("TLSv1.2"), bundledFetchTls12: await fetchTls12() };
  process.stdout.write(`${JSON.stringify(result, null, 1)}\n`);
  process.exit(0);
})().catch(error => { process.stdout.write(`resume-check error: ${(error as Error).message}\n`); process.exit(1); });
