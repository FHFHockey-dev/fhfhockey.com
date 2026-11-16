// V6-M1-REVIEW: the A'-core observer on the PRODUCTION dispatcher path, in plain Node (no test runner module loading).
// 1) require("cheerio") via CommonJS, as the compiled route does: npm undici 7.29.0 registers its Agent as the global dispatcher.
// 2) load v6 tlsObservation.ts (a byte copy) with --experimental-strip-types.
// 3) real loopback HTTPS (throwaway cert via NODE_EXTRA_CA_CERTS), concurrent traffic from other async contexts.
// Usage: NODE_EXTRA_CA_CERTS=cert.pem node --experimental-strip-types m1-npm-undici-plain.mjs <web/node_modules> <tlsObservation.ts copy> <key.pem> <cert.pem>
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { createServer } from "node:https";
const [nm, observerPath, keyPath, certPath] = process.argv.slice(2);
const require = createRequire(`${nm}/`);
const S = Symbol.for("undici.globalDispatcher.1");
const out = (k, v) => console.log(JSON.stringify({ [k]: v }));
out("dispatcherBeforeCheerio", typeof globalThis[S]);
require("cheerio");
const npm = require("undici");
out("E0_globalDispatcherIsNpmUndiciAgent", { version: require("undici/package.json").version, isNpmAgent: globalThis[S] instanceof npm.Agent });
const { withTlsObservation, observerSelfTest } = await import(observerPath);
const server = createServer({ key: readFileSync(keyPath), cert: readFileSync(certPath), keepAliveTimeout: 4000 }, (req, res) => {
  req.resume(); req.on("end", () => setTimeout(() => res.end("{}"), 5 + Math.floor(Math.random() * 20)));
});
await new Promise(r => server.listen(0, "127.0.0.1", r));
const base = `https://localhost:${server.address().port}`;
const post = path => fetch(`${base}${path}`, { method: "POST", body: "{}", redirect: "error" }).then(r => r.text().then(() => ({ status: r.status })));
const rejects = async (label, p) => { try { await p; out(label, "UNEXPECTED_SUCCESS"); return false; } catch (e) { out(label, e.message); return e.message === "capture_tls_observation_missing"; } };
let ok = true, fresh = 0, reused = 0;
for (let round = 0; round < 40; round++) {
  const foreign = Array.from({ length: 6 }, (_, i) => new Promise(r => setTimeout(r, i * 3)).then(() => post("/rest/v1/rpc/nst_admit_attempt_v1")).catch(() => null));
  try {
    const result = await withTlsObservation(`${base}/rest/v1/rpc/nst_admit_attempt_v1`, "POST", () => post("/rest/v1/rpc/nst_admit_attempt_v1"));
    if (!(result.status === 200 && result.tls.authorized === true && result.tls.servername === "localhost")) ok = false;
    result.tls.connectionReused ? reused++ : fresh++;
  } catch (e) { ok = false; out("E1_round_failed", { round, error: e.message }); }
  await Promise.all(foreign);
}
out("E1_40_rounds_6_concurrent_foreign_same_path", { allAttributed: ok, connectionReused: reused, fresh });
ok = (await rejects("E2_second_request_in_action", withTlsObservation(`${base}/x`, "POST", async () => { await post("/x"); return post("/x"); }))) && ok;
ok = (await rejects("E3_wrong_path", withTlsObservation(`${base}/expected`, "POST", () => post("/other")))) && ok;
const queue = []; const pump = setInterval(() => { while (queue.length) queue.shift()(); }, 2);
ok = (await rejects("E4_context_break_created_outside", withTlsObservation(`${base}/escaped`, "POST", () => new Promise((resolve, reject) => { queue.push(() => post("/escaped").then(resolve, reject)); })))) && ok;
clearInterval(pump);
ok = (await rejects("E5_action_sends_nothing", withTlsObservation(`${base}/none`, "POST", async () => ({ status: 200 })))) && ok;
const noise = Array.from({ length: 4 }, () => post("/noise").catch(() => null));
const selftest = await observerSelfTest(); await Promise.all(noise);
out("E6_selftest_with_concurrent_noise", selftest); ok = ok && selftest === null;
out("E7_dispatcherStillNpmAgent", globalThis[S] instanceof npm.Agent);
server.closeAllConnections(); server.close();
out("RESULT", ok ? "PASS" : "FAIL"); process.exit(ok ? 0 : 1);
