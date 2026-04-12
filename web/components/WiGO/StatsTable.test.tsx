import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { TableAggregateData } from "./types";
import StatsTable from "./StatsTable";

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
      />
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
