import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { fromMock, insertMock, upsertMock } = vi.hoisted(() => ({
  fromMock: vi.fn(), insertMock: vi.fn(), upsertMock: vi.fn(),
}));
vi.mock("lib/supabase/server", () => ({ default: { from: fromMock } }));

import handler from "pages/api/v1/sources/ifttt/DFOFantasy-tweet";

const tweetUrl = "https://x.com/DFOFantasy/status/2109384203557347605?s=20";
const text = '#SeaKraken Lineup @ WSH\nMcMann - Stephenson - Eberle\nOttavainen - Mahura\n🥅: Daccord ✅\n"Original report"';
function req(overrides: Record<string, unknown> = {}) {
  return { method: "POST", headers: { "x-fhfh-ifttt-secret": "unit-dfo-secret" }, query: { process: "false" },
    body: { source: "ifttt", source_account: "DFOFantasy", text, username: "DFOFantasy", link_to_tweet: tweetUrl, created_at: "October 11, 2026 at 05:38PM" },
    ...overrides } as any;
}
function res() {
  return { statusCode: 200, body: null as any, headers: {} as Record<string, unknown>,
    setHeader(key: string, value: unknown) { this.headers[key] = value; return this; },
    status(code: number) { this.statusCode = code; return this; },
    json(body: unknown) { this.body = body; return this; } } as any;
}

