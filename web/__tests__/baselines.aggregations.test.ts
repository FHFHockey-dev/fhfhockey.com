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
