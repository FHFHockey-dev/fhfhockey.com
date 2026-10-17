// Local acceptance must not invoke hosted APIs even if Next loads local env files.
const net = require('node:net');
const original = net.Socket.prototype.connect;
net.Socket.prototype.connect = function (...args) {
  const options = typeof args[0] === 'object' ? args[0] : null;
  const host = options?.host ?? (typeof args[1] === 'string' ? args[1] : 'localhost');
  if (!['localhost', '127.0.0.1', '::1'].includes(host)) throw new Error('Acceptance blocks non-local network');
  return original.apply(this, args);
};
const fetch = globalThis.fetch;
globalThis.fetch = (input, init) => {
  const url = new URL(typeof input === 'string' || input instanceof URL ? input : input.url);
  if (!['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)) throw new Error('Acceptance blocks non-local fetch');
  return fetch(input, init);
};
