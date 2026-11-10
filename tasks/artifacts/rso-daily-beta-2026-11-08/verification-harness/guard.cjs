const net = require('node:net');
const dns = require('node:dns');
const fs = require('node:fs');
const { syncBuiltinESMExports } = require('node:module');
const allowed = host => ['localhost', '127.0.0.1', '::1', '[::1]', ''].includes(String(host ?? '').toLowerCase());
function check(host) {
  if (allowed(host)) return;
  const error = new Error('RSO verification blocked outbound network: ' + host);
  error.code = 'RSO_NETWORK_BLOCKED';
  if (process.env.RSO_NETWORK_LOG) fs.appendFileSync(process.env.RSO_NETWORK_LOG, String(host) + '\n');
  throw error;
}
function hostOf(args) {
  if (Array.isArray(args[0])) return hostOf(args[0]);
  if (typeof args[0] === 'object' && args[0] !== null) return args[0].path ? '' : args[0].hostname ?? args[0].host ?? '';
  return typeof args[0] === 'number' && typeof args[1] === 'string' ? args[1] : '';
}
const connect = net.Socket.prototype.connect;
net.Socket.prototype.connect = function (...args) { check(hostOf(args)); return connect.apply(this, args); };
const lookup = dns.lookup;
dns.lookup = function (host, ...args) { check(host); return lookup.call(this, host, ...args); };
const lookupPromise = dns.promises.lookup;
dns.promises.lookup = async function (host, ...args) { check(host); return lookupPromise.call(this, host, ...args); };
for (const moduleName of ['node:http', 'node:https']) {
  const module = require(moduleName);
  for (const name of ['request', 'get']) {
    const original = module[name];
    module[name] = function (...args) {
      const first = args[0];
      check(typeof first === 'string' || first instanceof URL ? new URL(first).hostname : first?.hostname ?? first?.host ?? '');
      return original.apply(this, args);
    };
  }
}
if (globalThis.fetch) {
  const fetch = globalThis.fetch;
  globalThis.fetch = function (input, ...args) { check(new URL(typeof input === 'string' || input instanceof URL ? input : input.url).hostname); return fetch(input, ...args); };
}
syncBuiltinESMExports();
