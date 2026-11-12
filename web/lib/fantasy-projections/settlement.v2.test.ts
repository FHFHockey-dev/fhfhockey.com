import { describe, expect, it } from "vitest";

import { aggregateProperSkill } from "./properScore";
import {
  buildRemainingModelManifest,
  evaluateSeasonOutput,
  FANTASY_PROJECTION_SCORING_VERSION,
  scoreSeasonPrimitive,
  type SeasonGameOutput,
} from "./settlement";
import {
  PLAYER_FORECAST_SETTLEMENT_SCORING_VERSION,
  scoreForecast,
  scoreForecastProper,
} from "../player-forecasts/settlement";

// Frozen Poisson(0.2) cohort: 10,000 outcomes in pmf proportions
// (0: 8187, 1: 1637, 2: 164, 3: 11, 4: 1).
const POISSON_02_COHORT = [
  ...Array(8187).fill(0),
  ...Array(1637).fill(1),
  ...Array(164).fill(2),
  ...Array(11).fill(3),
  ...Array(1).fill(4),
];
const BASELINE = 0.5;
// Closed form: E[(X − c)²] = λ + (λ − c)² for X ~ Poisson(λ = 0.2).
const expectedSkill = (forecast: number) =>
  1 - (0.2 + (0.2 - forecast) ** 2) / (0.2 + (0.2 - BASELINE) ** 2);

describe("season settlement scoring v2 (decision 65, W3-5 F7/PR4)", () => {
  it("bumps both scoring versions instead of relabelling issued v1 rows", () => {
    expect(FANTASY_PROJECTION_SCORING_VERSION).toBe("player-forecast-season-accountability-v2");
    expect(PLAYER_FORECAST_SETTLEMENT_SCORING_VERSION).toBe("player-forecast-skill-v2");
  });

  it("ranks the Poisson(0.2) mean above a forecast of 0 by aggregated expected loss", () => {
    const season = (forecast: number) =>
      aggregateProperSkill(
        POISSON_02_COHORT.map((actual) =>
          scoreSeasonPrimitive({ actual, forecast, baselineForecast: BASELINE }),
        ),
      );
    const perGame = (forecast: number) =>
      aggregateProperSkill(
        POISSON_02_COHORT.map((actual) =>
          scoreForecastProper({
            actual,
            pointEstimate: forecast,
            probability: null,
            conditioning: "unconditional",
            baselinePointEstimate: BASELINE,
          }),
        ),
      );
    for (const aggregate of [season, perGame]) {
      const zero = aggregate(0);
      const mean = aggregate(0.2);
      expect(zero.evaluated).toBe(10_000);
      expect(zero.skill!).toBeCloseTo(expectedSkill(0), 2);
      expect(mean.skill!).toBeCloseTo(expectedSkill(0.2), 2);
      expect(mean.skill!).toBeGreaterThan(zero.skill!);
      expect(mean.meanModelSquaredError!).toBeLessThan(zero.meanModelSquaredError!);
    }
    // The v1 per-row MAE index (kept only to reproduce issued rows) prefers 0.
    const v1Index = (forecast: number) =>
      POISSON_02_COHORT.reduce(
        (total, actual) =>
          total +
          scoreForecast({
            actual,
            pointEstimate: forecast,
            probability: null,
            conditioning: "unconditional",
            baselinePointEstimate: BASELINE,
          })!.compositeSkillScore!,
        0,
      ) / POISSON_02_COHORT.length;
    expect(v1Index(0)).toBeGreaterThan(v1Index(0.2));
    expect(
      scoreForecastProper({ actual: 0, pointEstimate: 0, probability: null, conditioning: "unconditional", baselinePointEstimate: 1 })
        ?.compositeSkillScore,
    ).toBeNull();
  });

  it("rejects probabilities outside [0, 1] and non-finite forecasts", () => {
    for (const forecast of [1.2, -0.1, Number.NaN, Number.POSITIVE_INFINITY, null, ""]) {
      expect(scoreSeasonPrimitive({ actual: 1, forecast, baselineForecast: 0.5, probability: true })).toBeNull();
      expect(
        scoreForecastProper({
          actual: 1,
          pointEstimate: null,
          probability: forecast as number,
          conditioning: "playing_probability",
        }),
      ).toBeNull();
    }
    expect(scoreSeasonPrimitive({ actual: 1, forecast: 1, baselineForecast: 0.5, probability: true })).not.toBeNull();
    // An out-of-range baseline is unavailable, not scored.
    expect(
      scoreSeasonPrimitive({ actual: 1, forecast: 0.8, baselineForecast: 1.2, probability: true })?.baselineMetrics,
    ).toEqual({});
  });

  it("treats null, absent, empty, non-finite and reversed bounds as an unavailable interval", () => {
    const bounds: Array<[unknown, unknown]> = [
      [null, null],
      [undefined, 3],
      ["", 3],
      [0, Number.NaN],
      [0, Number.POSITIVE_INFINITY],
      [3, 1],
    ];
    for (const [p10, p90] of bounds) {
      const season = scoreSeasonPrimitive({ actual: 0, forecast: 0.4, baselineForecast: 0.5, p10, p90 })!;
      const perGame = scoreForecastProper({
        actual: 0,
        pointEstimate: 0.4,
        probability: null,
        conditioning: "unconditional",
        quantiles: { p10, p90 },
      })!;
      for (const score of [season, perGame]) {
        expect(score.metrics.interval80Available).toBe(false);
        expect(score.metrics).not.toHaveProperty("interval80Covered");
        expect(score.metrics).not.toHaveProperty("intervalWidth");
      }
    }
    expect(
      scoreSeasonPrimitive({ actual: 2, forecast: 1, baselineForecast: 1, p10: 0, p90: 2 })!.metrics,
    ).toMatchObject({ interval80Available: true, interval80Covered: true, intervalWidth: 2 });
  });
});

