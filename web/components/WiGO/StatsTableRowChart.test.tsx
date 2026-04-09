import React from "react";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import StatsTableRowChart from "./StatsTableRowChart";

describe("StatsTableRowChart", () => {
  beforeEach(() => {
    Element.prototype.scrollIntoView = vi.fn();
    (globalThis as any).ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
  });

  it("uses canonical percentage formatting for average toggles", () => {
    render(
      <StatsTableRowChart
        playerId={1}
        seasonId={20242025}
        statLabel="S%"
        gameLogData={[{ date: "2025-01-01", value: 12.5 }]}
        averages={{ STD: 12.5 }}
        isLoading={false}
        error={null}
        tableType="RATES"
      />
    );

    expect(screen.getByText("STD: 12.5%")).toBeTruthy();
  });

  it("formats TOI averages in mm:ss instead of raw seconds", () => {
    render(
      <StatsTableRowChart
        playerId={1}
        seasonId={20242025}
        statLabel="ATOI"
        gameLogData={[{ date: "2025-01-01", value: 900 }]}
        averages={{ STD: 15 }}
        gpData={{ STD: 1 }}
        isLoading={false}
        error={null}
        tableType="COUNTS"
      />
    );

    expect(screen.getByText("STD: 15:00")).toBeTruthy();
  });
});
