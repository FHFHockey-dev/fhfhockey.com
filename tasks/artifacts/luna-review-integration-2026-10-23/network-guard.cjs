const deny = () => { throw new Error('OFFLINE_LUNA_TEST_NETWORK_DENIED'); };
globalThis.fetch = deny;
for (const name of ['node:http', 'node:https']) {
  const module = require(name); module.request = deny; module.get = deny;
}
const net = require('node:net'); net.connect = deny; net.createConnection = deny; net.Socket.prototype.connect = deny;
const tls = require('node:tls'); tls.connect = deny;
const dns = require('node:dns'); dns.lookup = deny; dns.resolve = deny;
