import { describe, expect, it, vi } from "vitest";

vi.mock("lib/supabase/server", () => ({ default: {} }));

import { overlayEntityRatingsOnLandingResponse } from "./entityRatingsOverlay";
import { createDefaultLandingFilterState } from "./playerStatsFilters";

const AS_OF = new Date("2025-11-11T15:00:00Z"); // current season 20252026

function fakeClient(rowsByTable: Record<string, unknown[]>) {
  const from = vi.fn((table: string) => {
    const builder: any = {
      select: () => builder,
      in: () => builder,
      order: () => Promise.resolve({ data: rowsByTable[table] ?? [], error: null }),
    };
    return builder;
  });
  return { from } as any;
}

const response = {
  family: "onIceCounts" as const,
  rows: [{ rowKey: "p:1", playerId: 1, playerName: "One" }],
  sort: { sortKey: "cfPct", direction: "desc" as const },
  pagination: { page: 1, pageSize: 50, totalRows: 1, totalPages: 1 },
  placeholder: false,
  generatedAt: AS_OF.toISOString(),
};

describe("overlayEntityRatingsOnLandingResponse (decision 91, W2-2 D14)", () => {
  it("hides the overlay for a historical season without reading ratings", async () => {
    const client = fakeClient({});
    const state = createDefaultLandingFilterState({ currentSeasonId: 20242025 });
    const result = await overlayEntityRatingsOnLandingResponse({
      response,
      variant: "skater",
      client,
      state,
      asOfDate: AS_OF,
    });
    expect(result.ratingsOverlay).toEqual({ status: "hidden", reason: "nonCurrentSeason" });
    expect(result.rows[0]).not.toHaveProperty("offensiveRating");
    expect(client.from).not.toHaveBeenCalled();
  });

  it("hides the overlay for a past date range in the current season", async () => {
    const state = createDefaultLandingFilterState({ currentSeasonId: 20252026 });
    state.expandable.scope = { kind: "dateRange", startDate: "2025-10-01", endDate: "2025-10-31" };
    const result = await overlayEntityRatingsOnLandingResponse({
      response,
      variant: "skater",
      client: fakeClient({}),
      state,
      asOfDate: AS_OF,
    });
    expect(result.ratingsOverlay).toEqual({ status: "hidden", reason: "nonCurrentRange" });
  });

  it("shows current ratings with separate offense and defense snapshot dates", async () => {
    const state = createDefaultLandingFilterState({ currentSeasonId: 20252026 });
    const result = await overlayEntityRatingsOnLandingResponse({
      response,
      variant: "skater",
      client: fakeClient({
        skater_offensive_ratings_daily: [
          { player_id: 1, snapshot_date: "2025-11-10", rating_0_to_100: 70, league_rank: 3, percentile: 90 },
        ],
        skater_defensive_ratings_daily: [
          { player_id: 1, snapshot_date: "2025-11-09", rating_0_to_100: 55, league_rank: 40, percentile: 60 },
        ],
      }),
      state,
      asOfDate: AS_OF,
    });
    expect(result.ratingsOverlay).toEqual({
      status: "current",
      offensiveSnapshotDate: "2025-11-10",
      defensiveSnapshotDate: "2025-11-09",
      goalieSnapshotDate: null,
    });
    expect(result.rows[0]).toMatchObject({
      offensiveRating: 70,
      offensiveRatingSnapshotDate: "2025-11-10",
      defensiveRatingSnapshotDate: "2025-11-09",
    });
  });
});
