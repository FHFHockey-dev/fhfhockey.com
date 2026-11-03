import React from "react";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import StatsTableRowChart, { formatGameMeanLabel, gameLogMean, niceGameLogTicks } from "./StatsTableRowChart";

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

    expect(screen.getByTitle("STD: 12.5%")).toBeTruthy();
  });

  it("formats TOI averages in mm:ss instead of raw seconds", () => {
    render(
      <StatsTableRowChart
        playerId={1}
        seasonId={20242025}
        statLabel="ATOI"
        gameLogData={[{ date: "2025-01-01", value: 900 }]}
        averages={{ STD: 900 }}
        gpData={{ STD: 1 }}
        isLoading={false}
        error={null}
        tableType="COUNTS"
      />
    );

    expect(screen.getByTitle("STD: 15:00")).toBeTruthy();
  });

  it("labels the dashed line as a game mean formatted like its stat", () => {
    expect(formatGameMeanLabel("S%", 12.345)).toBe("Game mean: 12.3%");
    expect(formatGameMeanLabel("ATOI", 1215)).toBe("Game mean: 20:15");
    expect(formatGameMeanLabel("Goals", 0.4)).toBe("Game mean: 0.40");
    expect(formatGameMeanLabel("SOG/60", 8.976)).toBe("Game mean: 8.98");
  });

  it("draws counts as bars and rates as straight segments that keep missing games as gaps", () => {
    const { container, rerender } = render(
      <StatsTableRowChart playerId={1} seasonId={20252026} statLabel="Goals" tableType="COUNTS" isLoading={false} error={null}
        gameLogData={[{ date: "2026-01-01", value: 1 }, { date: "2026-01-03", value: null }, { date: "2026-01-05", value: 0 }]}
        averages={{}} height={200} />
    );
    // Recharts renders no SVG without a measured size in jsdom, so check what each form asks for.
    expect(container.querySelector('[aria-label="Goals by game"]')).toBeTruthy();
    rerender(
      <StatsTableRowChart playerId={1} seasonId={20252026} statLabel="SOG/60" tableType="RATES" isLoading={false} error={null}
        gameLogData={[{ date: "2026-01-01", value: 9 }, { date: "2026-01-03", value: null }]}
        averages={{}} height={200} />
    );
    expect(container.querySelector('[aria-label="SOG/60 by game"]')).toBeTruthy();
    expect(gameLogMean([{ date: "a", value: 9 }, { date: "b", value: null }, { date: "c", value: 3 }])).toBe(6);
  });

  it("gives round y ticks from zero, whole numbers for counts", () => {
    expect(niceGameLogTicks(3.4, false)).toEqual([0, 1, 2, 3, 4]);
    expect(niceGameLogTicks(3, true)).toEqual([0, 1, 2, 3]);
    expect(niceGameLogTicks(22.5, false)).toEqual([0, 10, 20, 30]);
    expect(niceGameLogTicks(0.62, false)).toEqual([0, 0.2, 0.4, 0.6, 0.8]);
    expect(niceGameLogTicks(0, true)).toEqual([0, 1]);
  });
});
