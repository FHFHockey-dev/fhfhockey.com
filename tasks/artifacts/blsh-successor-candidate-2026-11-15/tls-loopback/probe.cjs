const dc = require("node:diagnostics_channel"), http = require("node:http"), https = require("node:https"), fs = require("node:fs");
const names = ["undici:request:create","undici:request:headers","undici:client:beforeConnect","undici:client:connected","undici:client:connectError","undici:client:sendHeaders"];
const seen = [];
for (const n of names) dc.subscribe(n, (m) => seen.push({ n, keys: Object.keys(m), origin: m.request?.origin ?? m.connectParams?.origin?.toString?.() ?? null, sockCtor: m.socket?.constructor?.name ?? null,
  tls: m.socket && typeof m.socket.getPeerCertificate === "function" ? { authorized: m.socket.authorized, authErr: m.socket.authorizationError ?? null, servername: m.socket.servername, alpn: m.socket.alpnProtocol, proto: m.socket.getProtocol(), cipher: m.socket.getCipher()?.name, fp: m.socket.getPeerCertificate(true)?.fingerprint256?.slice(0,20) } : undefined }));
const [certDir] = process.argv.slice(2);
(async () => {
  const h = http.createServer((q, r) => r.end("ok")).listen(0, "127.0.0.1"); await new Promise(r => h.on("listening", r));
  await (await fetch(`http://127.0.0.1:${h.address().port}/a?key=x`)).text();
  await (await fetch(`http://127.0.0.1:${h.address().port}/b`)).text();  // keep-alive reuse
  console.log("HTTP bundled:", JSON.stringify(seen)); seen.length = 0;
  const key = fs.readFileSync(certDir + "/key.pem"), cert = fs.readFileSync(certDir + "/cert.pem");
  const s = https.createServer({ key, cert }, (q, r) => r.end("ok")).listen(0, "127.0.0.1"); await new Promise(r => s.on("listening", r));
  try { await fetch(`https://localhost:${s.address().port}/x`); } catch (e) { console.log("bundled TLS untrusted ->", e.cause?.code); }
  console.log("TLS bundled untrusted:", JSON.stringify(seen)); seen.length = 0;
  const undici = require(process.cwd() + "/node_modules/undici");
  const agent = new undici.Agent({ connect: { ca: cert } });
  await (await undici.fetch(`https://localhost:${s.address().port}/y`, { dispatcher: agent })).text();
  await (await undici.fetch(`https://localhost:${s.address().port}/z`, { dispatcher: agent })).text();
  console.log("TLS npm undici trusted CA:", JSON.stringify(seen)); seen.length = 0;
  h.close(); s.close(); await agent.close(); process.exit(0);
})().catch(e => { console.error("probe error", e); process.exit(1); });
