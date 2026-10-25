import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";

const { router, supabaseFromMock } = vi.hoisted(() => ({
  router: { isReady: true, pathname: "/trendsSandbox", query: {} as Record<string, string>, replace: vi.fn() },
  supabaseFromMock: vi.fn(),
}));

vi.mock("next/router", () => ({ useRouter: () => router }));
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

function mockScoreResponse(row: SandboxScoreRow) {
  vi.stubGlobal("fetch", vi.fn(async (input: string) => {
    const url = new URL(input, "http://localhost");
    const common = { success: true, snapshotDate: row.snapshotDate, windowCode: "l5" };
    let body: Record<string, unknown>;
    if (url.pathname === "/api/v1/sustainability/entity-scores") {
      body = { ...common, totalRows: 1, rows: [row], selectedRow: row };
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
  });

  it("renders the numeric canonical process index without hot/cold or stable performance claims", async () => {
    mockScoreResponse(legacyRow);
    render(<TrendsSandboxPage />);
    const heading = await screen.findByRole("heading", { name: "Process Support Index" });
    const panel = heading.closest("article")!;
    expect(within(panel).getByText("70.00")).toBeTruthy();
    expect(within(panel).getByText("Raw Process Index")).toBeTruthy();
    expect(within(panel).getByText("1.20")).toBeTruthy();
    expect(within(panel).getAllByText("Performance unavailable")).not.toHaveLength(0);
    expect(within(panel).getByText(/does not measure observed performance against an expectation/)).toBeTruthy();
    for (const text of ["Cold", "Hot", "Usual Range", "On Pace", "Stable", "Running Hot", "Running Cold"]) {
      expect(within(panel).queryByText(text)).toBeNull();
    }
    expect(panel.querySelector('[class*="barometerPointer"]')).toBeNull();
    const snapshot = screen.getByRole("heading", { name: "Slate Snapshot" }).closest("section")!;
    expect(within(snapshot).getByText("Performance unavailable")).toBeTruthy();
    expect(within(snapshot).getByRole("button", { name: /Test Skater/ })).toBeTruthy();
    expect(within(snapshot).queryByText("Stable")).toBeNull();
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
