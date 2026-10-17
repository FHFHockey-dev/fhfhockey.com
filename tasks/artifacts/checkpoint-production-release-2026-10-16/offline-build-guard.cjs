// Verification-only transport: every HTTP request is redirected to synthetic
// loopback fixtures. Direct external sockets fail before connecting.
const http = require('node:http');
const https = require('node:https');
const net = require('node:net');
const tls = require('node:tls');
const { syncBuiltinESMExports } = require('node:module');
const fixturePort = Number(process.env.FHFH_BUILD_FIXTURE_PORT);
if (!Number.isInteger(fixturePort) || fixturePort < 1) throw new Error('Missing fixture port');
const local = host => !host || ['localhost', '127.0.0.1', '::1'].includes(host);
const originalConnect = net.Socket.prototype.connect;
net.Socket.prototype.connect = function (...args) {
  const first = Array.isArray(args[0]) ? args[0][0] : args[0];
  const host = first && typeof first === 'object' ? first.host : typeof args[1] === 'string' ? args[1] : undefined;
  if (!local(host)) throw new Error('External build socket blocked');
  return originalConnect.apply(this, args);
};
const originalTls = tls.connect;
tls.connect = function (...args) {
  const options = args.find(value => value && typeof value === 'object') || {};
  if (!local(options.host)) throw new Error('External build TLS blocked');
  return originalTls.apply(this, args);
};
const originalRequest = http.request;
const request = (...args) => {
  const first = args[0];
  const url = typeof first === 'string' || first instanceof URL ? new URL(first) : null;
  const options = { ...(url ? (typeof args[1] === 'object' ? args[1] : {}) : first) };
  const method = String(options.method || 'GET').toUpperCase();
  if (!['GET', 'HEAD'].includes(method)) throw new Error('Build write method blocked');
  const callback = args.findLast(value => typeof value === 'function');
  return originalRequest({
    hostname: '127.0.0.1', port: fixturePort,
    path: options.path || (url ? url.pathname + url.search : '/'), method,
    headers: { 'x-fixture-origin': options.hostname || options.host || url?.hostname || '' },
  }, callback);
};
http.request = https.request = request;
http.get = https.get = (...args) => { const value = request(...args); value.end(); return value; };
const originalFetch = globalThis.fetch;
globalThis.fetch = (input, init = {}) => {
  const original = new URL(typeof input === 'string' || input instanceof URL ? input : input.url);
  const method = String(init.method || input.method || 'GET').toUpperCase();
  if (!['GET', 'HEAD'].includes(method)) throw new Error('Build fetch write method blocked');
  return originalFetch(`http://127.0.0.1:${fixturePort}${original.pathname}${original.search}`, {
    method, headers: { 'x-fixture-origin': original.hostname }, signal: init.signal,
  }).catch(error => {
    process.stderr.write(`Offline fixture fetch failed: ${original.hostname}${original.pathname}: ${error.cause?.code || error.cause?.message || error.message}\n`);
    throw error;
  });
};
syncBuiltinESMExports();
