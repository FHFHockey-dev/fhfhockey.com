// Test-process tripwire, inherited by workers. Synthetic transports inject fetch.
const denied = () => { throw new Error("LUNA_OFFLINE_NETWORK_DENIED"); };
globalThis.fetch = denied;
for (const name of ["http", "https"]) {
  const module = require(`node:${name}`);
  module.request = denied;
  module.get = denied;
}
const net = require("node:net");
net.connect = denied;
net.createConnection = denied;
net.Socket.prototype.connect = denied;
require("node:tls").connect = denied;
const dns = require("node:dns");
dns.lookup = denied;
dns.resolve = denied;
dns.promises.lookup = denied;
dns.promises.resolve = denied;
