// @vitest-environment node
import { AsyncResource } from "node:async_hooks";
import { createHash } from "node:crypto";
import { channel } from "node:diagnostics_channel";
import { existsSync, readFileSync } from "node:fs";
import { createServer, type Server } from "node:http";
import { resolve } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { OBSERVER_SELFTEST_PATH, REQUEST_CREATE_CHANNEL, TLS_OBSERVATION_CHANNEL, observerSelfTest, withAttributedRequests, withTlsObservation } from "./tlsObservation";

const sha = (text: string) => createHash("sha256").update(text).digest("hex");
const COPY = readFileSync(resolve(__dirname, "tlsObservation.ts"), "utf8");
const block = () => {
  const begin = "// ---- BEGIN VERBATIM v5 nativeProcessCaptureAdapter.ts lines 14-52 (348a122d6) ----\n", end = "// ---- END VERBATIM v5 ----";
  return COPY.slice(COPY.indexOf(begin) + begin.length, COPY.indexOf(end));
};
const V5 = resolve(__dirname, "../../../scripts/blsh/nativeProcessCaptureAdapter.ts");

const create = channel(REQUEST_CREATE_CHANNEL), send = channel(TLS_OBSERVATION_CHANNEL);
// Created at module load, outside any observed action: work run in its scope is "another invocation".
const foreignContext = new AsyncResource("blsh-v6-test-foreign-invocation");
const URL_RPC = "https://fyhftlxokyjtpndbkfse.supabase.co/rest/v1/rpc/nst_admit_attempt_v1";
const fakeSocket = (fingerprintByte: string) => {
  const root: Record<string, unknown> = { issuer: { CN: "Fixture Root" } }; root.issuerCertificate = root;
  const leaf = { fingerprint256: Array(32).fill(fingerprintByte).join(":"), valid_from: "Nov  1 00:00:00 2026 GMT", valid_to: "Jan 30 00:00:00 2027 GMT",
    subject: { CN: "fyhftlxokyjtpndbkfse.supabase.co" }, issuer: { CN: "Fixture Intermediate" }, issuerCertificate: root };
  return { encrypted: true, authorized: true, servername: "fyhftlxokyjtpndbkfse.supabase.co", alpnProtocol: "http/1.1", isSessionReused: () => false,
    getProtocol: () => "TLSv1.3", getCipher: () => ({ name: "TLS_AES_128_GCM_SHA256", standardName: "TLS_AES_128_GCM_SHA256", version: "TLSv1.3" }), getPeerCertificate: () => leaf };
};
const rpcRequest = (path = "/rest/v1/rpc/nst_admit_attempt_v1") => ({ origin: "https://fyhftlxokyjtpndbkfse.supabase.co", path, method: "POST" });
/** What undici does for one request: create (in the caller's context), then send its headers. */
const dispatch = (request: object, fingerprintByte = "CD") => { create.publish({ request }); send.publish({ request, headers: [], socket: fakeSocket(fingerprintByte) }); };
const foreign = () => foreignContext.runInAsyncScope(() => dispatch(rpcRequest(), "EE"));

afterEach(() => { vi.unstubAllGlobals(); });

describe("v6 TLS observer: v5's socket facts, verbatim", () => {
  it("pins the copied block to v5 lines 14-52 (sha256 f05d54f6...)", () => {
    expect(sha(block())).toBe("f05d54f679df94050fed367ae556e67fb50793603551a5d2ccda3967e835c107");
    expect(TLS_OBSERVATION_CHANNEL).toBe("undici:client:sendHeaders");
    expect(REQUEST_CREATE_CHANNEL).toBe("undici:request:create");
  });

  const v5Bytes = existsSync(V5) ? readFileSync(V5, "utf8") : null;
  it.skipIf(!v5Bytes || sha(v5Bytes) !== "aa6237bdb8d977cbd21f3ed769d9f5c7f9028e23a921965f41e278e021947be0")(
    "equals the v5 adapter's own lines 14-52 where that file is present at aa6237bd", () => {
      expect(block()).toBe(v5Bytes!.split("\n").slice(13, 52).join("\n") + "\n");
    });
});