describe("season settlement allocation and nulls (W3-5 PR5, L15 ticket)", () => {
  const gameIds = Array.from({ length: 10 }, (_, index) => 2026020001 + index);
  const futureOutputs: SeasonGameOutput[] = gameIds.map((gameId) => ({
    schedule_game_id: `s-${gameId}`,
    fhfh_player_id: 7,
    unconditional_means: { GOALS: 1 },
    baseline_unconditional_means: { GOALS: 0.8 },
    component_hash: `h-${gameId}`,
  }));
  const gameIdForOutput = (output: SeasonGameOutput) =>
    Number(String(output.schedule_game_id).slice(2));
  // Issued season total: 10 actual goals already scored + 10 modelled
  // remaining = 20; the editor published 24 (delta 4).
  const releasePlayer = {
    base_values: { GOALS: 20 },
    adjustment_delta: { GOALS: 4 },
    component_manifest: gameIds.map((gameId) => ({ gameId, componentHash: `h-${gameId}` })),
  };

  it("allocates the whole delta over the remaining-model manifest, not a base with actuals", () => {
    // An output for a game outside the manifest must not enter the base.
    const stray: SeasonGameOutput = {
      schedule_game_id: "s-2026020099",
      fhfh_player_id: 7,
      unconditional_means: { GOALS: 5 },
      component_hash: "h-stray",
    };
    const manifest = buildRemainingModelManifest({
      releasePlayer,
      outputs: [...futureOutputs, stray],
      gameIdForOutput,
      targets: ["GOALS"],
    });
    expect(manifest).toEqual({ games: 10, totals: { GOALS: 10 } });
    const published = futureOutputs.map((output) =>
      evaluateSeasonOutput({
        output,
        outcomePrimitiveValues: { GOALS: 1 },
        releasePlayer,
        manifest,
        targets: ["GOALS"],
      }).publishedLosses.GOALS.metrics.forecast as number,
    );
    const model = futureOutputs.reduce((total, output) => total + Number(output.unconditional_means!.GOALS), 0);
    const allocated = published.reduce((total, value) => total + value, 0) - model;
    expect(allocated).toBeCloseTo(4, 10);
  });

  it("leaves the published forecast unscored when a manifest component is missing", () => {
    const manifest = buildRemainingModelManifest({
      releasePlayer,
      outputs: futureOutputs.slice(1),
      gameIdForOutput,
      targets: ["GOALS"],
    });
    expect(manifest?.totals.GOALS).toBeNull();
    const evaluation = evaluateSeasonOutput({
      output: futureOutputs[1],
      outcomePrimitiveValues: { GOALS: 0 },
      releasePlayer,
      manifest,
      targets: ["GOALS"],
    });
    expect(evaluation.modelLosses.GOALS).toBeDefined();
    expect(evaluation.publishedLosses.GOALS).toBeUndefined();
    expect(evaluation.unscoredTargets.GOALS).toBe("published_allocation_unavailable");
  });

  it("keeps null primitive outcomes and null forecasts unknown instead of scoring them as 0", () => {
    const evaluation = evaluateSeasonOutput({
      output: { fhfh_player_id: 7, unconditional_means: { GOALS: 0.4, TAKEAWAYS: null, HITS: 2 } },
      outcomePrimitiveValues: { GOALS: null, TAKEAWAYS: 1, HITS: 3 },
      releasePlayer: undefined,
      manifest: null,
      targets: ["GOALS", "TAKEAWAYS", "HITS", "BLOCKED_SHOTS"],
    });
    expect(evaluation.unscoredTargets).toEqual({
      GOALS: "outcome_unknown",
      TAKEAWAYS: "forecast_unknown_or_invalid",
      BLOCKED_SHOTS: "outcome_unknown",
    });
    expect(Object.keys(evaluation.modelLosses)).toEqual(["HITS"]);
    expect(evaluation.publishedLosses.HITS.metrics.forecast).toBe(2);
  });
});
