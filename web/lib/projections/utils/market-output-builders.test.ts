import { describe, expect, it } from "vitest";
import type { MarketTypeSummary } from "../queries/market-queries";
import {
  buildModelMarketFlagRow,
  buildModelMarketProbabilityFlagRow,
  compareModelWithMarket,
  getConsensusLineValue,
  getModelLineProbabilities,
  poissonOverProbability,
  quotesFromMarketSummary,
  type MarketPriceQuote,
} from "./market-output-builders";

function pair(book: string, line: number, over: number, under: number): MarketPriceQuote[] {
  return [
    { sportsbook_key: book, outcome_key: "over", line_value: line, price_american: over },
    { sportsbook_key: book, outcome_key: "under", line_value: line, price_american: under },
  ];
}

describe("Poisson P(over line)", () => {
  it("matches published half-integer shot ladders (mean 2.6)", () => {
    expect(poissonOverProbability(2.6, 1.5)).toBeCloseTo(0.7326, 4);
    expect(poissonOverProbability(2.6, 2.5)).toBeCloseTo(0.4816, 4);
    expect(poissonOverProbability(2.6, 3.5)).toBeCloseTo(0.2640, 4);
    expect(poissonOverProbability(0.3, 0.5)).toBeCloseTo(1 - Math.exp(-0.3), 10);
  });

  it("splits out pushes on integer lines", () => {
    const p = getModelLineProbabilities({ marketType: "player_shots_on_goal", mean: 2, line: 2 })!;
    expect(p.over).toBeCloseTo(0.323324, 5);
    expect(p.push).toBeCloseTo(0.270671, 5);
    expect(p.under).toBeCloseTo(0.406006, 5);
    expect(p.overGivenNoPush).toBeCloseTo(0.323324 / (0.323324 + 0.406006), 5);
  });

  it("uses an injected distribution", () => {
    const p = getModelLineProbabilities({
      marketType: "player_shots_on_goal",
      mean: 2.6,
      line: 2.5,
      overProbability: () => 0.42,
    })!;
    expect(p.over).toBe(0.42);
    expect(p.push).toBe(0);
  });
});

describe("compareModelWithMarket", () => {
  // Old rule: a 0.3-goal mean against a 0.5 line always flagged "model_under".
  it("the ≤0.3-goal case now depends on price", () => {
    const longshot = compareModelWithMarket({
      marketType: "player_goals",
      expectedValue: 0.3,
      quotes: pair("dk", 0.5, 500, -800),
    })!;
    expect(longshot.marketProbabilityOver).toBeCloseTo(0.138889, 5);
    expect(longshot.flagType).toBe("model_over");
    expect(longshot.expectedValueOver).toBeCloseTo(0.259182 * 6 - 1, 4);

    const fair = compareModelWithMarket({
      marketType: "player_goals",
      expectedValue: 0.3,
      quotes: pair("dk", 0.5, 300, -400),
    })!;
    expect(fair.flagType).toBeNull();

    const shortPrice = compareModelWithMarket({
      marketType: "player_goals",
      expectedValue: 0.3,
      quotes: pair("dk", 0.5, 150, -190),
    })!;
    expect(shortPrice.flagType).toBe("model_under");
    expect(shortPrice.probabilityEdge).toBeLessThan(-0.05);
  });

  it("pairs each book's own prices, uses the modal line, median probability and best price", () => {
    const result = compareModelWithMarket({
      marketType: "player_shots_on_goal",
      expectedValue: 3.2,
      quotes: [
        ...pair("a", 2.5, -150, 130),
        ...pair("b", 2.5, -120, 100),
        ...pair("c", 2.5, -135, 115),
        ...pair("d", 3.5, 150, -180),
      ],
    })!;
    expect(result.line).toBe(2.5);
    expect(result.bookCount).toBe(3);
    expect(result.twoWayBookCount).toBe(3);
    expect(result.marketProbabilityOver).toBeCloseTo(
      devigFairOver(-135, 115),
      8,
    );
    expect(result.bestOverPriceAmerican).toBe(-120);
    expect(result.bestUnderPriceAmerican).toBe(130);
  });

  it("de-vigs Yes-only anytime goal markets with equal margin and a configurable threshold", () => {
    const quotes: MarketPriceQuote[] = [
      { sportsbook_key: "dk", outcome_key: "yes", line_value: null, price_american: 300 },
    ];
    const base = compareModelWithMarket({
      marketType: "player_goal_scorer_anytime",
      expectedValue: 0.3,
      quotes,
    })!;
    expect(base.line).toBe(0.5);
    expect(base.yesOnlyBookCount).toBe(1);
    expect(base.marketProbabilityOver).toBeCloseTo(0.21, 10);
    expect(base.flagType).toBeNull();
    expect(base.bestUnderPriceAmerican).toBeNull();
    expect(base.expectedValueUnder).toBeNull();
    const loose = compareModelWithMarket({
      marketType: "player_goal_scorer_anytime",
      expectedValue: 0.3,
      quotes,
      threshold: 0.04,
    })!;
    expect(loose.flagType).toBe("model_over");
  });

  it("skips invalid prices and returns null without usable quotes", () => {
    expect(
      compareModelWithMarket({
        marketType: "player_goals",
        expectedValue: 0.3,
        quotes: pair("bad", 0.5, 2, 1),
      }),
    ).toBeNull();
  });

  it("works from an averaged MarketTypeSummary", () => {
    const summary: MarketTypeSummary = {
      marketType: "player_goals",
      sourceRank: 1,
      sourceNames: ["the-odds-api"],
      sportsbookKeys: ["dk", "fd"],
      observedAt: null,
      freshnessExpiresAt: null,
      outcomes: [
        { outcomeKey: "over", averageLineValue: 0.5, averagePriceAmerican: 500, averageImpliedProbability: 1 / 6, sportsbookCount: 2 },
        { outcomeKey: "under", averageLineValue: 0.5, averagePriceAmerican: -800, averageImpliedProbability: 8 / 9, sportsbookCount: 2 },
      ],
    };
    const result = compareModelWithMarket({
      marketType: "player_goals",
      expectedValue: 0.3,
      quotes: quotesFromMarketSummary(summary),
    })!;
    expect(result.marketProbabilityOver).toBeCloseTo(0.138889, 5);
    expect(result.flagType).toBe("model_over");
    expect(getConsensusLineValue(summary)).toBe(0.5);
  });
});

