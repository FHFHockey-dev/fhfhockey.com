import { describe, expect, it, vi } from "vitest";

import {
  assignSustainabilityQuintiles,
  buildSustainabilityDistributionSnapshot,
  persistSustainabilityDistributionSnapshots,
  toSustainabilityDistributionSnapshotRows,
} from "./distribution";

describe("sustainability distribution snapshot", () => {
  it("returns deterministic summary statistics and interpolated percentiles", () => {
    expect(
      buildSustainabilityDistributionSnapshot([100, 0, 50, 75, 25]),
    ).toEqual({
      count: 5,
      minimum: 0,
      maximum: 100,
      mean: 50,
      stdev: 35.3553,
      percentiles: {
        p10: 10,
        p20: 20,
        p25: 25,
        p40: 40,
        p50: 50,
        p60: 60,
        p75: 75,
        p80: 80,
        p90: 90,
      },
    });
  });

  it("ignores non-finite values and returns null for an empty population", () => {
    expect(
      buildSustainabilityDistributionSnapshot([Number.NaN, 60]),
    ).toMatchObject({ count: 1, mean: 60 });
    expect(buildSustainabilityDistributionSnapshot([])).toBeNull();
  });

  it("assigns deterministic zero-based quintiles from the complete window population", () => {
    const snapshot = buildSustainabilityDistributionSnapshot([
      10, 20, 30, 40, 50,
    ])!;
    expect(
      assignSustainabilityQuintiles(
        [10, 20, 30, 40, 50].map((s_100, index) => ({
          player_id: index + 1,
          window_code: "l10",
          s_100,
        })),
        { l10: snapshot },
      ).map((row) => row.sustainability_quintile),
    ).toEqual([0, 1, 2, 3, 4]);
  });

  it("matches ntile tie ordering by score then player id", () => {
    const snapshot = buildSustainabilityDistributionSnapshot([
      50, 50, 50, 50, 50, 50, 50,
    ])!;
    const rows = [7, 1, 6, 2, 5, 3, 4].map((player_id) => ({
      player_id,
      window_code: "l10",
      s_100: 50,
    }));
    const assigned = assignSustainabilityQuintiles(rows, { l10: snapshot });
    expect(
      [...assigned]
        .sort((left, right) => left.player_id - right.player_id)
        .map((row) => row.sustainability_quintile),
    ).toEqual([0, 0, 1, 1, 2, 3, 4]);
  });

  it("persists one reproducible snapshot per populated window and keeps dry runs inert", async () => {
    const upsert = vi.fn().mockResolvedValue({ error: null });
    const client = { from: vi.fn(() => ({ upsert })) };
    const snapshot = buildSustainabilityDistributionSnapshot([20, 40, 60])!;
    const rows = toSustainabilityDistributionSnapshotRows({
      configRevision: 2,
      modelVersion: "sustainability_score_v2",
      configHash: "fnv1a_91691726",
      seasonId: 20252026,
      snapshotDate: "2026-04-16",
      snapshots: { l10: snapshot, l20: null },
    });

    expect(rows).toHaveLength(1);
    expect(
      await persistSustainabilityDistributionSnapshots({
        client: client as never,
        rows,
        dry: true,
      }),
    ).toBe(0);
    expect(upsert).not.toHaveBeenCalled();
    expect(
      await persistSustainabilityDistributionSnapshots({
        client: client as never,
        rows,
        dry: false,
      }),
    ).toBe(1);
    expect(upsert).toHaveBeenCalledWith(rows, {
      onConflict: "config_revision,season_id,snapshot_date,window_code",
    });
  });
});
