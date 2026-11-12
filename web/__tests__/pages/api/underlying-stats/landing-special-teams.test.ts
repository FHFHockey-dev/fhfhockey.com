import { describe, expect, it, vi } from "vitest";
import type { NextApiRequest, NextApiResponse } from "next";

// Served-route proof for W2-P0-6: the landing PP%/PK% is pooled season to date.
const tables = vi.hoisted(() => ({
  seasons: [
    { id: 20252026, startDate: "2025-10-07", endDate: "2026-06-20", regularSeasonEndDate: "2026-04-16" },
    { id: 20262027, startDate: "2026-10-06", endDate: "2027-06-20", regularSeasonEndDate: "2027-04-15" },
  ],
  teams: [
    { id: 1, abbreviation: "NJD", name: "New Jersey Devils" },
    { id: 2, abbreviation: "NYI", name: "New York Islanders" },
    { id: 3, abbreviation: "NYR", name: "New York Rangers" },
  ],
  wgo_team_stats: [
    { id: 1, team_id: 1, franchise_name: null, date: "2026-10-12", game_id: 2026020030, season_id: 20262027, power_play_goals_for: 0, pp_opportunities: 0, pp_goals_against: 0, times_shorthanded: 0, power_play_pct: null, penalty_kill_pct: null },
    { id: 2, team_id: 1, franchise_name: null, date: "2026-10-10", game_id: 2026020010, season_id: 20262027, power_play_goals_for: 2, pp_opportunities: 8, pp_goals_against: 1, times_shorthanded: 4, power_play_pct: 0.25, penalty_kill_pct: 0.75 },
    { id: 3, team_id: 2, franchise_name: null, date: "2026-10-11", game_id: 2026020020, season_id: 20262027, power_play_goals_for: 2, pp_opportunities: 8, pp_goals_against: 0, times_shorthanded: 3, power_play_pct: 0.25, penalty_kill_pct: 1 },
    { id: 4, team_id: 3, franchise_name: null, date: "2026-04-10", game_id: 2025021300, season_id: 20252026, power_play_goals_for: 3, pp_opportunities: 3, pp_goals_against: 0, times_shorthanded: 2, power_play_pct: 1, penalty_kill_pct: 1 },
  ],
}));

vi.mock("../../../../lib/supabase/server", () => {
  const from = (table: string) => {
    let rows = [...(((tables as any)[table] ?? []) as Array<Record<string, any>>)];
    const builder: any = {
      select: () => builder,
      eq: (column: string, value: unknown) => ((rows = rows.filter((row) => row[column] === value)), builder),
      in: (column: string, values: unknown[]) => ((rows = rows.filter((row) => values.includes(row[column]))), builder),
      lte: (column: string, value: any) => ((rows = rows.filter((row) => row[column] <= value)), builder),
      gte: (column: string, value: any) => ((rows = rows.filter((row) => row[column] >= value)), builder),
      lt: (column: string, value: any) => ((rows = rows.filter((row) => row[column] < value)), builder),
      order: (column: string, options?: { ascending?: boolean }) => {
        const sign = options?.ascending === false ? -1 : 1;
        rows = [...rows].sort((l, r) => (l[column] < r[column] ? -sign : l[column] > r[column] ? sign : 0));
        return builder;
      },
      limit: (count: number) => ((rows = rows.slice(0, count)), builder),
      range: (start: number, end: number) => Promise.resolve({ data: rows.slice(start, end + 1), error: null }),
      then: (resolve: (value: unknown) => unknown) => Promise.resolve({ data: rows, error: null }).then(resolve),
    };
    return builder;
  };
  return { default: { from } };
});
vi.mock("../../../../lib/underlying-stats/availableSnapshotDates", () => ({
  fetchDistinctUnderlyingStatsSnapshotDates: vi.fn(async () => ["2026-10-12"]),
}));
vi.mock("../../../../lib/underlying-stats/ulsRouteStatus", () => ({
  fetchUlsRouteStatus: vi.fn(async () => null),
}));
vi.mock("../../../../lib/underlying-stats/teamScheduleStrength", () => ({
  fetchUnderlyingStatsTeamScheduleStrengthForRatings: vi.fn(async () => new Map()),
}));
vi.mock("../../../../lib/teamRatingsTrend", () => ({
  deriveTeamFormContextForDate: vi.fn(async () => new Map()),
  computeTrendOverridesFromHistory: vi.fn(() => new Map()),
}));
vi.mock("../../../../lib/teamRatingsService", () => ({
  isValidIsoDate: (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value),
  fetchTeamRatings: vi.fn(async (date: string) =>
    ["NJD", "NYI", "NYR"].map((teamAbbr) => ({
      teamAbbr,
      date,
      offRating: 100,
      defRating: 100,
      paceRating: 100,
      ppTier: 2,
      pkTier: 2,
      trend10: 0,
      components: { xgf60: 1, gf60: 1, sf60: 1, xga60: 1, ga60: 1, sa60: 1, pace60: 1 },
      finishingRating: null,
      goalieRating: null,
      dangerRating: null,
      specialRating: null,
      disciplineRating: null,
      varianceFlag: null,
    }))
  ),
}));

import handler from "../../../../pages/api/underlying-stats/landing";

describe("GET /api/underlying-stats/landing special teams (W2-P0-6)", () => {
  it("serves pooled season-to-date PP%/PK% with competition ranks and unknowns unranked", async () => {
    const res = { setHeader: vi.fn(), status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() };
    await handler(
      { method: "GET", query: { date: "2026-10-12" } } as unknown as NextApiRequest,
      res as unknown as NextApiResponse
    );

    expect(res.status).toHaveBeenCalledWith(200);
    const ratings = res.json.mock.calls[0][0].initialSnapshot.ratings as Array<{
      teamAbbr: string;
      ppPct: number | null;
      ppRank: number | null;
      pkPct: number | null;
      pkRank: number | null;
    }>;
    const byTeam = new Map(ratings.map((rating) => [rating.teamAbbr, rating]));

    // NJD's latest game had no PP (null): pooled 2/8 = 25%, not 0% ranked last.
    expect(byTeam.get("NJD")?.ppPct).toBeCloseTo(25, 10);
    expect(byTeam.get("NJD")?.pkPct).toBeCloseTo(75, 10);
    // Equal pooled PP% share one competition rank.
    expect(byTeam.get("NJD")?.ppRank).toBe(1);
    expect(byTeam.get("NYI")?.ppRank).toBe(1);
    expect(byTeam.get("NYI")?.pkRank).toBe(1);
    expect(byTeam.get("NJD")?.pkRank).toBe(2);
    // NYR has no 2026-27 game: unknown, never last season's 100%.
    expect(byTeam.get("NYR")?.ppPct).toBeNull();
    expect(byTeam.get("NYR")?.ppRank).toBeNull();
  });
});
