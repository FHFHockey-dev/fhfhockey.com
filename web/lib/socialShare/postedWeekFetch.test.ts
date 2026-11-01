// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const { getSession } = vi.hoisted(() => ({ getSession: vi.fn() }));
vi.mock("lib/supabase/client", () => ({ default: { auth: { getSession } } }));

import { fetchPostedWeek } from "./postedWeekFetch";

const answer = { available: true, week: "2026-11-02", days: [], cards: [] };
const json = (body: unknown, status = 200) => vi.fn().mockResolvedValue(new Response(JSON.stringify(body), { status }));

describe("fetchPostedWeek", () => {
  beforeEach(() => getSession.mockResolvedValue({ data: { session: { access_token: "unit-token" } } }));

  it("asks with the editor's token and returns the source's answer", async () => {
    const fetcher = json(answer);
    await expect(fetchPostedWeek(fetcher)).resolves.toEqual(answer);
    expect(fetcher.mock.calls[0][0]).toBe("/api/v1/social-share/posted-week");
    expect(fetcher.mock.calls[0][1]).toMatchObject({ cache: "no-store", credentials: "omit", headers: { Authorization: "Bearer unit-token" } });
  });

  it("a source with no dated posts passes on its undated count", async () => {
    await expect(fetchPostedWeek(json({ available: false, undated: 2 }))).resolves.toEqual({ available: false, undated: 2 });
    await expect(fetchPostedWeek(json({ available: false }))).resolves.toEqual({ available: false, undated: 0 });
  });

  it.each([
    ["a failed read", json({ error: "x" }, 503)],
    ["a refused read", json({ error: "x" }, 403)],
    ["a malformed answer", json({ available: true })],
    ["a network failure", vi.fn().mockRejectedValue(new Error("down"))],
  ])("reports %s as failed", async (_name, fetcher) => {
    await expect(fetchPostedWeek(fetcher)).resolves.toBe("failed");
  });

  it("falls back with no session, without asking", async () => {
    getSession.mockResolvedValue({ data: { session: null } });
    const fetcher = json(answer);
    await expect(fetchPostedWeek(fetcher)).resolves.toBeNull();
    expect(fetcher).not.toHaveBeenCalled();
  });
});
