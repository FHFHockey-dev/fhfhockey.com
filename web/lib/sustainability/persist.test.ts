import { describe, expect, it, vi } from "vitest";
import {
  TREND_BAND_ON_CONFLICT,
  upsertTrendBandRows,
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
