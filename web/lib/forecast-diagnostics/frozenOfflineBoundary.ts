/** Deny outbound I/O before reading retained private diagnostic files. No model execution or issuance is exposed. */
export function denyNetwork() {
  const denied = () => { throw new Error("Network is disabled in frozen replay"); };
  globalThis.fetch = denied as typeof fetch;
  for (const [module, names] of [["node:http", ["request", "get"]], ["node:https", ["request", "get"]],
    ["node:net", ["connect", "createConnection"]], ["node:tls", ["connect"]],
    ["node:dns", ["lookup", "resolve"]]] as const) {
    const api = require(module);
    for (const name of names) api[name] = denied;
  }
  require("node:net").Socket.prototype.connect = denied;
}
