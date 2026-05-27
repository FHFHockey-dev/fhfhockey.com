import { describe, expect, it } from "vitest";

import { buildSustainabilityJoinedFeatureRow } from "./dataJoins";

describe("sustainability data joins", () => {
  it("joins rolling, baseline, season total, WGO, and NST rows as of the snapshot", () => {
    const row = buildSustainabilityJoinedFeatureRow({
      playerId: 10,
      snapshotDate: "2026-03-10",
      metricKey: "ixg_per_60",
      rollingRows: [
        {
          player_id: 10,
          game_date: "2026-03-09",
          season: 20252026,
          strength_state: "all",
          ixg_per_60_last5: 0.9,
        },
        {
          player_id: 10,
          game_date: "2026-03-11",
          season: 20252026,
          strength_state: "all",
          ixg_per_60_last5: 9.9,
        },
      ],
      baselineRows: [
        {
          player_id: 10,
          snapshot_date: "2026-03-08",
          season_id: 20252026,
          win_season_prev: { ixg_per_60: 0.6 },
          win_3yr: { ixg_per_60: 0.55 },
          win_career: { ixg_per_60: 0.5 },
        },
      ],
      seasonTotals: [
        {
          player_id: 10,
          season_id: 20252026,
          ixg_per_60: 0.62,
        },
      ],
      wgoRows: [
        {
          player_id: 10,
          date: "2026-03-09",
          ixg: 0.4,
        },
      ],
      nstRows: [
        {
          player_id: 10,
          date: "2026-03-09",
          ixg_per_60: 0.88,
        },
      ],
    });

    expect(row).toMatchObject({
      playerId: 10,
      snapshotDate: "2026-03-10",
      seasonId: 20252026,
      metricKey: "ixg_per_60",
      baseline: {
        season: 0.6,
        threeYear: 0.55,
        career: 0.5,
      },
      warnings: [],
    });
    expect(row.rolling?.game_date).toBe("2026-03-09");
  });

  it("keeps missing-source warnings explicit", () => {
    const row = buildSustainabilityJoinedFeatureRow({
      playerId: 10,
      snapshotDate: "2026-03-10",
      metricKey: "ixg_per_60",
      rollingRows: [],
      baselineRows: [],
      seasonTotals: [],
      wgoRows: [],
      nstRows: [],
    });

    expect(row.warnings).toEqual([
      "missing_rolling_metric_row",
      "missing_baseline_row",
      "missing_season_total_row",
      "missing_wgo_row",
      "missing_nst_row",
    ]);
  });
});
