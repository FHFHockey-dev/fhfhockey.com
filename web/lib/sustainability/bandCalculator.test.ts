import { describe, expect, it } from "vitest";

import { computeTrendBandsForPlayer } from "./bandCalculator";

describe("sustainability trend band calculator", () => {
  it("computes snapshot bands with confidence intervals, z-scores, and percentiles", () => {
    const rows = [
      { player_id: 10, season_id: 20252026, date: "2026-03-10", shots: 4, nst_toi: 1200 },
      { player_id: 10, season_id: 20252026, date: "2026-03-08", shots: 3, nst_toi: 1000 },
      { player_id: 10, season_id: 20252026, date: "2026-03-06", shots: 5, nst_toi: 1100 },
    ] as any[];
    const totals = [
      {
        player_id: 10,
        season_id: 20252026,
        shots: 120,
        toi_all_situations: 36_000,
      },
    ] as any[];

    const bands = computeTrendBandsForPlayer({
      playerId: 10,
      snapshotDate: "2026-03-10",
      seasonId: 20252026,
      metrics: ["shots_per_60"],
      windows: ["l3"],
      rows,
      totals,
    });

    expect(bands).toHaveLength(1);
    expect(bands[0]).toMatchObject({
      player_id: 10,
      snapshot_date: "2026-03-10",
      metric_key: "shots_per_60",
      window_code: "l3",
      prior_weight: 360,
    });
    expect(bands[0]?.ci_lower).toBeLessThan(bands[0]?.value ?? 0);
    expect(bands[0]?.ci_upper).toBeGreaterThan(bands[0]?.value ?? 0);
    expect(bands[0]?.z_score).not.toBeNull();
    expect(bands[0]?.percentile).toBeGreaterThanOrEqual(0);
    expect(bands[0]?.percentile).toBeLessThanOrEqual(100);
    expect(bands[0]?.distribution).toMatchObject({
      shape: expect.any(Number),
      rate: expect.any(Number),
      modelVersion: "sustainability_trend_bands_v2",
      configHash: expect.stringMatching(/^fnv1a_/),
      warnings: [],
      fallbackFlags: {},
    });
  });
});
