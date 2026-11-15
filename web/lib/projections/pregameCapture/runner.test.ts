import { describe, expect, it } from "vitest";
import { calendarRevisionOf, CAPTURE_ENABLED_ENV, httpTsaClient, runPrivatePregameCapture } from "./runner";

describe("pregame capture runner wiring", () => {
  it("is disabled unless the enable flag is exactly \"true\"", async () => {
    for (const value of [undefined, "1", "TRUE", "false"]) {
      await expect(runPrivatePregameCapture({
        supabaseUrl: "https://x.test", serviceRoleKey: "k", tsaUrl: "https://tsa.test", tsaTrust: { anchorsPem: [] },
        collectNative: async () => { throw new Error("must not run"); }, modelEnvironment: () => ({}),
        env: { [CAPTURE_ENABLED_ENV]: value },
      }, { gameId: 1, slateDate: "2026-11-20", policyId: "pregame-native-v1", codeVersion: "abcdef0" })).rejects.toThrow("disabled");
    }
  });

  it("pins a deterministic calendar revision from the schedule rows", () => {
    const rows = [{ revision: "a".repeat(64) }, { revision: "b".repeat(64) }];
    expect(calendarRevisionOf(rows)).toMatch(/^[0-9a-f]{64}$/);
    expect(calendarRevisionOf(rows)).toBe(calendarRevisionOf([...rows]));
    expect(calendarRevisionOf(rows)).not.toBe(calendarRevisionOf([...rows].reverse()));
  });

  it("posts only the DER request to the TSA and refuses non-reply bodies", async () => {
    const seen: Array<{ method?: string; type: string | null; bytes: number }> = [];
    const ok = httpTsaClient("https://tsa.test/ts", (async (_url: RequestInfo | URL, init?: RequestInit) => {
      seen.push({ method: init?.method, type: new Headers(init?.headers).get("content-type"), bytes: (init?.body as Uint8Array).byteLength });
      return new Response(new Uint8Array([0x30, 0x03, 0x02, 0x01, 0x00]), { headers: { "content-type": "application/timestamp-reply" } });
    }) as typeof fetch);
    await expect(ok.stamp(Buffer.alloc(59, 1), new AbortController().signal)).resolves.toHaveLength(5);
    expect(seen).toEqual([{ method: "POST", type: "application/timestamp-query", bytes: 59 }]);
    const html = httpTsaClient("https://tsa.test/ts", (async () => new Response("<html>", { headers: { "content-type": "text/html" } })) as typeof fetch);
    await expect(html.stamp(Buffer.alloc(59), new AbortController().signal)).rejects.toThrow("tsa_content_type");
    const err = httpTsaClient("https://tsa.test/ts", (async () => new Response("", { status: 503 })) as typeof fetch);
    await expect(err.stamp(Buffer.alloc(59), new AbortController().signal)).rejects.toThrow("tsa_http_503");
  });
});
