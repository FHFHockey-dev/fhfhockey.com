// Local viewer containment only; never part of application authorization.
import net from "node:net";
import { syncBuiltinESMExports } from "node:module";

let blocked = 0;
export const blockedConnections = () => blocked;
const isLoopback = host => ["localhost", "127.0.0.1", "::1", "[::1]"].includes(host);
const deny = () => {
  blocked++;
  throw new Error("Testing Grounds local viewer blocks outbound network access");
};
const connect = net.Socket.prototype.connect;
net.Socket.prototype.connect = function (...args) {
  const values = Array.isArray(args[0]) ? args[0] : args;
  const options = typeof values[0] === "object" ? values[0] : { port: values[0], host: typeof values[1] === "string" ? values[1] : "localhost" };
  // No Unix sockets or implicit external destinations; Next internal loopback is allowed.
  if (options.path || !isLoopback(options.host ?? "localhost")) return deny();
  return connect.apply(this, args);
};
const originalFetch = globalThis.fetch;
globalThis.fetch = async function (input, init) {
  const url = new URL(typeof input === "string" || input instanceof URL ? input : input.url);
  if (!isLoopback(url.hostname)) return deny();
  return originalFetch(input, init);
};
syncBuiltinESMExports();
