import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const { lineMock } = vi.hoisted(() => ({
  lineMock: vi.fn((_props: Record<string, any>) => null)
}));
vi.mock("react-chartjs-2", () => ({ Line: lineMock }));

import { PlayerStatsChart } from "./PlayerStatsChart";

const log = [
  { date: "2026-10-01", games_played: 1, points: 1, shooting_percentage: 0.5, toi_per_game: 1095 },
  { date: "2026-10-03", games_played: 1, points: null, shooting_percentage: null, toi_per_game: 960 }
];

const panelProps = () =>
  lineMock.mock.calls.map(([props]) => props as Record<string, any>);

describe("PlayerStatsChart unit panels", () => {
  afterEach(() => {
    cleanup();
    lineMock.mockClear();
  });

  it("draws counts, percentages and TOI on separate labelled panels", () => {
    render(
      <PlayerStatsChart
        gameLog={log as any}
        selectedStats={["points", "shooting_percentage", "toi_per_game"]}
        title="Performance Trends"
      />
    );

    expect(screen.getByText("Counts")).toBeTruthy();
    expect(screen.getByText("Percentages")).toBeTruthy();
    expect(screen.getByText("Time on ice")).toBeTruthy();

    const [counts, percent, toi] = panelProps();
    expect(counts.data.datasets.map((d: any) => d.label)).toEqual(["P"]);
    // Missing values are gaps, never zero.
    expect(counts.data.datasets[0].data).toEqual([1, null]);

    expect(percent.data.datasets[0].data[0]).toBeCloseTo(50);
    expect(percent.data.datasets[0].data[1]).toBeNull();
    expect(percent.options.scales.y.min).toBe(0);
    expect(percent.options.scales.y.max).toBe(100);
    expect(percent.options.scales.y.title.text).toBe("%");

    expect(toi.data.datasets[0].data[0]).toBeCloseTo(18.25);
    expect(toi.options.scales.y.title.text).toBe("Minutes");
    expect(toi.options.scales.y.ticks.callback(18.25)).toBe("18:15");
  });

  it("rolling averages leave gaps where the window has no values", () => {
    const rolling = [
      { date: "2026-10-01", games_played: 1, points: null, points_5game_avg: null },
      { date: "2026-10-03", games_played: 1, points: 2, points_5game_avg: 2 }
    ];
    render(
      <PlayerStatsChart
        gameLog={rolling as any}
        selectedStats={["points"]}
        showRollingAverage
      />
    );
    const [counts] = panelProps();
    expect(counts.data.datasets[1].label).toBe("P (5-game avg)");
    expect(counts.data.datasets[1].data).toEqual([null, 2]);
  });

  it("the season-average toggle draws one indexed panel; the unit split is the default", () => {
    const season = [1, 2, 3, 4, 5, 6].map((points, i) => ({
      date: `2026-10-0${i + 1}`,
      games_played: 1,
      points,
      toi_per_game: 1200
    }));
    render(
      <PlayerStatsChart
        gameLog={season.slice(-3) as any}
        seasonGameLog={season as any}
        selectedStats={["points", "toi_per_game"]}
      />
    );
    // Default: per-unit panels.
    expect(screen.getByText("Counts")).toBeTruthy();
    expect(screen.getByText("Time on ice")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Actual values" }).getAttribute("aria-pressed")).toBe("true");

    lineMock.mockClear();
    fireEvent.click(screen.getByRole("button", { name: "Relative to season average" }));
    expect(screen.queryByText("Counts")).toBeNull();
    const [relative] = panelProps();
    expect(relative.options.scales.y.title.text).toBe("Index (100 = season average)");
    // The window shows the last 3 games, indexed with full-season context.
    expect(relative.data.labels).toHaveLength(3);
    const points = relative.data.datasets.find((d: any) => d.label === "P");
    expect(points.data[0]).toBeNull(); // game 4: fewer than 5 games so far
    expect(points.data[1]).toBeCloseTo((3 / 3.5) * 100);
    expect(points.data[2]).toBeCloseTo((4 / 3.5) * 100);
    const toi = relative.data.datasets.find((d: any) => d.label === "TOI");
    expect(toi.data[2]).toBeCloseTo(100);
    expect(
      relative.options.plugins.tooltip.callbacks.label({
        dataset: points,
        parsed: { y: 114.3 }
      })
    ).toBe("P: 114 (100 = season average)");
  });
});
