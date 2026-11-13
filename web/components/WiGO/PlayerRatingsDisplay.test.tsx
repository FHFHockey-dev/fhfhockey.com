import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { RawStatsCollection } from "components/WiGO/types";
import { RATING_WEIGHTS } from "components/WiGO/ratingWeights";
import PlayerRatingsDisplay from "./PlayerRatingsDisplay";

afterEach(cleanup);

const mockFetchRawStatsForAllStrengths = vi.hoisted(() => vi.fn());
const mockFetchSkaterPositionGroups = vi.hoisted(() => vi.fn());

vi.mock("utils/fetchWigoRatingStats", () => ({
  fetchRawStatsForAllStrengths: mockFetchRawStatsForAllStrengths,
  fetchSkaterPositionGroups: mockFetchSkaterPositionGroups
}));

// Fixture skaters: 91, 1, 2 and 3 are forwards; 44 and 7 are defensemen.
const POSITIONS = new Map([[91, "F"], [1, "F"], [2, "F"], [3, "F"], [44, "D"], [7, "D"]]);
// Small fixtures predate the PP/PK minutes floor; they switch it off to test other rules.
const NO_ST_FLOOR = { pp: 0, pk: 0 };

// A rating needs every weighted stat (A3). Fixtures written with one stat per side
// get every other weighted stat in the same player order (sign-flipped where higher
// is better), so each stat's percentile, and so the rating, equals the one stat's.
function withAllWeightedStats(raw: RawStatsCollection): RawStatsCollection {
  const out: RawStatsCollection = {};
  for (const [strength, sides] of Object.entries(raw) as [keyof RawStatsCollection, NonNullable<RawStatsCollection["as"]>][]) {
    const fill = (rows: any[], type: "offense" | "defense") => rows.map((row) => {
      const weights = RATING_WEIGHTS[strength]?.[type] ?? [];
      const base = weights.find((w) => typeof row[w.stat] === "number");
      if (!base) return row;
      const value = row[base.stat] as number;
      const filled = { ...row };
      for (const w of weights) {
        if (filled[w.stat] === undefined) filled[w.stat] = w.higherIsBetter === base.higherIsBetter ? value : -value;
      }
      return filled;
    });
    out[strength] = { offense: fill(sides.offense, "offense"), defense: fill(sides.defense, "defense") };
  }
  return out;
}

