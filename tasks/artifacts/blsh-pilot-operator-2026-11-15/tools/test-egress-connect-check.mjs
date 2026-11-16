// Offline tests for egress-connect-check.mjs: loopback TLS only, never the real hosts.
// Usage: /usr/bin/env -i PATH=/usr/bin:/bin /usr/local/bin/node test-egress-connect-check.mjs <scratch dir>
// A throwaway CA and a localhost/127.0.0.1 leaf are made with /usr/bin/openssl in <scratch>. The servers count every
// application byte they receive: a verified handshake must deliver 0 bytes (no HTTP is ever sent).
import { execFileSync, spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import net from "node:net";
import tls from "node:tls";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { checkOne, HOSTS, TIMEOUT_MS } from "./egress-connect-check.mjs";

const S = process.argv[2]; mkdirSync(S, { recursive: true });
const TOOL = join(dirname(fileURLToPath(import.meta.url)), "egress-connect-check.mjs");
const ossl = (...a) => execFileSync("/usr/bin/openssl", a, { cwd: S, stdio: ["ignore", "ignore", "pipe"] });
writeFileSync(join(S, "leaf.ext"), "basicConstraints=CA:FALSE\nsubjectAltName=DNS:localhost,IP:127.0.0.1\nextendedKeyUsage=serverAuth\n");
writeFileSync(join(S, "ca.cnf"), "[req]\ndistinguished_name=dn\nx509_extensions=v3_ca\nprompt=no\n[dn]\nCN=blsh-egress-test-ca\n[v3_ca]\nbasicConstraints=critical,CA:TRUE\nkeyUsage=critical,keyCertSign,cRLSign\nsubjectKeyIdentifier=hash\n");
writeFileSync(join(S, "leaf.cnf"), "[req]\ndistinguished_name=dn\nprompt=no\n[dn]\nCN=localhost\n");
ossl("req", "-x509", "-newkey", "rsa:2048", "-nodes", "-keyout", "ca.key", "-out", "ca.pem", "-days", "2", "-config", "ca.cnf");
ossl("x509", "-in", "ca.pem", "-noout");
ossl("req", "-new", "-newkey", "rsa:2048", "-nodes", "-keyout", "leaf.key", "-out", "leaf.csr", "-config", "leaf.cnf");
ossl("x509", "-req", "-in", "leaf.csr", "-CA", "ca.pem", "-CAkey", "ca.key", "-CAcreateserial", "-out", "leaf.pem", "-days", "2", "-extfile", "leaf.ext");
const ca = readFileSync(join(S, "ca.pem"), "utf8");

let fails = 0;
const result = (name, ok, detail) => { if (!ok) fails++; console.log(`${ok ? "PASS" : "FAIL"} [${name}] ${detail}`); };
const tlsServer = () => new Promise(res => {
  const stats = { bytes: 0, handshakes: 0, tcp: 0 };
  const srv = tls.createServer({ key: readFileSync(join(S, "leaf.key")), cert: readFileSync(join(S, "leaf.pem")) }, s => {
    stats.handshakes++; s.on("data", d => { stats.bytes += d.length; }); s.on("error", () => {});
  });
  srv.on("tlsClientError", () => {});
  srv.on("connection", () => { stats.tcp++; });
  srv.listen(0, "127.0.0.1", () => res({ srv, port: srv.address().port, stats }));
});
const settle = () => new Promise(r => setTimeout(r, 300));

const A = await tlsServer();
let r = await checkOne({ host: "127.0.0.1", port: A.port, servername: "localhost", ca }); await settle();
// With TLS 1.3 the client is verified (secureConnect) one flight before the server finishes; the client then destroys
// the socket at once, so the server usually never reaches secureConnection. Either way no application byte arrives.
result("verified-handshake", r.ok && A.stats.tcp === 1 && A.stats.bytes === 0, `ok=${r.ok} (${r.reason}); server TCP connections=${A.stats.tcp}, server-side completed handshakes=${A.stats.handshakes}, application bytes received=${A.stats.bytes}`);
r = await checkOne({ host: "127.0.0.1", port: A.port, servername: "localhost" }); await settle();
result("untrusted-ca-default-store", !r.ok && A.stats.bytes === 0, `ok=${r.ok} (${r.reason}); bytes=${A.stats.bytes}`);
r = await checkOne({ host: "127.0.0.1", port: A.port, servername: "wrong.example", ca }); await settle();
result("hostname-mismatch", !r.ok && A.stats.bytes === 0, `ok=${r.ok} (${r.reason}); bytes=${A.stats.bytes}`);
A.srv.close();

const P = await new Promise(res => { const bytes = { n: 0 }; const srv = net.createServer(s => { s.on("data", d => { bytes.n += d.length; }); s.on("error", () => {}); }); srv.listen(0, "127.0.0.1", () => res({ srv, port: srv.address().port, bytes })); });
const t0 = Date.now();
r = await checkOne({ host: "127.0.0.1", port: P.port, servername: "localhost", ca });
const took = Date.now() - t0;
result("silent-tcp-peer-times-out", !r.ok && r.reason === "timeout" && took >= TIMEOUT_MS - 50 && took < TIMEOUT_MS + 1500, `ok=${r.ok} (${r.reason}) after ${took} ms; only a TLS ClientHello was sent (${P.bytes.n} bytes, no HTTP)`);
const hello = P.bytes.n > 0; P.srv.close();
result("client-sent-only-a-tls-hello", hello, "the silent peer saw a TLS record, not plaintext");

const closed = await new Promise(res => { const s = net.createServer(); s.listen(0, "127.0.0.1", () => { const p = s.address().port; s.close(() => res(p)); }); });
r = await checkOne({ host: "127.0.0.1", port: closed, servername: "localhost", ca });
result("closed-port", !r.ok, `ok=${r.ok} (${r.reason})`);

result("fixed-hosts", JSON.stringify(HOSTS) === JSON.stringify(["api-web.nhle.com", "fyhftlxokyjtpndbkfse.supabase.co", "data.naturalstattrick.com"]) && TIMEOUT_MS === 5000, `${HOSTS.join(", ")}; ${TIMEOUT_MS} ms`);

// CLI contract, without network: these refuse before any DNS lookup or socket.
const cli = (args, env) => spawnSync("/usr/local/bin/node", [TOOL, ...args], { env: { PATH: "/usr/bin:/bin", ...env }, encoding: "utf8", timeout: 10000 });
let c = cli([], {}); result("cli-no-args", c.status === 2 && c.stdout.includes('"usage"'), c.stdout.trim());
c = cli(["--run", "x"], {}); result("cli-extra-arg", c.status === 2 && c.stdout.includes('"usage"'), c.stdout.trim());
for (const [k, v] of [["NODE_TLS_REJECT_UNAUTHORIZED", "0"], ["NODE_EXTRA_CA_CERTS", join(S, "ca.pem")], ["HTTPS_PROXY", "http://127.0.0.1:9"], ["NODE_USE_SYSTEM_CA", "1"]]) {
  c = cli(["--run"], { [k]: v });
  result(`cli-refuses-${k}`, c.status === 2 && c.stdout.includes('"override_present"') && !c.stdout.includes('"host"'), c.stdout.trim());
}
console.log(`---- failures: ${fails}`);
process.exitCode = fails ? 1 : 0;
