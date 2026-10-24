// QA Node preload: permit only the exact owned loopback endpoint and local IPC.
const net = require('node:net');
const dns = require('node:dns');
const fs = require('node:fs');
const ownPort = 3140;
const localHosts = new Set(['127.0.0.1', 'localhost', '::1']);
function deny(kind, target) {
  if (process.env.SOCIAL_QA_NETWORK_LOG) fs.appendFileSync(process.env.SOCIAL_QA_NETWORK_LOG, JSON.stringify({ pid: process.pid, kind, target }) + '\n');
  throw new Error('QA outbound denied: ' + kind + ' ' + target);
}
const connect = net.Socket.prototype.connect;
net.Socket.prototype.connect = function (...args) {
  let first = args[0];
  if (Array.isArray(first)) first = first[0];
  const options = typeof first === 'object' && first !== null ? first : null;
  const ipc = options?.path ?? (typeof first === 'string' && first.includes('/') && !first.includes('://') ? first : null);
  if (ipc) {
    if (ipc.startsWith('/var/folders/g2/b33dwc153kbd_vhg6cfbn8bm0000gn/T/fhfh-coordinated-release-dlnqnorf/')) return connect.apply(this, args);
    return deny('ipc', ipc);
  }
  const port = Number(options?.port ?? first);
  const host = options?.host ?? (typeof args[1] === 'string' ? args[1] : 'localhost');
  if (port !== ownPort || !localHosts.has(host)) return deny('socket', host + ':' + port);
  return connect.apply(this, args);
};
const lookup = dns.lookup;
dns.lookup = function (hostname, ...args) {
  if (!localHosts.has(hostname)) return deny('dns', hostname);
  return lookup.call(this, hostname, ...args);
};
if (dns.promises?.lookup) {
  const lookupPromise = dns.promises.lookup.bind(dns.promises);
  dns.promises.lookup = function (hostname, ...args) {
    if (!localHosts.has(hostname)) return deny('dns', hostname);
    return lookupPromise(hostname, ...args);
  };
}
if (globalThis.fetch) {
  const fetch = globalThis.fetch;
  globalThis.fetch = function (input, init) {
    const url = new URL(typeof input === 'string' || input instanceof URL ? input : input.url);
    if (!localHosts.has(url.hostname) || Number(url.port || (url.protocol === 'https:' ? 443 : 80)) !== ownPort || url.protocol !== 'http:') return deny('fetch', url.origin + url.pathname);
    return fetch(input, init);
  };
}
