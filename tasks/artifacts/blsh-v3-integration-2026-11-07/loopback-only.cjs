// Verification-only guard. Never load environment files or contact a data provider.
const net = require("node:net");
const originalConnect = net.Socket.prototype.connect;
const local = ["localhost", "127.0.0.1", "::1", "[::1]"];
net.Socket.prototype.connect = function (...args) {
  const a = Array.isArray(args[0]) ? args[0] : args;
  const options = typeof a[0] === "object" ? a[0] : { port: a[0], host: typeof a[1] === "string" ? a[1] : "localhost" };
  if (!options.path && !local.includes(options.host || options.hostname || "localhost")) {
    throw new Error("BLSH verification blocked non-loopback socket");
  }
  return originalConnect.apply(this, args);
};
const originalFetch = globalThis.fetch;
if (originalFetch) globalThis.fetch = (input, ...args) => {
  const url = new URL(typeof input === "string" || input instanceof URL ? input : input.url);
  if (!local.includes(url.hostname)) return Promise.reject(new Error("BLSH verification blocked non-loopback fetch"));
  return originalFetch(input, ...args);
};
