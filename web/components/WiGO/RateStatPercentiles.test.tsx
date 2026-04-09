import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import RateStatPercentiles from "./RateStatPercentiles";

const mockFetchAllPlayerStatsForStrength = vi.hoisted(() => vi.fn());

vi.mock("utils/fetchWigoPercentiles", () => ({
  fetchAllPlayerStatsForStrength: mockFetchAllPlayerStatsForStrength
}));

vi.mock("react-chartjs-2", () => ({
  Bar: ({ data }: { data: unknown }) => (
    <div data-testid="percentile-chart" data-chart={JSON.stringify(data)} />
  )
}));

function renderWithClient(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false
      }
    }
  });

  return render(
    <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>
  );
}

describe("RateStatPercentiles", () => {
  beforeEach(() => {
    mockFetchAllPlayerStatsForStrength.mockReset();
  });

  it("keeps a low-gp scoring forward in the percentile cohort and warns about the threshold", async () => {
    mockFetchAllPlayerStatsForStrength.mockResolvedValue([
      {
        player_id: 91,
        gp: 7,
        toi: 140,
        goals_per_60: 2.4,
        total_assists_per_60: 1.6,
        total_points_per_60: 4,
        shots_per_60: 8,
        iscfs_per_60: 12,
        i_hdcf_per_60: 5,
        ixg_per_60: 1.2,
        icf_per_60: 18,
        scf_per_60: 30,
        oi_hdcf_per_60: 14,
        cf_pct: 0.57,
        sf_pct: 0.56,
        gf_pct: 0.61,
        scf_pct: 0.58,
        hdcf_pct: 0.6
      },
      {
        player_id: 55,
        gp: 22,
        toi: 330,
        goals_per_60: 1.2,
        total_assists_per_60: 1.1,
        total_points_per_60: 2.3,
        shots_per_60: 6,
        iscfs_per_60: 9,
        i_hdcf_per_60: 3,
        ixg_per_60: 0.7,
        icf_per_60: 14,
        scf_per_60: 24,
        oi_hdcf_per_60: 10,
        cf_pct: 0.52,
        sf_pct: 0.51,
        gf_pct: 0.53,
        scf_pct: 0.5,
        hdcf_pct: 0.49
      },
      {
        player_id: 27,
        gp: 25,
        toi: 300,
        goals_per_60: 0.8,
        total_assists_per_60: 0.9,
        total_points_per_60: 1.7,
        shots_per_60: 4,
        iscfs_per_60: 7,
        i_hdcf_per_60: 2,
        ixg_per_60: 0.5,
        icf_per_60: 11,
        scf_per_60: 19,
        oi_hdcf_per_60: 8,
        cf_pct: 0.49,
        sf_pct: 0.48,
        gf_pct: 0.47,
        scf_pct: 0.46,
        hdcf_pct: 0.45
      }
    ]);

    renderWithClient(
      <RateStatPercentiles
        playerId={91}
        seasonId={20242025}
        minGp={10}
        onMinGpChange={vi.fn()}
      />
    );

    await waitFor(() => {
      expect(
        screen.getByText(
          "Selected Player GP (7) below threshold (10). Comparing against 10+ GP players."
        )
      ).toBeTruthy();
    });

    const chartPayload = JSON.parse(
      screen.getByTestId("percentile-chart").getAttribute("data-chart") ?? "{}"
    );

    expect(chartPayload.labels[0]).toBe("TOI/GP");
    expect(chartPayload.datasets[0].data[0]).toBeGreaterThan(50);
    expect(chartPayload.datasets[0].data[1]).toBeGreaterThan(50);
  });

  it("still renders the chart when defense-style percentage inputs are missing", async () => {
    mockFetchAllPlayerStatsForStrength.mockResolvedValue([
      {
        player_id: 77,
        gp: 18,
        toi: 360,
        goals_per_60: 0.4,
        total_assists_per_60: 1.4,
        total_points_per_60: 1.8,
        shots_per_60: 3.5,
        iscfs_per_60: 5,
        i_hdcf_per_60: 1.8,
        ixg_per_60: 0.3,
        icf_per_60: 9,
        scf_per_60: 16,
        oi_hdcf_per_60: 7,
        cf_pct: 0.54,
        sf_pct: 0.55,
        gf_pct: null,
        scf_pct: 0.57,
        hdcf_pct: null
      },
      {
        player_id: 14,
        gp: 20,
        toi: 320,
        goals_per_60: 0.7,
        total_assists_per_60: 1.1,
        total_points_per_60: 1.8,
        shots_per_60: 4.2,
        iscfs_per_60: 7,
        i_hdcf_per_60: 2.1,
        ixg_per_60: 0.5,
        icf_per_60: 12,
        scf_per_60: 18,
        oi_hdcf_per_60: 8,
        cf_pct: 0.5,
        sf_pct: 0.51,
        gf_pct: 0.52,
        scf_pct: 0.53,
        hdcf_pct: 0.54
      }
    ]);

    renderWithClient(
      <RateStatPercentiles
        playerId={77}
        seasonId={20242025}
        minGp={5}
        onMinGpChange={vi.fn()}
      />
    );

    await waitFor(() => {
      expect(screen.getByText("Rate Stat Percentiles")).toBeTruthy();
    });

    const chartPayload = JSON.parse(
      screen.getByTestId("percentile-chart").getAttribute("data-chart") ?? "{}"
    );

    expect(chartPayload.labels).toContain("GF%");
    expect(chartPayload.labels).toContain("HDCF%");
    expect(chartPayload.datasets[0].data).toHaveLength(chartPayload.labels.length);
  });
});
