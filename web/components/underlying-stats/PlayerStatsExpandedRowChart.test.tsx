import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createDefaultGoalieLandingFilterState } from "lib/underlying-stats/goalieStatsQueries";

import PlayerStatsExpandedRowChart, {
  buildExpandedRowChartData,
  getExpandedRowChartSummaryLabels,
} from "./PlayerStatsExpandedRowChart";

vi.mock("recharts", () => ({
  Area: () => null,
  Bar: () => null,
  Brush: () => null,
  CartesianGrid: () => null,
  ComposedChart: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  Line: () => null,
  Tooltip: () => null,
  XAxis: () => null,
  YAxis: () => null,
}));

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("PlayerStatsExpandedRowChart", () => {
  it("uses the dedicated goalie chart endpoint and goalie-specific loading copy", async () => {
    const pendingFetch = vi.fn(
      () => new Promise<Response>(() => {})
    );
    vi.stubGlobal("fetch", pendingFetch);

    render(
      <PlayerStatsExpandedRowChart
        playerId={8475883}
        splitTeamId={9}
        state={createDefaultGoalieLandingFilterState({ currentSeasonId: 20252026 })}
        variant="goalie"
        metricColumns={[
          {
            key: "savePct",
            label: "SV%",
            sortKey: "savePct",
            format: "percentage",
            align: "right",
          },
        ]}
        selectedMetricKey="savePct"
        onMetricChange={vi.fn()}
      />
    );

    await waitFor(() => {
      expect(screen.getByText("Loading goalie trend...")).toBeTruthy();
    });

    expect(pendingFetch).toHaveBeenCalledWith(
      "/api/v1/underlying-stats/goalies/8475883/chart?fromSeasonId=20252026&throughSeasonId=20252026&seasonType=regularSeason&strength=fiveOnFive&scoreState=allScores&statMode=goalies&displayMode=counts&venue=all&tradeMode=combine&scope=none&sortKey=savePct&sortDirection=desc&page=1&pageSize=50&splitTeamId=9",
      expect.objectContaining({ signal: expect.any(AbortSignal) })
    );
  });
});

describe("buildExpandedRowChartData (W2-2 D19)", () => {
  const games = [
    { gameId: 1, gameDate: "2025-10-10", saves: 1, shotsAgainst: 1, savePct: 1, goalsAgainst: 0, toiSeconds: 3600, gaa: 0 },
    { gameId: 2, gameDate: "2025-10-12", saves: 5, shotsAgainst: 10, savePct: 0.5, goalsAgainst: 5, toiSeconds: 1200, gaa: 15 },
  ] as any[];

  it("pools SV% over the window instead of averaging game ratios", () => {
    const [, second] = buildExpandedRowChartData(games, "savePct");
    expect(second.seasonAverage).toBeCloseTo(6 / 11, 10);
    expect(second.rolling5).toBeCloseTo(6 / 11, 10);
    expect(getExpandedRowChartSummaryLabels("savePct").season).toBe("Window (pooled)");
  });

  it("pools GAA by TOI and leaves a window with an unknown exposure unknown", () => {
    const [, second] = buildExpandedRowChartData(games, "gaa");
    expect(second.seasonAverage).toBeCloseTo((5 * 3600) / 4800, 10);
    const withUnknown = buildExpandedRowChartData(
      [games[0], { ...games[1], toiSeconds: null }],
      "gaa"
    );
    expect(withUnknown[1].seasonAverage).toBeNull();
  });

  it("labels count metrics as a mean per game", () => {
    const [, second] = buildExpandedRowChartData(games, "saves");
    expect(second.seasonAverage).toBe(3);
    expect(getExpandedRowChartSummaryLabels("saves").season).toBe("Mean per game");
  });
});
