// @vitest-environment node
// V6-M1-REVIEW experiment: the A'-core observer on the PRODUCTION dispatcher path. core.ts imports cheerio, which loads
// npm undici 7.29.0 and registers its default Agent as the global dispatcher; this file does the same, then drives REAL
// loopback HTTPS (throwaway certificate, trusted through NODE_EXTRA_CA_CERTS) with concurrent traffic from another
// async context. Loopback only. Run in a scratch export: NODE_EXTRA_CA_CERTS=<cert.pem> M1_KEY=<key.pem> M1_CERT=<cert.pem> vitest run <this file>
import "cheerio";
import { readFileSync } from "node:fs";
import { createServer, type Server } from "node:https";
import { createRequire } from "node:module";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import * as undiciInGraph from "undici";
import { observerSelfTest, withTlsObservation } from "./tlsObservation";

const GLOBAL = Symbol.for("undici.globalDispatcher.1");
let server: Server, base: string;
beforeAll(async () => {
  server = createServer({ key: readFileSync(process.env.M1_KEY!), cert: readFileSync(process.env.M1_CERT!), keepAliveTimeout: 4000 }, (req, res) => {
    req.resume(); req.on("end", () => setTimeout(() => res.end("{}"), 5 + Math.floor(Math.random() * 20)));
  });
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", () => resolve()));
  base = `https://localhost:${(server.address() as { port: number }).port}`;
});
afterAll(() => { server.closeAllConnections(); server.close(); });
const post = (path: string) => fetch(`${base}${path}`, { method: "POST", body: "{}", redirect: "error" }).then(r => r.text().then(() => ({ status: r.status })));

describe("A'-core observer on npm undici 7.29.0 (the dispatcher cheerio registers), real loopback TLS", () => {
  it("E0: before any fetch, the global dispatcher is npm undici 7.29.0's Agent (registered by the cheerio import)", () => {
    const dispatcher = (globalThis as unknown as Record<symbol, unknown>)[GLOBAL] as { constructor?: { name?: string } } | undefined;
    const pkg = createRequire(__filename)("undici/package.json") as { version: string };
    // Vitest evaluates its own copy of the npm module, so compare with the undici the test graph imports (same as cheerio's).
    const sameGraph = dispatcher instanceof (undiciInGraph as { Agent: new () => unknown }).Agent;
    console.log("E0: npm undici", pkg.version, "registered before any fetch:", dispatcher !== undefined, "constructor:", dispatcher?.constructor?.name, "instanceof the graph's npm Agent:", sameGraph);
    expect(dispatcher).toBeDefined(); expect(sameGraph).toBe(true);
  });
  it("E1: 40 rounds, each with 6 concurrent same-origin/path/method POSTs from OTHER contexts (before and during): ours is attributed every time", async () => {
    let fresh = 0, reused = 0;
    for (let round = 0; round < 40; round++) {
      const foreign = Array.from({ length: 6 }, (_, i) => new Promise<void>(r => setTimeout(r, i * 3)).then(() => post("/rest/v1/rpc/nst_admit_attempt_v1")).catch(() => null));
      const result = await withTlsObservation(`${base}/rest/v1/rpc/nst_admit_attempt_v1`, "POST", () => post("/rest/v1/rpc/nst_admit_attempt_v1"));
      await Promise.all(foreign);
      expect(result.status).toBe(200);
      expect(result.tls.authorized).toBe(true);
      expect(result.tls.servername).toBe("localhost");
      if (result.tls.connectionReused) reused++; else fresh++;
    }
    console.log(`E1: 40/40 attributed; connectionReused=${reused}, fresh=${fresh}`);
  });
  it("E2: a second request created inside the action fails closed", async () => {
    await expect(withTlsObservation(`${base}/x`, "POST", async () => { await post("/x"); return post("/x"); })).rejects.toThrow("capture_tls_observation_missing");
  });
  it("E3: our request to another path fails closed (origin/path/method still checked)", async () => {
    await expect(withTlsObservation(`${base}/expected`, "POST", () => post("/other"))).rejects.toThrow("capture_tls_observation_missing");
  });
  it("E4: a context-propagation break (request created by a loop started OUTSIDE the action) fails closed: created=0", async () => {
    const queue: (() => void)[] = [];
    const pump = setInterval(() => { while (queue.length) queue.shift()!(); }, 2); // created outside any action context
    try {
      await expect(withTlsObservation(`${base}/escaped`, "POST", () => new Promise<{ status: number }>((resolve, reject) => {
        queue.push(() => { post("/escaped").then(resolve, reject); });
      }))).rejects.toThrow("capture_tls_observation_missing");
    } finally { clearInterval(pump); }
  });
  it("E5: the action sends nothing: fails closed", async () => {
    await expect(withTlsObservation(`${base}/none`, "POST", async () => ({ status: 200 }))).rejects.toThrow("capture_tls_observation_missing");
  });
  it("E6: the pre-claim self-test passes on this dispatcher, also with concurrent foreign traffic running", async () => {
    const noise = Array.from({ length: 4 }, () => post("/noise").catch(() => null));
    expect(await observerSelfTest()).toBeNull();
    await Promise.all(noise);
  });
});
