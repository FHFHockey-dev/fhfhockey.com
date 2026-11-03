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

    fireEvent.click(screen.getByRole("button", { name: "Show Goals game log" }));
    expect(screen.getByRole("button", { name: "Hide Goals game log" }).getAttribute("aria-expanded")).toBe("true");

    await waitFor(() => {
      expect(
        screen.getByText("Failed to load game log for Goals.")
      ).toBeTruthy();
    });

    fireEvent.click(screen.getByRole("button", { name: "Show Assists game log" }));

    await waitFor(() => {
      expect(screen.queryByText("Failed to load game log for Goals.")).toBeNull();
    });
  });
});

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { within } from "@testing-library/react";
import WigoComparisonMatrix, { COMPARISON_PERIODS, MATRIX_GROUPS } from "./WigoComparisonMatrix";
import { WIGO_STAT_ORDER } from "./statMetadata";
import { formatCell, computeDiffColumn, formatDiffPercent } from "./tableUtils";

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
  fireEvent.click(within(screen.getByText(label).closest("tr")!).getByRole("button", { name: new RegExp(`^(Show|Hide) ${label} game log$`) }));
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
    expect(screen.queryByRole("button", { name: "Hide Goals game log" })).toBeNull();
    expandStat("Goals");
    await screen.findByText("No game log data available for this season.");
    expect(mockFetchPlayerGameLogForStat).toHaveBeenLastCalledWith(player, season, "Goals");
    await act(async () => oldLog.resolve([{ date: "2025-10-01", value: 99 }]));
    expect(screen.getByText("No game log data available for this season.")).toBeTruthy();
    rerender(logTable());
    expect(screen.queryByRole("button", { name: "Hide Goals game log" })).toBeNull();
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

describe("comparison band", () => {
  const BAND_METRICS = MATRIX_GROUPS.flatMap(group => group.metrics.map(metric => metric.label));

  it("preserves all 252 values and 36 differences in one band and selects one reserved chart", async () => {
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
    expect([...BAND_METRICS].sort()).toEqual([...WIGO_STAT_ORDER].sort());
    expect(within(table).getAllByRole("rowheader").map(cell => cell.textContent))
      .toEqual(["STDL", "LY", "CAR", "3YA", "L5", "L10", "L20", "DIFF"]);
    const rows = within(table).getAllByRole("row").slice(2);
    expect(rows).toHaveLength(8);
    COMPARISON_PERIODS.forEach((period, index) => {
      expect(within(rows[index]).getAllByRole("cell").map(cell => cell.textContent))
        .toEqual(BAND_METRICS.map(label => formatCell(data.find(entry => entry.label === label)!, period)));
    });
    const diffCells = within(rows[7]).getAllByRole("cell");
    // DIFF shows no decimal; a difference that rounds to zero is neither up nor down (B-21).
    BAND_METRICS.forEach((label, index) => {
      const diff = data.find(entry => entry.label === label)!.DIFF;
      expect(diffCells[index].textContent).toBe(formatDiffPercent(diff, 0));
      expect(diffCells[index].getAttribute("data-diff-sign")).toBe(
        typeof diff === "number" && Number.isFinite(diff) && Math.round(diff) !== 0 ? (diff < 0 ? "negative" : "positive") : null);
    });
    // Both selectors list periods in the band's row order (B-22).
    for (const name of ["Select left timeframe for comparison", "Select right timeframe for comparison"]) {
      expect(Array.from((screen.getByLabelText(name) as HTMLSelectElement).options).map(option => option.value))
        .toEqual([...COMPARISON_PERIODS]);
    }
    expect(screen.queryByRole("button", { name: "GP" })).toBeNull();
    expect(screen.getByRole("button", { name: "SOG/60" }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByRole("button", { name: "SOG/60" }).textContent).toBe("SOG");
    await waitFor(() => expect(mockFetchPlayerGameLogForStat).toHaveBeenCalledWith(1, 20252026, "SOG/60"));
    fireEvent.change(screen.getByLabelText("Select right timeframe for comparison"), { target: { value: "STD" } });
    expect(onCompare).toHaveBeenCalledWith("STD", "STD");
    fireEvent.click(screen.getByRole("button", { name: "Goals" }));
    await waitFor(() => expect(mockFetchPlayerGameLogForStat).toHaveBeenCalledWith(1, 20252026, "Goals"));
    expect(container.querySelectorAll("#wigo-selected-stat")).toHaveLength(1);
    expect(screen.getAllByRole("button", { name: /^Toggle .* reference$/ })).toHaveLength(7);
  });
});
