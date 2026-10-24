import { blockedConnections } from "./offline-network.mjs";
import { createServer } from "node:http";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import path from "node:path";
import fs from "node:fs";

const artifacts = fileURLToPath(new URL("./", import.meta.url));
const web = fileURLToPath(new URL("../../../../web/", import.meta.url));
const require = createRequire(path.join(web, "package.json"));
const lock = "/private/tmp/fhfh-heavy.lock";
const stamp = { owner: "forge-testing-grounds-slice05", pid: process.pid, startedAt: new Date().toISOString() };
// Atomic reservation: never remove or replace another worker's lock.
fs.mkdirSync(lock);
fs.writeFileSync(path.join(lock, "testing-grounds-owner.json"), JSON.stringify(stamp));
let lockHeld = true;
function releaseLock() {
  if (!lockHeld) return;
  const receipt = JSON.parse(fs.readFileSync(path.join(lock, "testing-grounds-owner.json"), "utf8"));
  if (receipt.pid !== process.pid) throw new Error("Lock owner mismatch");
  fs.unlinkSync(path.join(lock, "testing-grounds-owner.json"));
  fs.rmdirSync(lock); lockHeld = false;
}

const runtime = fs.mkdtempSync("/tmp/forge-testing-grounds-s05-");
const distDir = ".next-forge-testing-grounds-s05";
const record = { ...stamp, port: 3000, hostname: "127.0.0.1", runtime, cache: path.join(runtime, distDir),
  mode: "locked_offline_view", outboundBlocked: true, ownerConfigurationChanged: false };
fs.writeFileSync(path.join(artifacts, "runtime.json"), JSON.stringify(record, null, 2) + "\n");
// Source remains exclusively in the canonical checkout. Copies are configuration
// inputs for Next-generated updates, never source edits or credential copies.
const configCopies = new Set(["package.json", "tsconfig.json", "next.config.js", "next-bootstrap.d.ts", "next-seo.config.js", "yahoo-fantasy.d.ts", "postcss.config.js"]);
for (const entry of fs.readdirSync(web, { withFileTypes: true })) {
  if (entry.name.startsWith(".") || entry.name === "next-env.d.ts") continue;
  if (entry.isDirectory() || entry.isSymbolicLink()) fs.symlinkSync(path.join(web, entry.name), path.join(runtime, entry.name));
  else if (configCopies.has(entry.name)) fs.copyFileSync(path.join(web, entry.name), path.join(runtime, entry.name));
}
process.env.NEXT_TELEMETRY_DISABLED = "1";
process.env.PLAYWRIGHT_ISOLATED_NEXT = "1";
// Ordinary Next startup environment loading, with no values printed or copied.
require("@next/env").loadEnvConfig(web, true, { info() {}, error() {} });
const conf = require(path.join(web, "next.config.js"));
const next = require("next");
const app = next({ dev: true, dir: runtime, hostname: "127.0.0.1", port: 3000,
  conf: { ...conf, distDir, experimental: { ...conf.experimental, externalDir: true } } });
const handler = app.getRequestHandler();
const csp = "default-src 'self'; connect-src 'self' ws://localhost:3000 ws://127.0.0.1:3000; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; frame-src 'none'; object-src 'none'; form-action 'none'; base-uri 'self'";
const staticPath = pathname => pathname.startsWith("/_next/static/") || /^\/(?:pictures\/|fhfh-favicon-|apple-touch-icon|favicon\.ico|site\.webmanifest)/.test(pathname);
let pageCompiled = false;
let accessCompiled = false;
const server = createServer(async (req, res) => {
  res.setHeader("Content-Security-Policy", csp);
  res.setHeader("Cache-Control", "private, no-store");
  const url = new URL(req.url, "http://localhost:3000");
  const page = url.pathname === "/forge/testing-grounds";
  const access = url.pathname === "/api/v1/forge/testing-grounds/access";
  if (req.method !== "GET" || (!page && !access && !staticPath(url.pathname))) {
    res.writeHead(404); res.end("This isolated viewer serves only Testing Grounds."); return;
  }
  try {
    await handler(req, res);
    pageCompiled ||= page;
    accessCompiled ||= access;
    if (pageCompiled && accessCompiled && lockHeld) {
      releaseLock();
      fs.writeFileSync(path.join(artifacts, "runtime.json"), JSON.stringify({ ...record, initialPageCompiled: true, heavyLockReleased: true, blockedConnections: blockedConnections() }, null, 2) + "\n");
    }
  } catch {
    if (!res.headersSent) res.writeHead(503);
    res.end("Local viewer unavailable.");
  }
});
server.on("upgrade", (req, socket, head) => {
  if (req.url?.startsWith("/_next/webpack-hmr")) void app.getUpgradeHandler()(req, socket, head);
  else socket.destroy();
});
async function stop() {
  server.close(); await app.close(); releaseLock(); process.exit(0);
}
process.once("SIGTERM", stop); process.once("SIGINT", stop);
try {
  await app.prepare();
  await new Promise((resolve, reject) => { server.once("error", reject); server.listen(3000, "127.0.0.1", resolve); });
  process.stdout.write(JSON.stringify({ ready: true, ...record }) + "\n");
} catch (error) {
  releaseLock();
  process.stderr.write(`Local viewer startup failed: ${error instanceof Error ? error.message : "unknown"}\n`);
  await app.close(); process.exitCode = 1;
}
