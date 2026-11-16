// Reviewer RECHECK-3 attack helpers. Loopback only: every non-loopback socket connect throws.
import net from "node:net";
import tls from "node:tls";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
const connect = net.Socket.prototype.connect;
net.Socket.prototype.connect = function (...args) {
  const first = args[0], host = typeof first === "object" ? first.host : args[1];
  if (!["127.0.0.1", "localhost", "::1"].includes(host)) throw new Error("reviewer guard: non-loopback connect refused");
  return connect.apply(this, args);
};
export const cfg = JSON.parse(readFileSync(process.env.REVIEW_CFG, "utf8")); // { port, cert, tool, conversion, out }
const { Agent, setGlobalDispatcher } = createRequire("/Users/tim/Code/fhfhockey.com/web/package.json")("undici");
// npm undici registers its own default Agent on import. Clear the registry so the tool's own start check can be passed,
// and the later (mid-run / spoof) routes are what is tested. Set REVIEW_KEEP_REGISTRY=1 to keep it.
if (!process.env.REVIEW_KEEP_REGISTRY) globalThis[Symbol.for("undici.globalDispatcher.1")] = undefined; // non-configurable, but writable
const ca = readFileSync(cfg.cert);
export const loopbackAgent = () => new Agent({ connect: (o, cb) => { const s = tls.connect({ host: "127.0.0.1", port: cfg.port, servername: o.servername || o.hostname, ca });
  s.once("secureConnect", () => cb(null, s)); s.once("error", e => cb(e)); return s; } });
export { setGlobalDispatcher };
export const report = async p => { try { const r = await p; return { ok: true, requests: r.requests }; } catch (e) { return { ok: false, refusal: e?.code ?? String(e?.message ?? e) }; } };
