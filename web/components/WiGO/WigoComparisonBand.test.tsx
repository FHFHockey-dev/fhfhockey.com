import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import WigoComparisonMatrix, { COMPARISON_PERIODS, MATRIX_GROUPS } from "./WigoComparisonMatrix";
import { WIGO_STAT_ORDER } from "./statMetadata";
import { formatCell, computeDiffColumn, formatDiffPercent } from "./tableUtils";

afterEach(cleanup);

const mockFetchPlayerGameLogForStat = vi.hoisted(() => vi.fn());

vi.mock("utils/fetchWigoPlayerStats", () => ({
  fetchPlayerGameLogForStat: mockFetchPlayerGameLogForStat
}));

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
    expect(within(table).getAllByRole("rowheader").map(cell => cell.querySelector("[aria-hidden]")?.textContent))
      .toEqual(["STDL", "LY", "CAR", "3YA", "L5", "L10", "L20", "DIFF"]);
    // Periods and the compared pair are spoken in words, not as bare letters.
    expect(within(table).getAllByRole("rowheader")[0].textContent).toContain("Season to date, left comparison period");
    expect(within(table).getAllByRole("rowheader")[2].textContent).toContain("Career average, right comparison period");
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
    expect(screen.queryByRole("button", { name: "Games played" })).toBeNull();
    const shots60 = screen.getByRole("button", { name: "Shots per 60" });
    expect(shots60.getAttribute("aria-pressed")).toBe("true");
    expect(shots60.textContent).toBe("SOG");
    // One shared action description, not a verb in every header name.
    expect(shots60.getAttribute("aria-describedby")).toBe("wigo-band-action");
    expect(screen.queryAllByRole("button", { name: /game log/ })).toHaveLength(0);
    // Roving tabindex: one button in the tab order; arrows move focus only, Enter selects.
    expect(container.querySelectorAll('thead button[tabindex="0"]')).toHaveLength(1);
    shots60.focus();
    fireEvent.keyDown(shots60, { key: "ArrowRight" });
    const ixg60 = screen.getByRole("button", { name: "Individual expected goals per 60" });
    expect(document.activeElement).toBe(ixg60);
    expect(ixg60.getAttribute("tabindex")).toBe("0");
    expect(shots60.getAttribute("aria-pressed")).toBe("true");
    fireEvent.keyDown(ixg60, { key: "Home" });
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Average time on ice" }));
    fireEvent.keyDown(document.activeElement!, { key: "End" });
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Primary share of points" }));
    await waitFor(() => expect(mockFetchPlayerGameLogForStat).toHaveBeenCalledWith(1, 20252026, "SOG/60"));
    fireEvent.change(screen.getByLabelText("Select right timeframe for comparison"), { target: { value: "STD" } });
    expect(onCompare).toHaveBeenCalledWith("STD", "STD");
    fireEvent.click(screen.getByRole("button", { name: "Goals" }));
    expect(container.querySelector("#wigo-selected-stat h3")?.getAttribute("aria-live")).toBe("polite");
    await waitFor(() => expect(mockFetchPlayerGameLogForStat).toHaveBeenCalledWith(1, 20252026, "Goals"));
    expect(container.querySelectorAll("#wigo-selected-stat")).toHaveLength(1);
    // The chart loads lazily (S8), so wait for its toggles.
    expect(await screen.findAllByRole("button", { name: /^Toggle .* reference$/ }, { timeout: 5000 })).toHaveLength(7);
  });
});
