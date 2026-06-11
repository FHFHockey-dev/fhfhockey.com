import { describe, expect, it } from "vitest";

import {
  calculateComponentAwareResultsLuckIndex,
  calculateNonOverlappingResultsLuckIndex,
  canPersistResultsLuckIndex,
  type ResultsLuckIndexResult,
} from "./resultsLuckIndex";
import type { SkaterWindowAggregate } from "./skaterWindowAggregation";

function aggregate(
  patch: Partial<SkaterWindowAggregate>,
): SkaterWindowAggregate {
  return {
    playerId: 1,
    teamId: 1,
    seasonId: 20252026,
    snapshotDate: "2026-04-11",
    strengthState: "all",
    window: "last5",
    windowType: "last_5",
    windowSize: 5,
    windowSemantics: "player_last_n_games_played",
    metricKey: "goals_per_60",
    rawValue: null,
    numerator: null,
    denominator: null,
    gamesPlayed: 5,
    toiSeconds: null,
    sourceFields: [],
    ...patch,
  };
}

function expectIndex(result: ResultsLuckIndexResult, value: number) {
  expect(result.indexValue).not.toBeNull();
  expect(result.indexValue ?? 0).toBeCloseTo(value, 6);
}

describe("resultsLuckIndex", () => {
  it("excludes the selected current window from the player baseline", () => {
    const result = calculateNonOverlappingResultsLuckIndex({
      current: aggregate({
        rawValue: 16,
        numerator: 4,
        denominator: 900,
      }),
      season: aggregate({
        window: "season",
        windowType: "season",
        windowSize: 0,
        windowSemantics: "season_to_date",
        rawValue: 10,
        numerator: 10,
        denominator: 3600,
        gamesPlayed: 20,
      }),
    });

    expect(result.currentWindowExcluded).toBe(true);
    expect(result.baselineNumerator).toBe(6);
    expect(result.baselineDenominator).toBe(2700);
    expect(result.playerBaselineValue).toBe(8);
    expect(result.baselineValue).toBe(8);
    expectIndex(result, 200);
  });

  it("blends thin player baselines toward the peer average", () => {
    const result = calculateNonOverlappingResultsLuckIndex({
      current: aggregate({
        rawValue: 16,
        numerator: 4,
        denominator: 900,
      }),
      season: aggregate({
        window: "season",
        windowType: "season",
        windowSize: 0,
        windowSemantics: "season_to_date",
        rawValue: 12,
        numerator: 5,
        denominator: 1500,
        gamesPlayed: 10,
      }),
      peerBaselineValue: 12,
      minimumBaselineToiSeconds: 1200,
    });

    expect(result.source).toBe("player_peer_blend");
    expect(result.playerBaselineValue).toBe(6);
    expect(result.baselineWeight).toBe(0.5);
    expect(result.baselineValue).toBe(9);
    expect(result.warnings).toContain(
      "player_baseline_blended_with_peer_average",
    );
    expectIndex(result, 177.777778);
  });

  it("uses peer fallback when a matching season baseline is unavailable", () => {
    const result = calculateNonOverlappingResultsLuckIndex({
      current: aggregate({
        rawValue: 18,
        numerator: 3,
        denominator: 600,
      }),
      season: null,
      peerBaselineValue: 9,
    });

    expect(result.source).toBe("peer_fallback");
    expect(result.currentWindowExcluded).toBe(false);
    expect(result.baselineValue).toBe(9);
    expect(result.warnings).toContain("missing_matching_season_baseline");
    expectIndex(result, 200);
  });

  it("converts season average source fields to season totals before exclusion", () => {
    const result = calculateNonOverlappingResultsLuckIndex({
      current: aggregate({
        metricKey: "points_per_60",
        rawValue: 12,
        numerator: 3,
        denominator: 900,
      }),
      season: aggregate({
        metricKey: "points_per_60",
        window: "season",
        windowType: "season",
        windowSize: 0,
        windowSemantics: "season_to_date",
        rawValue: 8,
        numerator: 2,
        denominator: 900,
        gamesPlayed: 10,
        toiSeconds: 9000,
        sourceFields: ["points_avg_season", "toi_seconds_avg_season"],
      }),
      peerBaselineValue: 8,
    });

    expect(result.baselineNumerator).toBe(17);
    expect(result.baselineDenominator).toBe(8100);
    expect(result.playerBaselineValue).toBeCloseTo(7.555556, 6);
    expect(result.source).toBe("player_non_overlapping");
  });

  it("does not allow publishing a non-season fallback index without window exclusion", () => {
    const current = aggregate({
      window: "last5",
      rawValue: 18,
      numerator: 3,
      denominator: 600,
    });
    const result = calculateNonOverlappingResultsLuckIndex({
      current,
      season: null,
      peerBaselineValue: 9,
    });

    expect(result.indexValue).toBe(200);
    expect(result.currentWindowExcluded).toBe(false);
    expect(canPersistResultsLuckIndex({ result, currentWindow: current.window })).toBe(
      false,
    );
  });

  it("allows publishing when the selected current window is excluded", () => {
    const current = aggregate({
      window: "last5",
      rawValue: 16,
      numerator: 4,
      denominator: 900,
    });
    const result = calculateNonOverlappingResultsLuckIndex({
      current,
      season: aggregate({
        window: "season",
        windowType: "season",
        windowSize: 0,
        windowSemantics: "season_to_date",
        rawValue: 10,
        numerator: 10,
        denominator: 3600,
        gamesPlayed: 20,
      }),
    });

    expect(result.currentWindowExcluded).toBe(true);
    expect(canPersistResultsLuckIndex({ result, currentWindow: current.window })).toBe(
      true,
    );
  });

  it("scores component-aware hot and cold results without ratioing signed metrics", () => {
    const result = calculateComponentAwareResultsLuckIndex({
      currentWindow: "last5",
      baselineProvenance: {
        baselineSource: "player_non_overlapping",
        baselineSnapshotDate: "2026-04-16",
        baselineWindowExcluded: true,
        baselineWeight: 1,
        peerBaselineValue: null,
        warnings: [],
      },
      components: [
        {
          key: "goals_above_expected",
          semantics: "signed_difference",
          currentValue: 1.2,
          baselineValue: 0.2,
          scale: 2,
          weight: 0.35,
        },
        {
          key: "sax_percentage",
          semantics: "signed_difference",
          currentValue: 6,
          baselineValue: 2,
          scale: 10,
          weight: 0.25,
        },
        {
          key: "ipp",
          semantics: "ratio",
          currentValue: 0.72,
          baselineValue: 0.6,
          weight: 0.2,
        },
        {
          key: "on_ice_shooting_context",
          semantics: "contextual_on_ice",
          currentValue: 12,
          baselineValue: 10,
          scale: 10,
          weight: 0.2,
        },
      ],
    });

    expect(result.canPublish).toBe(true);
    expect(result.indexValue).toBeCloseTo(135.5, 6);
    expect(
      result.componentScores.find((component) => component.key === "ipp")
        ?.componentIndex,
    ).toBe(120);
    expect(
      result.componentScores.find(
        (component) => component.key === "goals_above_expected",
      )?.componentIndex,
    ).toBe(150);
  });

  it("centers normal component-aware results at 100", () => {
    const result = calculateComponentAwareResultsLuckIndex({
      currentWindow: "last10",
      baselineProvenance: {
        baselineSource: "player_non_overlapping",
        baselineSnapshotDate: "2026-04-16",
        baselineWindowExcluded: true,
        baselineWeight: 1,
        peerBaselineValue: null,
        warnings: [],
      },
      components: [
        {
          key: "goals_above_expected",
          semantics: "signed_difference",
          currentValue: 0.2,
          baselineValue: 0.2,
          scale: 2,
          weight: 0.35,
        },
        {
          key: "sax_percentage",
          semantics: "signed_difference",
          currentValue: 2,
          baselineValue: 2,
          scale: 10,
          weight: 0.25,
        },
        {
          key: "ipp",
          semantics: "ratio",
          currentValue: 0.6,
          baselineValue: 0.6,
          weight: 0.2,
        },
        {
          key: "on_ice_shooting_context",
          semantics: "contextual_on_ice",
          currentValue: 10,
          baselineValue: 10,
          scale: 10,
          weight: 0.2,
        },
      ],
    });

    expect(result.indexValue).toBe(100);
    expect(result.canPublish).toBe(true);
  });

  it("scores component-aware cold results below 100", () => {
    const result = calculateComponentAwareResultsLuckIndex({
      currentWindow: "last10",
      baselineProvenance: {
        baselineSource: "player_non_overlapping",
        baselineSnapshotDate: "2026-04-16",
        baselineWindowExcluded: true,
        baselineWeight: 1,
        peerBaselineValue: null,
        warnings: [],
      },
      components: [
        {
          key: "goals_above_expected",
          semantics: "signed_difference",
          currentValue: -0.8,
          baselineValue: 0.2,
          scale: 2,
          weight: 0.5,
        },
        {
          key: "ipp",
          semantics: "ratio",
          currentValue: 0.45,
          baselineValue: 0.6,
          weight: 0.5,
        },
      ],
    });

    expect(result.indexValue).toBe(62.5);
    expect(result.canPublish).toBe(true);
  });

  it("supports already-blended thin baselines while preserving provenance warnings", () => {
    const result = calculateComponentAwareResultsLuckIndex({
      currentWindow: "last20",
      baselineProvenance: {
        baselineSource: "player_peer_blend",
        baselineSnapshotDate: "2026-04-16",
        baselineWindowExcluded: true,
        baselineWeight: 0.5,
        peerBaselineValue: 0.6,
        warnings: ["player_baseline_blended_with_peer_average"],
      },
      components: [
        {
          key: "ipp",
          semantics: "ratio",
          currentValue: 0.72,
          baselineValue: 0.66,
          weight: 1,
        },
      ],
    });

    expect(result.indexValue).toBeCloseTo(109.090909, 6);
    expect(result.canPublish).toBe(true);
    expect(result.warnings).toContain(
      "player_baseline_blended_with_peer_average",
    );
  });

  it("blocks non-season component-aware fallback publishing when the selected window was not excluded", () => {
    const result = calculateComponentAwareResultsLuckIndex({
      currentWindow: "last5",
      baselineProvenance: {
        baselineSource: "peer_fallback",
        baselineSnapshotDate: "2026-04-16",
        baselineWindowExcluded: false,
        baselineWeight: 0,
        peerBaselineValue: 100,
        warnings: ["thin_player_history"],
      },
      components: [
        {
          key: "ipp",
          semantics: "ratio",
          currentValue: 0.72,
          baselineValue: 0.6,
          weight: 1,
        },
      ],
    });

    expect(result.indexValue).toBe(120);
    expect(result.canPublish).toBe(false);
    expect(result.warnings).toContain("baseline_window_not_excluded");
    expect(result.warnings).toContain("thin_player_history");
  });

  it("blocks publishing when any required component is missing", () => {
    const result = calculateComponentAwareResultsLuckIndex({
      currentWindow: "last5",
      baselineProvenance: {
        baselineSource: "player_non_overlapping",
        baselineSnapshotDate: "2026-04-16",
        baselineWindowExcluded: true,
        baselineWeight: 1,
        peerBaselineValue: null,
        warnings: [],
      },
      components: [
        {
          key: "goals_above_expected",
          semantics: "signed_difference",
          currentValue: 1,
          baselineValue: 0,
          scale: 2,
          weight: 0.5,
        },
        {
          key: "ipp",
          semantics: "ratio",
          currentValue: null,
          baselineValue: 0.6,
          weight: 0.5,
        },
      ],
    });

    expect(result.indexValue).toBe(150);
    expect(result.canPublish).toBe(false);
    expect(result.warnings).toContain("ipp:missing_component_value");
    expect(result.warnings).toContain("incomplete_component_coverage");
  });

  it("allows season peer fallback because no selected non-season window can be excluded", () => {
    const result = calculateComponentAwareResultsLuckIndex({
      currentWindow: "season",
      baselineProvenance: {
        baselineSource: "peer_fallback",
        baselineSnapshotDate: "2026-04-16",
        baselineWindowExcluded: false,
        baselineWeight: 0,
        peerBaselineValue: 100,
        warnings: ["season_window_has_no_non_overlapping_baseline"],
      },
      components: [
        {
          key: "ipp",
          semantics: "ratio",
          currentValue: 0.48,
          baselineValue: 0.6,
          weight: 1,
        },
      ],
    });

    expect(result.indexValue).toBe(80);
    expect(result.canPublish).toBe(true);
    expect(result.warnings).toContain(
      "season_window_has_no_non_overlapping_baseline",
    );
  });
});
