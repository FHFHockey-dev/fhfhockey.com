import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";

const { router, routerMode, supabaseFromMock } = vi.hoisted(() => ({
  router: { isReady: true, pathname: "/trendsSandbox", query: {} as Record<string, string>, replace: vi.fn() },
  // Next returns a new router object after router.replace; "fresh" mimics that.
  routerMode: { fresh: false },
  supabaseFromMock: vi.fn(),
}));

vi.mock("next/router", () => ({ useRouter: () => (routerMode.fresh ? { ...router } : router) }));
vi.mock("lib/supabase/client", () => ({ default: { from: supabaseFromMock } }));

import TrendsSandboxPage from "../../pages/trendsSandbox";
import type { SandboxScoreRow } from "lib/sustainability/entitySurface";

const legacyRow: SandboxScoreRow = {
  entityType: "skater", entityId: 1, entityName: "Test Skater", entitySubtitle: null,
  teamId: null, playerId: 1, snapshotDate: "2026-10-19", seasonId: 20262027,
  metricScope: "overall", windowCode: "l5", baselineValue: null, recentValue: null,
  expectedValue: null, zScore: null, rawScore: 1.2, score: 70, expectationState: "unavailable",
  components: {}, provenance: { score_semantics: "process_support_index" }, computedAt: null,
};

function mockScoreResponse(row: SandboxScoreRow, rows: SandboxScoreRow[] = [row]) {
  vi.stubGlobal("fetch", vi.fn(async (input: string) => {
    const url = new URL(input, "http://localhost");
    const common = { success: true, snapshotDate: row.snapshotDate, windowCode: "l5" };
    let body: Record<string, unknown>;
    if (url.pathname === "/api/v1/sustainability/entity-scores") {
      body = { ...common, totalRows: rows.length, rows, selectedRow: row };
    } else if (url.pathname === "/api/v1/sustainability/entity-bands") {
      body = { ...common, currentRows: [], historyRows: [] };
    } else if (url.pathname === "/api/v1/sustainability/entity-history") {
      body = { ...common, rows: [] };
    } else if (url.pathname === "/api/v1/sustainability/entity-options") {
      body = { success: true, options: [] };
    } else {
      throw new Error(`Unexpected test request: ${input}`);
    }
    return { ok: true, json: async () => body };
  }));
}