// The small fixtures below predate the minimum cohort; most tests switch it off and one turns it on.
const cohortRule = vi.hoisted(() => ({ minPeers: 0 }));
vi.mock("utils/calculateWigoRatings", async (importOriginal) => ({
  ...(await importOriginal<typeof import("utils/calculateWigoRatings")>()),
  get WIGO_RATING_MIN_COHORT_PEERS() {
    return cohortRule.minPeers;
  }
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

describe("PlayerRatingsDisplay", () => {
  beforeEach(() => {
    mockFetchRawStatsForAllStrengths.mockReset();
    mockFetchSkaterPositionGroups.mockReset();
    mockFetchSkaterPositionGroups.mockResolvedValue(POSITIONS);
    cohortRule.minPeers = 0;
  });

  it("shows no rating rather than 50.0 when the cohort is only the selected player", async () => {
    cohortRule.minPeers = 20;
    const alone = [{ player_id: 91, season: 20252026, gp: 3, toi_seconds: 300, total_points_per_60: 4, xga_per_60: 1, gf_per_60: 3, ga_per_60: 2 }];
    mockFetchRawStatsForAllStrengths.mockResolvedValue({
      as: { offense: alone, defense: alone },
      es: { offense: alone, defense: alone },
      pp: { offense: alone, defense: [] },
      pk: { offense: [], defense: alone }
    });

    renderWithClient(<PlayerRatingsDisplay playerId={91} seasonId={20252026} minGp={10} />);

    await waitFor(() => expect(screen.getByText("Offense")).toBeTruthy());
    expect(screen.queryByText("50.0")).toBeNull();
    expect(screen.getAllByText("-")).toHaveLength(9);
    expect(screen.queryAllByRole("meter")).toHaveLength(0);
  });

  it("explains the blank All ratings when all-situations data is empty, with a season label", async () => {
    const rows = [91, 2, 3].map((player_id, index) => ({
      player_id, season: 20262027, gp: 12, toi_seconds: 800, total_points_per_60: 3 - index, xga_per_60: 1 + index
    }));
    mockFetchRawStatsForAllStrengths.mockResolvedValue(withAllWeightedStats({
      as: { offense: [], defense: [] },
      es: { offense: rows, defense: rows },
      pp: { offense: rows, defense: [] },
      pk: { offense: [], defense: rows }
    }));

    renderWithClient(<PlayerRatingsDisplay playerId={91} seasonId={20262027} minGp={10} />);

    await waitFor(() => expect(screen.getByText(/All shows “-”, and Overall uses Even and Special/)).toBeTruthy());
    expect(screen.getByText(/No all-situations data for 2026–27 yet:/)).toBeTruthy();
    expect(screen.queryByText(/20262027/)).toBeNull();
    expect(screen.getAllByTitle("No all-situations data for 2026–27 yet")).toHaveLength(3);
  });

  it("renders ratings for a low-gp forward instead of dropping them from the cohort", async () => {
    const rawStats: RawStatsCollection = {
      as: {
        offense: [
          {
            player_id: 91,
            season: 20242025,
            gp: 5,
            toi_seconds: 500,
            total_points_per_60: 4
          },
          {
            player_id: 2,
            season: 20242025,
            gp: 12,
            toi_seconds: 800,
            total_points_per_60: 2
          },
          {
            player_id: 3,
            season: 20242025,
            gp: 15,
            toi_seconds: 900,
            total_points_per_60: 1
          }
        ],
        defense: [
          {
            player_id: 91,
            season: 20242025,
            gp: 5,
            toi_seconds: 500,
            xga_per_60: 1
          },
          {
            player_id: 2,
            season: 20242025,
            gp: 12,
            toi_seconds: 800,
            xga_per_60: 2
          },
          {
            player_id: 3,
            season: 20242025,
            gp: 15,
            toi_seconds: 900,
            xga_per_60: 3
          }
        ]
      },
      es: {
        offense: [
          {
            player_id: 91,
            season: 20242025,
            gp: 5,
            toi_seconds: 500,
            total_points_per_60: 4
          },
          {
            player_id: 2,
            season: 20242025,
            gp: 12,
            toi_seconds: 800,
            total_points_per_60: 2
          },
          {
            player_id: 3,
            season: 20242025,
            gp: 15,
            toi_seconds: 900,
            total_points_per_60: 1
          }
        ],
        defense: [
          {
            player_id: 91,
            season: 20242025,
            gp: 5,
            toi_seconds: 500,
            xga_per_60: 1
          },
          {
            player_id: 2,
            season: 20242025,
            gp: 12,
            toi_seconds: 800,
            xga_per_60: 2
          },
          {
            player_id: 3,
            season: 20242025,
            gp: 15,
            toi_seconds: 900,
            xga_per_60: 3
          }
        ]
      },
      pp: {
        offense: [
          {
            player_id: 91,
            season: 20242025,
            gp: 2,
            toi_seconds: 100,
            gf_per_60: 8
          },
          {
            player_id: 2,
            season: 20242025,
            gp: 10,
            toi_seconds: 50,
            gf_per_60: 4
          }
        ],
        defense: []
      },
      pk: {
        offense: [],
        defense: [
          {
            player_id: 91,
            season: 20242025,
            gp: 1,
            toi_seconds: 50,
            ga_per_60: 1
          },
          {
            player_id: 2,
            season: 20242025,
            gp: 10,
            toi_seconds: 50,
            ga_per_60: 2
          }
        ]
      }
    };

    mockFetchRawStatsForAllStrengths.mockResolvedValue(withAllWeightedStats(rawStats));

    renderWithClient(
      <PlayerRatingsDisplay playerId={91} seasonId={20242025} minGp={10} stMinMinutes={NO_ST_FLOOR} />
    );

    await waitFor(() => {
      expect(screen.getByText("Offense")).toBeTruthy();
    });

    expect(screen.getAllByText("58.3").length).toBeGreaterThan(0);
    expect(screen.getByText("35.0")).toBeTruthy();
    const meters = screen.getAllByRole("meter");
    expect(meters).toHaveLength(9);
    expect(meters.map((meter) => meter.getAttribute("aria-label"))).toEqual([
      "Offense All", "Offense Even", "Offense PP",
      "Overall All", "Overall Even", "Overall Special",
      "Defense All", "Defense Even", "Defense PK"
    ]);
    for (const meter of meters) {
      expect(meter.getAttribute("min")).toBe("0");
      expect(meter.getAttribute("max")).toBe("100");
      expect(Number(meter.getAttribute("value"))).toBeGreaterThanOrEqual(0);
      expect(Number(meter.getAttribute("value"))).toBeLessThanOrEqual(100);
    }
  });

  it("keeps rendering a defense-first player when power-play offense data is missing", async () => {
    const rawStats: RawStatsCollection = {
      as: {
        offense: [
          {
            player_id: 44,
            season: 20242025,
            gp: 22,
            toi_seconds: 1200,
            total_points_per_60: 1.4
          },
          {
            player_id: 7,
            season: 20242025,
            gp: 22,
            toi_seconds: 1000,
            total_points_per_60: 2.8
          }
        ],
        defense: [
          {
            player_id: 44,
            season: 20242025,
            gp: 22,
            toi_seconds: 1200,
            xga_per_60: 1.1
          },
          {
            player_id: 7,
            season: 20242025,
            gp: 22,
            toi_seconds: 1000,
            xga_per_60: 2.2
          }
        ]
      },
      es: {
        offense: [
          {
            player_id: 44,
            season: 20242025,
            gp: 22,
            toi_seconds: 1100,
            total_points_per_60: 1.1
          },
          {
            player_id: 7,
            season: 20242025,
            gp: 22,
            toi_seconds: 1000,
            total_points_per_60: 2.1
          }
        ],
        defense: [
          {
            player_id: 44,
            season: 20242025,
            gp: 22,
            toi_seconds: 1100,
            xga_per_60: 0.9
          },
          {
            player_id: 7,
            season: 20242025,
            gp: 22,
            toi_seconds: 1000,
            xga_per_60: 1.9
          }
        ]
      },
      pp: {
        offense: [
          {
            player_id: 7,
            season: 20242025,
            gp: 20,
            toi_seconds: 400,
            gf_per_60: 6
          }
        ],
        defense: []
      },
      pk: {
        offense: [],
        defense: [
          {
            player_id: 44,
            season: 20242025,
            gp: 20,
            toi_seconds: 500,
            ga_per_60: 1.2
          },
          {
            player_id: 7,
            season: 20242025,
            gp: 20,
            toi_seconds: 300,
            ga_per_60: 2.4
          }
        ]
      }
    };

    mockFetchRawStatsForAllStrengths.mockResolvedValue(withAllWeightedStats(rawStats));

    renderWithClient(
      <PlayerRatingsDisplay playerId={44} seasonId={20242025} minGp={10} stMinMinutes={NO_ST_FLOOR} />
    );

    await waitFor(() => {
      expect(screen.getByText("Defense")).toBeTruthy();
    });

    const offenseSection = screen.getByText("Offense").closest("div");
    expect(offenseSection).toBeTruthy();
    expect(
      within(offenseSection as HTMLElement).queryByText(
        "No rating data available for this player/season."
      )
    ).toBeNull();
    expect(screen.getAllByText("75.0").length).toBeGreaterThan(0);
  });

  it("withholds a rating whose weighted stats are partly missing and says how much was covered (A3)", async () => {
    // Only Pts/60 (25 of 100 even-strength offense weight units) is published.
    const rows = [1, 2, 3].map((player_id, index) => ({
      player_id, season: 20252026, gp: 30, toi_seconds: 30000, total_points_per_60: 3 - index
    }));
    mockFetchRawStatsForAllStrengths.mockResolvedValue({ es: { offense: rows, defense: [] } });

    renderWithClient(<PlayerRatingsDisplay playerId={1} seasonId={20252026} minGp={10} />);

    await waitFor(() => expect(screen.getByText("Offense")).toBeTruthy());
    // Before the fix: 83.3, the one stat's percentile rescaled to the whole rating.
    expect(screen.queryByText("83.3")).toBeNull();
    expect(screen.getAllByTitle("Insufficient data: 25 of 100 weight units have a percentile")).toHaveLength(1);
  });

  it("shows PP as an insufficient sample below the minutes floor (decision 81)", async () => {
    const ppRow = (player_id: number, minutes: number, value: number) => ({
      player_id, season: 20252026, gp: 40, toi_seconds: minutes * 60,
      gf_per_60: value, xgf_per_60: value, total_points_per_60: value, scf_per_60: value,
      shots_per_60: value, hdgf_per_60: value, penalties_drawn_per_60: value
    });
    mockFetchRawStatsForAllStrengths.mockResolvedValue({
      pp: { offense: [ppRow(91, 20, 9), ppRow(2, 120, 5), ppRow(3, 120, 4)], defense: [] }
    });

    renderWithClient(<PlayerRatingsDisplay playerId={91} seasonId={20252026} minGp={10} stMinMinutes={{ pp: 30, pk: 30 }} />);

    await waitFor(() => expect(screen.getByText("Offense")).toBeTruthy());
    expect(screen.queryAllByRole("meter").map((m) => m.getAttribute("aria-label"))).not.toContain("Offense PP");
    // Wording changed with decision 140: the floor is no longer provisional.
    expect(screen.getByTitle("Insufficient sample: 20 PP min, below the 30-min floor")).toBeTruthy();
  });

  it("excludes 59 PP minutes at the default 60-min floor and marks PK low reliability (decision 140)", async () => {
    const ppRow = (player_id: number, minutes: number, value: number) => ({
      player_id, season: 20252026, gp: 40, toi_seconds: minutes * 60,
      gf_per_60: value, xgf_per_60: value, total_points_per_60: value, scf_per_60: value,
      shots_per_60: value, hdgf_per_60: value, penalties_drawn_per_60: value
    });
    mockFetchRawStatsForAllStrengths.mockResolvedValue({
      pp: { offense: [ppRow(91, 59, 9), ppRow(2, 120, 5), ppRow(3, 120, 4)], defense: [] }
    });

    renderWithClient(<PlayerRatingsDisplay playerId={91} seasonId={20252026} minGp={10} />);

    await waitFor(() => expect(screen.getByText("Offense")).toBeTruthy());
    expect(screen.getByTitle("Insufficient sample: 59 PP min, below the 60-min floor")).toBeTruthy();
    const pkLabel = screen.getAllByTitle(/^Low reliability: PK percentiles/);
    expect(pkLabel).toHaveLength(1);
    expect(pkLabel[0].textContent).toMatch(/^PK\*: Low reliability/);
  });

  it("does not expose dependency details when ratings fail", async () => {
    mockFetchRawStatsForAllStrengths.mockRejectedValue(
      new Error("permission denied for private_ratings")
    );

    renderWithClient(
      <PlayerRatingsDisplay playerId={44} seasonId={20242025} minGp={10} />
    );

    await waitFor(() => {
      expect(
        screen.getByText("Unable to calculate ratings right now.")
      ).toBeTruthy();
    });
    expect(screen.queryByText(/private_ratings/)).toBeNull();
  });

  it("reuses the season cohort when min GP or selected player changes", async () => {
    mockFetchRawStatsForAllStrengths.mockResolvedValue({});
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const view = (playerId: number, minGp: number, seasonId = 20252026) =>
      <QueryClientProvider client={client}>
        <PlayerRatingsDisplay playerId={playerId} seasonId={seasonId} minGp={minGp} />
      </QueryClientProvider>;
    const { rerender } = render(view(1, 10));
    await screen.findByText("No rating data available for this player/season.");
    rerender(view(1, 20));
    rerender(view(2, 20));
    expect(mockFetchRawStatsForAllStrengths).toHaveBeenCalledTimes(1);
    rerender(view(2, 20, 20262027));
    await waitFor(() => expect(mockFetchRawStatsForAllStrengths).toHaveBeenCalledTimes(2));
  });

  it("does not retry the cohort query itself, so a timeout costs one read per page", async () => {
    mockFetchRawStatsForAllStrengths.mockRejectedValue({ code: "57014", message: "canceling statement due to statement timeout" });
    const client = new QueryClient();
    render(<QueryClientProvider client={client}><PlayerRatingsDisplay playerId={1} seasonId={20262027} minGp={10} /></QueryClientProvider>);
    await screen.findByText("Unable to calculate ratings right now.");
    expect(mockFetchRawStatsForAllStrengths).toHaveBeenCalledTimes(1);
  });
});