describe("v6 TLS observer: attribution by async context (M1, Fluid compute)", () => {
  it("ignores another invocation's request to the same origin, path and method, before and after ours, and keeps our socket's facts", async () => {
    let seen = 0; const count = () => { seen++; }; send.subscribe(count);
    try {
      const result = await withTlsObservation(URL_RPC, "POST", async () => {
        foreign(); dispatch(rpcRequest()); foreign();
        return { value: 1 };
      });
      expect(seen).toBe(3);
      expect(result.value).toBe(1);
      expect(result.tls).toMatchObject({ channel: "undici:client:sendHeaders", authorized: true, sessionReused: false, connectionReused: false,
        peerCertificate: { fingerprint256: Array(32).fill("CD").join(":") } });
    } finally { send.unsubscribe(count); }
  });

  it("attributes a request created after awaits and timers inside the action (context propagates)", async () => {
    const result = await withTlsObservation(URL_RPC, "POST", async () => {
      await Promise.resolve(); await new Promise(done => setTimeout(done, 5));
      dispatch(rpcRequest());
      return {};
    });
    expect(result.tls.peerCertificate?.fingerprint256).toBe(Array(32).fill("CD").join(":"));
  });

  it.each([
    ["only another invocation's request (none of ours)", () => { foreign(); }],
    ["no request at all", () => undefined],
    ["two requests created inside the action", () => { dispatch(rpcRequest()); dispatch(rpcRequest()); }],
    ["our request to another path", () => { dispatch(rpcRequest("/rest/v1/rpc/other")); }],
    ["our request's headers observed twice", () => { const request = rpcRequest(); create.publish({ request }); send.publish({ request, socket: fakeSocket("CD") }); send.publish({ request, socket: fakeSocket("CD") }); }],
    ["our request created but its headers never observed", () => { create.publish({ request: rpcRequest() }); foreign(); }],
  ])("fails closed (capture_tls_observation_missing): %s", async (_name, act) => {
    await expect(withTlsObservation(URL_RPC, "POST", async () => { act(); return {}; })).rejects.toThrow("capture_tls_observation_missing");
  });

  it("rethrows the action's own failure and leaves no subscriber behind", async () => {
    await expect(withTlsObservation(URL_RPC, "POST", async () => { dispatch(rpcRequest()); throw new Error("capture_transport_failed"); })).rejects.toThrow("capture_transport_failed");
    expect(create.hasSubscribers).toBe(false);
    expect(send.hasSubscribers).toBe(false);
  });
});

describe("real Node undici on a loopback server (no TLS, no external network)", () => {
  const withServer = async <T>(fn: (base: string) => Promise<T>) => {
    const server: Server = createServer((req, res) => { req.resume(); req.on("end", () => res.end("ok")); });
    await new Promise<void>(done => server.listen(0, "127.0.0.1", done));
    const address = server.address();
    try { return await fn(`http://127.0.0.1:${typeof address === "object" && address ? address.port : 0}`); }
    finally { server.closeAllConnections(); server.close(); }
  };

  it("tags exactly the global fetch made inside the action while concurrent untagged fetches to the same URL run", async () => {
    await withServer(async base => {
      const get = () => fetch(`${base}/same`, { cache: "no-store" }).then(response => response.text());
      const before = Promise.all([get(), get(), get()]);
      const paths: unknown[] = [];
      const { result, created } = await withAttributedRequests(get, message => { paths.push((message as { request: { path: unknown } }).request.path); });
      const after = Promise.all([get(), get()]);
      await Promise.all([before, after]);
      expect(result).toBe("ok"); expect(created).toBe(1); expect(paths).toEqual(["/same"]);
    });
  });

  it("withTlsObservation fails closed on a plain-HTTP socket (no TLS facts), as v5 does", async () => {
    await withServer(async base => {
      await expect(withTlsObservation(`${base}/x`, "GET", () => fetch(`${base}/x`).then(response => response.text().then(() => ({}))))).rejects.toThrow("capture_tls_observation_missing");
    });
  });

  it("the pre-claim self-test passes in this runtime", async () => {
    expect(OBSERVER_SELFTEST_PATH).toBe("/blsh-observer-selftest");
    expect(await observerSelfTest()).toBeNull();
  });

  it("the self-test refuses, with no unhandled rejection, when every fetch fails", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { await new Promise(done => setTimeout(done, 5)); throw new TypeError("fetch failed"); }));
    expect(await observerSelfTest()).toBe("observer_selftest_failed");
    await new Promise(done => setTimeout(done, 20)); // let any stray rejection surface (Vitest fails the run on one)
  });

  it("the self-test refuses when fetch does not go through undici in the caller's context", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("ok")));
    expect(await observerSelfTest()).toBe("observer_selftest_failed");
  });
});