describe("DFOFantasy IFTTT receiver", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("IFTTT_DFOFANTASY_WEBHOOK_SECRET", "unit-dfo-secret");
    vi.stubEnv("STARTER_BOARD_CAPTURE_ENABLED", "false");
    vi.stubEnv("STARTER_BOARD_WORKER_ORIGIN", "https://processor.example");
    vi.stubEnv("CRON_SECRET", "unit-processor-secret");
    fromMock.mockReturnValue({ upsert: upsertMock, insert: insertMock });
    upsertMock.mockResolvedValue({ error: null });
    insertMock.mockResolvedValue({ error: null });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("{}", { status: 200 })));
  });
  afterEach(() => { vi.useRealTimers(); vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

  it("accepts the supplied resolved payload and keeps exact original evidence and DFO assignment", async () => {
    const request = req(); const response = res();
    await handler(request, response);
    expect(response.statusCode).toBe(200);
    expect(response.body).toEqual({ success: true, sourceKey: "dfofantasy", tweetId: "2109384203557347605", processingStatus: "pending" });
    expect(fromMock).toHaveBeenCalledWith("line_source_ifttt_events");
    expect(upsertMock).toHaveBeenCalledWith(expect.objectContaining({ source: "ifttt", source_group: "dfo", source_key: "dfofantasy",
      source_account: "DFOFantasy", username: "DFOFantasy", text, link_to_tweet: tweetUrl, tweet_id: "2109384203557347605",
      tweet_created_at: "2026-10-11T21:38:00.000Z", created_at_label: request.body.created_at,
      raw_payload: request.body, processing_status: "pending" }), { onConflict: "source_key,tweet_id", ignoreDuplicates: true });
    expect(fetch).not.toHaveBeenCalled();
  });
  it.each([{}, { "x-fhfh-ifttt-secret": "wrong" }])("rejects missing or invalid authentication before account validation", async (headers) => {
    const response = res();
    await handler(req({ headers, body: { source_account: "OtherAccount", text } }), response);
    expect(response.statusCode).toBe(401);
    expect(fromMock).not.toHaveBeenCalled(); expect(fetch).not.toHaveBeenCalled();
  });
  it("fails closed if its existing secret is not configured", async () => {
    vi.stubEnv("IFTTT_DFOFANTASY_WEBHOOK_SECRET", "");
    const response = res(); await handler(req(), response);
    expect(response.statusCode).toBe(500); expect(fromMock).not.toHaveBeenCalled();
  });
  it("permits POST only", async () => {
    const response = res(); await handler(req({ method: "GET" }), response);
    expect(response.statusCode).toBe(405); expect(response.headers.Allow).toBe("POST"); expect(fromMock).not.toHaveBeenCalled();
  });
  it("accepts supported body aliases and preserves the submitted account spelling", async () => {
    const response = res();
    await handler(req({ body: { sourceAccount: "@dfofantasy", Text: text, UserName: "DFOFantasy", LinkToTweet: tweetUrl, CreatedAt: "2026-10-11T21:38:29Z" } }), response);
    expect(response.statusCode).toBe(200);
    expect(upsertMock.mock.calls[0][0]).toMatchObject({ source_account: "@dfofantasy", username: "DFOFantasy", text, link_to_tweet: tweetUrl, tweet_created_at: "2026-10-11T21:38:29.000Z" });
  });
  it("rejects another source account after valid authentication", async () => {
    const response = res(); await handler(req({ body: { ...req().body, source_account: "GameDayLines" } }), response);
    expect(response.statusCode).toBe(400); expect(fromMock).not.toHaveBeenCalled(); expect(fetch).not.toHaveBeenCalled();
  });
  it("keeps duplicate source/tweet delivery in one modeled event without rewriting the first receipt", async () => {
    const stored = new Map<string, unknown>();
    upsertMock.mockImplementation(async (row, options) => {
      expect(options).toEqual({ onConflict: "source_key,tweet_id", ignoreDuplicates: true });
      const key = `${row.source_key}:${row.tweet_id}`; if (!stored.has(key)) stored.set(key, row);
      return { error: null };
    });
    await handler(req(), res());
    await handler(req({ body: { ...req().body, text: "later duplicate text" } }), res());
    expect(stored.size).toBe(1); expect([...stored.values()][0]).toMatchObject({ text });
    expect(insertMock).not.toHaveBeenCalled();
  });
  it("process=true dispatches exactly this tweet/source on the current Eastern slate", async () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date("2026-10-12T02:00:00Z"));
    const response = res(); await handler(req({ query: { process: "true" }, headers: { "x-fhfh-ifttt-secret": "unit-dfo-secret", host: "untrusted.example" } }), response);
    expect(fetch).toHaveBeenCalledOnce();
    const [rawUrl, options] = vi.mocked(fetch).mock.calls[0]; const url = new URL(String(rawUrl));
    expect(url.origin).toBe("https://processor.example"); expect(url.pathname).toBe("/api/v1/db/update-line-sources");
    expect(Object.fromEntries(url.searchParams)).toMatchObject({ limit: "1", reprocess: "false", tweetId: "2109384203557347605", sourceKey: "dfofantasy", sourceGroup: "dfo", date: "2026-10-11" });
    expect(options).toMatchObject({ method: "POST", redirect: "error", signal: expect.any(AbortSignal) });
    expect(response.body).toMatchObject({ processingStatus: "processed_attempted", processor: { success: true, status: 200 } });
  });
  it("retains pending evidence if processor follow-up fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("failed", { status: 503 })));
    const response = res(); await handler(req({ query: { process: "true" } }), response);
    expect(upsertMock.mock.calls[0][0]).toMatchObject({ processing_status: "pending" });
    expect(response.body).toMatchObject({ success: true, processor: { success: false, status: 503 } });
  });
  it.each(["<<<lineup>>>", "&lt;&lt;&lt;lineup&gt;&gt;&gt;"])("keeps literal wrappers %s as evidence rather than claiming provider expansion", async (wrappedText) => {
    const response = res(); await handler(req({ body: { ...req().body, text: wrappedText, created_at: "<<<October 11, 2026 at 05:38PM>>>" } }), response);
    expect(upsertMock.mock.calls[0][0]).toMatchObject({ text: wrappedText, tweet_created_at: null, created_at_label: "<<<October 11, 2026 at 05:38PM>>>" });
  });
  it("stores text-only evidence without claiming tweet-ID deduplication", async () => {
    await handler(req({ body: { source_account: "DFOFantasy", text } }), res());
    expect(insertMock).toHaveBeenCalledWith(expect.objectContaining({ source_key: "dfofantasy", tweet_id: null, text }));
    expect(upsertMock).not.toHaveBeenCalled();
  });
  it("preserves the exact supplied literal template fields without inventing an original URL/time", async () => {
    const body = { source: "ifttt", source_account: "DFOFantasy", text: "&lt;&lt;&lt;{{Text}}&gt;&gt;&gt;", username: "&lt;&lt;&lt;{{UserName}}&gt;&gt;&gt;", link_to_tweet: "&lt;&lt;&lt;{{LinkToTweet}}&gt;&gt;&gt;", created_at: "&lt;&lt;&lt;{{CreatedAt}}&gt;&gt;&gt;" };
    await handler(req({ body, query: { process: "true" } }), res());
    expect(insertMock).toHaveBeenCalledWith(expect.objectContaining({ source_account: "DFOFantasy", text: body.text, username: body.username, link_to_tweet: body.link_to_tweet, created_at_label: body.created_at, tweet_id: null, tweet_created_at: null, raw_payload: body }));
    expect(fetch).not.toHaveBeenCalled();
  });
});
