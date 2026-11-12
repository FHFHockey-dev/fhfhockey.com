import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ConsistencyChart from "./ConsistencyChart";
import useWigoGameLog from "hooks/useWigoGameLog";

const { fetchLogs, supabaseRows } = vi.hoisted(() => ({ fetchLogs: vi.fn(), supabaseRows: { rows: [] as any[] } }));
vi.mock("utils/fetchWigoPlayerStats", () => ({ fetchPlayerGameLogConsistencyData: fetchLogs }));
// Only the end-to-end D5 test reaches Supabase, through the real reader.
vi.mock("lib/supabase", () => {
  const query: any = {
    select: () => query, eq: () => query, order: () => query,
    then: (resolve: any) => Promise.resolve({ data: supabaseRows.rows, error: null }).then(resolve)
  };
  return { default: { from: () => query } };
});
vi.mock("react-chartjs-2", () => ({ Doughnut: ({ data }: any) => <output data-testid="distribution">{JSON.stringify(data)}</output> }));
afterEach(cleanup);
const game = (points: number | null, shots: number | null = 0) => ({ date: "2026-01-01", points, shots, hits: 0, blocked_shots: 0 });
function OtherConsumer() {
  const logs = useWigoGameLog(1, 20252026);
  return <span>Shared games: {logs.data?.length}</span>;
}
function mount(shared = false) {
  return render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    <ConsistencyChart playerId={1} seasonId={20252026} />
    {shared && <OtherConsumer />}
  </QueryClientProvider>);
}
const distribution = () => JSON.parse(screen.getByTestId("distribution").textContent!);

describe("Point Consistency", () => {
  beforeEach(() => vi.resetAllMocks());
  it("keeps zero-point games and Cardio separate in the doughnut", async () => {
    fetchLogs.mockResolvedValue([game(0), game(0)]);
    mount();
    await screen.findByTestId("distribution");
    expect(distribution().labels).toEqual(["0 Pts"]);
    expect(distribution().datasets[0].data).toEqual([100]);
    expect(screen.getByText("Cardio:").closest("li")?.title).toContain("not a separate doughnut segment");
  });
  it("includes every bucket through an outlier and shares the cached request", async () => {
    fetchLogs.mockResolvedValue([game(0), game(1), game(7)]);
    mount(true);
    await screen.findByTestId("distribution");
    expect(distribution().labels).toHaveLength(8);
    expect(distribution().labels[7]).toBe("7 Pts");
    expect(distribution().datasets[0].data.reduce((sum: number, value: number) => sum + value, 0)).toBeCloseTo(100);
    expect(within(screen.getByText("7 Pts:").closest("li")!).getByText("(1)")).toBeTruthy();
    expect(fetchLogs).toHaveBeenCalledTimes(1);
  });
  it("preserves points distribution when only a Cardio field is missing", async () => {
    fetchLogs.mockResolvedValue([game(0, null), game(1)]);
    mount();
    await screen.findByTestId("distribution");
    expect(distribution().datasets[0].data).toEqual([50, 50]);
    expect(screen.getByText("Cardio unavailable: incomplete activity stats.").getAttribute("role")).toBe("status");
    expect(screen.queryByText("Cardio:")).toBeNull();
  });
  it.each([null, -1, 1.5, Infinity])("does not fabricate a bucket for invalid points %s", async points => {
    fetchLogs.mockResolvedValue([game(points)]);
    mount();
    await screen.findByText("Consistency unavailable: incomplete game data.");
    expect(screen.queryByTestId("distribution")).toBeNull();
  });
  it("shows an empty state for no games", async () => {
    fetchLogs.mockResolvedValue([]);
    mount();
    await screen.findByText("No games found for this season.");
    expect(screen.queryByTestId("distribution")).toBeNull();
  });
  it("counts only the season's regular-season games, end to end through the shared calendar (D5)", async () => {
    const actual = await vi.importActual<typeof import("utils/fetchWigoPlayerStats")>("utils/fetchWigoPlayerStats");
    fetchLogs.mockImplementation(actual.fetchPlayerGameLogConsistencyData);
    const row = { points: 0, shots: 1, hits: 0, blocked_shots: 0, toi_per_game: 900, pp_toi_per_game: 0, pp_toi_pct_per_game: 0, team_abbrev: "EDM" };
    supabaseRows.rows = [
      { ...row, game_id: 2025020001, date: "2025-10-08" },
      { ...row, game_id: 2025030111, date: "2026-04-20", points: 3 }, // playoff game labelled 2025-26
      { ...row, game_id: 2024020999, date: "2025-04-10", points: 2 } // 2024-25 game labelled 2025-26
    ];
    mount();
    await screen.findByTestId("distribution");
    // Before the fix the doughnut ran to "3 Pts" over three games.
    expect(distribution().labels).toEqual(["0 Pts"]);
  });
});
