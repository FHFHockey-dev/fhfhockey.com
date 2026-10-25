import { beforeEach, describe, expect, it, vi } from "vitest";
const auth = vi.hoisted(() => ({ getSession: vi.fn() }));
vi.mock("lib/supabase/client", () => ({ default: { auth } }));
import { fetchEdition } from "./editionFetch";
import { editionLabel } from "./edition";

const reply = (body: unknown, status = 200) => ({ ok: status < 400, status, json: async () => body }) as unknown as Response;
const session = (id = "one", token = "synthetic-token") => ({ user: { id }, access_token: token });
const editionUrl = "/api/v1/social-share/game-grid?weekStart=2026-10-26";
beforeEach(() => { auth.getSession.mockReset(); auth.getSession.mockResolvedValue({ data: { session: session() }, error: null }); });

describe("single in-flight edition request", () => {
  it("joins concurrent callers for the same URL and fetches again once settled", async () => {
    let release!: (value: Response) => void;
    const fetcher = vi.fn(() => new Promise<Response>(resolve => { release = resolve; }));
    const first = fetchEdition("/api/v1/social-share/game-grid?weekStart=2026-10-26", fetcher as unknown as typeof fetch);
    const second = fetchEdition("/api/v1/social-share/game-grid?weekStart=2026-10-26", fetcher as unknown as typeof fetch);
    await vi.waitFor(() => expect(fetcher).toHaveBeenCalledTimes(1));
    expect(fetcher).toHaveBeenCalledWith(editionUrl, { cache: "no-store", credentials: "omit", headers: { Authorization: "Bearer synthetic-token" } });
    release(reply({ state: "ready" }));
    expect(await first).toEqual({ ok: true, status: 200, body: { state: "ready" } });
    expect(await second).toEqual(await first);
    const fresh = vi.fn(async () => reply({ state: "ready" }));
    await fetchEdition("/api/v1/social-share/game-grid?weekStart=2026-10-26", fresh as unknown as typeof fetch);
    expect(fresh).toHaveBeenCalledTimes(1);
  });

  it("keeps different editions separate and forgets failed requests", async () => {
    const fetcher = vi.fn(async (url: string) => url.includes("fail") ? Promise.reject(new Error("down")) : reply({ url }));
    const aUrl = "/api/v1/social-share/game-grid", bUrl = "/api/v1/social-share/remaining-week";
    const [a, b] = await Promise.all([fetchEdition(aUrl, fetcher as unknown as typeof fetch), fetchEdition(bUrl, fetcher as unknown as typeof fetch)]);
    expect([a.body.url, b.body.url]).toEqual([aUrl, bUrl]);
    await expect(fetchEdition(`${aUrl}?weekStart=fail`, fetcher as unknown as typeof fetch)).rejects.toThrow("down");
    await expect(fetchEdition(`${aUrl}?weekStart=fail`, fetcher as unknown as typeof fetch)).rejects.toThrow("down");
    expect(fetcher).toHaveBeenCalledTimes(4);
  });

  it.each([null, { user: { id: "one" } }])("makes no request without a usable session %j", async current => {
    auth.getSession.mockResolvedValue({ data: { session: current }, error: null });
    const fetcher = vi.fn();
    await expect(fetchEdition(editionUrl, fetcher)).rejects.toThrow("Sign in");
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("fails closed on session lookup errors", async () => {
    auth.getSession.mockResolvedValueOnce({ data: { session: session() }, error: new Error("unavailable") });
    const fetcher = vi.fn();
    await expect(fetchEdition(editionUrl, fetcher)).rejects.toThrow("Sign in");
    expect(fetcher).not.toHaveBeenCalled();
  });

  it.each(["https://other.test/api/v1/social-share/game-grid", "//other.test/api/v1/social-share/game-grid", "/api/v1/db/update-players", "/api/v1/social-share/publish", "/api/v1/social-share/game-grid#other", "/api/v1/social-share/game-grid?x=\\other"])("never sends a bearer token to %s", async url => {
    const fetcher = vi.fn();
    await expect(fetchEdition(url, fetcher)).rejects.toThrow("Invalid share studio request");
    expect(fetcher).not.toHaveBeenCalled();
    expect(auth.getSession).not.toHaveBeenCalled();
  });

  it.each([session("two", "other-token"), session("one", "refreshed-token"), null])("does not reuse or expose an old session's pending response: %j", async current => {
    let release!: (value: Response) => void;
    const oldFetcher = vi.fn(() => new Promise<Response>(resolve => { release = resolve; }));
    const old = fetchEdition(editionUrl, oldFetcher as typeof fetch);
    const oldRejected = expect(old).rejects.toThrow("session changed");
    await vi.waitFor(() => expect(oldFetcher).toHaveBeenCalledTimes(1));
    auth.getSession.mockResolvedValue({ data: { session: current }, error: null });
    const nextFetcher = vi.fn(async () => reply({ edition: "new" }));
    if (current) {
      expect((await fetchEdition(editionUrl, nextFetcher)).body).toEqual({ edition: "new" });
      expect(nextFetcher).toHaveBeenCalledTimes(1);
    }
    release(reply({ edition: "old" }));
    await oldRejected;
  });
});

describe("edition eyebrow label", () => {
  const edition = (format: "game-grid" | "remaining-week" | "tuesday-trends" | "player-spotlight", generatedAt: string) => ({ format, generatedAt, weekStart: "2026-10-19", weekEnd: "2026-10-25" });
  it("names the posting day only on that day, otherwise the week context", () => {
    expect(editionLabel(edition("game-grid", "2026-10-19T13:00:00Z"))).toBe("Monday");
    expect(editionLabel(edition("game-grid", "2026-10-24T19:33:24Z"))).toBe("This week");
    expect(editionLabel(edition("tuesday-trends", "2026-10-20T13:00:00Z"))).toBe("Tuesday");
    expect(editionLabel(edition("remaining-week", "2026-10-21T13:00:00Z"))).toBe("Wednesday");
    expect(editionLabel(edition("remaining-week", "2026-10-19T13:00:00Z"))).toBe("This week");
    expect(editionLabel(edition("game-grid", "2026-10-17T20:00:00Z"))).toBe("Week ahead");
    expect(editionLabel(edition("game-grid", "2026-10-27T01:00:00Z"))).toBe("Past week");
    // New York date, not UTC: 03:00Z on Tuesday is still Monday evening.
    expect(editionLabel(edition("game-grid", "2026-10-20T03:00:00Z"))).toBe("Monday");
    expect(editionLabel(edition("player-spotlight", "2026-10-19T13:00:00Z"))).toBe("This week");
  });
});
