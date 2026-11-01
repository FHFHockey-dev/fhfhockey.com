import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";

const { fromMock, upsertMock, updateMock, eqMock, isMock } = vi.hoisted(() => ({ fromMock: vi.fn(), upsertMock: vi.fn(), updateMock: vi.fn(), eqMock: vi.fn(), isMock: vi.fn() }));
vi.mock("lib/supabase/server", () => ({ default: { from: fromMock } }));

import handler from "pages/api/v1/sources/ifttt/FHFHockey-post";

const link = "https://x.com/FHFHockey/status/2109384203557347605";
const alt = 'FHFH Start/Sit, 2026-11-01 to 2026-11-02, search "tor". Line one\nLine two';
const body = { source_account: "FHFHockey", username: "FHFHockey", text: "Tonight's goalies", alt_text: alt, link_to_tweet: link, created_at: "2026-11-01T21:38:00-05:00", media_type: "photo" };
function req(overrides: Record<string, unknown> = {}) {
  return { method: "POST", headers: { "x-fhfh-ifttt-secret": "unit-fhfh-secret" }, query: {}, body, ...overrides } as any;
}
function res() {
  return { statusCode: 200, body: null as any, headers: {} as Record<string, unknown>,
    setHeader(key: string, value: unknown) { this.headers[key] = value; return this; },
    status(code: number) { this.statusCode = code; return this; },
    json(payload: unknown) { this.body = payload; return this; } } as any;
}

