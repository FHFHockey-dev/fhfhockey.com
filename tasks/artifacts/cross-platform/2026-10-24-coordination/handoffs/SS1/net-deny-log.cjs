// C7 social-share run: deny + log every non-loopback outbound connection from Node processes
// (Playwright runner, npm, Next dev server and its workers). Keeps .env.local credentials from reaching any host.
const fs = require("node:fs");
const LOG = process.env.C7_NET_LOG;
const local = h => h == null || h === "" || ["127.0.0.1", "::1", "localhost", "0.0.0.0", "::ffff:127.0.0.1"].includes(String(h).replace(/^\[|\]$/g, ""));
const log = (kind, target) => { try { fs.appendFileSync(LOG, JSON.stringify({ t: new Date().toISOString(), pid: process.pid, proc: process.argv.slice(1, 3).join(" ").slice(-120), kind, target }) + "\n"); } catch {} };
const net = require("node:net");
const connect = net.Socket.prototype.connect;
net.Socket.prototype.connect = function (...args) {
  let o = Array.isArray(args[0]) ? args[0][0] : args[0], host, port, path;
  if (o && typeof o === "object") ({ host, port, path } = o);
  else if (typeof o === "number" || /^\d+$/.test(String(o))) { port = o; host = typeof args[1] === "string" ? args[1] : "localhost"; }
  else if (typeof o === "string") path = o;
  if (path || local(host)) return connect.apply(this, args);
  log("deny-connect", `${host}:${port}`);
  process.nextTick(() => this.destroy(new Error("C7_EXTERNAL_NETWORK_DENIED")));
  return this;
};
const dns = require("node:dns"), lookup = dns.lookup;
dns.lookup = function (host, ...rest) { if (!local(host)) log("dns-lookup", host); return lookup.call(this, host, ...rest); };
if (globalThis.fetch) {
  const original = globalThis.fetch;
  globalThis.fetch = async (input, init) => {
    const u = new URL(typeof input === "string" ? input : input?.url ?? String(input));
    if (!local(u.hostname)) { log("deny-fetch", u.origin + u.pathname); throw new Error("C7_EXTERNAL_NETWORK_DENIED"); }
    return original(input, init);
  };
}
