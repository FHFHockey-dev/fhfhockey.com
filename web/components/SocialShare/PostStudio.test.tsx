import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import PostStudio from "./PostStudio";
import type { SharePostSnapshot } from "lib/socialShare/modules/contract";

vi.mock("lib/supabase/client", () => ({ default: { auth: {
  getSession: vi.fn(async () => ({ data: { session: { user: { id: "social-editor" }, access_token: "synthetic-token" } }, error: null })),
} } }));
const router = vi.hoisted(() => ({ query: { post: "team-games" } as Record<string, string>, pathname: "/social-share/posts", isReady: true, replace: (() => Promise.resolve(true)) as (...args: unknown[]) => Promise<boolean> }));
vi.mock("next/router", () => ({ useRouter: () => router }));

const edition = (over: Partial<SharePostSnapshot> = {}): SharePostSnapshot => ({
  schemaVersion: 1, id: "team-games-1", post: "team-games", state: "ready", reasons: [], generatedAt: new Date().toISOString(), expiresAt: new Date(Date.now() + 600000).toISOString(), timeZone: "America/New_York", settings: { days: 7 },
  evidence: { sources: [{ name: "NHL.com team game stats", tables: ["wgo_team_stats"], state: "ready", asOf: "2026-10-30", updatedAt: null }], sample: "21 completed team games", strength: "Not applicable", cohort: "All 32 teams", coverage: { observed: 21, expected: 21, missing: 0, unit: "team games" } },
  data: { from: "2026-10-24", through: "2026-10-30", rows: [{ team: "NJD", games: 4, lastGame: "2026-10-30", rank: 1 }] }, teams: ["NJD"], fixture: false, ...over,
});

describe("PostStudio", () => {
  const fetchMock = vi.fn();
  const serve = (body: SharePostSnapshot) => fetchMock.mockImplementation(async () => ({ ok: true, status: 200, json: async () => body }) as unknown as Response);
  beforeEach(() => {
    fetchMock.mockReset(); router.query = { post: "team-games" }; router.replace = vi.fn(async () => true);
    vi.stubGlobal("fetch", fetchMock);
    vi.stubGlobal("ResizeObserver", class { observe() {} disconnect() {} });
    vi.stubGlobal("Image", class { src = ""; naturalWidth = 1; naturalHeight = 1; decode = async () => undefined; });
    vi.stubGlobal("requestIdleCallback", undefined);
    Object.defineProperty(document, "fonts", { configurable: true, value: { load: async () => [{}], check: () => true } });
    HTMLCanvasElement.prototype.getContext = vi.fn(() => null) as never;
  });
  afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

  it("requests the post's edition with its visible default and prints its evidence", async () => {
    serve(edition());
    render(<PostStudio />);
    await waitFor(() => expect(screen.getByTestId("share-square")).toBeTruthy());
    expect(fetchMock.mock.calls[0][0]).toBe("/api/v1/social-share/posts/team-games?days=7");
    const evidence = screen.getByTestId("post-evidence").textContent!;
    for (const label of ["NHL.com team game stats through 2026-10-30", "21 completed team games", "Not applicable", "All 32 teams", "21 of 21 team games", "Days: 7"]) expect(evidence).toContain(label);
    expect(screen.getByText("Default: 7")).toBeTruthy();
    const square = screen.getByTestId("share-square");
    expect(square.contains(screen.getByTestId("post-evidence"))).toBe(false);
    expect(screen.getByTestId("post-evidence-line").textContent).toBe("NHL.com team game stats through 2026-10-30 · Not applicable · 21 of 21 team games");
    expect(square.contains(screen.getByTestId("post-evidence-line"))).toBe(true);
    expect(screen.getByTestId("post-watermark").textContent).toBe("OBSERVED RESULTS");
    expect(screen.getByTestId("share-square").getAttribute("data-export-token")).toBe('team-games-1|team-games|[["days",7]]');
  });

  it("keeps export off and asks for a refresh when a setting changes the edition's data", async () => {
    serve(edition());
    render(<PostStudio />);
    await waitFor(() => expect(screen.getByTestId("share-square")).toBeTruthy());
    fireEvent.change(screen.getByLabelText(/^Days/), { target: { value: "14" } });
    await waitFor(() => expect(screen.getByText(/Refresh the post to apply/)).toBeTruthy());
    expect((screen.getByRole("button", { name: "Download PNG" }) as HTMLButtonElement).disabled).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("waits out a font that is not declared yet, and offers a retry if it never loads", async () => {
    serve(edition());
    const load = vi.fn(async () => [] as unknown[]);
    Object.defineProperty(document, "fonts", { configurable: true, value: { load, check: () => true } });
    render(<PostStudio />);
    await waitFor(() => expect(screen.getByRole("alert").textContent).toContain("Required font unavailable"), { timeout: 3000 });
    expect(load).toHaveBeenCalledTimes(3);
    load.mockImplementation(async () => [{}]);
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    await waitFor(() => expect(screen.getByTestId("share-square")).toBeTruthy());
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("shows the reason instead of a card, and keeps export off, for an unavailable edition", async () => {
    serve(edition({ state: "missing", data: null, reasons: ["Team Games Played sources could not be read."], teams: [] }));
    render(<PostStudio />);
    await waitFor(() => expect(screen.getByTestId("post-unavailable")).toBeTruthy());
    expect(screen.getByTestId("post-unavailable").textContent).toContain("could not be read");
    expect((screen.getByRole("button", { name: "Download PNG" }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByTestId("post-watermark").textContent).toBe("UNAVAILABLE");
  });

  it("watermarks fixture data and refuses its export", async () => {
    serve(edition({ fixture: true }));
    render(<PostStudio />);
    await waitFor(() => expect(screen.getByTestId("post-watermark").textContent).toBe("OFFLINE FIXTURE"));
    expect((screen.getByRole("button", { name: "Download PNG" }) as HTMLButtonElement).disabled).toBe(true);
  });
});