describe("sandbox expectation presentation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    router.query = { entityType: "skater", entityId: "1", date: "2026-10-19" };
    supabaseFromMock.mockImplementation((table: string) => {
      if (!["players", "wgo_skater_stats", "nst_gamelog_as_counts", "nst_gamelog_as_counts_oi"].includes(table)) {
        throw new Error(`Unexpected test table: ${table}`);
      }
      const query: any = {
        select: () => query, eq: () => query, gt: () => query, gte: () => query,
        lt: () => query, order: () => query,
        maybeSingle: async () => ({ data: { id: 1, fullName: "Test Skater" }, error: null }),
        then: (resolve: (value: unknown) => unknown) => Promise.resolve({ data: [], error: null }).then(resolve),
      };
      return query;
    });
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    routerMode.fresh = false;
  });

  it("keeps a deep-linked skater after the URL sync replaces the router", async () => {
    routerMode.fresh = true;
    mockScoreResponse(legacyRow);
    render(<TrendsSandboxPage />);
    await waitFor(() =>
      expect((screen.getByPlaceholderText("Search skaters by name") as HTMLInputElement).value).toBe("Test Skater")
    );
    await waitFor(() =>
      expect(router.replace).toHaveBeenLastCalledWith(
        expect.objectContaining({ query: expect.objectContaining({ entityId: "1", playerId: "1" }) }),
        undefined,
        expect.anything()
      )
    );
  });

  it("fills the skater search from Slate Snapshot without re-running the search", async () => {
    router.query = { entityType: "skater", date: "2026-10-19" };
    mockScoreResponse({ ...legacyRow, entitySubtitle: "DET · R" });
    render(<TrendsSandboxPage />);
    const snapshot = (await screen.findByRole("heading", { name: "Slate Snapshot" })).closest("section")!;
    fireEvent.click(await within(snapshot).findByRole("button", { name: /Test Skater/ }));
    const search = screen.getByPlaceholderText("Search skaters by name") as HTMLInputElement;
    expect(search.value).toBe("Test Skater");
    expect(search.getAttribute("aria-describedby")).toBe("entity-search-tag");
    expect(document.getElementById("entity-search-tag")?.textContent).toBe("DET · RW");
    await new Promise((resolve) => setTimeout(resolve, 400));
    const calls = (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls.map(([url]) => String(url));
    expect(calls.some((url) => url.includes("/entity-options"))).toBe(false);
  });

  it("gives tied Slate Snapshot scores a shared rank", async () => {
    router.query = { entityType: "skater", date: "2026-10-19" };
    const tied = [
      { ...legacyRow, entityId: 1, entityName: "First Skater", score: 100 },
      { ...legacyRow, entityId: 2, entityName: "Second Skater", score: 100 },
      { ...legacyRow, entityId: 3, entityName: "Third Skater", score: 99.9 },
    ];
    mockScoreResponse(tied[0], tied);
    render(<TrendsSandboxPage />);
    const snapshot = (await screen.findByRole("heading", { name: "Slate Snapshot" })).closest("section")!;
    await within(snapshot).findByRole("button", { name: /Third Skater/ });
    const ranks = within(snapshot).getAllByRole("button").map((button) => button.textContent?.match(/^\d+/)?.[0]);
    expect(ranks).toEqual(["1", "1", "3"]);
  });

  it("shows the contract note, row count and entity type in development only", async () => {
    router.query = { entityType: "skater", date: "2026-10-19" };
    mockScoreResponse(legacyRow);
    render(<TrendsSandboxPage />);
    expect(await screen.findByText("Contract Note")).toBeTruthy();
    expect(screen.getByText("Rows Loaded")).toBeTruthy();
    expect(screen.getByText("Entity Type")).toBeTruthy();
    cleanup();

    vi.stubEnv("NODE_ENV", "production");
    vi.resetModules();
    try {
      const { default: ProductionPage } = await import("../../pages/trendsSandbox");
      render(<ProductionPage />);
      await screen.findByRole("heading", { name: "Controls" });
      expect(screen.queryByText("Contract Note")).toBeNull();
      expect(screen.queryByText("Rows Loaded")).toBeNull();
      expect(screen.queryByText("Entity Type")).toBeNull();
      expect(screen.queryByText(/legacy production tables/)).toBeNull();
    } finally {
      vi.unstubAllEnvs();
      vi.resetModules();
    }
  });

  it("asks before Reset clears the controls", async () => {
    mockScoreResponse(legacyRow);
    render(<TrendsSandboxPage />);
    const search = screen.getByPlaceholderText("Search skaters by name") as HTMLInputElement;
    await waitFor(() => expect(search.value).toBe("Test Skater"));

    fireEvent.click(screen.getByRole("button", { name: "Reset" }));
    const confirm = screen.getByRole("group", { name: "Reset all controls?" });
    expect(document.activeElement).toBe(within(confirm).getByRole("button", { name: "No" }));
    fireEvent.keyDown(confirm, { key: "Escape" });
    expect(screen.queryByRole("group", { name: "Reset all controls?" })).toBeNull();
    expect(search.value).toBe("Test Skater");

    fireEvent.click(screen.getByRole("button", { name: "Reset" }));
    fireEvent.click(screen.getByRole("button", { name: "Clear all" }));
    await waitFor(() =>
      expect((screen.getByPlaceholderText("Search skaters by name") as HTMLInputElement).value).toBe("")
    );
  });

  it("closes the Reset confirm after five seconds without clearing", async () => {
    mockScoreResponse(legacyRow);
    render(<TrendsSandboxPage />);
    const search = screen.getByPlaceholderText("Search skaters by name") as HTMLInputElement;
    await waitFor(() => expect(search.value).toBe("Test Skater"));
    vi.useFakeTimers();
    try {
      fireEvent.click(screen.getByRole("button", { name: "Reset" }));
      act(() => vi.advanceTimersByTime(4900));
      expect(screen.getByRole("group", { name: "Reset all controls?" })).toBeTruthy();
      act(() => vi.advanceTimersByTime(100));
      expect(screen.queryByRole("group", { name: "Reset all controls?" })).toBeNull();
      expect(search.value).toBe("Test Skater");
    } finally {
      vi.useRealTimers();
    }
  });

  it("defaults to the visitor's local date, not the UTC date", async () => {
    const previousTz = process.env.TZ;
    process.env.TZ = "America/New_York";
    vi.useFakeTimers({ toFake: ["Date"] });
    // 7:30 PM Eastern on Nov 22 is already Nov 23 in UTC.
    vi.setSystemTime(new Date("2026-11-23T00:30:00Z"));
    try {
      router.query = { entityType: "skater" };
      mockScoreResponse(legacyRow);
      render(<TrendsSandboxPage />);
      await waitFor(() =>
        expect((screen.getByLabelText("Date") as HTMLInputElement).value).toBe("2026-11-22")
      );
    } finally {
      vi.useRealTimers();
      process.env.TZ = previousTz;
    }
  });

  it("waits for the linked date before loading scores", async () => {
    mockScoreResponse(legacyRow);
    render(<TrendsSandboxPage />);
    await screen.findByRole("heading", { name: "Process Support Index" });
    const scoreDates = (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls
      .map(([url]) => new URL(String(url), "http://localhost"))
      .filter((url) => url.pathname.endsWith("/entity-scores"))
      .map((url) => url.searchParams.get("date"));
    expect(scoreDates.length).toBeGreaterThan(0);
    expect(new Set(scoreDates)).toEqual(new Set(["2026-10-19"]));
    for (const [arg] of router.replace.mock.calls) {
      expect((arg as { query: Record<string, string> }).query.date).toBe("2026-10-19");
    }
  });

  it("retries a failed scores load from the error notice", async () => {
    mockScoreResponse(legacyRow);
    const workingFetch = fetch as unknown as ReturnType<typeof vi.fn>;
    let failScores = true;
    vi.stubGlobal("fetch", vi.fn(async (input: string) => {
      if (failScores && String(input).includes("/entity-scores")) {
        return { ok: false, json: async () => ({ success: false, message: "Scores are down." }) };
      }
      return workingFetch(input);
    }));
    render(<TrendsSandboxPage />);
    const notice = await screen.findByRole("alert");
    // Test env is development: plain copy plus the server detail.
    expect(within(notice).getByText("Couldn't load the readings right now. (Scores are down.)")).toBeTruthy();
    failScores = false;
    fireEvent.click(within(notice).getByRole("button", { name: "Try again" }));
    expect(document.activeElement).toBe(screen.getByRole("heading", { name: "Controls" }));
    expect(screen.getByText("Reloading scores…").getAttribute("aria-live")).toBe("polite");
    expect(await screen.findByRole("heading", { name: "Process Support Index" })).toBeTruthy();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("exposes the selected toggles with aria-pressed", async () => {
    mockScoreResponse(legacyRow);
    render(<TrendsSandboxPage />);
    const entity = screen.getByRole("group", { name: "Entity type" });
    expect(within(entity).getByRole("button", { name: "Skaters" }).getAttribute("aria-pressed")).toBe("true");
    expect(within(entity).getByRole("button", { name: "Teams" }).getAttribute("aria-pressed")).toBe("false");
    const windowGroup = screen.getByRole("group", { name: "Window" });
    expect(within(windowGroup).getByRole("button", { name: "L5 (last 5 games)" }).getAttribute("aria-pressed")).toBe("true");
    fireEvent.click(within(windowGroup).getByRole("button", { name: "L10 (last 10 games)" }));
    expect(within(windowGroup).getByRole("button", { name: "L10 (last 10 games)" }).getAttribute("aria-pressed")).toBe("true");
    const chartView = screen.getByRole("tablist", { name: "Chart view" });
    const elasticity = within(chartView).getByRole("tab", { name: "Usual Range" });
    expect(elasticity.getAttribute("aria-selected")).toBe("true");
    expect(screen.getByRole("tabpanel").getAttribute("aria-labelledby")).toBe(elasticity.id);
    fireEvent.keyDown(elasticity, { key: "ArrowRight" });
    const metric = within(chartView).getByRole("tab", { name: "Metric Streaks" });
    expect(metric.getAttribute("aria-selected")).toBe("true");
    expect(document.activeElement).toBe(metric);
    expect(elasticity.getAttribute("tabindex")).toBe("-1");
  });

  it("skip link lands on the selected entity tab", async () => {
    mockScoreResponse(legacyRow);
    render(<TrendsSandboxPage />);
    fireEvent.click(screen.getByRole("link", { name: "Skip to sandbox" }));
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Skaters" }));
  });

  it("names the band chart and reads games with the arrow keys", async () => {
    // Eastern time: "2026-10-12" must stay Oct 12 (UTC parsing showed Oct 11).
    const previousTz = process.env.TZ;
    process.env.TZ = "America/New_York";
    try {
      mockScoreResponse(legacyRow);
      const baseFetch = fetch as unknown as ReturnType<typeof vi.fn>;
      const historyRow = (snapshotDate: string, observed: number, gameContext: unknown = null) => ({
        entityType: "skater", entityId: 1, entityName: "Test Skater", metricKey: "ixg_per_60",
        metricLabel: "ixG / 60", windowCode: "l5", snapshotDate, seasonId: null,
        distribution: { usualRange: { status: "neutral", lower: 0.5, upper: 2, observed, baseline: 1.2 } },
        gameContext,
      });
      vi.stubGlobal("fetch", vi.fn(async (input: string) => {
        if (String(input).includes("/entity-bands")) {
          const body = { success: true, snapshotDate: "2026-10-19", windowCode: "l5", currentRows: [],
            historyRows: [historyRow("2026-10-10", 1.1), historyRow("2026-10-12", 1.4, {
              teamAbbreviation: "EDM", opponentAbbreviation: "CAR", homeRoad: "H",
            })] };
          return { ok: true, json: async () => body };
        }
        return baseFetch(input);
      }));
      render(<TrendsSandboxPage />);
      const chart = await screen.findByRole("img", { name: /ixG \/ 60 usual-range chart, 2 games/ });
      expect(chart).toBeTruthy();
      const reader = screen.getByRole("group", { name: /Use the left and right arrow keys/ });
      fireEvent.focus(reader);
      // Opponent by team name, not the abbreviation.
      await waitFor(() => expect(screen.getByText(/Oct 12, 2026 vs Hurricanes: 1\.40, usual range 0\.50 to 2\.00\./)).toBeTruthy());
      expect(screen.getByText("vs Hurricanes")).toBeTruthy();
      fireEvent.keyDown(reader, { key: "ArrowLeft" });
      await waitFor(() => expect(screen.getByText(/Oct 10, 2026: 1\.10/)).toBeTruthy());
    } finally {
      process.env.TZ = previousTz;
    }
  });

  it("lists only z-score drivers, not model settings, in Why This Reading", async () => {
    mockScoreResponse({ ...legacyRow, components: { z_ixg60: 1.76, z_ipp: -0.14, extremeThreshold: 5, extremeFlag: false } });
    render(<TrendsSandboxPage />);
    expect(await screen.findByRole("heading", { name: "Why This Reading" })).toBeTruthy();
    expect(screen.getByText("Chance creation")).toBeTruthy();
    expect(screen.queryByText(/ExtremeThreshold/i)).toBeNull();
  });

  it("hides the server's error detail from fans in production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.resetModules();
    try {
      vi.stubGlobal("fetch", vi.fn(async () => ({
        ok: false,
        json: async () => ({ success: false, message: "canceling statement due to statement timeout" }),
      })));
      const { default: ProductionPage } = await import("../../pages/trendsSandbox");
      render(<ProductionPage />);
      const notice = await screen.findByRole("alert");
      expect(within(notice).getByText("Couldn't load the readings right now.")).toBeTruthy();
      expect(screen.queryByText(/statement timeout/)).toBeNull();
    } finally {
      vi.unstubAllEnvs();
      vi.resetModules();
    }
  });

  it("says a picked team has no reading instead of asking to select one", async () => {
    router.query = { entityType: "team", entityId: "6", date: "2026-10-19" };
    mockScoreResponse(legacyRow);
    const baseFetch = fetch as unknown as ReturnType<typeof vi.fn>;
    vi.stubGlobal("fetch", vi.fn(async (input: string) => {
      if (String(input).includes("/entity-scores")) {
        const body = { success: true, snapshotDate: null, windowCode: "l5", totalRows: 0, rows: [], selectedRow: null };
        return { ok: true, json: async () => body };
      }
      return baseFetch(input);
    }));
    render(<TrendsSandboxPage />);
    const barometer = (await screen.findByRole("heading", { name: "Form Barometer" })).closest("article")!;
    await waitFor(() => expect(within(barometer).getByText(/^No reading for .+ on 2026-10-19\.$/)).toBeTruthy());
    expect(within(barometer).getByText("No reading")).toBeTruthy();
    expect(screen.queryByText(/Select an entity/)).toBeNull();
    const snapshot = screen.getByRole("heading", { name: "Slate Snapshot" }).closest("section")!;
    expect(within(snapshot).getByText("No teams running hot on 2026-10-19.")).toBeTruthy();
    expect(within(snapshot).getByText("On Pace")).toBeTruthy();
  });

  it("folds a missing Usual Level into one line under the score", async () => {
    mockScoreResponse(legacyRow);
    render(<TrendsSandboxPage />);
    expect(
      await screen.findByText("Usual-level numbers aren't available for this reading yet.")
    ).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "Usual Level" })).toBeNull();
  });

  it("picks the focus metric from the metric cards", async () => {
    mockScoreResponse(legacyRow);
    render(<TrendsSandboxPage />);
    const picker = await screen.findByRole("group", { name: "Focus metric" });
    // Short visible labels; the accessible name starts with them, then the full name.
    const ixg = within(picker).getByRole("button", { name: "ixG/60 (ixG / 60)" });
    expect(ixg.textContent).toBe("ixG/60");
    expect(ixg.getAttribute("aria-pressed")).toBe("true");
    const shots = within(picker).getByRole("button", { name: "SOG/60 (Shots / 60)" });
    expect(shots.getAttribute("title")).toBe("Shots / 60");
    fireEvent.click(shots);
    expect(shots.getAttribute("aria-pressed")).toBe("true");
    expect(ixg.getAttribute("aria-pressed")).toBe("false");
    expect(picker.parentElement?.textContent).toContain("Shots / 60: ");
    await waitFor(() => {
      const urls = (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls.map(([url]) => String(url));
      expect(urls.some((url) => url.includes("/entity-bands") && url.includes("metricKey=shots_per_60"))).toBe(true);
    });
    expect(screen.queryByRole("combobox", { name: /focus metric/i })).toBeNull();
  });

  it("keeps a deep-linked team selected after entity-type hydration", async () => {
    router.query = { entityType: "team", entityId: "6", date: "2026-10-19" };
    mockScoreResponse({ ...legacyRow, entityType: "team", entityId: 6, playerId: null, teamId: 6,
      entityName: "Test Team", provenance: { supplied: "unified" } });
    render(<TrendsSandboxPage />);
    await waitFor(() => expect((screen.getByLabelText("Team") as HTMLSelectElement).value).toBe("6"));
  });

  it("renders the numeric canonical process index without hot/cold or stable performance claims", async () => {
    mockScoreResponse(legacyRow);
    render(<TrendsSandboxPage />);
    const heading = await screen.findByRole("heading", { name: "Process Support Index" });
    const panel = heading.closest("article")!;
    expect(within(panel).getByText("70.00")).toBeTruthy();
    expect(within(panel).getByText("Raw index")).toBeTruthy();
    // Said once: no repeated "Performance comparison" row or empty gap row.
    expect(within(panel).queryByText("Performance comparison")).toBeNull();
    expect(within(panel).queryByText("Gap vs Usual")).toBeNull();
    expect(within(panel).getByText("1.20")).toBeTruthy();
    expect(within(panel).getAllByText("Performance unavailable")).not.toHaveLength(0);
    expect(within(panel).getByText(/does not measure observed performance against an expectation/)).toBeTruthy();
    for (const text of ["Cold", "Hot", "Usual Range", "On Pace", "Stable", "Running Hot", "Running Cold"]) {
      expect(within(panel).queryByText(text)).toBeNull();
    }
    expect(panel.querySelector('[class*="barometerPointer"]')).toBeNull();
    const snapshot = screen.getByRole("heading", { name: "Slate Snapshot" }).closest("section")!;
    expect(within(snapshot).getByText(/performance comparison unavailable/i)).toBeTruthy();
    expect(within(snapshot).getByRole("button", { name: /Test Skater/ })).toBeTruthy();
    expect(within(snapshot).queryByText("Stable")).toBeNull();
    // No drivers: the section is hidden, with no padded "Awaiting signal" cards.
    expect(screen.queryByRole("heading", { name: "Why This Reading" })).toBeNull();
    expect(screen.queryByText("Awaiting signal")).toBeNull();
  });

  it.each([
    ["overperforming", "Running Hot"],
    ["underperforming", "Running Cold"],
    ["stable", "On Pace"],
  ] as const)("retains the supplied unified %s presentation", async (state, label) => {
    router.query = { entityType: "team", entityId: "6", date: "2026-10-19" };
    mockScoreResponse({ ...legacyRow, entityType: "team", entityId: 6, playerId: null, teamId: 6,
      entityName: "Test Team", expectationState: state, provenance: { supplied: "unified" } });
    render(<TrendsSandboxPage />);
    // Select through the live control after entity-type initialization resets
    // selection; these tests concern the supplied score, not query hydration.
    fireEvent.change(await screen.findByLabelText("Team"), { target: { value: "6" } });
    await waitFor(() => expect(screen.getAllByText(label)).not.toHaveLength(0));
    const panel = screen.getByRole("heading", { name: "Form Barometer" }).closest("article")!;
    expect(within(panel).getByText("70.00")).toBeTruthy();
    expect(within(panel).getByText("Cold")).toBeTruthy();
    expect(within(panel).getByText("Hot")).toBeTruthy();
    expect(panel.querySelector('[class*="barometerPointer"]')).not.toBeNull();
    expect(within(panel).queryByText("Performance unavailable")).toBeNull();
  });
});
