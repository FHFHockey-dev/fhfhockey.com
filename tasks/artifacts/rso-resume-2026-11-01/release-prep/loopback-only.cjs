// Verification-only network guard; inherited by local Node child processes.
const net = require('node:net');
const originalConnect = net.Socket.prototype.connect;
net.Socket.prototype.connect = function (...args) {
  const a = Array.isArray(args[0]) ? args[0] : args;
  const options = typeof a[0] === 'object' ? a[0] : { port: a[0], host: typeof a[1] === 'string' ? a[1] : 'localhost' };
  // Process IPC uses a local socket path, never a provider endpoint.
  if (!options.path && !['localhost', '127.0.0.1', '::1', '[::1]'].includes(options.host || options.hostname || 'localhost')) {
    throw new Error('RSO verification blocked non-loopback socket');
  }
  return originalConnect.apply(this, args);
};
const originalFetch = globalThis.fetch;
if (originalFetch) globalThis.fetch = (input, ...args) => {
  const url = new URL(typeof input === 'string' || input instanceof URL ? input : input.url);
  if (!['localhost', '127.0.0.1', '::1', '[::1]'].includes(url.hostname)) return Promise.reject(new Error('RSO verification blocked non-loopback fetch'));
  return originalFetch(input, ...args);
};
