// C7 controls for SS1-15 studio memory: another user never gets the remembered edition; an expired one is refetched; bad URL values fall back.
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { writeFileSync } from "node:fs";
import SocialShare from "components/SocialShare/SocialShare";
import { buildScheduleSnapshot, calendarWeekStart, selectScheduleDates, weekDates } from "lib/socialShare/schedule";
import { fictionalLeagueWeek } from "lib/socialShare/fixtures";
const OUT = process.env.C7_SS1T15UI_OUT; const observed: Record<string, unknown> = {};
afterAll(() => { if (OUT) writeFileSync(OUT, JSON.stringify(observed, null, 2)); });
const h = vi.hoisted(() => ({ user: "editor-a", query: {} as Record<string, string>, replace: (() => Promise.resolve(true)) as any }));
vi.mock("lib/supabase/client", () => ({ default: { auth: { getSession: vi.fn(async () => ({ data: { session: { user: { id: h.user }, access_token: `tok-${h.user}` } }, error: null })) } } }));
vi.mock("next/router", () => ({ useRouter: () => ({ query: h.query, pathname: "/social-share/[format]", isReady: true, replace: h.replace }) }));
vi.mock("contexts/AuthProviderContext", () => ({ useAuth: () => ({ user: { id: h.user } }) }));
const fetchMock = vi.fn(); let expireNext = false;
const api = () => fetchMock.mock.calls.filter(([url]) => String(url).startsWith("/api/v1/social-share/"));
beforeEach(() => { fetchMock.mockReset(); h.user = "editor-a"; h.replace = vi.fn(async () => true); expireNext = false;
  fetchMock.mockImplementation(async (url: string) => { const q = new URL(url, "http://localhost").searchParams, generatedAt = new Date().toISOString();
    const e: any = buildScheduleSnapshot({ format: "game-grid", weekStart: q.get("weekStart")!, generatedAt, schedule: fictionalLeagueWeek(q.get("weekStart")!, generatedAt) });
    const body: any = q.get("selectedDates") ? selectScheduleDates(e, q.get("selectedDates")!.split(",")) : e; if (expireNext) body.expiresAt = new Date(Date.now() - 1000).toISOString();
    return { ok: true, status: 200, json: async () => body } as unknown as Response; });
  vi.stubGlobal("fetch", fetchMock); vi.stubGlobal("ResizeObserver", class { observe() {} disconnect() {} });
  Object.defineProperty(document, "fonts", { configurable: true, value: { load: async () => [], check: () => false } }); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
const week = () => calendarWeekStart(new Date(Date.now() + 7 * 86400000).toISOString());

describe("C7 SS1-15 studio memory", () => {
  it("M1 a different signed-in user refetches instead of reusing editor-a's edition", async () => {
    const w = week(); h.query = { format: "game-grid", week: w, dates: weekDates(w).slice(1, 3).join(","), card: "grid" };
    const a = render(<SocialShare format="game-grid" asOf={new Date().toISOString()} />); await waitFor(() => expect(api()).toHaveLength(1)); a.unmount();
    h.user = "editor-b"; render(<SocialShare format="game-grid" asOf={new Date().toISOString()} />); await waitFor(() => expect(api().length).toBeGreaterThanOrEqual(2));
    observed.M1 = { calls: api().map(([u, o]: any) => [String(u), o?.headers?.Authorization]) };
    expect(api()[1][1].headers.Authorization).toBe("Bearer tok-editor-b");
  });
  it("M2 an expired remembered edition is refetched on remount", async () => {
    const w = week(); h.user = "editor-c"; h.query = { format: "game-grid", week: w, card: "grid" }; expireNext = true;
    const a = render(<SocialShare format="game-grid" asOf={new Date().toISOString()} />); await waitFor(() => expect(api()).toHaveLength(1)); a.unmount();
    expireNext = false; render(<SocialShare format="game-grid" asOf={new Date().toISOString()} />); await waitFor(() => expect(api()).toHaveLength(2));
    observed.M2 = { calls: api().length };
  });
  it("M3 (finding) a regex-valid but impossible week in the URL throws during render", () => {
    h.user = "editor-d"; h.query = { format: "game-grid", week: "2026-13-99", card: "grid" };
    let thrown = ""; const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    try { render(<SocialShare format="game-grid" asOf={new Date().toISOString()} />); } catch (e) { thrown = String((e as Error).message); } finally { spy.mockRestore(); }
    observed.M3 = { thrown, apiCalls: api().length };
    expect(thrown).toMatch(/Invalid as-of timestamp/);
  });
  it("M4 out-of-week or malformed dates and an unknown card fall back to defaults", async () => {
    const w = week(); h.user = "editor-e"; h.query = { format: "game-grid", week: w, dates: "1999-01-01,<script>", card: "javascript:alert(1)" };
    render(<SocialShare format="game-grid" asOf={new Date().toISOString()} />); await waitFor(() => expect(api()).toHaveLength(1));
    const url = String(api()[0][0]); const card = (screen.getByRole("combobox", { name: /^Graphic/ }) as HTMLSelectElement).value;
    observed.M4 = { url, card };
    expect(url).toBe(`/api/v1/social-share/game-grid?weekStart=${w}`); expect(card).toBe("grid");
  });
});
