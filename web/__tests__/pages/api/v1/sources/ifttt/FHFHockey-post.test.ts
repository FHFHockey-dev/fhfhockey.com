import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";

const { fromMock, upsertMock } = vi.hoisted(() => ({ fromMock: vi.fn(), upsertMock: vi.fn() }));
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
    fromMock.mockReturnValue({ upsert: upsertMock });
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

  it("fails closed if the secret is not configured, naming the variable and not a value", async () => {
    vi.stubEnv("IFTTT_FHFHOCKEY_WEBHOOK_SECRET", "");
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

  it("reads IFTTT's written date as New York time, and falls back to receipt time for an unreadable one", async () => {
    await handler(req({ body: { ...body, created_at: "November 1, 2026 at 11:30PM" } }), res());
    expect(upsertMock.mock.calls[0][0].posted_at).toBe("2026-11-02T04:30:00.000Z");
    vi.useFakeTimers(); vi.setSystemTime(new Date("2026-11-02T12:00:00Z"));
    await handler(req({ body: { ...body, created_at: "{{CreatedAt}}" } }), res());
    expect(upsertMock.mock.calls[1][0]).toMatchObject({ posted_at: "2026-11-02T12:00:00.000Z", created_at_label: "{{CreatedAt}}" });
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
