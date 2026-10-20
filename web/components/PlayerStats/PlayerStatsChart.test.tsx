import React from "react";
import { cleanup, render, screen } from "@testing-library/react";
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
});
