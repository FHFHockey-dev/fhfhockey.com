// TEST-ONLY: the tool's copy of socketTls/withTlsObservation vs the v4 adapter's original (aa6237bd…), on identical
// synthetic sendHeaders messages. No network: messages are published directly on the diagnostics channel.
// Run from a v4 web root: node --require ./node_modules/ts-node/register/transpile-only <this> <toolPath>
import { channel } from "node:diagnostics_channel";
import { createRequire } from "node:module";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const adapterPath = resolve(process.cwd(), "scripts/blsh/nativeProcessCaptureAdapter.ts");
const adapterSHA256 = createHash("sha256").update(readFileSync(adapterPath)).digest("hex");
const adapter = createRequire(adapterPath)(adapterPath);
const tool = await import(process.argv[2]);
const URL_ = "https://api-web.nhle.com/v1/gamecenter/2026020293/boxscore";
const cert = (cn, issuer) => ({ fingerprint256: Array(32).fill(cn === "leaf" ? "AB" : "CD").join(":"), valid_from: "A", valid_to: "B", subject: { CN: cn }, issuer: { CN: issuer } });
const socketFactory = () => {
  const leaf = cert("leaf", "Mid CA"), mid = cert("mid", "Root CA"), root = cert("root", "Root CA");
  leaf.issuerCertificate = mid; mid.issuerCertificate = root; root.issuerCertificate = root;
  const base = { encrypted: true, authorized: true, authorizationError: null, servername: "api-web.nhle.com", alpnProtocol: "http/1.1",
    getProtocol: () => "TLSv1.3", getCipher: () => ({ name: "TLS_AES_128_GCM_SHA256", standardName: "TLS_AES_128_GCM_SHA256", version: "TLSv1.3" }) };
  return {
    full: { ...base, isSessionReused: () => false, getPeerCertificate: () => leaf },
    resumed: { ...base, isSessionReused: () => true, getPeerCertificate: () => ({}) },
    unauthorized: { ...base, authorized: false, authorizationError: "SELF_SIGNED_CERT_IN_CHAIN", isSessionReused: () => false, getPeerCertificate: () => leaf },
    plain: { encrypted: false },
    noLeafNotResumed: { ...base, isSessionReused: () => false, getPeerCertificate: () => ({}) },
  };
};
const msg = (socket, path = "/v1/gamecenter/2026020293/boxscore", origin = "https://api-web.nhle.com", method = "GET") => ({ request: { origin, path, method }, socket, headers: [] });
const scenarios = s => [
  ["full", [msg(s.full)]], ["same_socket_reused", [msg(s.full)]], ["resumed", [msg(s.resumed)]], ["unauthorized", [msg(s.unauthorized)]],
  ["plain_socket", [msg(s.plain)]], ["no_leaf_not_resumed", [msg(s.noLeafNotResumed)]], ["path_mismatch", [msg(s.full, "/other")]],
  ["query_stripped", [msg(s.full, "/v1/gamecenter/2026020293/boxscore?x=1")]], ["two_events", [msg(s.full), msg(s.full)]], ["no_event", []],
  ["other_origin", [msg(s.full, undefined, "https://evil.example")]], ["post_method", [msg(s.full, undefined, undefined, "POST")]],
];
const run = async impl => {
  const out = [], s = socketFactory();
  for (const [name, messages] of scenarios(s)) {
    try { const r = await impl.withTlsObservation(URL_, "GET", async () => { for (const m of messages) channel("undici:client:sendHeaders").publish(m); return { ok: 1 }; }); out.push([name, r]); }
    catch (e) { out.push([name, { error: e.message }]); }
  }
  return out;
};
const a = await run(adapter), b = await run(tool);
process.stdout.write(`${JSON.stringify({ adapterSHA256, identical: JSON.stringify(a) === JSON.stringify(b), scenarios: a.length, adapter: a, tool: b })}\n`);
