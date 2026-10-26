// SS1 network-deny preload (recreated for ticket 18 after the repo copy of net-deny-log.cjs was removed by the
// repo cleanup). Load with NODE_OPTIONS="--require <this file>". Every Node TCP connection or fetch to a host other
// than loopback (or a local socket path) is refused and logged as one JSON line to $C7_NET_LOG.
const net = require("node:net");
const fs = require("node:fs");

const log = entry => {
  if (!process.env.C7_NET_LOG) return;
  try { fs.appendFileSync(process.env.C7_NET_LOG, JSON.stringify({ t: new Date().toISOString(), pid: process.pid, proc: process.argv[1], ...entry }) + "\n"); } catch { /* logging never breaks the run */ }
};
const loopback = host => {
  const name = String(host ?? "localhost").replace(/^\[|\]$/g, "").toLowerCase();
  return name === "localhost" || name === "::1" || name === "0.0.0.0" || /^127\./.test(name) || name.endsWith(".localhost");
};

const connect = net.Socket.prototype.connect;
net.Socket.prototype.connect = function (...args) {
  const first = Array.isArray(args[0]) ? args[0][0] : args[0];
  const options = first && typeof first === "object" ? first : null;
  const path = options?.path ?? (typeof first === "string" && !/^\d+$/.test(first) ? first : null);
  const host = options ? options.host : typeof args[1] === "string" ? args[1] : "localhost";
  const port = options ? options.port : first;
  if (!path && !loopback(host)) {
    log({ kind: "deny-connect", target: `${host}:${port}` });
    const error = Object.assign(new Error(`Network denied by SS1 preload: ${host}`), { code: "ECONNREFUSED" });
    process.nextTick(() => this.destroy(error));
    return this;
  }
  return connect.apply(this, args);
};

if (typeof globalThis.fetch === "function") {
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (input, init) => {
    const url = new URL(typeof input === "string" || input instanceof URL ? String(input) : input.url);
    if (!loopback(url.hostname)) {
      log({ kind: "deny-fetch", target: url.origin + url.pathname });
      throw new TypeError(`fetch denied by SS1 preload: ${url.origin}`);
    }
    return realFetch(input, init);
  };
}
