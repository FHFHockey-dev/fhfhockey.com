import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createDefaultGoalieLandingFilterState } from "lib/underlying-stats/goalieStatsQueries";

import PlayerStatsExpandedRowChart from "./PlayerStatsExpandedRowChart";

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