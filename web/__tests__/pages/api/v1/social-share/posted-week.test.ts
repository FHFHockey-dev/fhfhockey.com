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

// Answers the four reads by shape: the week's range, the oldest dated post, the newest receipt, and the undated count.
function table({ week = [], oldest = [], newest = [], undated = 0, error = null }: { week?: unknown[]; oldest?: unknown[]; newest?: unknown[]; undated?: number; error?: unknown }) {
  const reads = { range: [] as unknown[][], undated: [] as unknown[][], limits: [] as number[] };
  from.mockImplementation(() => {
    let columns = "", options: { head?: boolean } | undefined;
    const query: any = {
      select: (picked: string, picks?: { head?: boolean }) => { columns = picked; options = picks; return query; },
      gte: (...args: unknown[]) => { (options?.head ? reads.undated : reads.range).push(args); return query; },
      lt: (...args: unknown[]) => { reads.range.push(args); return query; },
      is: (...args: unknown[]) => { reads.undated.push(args); return query; },
      not: () => query,
      order: () => query,
      limit: (count: number) => { reads.limits.push(count); return Promise.resolve({ error, data: columns.includes("matched_card") ? week : columns.includes("received_at") ? newest : oldest }); },
      then: (resolve: (value: unknown) => void) => resolve({ error, count: undated }),
    };
    return query;
  });
  return reads;
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
    const reads = table({ week: [{ posted_at: "2026-11-02T16:00:00Z", matched_card: "game-grid" }], oldest: [{ posted_at: "2026-10-01T16:00:00Z" }], newest: [{ posted_at: "2026-11-02T15:50:00Z", received_at: "2026-11-02T16:00:00Z" }], undated: 2 });
    const response = res();
    await handler({ method: "GET", headers: {}, query: {} } as any, response);
    expect(response.statusCode).toBe(200);
    expect(response.headers["Cache-Control"]).toBe("private, no-store, max-age=0");
    expect(from).toHaveBeenCalledWith("social_share_x_posts");
    expect(reads.range).toEqual([["posted_at", "2026-11-02T05:00:00.000Z"], ["posted_at", "2026-11-09T05:00:00.000Z"]]);
    expect(reads.undated).toEqual([["posted_at", null], ["received_at", "2026-11-02T05:00:00.000Z"]]);
    expect(response.body).toMatchObject({ available: true, week: "2026-11-02", today: "wed", latest: "2026-11-02T16:00:00Z", stale: false, undated: 2, cards: [{ card: "game-grid", name: "Game Grid", count: 1 }] });
    expect(response.body.days.map((day: { status: string }) => day.status)).toEqual(["done", "noRecord", "notYet", "upcoming", "upcoming", "upcoming", "upcoming"]);
  });

  it("a backfill's recent receipt does not count as a live delivery", async () => {
    table({ oldest: [{ posted_at: "2026-10-01T16:00:00Z" }], newest: [{ posted_at: "2026-10-01T16:00:00Z", received_at: "2026-11-04T15:00:00Z" }] });
    const response = res();
    await handler({ method: "GET", headers: {}, query: {} } as any, response);
    expect(response.body).toMatchObject({ stale: true, latest: null });
    expect(response.body.days.slice(0, 3).map((day: { status: string }) => day.status)).toEqual(["noRecord", "noRecord", "noRecord"]);
  });

  it("fails visibly past the ceiling, rather than answering with a partial week", async () => {
    const posts = (count: number) => Array.from({ length: count }, () => ({ posted_at: "2026-11-02T16:00:00Z", matched_card: null }));
    const quiet = vi.spyOn(console, "error").mockImplementation(() => {});
    const reads = table({ week: posts(501), oldest: [{ posted_at: "2026-10-01T16:00:00Z" }], newest: [{ posted_at: "2026-11-02T15:50:00Z", received_at: "2026-11-02T16:00:00Z" }] });
    const over = res();
    await handler({ method: "GET", headers: {}, query: {} } as any, over);
    expect(reads.limits).toContain(501);
    expect(over.statusCode).toBe(503);
    expect(over.body).toEqual({ error: "Too many posts this week to show." });
    quiet.mockRestore();

    table({ week: posts(500), oldest: [{ posted_at: "2026-10-01T16:00:00Z" }], newest: [{ posted_at: "2026-11-02T15:50:00Z", received_at: "2026-11-02T16:00:00Z" }] });
    const at = res();
    await handler({ method: "GET", headers: {}, query: {} } as any, at);
    expect(at.statusCode).toBe(200);
    expect(at.body.days[0].posts).toBe(500);
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
    expect(response.body).toEqual({ available: false, undated: 0 });
  });

  it("an all-undated table still reports its count", async () => {
    table({ undated: 3 });
    const response = res();
    await handler({ method: "GET", headers: {}, query: {} } as any, response);
    expect(response.statusCode).toBe(200);
    expect(response.body).toEqual({ available: false, undated: 3 });
  });

  it("answers 503 when the table is missing, without echoing the database error", async () => {
    table({ error: { code: "42P01", message: "relation does not exist" } });
    const response = res();
    await handler({ method: "GET", headers: {}, query: {} } as any, response);
    expect(response.statusCode).toBe(503);
    expect(JSON.stringify(response.body)).not.toContain("relation");
  });
});
