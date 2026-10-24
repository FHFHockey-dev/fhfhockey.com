// Interim viewing artifact explicitly approved by Scout/TJ. This is not the
// integrated authenticated Next app and exposes no application/API endpoints.
import { createServer } from "node:http";
import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";

const html = readFileSync(new URL("../slice-04-r1/preview.html", import.meta.url));
const sha256 = createHash("sha256").update(html).digest("hex");
if (sha256 !== "acc143342a811483740253c58176819be8ae40570a8b2bfeeb3066932ec49c77") throw new Error("Frozen preview mismatch");
const record = { pid: process.pid, startedAt: new Date().toISOString(), hostname: "127.0.0.1", port: 3000,
  mode: "standalone_synthetic_preview_not_authenticated_app", sha256, bytes: html.length,
  source: fileURLToPath(new URL("../slice-04-r1/preview.html", import.meta.url)),
  nextServer: false, buildCache: null, externalRequests: false, launchEnabled: false };
const server = createServer((req, res) => {
  res.setHeader("Cache-Control", "private, no-store, max-age=0");
  res.setHeader("X-Robots-Tag", "noindex, nofollow");
  res.setHeader("X-Testing-Grounds-Mode", record.mode);
  res.setHeader("Content-Security-Policy", "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:; connect-src 'none'; form-action 'none'; frame-ancestors 'none'; base-uri 'none'");
  const pathname = new URL(req.url, "http://localhost:3000").pathname;
  if ((req.method !== "GET" && req.method !== "HEAD") || pathname !== "/forge/testing-grounds") {
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("This local preview server serves only /forge/testing-grounds. The authenticated application is not running here."); return;
  }
  res.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Content-Length": html.length });
  res.end(req.method === "HEAD" ? undefined : html);
});
server.on("error", error => { process.stderr.write(`Preview server failed: ${error.code ?? "unknown"}\n`); process.exitCode = 1; });
server.listen(3000, "127.0.0.1", () => {
  writeFileSync(new URL("runtime.json", import.meta.url), JSON.stringify(record, null, 2) + "\n");
  process.stdout.write(JSON.stringify({ ready: true, ...record }) + "\n");
});
for (const signal of ["SIGINT", "SIGTERM"]) process.once(signal, () => server.close());
