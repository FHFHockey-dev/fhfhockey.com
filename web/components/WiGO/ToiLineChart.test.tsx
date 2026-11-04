import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import ToiLineChart from "./ToiLineChart";

const { gameLog } = vi.hoisted(() => ({ gameLog: { data: [] as any[] } }));
vi.mock("hooks/useWigoGameLog", () => ({
  default: () => ({ data: gameLog.data, isLoading: false, error: null })
}));
vi.mock("hooks/useWigoPlayerTotals", () => ({
  default: () => ({ data: { toi_per_game: 1500, pp_toi_pct_per_game: 0.4 }, isLoading: false, error: null })
}));
vi.mock("chartjs-plugin-zoom", () => ({ default: {} }));
vi.mock("react-chartjs-2", () => ({
  Line: ({ options }: any) => <output data-testid="toi-options">{JSON.stringify(options.scales.yTime)}</output>
}));
afterEach(cleanup);

describe("ToiLineChart", () => {
  it("lets a game above 30:00 extend the time axis instead of clipping it", async () => {
    gameLog.data = [
      { game_id: 1, date: "2026-01-01", toi_per_game: 1500, pp_toi_per_game: 120, pp_toi_pct_per_game: 0.4 },
      { game_id: 2, date: "2026-01-03", toi_per_game: 2160, pp_toi_per_game: 200, pp_toi_pct_per_game: 0.45 }
    ];
    render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <ToiLineChart playerId={1} seasonId={20252026} />
      </QueryClientProvider>
    );
    const axis = JSON.parse((await screen.findByTestId("toi-options")).textContent!);
    expect(axis.max).toBeUndefined();
    expect(axis.suggestedMax).toBe(1800);
    expect(axis.min).toBe(0);
  });
});
