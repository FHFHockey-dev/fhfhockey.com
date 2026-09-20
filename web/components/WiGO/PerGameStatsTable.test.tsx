import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import PerGameStatsTable from "./PerGameStatsTable";
import useWigoPlayerTotals from "hooks/useWigoPlayerTotals";

afterEach(cleanup);

const mockFetchPlayerPerGameTotals = vi.hoisted(() => vi.fn());

vi.mock("utils/fetchWigoPlayerStats", () => ({
  fetchPlayerPerGameTotals: mockFetchPlayerPerGameTotals
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

describe("PerGameStatsTable", () => {
  beforeEach(() => {
    mockFetchPlayerPerGameTotals.mockReset();
  });

  it("keeps shooting percentage aligned with the canonical WiGO formatter", async () => {
    mockFetchPlayerPerGameTotals.mockResolvedValue({
      player_id: 1,
      games_played: 10,
      goals: 5,
      assists: 7,
      points: 12,
      shots: 40,
      shooting_percentage: 12.5,
      pp_points: 4,
      hits: 8,
      blocked_shots: 6,
      penalty_minutes: 2,
      season: "20242025",
      toi_per_game: 900,
      points_per_game: 1.2,
      pp_toi_pct_per_game: 35
    });

    renderWithClient(<PerGameStatsTable playerId={1} seasonId={20242025} />);

    await waitFor(() => {
      expect(screen.getByText("12.5%")).toBeTruthy();
    });

    expect(screen.getByText("Season production")).toBeTruthy();
    expect(screen.getByText("20242025")).toBeTruthy();
    const goalsRow = screen.getByRole("rowheader", { name: "G" }).closest("tr")!;
    expect(within(goalsRow).getByText("42")).toBeTruthy();
    const pointsRow = screen.getByRole("rowheader", { name: "PTS" }).closest("tr")!;
    expect(within(pointsRow).getByText("101")).toBeTruthy();
  });

  it("does not expose dependency details when stats fail", async () => {
    mockFetchPlayerPerGameTotals.mockRejectedValue(
      new Error("relation private_stats does not exist")
    );

    renderWithClient(<PerGameStatsTable playerId={1} seasonId={20242025} />);

    await waitFor(() => {
      expect(
        screen.getByText("Unable to load player stats right now.")
      ).toBeTruthy();
    });
    expect(screen.queryByText(/private_stats/)).toBeNull();
  });

  it("waits for a season instead of displaying latest totals as current", () => {
    renderWithClient(<PerGameStatsTable playerId={1} seasonId={null} />);
    expect(screen.getByText("Loading season info...")).toBeTruthy();
    expect(mockFetchPlayerPerGameTotals).not.toHaveBeenCalled();
  });

  it("uses unrounded points per game for the snapshot and 84-game pace", async () => {
    mockFetchPlayerPerGameTotals.mockResolvedValue({
      games_played: 21, goals: 14, assists: 28, points: 42,
      points_per_game: 999, shots: 70, shooting_percentage: 20, season: "20262027"
    });
    const { container } = renderWithClient(<PerGameStatsTable playerId={1} seasonId={20262027} />);
    await screen.findByText("2.00 / GP");
    expect(within(container).getByRole("rowheader", { name: "PTS" }).closest("tr")?.textContent).toBe("PTS2.00168");
    expect(within(container).getByRole("rowheader", { name: "S%" }).closest("tr")?.textContent).toBe("S%20.0%-");
  });

  it("does not produce infinite rates when GP is zero", async () => {
    mockFetchPlayerPerGameTotals.mockResolvedValue({ games_played: 0, points: 0, season: "20262027" });
    renderWithClient(<PerGameStatsTable playerId={1} seasonId={20262027} />);
    await waitFor(() => expect(mockFetchPlayerPerGameTotals).toHaveBeenCalled());
    expect(screen.queryByText(/Infinity|NaN/)).toBeNull();
  });

  it.each([[0, 10, "0.0%"], [2, 10, "20.0%"], [0, 0, "-"], [null, 10, "-"]])(
    "derives S%% from %s goals / %s shots without projecting it",
    async (goals, shots, expected) => {
      mockFetchPlayerPerGameTotals.mockResolvedValue({ games_played: 5, goals, shots, shooting_percentage: 99, season: "20252026" });
      renderWithClient(<PerGameStatsTable playerId={1} seasonId={20252026} />);
      await waitFor(() => expect(screen.getByRole("rowheader", { name: "GP" }).closest("tr")?.textContent).toBe("GP5-"));
      expect(screen.getByRole("rowheader", { name: "S%" }).closest("tr")?.textContent).toBe(`S%${expected}-`);
    }
  );

  it("deduplicates totals across panels and isolates player and season changes", async () => {
    mockFetchPlayerPerGameTotals.mockImplementation(async (playerId, seasonId) => ({
      player_id: playerId, season: String(seasonId), points: playerId
    }));
    function TotalsConsumer({ playerId, seasonId }: { playerId: number; seasonId: number }) {
      const totals = useWigoPlayerTotals(playerId, seasonId);
      return <span>{totals.data ? `${totals.data.player_id}/${totals.data.season}` : "loading"}</span>;
    }
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const view = (playerId: number, seasonId: number) => <QueryClientProvider client={client}>
      {[1, 2, 3].map(key => <TotalsConsumer key={key} playerId={playerId} seasonId={seasonId} />)}
    </QueryClientProvider>;
    const { rerender } = render(view(1, 20252026));
    await waitFor(() => expect(screen.getAllByText("1/20252026")).toHaveLength(3));
    expect(mockFetchPlayerPerGameTotals).toHaveBeenCalledTimes(1);
    rerender(view(2, 20262027));
    expect(screen.queryByText("1/20252026")).toBeNull();
    await waitFor(() => expect(screen.getAllByText("2/20262027")).toHaveLength(3));
    expect(mockFetchPlayerPerGameTotals).toHaveBeenCalledTimes(2);
    rerender(view(1, 20252026));
    expect(screen.getAllByText("1/20252026")).toHaveLength(3);
    expect(mockFetchPlayerPerGameTotals).toHaveBeenCalledTimes(2);
  });
});

describe("unavailable counts versus valid zeroes", () => {
  it("does not project missing totals as zero or forecast GP", async () => {
    mockFetchPlayerPerGameTotals.mockResolvedValue({ games_played: 10, goals: null, assists: 0, points: null, shots: 0, season: "20252026" });
    const { container } = renderWithClient(<PerGameStatsTable playerId={2} seasonId={20252026} />);
    await waitFor(() => expect(within(container).getByRole("rowheader", { name: "GP" }).closest("tr")?.textContent).toBe("GP10-"));
    expect(within(container).getByRole("rowheader", { name: "G" }).closest("tr")?.textContent).toBe("G--");
    expect(within(container).getByRole("rowheader", { name: "SOG" }).closest("tr")?.textContent).toBe("SOG0.000");
  });
});
