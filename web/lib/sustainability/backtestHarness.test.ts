import { describe, expect, it, vi } from "vitest";
import {
  loadHistoricalProjectionRows,
  runHistoricalSustainabilityBacktest,
  type HistoricalProjectionRow
} from "./backtestHarness";

function createPagedClient(pages: HistoricalProjectionRow[][]) {
  let page = 0;
  const query: any = {
    select: vi.fn(() => query), eq: vi.fn(() => query), order: vi.fn(() => query),
    gte: vi.fn(() => query), lte: vi.fn(() => query),
    range: vi.fn(async () => ({ data: pages[page++] ?? [], error: null }))
  };
  return { client: { from: vi.fn(() => query) } as any, query };
}

const row = (playerId: number): HistoricalProjectionRow => ({
  player_id: playerId,
  snapshot_date: "2026-01-01",
  metric_key: "goals",
  horizon_games: 5,
  expected_value: playerId / 10
});

describe("historical sustainability backtest harness", () => {
  it("pages projection snapshots until a short page", async () => {
    const { client, query } = createPagedClient([[row(1), row(2)], [row(3)]]);
    const rows = await loadHistoricalProjectionRows({ client, pageSize: 2 });
    expect(rows.map((value) => value.player_id)).toEqual([1, 2, 3]);
    expect(query.range).toHaveBeenNthCalledWith(1, 0, 1);
    expect(query.range).toHaveBeenNthCalledWith(2, 2, 3);
  });

  it("returns an honest unavailable state when no projection history exists", async () => {
    const result = await runHistoricalSustainabilityBacktest({
      rows: [],
      resolveExample: vi.fn()
    });
    expect(result.coverage).toEqual({
      projectionRows: 0,
      resolvedActuals: 0,
      probabilityExamples: 0,
      status: "insufficient_projection_history"
    });
    expect(result.countMetrics.bestByMae).toBeNull();
    expect(result.probabilityMetrics[0].brier).toBeNull();
  });

  it("evaluates persisted predictions against resolved actuals and baselines", async () => {
    const result = await runHistoricalSustainabilityBacktest({
      rows: [row(10)],
      resolveExample: async () => ({
        actual: 1.2,
        careerBaseline: 0.7,
        seasonBaseline: 0.9,
        recentValue: 1.4
      })
    });
    expect(result.coverage.status).toBe("ready");
    expect(result.countMetrics.variants[0]).toMatchObject({ sampleCount: 1, mae: 0.2 });
  });
});
