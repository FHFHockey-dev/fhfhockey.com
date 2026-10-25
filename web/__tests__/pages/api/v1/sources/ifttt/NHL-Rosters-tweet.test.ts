import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { fromMock, insertMock, upsertMock } = vi.hoisted(() => ({ fromMock: vi.fn(), insertMock: vi.fn(), upsertMock: vi.fn() }));
vi.mock("lib/supabase/server", () => ({ default: { from: fromMock } }));
import handler from "pages/api/v1/sources/ifttt/NHL-Rosters-tweet";

const url = "https://x.com/NHL_Rosters/status/2109384203557347606";
const text = 'Transaction report\n"Original text"';
function req(overrides: Record<string, unknown> = {}) {
  return { method: "POST", headers: { "x-fhfh-ifttt-secret": "unit-nhl-secret" }, query: { process: "false" },
    body: { source: "ifttt", source_account: "NHL_Rosters", text, username: "NHL_Rosters", link_to_tweet: url, created_at: "October 11, 2026 at 05:38PM" }, ...overrides } as any;
}
function res() {
  return { statusCode: 200, body: null as any, headers: {} as Record<string, unknown>,
    setHeader(key: string, value: unknown) { this.headers[key] = value; return this; },
    status(code: number) { this.statusCode = code; return this; }, json(body: unknown) { this.body = body; return this; } } as any;
}

describe("NHL-Rosters exact IFTTT endpoint", () => {
  beforeEach(() => {
    vi.clearAllMocks(); vi.stubEnv("IFTTT_NHL_ROSTERS_WEBHOOK_SECRET", "unit-nhl-secret");
    vi.stubEnv("STARTER_BOARD_CAPTURE_ENABLED", "false"); vi.stubEnv("STARTER_BOARD_WORKER_ORIGIN", "https://processor.example");
    fromMock.mockReturnValue({ insert: insertMock, upsert: upsertMock });
    upsertMock.mockResolvedValue({ error: null }); insertMock.mockResolvedValue({ error: null });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("{}", { status: 200 })));
  });
  afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

  it("retains all delivered text and the underscore account with exact source assignment", async () => {
    const request = req(); const response = res(); await handler(request, response);
    expect(response.statusCode).toBe(200); expect(fromMock).toHaveBeenCalledWith("line_source_ifttt_events");
    expect(upsertMock).toHaveBeenCalledWith(expect.objectContaining({ source: "ifttt", source_group: "nhl_rosters", source_key: "nhl_rosters",
      source_account: "NHL_Rosters", text, username: "NHL_Rosters", link_to_tweet: url, tweet_id: "2109384203557347606",
      created_at_label: request.body.created_at, tweet_created_at: "2026-10-11T21:38:00.000Z", raw_payload: request.body }),
      { onConflict: "source_key,tweet_id", ignoreDuplicates: true });
    expect(fetch).not.toHaveBeenCalled();
  });
  it.each([{}, { "x-fhfh-ifttt-secret": "wrong" }])("rejects missing/invalid auth before account or storage", async (headers) => {
    const response = res(); await handler(req({ headers, body: { source_account: "NHL-Rosters", text } }), response);
    expect(response.statusCode).toBe(401); expect(fromMock).not.toHaveBeenCalled();
  });
  it("does not equate the hyphenated route with a hyphenated source account", async () => {
    const response = res(); await handler(req({ body: { ...req().body, source_account: "NHL-Rosters" } }), response);
    expect(response.statusCode).toBe(400); expect(fromMock).not.toHaveBeenCalled();
  });
  it("recognizes the existing field aliases without replacing account or author", async () => {
    await handler(req({ body: { sourceAccount: "@NHL_Rosters", Text: text, UserName: "NHL_Rosters", linkToTweet: url, createdAt: "2026-10-11T21:38:29Z" } }), res());
    expect(upsertMock.mock.calls[0][0]).toMatchObject({ source_account: "@NHL_Rosters", username: "NHL_Rosters", text, link_to_tweet: url, tweet_created_at: "2026-10-11T21:38:29.000Z" });
  });
  it("uses duplicate-ignore and preserves one modeled original event", async () => {
    const stored = new Map<string, unknown>();
    upsertMock.mockImplementation(async (row, options) => { expect(options.ignoreDuplicates).toBe(true); const key = `${row.source_key}:${row.tweet_id}`; if (!stored.has(key)) stored.set(key, row); return { error: null }; });
    await handler(req(), res()); await handler(req({ body: { ...req().body, text: "changed duplicate" } }), res());
    expect(stored.size).toBe(1); expect([...stored.values()][0]).toMatchObject({ text });
  });
  it("process=true selects the NHL source and exact original tweet only", async () => {
    const response = res(); await handler(req({ query: { process: "true" } }), response);
    expect(fetch).toHaveBeenCalledOnce(); const target = new URL(String(vi.mocked(fetch).mock.calls[0][0]));
    expect(target.pathname).toBe("/api/v1/db/update-line-sources");
    expect(Object.fromEntries(target.searchParams)).toMatchObject({ sourceKey: "nhl_rosters", sourceGroup: "nhl_rosters", tweetId: "2109384203557347606", limit: "1", reprocess: "false" });
    expect(response.body).toMatchObject({ sourceKey: "nhl_rosters", processingStatus: "processed_attempted" });
  });
  it("preserves literal supplied template fields as raw evidence rather than fabricated original values", async () => {
    const body = { source: "ifttt", source_account: "NHL_Rosters", text: "&lt;&lt;&lt;{{Text}}&gt;&gt;&gt;", username: "&lt;&lt;&lt;{{UserName}}&gt;&gt;&gt;", link_to_tweet: "&lt;&lt;&lt;{{LinkToTweet}}&gt;&gt;&gt;", created_at: "&lt;&lt;&lt;{{CreatedAt}}&gt;&gt;&gt;" };
    await handler(req({ body, query: { process: "true" } }), res());
    expect(insertMock).toHaveBeenCalledWith(expect.objectContaining({ source_account: "NHL_Rosters", text: body.text, username: body.username, link_to_tweet: body.link_to_tweet, created_at_label: body.created_at, tweet_id: null, tweet_created_at: null, raw_payload: body }));
    expect(fetch).not.toHaveBeenCalled();
  });
  it("fails closed on missing config and on non-POST method", async () => {
    vi.stubEnv("IFTTT_NHL_ROSTERS_WEBHOOK_SECRET", "");
    const missing = res(); await handler(req(), missing); expect(missing.statusCode).toBe(500);
    const get = res(); await handler(req({ method: "GET" }), get); expect(get.statusCode).toBe(405); expect(get.headers.Allow).toBe("POST"); expect(fromMock).not.toHaveBeenCalled();
  });
});
