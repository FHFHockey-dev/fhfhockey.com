import http from 'node:http';
import https from 'node:https';
// Replaces the inherited deny-all setup only for this review's loopback socket
// cases: fetch may reach 127.0.0.1 over plain HTTP, and nothing else.
const original = globalThis.fetch;
const blocked = () => { throw new Error('Independent IFTTT deadline review forbids non-loopback network I/O'); };
http.request = blocked as typeof http.request;
http.get = blocked as typeof http.get;
https.request = blocked as typeof https.request;
https.get = blocked as typeof https.get;
globalThis.fetch = ((input: any, init?: any) => {
  const url = new URL(typeof input === 'string' || input instanceof URL ? String(input) : input.url);
  if (url.protocol !== 'http:' || url.hostname !== '127.0.0.1') return blocked();
  return original(input, init);
}) as typeof fetch;
