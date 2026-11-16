// M1-FIX-DESIGN experiment (offline: localhost only, self-signed cert made in a temp dir).
// Run: node -v must be v22.23.4.  node m1-experiment.mjs
// Prototype of option A' (context-tagged observer + connected-in-window rule). Not product code.
import https from "node:https"; import fs from "node:fs"; import os from "node:os"; import path from "node:path";
import { execFileSync } from "node:child_process"; import { channel } from "node:diagnostics_channel"; import { AsyncLocalStorage } from "node:async_hooks";
const dir = process.env.M1_CHILD ?? fs.mkdtempSync(path.join(os.tmpdir(), "m1exp-"));
if (!process.env.M1_CHILD) execFileSync("openssl", ["req", "-x509", "-newkey", "rsa:2048", "-nodes", "-keyout", `${dir}/key.pem`, "-out", `${dir}/cert.pem`, "-days", "1",
  "-subj", "/CN=localhost", "-addext", "subjectAltName=DNS:localhost"], { stdio: "ignore" });
const server = https.createServer({ key: fs.readFileSync(`${dir}/key.pem`), cert: fs.readFileSync(`${dir}/cert.pem`) },
  (q, r) => { q.resume(); q.on("end", () => setTimeout(() => r.end(q.method + q.url), 30)); });
await new Promise(r => server.listen(0, "127.0.0.1", r));
const O = `https://localhost:${server.address().port}`;
// Trust the temp CA for fetch (undici reads NODE_EXTRA_CA_CERTS only at startup, so re-exec once).
if (!process.env.M1_CHILD) { server.close(); execFileSync(process.execPath, [process.argv[1]], { stdio: "inherit", env: { ...process.env, M1_CHILD: dir, NODE_EXTRA_CA_CERTS: `${dir}/cert.pem` } }); fs.rmSync(dir, { recursive: true }); process.exit(0); }

const als = new AsyncLocalStorage(); let lastSocket;
const create = channel("undici:request:create"), connected = channel("undici:client:connected"), send = channel("undici:client:sendHeaders");
const truth = new WeakMap(); // socket -> ["ours"|"foreign", ...] in send order (ground truth for the test only)
send.subscribe(m => { const h = Array.isArray(m.headers) ? m.headers.map(String).join("\n") : String(m.headers);
  const who = /x-who:\s*ours/i.test(h) ? "ours" : "foreign"; const l = truth.get(m.socket) ?? []; l.push(who); truth.set(m.socket, l); });
const connections = new WeakMap(); let connectionCount = 0; // as v5: per-process connection numbers
// Prototype observer. Returns facts or a refusal code; the v5 socketTls body is reduced here to the reuse fields.
async function observe(url, method, action) {
  const expected = new URL(url), token = {}, created = new Set(), fresh = new WeakSet(), foreignUsed = new WeakSet(), events = [];
  const onCreate = m => { if (als.getStore() === token) created.add(m.request); };
  const onConnected = m => { fresh.add(m.socket); };
  const onSend = m => {
    if (!created.has(m.request)) { foreignUsed.add(m.socket); return; }           // not ours: ignored, but its socket is marked
    const r = m.request, p = typeof r.path === "string" ? r.path.split("?")[0] : null;
    const matches = new URL(String(r.origin)).origin === expected.origin && p === expected.pathname && r.method === method;
    const own = connections.has(m.socket), firstUse = fresh.has(m.socket) && !foreignUsed.has(m.socket);
    if (!own && firstUse) connections.set(m.socket, ++connectionCount);
    lastSocket = m.socket;
    events.push(!matches ? "capture_tls_observation_mismatch" : (own || firstUse)
      ? { connectionReused: own, connectionSequence: connections.get(m.socket) } : "capture_tls_connection_foreign");
  };
  create.subscribe(onCreate); connected.subscribe(onConnected); send.subscribe(onSend);
  try { await als.run(token, action); } finally { create.unsubscribe(onCreate); connected.unsubscribe(onConnected); send.unsubscribe(onSend); }
  if (created.size !== 1 || events.length !== 1) return `capture_tls_observation_missing(created=${created.size},events=${events.length})`;
  return events[0];
}
const call = (p, m = "POST", who = "ours") => fetch(O + p, { method: m, body: m === "POST" ? "{}" : undefined, headers: { "x-who": who } }).then(r => r.text());
const foreign = (n, p = "/rpc", m = "POST") => Promise.all(Array.from({ length: n }, () => call(p, m, "foreign")));
const out = { node: process.version, undici: process.versions.undici };
// v5 control: any other request in the process during the action fails the run.
{ let n = 0; const l = () => n++; send.subscribe(l); await Promise.all([call("/rpc"), foreign(5)]); send.unsubscribe(l); out.v5_control_events_seen = n; }
await new Promise(r => setTimeout(r, 50));
out.A1_ours_after_control_traffic_classified = await observe(O + "/rpc", "POST", () => call("/rpc"));
out.A2_concurrent_foreign_same_path = await (async () => { const pre = foreign(6); const post = new Promise(r => setTimeout(r, 2)).then(() => foreign(4));
  const r = await observe(O + "/rpc", "POST", () => call("/rpc")); await pre; await post; return r; })();
out.A3_extra_request_inside_action = await observe(O + "/rpc", "POST", async () => { const p = call("/rpc"); await call("/other"); return p; });
out.A4_own_request_wrong_path = await observe(O + "/rpc", "POST", () => call("/elsewhere"));
out.A5_no_request = await observe(O + "/rpc", "POST", async () => "nothing sent");
// Undici picks idle sockets nondeterministically, so single-shot connection cases are not asserted; D checks every
// classification against per-socket ground truth instead.
// The control and A cases send x-who:ours requests that are not accepted observations (control, A3-A5); let their
// keep-alive sockets expire (server keep-alive 5 s) so D's ground truth starts clean.
await new Promise(r => setTimeout(r, 6000));
// D: 60 mixed rounds; compare each classification with the ground truth of the socket's earlier users.
const tally = { fresh_ok: 0, own_reuse_ok: 0, foreign_ok: 0, mismatches: [] };
for (let i = 0; i < 60; i++) {
  if (i % 3 === 0) await foreign(1 + (i % 4), i % 2 ? "/rpc" : "/warm", i % 2 ? "POST" : "GET");
  if (i % 10 === 9) await new Promise(r => setTimeout(r, 5200));
  const f = i % 4 === 1 ? foreign(3) : null;
  lastSocket = undefined; const r = await observe(O + "/rpc", "POST", () => call("/rpc")); await f;
  const prior = (truth.get(lastSocket) ?? []).slice(0, -1);
  const expect = prior.length === 0 ? "fresh" : prior[0] === "ours" ? "own" : "foreign";
  const got = typeof r === "string" ? (r === "capture_tls_connection_foreign" ? "foreign" : r) : r.connectionReused ? "own" : "fresh";
  if (got === expect) tally[expect === "own" ? "own_reuse_ok" : expect + "_ok"]++; else tally.mismatches.push({ i, expect, got, prior });
}
out.D_classification_vs_ground_truth = tally;
let bad = 0; for (let i = 0; i < 50; i++) { const f = foreign(6); const r = await observe(O + "/rpc", "POST", () => call("/rpc"));
  if (typeof r === "string" && r.startsWith("capture_tls_observation")) bad++; await f; }
out.C1_50_rounds_attribution_failures = bad;
console.log(JSON.stringify(out, null, 1)); server.close(); process.exit(0);
