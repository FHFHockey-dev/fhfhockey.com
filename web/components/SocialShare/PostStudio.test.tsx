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
  schemaVersion: 1, id: "team-games-1", post: "team-games", state: "ready", reasons: [], generatedAt: new Date().toISOString(), expiresAt: new Date(Date.now() + 600000).toISOString(), timeZone: "America/New_York", settings: { days: 7, period: "rolling", week: null, start: null, end: null },
  evidence: { sources: [{ name: "NHL.com team game stats", tables: ["wgo_team_stats"], state: "ready", asOf: "2026-10-30", updatedAt: null }], sample: "21 completed team games", strength: "Not applicable", cohort: "All 32 teams", coverage: { observed: 21, expected: 21, missing: 0, unit: "team games" } },
  data: { from: "2026-10-24", through: "2026-10-30", label: "Last 7 days · Oct 24 to Oct 30", rows: [{ team: "NJD", games: 4, lastGame: "2026-10-30", rank: 1 }] }, teams: ["NJD"], fixture: false, ...over,
});

describe("PostStudio", () => {
  const fetchMock = vi.fn();
  /** Edition requests only: a post with a period control also reads the matchup calendar. */
  const postCalls = () => fetchMock.mock.calls.map(call => String(call[0])).filter(url => url.includes("/posts/"));
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
    expect(postCalls()[0]).toBe("/api/v1/social-share/posts/team-games?days=7&period=rolling");
    const evidence = screen.getByTestId("post-evidence").textContent!;
    for (const label of ["NHL.com team game stats through 2026-10-30", "21 completed team games", "Not applicable", "All 32 teams", "21 of 21 team games", "Days: 7"]) expect(evidence).toContain(label);
    expect(screen.getByTestId("post-sync").textContent).toBe("Up to date");
    expect(screen.queryByRole("button", { name: /^Reset/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /^Refresh/ })).toBeNull();
    const square = screen.getByTestId("share-square");
    expect(square.contains(screen.getByTestId("post-evidence"))).toBe(false);
    expect(screen.getByTestId("post-evidence-line").textContent).toBe("NHL.com team game stats through 2026-10-30 · Not applicable · 21 of 21 team games");
    expect(square.contains(screen.getByTestId("post-evidence-line"))).toBe(true);
    expect(screen.getByTestId("post-watermark").textContent).toBe("OBSERVED RESULTS");
    expect(screen.getByTestId("share-square").getAttribute("data-export-token")).toBe('team-games-1|team-games|[["days",7],["period","rolling"],["week",null],["start",null],["end",null]]');
  });

  describe("settings apply on their own", () => {
    /** Serves an edition built with the requested days, so export opens once the reload lands. */
    const serveDays = () => fetchMock.mockImplementation(async (url: string) => {
      const days = Number(new URL(url, "http://fhfh.invalid").searchParams.get("days") ?? 7);
      return { ok: true, status: 200, json: async () => edition({ id: `team-games-${days}`, settings: { days, period: "rolling", week: null, start: null, end: null } }) } as unknown as Response;
    });
    const download = () => screen.getByRole("button", { name: "Download PNG" }) as HTMLButtonElement;
    const days = () => screen.getByLabelText("Days") as HTMLInputElement;
    const options = () => screen.getByRole("button", { name: /^Options/ });

    it("reloads once typing pauses, sending only the last value, and keeps export off until it lands", async () => {
      serveDays();
      render(<PostStudio />);
      await waitFor(() => expect(download().disabled).toBe(false));
      fireEvent.change(days(), { target: { value: "1" } });
      fireEvent.change(days(), { target: { value: "14" } });
      expect(screen.getByTestId("post-sync").textContent).toBe("Updating…");
      expect(download().disabled).toBe(true);
      await waitFor(() => expect(postCalls()).toHaveLength(2));
      expect(postCalls()[1]).toContain("days=14");
      await waitFor(() => expect(download().disabled).toBe(false));
      expect(screen.getByTestId("share-square").getAttribute("data-export-token")).toContain('["days",14]');
      fireEvent.click(options());
      expect(screen.getByRole("button", { name: "Reset Days to 7" })).toBeTruthy();
    });

    it("starts with Options collapsed, counts changed options, and opens or closes without a reload", async () => {
      router.query = { post: "team-games", days: "14" };
      serveDays();
      render(<PostStudio />);
      await waitFor(() => expect(download().disabled).toBe(false));
      expect(options().getAttribute("aria-expanded")).toBe("false");
      expect(options().textContent).toBe("Options · 1 changed");
      expect(document.getElementById(options().getAttribute("aria-controls")!)!.hidden).toBe(true);
      fireEvent.click(options());
      expect(options().getAttribute("aria-expanded")).toBe("true");
      expect(days().closest("[hidden]")).toBeNull();
      fireEvent.click(options());
      expect(options().getAttribute("aria-expanded")).toBe("false");
      expect(postCalls()).toHaveLength(1);
    });

    it("keeps Options open while a value is wrong, so its reason shows", async () => {
      serveDays();
      render(<PostStudio />);
      await waitFor(() => expect(download().disabled).toBe(false));
      expect(options().textContent).toBe("Options");
      fireEvent.click(options());
      fireEvent.change(days(), { target: { value: "40" } });
      fireEvent.click(options());
      expect(options().getAttribute("aria-expanded")).toBe("true");
      expect(screen.getByText("Enter a number from 1 to 30.")).toBeTruthy();
      fireEvent.change(days(), { target: { value: "12" } });
      expect(options().getAttribute("aria-expanded")).toBe("false");
    });

    it("never sends a value out of range, says why, and lets a cleared field come back on blur", async () => {
      serveDays();
      render(<PostStudio />);
      await waitFor(() => expect(download().disabled).toBe(false));
      fireEvent.change(days(), { target: { value: "40" } });
      expect(screen.getByText("Enter a number from 1 to 30.")).toBeTruthy();
      expect(days().getAttribute("aria-invalid")).toBe("true");
      expect(screen.getByTestId("post-sync").textContent).toBe("Not updated");
      expect(download().disabled).toBe(true);
      fireEvent.blur(days());
      expect(days().value).toBe("40");
      fireEvent.change(days(), { target: { value: "" } });
      expect(screen.queryByText("Enter a number from 1 to 30.")).toBeNull();
      fireEvent.blur(days());
      expect(days().value).toBe("7");
      await new Promise(resolve => setTimeout(resolve, 700));
      expect(postCalls()).toHaveLength(1);
      expect(download().disabled).toBe(false);
    });

    it("stops counting a wrong value once its field is hidden by the period", async () => {
      serveDays();
      render(<PostStudio />);
      await waitFor(() => expect(download().disabled).toBe(false));
      fireEvent.change(days(), { target: { value: "40" } });
      expect(screen.getByTestId("post-sync").textContent).toBe("Not updated");
      fireEvent.change(screen.getByTestId("period-control").querySelector("select")!, { target: { value: "matchup" } });
      expect(screen.queryByLabelText("Days")).toBeNull();
      await waitFor(() => expect(postCalls().at(-1)).toContain("period=matchup"));
      await waitFor(() => expect(screen.getByTestId("post-sync").textContent).toBe("Up to date"));
    });

    it("applies a select at once and drops the response it replaced", async () => {
      let release = () => {};
      const slow = new Promise<void>(resolve => { release = resolve; });
      fetchMock.mockImplementation(async (url: string) => {
        const period = new URL(url, "http://fhfh.invalid").searchParams.get("period");
        if (period === "rolling" && postCalls().length > 1) await slow;
        return { ok: true, status: 200, json: async () => edition({ id: `team-games-${period}`, reasons: [], settings: { days: 7, period: period ?? "rolling", week: null, start: null, end: null } }) } as unknown as Response;
      });
      render(<PostStudio />);
      await waitFor(() => expect(download().disabled).toBe(false));
      fireEvent.change(days(), { target: { value: "8" } });
      fireEvent.change(days(), { target: { value: "7" } });
      await waitFor(() => expect(postCalls()).toHaveLength(2));
      const select = screen.getByTestId("period-control").querySelector("select")!;
      try {
        fireEvent.change(select, { target: { value: "matchup" } });
        await waitFor(() => expect(postCalls()).toHaveLength(3));
        expect(postCalls()[2]).toContain("period=matchup");
        await waitFor(() => expect(screen.getByTestId("share-square").getAttribute("data-export-token")).toContain("team-games-matchup"));
      } finally { release(); }
      await slow; await new Promise(resolve => setTimeout(resolve, 0));
      expect(screen.getByTestId("share-square").getAttribute("data-export-token")).toContain("team-games-matchup");
    });

    it("holds settings the post refuses, and says why", async () => {
      serveDays();
      render(<PostStudio />);
      await waitFor(() => expect(download().disabled).toBe(false));
      fireEvent.change(screen.getByTestId("period-control").querySelector("select")!, { target: { value: "custom" } });
      expect(postCalls()).toHaveLength(1);
      expect(screen.getByTestId("post-sync").textContent).toBe("Not updated");
      expect(screen.getByTestId("period-reason").textContent).toBe("A custom range needs a start date and an end date.");
      expect(download().disabled).toBe(true);
    });
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
      expect(postCalls().length).toBe(1);
    } finally { Object.assign(entry, { fields, panel: undefined }); }
  });

  it("prints a source's failure and its reason beside the preview, and nothing extra for a healthy source", async () => {
    const base = edition();
    serve(edition({ evidence: { ...base.evidence, sources: [...base.evidence.sources, { name: "Natural Stat Trick", tables: ["nst"], state: "missing", asOf: null, updatedAt: null, reasons: ["NST read failed."] }] } }));
    render(<PostStudio />);
    const issues = await screen.findAllByTestId("post-source-issue");
    expect(issues.map(issue => issue.textContent)).toEqual(["Natural Stat Trick missing: NST read failed."]);
  });

  it("prints the edition's page notes beside the card, never inside the captured frame, and still exports", async () => {
    serve(edition({ pageNotes: ["Nov 2 is not fully reported yet, so this card ends Nov 1."] }));
    render(<PostStudio />);
    await waitFor(() => expect(screen.getByTestId("share-square")).toBeTruthy());
    const notes = screen.getByTestId("post-page-notes");
    expect(notes.textContent).toBe("Nov 2 is not fully reported yet, so this card ends Nov 1.");
    expect(screen.getByTestId("share-square").contains(notes)).toBe(false);
    await waitFor(() => expect((screen.getByRole("button", { name: "Download PNG" }) as HTMLButtonElement).disabled).toBe(false));
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
    const goalie = (week: string | null) => edition({ id: `goalie-${week}`, post: "goalie-period", state: "missing", data: null, teams: [], reasons: [`Edition for week ${week}.`], settings: { week: week === null ? null : Number(week) }, generatedAt: "2026-10-29T16:00:00.000Z" });
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

    describe("a blank week follows the loaded edition", () => {
      const before = "2026-11-02T04:30:00.000Z", after = "2026-11-02T05:30:00.000Z"; // 23:30 and 00:30 in New York, Nov 1 to Nov 2 (EST).
      const label = () => screen.getByTestId("period-pager-label").textContent;
      /** Any setting change loads a new edition; Board is one that keeps the period. */
      const refreshed = async () => { await waitFor(() => expect(screen.getByTestId("post-sync").textContent).not.toBe("Updating…")); fireEvent.change(screen.getByLabelText("Board"), { target: { value: "best" } }); };
      const serveAt = (at: () => string, calendar: () => Response) => fetchMock.mockImplementation(async (url: string) => url.endsWith("/matchup-weeks") ? calendar() : json({ ...goalie(null), generatedAt: at() }));
      beforeEach(() => { router.query = { post: "goalie-period" }; });

      it("moves on when a new edition from after midnight loads", async () => {
        let at = before;
        serveAt(() => at, () => json(matchups));
        render(<PostStudio />);
        await waitFor(() => expect(label()).toBe("Week 4 · Oct 19 to Oct 25"));
        at = after;
        await refreshed();
        await waitFor(() => expect(label()).toBe("Week 5 · Oct 26 to Nov 1"));
      });

      it("still moves on, and says so, when the calendar refresh fails", async () => {
        let at = before, ok = true;
        serveAt(() => at, () => json(ok ? matchups : {}, ok));
        render(<PostStudio />);
        await waitFor(() => expect(label()).toBe("Week 4 · Oct 19 to Oct 25"));
        at = after; ok = false;
        await refreshed();
        await waitFor(() => expect(label()).toBe("Week 5 · Oct 26 to Nov 1"));
        expect(screen.getByTestId("period-refresh-failed").textContent).toContain("could not be refreshed");
      });

      it("keeps the edition's week when the calendar is read after midnight but the edition before it", async () => {
        serveAt(() => before, () => json({ ...matchups, cutoff: "2026-11-01" }));
        render(<PostStudio />);
        await waitFor(() => expect(label()).toBe("Week 4 · Oct 19 to Oct 25"));
      });
    });

    it("leaves a post without the flag on its own form", async () => {
      router.query = { post: "team-games" };
      const entry = SHARE_MODULES.get("team-games")!, { periodControl } = entry;
      Object.assign(entry, { periodControl: undefined });
      try {
        serve(edition());
        render(<PostStudio />);
        await screen.findByTestId("share-square");
        expect(screen.queryByTestId("period-control")).toBeNull();
        expect(fetchMock.mock.calls.some(call => String(call[0]).includes("matchup-weeks"))).toBe(false);
      } finally { Object.assign(entry, { periodControl }); }
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

    it("shows date fields only for Custom, explains a bad range without sending it, and loads a good one after a pause", async () => {
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
      expect(editionUrls()).toHaveLength(loads);
      fireEvent.change(screen.getByLabelText("Custom range end"), { target: { value: "2026-10-24" } });
      expect(screen.queryByTestId("period-reason")).toBeNull();
      await waitFor(() => expect(editionUrls().at(-1)).toContain("start=2026-10-20&end=2026-10-24"));
      expect(editionUrls()).toHaveLength(loads + 1);
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
