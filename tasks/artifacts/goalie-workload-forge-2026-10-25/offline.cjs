const blocked = () => { throw new Error("Network disabled for goalie workload offline verification"); };
require("node:net").Socket.prototype.connect = blocked;
require("node:tls").connect = blocked;
for (const name of ["node:http", "node:https"]) {
  const client = require(name); client.request = blocked; client.get = blocked;
}
globalThis.fetch = blocked;
