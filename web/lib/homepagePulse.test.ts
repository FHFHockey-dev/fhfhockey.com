import { describe, expect, it, vi } from "vitest";

import {
  buildHomepagePulsePoints,
  fetchHomepagePulse,
  selectHomepagePulseSlateDates,
  type HomepagePulseModel,
  type HomepagePulsePrediction,
} from "./homepagePulse";

const PRODUCTION: HomepagePulseModel = {
  model_name: "nhl_game_model",
  model_version: "v7",
  feature_set_version: "game_features_v5",
};

function prediction(
  overrides: Partial<HomepagePulsePrediction>,
): HomepagePulsePrediction {
  return {
    game_id: 1,
    snapshot_date: "2026-11-11",
    computed_at: "2026-11-11T12:00:00.000Z",
    prediction_cutoff_at: "2026-11-11T12:00:00.000Z",
    home_win_probability: 0.6,
    metadata: {},
    components: {},
    ...PRODUCTION,
    ...overrides,
  };
}

describe("homepage pulse (W3-2 D1, W3-3 D6, decision 109)", () => {
  it("uses today's slate, else yesterday's, and nothing older", () => {
    const rows = [
      prediction({ snapshot_date: "2026-11-11" }),
      prediction({ snapshot_date: "2026-11-10" }),
      prediction({ snapshot_date: "2026-06-17" }),
    ];

    expect(selectHomepagePulseSlateDates(rows, "2026-11-11")).toEqual([
      "2026-11-11",
    ]);
    expect(selectHomepagePulseSlateDates(rows, "2026-11-12")).toEqual([
      "2026-11-11",
    ]);
    // Reason for change: the old rule reached back to the last two active
    // slates of any age (June playoff rows in November).
    expect(selectHomepagePulseSlateDates(rows, "2026-11-13")).toEqual([]);
  });

  it("plots the persisted model-versus-market edge of the production model", () => {
    const points = buildHomepagePulsePoints({
      currentDate: "2026-11-11",
      productionModels: [PRODUCTION],
      predictions: [
        prediction({
          computed_at: "2026-11-11T12:00:00.000Z",
          metadata: { model_vs_market_edge: 0.04 },
        }),
        prediction({
          computed_at: "2026-11-11T12:30:00.000Z",
          home_win_probability: 0.9,
          metadata: { model_vs_market_edge: -0.07 },
        }),
      ],
    });

    expect(points.map((point) => point.value)).toEqual([0.04, 0.07]);
  });

  it("returns [] for a stale slate (June playoff rows in November)", () => {
    const points = buildHomepagePulsePoints({
      currentDate: "2026-11-11",
      productionModels: [PRODUCTION],
      predictions: [
        prediction({
          snapshot_date: "2026-06-17",
          computed_at: "2026-06-17T12:00:00.000Z",
          metadata: { model_vs_market_edge: 0.04 },
        }),
        prediction({
          snapshot_date: "2026-06-17",
          computed_at: "2026-06-17T12:30:00.000Z",
          metadata: { model_vs_market_edge: 0.07 },
        }),
      ],
    });

    expect(points).toEqual([]);
  });

  it("ignores rows from any model that is not in production", () => {
    const points = buildHomepagePulsePoints({
      currentDate: "2026-11-11",
      productionModels: [PRODUCTION],
      predictions: [
        prediction({
          model_version: "v6_roster_ctpi_sos_threshold_52",
          computed_at: "2026-11-11T12:00:00.000Z",
          metadata: { model_vs_market_edge: 0.04 },
        }),
        prediction({
          feature_set_version: "game_features_v4",
          computed_at: "2026-11-11T12:30:00.000Z",
          metadata: { model_vs_market_edge: 0.07 },
        }),
      ],
    });

    expect(points).toEqual([]);
  });

  it("keeps one series meaning: no distance-from-50% fallback without market data", () => {
    // Reason for change: the old fallback plotted |p - 0.5| under the same
    // unlabelled line that otherwise shows |p - market|.
    const points = buildHomepagePulsePoints({
      currentDate: "2026-11-11",
      productionModels: [PRODUCTION],
      predictions: [
        prediction({ computed_at: "2026-11-11T11:00:00.000Z", home_win_probability: 0.58 }),
        prediction({ computed_at: "2026-11-11T12:00:00.000Z", home_win_probability: 0.63 }),
      ],
    });

    expect(points).toEqual([]);
  });

  it("returns [] with no production game model and never reads prediction history", async () => {
    const from = vi.fn((table: string) => {
      const rows =
        table === "game_prediction_model_versions"
          ? []
          : [prediction({ metadata: { model_vs_market_edge: 0.04 } })];
      const query: any = {
        select: () => query,
        eq: () => query,
        in: () => query,
        gte: () => query,
        lte: () => query,
        not: () => query,
        order: () => query,
        limit: () => query,
        then: (resolve: (value: unknown) => void) =>
          Promise.resolve({ data: rows, error: null }).then(resolve),
      };
      return query;
    });

    await expect(
      fetchHomepagePulse({ supabase: { from } as any, currentDate: "2026-11-11" }),
    ).resolves.toEqual([]);
    expect(from).toHaveBeenCalledWith("game_prediction_model_versions");
    expect(from).not.toHaveBeenCalledWith("game_prediction_history");
  });
});
