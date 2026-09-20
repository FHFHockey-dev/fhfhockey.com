import React from "react";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { TableAggregateData } from "./types";
import StatsTable from "./StatsTable";

afterEach(cleanup);

const mockFetchPlayerGameLogForStat = vi.hoisted(() => vi.fn());

vi.mock("utils/fetchWigoPlayerStats", () => ({
  fetchPlayerGameLogForStat: mockFetchPlayerGameLogForStat
}));

describe("StatsTable", () => {
  beforeEach(() => {
    mockFetchPlayerGameLogForStat.mockReset();
    (globalThis as any).ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
  });

  it("clears stale game-log errors before loading a different stat", async () => {
    const data: TableAggregateData[] = [
      { label: "GP", STD: 10, CA: 10 },
      { label: "Goals", STD: 5, CA: 4 },
      { label: "Assists", STD: 6, CA: 5 }
    ];

    mockFetchPlayerGameLogForStat
      .mockRejectedValueOnce(new Error("boom"))
      .mockResolvedValueOnce([{ date: "2025-01-01", value: 1 }]);

    render(
      <StatsTable
        data={data}
        isLoading={false}
        error={null}
        formatCell={(row, key) => String(row[key] ?? "-")}
        playerId={1}
        currentSeasonId={20242025}
        leftTimeframe="STD"
        rightTimeframe="CA"
      />,
      { wrapper: createLogQueryWrapper() }
    );

    fireEvent.click(screen.getAllByRole("button", { name: "+" })[0]);

    await waitFor(() => {
      expect(
        screen.getByText("Failed to load game log for Goals.")
      ).toBeTruthy();
    });

    fireEvent.click(screen.getAllByRole("button", { name: "+" })[0]);

    await waitFor(() => {
      expect(screen.queryByText("Failed to load game log for Goals.")).toBeNull();
    });
  });
});

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { within } from "@testing-library/react";
import WigoComparisonMatrix, { COMPARISON_PERIODS } from "./WigoComparisonMatrix";
import { WIGO_STAT_ORDER } from "./statMetadata";
import { formatCell, computeDiffColumn } from "./tableUtils";

function createLogQueryWrapper() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };
}

function logTable(playerId = 1, seasonId = 20252026) {
  return <StatsTable
    data={[{ label: "GP", STD: 10 }, { label: "Goals", STD: 5 }, { label: "Assists", STD: 6 }]}
    isLoading={false} error={null} formatCell={(row, key) => String(row[key] ?? "-")}
    playerId={playerId} currentSeasonId={seasonId} leftTimeframe="STD" rightTimeframe="CA"
  />;
}

