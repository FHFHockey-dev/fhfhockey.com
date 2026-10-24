// C4 fixture harness: refuse every outbound connection except loopback on allowed ports.
// Loaded with NODE_OPTIONS=--require so Next's server and worker processes inherit it.
const fs = require("fs");
const net = require("net");
const tls = require("tls");

const LOG = process.env.C4_GUARD_LOG;
const BLOCKED_PORTS = new Set([3000, 3105]);
const LOOPBACK = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);

const note = (what) => { try { if (LOG) fs.appendFileSync(LOG, `${new Date().toISOString()} pid=${process.pid} BLOCKED ${what}\n`); } catch {} };

function allowed(host, port) {
  const h = String(host ?? "localhost").toLowerCase();
  return LOOPBACK.has(h) && !BLOCKED_PORTS.has(Number(port));
}

function target(args) {
  const [a, b] = args;
  if (typeof a === "object" && a !== null) {
    if (a.path) return { host: "localhost", port: 0, ipc: true };
    return { host: a.host ?? a.hostname, port: a.port };
  }
  if (typeof a === "string" && isNaN(Number(a))) return { host: "localhost", port: 0, ipc: true };
  return { host: typeof b === "string" ? b : "localhost", port: a };
}

for (const [mod, name] of [[net, "connect"], [net, "createConnection"], [tls, "connect"]]) {
  const original = mod[name];
  mod[name] = function guarded(...args) {
    const t = target(args);
    if (!t.ipc && !allowed(t.host, t.port)) {
      note(`${name} ${t.host}:${t.port}`);
      throw new Error(`C4 net-guard blocked ${t.host}:${t.port}`);
    }
    return original.apply(this, args);
  };
}

if (typeof globalThis.fetch === "function") {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = function guardedFetch(input, init) {
    let url;
    try { url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url); } catch { return originalFetch(input, init); }
    const port = url.port || (url.protocol === "https:" ? 443 : 80);
    if (!allowed(url.hostname, port)) {
      note(`fetch ${url.origin}${url.pathname}`);
      return Promise.reject(new TypeError(`C4 net-guard blocked ${url.origin}`));
    }
    return originalFetch(input, init);
  };
}
