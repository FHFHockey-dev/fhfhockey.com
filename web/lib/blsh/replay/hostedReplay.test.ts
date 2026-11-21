// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import { createReplayFixtureAdapterV6, NO_SERVICE_KEY, REPLAY_LOGICAL_INGRESS_DAY, REPLAY_MARK, REPLAY_SOURCE_DATE, sandboxContextTransport, sandboxWriterTransport } from "./hostedReplay";

const api = { url: "https://fyhftlxokyjtpndbkfse.supabase.co", anonKey: "anon-key", token: "sandbox-token" };
const ORIGIN = "https://fyhftlxokyjtpndbkfse.supabase.co";

function mockFetch(body: unknown, status = 200) {
  const calls: { url: string; init: RequestInit }[] = [];
  vi.stubGlobal("fetch", vi.fn(async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    return new Response(JSON.stringify(body), { status });
  }));
  return calls;
}
afterEach(() => { vi.unstubAllGlobals(); });

describe("BLSH hosted replay transports", () => {
  it("sends store RPCs to the sandbox API schema as the sandbox role and drops the store's own auth", async () => {
    const calls = mockFetch({ claimed: true, run_id: "00000000-0000-4000-8000-000000000000" });
    const transport = sandboxWriterTransport(api);
    await transport({ method: "POST", url: `${ORIGIN}/rest/v1/rpc/blsh_capture_claim_v1`, timeoutMs: 1000,
      headers: { apikey: NO_SERVICE_KEY, Authorization: `Bearer ${NO_SERVICE_KEY}` }, body: Buffer.from('{"p_pipeline":"native-v6"}') });
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe(`${ORIGIN}/rest/v1/rpc/blsh_capture_claim_v1`);
    const headers = calls[0].init.headers as Record<string, string>;
    expect(headers["Content-Profile"]).toBe("blsh_replay_api");
    expect(headers["Accept-Profile"]).toBe("blsh_replay_api");
    expect(headers.Authorization).toBe("Bearer sandbox-token");
    expect(headers.apikey).toBe("anon-key");
    expect(JSON.stringify(calls[0].init)).not.toContain(NO_SERVICE_KEY);
  });

  it("maps Storage uploads and authenticated downloads onto the sandbox storage RPCs", async () => {
    const calls = mockFetch(true);
    await sandboxWriterTransport(api)({ method: "POST", url: `${ORIGIN}/storage/v1/object/blsh-native-packets/native-v6/2026-11-19/x/STARTED.json`,
      timeoutMs: 1000, headers: { "Content-Type": "application/json" }, body: Buffer.from("{}") });
    expect(calls[0].url).toBe(`${ORIGIN}/rest/v1/rpc/blsh_replay_storage_put_v1`);
    expect(JSON.parse(String(calls[0].init.body))).toEqual({ p_bucket: "blsh-native-packets", p_name: "native-v6/2026-11-19/x/STARTED.json",
      p_mime: "application/json", p_b64: Buffer.from("{}").toString("base64") });
    vi.unstubAllGlobals();
    const get = mockFetch(Buffer.from("abc").toString("base64"));
    const bytes = await sandboxContextTransport(api)({ method: "GET", url: `${ORIGIN}/storage/v1/object/authenticated/blsh-native-packets/a/b.json`,
      headers: {}, limit: 10, timeoutMs: 1000 });
    expect(get[0].url).toBe(`${ORIGIN}/rest/v1/rpc/blsh_replay_storage_get_v1`);
    expect(bytes.toString()).toBe("abc");
  });

  it.each([
    ["another origin", "https://api-web.nhle.com/v1/schedule/2026-11-19", "GET"],
    ["NST", "https://data.naturalstattrick.com/playerteams.php", "GET"],
    ["a non-BLSH RPC", `${ORIGIN}/rest/v1/rpc/nst_admit_attempt_v1`, "POST"],
    ["a table write", `${ORIGIN}/rest/v1/blsh_capture_runs`, "POST"],
    ["another bucket", `${ORIGIN}/storage/v1/object/public-bucket/x.json`, "POST"],
    ["a query string", `${ORIGIN}/rest/v1/rpc/blsh_capture_enabled_v1?select=*`, "POST"],
  ])("refuses %s without any request", async (_label, url, method) => {
    const calls = mockFetch(true);
    await expect(sandboxContextTransport(api)({ method: method as "GET" | "POST", url, headers: {}, body: Buffer.from("{}"), limit: 10, timeoutMs: 1000 })).rejects.toThrow();
    expect(calls).toHaveLength(0);
  });
});

describe("BLSH replay fixture adapter", () => {
  it("serves only the replay date and marks every transport and admission record replay-fixture", async () => {
    expect(() => createReplayFixtureAdapterV6("2026-11-20", { schedule: Buffer.from("s"), individual: Buffer.from("i"), onIce: Buffer.from("o") })).toThrow("replay_adapter_date_invalid");
    const adapter = createReplayFixtureAdapterV6("2026-11-19", { schedule: Buffer.from("s"), individual: Buffer.from("i"), onIce: Buffer.from("o") });
    const values: Record<string, unknown>[] = [];
    const dispatch = (async (operation: string, action: (spec: object) => Promise<Record<string, unknown>>) => {
      const url = operation === "schedule" ? "https://api-web.nhle.com/v1/schedule/2026-11-19" : operation.startsWith("nst:") ? "https://data.naturalstattrick.com/x" : `${ORIGIN}/rest/v1/rpc/nst_admit_attempt_v1`;
      const value = await action({ url, method: operation.startsWith("admission:") ? "POST" : "GET", redirect: "error", signal: new AbortController().signal, timeoutMs: 1, maxResponseBytes: 10 });
      values.push(value);
      return { operation, completedAtUTC: "x", witness: {}, value };
    }) as never;
    await adapter.schedule(dispatch);
    await adapter.nst("individual", "https://data.naturalstattrick.com/x", { dispatch } as never);
    expect(values).toHaveLength(3);
    for (const value of values) {
      const tls = value.tls as Record<string, unknown>;
      expect(tls.authorized).toBe(false);
      expect(tls.protocol).toBe(REPLAY_MARK);
      expect(String(tls.authorizationError)).toContain(REPLAY_MARK);
    }
    expect(values[1]).toMatchObject({ kind: "admission", source: REPLAY_MARK });
  });
});

describe("BLSH replay date pins", () => {
  it("pins the context date gate to the slate's logical ingress day, the day after the source date", () => {
    expect(REPLAY_SOURCE_DATE).toBe("2026-11-19");
    expect(REPLAY_LOGICAL_INGRESS_DAY).toBe("2026-11-20");
    expect(Date.parse(REPLAY_LOGICAL_INGRESS_DAY) - Date.parse(REPLAY_SOURCE_DATE)).toBe(86_400_000);
  });
});
