import { StrictMode } from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import SocialShare from "./SocialShare";
import { TUESDAY_NOT_CONNECTED, buildBlockedSnapshot } from "lib/socialShare/schedule";
vi.mock("lib/supabase/client", () => ({ default: { auth: {
  getSession: vi.fn(async () => ({ data: { session: { user: { id: "social-editor" }, access_token: "synthetic-token" } }, error: null })),
} } }));

// A strict-mode double mount must still make exactly one edition API call (SS1-8 correction).
describe("SocialShare edition loading", () => {
  const fetchMock = vi.fn();
  beforeEach(() => {
    fetchMock.mockReset();
    fetchMock.mockImplementation(async (url: string) => {
      const query = new URL(url, "http://localhost").searchParams;
      const body = buildBlockedSnapshot({ format: "tuesday-trends", weekStart: query.get("weekStart")!, generatedAt: "2026-10-24T19:00:00Z", ...TUESDAY_NOT_CONNECTED });
      return { ok: true, status: 200, json: async () => body } as unknown as Response;
    });
    vi.stubGlobal("fetch", fetchMock);
    vi.stubGlobal("ResizeObserver", class { observe() {} disconnect() {} });
    Object.defineProperty(document, "fonts", { configurable: true, value: { load: async () => [], check: () => false } });
  });
  afterEach(() => { vi.unstubAllGlobals(); });

  it("issues one API call per load under a React strict-mode double mount", async () => {
    render(<StrictMode><SocialShare format="tuesday-trends" asOf="2026-10-24T19:00:00Z" /></StrictMode>);
    await waitFor(() => expect(screen.getByText(/Rolling game metrics and ownership are not connected/)).toBeTruthy());
    const apiCalls = fetchMock.mock.calls.filter(([url]) => String(url).startsWith("/api/v1/social-share/"));
    expect(apiCalls).toEqual([["/api/v1/social-share/tuesday-trends?weekStart=2026-10-19", { cache: "no-store", credentials: "omit", headers: { Authorization: "Bearer synthetic-token" } }]]);
  });
});
