// @vitest-environment node
import { describe, expect, it, vi } from "vitest";

// node:https is replaced: the Agent records its options, and request never connects.
const https = vi.hoisted(() => ({ agents: [] as unknown[], requests: [] as { url: string; options: Record<string, unknown> }[] }));
vi.mock("node:https", () => ({
  Agent: class { constructor(options: unknown) { https.agents.push(options); } },
  request: (url: string, options: Record<string, unknown>, onResponse: (response: unknown) => void) => {
    https.requests.push({ url, options });
    const handlers: Record<string, (value?: unknown) => void> = {};
    const response = { statusCode: 201, on: (event: string, handler: (value?: unknown) => void) => { handlers[event] = handler; return response; }, destroy: () => {} };
    return { on: () => {}, destroy: () => {}, end: () => { onResponse(response); handlers.data?.(Buffer.from("true")); handlers.end?.(); } };
  },
}));
vi.mock("node:http", () => { throw new Error("HTTP forbidden"); });

import { createCaptureStore, httpsWriterTransport, WRITER_AGENT_OPTIONS, type WriterRequest } from "./writer";

const ORIGIN = "https://fyhftlxokyjtpndbkfse.supabase.co", KEY = "fixture-service-key";
const RUN = "11111111-1111-4111-8111-111111111111";

describe("v6 isolated writer", () => {
  it("uses node:https with keep-alive off and the TLS session cache disabled", async () => {
    const response = await httpsWriterTransport({ method: "POST", url: `${ORIGIN}/rest/v1/rpc/blsh_capture_enabled_v1`, headers: {}, body: Buffer.from("{}"), timeoutMs: 1000 });
    expect(response).toEqual({ status: 201, body: Buffer.from("true") });
    expect(WRITER_AGENT_OPTIONS).toEqual({ keepAlive: false, maxCachedSessions: 0 });
    expect(https.agents).toEqual([{ keepAlive: false, maxCachedSessions: 0 }]);
    expect(https.requests[0].options.agent).toBeDefined();
  });

  it("sends RPCs and a no-upsert Storage upload, and records the object after the upload", async () => {
    const seen: WriterRequest[] = [];
    const store = createCaptureStore({ origin: ORIGIN, serviceKey: KEY, transport: async request => {
      seen.push(request);
      const name = request.url.split("/").at(-1);
      if (name === "blsh_capture_claim_v1") return { status: 200, body: Buffer.from(JSON.stringify({ claimed: true, run_id: RUN })) };
      return { status: 200, body: Buffer.from(request.url.includes("/storage/") ? "{}" : "true") };
    } });
    expect(await store.claim({ sourceDate: "2026-11-19", deployment: { deploymentId: "dpl_x" } })).toEqual({ claimed: true, runId: RUN });
    await store.putObject(RUN, "2026-11-19", 1, "schedule.raw.json", Buffer.from("{}"), "a".repeat(64));
    expect(seen.map(request => request.url.replace(ORIGIN, ""))).toEqual(["/rest/v1/rpc/blsh_capture_claim_v1",
      `/storage/v1/object/blsh-native-packets/native-v6/2026-11-19/${RUN}/schedule.raw.json`, "/rest/v1/rpc/blsh_capture_object_v1"]);
    expect(seen[1].headers["x-upsert"]).toBe("false");
    expect(JSON.parse(seen[0].body!.toString())).toEqual({ p_pipeline: "native-v6", p_source_date: "2026-11-19", p_deployment: { deploymentId: "dpl_x" } });
    expect(JSON.parse(seen[2].body!.toString())).toEqual({ p_run_id: RUN, p_ordinal: 1, p_path: `native-v6/2026-11-19/${RUN}/schedule.raw.json`, p_sha256: "a".repeat(64), p_bytes: 2 });
    for (const request of seen) expect(request.headers.Authorization).toBe(`Bearer ${KEY}`);
  });

  it("maps a refused claim, HTTP errors and transport failures to value-free codes", async () => {
    const respond = (status: number, body: string) => createCaptureStore({ origin: ORIGIN, serviceKey: KEY, transport: async () => ({ status, body: Buffer.from(body) }) });
    expect(await respond(200, JSON.stringify({ claimed: false })).claim({ sourceDate: "2026-11-19", deployment: {} })).toEqual({ claimed: false });
    await expect(respond(200, JSON.stringify({ claimed: true, run_id: "not-a-uuid" })).claim({ sourceDate: "2026-11-19", deployment: {} })).rejects.toThrow("store_claim_unacknowledged");
    await expect(respond(409, `{"message":"${KEY}"}`).putObject(RUN, "2026-11-19", 1, "x.json", Buffer.from("{}"), "a".repeat(64))).rejects.toThrow(/^store_upload_http_409$/);
    await expect(respond(200, "false").intent(RUN, "individual", ["admission:individual", "nst:individual"])).rejects.toThrow("store_intent_unacknowledged");
    const broken = createCaptureStore({ origin: ORIGIN, serviceKey: KEY, transport: async () => { throw new Error(`socket ${KEY}`); } });
    let message = "";
    try { await broken.enabled(); } catch (caught) { message = (caught as Error).message; }
    expect(message).toBe("store_blsh_capture_enabled_v1_transport_failed");
    await expect(respond(200, "true").putObject(RUN, "2026-11-19", 1, "../escape", Buffer.from("{}"), "a".repeat(64))).rejects.toThrow("store_object_path_invalid");
  });
});
