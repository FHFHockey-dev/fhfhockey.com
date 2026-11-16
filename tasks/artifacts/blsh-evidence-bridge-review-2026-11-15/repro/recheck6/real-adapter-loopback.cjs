// RECHECK-6: exercise the REAL transport path after dispatch (pinned v5 adapter withTlsObservation + global fetch from npm
// undici 7.29.0, gzip/br/deflate bodies, a JSON POST, cheerio parse of a page) so lazily loaded files show up in require.cache.
// Loopback only: every socket is forced to 127.0.0.1:<port>; the private CA is passed by wrapping tls.connect (harness only,
// adds no module). argv: <cert.pem> <key.pem>. Run from web/ with the ts-node launcher + dump-cache-on-exit.cjs.
"use strict";
const tls = require("node:tls"), net = require("node:net"), fs = require("node:fs"), https = require("node:https"), zlib = require("node:zlib");
const [certPath, keyPath] = process.argv.slice(2);
const cert = fs.readFileSync(certPath), key = fs.readFileSync(keyPath);
const c = net.Socket.prototype.connect;
net.Socket.prototype.connect = function (...a) { const f = a[0], h = typeof f === "object" ? f.host : a[1]; if (!["127.0.0.1", "localhost", "::1", undefined].includes(h)) throw new Error("reviewer guard:" + h); return c.apply(this, a); };
const server = https.createServer({ cert, key }, (req, res) => {
  let body = ""; req.on("data", d => body += d); req.on("end", () => {
    const u = req.url;
    if (u.includes("boxscore")) { res.writeHead(200, { "content-type": "application/json", "content-encoding": "gzip" }); res.end(zlib.gzipSync(JSON.stringify({ id: 1, homeTeam: { abbrev: "AAA" } }))); }
    else if (u.includes("schedule")) { res.writeHead(200, { "content-type": "application/json", "content-encoding": "br" }); res.end(zlib.brotliCompressSync(JSON.stringify({ gameWeek: [] }))); }
    else if (u.includes("playerteams")) { res.writeHead(200, { "content-type": "text/html; charset=windows-1252", "content-encoding": "deflate" });
      res.end(zlib.deflateSync("<html><body><table id='players'><thead><tr><th>Player</th></tr></thead><tbody><tr><td>HAND WRITTEN</td></tr></tbody></table></body></html>")); }
    else { res.writeHead(200, { "content-type": "application/json" }); res.end(JSON.stringify({ allowed: true, echo: body.length })); }
  });
});
server.listen(0, "127.0.0.1", async () => {
  const port = server.address().port, real = tls.connect;
  tls.connect = function (opts, ...rest) { return real.call(this, { ...opts, host: "127.0.0.1", port, ca: cert }, ...rest); };
  try {
    const { load } = require("node:module").createRequire(process.cwd() + "/package.json")("cheerio"); // as the runner's import does (registers npm undici's Agent)
    const { withTlsObservation } = require(process.cwd() + "/scripts/blsh/nativeProcessCaptureAdapter.ts");
    const out = [];
    for (const [url, method, kind] of [["https://api-web.nhle.com/v1/schedule/2026-11-11", "GET", "json"],
      ["https://fyhftlxokyjtpndbkfse.supabase.co/rest/v1/rpc/nst_admit_attempt_v1", "POST", "json"],
      ["https://data.naturalstattrick.com/playerteams.php?fd=2026-11-11", "GET", "html"],
      ["https://api-web.nhle.com/v1/gamecenter/2026020293/boxscore", "GET", "json"]]) {
      const r = await withTlsObservation(url, method, async () => {
        const res = await fetch(url, { method, redirect: "error", cache: "no-store", ...(method === "POST" ? { body: JSON.stringify({ x: 1 }), headers: { "content-type": "application/json" } } : {}) });
        const text = await res.text();
        return { status: res.status, rows: kind === "html" ? load(text)("table tbody tr").length : Object.keys(JSON.parse(text)).length };
      });
      out.push({ method, status: r.status, rows: r.rows, authorized: r.tls?.authorized });
    }
    console.log(JSON.stringify(out));
  } catch (e) { console.log(JSON.stringify({ error: String(e && e.stack || e) })); }
  server.close(); process.exit(0);
});