function pendingLog() {
  let resolve!: (data: Array<{ date: string; value: number }>) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<Array<{ date: string; value: number }>>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function expandStat(label: string) {
  fireEvent.click(within(screen.getByText(label).closest("tr")!).getByRole("button"));
}

describe("standard table log request identity", () => {
  beforeEach(() => mockFetchPlayerGameLogForStat.mockReset());

  it.each(["resolve", "reject"] as const)("ignores a late %s from a previously selected stat", async (outcome) => {
    const oldLog = pendingLog();
    mockFetchPlayerGameLogForStat.mockReturnValueOnce(oldLog.promise).mockResolvedValueOnce([]);
    render(logTable(), { wrapper: createLogQueryWrapper() });
    expandStat("Goals");
    expandStat("Assists");
    await screen.findByText("No game log data available for this season.");
    await act(async () => {
      if (outcome === "resolve") oldLog.resolve([{ date: "2025-10-01", value: 99 }]);
      else oldLog.reject(new Error("Late old request"));
    });
    expect(screen.getByText("No game log data available for this season.")).toBeTruthy();
    expect(screen.queryByText("Failed to load game log for Assists.")).toBeNull();
    expect(screen.queryByText("Failed to load game log for Goals.")).toBeNull();
  });

  it.each(["player", "season"])("closes expansion on a %s change and isolates the next request", async (context) => {
    const oldLog = pendingLog();
    mockFetchPlayerGameLogForStat.mockReturnValueOnce(oldLog.promise).mockResolvedValueOnce([]);
    const { rerender } = render(logTable(), { wrapper: createLogQueryWrapper() });
    expandStat("Goals");
    const player = context === "player" ? 2 : 1;
    const season = context === "season" ? 20262027 : 20252026;
    rerender(logTable(player, season));
    expect(screen.queryByRole("button", { name: "-" })).toBeNull();
    expandStat("Goals");
    await screen.findByText("No game log data available for this season.");
    expect(mockFetchPlayerGameLogForStat).toHaveBeenLastCalledWith(player, season, "Goals");
    await act(async () => oldLog.resolve([{ date: "2025-10-01", value: 99 }]));
    expect(screen.getByText("No game log data available for this season.")).toBeTruthy();
    rerender(logTable());
    expect(screen.queryByRole("button", { name: "-" })).toBeNull();
  });

  it("reuses a fresh log after collapse and reopen", async () => {
    mockFetchPlayerGameLogForStat.mockResolvedValue([]);
    render(logTable(), { wrapper: createLogQueryWrapper() });
    expandStat("Goals");
    await screen.findByText("No game log data available for this season.");
    expandStat("Goals");
    expect(screen.queryByText("No game log data available for this season.")).toBeNull();
    expandStat("Goals");
    await screen.findByText("No game log data available for this season.");
    expect(mockFetchPlayerGameLogForStat).toHaveBeenCalledTimes(1);
  });

  it("does not load a log before player and season are available", () => {
    render(logTable(0, 0), { wrapper: createLogQueryWrapper() });
    expandStat("Goals");
    expect(mockFetchPlayerGameLogForStat).not.toHaveBeenCalled();
  });
});

describe("horizontal comparison matrix", () => {
  it("preserves all 252 values and 36 differences in canonical order and selects one reserved chart", async () => {
    mockFetchPlayerGameLogForStat.mockReset().mockResolvedValue([]);
    const onCompare = vi.fn();
    const data = computeDiffColumn(WIGO_STAT_ORDER.map((label, metric) => ({
      label, ...Object.fromEntries(COMPARISON_PERIODS.map((period, index) => [period, metric === 0 ? 10 : metric === 3 ? null : metric * index]))
    })), "STD", "CA");
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const { container } = render(<QueryClientProvider client={client}><WigoComparisonMatrix
      data={data} isLoadingAggData={false} aggDataError={null} playerId={1} currentSeasonId={20252026}
      leftTimeframe="STD" rightTimeframe="CA" onCompare={onCompare}
    /></QueryClientProvider>);
    const table = screen.getByRole("table");
    expect(within(table).getAllByRole("columnheader")).toHaveLength(37);
    expect(within(table).getAllByRole("columnheader").slice(1).map(cell => cell.textContent)).toEqual([...WIGO_STAT_ORDER]);
    const rows = within(table).getAllByRole("row").slice(1);
    expect(rows).toHaveLength(8);
    COMPARISON_PERIODS.forEach((period, index) => {
      const cells = within(rows[index]).getAllByRole("cell");
      expect(cells).toHaveLength(36);
      expect(cells.map(cell => cell.textContent)).toEqual(data.map(row => formatCell(row, period)));
    });
    expect(within(rows[7]).getAllByRole("cell")).toHaveLength(36);
    expect(within(table).queryByRole("button", { name: "Show GP game log" })).toBeNull();
    expect(screen.getByRole("button", { name: "Show SOG/60 game log" }).getAttribute("aria-pressed")).toBe("true");
    await waitFor(() => expect(mockFetchPlayerGameLogForStat).toHaveBeenCalledWith(1, 20252026, "SOG/60"));
    fireEvent.change(screen.getByLabelText("Select right timeframe for comparison"), { target: { value: "STD" } });
    expect(onCompare).toHaveBeenCalledWith("STD", "STD");
    fireEvent.click(screen.getByRole("button", { name: "Show Goals game log" }));
    await waitFor(() => expect(mockFetchPlayerGameLogForStat).toHaveBeenCalledWith(1, 20252026, "Goals"));
    expect(container.querySelectorAll("#wigo-selected-stat")).toHaveLength(1);
    expect(within(table).getAllByRole("row")).toHaveLength(9);
    expect(screen.getAllByRole("button", { name: /^Toggle .* reference$/ })).toHaveLength(7);
  });
});
