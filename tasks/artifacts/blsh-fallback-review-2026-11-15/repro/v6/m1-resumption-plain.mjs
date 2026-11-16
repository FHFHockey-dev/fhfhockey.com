// V6-M1-REVIEW residual check: on npm undici 7.29.0 (cheerio's global Agent), does a request from ANOTHER context (e.g. an
// earlier invocation's audit insert or JWT check) leave a TLS session that our later, observed request resumes on a NEW
// connection? Server keep-alive 200 ms forces a new connection after the wait. TLSv1.3 and TLSv1.2. Loopback only.
// Usage: NODE_EXTRA_CA_CERTS=cert.pem node --experimental-strip-types m1-resumption-plain.mjs <web/node_modules> <tlsObservation.ts> <key.pem> <cert.pem>
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { createServer } from "node:https";
const [nm, observerPath, keyPath, certPath] = process.argv.slice(2);
const require = createRequire(`${nm}/`);
require("cheerio");
const { withTlsObservation } = await import(observerPath);
for (const maxVersion of ["TLSv1.3", "TLSv1.2"]) {
  const server = createServer({ key: readFileSync(keyPath), cert: readFileSync(certPath), maxVersion, keepAliveTimeout: 200 }, (q, r) => { q.resume(); q.on("end", () => r.end("{}")); });
  let handshakes = 0; server.on("secureConnection", () => handshakes++);
  await new Promise(r => server.listen(0, "127.0.0.1", r));
  const url = `https://localhost:${server.address().port}/rest/v1/rpc/nst_admit_attempt_v1`;
  const post = () => fetch(url, { method: "POST", body: "{}" }).then(r => r.text().then(() => ({ status: r.status })));
  await post();                                  // "another invocation": unobserved, outside any action
  await new Promise(r => setTimeout(r, 600));    // idle socket closed by the server
  let outcome;
  try { const res = await withTlsObservation(url, "POST", post); outcome = { sessionReused: res.tls.sessionReused, peerCertificate: res.tls.peerCertificate ? "present" : "absent", connectionReused: res.tls.connectionReused }; }
  catch (e) { outcome = { error: e.message }; }
  console.log(JSON.stringify({ maxVersion, serverHandshakes: handshakes, observed: outcome }));
  server.closeAllConnections(); server.close();
}
