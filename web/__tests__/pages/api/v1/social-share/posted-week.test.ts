import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { access, from } = vi.hoisted(() => ({ access: vi.fn(), from: vi.fn() }));
vi.mock("lib/socialShare/access", () => ({ requireSocialShareAccess: access, SOCIAL_SHARE_CACHE_CONTROL: "private, no-store, max-age=0" }));
vi.mock("lib/supabase/server", () => ({ default: { from } }));

import handler from "pages/api/v1/social-share/posted-week";

function res() {
  return { statusCode: 200, body: null as any, headers: {} as Record<string, unknown>,
    setHeader(key: string, value: unknown) { this.headers[key] = value; return this; },
    status(code: number) { this.statusCode = code; return this; },
    json(payload: unknown) { this.body = payload; return this; } } as any;
}

// Answers the three reads by shape: the ranged week read, then oldest and newest by sort direction.
function table({ week = [], oldest = [], newest = [], error = null }: { week?: unknown[]; oldest?: unknown[]; newest?: unknown[]; error?: unknown }) {
  const ranges: unknown[][] = [];
  from.mockImplementation(() => {
    const query: any = {
      select: () => query,
      gte: (...args: unknown[]) => { ranges.push(args); return query; },
      lt: (...args: unknown[]) => { ranges.push(args); return query; },
      order: (_column: string, options?: { ascending: boolean }) => { query.descending = options?.ascending === false; return query; },
      limit: () => Promise.resolve({ error, data: ranges.length && !query.done ? (query.done = true, week) : query.descending ? newest : oldest }),
    };
    return query;
  });
  return ranges;
}

describe("posted-week", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-11-04T16:00:00Z"));
    access.mockResolvedValue({ userId: "unit", role: "social_editor" });
  });
  afterEach(() => vi.useRealTimers());

  it("answers Mon to Sun for this New York week, privately", async () => {
    const ranges = table({ week: [{ posted_at: "2026-11-02T16:00:00Z", matched_card: "game-grid" }], oldest: [{ posted_at: "2026-10-01T16:00:00Z" }], newest: [{ posted_at: "2026-11-02T16:00:00Z" }] });
    const response = res();
    await handler({ method: "GET", headers: {}, query: {} } as any, response);
    expect(response.statusCode).toBe(200);
    expect(response.headers["Cache-Control"]).toBe("private, no-store, max-age=0");
    expect(from).toHaveBeenCalledWith("social_share_x_posts");
    expect(ranges).toEqual([["posted_at", "2026-11-02T05:00:00.000Z"], ["posted_at", "2026-11-09T05:00:00.000Z"]]);
    expect(response.body).toMatchObject({ available: true, week: "2026-11-02", today: "wed", latest: "2026-11-02T16:00:00Z", cards: [{ card: "game-grid", name: "Game Grid", count: 1 }] });
    expect(response.body.days.map((day: { status: string }) => day.status)).toEqual(["done", "missed", "notYet", "upcoming", "upcoming", "upcoming", "upcoming"]);
  });

  it("reads nothing unless the editor check passes", async () => {
    access.mockResolvedValue(null);
    await handler({ method: "GET", headers: {}, query: {} } as any, res());
    expect(from).not.toHaveBeenCalled();
  });

  it("permits GET only", async () => {
    const response = res();
    await handler({ method: "POST", headers: {}, query: {} } as any, response);
    expect(response.statusCode).toBe(405);
    expect(access).not.toHaveBeenCalled();
  });

  it("reports unavailable with no posts on record, never a week of misses", async () => {
    table({});
    const response = res();
    await handler({ method: "GET", headers: {}, query: {} } as any, response);
    expect(response.statusCode).toBe(200);
    expect(response.body).toEqual({ available: false });
  });

  it("answers 503 when the table is missing, without echoing the database error", async () => {
    table({ error: { code: "42P01", message: "relation does not exist" } });
    const response = res();
    await handler({ method: "GET", headers: {}, query: {} } as any, response);
    expect(response.statusCode).toBe(503);
    expect(JSON.stringify(response.body)).not.toContain("relation");
  });
});
