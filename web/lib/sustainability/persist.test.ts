import { describe, expect, it, vi } from "vitest";
import {
  SUSTAINABILITY_PROJECTION_ON_CONFLICT,
  TREND_BAND_ON_CONFLICT,
  toSustainabilityProjectionRow,
  upsertSustainabilityProjectionRows,
  upsertTrendBandRows,
  type SustainabilityProjectionRow,
  type TrendBandRow
} from "./persist";

function buildRow(index: number): TrendBandRow {
  return {
    player_id: 1000 + index,
    snapshot_date: "2026-03-09",
    metric_key: `metric_${index}`,
    window_code: "l5",
    value: index,
    ci_lower: index - 0.25,
    ci_upper: index + 0.25
  };
}

function buildCompositeKey(row: TrendBandRow): string {
  return [
    row.player_id,
    row.snapshot_date,
    row.metric_key,
    row.window_code
  ].join("|");
}

describe("upsertTrendBandRows", () => {
  it("uses the composite trend-band conflict key", async () => {
    const upsert = vi.fn().mockResolvedValue({ error: null });
    const client = {
      from: vi.fn().mockReturnValue({ upsert })
    };

    const result = await upsertTrendBandRows({
      rows: [buildRow(1)],
      client: client as any
    });

    expect(client.from).toHaveBeenCalledWith("sustainability_trend_bands");
    expect(upsert).toHaveBeenCalledWith([buildRow(1)], {
      onConflict: TREND_BAND_ON_CONFLICT
    });
    expect(result).toEqual({ inserted: 1, chunks: 1 });
  });

  it("chunks large upserts", async () => {
    const upsert = vi.fn().mockResolvedValue({ error: null });
    const client = {
      from: vi.fn().mockReturnValue({ upsert })
    };
    const rows = Array.from({ length: 5 }, (_, index) => buildRow(index));

    const result = await upsertTrendBandRows({
      rows,
      client: client as any,
      chunkSize: 2
    });

    expect(upsert).toHaveBeenCalledTimes(3);
    expect(upsert.mock.calls[0][0]).toHaveLength(2);
    expect(upsert.mock.calls[1][0]).toHaveLength(2);
    expect(upsert.mock.calls[2][0]).toHaveLength(1);
    expect(result).toEqual({ inserted: 5, chunks: 3 });
  });

  it("is idempotent across repeated upserts on the same composite key", async () => {
    const storedRows = new Map<string, TrendBandRow>();
    const upsert = vi.fn().mockImplementation(async (rows: TrendBandRow[]) => {
      for (const row of rows) {
        storedRows.set(buildCompositeKey(row), row);
      }
      return { error: null };
    });
    const client = {
      from: vi.fn().mockReturnValue({ upsert })
    };

    const originalRow = buildRow(7);
    const updatedRow = {
      ...originalRow,
      value: 99,
      ci_lower: 98.5,
      ci_upper: 99.5
    };

    const firstResult = await upsertTrendBandRows({
      rows: [originalRow],
      client: client as any
    });
    const secondResult = await upsertTrendBandRows({
      rows: [updatedRow],
      client: client as any
    });

    expect(firstResult).toEqual({ inserted: 1, chunks: 1 });
    expect(secondResult).toEqual({ inserted: 1, chunks: 1 });
    expect(storedRows.size).toBe(1);
    expect(storedRows.get(buildCompositeKey(originalRow))).toEqual(updatedRow);
    expect(upsert).toHaveBeenNthCalledWith(1, [originalRow], {
      onConflict: TREND_BAND_ON_CONFLICT
    });
    expect(upsert).toHaveBeenNthCalledWith(2, [updatedRow], {
      onConflict: TREND_BAND_ON_CONFLICT
    });
  });

  it("propagates upsert errors from the conflict path", async () => {
    const expectedError = new Error("duplicate-key conflict");
    const upsert = vi.fn().mockResolvedValue({ error: expectedError });
    const client = {
      from: vi.fn().mockReturnValue({ upsert })
    };

    await expect(
      upsertTrendBandRows({
        rows: [buildRow(2)],
        client: client as any
      })
    ).rejects.toThrow("duplicate-key conflict");
  });
});

describe("sustainability projection persistence", () => {
  it("serializes snapshot and opponent-game projections to the SQL contract", () => {
    expect(
      toSustainabilityProjectionRow({
        playerId: 8478402,
        snapshotDate: "2026-03-09",
        metricKey: "goals",
        horizonGames: 5,
        expectedValue: 2.4,
        band50: { lower: 1, upper: 3 },
        band80: { lower: 0, upper: 5 }
      })
    ).toMatchObject({
      player_id: 8478402,
      projection_type: "snapshot",
      scope_key: "overall",
      game_id: null,
      opponent_team_id: null,
      band50_lower: 1,
      band50_upper: 3
    });

    expect(
      toSustainabilityProjectionRow({
        playerId: 8478402,
        snapshotDate: "2026-03-09",
        metricKey: "shots",
        horizonGames: 1,
        expectedValue: 3.1,
        projectionType: "opponent_game",
        gameId: 2025021001,
        opponentTeamId: 8
      })
    ).toMatchObject({
      projection_type: "opponent_game",
      scope_key: "game:2025021001",
      game_id: 2025021001,
      opponent_team_id: 8
    });
  });

  it("rejects invalid horizons, bands, and incomplete opponent-game scope", () => {
    const base = {
      playerId: 1,
      snapshotDate: "2026-03-09",
      metricKey: "goals",
      horizonGames: 5,
      expectedValue: 1
    };

    expect(() =>
      toSustainabilityProjectionRow({ ...base, horizonGames: 11 })
    ).toThrow("horizonGames");
    expect(() =>
      toSustainabilityProjectionRow({
        ...base,
        band50: { lower: 3, upper: 2 }
      })
    ).toThrow("band50");
    expect(() =>
      toSustainabilityProjectionRow({
        ...base,
        projectionType: "opponent_game",
        gameId: 2025021001
      })
    ).toThrow("opponent_game");
  });

  it("chunks projection upserts on the full composite key", async () => {
    const upsert = vi.fn().mockResolvedValue({ error: null });
    const client = { from: vi.fn().mockReturnValue({ upsert }) };
    const rows = Array.from({ length: 3 }, (_, index) =>
      toSustainabilityProjectionRow({
        playerId: 1000 + index,
        snapshotDate: "2026-03-09",
        metricKey: "goals",
        horizonGames: 5,
        expectedValue: index
      })
    ) as SustainabilityProjectionRow[];

    const result = await upsertSustainabilityProjectionRows({
      rows,
      client: client as any,
      chunkSize: 2
    });

    expect(upsert).toHaveBeenCalledTimes(2);
    expect(upsert).toHaveBeenNthCalledWith(1, rows.slice(0, 2), {
      onConflict: SUSTAINABILITY_PROJECTION_ON_CONFLICT
    });
    expect(result).toEqual({ inserted: 3, chunks: 2 });
  });
});
