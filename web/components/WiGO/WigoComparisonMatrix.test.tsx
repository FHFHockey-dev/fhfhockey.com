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
});
