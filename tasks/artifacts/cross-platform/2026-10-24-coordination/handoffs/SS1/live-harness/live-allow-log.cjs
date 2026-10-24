// SS1-8 bounded live check: allow only the NHL schedule API and the project's Supabase host,
// and only GET/HEAD to Supabase. Log method, host, path, status, row range and timing; never bodies.
const fs = require("node:fs");
const LOG = process.env.SS1_LIVE_LOG;
const ALLOW = new Set(["api-web.nhle.com", "fyhftlxokyjtpndbkfse.supabase.co"]);
const local = h => h == null || h === "" || ["127.0.0.1", "::1", "localhost", "0.0.0.0", "::ffff:127.0.0.1"].includes(String(h).replace(/^\[|\]$/g, ""));
const log = entry => { try { fs.appendFileSync(LOG, JSON.stringify({ t: new Date().toISOString(), pid: process.pid, ...entry }) + "\n"); } catch {} };
const net = require("node:net"), connect = net.Socket.prototype.connect;
net.Socket.prototype.connect = function (...args) {
  const o = Array.isArray(args[0]) ? args[0][0] : args[0];
  let host, path;
  if (o && typeof o === "object") ({ host, path } = o); else if (typeof o === "number" || /^\d+$/.test(String(o))) host = typeof args[1] === "string" ? args[1] : "localhost"; else path = o;
  if (path || local(host) || ALLOW.has(String(host))) return connect.apply(this, args);
  log({ kind: "deny-connect", host });
  process.nextTick(() => this.destroy(new Error("SS1_LIVE_HOST_DENIED")));
  return this;
};
if (globalThis.fetch) {
  const original = globalThis.fetch;
  globalThis.fetch = async (input, init) => {
    const u = new URL(typeof input === "string" ? input : input?.url ?? String(input));
    const method = String(init?.method || (input && typeof input === "object" && input.method) || "GET").toUpperCase();
    if (local(u.hostname)) return original(input, init);
    if (!ALLOW.has(u.hostname) || (u.hostname.endsWith("supabase.co") && !["GET", "HEAD"].includes(method))) { log({ kind: "deny-fetch", method, host: u.hostname, path: u.pathname }); throw new Error("SS1_LIVE_REQUEST_DENIED"); }
    const started = Date.now();
    const response = await original(input, init);
    log({ kind: "fetch", method, host: u.hostname, path: u.pathname, queryChars: u.search.length, status: response.status, contentRange: response.headers.get("content-range"), ms: Date.now() - started });
    return response;
  };
}
