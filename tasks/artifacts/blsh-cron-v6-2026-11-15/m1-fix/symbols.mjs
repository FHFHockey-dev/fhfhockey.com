import https from "node:https"; import fs from "node:fs"; import { channel } from "node:diagnostics_channel";
const dir = process.argv[2];
const server = https.createServer({ key: fs.readFileSync(dir + "/key.pem"), cert: fs.readFileSync(dir + "/cert.pem") }, (q, r) => { q.resume(); q.on("end", () => r.end("x")); });
await new Promise(r => server.listen(0, "127.0.0.1", r)); const O = `https://localhost:${server.address().port}`;
const rows = []; const connected = new WeakSet();
channel("undici:client:connected").subscribe(m => connected.add(m.socket));
channel("undici:client:sendHeaders").subscribe(m => { const s = m.socket; const sym = {};
  for (const k of Object.getOwnPropertySymbols(s)) { const v = s[k]; if (["number","boolean","string"].includes(typeof v) || v === null) sym[k.description] = v; }
  rows.push({ path: m.request.path, sym, sawConnect: connected.has(s), reqKeys: Object.keys(m.request).filter(k => !/header|body|path|origin|method/i.test(k)) }); });
for (const p of ["/a","/b","/c"]) await fetch(O + p).then(r => r.text());
console.log(JSON.stringify(rows, null, 0)); server.close(); process.exit(0);
