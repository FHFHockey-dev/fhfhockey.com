// Offline check for M1-FIX-DESIGN §4.4: attribution on a plain-http loopback server (no TLS, no cert).
import http from "node:http"; import { channel } from "node:diagnostics_channel"; import { AsyncLocalStorage } from "node:async_hooks";
const als = new AsyncLocalStorage(), token = {}, created = new Set(), events = [];
channel("undici:request:create").subscribe(m => { if (als.getStore() === token) created.add(m.request); });
channel("undici:client:sendHeaders").subscribe(m => { if (created.has(m.request)) events.push(m); });
const server = http.createServer((q, r) => { q.resume(); q.on("end", () => r.end("ok")); });
await new Promise(r => server.listen(0, "127.0.0.1", r));
const url = `http://127.0.0.1:${server.address().port}/selftest`;
const foreign = fetch(url).then(r => r.text());
await als.run(token, () => fetch(url).then(r => r.text())); await foreign;
console.log(JSON.stringify({ node: process.version, undici: process.versions.undici, created: created.size, events: events.length,
  sameObject: events[0]?.request === [...created][0], encrypted: events[0]?.socket?.encrypted === true }));
server.close();
