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
});
