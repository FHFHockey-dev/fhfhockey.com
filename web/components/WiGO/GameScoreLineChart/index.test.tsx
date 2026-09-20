import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import GameScoreLineChart from "./index";

const { rpc, logs } = vi.hoisted(() => ({ rpc: vi.fn(), logs: vi.fn() }));
vi.mock("lib/supabase/client", () => ({ default: { rpc } }));
vi.mock("utils/fetchWigoPlayerStats", () => ({ fetchPlayerGameLogConsistencyData: logs }));
vi.mock("./RollingAverageChart", () => ({
  default: ({ chartData }: any) => <output data-testid="chart">{JSON.stringify(chartData)}</output>
}));
vi.mock("components/Spinner", () => ({ default: () => <span>Loading</span> }));
afterEach(cleanup);

const dates = Array.from({ length: 10 }, (_, index) => `2026-01-${String(index + 1).padStart(2, "0")}`);
const mount = () => render(
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    <GameScoreLineChart playerId={1} seasonId={20252026} />
  </QueryClientProvider>
);
const chart = () => JSON.parse(screen.getByTestId("chart").textContent!);

describe("GameScoreLineChart game coverage", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    logs.mockResolvedValue(dates.map(date => ({ date, points: 1 })));
  });

  it("retains a missing RPC game in its actual slot and invalidates affected windows", async () => {
    rpc.mockReturnValue({ order: () => Promise.resolve({ data: dates.flatMap((game_date, index) =>
      index === 2 ? [] : [{ game_date, game_score: index === 0 ? -2 : 1 }]), error: null }) });
    mount();
    await screen.findByText("Game Score unavailable for 1 of 10 games.");
    expect(chart().labels).toHaveLength(10);
    expect(chart().datasets[0].data).toEqual([-2, 1, null, 1, 1, 1, 1, 1, 1, 1]);
    expect(chart().datasets[1].data).toEqual([null, null, null, null, null, null, null, 1, 1, 1]);
    expect(chart().datasets[2].data).toEqual(Array(10).fill(null));
  });

  it("does not choose arbitrarily between duplicate score dates", async () => {
    rpc.mockReturnValue({ order: () => Promise.resolve({ data: [
      ...dates.map(game_date => ({ game_date, game_score: 0 })),
      { game_date: dates[4], game_score: 5 }
    ], error: null }) });
    mount();
    await screen.findByText("Game Score unavailable for 1 of 10 games.");
    expect(chart().datasets[0].data[4]).toBeNull();
    expect(chart().datasets[0].data[0]).toBe(0);
  });

  it("shows an error when the canonical game calendar fails", async () => {
    rpc.mockReturnValue({ order: () => Promise.resolve({ data: [], error: null }) });
    logs.mockRejectedValue(new Error("calendar unavailable"));
    mount();
    await waitFor(() => expect(screen.queryByTestId("chart")).toBeNull());
    expect(screen.queryByRole("status")).toBeNull();
  });
});
