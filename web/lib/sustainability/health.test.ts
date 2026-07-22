import { describe, expect, it, vi } from "vitest";

import { loadSustainabilityHealth } from "./health";

function createClient(args?: { failingTable?: string }) {
  const from = vi.fn((table: string) => ({
    select: (_columns: string, options?: { head?: boolean }) => {
      if (options?.head) {
        return Promise.resolve(
          table === args?.failingTable
            ? { count: null, error: new Error(`${table} count failed`) }
            : {
                count: table === "sustainability_projections" ? 0 : 12,
                error: null,
              },
        );
      }

      const query = {
        order: () => query,
        limit: () => query,
        maybeSingle: () =>
          Promise.resolve({
            data:
              table === "sustainability_projections"
                ? null
                : { snapshot_date: "2026-07-22" },
            error: null,
          }),
      };
      return query;
    },
  }));

  return { from };
}

describe("loadSustainabilityHealth", () => {
  it("returns exact counts and latest snapshot dates for canonical output tables", async () => {
    const client = createClient();

    await expect(
      loadSustainabilityHealth(client as any, "2026-07-22T18:00:00.000Z"),
    ).resolves.toEqual({
      generatedAt: "2026-07-22T18:00:00.000Z",
      tables: {
        sustainability_scores: {
          latestSnapshotDate: "2026-07-22",
          rowCount: 12,
        },
        sustainability_trend_bands: {
          latestSnapshotDate: "2026-07-22",
          rowCount: 12,
        },
        sustainability_projections: {
          latestSnapshotDate: null,
          rowCount: 0,
        },
      },
    });

    expect(client.from.mock.calls.map(([table]) => table)).toEqual([
      "sustainability_scores",
      "sustainability_scores",
      "sustainability_trend_bands",
      "sustainability_trend_bands",
      "sustainability_projections",
      "sustainability_projections",
    ]);
  });

  it("fails closed when an exact count cannot be loaded", async () => {
    const client = createClient({ failingTable: "sustainability_trend_bands" });

    await expect(loadSustainabilityHealth(client as any)).rejects.toThrow(
      "sustainability_trend_bands count failed",
    );
  });
});
