import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import WigoComparisonMatrix from "./WigoComparisonMatrix";

vi.mock("./StatsTableRowChart", () => ({ default: () => <div /> }));
vi.mock("utils/fetchWigoPlayerStats", () => ({ fetchPlayerGameLogForStat: vi.fn().mockResolvedValue([]) }));
afterEach(cleanup);

const mount = (props: Partial<React.ComponentProps<typeof WigoComparisonMatrix>>) => render(
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    <WigoComparisonMatrix data={[]} isLoadingAggData={false} aggDataError={null} playerId={8486067}
      currentSeasonId={20262027} leftTimeframe="STD" rightTimeframe="CA" onCompare={vi.fn()} {...props} />
  </QueryClientProvider>
);

describe("WigoComparisonMatrix status", () => {
  it("says why the table is empty for a player the writer has not reached", () => {
    mount({});
    expect(screen.getByRole("status").textContent).toBe("No WiGO comparison rows for this player yet.");
  });

  it("says it is waiting for the season instead of showing bare dashes", () => {
    mount({ currentSeasonId: null });
    expect(screen.getByRole("status").textContent).toBe("Loading season info...");
  });

  it("stays quiet with rows, and with no player selected", () => {
    mount({ data: [{ label: "GP", STD: 8 }] as any });
    expect(screen.getByRole("status").textContent).toBe("");
    cleanup();
    mount({ playerId: undefined });
    expect(screen.getByRole("status").textContent).toBe("");
  });

  it("marks a stale STD row with its GP and shows how current the rows are (Bedard)", () => {
    mount({
      data: [{ label: "GP", STD: 69, CA: 70 }, { label: "Goals", STD: 39, CA: 30 }] as any,
      freshness: { careerUpdatedAt: "2026-09-17T08:52:00Z", recentUpdatedAt: "2026-09-17T08:52:00Z", stdGp: 69, totalsGp: 8, stdStale: true }
    });
    expect(screen.getByText("As of Sep 17")).toBeTruthy();
    expect(screen.getByRole("note").textContent).toBe("STD is stale: its GP is 69, this season 8 played");
    expect(screen.getAllByRole("rowheader")[0].textContent).toContain("STD*");
    expect(screen.getAllByRole("rowheader")[0].textContent).toContain("stale row");
  });

  it("says DIFF is blank when the compared career period has no data yet (Bystedt)", () => {
    mount({ data: [{ label: "GP", STD: 2, CA: null }, { label: "Goals", STD: 0, CA: null }] as any });
    expect(screen.getByRole("note").textContent).toBe("No CA data yet, so DIFF is blank");
  });

  it("leaves out the as-of date when the stored value is not a date", () => {
    mount({ data: [{ label: "GP", STD: 8, CA: 70 }] as any,
      freshness: { careerUpdatedAt: "not-a-date", recentUpdatedAt: null, stdGp: 8, totalsGp: 8, stdStale: false } });
    expect(screen.queryByText(/As of/)).toBeNull();
  });

  it("gives the phone band jump buttons and a focusable side-scrolling region", () => {
    mount({ phone: true, data: [{ label: "GP", STD: 8, CA: 70 }] as any });
    expect(screen.getByRole("group", { name: "Jump to a metric group" }).textContent).toBe("TotalsPer 60On-ice");
    const region = screen.getByRole("region", { name: "Comparison band, scrolls sideways" });
    expect(region.getAttribute("tabindex")).toBe("0");
    expect(screen.getByText(/L5\/L10\/L20: up to the latest played games/)).toBeTruthy();
  });
});

describe("WigoComparisonMatrix unknown values (A2, rule 23)", () => {
  it("renders a published null ixG/60 as unknown end to end, not a rate rebuilt from WGO minutes", async () => {
    const { buildPlayerAggregatedStats } = await vi.importActual<typeof import("utils/fetchWigoPlayerStats")>(
      "utils/fetchWigoPlayerStats"
    );
    // Counts and ATOI would rebuild 7.5 ixG over 300 min as 1.50 per 60.
    const data = buildPlayerAggregatedStats({
      careerData: { player_id: 1, std_gp: 20, std_ixg: 7.5, std_atoi: 15, std_ixg_per_60: null } as any,
      recentData: null,
      ratesData: null,
      totalsData: null
    });
    mount({ data });
    const headerRow = screen.getByText("Period").closest("tr")!;
    const columnIndex = Array.from(headerRow.children).findIndex((th) => th.querySelector('[data-metric="ixG/60"]'));
    expect(columnIndex).toBeGreaterThan(0);
    const stdRow = screen.getAllByRole("rowheader").find((th) => th.textContent?.startsWith("STD"))!.closest("tr")!;
    const cell = stdRow.children[columnIndex];
    expect(cell.textContent).not.toBe("1.50");
    expect(cell.textContent).toMatch(/^[-–—]$/);
  });
});

describe("WigoComparisonMatrix labels", () => {
  const diffCell = (label: string) => {
    const headerRow = screen.getByText("Period").closest("tr")!;
    const index = Array.from(headerRow.children).findIndex((th) => th.querySelector(`[data-metric="${label}"]`));
    const diffRow = screen.getByText("DIFF").closest("tr")!;
    return diffRow.children[index] as HTMLElement;
  };

  it("says a percentage stat's DIFF is a relative change, not percentage points (D12)", () => {
    mount({ data: [{ label: "GP", STD: 10, CA: 70 }, { label: "S%", STD: 12, CA: 10, DIFF: 20 }] as any });
    expect(diffCell("S%").title).toContain("relative change of the percentage, not percentage points");
  });

  it("labels PP% as NHL-reported and unqualified (decision 71, L8 PP clock)", () => {
    mount({ data: [{ label: "GP", STD: 10, CA: 70 }, { label: "PP%", STD: 40, CA: 50 }] as any });
    const button = document.querySelector('[data-metric="PP%"]') as HTMLElement;
    expect(button.getAttribute("aria-label")).toContain("unqualified");
    expect(button.getAttribute("title")).toContain("not yet checked against FHFH's power-play clock");
  });
});
