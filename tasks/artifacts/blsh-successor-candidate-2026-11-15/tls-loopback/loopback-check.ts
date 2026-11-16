/* Loopback-only check of the patched adapter's TLS observer with Node's bundled fetch.
 * Run from the patched export's web/: node --require ./node_modules/ts-node/register/transpile-only <this> <certDir>
 * A throwaway self-signed localhost cert is trusted IN-PROCESS only (tls.setDefaultCACertificates);
 * no env CA override. Never calls createNativeProcessCaptureAdapter. Non-loopback connects are refused.
 */
/* eslint-disable @typescript-eslint/no-require-imports */
const net = require("node:net") as typeof import("node:net");
const tls = require("node:tls") as typeof import("node:tls");
const https = require("node:https") as typeof import("node:https");
const fs = require("node:fs") as typeof import("node:fs");
import { resolve } from "node:path";

let refused = 0;
const connect = net.Socket.prototype.connect as (...args: unknown[]) => unknown;
(net.Socket.prototype as unknown as { connect: unknown }).connect = function (this: unknown, ...args: unknown[]) {
  const first = args[0] as { host?: string; port?: number } | number;
  const host = typeof first === "object" ? first.host : args[1];
  if (host !== "127.0.0.1" && host !== "localhost" && host !== "::1") { refused++; throw new Error("non-loopback connect refused"); }
  return connect.apply(this, args);
};

const adapter = require(resolve(process.cwd(), "scripts/blsh/nativeProcessCaptureAdapter.ts"));
const certDir = process.argv[2];
const key = fs.readFileSync(`${certDir}/key.pem`), cert = fs.readFileSync(`${certDir}/cert.pem`);
const results: Record<string, unknown>[] = [];
const record = async (name: string, run: () => Promise<unknown>) => {
  try { results.push({ case: name, ok: true, value: await run() }); }
  catch (error) { results.push({ case: name, ok: false, error: (error as Error).message }); }
};

(async () => {
  const server = https.createServer({ key, cert }, (request, response) => { response.end(JSON.stringify({ path: request.url?.split("?")[0] })); });
  await new Promise<void>(done => server.listen(0, "127.0.0.1", done));
  const base = `https://localhost:${(server.address() as import("node:net").AddressInfo).port}`;
  const get = (url: string) => async () => { const response = await fetch(url); return { status: response.status, body: await response.text() }; };

  // 1. Untrusted cert: the handshake fails, no headers are sent, nothing is observed.
  await record("untrusted_certificate", () => adapter.withTlsObservation(`${base}/v1/schedule/2026-11-11`, "GET", get(`${base}/v1/schedule/2026-11-11`)));
  tls.setDefaultCACertificates([...tls.getCACertificates("default"), cert.toString()]);
  // 2. Trusted loopback: one request, facts attached. The query (a stand-in key) is never kept.
  await record("trusted_get", () => adapter.withTlsObservation(`${base}/playerteams.php?fd=2026-11-11`, "GET", get(`${base}/playerteams.php?fd=2026-11-11&key=LOOPBACK-STANDIN-SECRET`)));
  // 3. Keep-alive reuse: a second request on the same connection still gets its own event.
  await record("keepalive_reuse", () => adapter.withTlsObservation(`${base}/rest/v1/rpc/nst_admit_attempt_v1`, "POST",
    async () => { const response = await fetch(`${base}/rest/v1/rpc/nst_admit_attempt_v1`, { method: "POST", body: "{}" }); return { status: response.status, body: await response.text() }; }));
  // 4. The action sends to a different path than the operation's: fails closed.
  await record("path_mismatch", () => adapter.withTlsObservation(`${base}/v1/schedule/2026-11-11`, "GET", get(`${base}/other`)));
  // 5. Two requests inside one operation: fails closed.
  await record("two_requests", () => adapter.withTlsObservation(`${base}/v1/schedule/2026-11-11`, "GET",
    async () => { await get(`${base}/v1/schedule/2026-11-11`)(); return get(`${base}/v1/schedule/2026-11-11`)(); }));
  server.close();
  const text = JSON.stringify({ node: process.version, undici: process.versions.undici, refusedNonLoopback: refused, results }, null, 1);
  process.stdout.write(`${text}\n`);
  process.stdout.write(`secretEchoed=${text.includes("LOOPBACK-STANDIN-SECRET")}\n`);
  process.exit(0);
})();
