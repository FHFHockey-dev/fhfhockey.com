/* Loopback-only, offline: which undici carries the pilot's requests once the runner is loaded,
 * and does the adapter's TLS observation hold on that path?
 * Run from the patched export's web/ with ts-node transpile-only; arg = certDir (ca.pem, cert.pem, key.pem).
 * A throwaway CA is trusted IN-PROCESS only. Non-loopback connects are refused.
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
const KEY = Symbol.for("undici.globalDispatcher.1");
const registry = globalThis as unknown as Record<symbol, unknown>;
const out: Record<string, unknown> = { node: process.version, bundledUndici: process.versions.undici, registryAtStart: registry[KEY] === undefined ? "unset" : "present" };

// 1. Load the real import graph the way the bootstrap does: preparation, runner, adapter.
const web = process.cwd();
require(resolve(web, "scripts/blsh/nativeProcessCapturePreparation.ts"));
require(resolve(web, "scripts/blsh/nativeProcessCaptureRunner.ts"));
const anchor = registry[KEY];
const adapter = require(resolve(web, "scripts/blsh/nativeProcessCaptureAdapter.ts"));
const npmUndici = require(resolve(web, "node_modules/undici"));
out.afterImports = { present: anchor !== undefined, constructorName: (anchor as object | undefined)?.constructor?.name ?? null,
  sameObjectAfterAdapterImport: registry[KEY] === anchor, instanceOfNpmUndiciAgent: anchor instanceof npmUndici.Agent,
  npmUndiciVersion: require(resolve(web, "node_modules/undici/package.json")).version };

const dir = process.argv[2];
const ca = fs.readFileSync(`${dir}/ca.pem`, "utf8"), cert = fs.readFileSync(`${dir}/cert.pem`), key = fs.readFileSync(`${dir}/key.pem`);
const sendHeaders = channel("undici:client:sendHeaders");
const seen: { requestClass: string | null; sessionReused: boolean }[] = [];
sendHeaders.subscribe(message => {
  const m = message as { request?: object; socket?: { isSessionReused?: () => boolean } };
  seen.push({ requestClass: m.request?.constructor?.name ?? null, sessionReused: m.socket?.isSessionReused?.() === true });
});

(async () => {
  let closeEach = false;
  const server = https.createServer({ key, cert, keepAliveTimeout: 300 }, (_request, response) => { if (closeEach) response.setHeader("Connection", "close"); response.end("ok"); });
  await new Promise<void>(done => server.listen(0, "127.0.0.1", done));
  const base = `https://localhost:${(server.address() as import("node:net").AddressInfo).port}`;
  const get = async (path: string) => { const r = await fetch(`${base}${path}`); return { status: r.status, body: await r.text() }; };

  // 2. Discriminating check: the CA is not trusted yet, so fetch can succeed only through a
  //    registry dispatcher that carries the CA itself.
  const results: Record<string, unknown> = {};
  try { await get("/untrusted"); results.untrustedWithImportTimeAgent = "succeeded (unexpected)"; } catch (e) { results.untrustedWithImportTimeAgent = `failed: ${((e as Error).cause as { code?: string })?.code ?? (e as Error).message}`; }
  const custom = new npmUndici.Agent({ connect: { ca } });
  registry[KEY] = custom;
  try { await get("/untrusted"); results.untrustedWithRegistryAgentCarryingCA = "succeeded: bundled fetch honors the registry dispatcher"; } catch (e) { results.untrustedWithRegistryAgentCarryingCA = `failed: ${(e as Error).message}`; }
  registry[KEY] = anchor; await custom.close();
  out.discriminating = results;

  // 3. TLS observation through the import-time (npm undici) Agent, CA trusted in-process.
  tls.setDefaultCACertificates([...tls.getCACertificates("default"), ca]);
  const op = async (label: string, path: string, method: "GET" | "POST") => {
    const before = seen.length;
    try {
      const value = await adapter.withTlsObservation(`${base}${path}`, method, async () => {
        const r = await fetch(`${base}${path}`, method === "POST" ? { method, body: "{}" } : {}); return { status: r.status, body: await r.text() };
      });
      const t = value.tls;
      return { label, ok: true, events: seen.slice(before), sessionReused: t.sessionReused, connectionReused: t.connectionReused, connectionSequence: t.connectionSequence,
        peerCertificateNull: t.peerCertificate === null, fingerprint: t.peerCertificate?.fingerprint256?.slice(0, 11) ?? null, issuerCNChain: t.peerCertificate?.issuerCNChain ?? null,
        authorized: t.authorized, protocol: t.protocol, registrySameAsAnchor: registry[KEY] === anchor };
    } catch (e) { return { label, ok: false, error: (e as Error).message, events: seen.slice(before) }; }
  };
  const ops = [];
  ops.push(await op("A1_post_new_connection", "/rest/v1/rpc/nst_admit_attempt_v1", "POST"));
  ops.push(await op("A2_post_again", "/rest/v1/rpc/nst_admit_attempt_v1", "POST"));
  ops.push(await op("A3_get", "/playerteams.php", "GET"));
  closeEach = true;
  ops.push(await op("B1_get_server_closes", "/playerteams.php", "GET"));
  await new Promise(r => setTimeout(r, 500));
  ops.push(await op("B2_get_new_connection_after_close", "/playerteams.php", "GET"));
  ops.push(await op("B3_get_new_connection_after_close", "/playerteams.php", "GET"));
  out.observations = ops;
  out.registryUnchangedThroughout = registry[KEY] === anchor;
  server.close();
  process.stdout.write(`${JSON.stringify(out, null, 1)}\n`);
  process.exit(0);
})().catch(e => { process.stdout.write(`transport-check error: ${(e as Error).message}\n`); process.exit(1); });
