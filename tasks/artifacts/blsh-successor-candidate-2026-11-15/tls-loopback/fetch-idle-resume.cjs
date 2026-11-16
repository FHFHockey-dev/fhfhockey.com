const tls = require("node:tls"), https = require("node:https"), fs = require("node:fs"), dc = require("node:diagnostics_channel"), d = process.argv[2];
tls.setDefaultCACertificates([...tls.getCACertificates("default"), fs.readFileSync(d + "/ca.pem", "utf8")]);
const seen = []; dc.channel("undici:client:sendHeaders").subscribe(m => { const c = m.socket.getPeerCertificate(true); seen.push({ reused: m.socket.isSessionReused(), proto: m.socket.getProtocol(), fp: c?.fingerprint256 ? "present" : "ABSENT" }); });
(async () => {
 for (const maxVersion of ["TLSv1.3", "TLSv1.2"]) {
  seen.length = 0; let conns = 0;
  const server = https.createServer({ key: fs.readFileSync(d + "/key.pem"), cert: fs.readFileSync(d + "/cert.pem"), maxVersion, keepAliveTimeout: 300 }, (q, r) => r.end("ok"));
  server.on("secureConnection", () => conns++);
  await new Promise(r => server.listen(0, "127.0.0.1", r)); const base = `https://localhost:${server.address().port}`;
  for (let i = 0; i < 3; i++) { await (await fetch(base + "/x")).text(); await new Promise(r => setTimeout(r, 1500)); } // idle past keep-alive, like the 22 s spacing
  console.log(maxVersion, "serverHandshakes", conns, JSON.stringify(seen)); server.close();
 }
 process.exit(0);
})();
