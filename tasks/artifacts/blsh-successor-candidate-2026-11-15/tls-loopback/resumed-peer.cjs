const tls = require("node:tls"), fs = require("node:fs"), d = process.argv[2];
const ca = fs.readFileSync(d + "/ca.pem", "utf8"), cert = fs.readFileSync(d + "/cert.pem"), key = fs.readFileSync(d + "/key.pem");
tls.setDefaultCACertificates([...tls.getCACertificates("default"), ca]);
(async () => {
 for (const maxVersion of ["TLSv1.3", "TLSv1.2"]) {
  const server = tls.createServer({ key, cert, maxVersion }, s => { s.write("ok"); s.on("end", () => s.end()); });
  await new Promise(r => server.listen(0, "127.0.0.1", r)); const port = server.address().port;
  const once = session => new Promise((done, fail) => { let ticket; const s = tls.connect({ host: "localhost", port, servername: "localhost", session, maxVersion });
    s.on("session", t => { ticket = t; }); s.on("error", fail); s.on("data", () => setTimeout(() => done({ s, ticket: ticket ?? s.getSession() }), 200)); });
  const a = await once(); const b = await once(a.ticket);
  const describe = s => { const c = s.getPeerCertificate(true), x = s.getPeerX509Certificate?.();
    return { reused: s.isSessionReused(), authorized: s.authorized, authErr: s.authorizationError ?? null, peerKeys: Object.keys(c ?? {}).slice(0, 8), fp: c?.fingerprint256?.slice(0, 11) ?? null,
      hasIssuerCert: !!c?.issuerCertificate, x509: x ? { fp: x.fingerprint256.slice(0, 11), subject: x.subject.replace(/\n/g, ","), issuer: x.issuer.replace(/\n/g, ","), validFrom: x.validFrom, validTo: x.validTo } : null,
      protocol: s.getProtocol(), cipher: s.getCipher()?.name, servername: s.servername, alpn: s.alpnProtocol }; };
  console.log(maxVersion, JSON.stringify({ first: describe(a.s), resumed: describe(b.s) }));
  a.s.destroy(); b.s.destroy(); server.close();
 }
 process.exit(0);
})();
