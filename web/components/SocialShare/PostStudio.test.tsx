import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import PostStudio from "./PostStudio";
import type { SharePostPanelProps, SharePostSnapshot } from "lib/socialShare/modules/contract";
import { SHARE_MODULES } from "lib/socialShare/modules/registry";

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

  it("gives a post's panel its fields without a refetch, and leaves panel-only fields off the form", async () => {
    const entry = SHARE_MODULES.get("team-games")!, { fields } = entry;
    Object.assign(entry, {
      fields: [...fields, { id: "picks", label: "Picks", kind: "text", default: "", clientOnly: true, panelOnly: true }],
      panel: async () => ({ change }: SharePostPanelProps) => <button type="button" onClick={() => change("picks", "7,9")}>Pick two</button>,
    });
    try {
      serve(edition());
      render(<PostStudio />);
      fireEvent.click(await screen.findByRole("button", { name: "Pick two" }));
      await waitFor(() => expect(screen.getByTestId("share-square").getAttribute("data-export-token")).toContain('["picks","7,9"]'));
      expect(screen.queryByLabelText(/^Picks/)).toBeNull();
      expect(fetchMock).toHaveBeenCalledTimes(1);
    } finally { Object.assign(entry, { fields, panel: undefined }); }
  });

  it("prints a source's failure and its reason beside the preview, and nothing extra for a healthy source", async () => {
    const base = edition();
    serve(edition({ evidence: { ...base.evidence, sources: [...base.evidence.sources, { name: "Natural Stat Trick", tables: ["nst"], state: "missing", asOf: null, updatedAt: null, reasons: ["NST read failed."] }] } }));
    render(<PostStudio />);
    const issues = await screen.findAllByTestId("post-source-issue");
    expect(issues.map(issue => issue.textContent)).toEqual(["Natural Stat Trick missing: NST read failed."]);
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

  describe("period control", () => {
    const matchups = { cutoff: "2026-10-28", rows: [
      { week: 3, start_date: "2026-10-12", end_date: "2026-10-18" }, { week: 4, start_date: "2026-10-19", end_date: "2026-10-25" },
      { week: 5, start_date: "2026-10-26", end_date: "2026-11-01" }, { week: 6, start_date: "2026-11-02", end_date: "2026-11-08" },
    ] };
    const goalie = (week: string | null) => edition({ id: `goalie-${week}`, post: "goalie-period", state: "missing", data: null, teams: [], reasons: [`Edition for week ${week}.`], settings: { week: week === null ? null : Number(week) } });
    const json = (body: unknown, ok = true) => ({ ok, status: ok ? 200 : 503, json: async () => body }) as unknown as Response;
    /** Serves the calendar, and an edition per week; a week in `held` waits until it is released. */
    const serveGoalie = (held: Record<string, Promise<void>> = {}, calendar: () => Response = () => json(matchups)) => fetchMock.mockImplementation(async (url: string) => {
      if (url.endsWith("/matchup-weeks")) return calendar();
      const week = new URL(url, "http://fhfh.invalid").searchParams.get("week");
      await held[week ?? ""];
      return json(goalie(week));
    });
    const editionUrls = () => fetchMock.mock.calls.map(call => String(call[0])).filter(url => url.includes("/posts/"));
    const prior = () => screen.getByRole("button", { name: /^Prior week/ }) as HTMLButtonElement, next = () => screen.getByRole("button", { name: /^Next week/ }) as HTMLButtonElement;
    const lastQuery = () => (vi.mocked(router.replace).mock.lastCall![0] as { query: Record<string, string> }).query;
    beforeEach(() => { router.query = { post: "goalie-period", week: "4" }; });

    it("leaves a post without the flag on its own form", async () => {
      router.query = { post: "team-games" };
      serve(edition());
      render(<PostStudio />);
      await screen.findByTestId("share-square");
      expect(screen.queryByTestId("period-control")).toBeNull();
      expect(fetchMock.mock.calls.some(call => String(call[0]).includes("matchup-weeks"))).toBe(false);
    });

    it("reads the week from the URL, and a pager click updates the URL and loads the edition without Refresh", async () => {
      serveGoalie();
      render(<PostStudio />);
      await waitFor(() => expect(screen.getByTestId("period-pager-label").textContent).toBe("Week 4 · Oct 19 to Oct 25"));
      await screen.findByText("Edition for week 4.");
      fireEvent.click(prior());
      await screen.findByText("Edition for week 3.");
      expect(screen.getByTestId("period-pager-label").textContent).toBe("Week 3 · Oct 12 to Oct 18");
      expect(editionUrls().at(-1)).toContain("week=3");
      await waitFor(() => expect(lastQuery()).toMatchObject({ post: "goalie-period", period: "week", week: "3" }));
      expect(screen.queryByRole("spinbutton", { name: /^Week/ })).toBeNull();
    });

    it("round-trips: the URL it writes opens the same week", async () => {
      serveGoalie();
      const first = render(<PostStudio />);
      await screen.findByText("Edition for week 4.");
      await waitFor(() => expect(prior().disabled).toBe(false));
      fireEvent.click(prior());
      await waitFor(() => expect(lastQuery().week).toBe("3"));
      const written = lastQuery();
      first.unmount();
      router.query = written;
      render(<PostStudio />);
      await screen.findByText("Edition for week 3.");
      await waitFor(() => expect(screen.getByTestId("period-pager-label").textContent).toBe("Week 3 · Oct 12 to Oct 18"));
    });

    it("disables each side at its end, and past-only stops at the week under way", async () => {
      router.query = { post: "goalie-period", week: "5" };
      serveGoalie();
      render(<PostStudio />);
      await waitFor(() => expect(prior().disabled).toBe(false));
      expect(next().disabled).toBe(true);
      fireEvent.click(prior()); fireEvent.click(prior());
      await waitFor(() => expect(screen.getByTestId("period-pager-label").textContent).toContain("Week 3"));
      expect(prior().disabled).toBe(true);
      expect(next().disabled).toBe(false);
      // Stepping onto the last week keeps the keyboard on the pager.
      expect(document.activeElement).toBe(next());
    });

    it("never lets a slow response overwrite a newer one", async () => {
      let release = () => {};
      const slow = new Promise<void>(resolve => { release = resolve; });
      router.query = { post: "goalie-period", week: "5" };
      serveGoalie({ "4": slow });
      render(<PostStudio />);
      await screen.findByText("Edition for week 5.");
      await waitFor(() => expect(prior().disabled).toBe(false));
      fireEvent.click(prior());
      fireEvent.click(prior());
      await screen.findByText("Edition for week 3.");
      release();
      await slow; await new Promise(resolve => setTimeout(resolve, 0));
      expect(screen.getByText("Edition for week 3.")).toBeTruthy();
      expect(screen.queryByText("Edition for week 4.")).toBeNull();
      expect(screen.getByTestId("period-pager-label").textContent).toContain("Week 3");
    });

    it("shows date fields only for Custom, explains a bad range, and waits for Refresh", async () => {
      serveGoalie();
      render(<PostStudio />);
      await screen.findByText("Edition for week 4.");
      expect(screen.queryByLabelText("Custom range start")).toBeNull();
      await waitFor(() => expect(prior().disabled).toBe(false));
      const loads = editionUrls().length;
      fireEvent.change(screen.getByLabelText("Period"), { target: { value: "custom" } });
      expect(screen.queryByTestId("period-pager-label")).toBeNull();
      expect(screen.getByTestId("period-reason").textContent).toBe("A custom range needs a start date and an end date.");
      const start = screen.getByLabelText("Custom range start") as HTMLInputElement;
      expect([start.min, start.max]).toEqual(["2026-10-12", "2026-10-28"]);
      fireEvent.change(start, { target: { value: "2026-10-20" } });
      fireEvent.change(screen.getByLabelText("Custom range end"), { target: { value: "2026-10-14" } });
      expect(screen.getByTestId("period-reason").textContent).toBe("The start date must be before the end date.");
      fireEvent.change(screen.getByLabelText("Custom range end"), { target: { value: "2026-10-24" } });
      expect(screen.queryByTestId("period-reason")).toBeNull();
      expect(editionUrls()).toHaveLength(loads);
      fireEvent.click(screen.getByRole("button", { name: "Refresh post" }));
      await waitFor(() => expect(editionUrls().at(-1)).toContain("start=2026-10-20&end=2026-10-24"));
    });

    it("loads at once for a period that needs no dates, and draws the month field only for a month", async () => {
      serveGoalie();
      render(<PostStudio />);
      await screen.findByText("Edition for week 4.");
      expect(screen.queryByLabelText(/^Month/)).toBeNull();
      fireEvent.change(screen.getByLabelText("Period"), { target: { value: "month" } });
      await waitFor(() => expect(editionUrls().at(-1)).toContain("period=month"));
      expect(screen.getByLabelText(/^Month/)).toBeTruthy();
    });

    it("says when the calendar cannot be read, retries it, and still loads the edition", async () => {
      let healthy = false;
      serveGoalie({}, () => healthy ? json(matchups) : json({ error: "down" }, false));
      render(<PostStudio />);
      await screen.findByText("Edition for week 4.");
      await waitFor(() => expect(screen.getByTestId("period-pager-label").textContent).toBe("Weeks unavailable"));
      expect(prior().disabled).toBe(true);
      expect(next().disabled).toBe(true);
      healthy = true;
      fireEvent.click(screen.getByRole("button", { name: "Retry weeks" }));
      await waitFor(() => expect(screen.getByTestId("period-pager-label").textContent).toBe("Week 4 · Oct 19 to Oct 25"));
    });

    it("names a skipped week beside the pager and steps over it", async () => {
      serveGoalie({}, () => json({ cutoff: "2026-11-10", rows: [matchups.rows[0], { week: 4, start_date: null, end_date: null }, ...matchups.rows.slice(2)] }));
      router.query = { post: "goalie-period", week: "5" };
      render(<PostStudio />);
      await screen.findByText("Week 4 has no dates on the matchup calendar, so it is skipped.");
      await waitFor(() => expect(prior().getAttribute("aria-label")).toBe("Prior week, week 3"));
    });
  });
});