describe("flag rows stay backward compatible", () => {
  it("legacy builder is unchanged and the probability row keeps its columns and reason fields", () => {
    const legacy = buildModelMarketFlagRow({
      asOfDate: "2026-10-22",
      entityType: "player",
      entityId: 1,
      gameId: 2,
      marketType: "player_goals",
      flagType: "model_under",
      edgeValue: -0.2,
      reasons: [{ expected_value: 0.3, line_value: 0.5, sportsbook_count: 1 }],
      provider: "p",
    });
    expect(legacy.edge_value).toBe(-0.2);
    expect(legacy.confidence_0_to_100).toBe(50);

    const comparison = compareModelWithMarket({
      marketType: "player_goals",
      expectedValue: 0.3,
      quotes: pair("dk", 0.5, 500, -800),
    })!;
    const row = buildModelMarketProbabilityFlagRow({
      asOfDate: "2026-10-22",
      entityType: "player",
      entityId: 1,
      gameId: 2,
      comparison,
      provider: "p",
      metadata: { run_id: "r" },
    })!;
    expect(Object.keys(row).sort()).toEqual(Object.keys(legacy).sort());
    expect(row.flag_type).toBe("model_over");
    expect(row.edge_value).toBeCloseTo(comparison.probabilityEdge, 4);
    const reason = (row.reasons as Array<Record<string, unknown>>)[0];
    expect(reason).toMatchObject({ expected_value: 0.3, line_value: 0.5, sportsbook_count: 1 });
    expect(reason.market_probability_over).toBeCloseTo(0.1389, 4);
    expect(row.metadata).toMatchObject({ run_id: "r", comparison_basis: "probability", devig_method: "shin" });
    expect(row.confidence_0_to_100).toBe(100);

    const noFlag = buildModelMarketProbabilityFlagRow({
      asOfDate: "2026-10-22",
      entityType: "player",
      entityId: 1,
      gameId: 2,
      comparison: compareModelWithMarket({
        marketType: "player_goals",
        expectedValue: 0.3,
        quotes: pair("dk", 0.5, 300, -400),
      })!,
      provider: null,
    });
    expect(noFlag).toBeNull();
  });
});

function devigFairOver(over: number, under: number): number {
  const a = over > 0 ? 100 / (over + 100) : -over / (-over + 100);
  const b = under > 0 ? 100 / (under + 100) : -under / (-under + 100);
  return a - (a + b - 1) / 2;
}
