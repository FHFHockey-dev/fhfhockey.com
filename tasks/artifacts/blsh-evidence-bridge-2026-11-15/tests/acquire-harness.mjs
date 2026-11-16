// TEST-ONLY offline harness for the self-contained acquire-boxscores.mjs. Run with an EMPTY execArgv:
//   node <this> <spec.json>
// Never reaches the network:
//  - every non-loopback socket connect throws (counted); DNS is never used (the dispatchers connect to 127.0.0.1);
//  - a loopback HTTPS server presents a throwaway self-signed cert for api-web.nhle.com;
//  - trust is given ONLY to a test dispatcher passed through the tool's FUNCTION API (recorded as testTransport, so
//    frames.mjs refuses the output in production), or, for the reviewer's reproducer, to a GLOBAL dispatcher that the
//    tool must refuse (global_dispatcher_preinstalled / global_dispatcher_changed).
// The npm undici used to build those dispatchers is loaded HERE, from the canonical web/node_modules; the tool imports
// only node: builtins.
import net from "node:net";
import tls from "node:tls";
import https from "node:https";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";

const spec = JSON.parse(readFileSync(process.argv[2], "utf8"));
let refusedNonLoopback = 0;
const connect = net.Socket.prototype.connect;
net.Socket.prototype.connect = function (...args) {
  const first = args[0], host = typeof first === "object" ? first.host : args[1];
  if (!["127.0.0.1", "localhost", "::1"].includes(host)) { refusedNonLoopback++; throw new Error("non-loopback connect refused"); }
  return connect.apply(this, args);
};
const key = readFileSync(spec.keyPath), cert = readFileSync(spec.certPath);
const GLOBAL = Symbol.for("undici.globalDispatcher.1");
const { Agent, setGlobalDispatcher } = createRequire(spec.undiciFrom)("undici");
// Loading npm undici installs ITS default global dispatcher (lib/global.js) as a side effect. The tool must not see a
// harness artefact, so reset the slot (writable, non-configurable) to its pristine "unset" state. Faults that model an
// attacker then install a dispatcher deliberately.
globalThis[GLOBAL] = undefined;
let port = 0;
const loopbackAgent = ca => new Agent({ connect: (opts, cb) => {
  const socket = tls.connect({ host: "127.0.0.1", port, servername: opts.servername || opts.hostname, ...(ca ? { ca } : {}) });
  socket.once("secureConnect", () => cb(null, socket)); socket.once("error", e => cb(e)); return socket;
} });
const served = {};
let requestCount = 0;
const server = https.createServer({ key, cert }, (req, res) => {
  requestCount++;
  served[req.url] = (served[req.url] ?? 0) + 1;
  const id = Number(/\/v1\/gamecenter\/(\d+)\/boxscore$/.exec(req.url)?.[1]);
  if (spec.fault === "redirect" && requestCount === 2) { res.statusCode = 302; res.setHeader("location", "https://api-web.nhle.com/elsewhere"); return res.end(); }
  if (spec.fault === "status500" && requestCount === 2) { res.statusCode = 500; return res.end("{}"); }
  if (spec.fault === "oversize" && requestCount === 2) { res.setHeader("content-type", "application/json"); return res.end(Buffer.alloc(4 * 1024 * 1024 + 1, 32)); }
  if (spec.fault === "ca_swap_during" && requestCount === 1) tls.setDefaultCACertificates([...tls.getCACertificates("default"), cert.toString()]);
  // Reviewer's attack, mid-run: something installs a global dispatcher trusting a private root.
  if (spec.fault === "dispatcher_swap_during" && requestCount === 1) setGlobalDispatcher(loopbackAgent(cert));
  res.setHeader("content-type", "application/json");
  res.end(spec.bodies[id] ?? "{}");
});
await new Promise(done => server.listen(0, "127.0.0.1", done));
port = server.address().port;
const dispatcher = spec.fault === "untrusted" ? loopbackAgent(null) : loopbackAgent(cert);
if (spec.fault === "ca_swap_before") tls.setDefaultCACertificates([...tls.getCACertificates("default"), cert.toString()]);
// RECHECK-2 reproducer (repro/acq-closure/inject-into-lib.mjs.txt), as code that runs BEFORE the tool: a GLOBAL dispatcher
// trusting the throwaway cert. The tool is then called WITHOUT a dispatcher argument and must refuse before writing/sending.
const useGlobal = spec.fault === "dispatcher_preinstalled";
if (useGlobal) setGlobalDispatcher(loopbackAgent(cert));
const { acquire } = await import(spec.toolPath);
let result;
try {
  const r = await acquire({ conversionDir: spec.conversionDir, outDir: spec.outDir, dispatcher: useGlobal ? null : dispatcher, spacingMs: 0 });
  result = { ok: true, requests: r.requests };
} catch (e) { result = { ok: false, refusal: e?.code ?? "error", message: e?.code ? undefined : String(e?.message ?? e) }; }
server.close(); await dispatcher.close().catch(() => {});
process.stdout.write(`${JSON.stringify({ ...result, served, requestCount, refusedNonLoopback, execArgv: process.execArgv })}\n`);
process.exit(0);
