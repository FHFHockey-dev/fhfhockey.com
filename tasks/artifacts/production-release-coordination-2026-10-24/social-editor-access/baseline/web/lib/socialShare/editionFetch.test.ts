import { describe, expect, it, vi } from "vitest";
import { fetchEdition } from "./editionFetch";
import { editionLabel } from "./edition";

const reply = (body: unknown, status = 200) => ({ ok: status < 400, status, json: async () => body }) as unknown as Response;

describe("single in-flight edition request", () => {
  it("joins concurrent callers for the same URL and fetches again once settled", async () => {
    let release!: (value: Response) => void;
    const fetcher = vi.fn(() => new Promise<Response>(resolve => { release = resolve; }));
    const first = fetchEdition("/api/v1/social-share/game-grid?weekStart=2026-10-26", fetcher as unknown as typeof fetch);
    const second = fetchEdition("/api/v1/social-share/game-grid?weekStart=2026-10-26", fetcher as unknown as typeof fetch);
    expect(second).toBe(first);
    expect(fetcher).toHaveBeenCalledTimes(1);
    release(reply({ state: "ready" }));
    expect(await first).toEqual({ ok: true, status: 200, body: { state: "ready" } });
    const fresh = vi.fn(async () => reply({ state: "ready" }));
    await fetchEdition("/api/v1/social-share/game-grid?weekStart=2026-10-26", fresh as unknown as typeof fetch);
    expect(fresh).toHaveBeenCalledTimes(1);
  });

  it("keeps different editions separate and forgets failed requests", async () => {
    const fetcher = vi.fn(async (url: string) => url.includes("fail") ? Promise.reject(new Error("down")) : reply({ url }));
    const [a, b] = await Promise.all([fetchEdition("/a", fetcher as unknown as typeof fetch), fetchEdition("/b", fetcher as unknown as typeof fetch)]);
    expect([a.body.url, b.body.url]).toEqual(["/a", "/b"]);
    await expect(fetchEdition("/fail", fetcher as unknown as typeof fetch)).rejects.toThrow("down");
    await expect(fetchEdition("/fail", fetcher as unknown as typeof fetch)).rejects.toThrow("down");
    expect(fetcher).toHaveBeenCalledTimes(4);
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
