// Writer-isolation check on real TLS, loopback only (127.0.0.1, throwaway certificate). It answers
// DESIGN.md §3.3: can an in-run Supabase write make the next undici fetch to the SAME host resume
// a TLS session, which the core then refuses (tls_resumed_without_full_handshake)?
//   A. control: two fetches to the same host. Shows whether undici resumes its own cached session.
//   B. v6 writer: node:https with the writer's exact agent options, then one fetch.
//      Expected: the fetch is a full handshake (peer certificate present, not resumed), and the
//      writer published nothing on undici:client:sendHeaders.
// Usage: node writer-isolation-loopback.cjs <dir with ca.pem, key.pem, cert.pem> <path to writer.ts>
const tls = require("node:tls"), https = require("node:https"), fs = require("node:fs"), dc = require("node:diagnostics_channel");
const [dir, writerPath] = process.argv.slice(2);
// Bind the agent options to the writer's source text, so this check cannot drift from it.
const source = fs.readFileSync(writerPath, "utf8");
if (!/WRITER_AGENT_OPTIONS = Object\.freeze\(\{ keepAlive: false, maxCachedSessions: 0 \}\)/.test(source)) throw new Error("writer agent options changed");
const WRITER_AGENT_OPTIONS = { keepAlive: false, maxCachedSessions: 0 };
tls.setDefaultCACertificates([...tls.getCACertificates("default"), fs.readFileSync(`${dir}/ca.pem`, "utf8")]);
const events = [];
dc.channel("undici:client:sendHeaders").subscribe(message => {
  const certificate = message.socket.getPeerCertificate(true);
  events.push({ resumed: message.socket.isSessionReused(), peerCertificate: certificate && certificate.fingerprint256 ? "present" : "absent" });
});
const writerRequest = (agent, url) => new Promise((resolve, reject) => {
  const request = https.request(url, { method: "POST", agent }, response => { response.resume(); response.on("end", resolve); });
  request.on("error", reject); request.end("{}");
});
(async () => {
  const results = {};
  for (const maxVersion of ["TLSv1.3", "TLSv1.2"]) {
    const server = https.createServer({ key: fs.readFileSync(`${dir}/key.pem`), cert: fs.readFileSync(`${dir}/cert.pem`), maxVersion, keepAliveTimeout: 200 }, (q, r) => r.end("true"));
    let handshakes = 0; server.on("secureConnection", () => handshakes++);
    await new Promise(r => server.listen(0, "127.0.0.1", r));
    const base = `https://localhost:${server.address().port}`;
    const idle = () => new Promise(r => setTimeout(r, 600)); // past keepAliveTimeout: a new connection each time, as with 22 s spacing
    // A. control: undici -> undici
    events.length = 0;
    await (await fetch(`${base}/control-1`)).text(); await idle();
    await (await fetch(`${base}/control-2`)).text(); await idle();
    const control = events.slice();
    // B. v6 writer (3 writes) -> undici, on a fresh origin path; reset undici's cache with a new port.
    server.close(); const server2 = https.createServer({ key: fs.readFileSync(`${dir}/key.pem`), cert: fs.readFileSync(`${dir}/cert.pem`), maxVersion, keepAliveTimeout: 200 }, (q, r) => r.end("true"));
    let handshakes2 = 0; server2.on("secureConnection", () => handshakes2++);
    await new Promise(r => server2.listen(0, "127.0.0.1", r));
    const base2 = `https://localhost:${server2.address().port}`;
    const agent = new https.Agent({ ...WRITER_AGENT_OPTIONS });
    events.length = 0;
    for (let i = 0; i < 3; i++) await writerRequest(agent, `${base2}/rest/v1/rpc/blsh_capture_intent_v1`);
    const writerEvents = events.length;
    await idle();
    await (await fetch(`${base2}/rest/v1/rpc/nst_admit_attempt_v1`, { method: "POST", body: "{}" })).text();
    const afterWriter = events.slice();
    results[maxVersion] = { control, controlServerHandshakes: handshakes, writerSendHeadersEvents: writerEvents, fetchAfterWriter: afterWriter, writerScenarioServerHandshakes: handshakes2 };
    server2.close();
  }
  const pass = Object.values(results).every(r => r.writerSendHeadersEvents === 0 && r.fetchAfterWriter.length === 1
    && r.fetchAfterWriter[0].resumed === false && r.fetchAfterWriter[0].peerCertificate === "present");
  console.log(JSON.stringify({ version: "fhfh.blsh.cron-v6.writer-isolation-loopback.v1", node: process.version, nonLoopbackConnections: 0, pass, results }, null, 2));
  process.exit(pass ? 0 : 1);
})().catch(error => { console.error(`loopback_error ${error && error.code ? error.code : "unknown"}`); process.exit(2); });
