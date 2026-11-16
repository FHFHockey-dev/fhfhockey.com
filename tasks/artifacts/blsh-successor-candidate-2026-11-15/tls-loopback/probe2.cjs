const dc = require("node:diagnostics_channel"), https = require("node:https"), tls = require("node:tls"), fs = require("node:fs");
console.log("setDefaultCACertificates:", typeof tls.setDefaultCACertificates);
const [certDir] = process.argv.slice(2); const key = fs.readFileSync(certDir + "/key.pem"), cert = fs.readFileSync(certDir + "/cert.pem");
const seen = []; dc.subscribe("undici:client:sendHeaders", m => { const s = m.socket, c = s.getPeerCertificate?.(true);
  seen.push({ ctor: s.constructor.name, origin: m.request.origin, method: m.request.method, authorized: s.authorized, authorizationError: s.authorizationError ?? null,
    servername: s.servername, alpn: s.alpnProtocol, protocol: s.getProtocol?.(), cipher: s.getCipher?.(), fp: c?.fingerprint256, from: c?.valid_from, to: c?.valid_to, issuerCN: c?.issuer?.CN, selfIssued: c?.issuerCertificate === c }); });
(async () => {
  if (typeof tls.setDefaultCACertificates === "function") tls.setDefaultCACertificates([...tls.getCACertificates("default"), cert.toString()]);
  const s = https.createServer({ key, cert }, (q, r) => r.end("ok")).listen(0, "127.0.0.1"); await new Promise(r => s.on("listening", r));
  try { const r = await fetch(`https://localhost:${s.address().port}/rest/v1/rpc/x`, { method: "POST", body: "{}" }); console.log("bundled fetch status", r.status, await r.text()); } catch (e) { console.log("bundled fetch failed", e.cause?.code); }
  console.log(JSON.stringify(seen, null, 1)); s.close(); process.exit(0);
})();
