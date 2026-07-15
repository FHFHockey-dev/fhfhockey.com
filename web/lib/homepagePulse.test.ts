import { describe, expect, it } from "vitest";

import {
  buildHomepagePulsePoints,
  selectHomepagePulseSlateDates,
  type HomepagePulsePrediction,
} from "./homepagePulse";

function prediction(
  overrides: Partial<HomepagePulsePrediction>,
): HomepagePulsePrediction {
  return {
    game_id: 1,
    snapshot_date: "2026-06-17",
    computed_at: "2026-06-17T12:00:00.000Z",
    prediction_cutoff_at: "2026-06-17T12:00:00.000Z",
    home_win_probability: 0.6,
    metadata: {},
    components: {},
    ...overrides,
  };
}

describe("homepage pulse", () => {
  it("uses the current slate when active and the last two active slates otherwise", () => {
    const rows = [
      prediction({ snapshot_date: "2026-06-17" }),
      prediction({ snapshot_date: "2026-06-14" }),
      prediction({ snapshot_date: "2026-06-11" }),
    ];

    expect(selectHomepagePulseSlateDates(rows, "2026-06-17")).toEqual([
      "2026-06-17",
    ]);
    expect(selectHomepagePulseSlateDates(rows, "2026-07-14")).toEqual([
      "2026-06-17",
      "2026-06-14",
    ]);
  });

  it("prefers model-versus-market edge when it is persisted", () => {
    const points = buildHomepagePulsePoints({
      currentDate: "2026-06-17",
      predictions: [
        prediction({
          computed_at: "2026-06-17T12:00:00.000Z",
          metadata: { model_vs_market_edge: 0.04 },
        }),
        prediction({
          computed_at: "2026-06-17T12:30:00.000Z",
          home_win_probability: 0.9,
          metadata: { model_vs_market_edge: -0.07 },
        }),
      ],
    });

    expect(points.map((point) => point.value)).toEqual([0.04, 0.07]);
  });

  it("uses real model movement across the last two slates before market history exists", () => {
    const points = buildHomepagePulsePoints({
      currentDate: "2026-07-14",
      predictions: [
        prediction({
          snapshot_date: "2026-06-14",
          computed_at: "2026-06-13T12:00:00.000Z",
          home_win_probability: 0.58,
        }),
        prediction({
          snapshot_date: "2026-06-14",
          computed_at: "2026-06-14T12:00:00.000Z",
          home_win_probability: 0.61,
        }),
        prediction({
          snapshot_date: "2026-06-17",
          computed_at: "2026-06-16T12:00:00.000Z",
          home_win_probability: 0.57,
        }),
        prediction({
          snapshot_date: "2026-06-17",
          computed_at: "2026-06-17T12:00:00.000Z",
          home_win_probability: 0.63,
        }),
        prediction({
          snapshot_date: "2026-06-11",
          computed_at: "2026-06-11T12:00:00.000Z",
          home_win_probability: 0.99,
        }),
      ],
    });

    expect(points).toHaveLength(4);
    expect(points[0].value).toBeCloseTo(0.08);
    expect(points[1].value).toBeCloseTo(0.11);
    expect(points[2].value).toBeCloseTo(0.07);
    expect(points[3].value).toBeCloseTo(0.13);
  });
});