describe("FHFHockey IFTTT post receiver", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("IFTTT_FHFHOCKEY_WEBHOOK_SECRET", "unit-fhfh-secret");
    fromMock.mockReturnValue({ upsert: upsertMock, update: updateMock });
    updateMock.mockReturnValue({ eq: eqMock });
    eqMock.mockReturnValue({ is: isMock });
    isMock.mockResolvedValue({ error: null });
    upsertMock.mockResolvedValue({ error: null });
  });
  afterEach(() => { vi.useRealTimers(); vi.unstubAllEnvs(); });

  it("stores the link, id, time, text, alt text and matched card", async () => {
    const response = res();
    await handler(req(), response);
    expect(response.statusCode).toBe(200);
    expect(response.body).toEqual({ success: true, tweetId: "2109384203557347605", matchedCard: "start-sit" });
    expect(fromMock).toHaveBeenCalledWith("social_share_x_posts");
    expect(upsertMock).toHaveBeenCalledWith({
      tweet_id: "2109384203557347605", post_link: link, username: "FHFHockey", posted_at: "2026-11-02T02:38:00.000Z",
      created_at_label: body.created_at, post_text: "Tonight's goalies", alt_text: alt, matched_card: "start-sit", raw_payload: body,
    }, { onConflict: "tweet_id", ignoreDuplicates: true });
  });

  it.each([{}, { "x-fhfh-ifttt-secret": "wrong" }])("rejects missing or wrong authentication before reading the post", async (headers) => {
    const response = res();
    await handler(req({ headers, body: { username: "OtherAccount" } }), response);
    expect(response.statusCode).toBe(401);
    expect(fromMock).not.toHaveBeenCalled();
  });

  it("uses the shared secret when the route has none, and its own secret when it does", async () => {
    vi.stubEnv("IFTTT_FHFHOCKEY_WEBHOOK_SECRET", "");
    vi.stubEnv("X_FHFH_IFTTT_SECRET", "unit-shared-secret");
    const shared = res();
    await handler(req({ headers: { "x-fhfh-ifttt-secret": "unit-shared-secret" } }), shared);
    expect(shared.statusCode).toBe(200);

    vi.stubEnv("IFTTT_FHFHOCKEY_WEBHOOK_SECRET", "unit-fhfh-secret");
    const notOwn = res();
    await handler(req({ headers: { "x-fhfh-ifttt-secret": "unit-shared-secret" } }), notOwn);
    expect(notOwn.statusCode).toBe(401);
  });

  it("fails closed if the secret is not configured, naming the variable and not a value", async () => {
    vi.stubEnv("IFTTT_FHFHOCKEY_WEBHOOK_SECRET", "");
    vi.stubEnv("X_FHFH_IFTTT_SECRET", "");
    const response = res();
    await handler(req(), response);
    expect(response.statusCode).toBe(500);
    expect(JSON.stringify(response.body)).not.toContain("unit-fhfh-secret");
    expect(fromMock).not.toHaveBeenCalled();
  });

  it("permits POST only", async () => {
    const response = res();
    await handler(req({ method: "GET" }), response);
    expect(response.statusCode).toBe(405);
    expect(response.headers.Allow).toBe("POST");
    expect(fromMock).not.toHaveBeenCalled();
  });

  it("rejects another account after valid authentication", async () => {
    const response = res();
    await handler(req({ body: { ...body, username: "GameDayLines" } }), response);
    expect(response.statusCode).toBe(400);
    expect(fromMock).not.toHaveBeenCalled();
  });

  it.each(["{{LinkToTweet}}", "https://x.com/FHFHockey", undefined])("rejects %s, which has no post id", async (link_to_tweet) => {
    const response = res();
    await handler(req({ body: { ...body, link_to_tweet } }), response);
    expect(response.statusCode).toBe(400);
    expect(fromMock).not.toHaveBeenCalled();
  });

  it("keeps one row for a post delivered twice, and the first delivery wins", async () => {
    const stored = new Map<string, any>();
    upsertMock.mockImplementation(async (row, options) => {
      expect(options).toEqual({ onConflict: "tweet_id", ignoreDuplicates: true });
      if (!stored.has(row.tweet_id)) stored.set(row.tweet_id, row);
      return { error: null };
    });
    const repeat = res();
    await handler(req(), res());
    await handler(req({ body: { ...body, alt_text: "FHFH Role Watch, TOI per game." } }), repeat);
    expect(repeat.statusCode).toBe(200);
    expect(stored.size).toBe(1);
    expect([...stored.values()][0]).toMatchObject({ alt_text: alt, matched_card: "start-sit" });
  });

  it("stores a post with no recognisable alt text as unmatched", async () => {
    const response = res();
    const { alt_text: _omitted, ...noAlt } = body;
    await handler(req({ body: noAlt }), response);
    expect(response.statusCode).toBe(200);
    expect(response.body.matchedCard).toBeNull();
    expect(upsertMock.mock.calls[0][0]).toMatchObject({ alt_text: null, matched_card: null });
  });

  it("reads IFTTT's written date as New York time", async () => {
    await handler(req({ body: { ...body, created_at: "November 1, 2026 at 11:30PM" } }), res());
    expect(upsertMock.mock.calls[0][0].posted_at).toBe("2026-11-02T04:30:00.000Z");
  });

  it.each([["{{CreatedAt}}"], [undefined], ["not a date"]])("a date of %s stays unknown, never the receipt time, and changes no earlier row", async (created_at) => {
    vi.useFakeTimers(); vi.setSystemTime(new Date("2026-11-02T12:00:00Z"));
    const response = res();
    await handler(req({ body: { ...body, created_at } }), response);
    expect(response.statusCode).toBe(200);
    expect(upsertMock.mock.calls[0][0]).toMatchObject({ posted_at: null, created_at_label: created_at === "not a date" ? created_at : null });
    expect(updateMock).not.toHaveBeenCalled();
  });

  it("a later delivery with a real date fills in an unknown one, and only an unknown one", async () => {
    await handler(req(), res());
    expect(updateMock).toHaveBeenCalledWith({ posted_at: "2026-11-02T02:38:00.000Z", created_at_label: body.created_at });
    expect(eqMock).toHaveBeenCalledWith("tweet_id", "2109384203557347605");
    expect(isMock).toHaveBeenCalledWith("posted_at", null);
  });

  it("answers 500 when filling in a date fails", async () => {
    isMock.mockResolvedValue({ error: { code: "42501" } });
    const quiet = vi.spyOn(console, "error").mockImplementation(() => {});
    const response = res();
    await handler(req(), response);
    expect(response.statusCode).toBe(500);
    quiet.mockRestore();
  });

  it.each([
    ["another account's link with no username", { username: undefined, source_account: "GameDayLines", link_to_tweet: "https://x.com/GameDayLines/status/789" }],
    ["another account's link, under FHFHockey's name", { link_to_tweet: "https://x.com/GameDayLines/status/789" }],
    ["FHFHockey's link under another username", { username: "GameDayLines" }],
    ["FHFHockey's link under another source account", { source_account: "GameDayLines" }],
    ["an author-less link with no username", { username: undefined, link_to_tweet: "https://x.com/i/web/status/789" }],
  ])("rejects %s", async (_name, change) => {
    const response = res();
    await handler(req({ body: { ...body, ...change } }), response);
    expect(response.statusCode).toBe(400);
    expect(fromMock).not.toHaveBeenCalled();
  });

  it.each([
    "https://example.invalid/status/789", "https://x.com.example.invalid/FHFHockey/status/789", "https://example.invalid/?u=https://x.com/FHFHockey/status/789",
    "ftp://x.com/FHFHockey/status/789", "https://x.com/FHFHockey/status/abc", "https://x.com/FHFHockey/likes/789", "see https://x.com/FHFHockey/status/789",
  ])("rejects %s, which is not a post link", async (link_to_tweet) => {
    const response = res();
    await handler(req({ body: { ...body, link_to_tweet } }), response);
    expect(response.statusCode).toBe(400);
    expect(fromMock).not.toHaveBeenCalled();
  });

  it.each([
    ["https://x.com/FHFHockey/status/789?s=20", "FHFHockey"], ["https://twitter.com/fhfhockey/status/789", undefined], ["http://www.twitter.com/FHFHockey/statuses/789", undefined],
    ["https://x.com/FHFHockey/status/789/photo/1", undefined], ["https://mobile.x.com/FHFHockey/status/789", undefined], ["https://x.com/i/web/status/789", "@fhfhockey"],
  ])("accepts %s with username %s", async (link_to_tweet, username) => {
    const response = res();
    await handler(req({ body: { ...body, link_to_tweet, username } }), response);
    expect(response.statusCode).toBe(200);
    expect(upsertMock.mock.calls[0][0].tweet_id).toBe("789");
  });

  it("takes TJ's exact applet body, with every field wrapped and IFTTT's written date", async () => {
    const exact = { source: "ifttt", source_account: "FHFHockey", text: "<<<Tonight's goalies>>>", alt_text: "<<<FHFH Start/Sit, 2010-08-23 to 2010-08-24>>>", username: "<<<FHFHockey>>>", link_to_tweet: "<<<https://x.com/FHFHockey/status/789>>>", created_at: "<<<August 23, 2010 at 11:01PM>>>", media_type: "<<<photo>>>" };
    const response = res();
    await handler(req({ body: exact }), response);
    expect(response.statusCode).toBe(200);
    expect(response.body).toEqual({ success: true, tweetId: "789", matchedCard: "start-sit" });
    expect(upsertMock.mock.calls[0][0]).toMatchObject({ tweet_id: "789", post_link: "https://x.com/FHFHockey/status/789", username: "FHFHockey", posted_at: "2010-08-24T03:01:00.000Z", created_at_label: "August 23, 2010 at 11:01PM", post_text: "Tonight's goalies", alt_text: exact.alt_text.slice(3, -3), raw_payload: exact });
  });

  it("takes the same body unwrapped, HTML-escaped, or URL-encoded", async () => {
    for (const [link_to_tweet, created_at, alt_text] of [
      ["https://x.com/FHFHockey/status/789", "August 23, 2010 at 11:01PM", "FHFH Role Watch, TOI."],
      ["&lt;&lt;&lt;https://x.com/FHFHockey/status/789&gt;&gt;&gt;", "&lt;&lt;&lt;August 23, 2010 at 11:01PM&gt;&gt;&gt;", "&lt;&lt;&lt;FHFH Role Watch, TOI.&gt;&gt;&gt;"],
      ["<<<https%3A%2F%2Fx.com%2FFHFHockey%2Fstatus%2F789>>>", "<<<August%2023%2C%202010%20at%2011%3A01PM>>>", "<<<FHFH%20Role%20Watch%2C%20TOI.>>>"],
    ]) {
      upsertMock.mockClear();
      const response = res();
      await handler(req({ body: { source: "ifttt", source_account: "FHFHockey", username: "FHFHockey", link_to_tweet, created_at, alt_text } }), response);
      expect(response.statusCode, link_to_tweet).toBe(200);
      expect(upsertMock.mock.calls[0][0], link_to_tweet).toMatchObject({ tweet_id: "789", posted_at: "2010-08-24T03:01:00.000Z", matched_card: "role-watch" });
    }
  });

  it.each(["{{source_account}}", "<<<{{SourceAccount}}>>>", "&lt;&lt;&lt;{{source_account}}&gt;&gt;&gt;", "   ", ""])("an unresolved or empty source account of %j is absent, not a conflict", async (source_account) => {
    const response = res();
    await handler(req({ body: { ...body, source_account, link_to_tweet: "https://x.com/FHFHockey/status/789" } }), response);
    expect(response.statusCode).toBe(200);
  });

  it.each(["{{UserName}}", "<<<{{UserName}}>>>", ""])("an unresolved or empty username of %j is absent, and the link's author is enough", async (username) => {
    const response = res();
    await handler(req({ body: { ...body, username, link_to_tweet: "https://x.com/FHFHockey/status/789" } }), response);
    expect(response.statusCode).toBe(200);
    expect(upsertMock.mock.calls[0][0].username).toBeNull();
  });

  it("an unresolved username proves nothing for a link that names no author", async () => {
    const response = res();
    await handler(req({ body: { ...body, username: "{{UserName}}", link_to_tweet: "https://x.com/i/web/status/789" } }), response);
    expect(response.statusCode).toBe(400);
  });

  it.each([{ source_account: "<<<GameDayLines>>>" }, { username: "<<<GameDayLines>>>" }, { source_account: "GameDayLines" }])("still rejects an explicit conflict: %j", async (change) => {
    const response = res();
    await handler(req({ body: { ...body, ...change } }), response);
    expect(response.statusCode).toBe(400);
    expect(fromMock).not.toHaveBeenCalled();
  });

  it("answers 500 when the table cannot be written, without echoing the database error", async () => {
    upsertMock.mockResolvedValue({ error: { code: "42P01", message: "relation does not exist" } });
    const quiet = vi.spyOn(console, "error").mockImplementation(() => {});
    const response = res();
    await handler(req(), response);
    expect(response.statusCode).toBe(500);
    expect(JSON.stringify(response.body)).not.toContain("relation");
    quiet.mockRestore();
  });
});
