import { describe, it, expect } from "vitest";
import {
  computeBlendFromSeasons,
  buildBaselinePayload
} from "lib/baselines/aggregations";

describe("baselines aggregations", () => {
  it("computeBlendFromSeasons blends top-3 seasons with correct weights", () => {
    const seasons = [
      { season_id: 2024, nst_ixg: 30, nst_toi: 1800, games_played: 40 },
      { season_id: 2023, nst_ixg: 20, nst_toi: 1500, games_played: 35 },
      { season_id: 2022, nst_ixg: 10, nst_toi: 1200, games_played: 30 }
    ];
    const res = computeBlendFromSeasons(seasons, "nst_ixg", "nst_toi");
    // weights: 0.6,0.3,0.1 => blendedNumer = 0.6*30 + 0.3*20 + 0.1*10 = 18 + 6 + 1 = 25
    // blendedDenom = 0.6*1800 + 0.3*1500 + 0.1*1200 = 1080 + 450 + 120 = 1650
    expect(res).toBeTruthy();
    expect(res!.numer).toBeCloseTo(25, 6);
    expect(res!.denom).toBeCloseTo(1650, 6);
    expect(res!.rate).toBeCloseTo(25 / 1650, 12);
  });

  it("buildBaselinePayload produces win_3yr and win_career entries", () => {
    const seasons = [
      {
        season_id: 2024,
        nst_ixg: 30,
        nst_toi: 1800,
        games_played: 40,
        goals: 10,
        shots: 100
      },
      {
        season_id: 2023,
        nst_ixg: 20,
        nst_toi: 1500,
        games_played: 35,
        goals: 8,
        shots: 80
      },
      {
        season_id: 2022,
        nst_ixg: 10,
        nst_toi: 1200,
        games_played: 30,
        goals: 5,
        shots: 60
      }
    ];
    const rows_all: any[] = [];
    const p = buildBaselinePayload({
      player_id: "1",
      snapshot_date: "2025-09-30",
      rows_all,
      seasonTotals: seasons
    });
    expect(p.win_3yr).toBeTruthy();
    expect(p.win_career).toBeTruthy();
    expect(p.win_3yr["nst_ixg_per_60"]).toBeTruthy();
    expect(p.win_career["nst_ixg_per_60"]).toBeTruthy();
    expect(p.win_career["nst_ixg_per_60"].numer).toBeGreaterThan(0);
    expect(p.win_career["nst_ixg_per_60"].denom).toBeGreaterThan(0);
  });
});

const strengthSeasons = [
  {
    season_id: 2024, games_played: 21,
    points_5v5: 10, toi_5v5_total: 6000, ev_time_on_ice: 9000,
    toi_per_game_5v5: 6000 / 21, points_per_60_5v5: 6,
    pp_points: 3, pp_goals: 1, pp_shots: 12, pp_toi: 1200,
    pp_points_per_60: 9, pp_goals_per_60: 3, pp_shots_per_60: 36
  },
  {
    season_id: 2023, games_played: 15,
    points_5v5: 2, toi_5v5_total: 3000, ev_time_on_ice: 6000,
    toi_per_game_5v5: 200, points_per_60_5v5: 2.4,
    pp_points: 2, pp_goals: 0, pp_shots: 6, pp_toi: 600,
    pp_points_per_60: 12, pp_goals_per_60: 0, pp_shots_per_60: 36
  },
  {
    season_id: 2022, games_played: 5,
    points_5v5: 0, toi_5v5_total: 1000, ev_time_on_ice: 3000,
    toi_per_game_5v5: 200, points_per_60_5v5: 0,
    pp_points: 0, pp_goals: 0, pp_shots: 3, pp_toi: 300,
    pp_points_per_60: 0, pp_goals_per_60: 0, pp_shots_per_60: 36
  }
];

describe("matched-strength season baselines", () => {
  it.each([
    ["points_per_60_5v5", 6.6, 4600, 12, 10000],
    ["pp_points_per_60", 2.4, 930, 5, 2100],
    ["pp_goals_per_60", 0.6, 930, 1, 2100],
    ["pp_shots_per_60", 9.3, 930, 21, 2100]
  ])("pools season counts using only %s's matching total ice time",
    (metric, weightedCount, weightedToi, totalCount, totalToi) => {
      const result = buildBaselinePayload({
        player_id: "1", snapshot_date: "2025-09-30", rows_all: [],
        seasonTotals: strengthSeasons
      });
      expect(result.win_3yr[metric].mu).toBeCloseTo(3600 * weightedCount / weightedToi, 5);
      expect(result.win_3yr[metric].n).toBe(3);
      expect(result.win_career[metric]).toMatchObject({ numer: totalCount, denom: totalToi, n: 3 });
      expect(result.win_career[metric].mu).toBeCloseTo(3600 * totalCount / totalToi, 5);
  });

  it("keeps known zero counts and skips unpaired values without shifting recency slots", () => {
    const result = buildBaselinePayload({
      player_id: "1", snapshot_date: "2025-09-30", rows_all: [],
      seasonTotals: [
        { ...strengthSeasons[0], points_5v5: null, pp_toi: null },
        strengthSeasons[1],
        strengthSeasons[2],
        { ...strengthSeasons[0], season_id: 2021 }
      ]
    });
    expect(result.win_3yr.points_per_60_5v5).toMatchObject({ n: 2 });
    expect(result.win_3yr.points_per_60_5v5.mu).toBeCloseTo(2.16, 5);
    expect(result.win_3yr.pp_goals_per_60).toMatchObject({ mu: 0, n: 2 });
    expect(result.win_career.pp_goals_per_60).toMatchObject({ mu: expect.closeTo(3600 / 2100, 5), n: 3 });
  });

  it("leaves unmatched season rates unknown instead of substituting other exposure", () => {
    const result = buildBaselinePayload({
      player_id: "1", snapshot_date: "2025-09-30", rows_all: [],
      seasonTotals: [
        { ...strengthSeasons[0], pp_toi: 0, toi_5v5_total: undefined },
        { ...strengthSeasons[1], pp_toi: null, toi_5v5_total: null },
        { ...strengthSeasons[2], pp_toi: -1, toi_5v5_total: 0 },
        { ...strengthSeasons[0], season_id: 2021 }
      ]
    });
    for (const metric of ["points_per_60_5v5", "pp_points_per_60", "pp_goals_per_60", "pp_shots_per_60"]) {
      expect(result.win_3yr[metric]).toBeUndefined();
      expect(result.win_career[metric].n).toBe(1);
    }
  });
});
