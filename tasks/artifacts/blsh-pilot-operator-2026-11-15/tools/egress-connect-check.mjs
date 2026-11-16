// BLSH pilot T-1.5: connect-only egress check (TJ's choice). For each of the three hosts the capture reaches, one
// TCP connect + TLS handshake on port 443 with full verification (Node's bundled CA store, the store the capture
// uses; certificate chain + hostname), then the socket is destroyed. No HTTP bytes and no application data are
// ever written. One attempt per host, 5 s timeout, sequential. Prints {"host","result":"ok"|"fail"} lines only.
//
// It is Node, not Python, on purpose: Node's bundled roots are the trust store the capture's undici uses; the CLT
// Python's OpenSSL/LibreSSL store differs, so a Python "ok" would not predict the capture.
//
// The ONLY live invocation (needs TJ's approval A1; never run it for tests):
//   /usr/bin/env -i PATH=/usr/bin:/bin /usr/local/bin/node <this file> --run
// It refuses (before any DNS or socket) if any CA/TLS/proxy/preload override key is in its environment, or if the
// default CA store is not Node's bundled store. Exit 0 only if all three hosts are ok.
import tls from "node:tls";
import { pathToFileURL } from "node:url";

export const HOSTS = ["api-web.nhle.com", "fyhftlxokyjtpndbkfse.supabase.co", "data.naturalstattrick.com"];
export const TIMEOUT_MS = 5000;
const OVERRIDES = ["NODE_EXTRA_CA_CERTS", "NODE_TLS_REJECT_UNAUTHORIZED", "NODE_OPTIONS", "NODE_USE_SYSTEM_CA", "NODE_USE_ENV_PROXY",
  "SSL_CERT_FILE", "SSL_CERT_DIR", "OPENSSL_CONF", "HTTPS_PROXY", "HTTP_PROXY", "ALL_PROXY", "NO_PROXY",
  "https_proxy", "http_proxy", "all_proxy", "no_proxy"];

// One handshake. `ca` and `port` exist for the offline loopback tests; --run never passes them.
export function checkOne({ host, port = 443, servername = host, ca, timeoutMs = TIMEOUT_MS }) {
  return new Promise(resolve => {
    let done = false, socket;
    const finish = (ok, reason) => {
      if (done) return; done = true; clearTimeout(timer);
      try { socket?.destroy(); } catch { /* already closed */ }
      resolve({ host, ok, reason });
    };
    const timer = setTimeout(() => finish(false, "timeout"), timeoutMs);
    try {
      socket = tls.connect({ host, port, servername, rejectUnauthorized: true, ...(ca ? { ca } : {}) });
    } catch (error) { finish(false, error?.code ?? "connect_threw"); return; }
    socket.once("secureConnect", () => finish(socket.authorized === true, socket.authorized ? "handshake_verified" : String(socket.authorizationError)));
    socket.once("error", error => finish(false, error?.code ?? "error"));
    socket.once("close", () => finish(false, "closed_before_handshake"));
  });
}

async function main(argv) {
  if (argv.length !== 1 || argv[0] !== "--run") { process.stdout.write('{"egress":"refuse","code":"usage"}\n'); return 2; }
  const present = OVERRIDES.filter(k => Object.prototype.hasOwnProperty.call(process.env, k));
  if (present.length || process.execArgv.length) { process.stdout.write(JSON.stringify({ egress: "refuse", code: "override_present", keys: present, execArgv: process.execArgv.length }) + "\n"); return 2; }
  const def = tls.getCACertificates("default"), bundled = tls.getCACertificates("bundled");
  if (def.length !== bundled.length || def.some((c, i) => c !== bundled[i])) { process.stdout.write('{"egress":"refuse","code":"default_ca_not_bundled"}\n'); return 2; }
  let allOk = true;
  for (const host of HOSTS) {
    const r = await checkOne({ host });
    allOk &&= r.ok;
    process.stdout.write(JSON.stringify({ host, result: r.ok ? "ok" : "fail" }) + "\n");
  }
  return allOk ? 0 : 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main(process.argv.slice(2)).then(code => { process.exitCode = code; }, () => { process.stdout.write('{"egress":"refuse","code":"unexpected"}\n'); process.exitCode = 2; });
}
