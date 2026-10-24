import { StrictMode } from "react";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import SocialShare from "./SocialShare";
import { TUESDAY_NOT_CONNECTED, buildBlockedSnapshot, buildScheduleSnapshot, calendarWeekStart, selectScheduleDates, weekDates } from "lib/socialShare/schedule";
import { fictionalLeagueWeek } from "lib/socialShare/fixtures";
vi.mock("lib/supabase/client", () => ({ default: { auth: {
  getSession: vi.fn(async () => ({ data: { session: { user: { id: "social-editor" }, access_token: "synthetic-token" } }, error: null })),
} } }));
// Ticket 15: the studio keeps its selection in the URL and remembers the edition for the signed-in user.
const router = vi.hoisted(() => ({ query: {} as Record<string, string>, pathname: "/social-share/[format]", isReady: true, replace: (() => Promise.resolve(true)) as (...args: unknown[]) => Promise<boolean> }));
vi.mock("next/router", () => ({ useRouter: () => router }));
vi.mock("contexts/AuthProviderContext", () => ({ useAuth: () => ({ user: { id: "social-editor" } }) }));

// A strict-mode double mount must still make exactly one edition API call (SS1-8 correction).
describe("SocialShare edition loading", () => {
  const fetchMock = vi.fn();
  beforeEach(() => {
    fetchMock.mockReset();
    router.query = { format: "tuesday-trends" }; router.replace = vi.fn(async () => true);
    fetchMock.mockImplementation(async (url: string) => {
      const query = new URL(url, "http://localhost").searchParams;
      const body = buildBlockedSnapshot({ format: "tuesday-trends", weekStart: query.get("weekStart")!, generatedAt: "2026-10-24T19:00:00Z", ...TUESDAY_NOT_CONNECTED });
      return { ok: true, status: 200, json: async () => body } as unknown as Response;
    });
    vi.stubGlobal("fetch", fetchMock);
    vi.stubGlobal("ResizeObserver", class { observe() {} disconnect() {} });
    Object.defineProperty(document, "fonts", { configurable: true, value: { load: async () => [], check: () => false } });
  });
  afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

  it("issues one API call per load under a React strict-mode double mount", async () => {
    render(<StrictMode><SocialShare format="tuesday-trends" asOf="2026-10-24T19:00:00Z" /></StrictMode>);
    await waitFor(() => expect(screen.getByText(/Rolling game metrics and ownership are not connected/)).toBeTruthy());
    const apiCalls = fetchMock.mock.calls.filter(([url]) => String(url).startsWith("/api/v1/social-share/"));
    expect(apiCalls).toEqual([["/api/v1/social-share/tuesday-trends?weekStart=2026-10-19", { cache: "no-store", credentials: "omit", headers: { Authorization: "Bearer synthetic-token" } }]]);
  });

  it("restores the URL's week, days and card, and a remount (gate re-check on tab return) reuses the edition without a refetch", async () => {
    // A current, ready schedule edition for next week (a blocked Tuesday edition never expires, so it is never remembered).
    const week = calendarWeekStart(new Date(Date.now() + 7 * 86400000).toISOString()), days = weekDates(week).slice(1, 3);
    fetchMock.mockImplementation(async (url: string) => {
      const query = new URL(url, "http://localhost").searchParams, generatedAt = new Date().toISOString();
      const edition = buildScheduleSnapshot({ format: "game-grid", weekStart: query.get("weekStart")!, generatedAt, schedule: fictionalLeagueWeek(query.get("weekStart")!, generatedAt) });
      return { ok: true, status: 200, json: async () => selectScheduleDates(edition, query.get("selectedDates")!.split(",")) } as unknown as Response;
    });
    router.query = { format: "game-grid", week, dates: days.join(","), card: "tiers" };
    const first = render(<SocialShare format="game-grid" asOf={new Date().toISOString()} />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(String(fetchMock.mock.calls[0][0])).toBe(`/api/v1/social-share/game-grid?weekStart=${week}&selectedDates=${encodeURIComponent(days.join(","))}`);
    await waitFor(() => expect((screen.getByRole("button", { name: "Refresh schedule" }) as HTMLButtonElement).disabled).toBe(false));
    expect((screen.getByRole("combobox", { name: /^Graphic/ }) as HTMLSelectElement).value).toBe("tiers");
    first.unmount();
    // Remount as the gate does after Supabase re-announces the session on tab return.
    render(<SocialShare format="game-grid" asOf={new Date().toISOString()} />);
    expect((screen.getByLabelText(/^Week of/) as HTMLInputElement).value).toBe(week);
    expect((screen.getByRole("combobox", { name: /^Graphic/ }) as HTMLSelectElement).value).toBe("tiers");
    expect((screen.getByRole("button", { name: "Refresh schedule" }) as HTMLButtonElement).disabled).toBe(false);
    expect(fetchMock.mock.calls.filter(([url]) => String(url).startsWith("/api/v1/social-share/"))).toHaveLength(1);
  });

  it("writes the selection into the URL with a shallow replace", async () => {
    render(<SocialShare format="tuesday-trends" asOf="2026-10-24T19:00:00Z" />);
    await waitFor(() => expect(router.replace).toHaveBeenCalled());
    const [target, , options] = (router.replace as ReturnType<typeof vi.fn>).mock.calls.at(-1)!;
    expect(target).toMatchObject({ pathname: "/social-share/[format]", query: { format: "tuesday-trends", week: "2026-10-19", card: "hot" } });
    expect(options).toMatchObject({ shallow: true, scroll: false });
  });
});

