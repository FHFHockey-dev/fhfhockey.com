import { describe, expect, it } from "vitest";
import {
  summarizeGameMarketRows,
  summarizePropMarketRows,
  type MarketPriceContextRow,
  type MarketTypeSummary,
  type PropMarketPriceContextRow,
} from "../queries/market-queries";
import {
  buildGameMarketFlagRows,
  buildModelMarketFlagRow,
  buildModelMarketProbabilityFlagRow,
  compareModelWithMarket,
  getConsensusLineValue,
  getModelLineProbabilities,
  homeSpreadCoverProbabilities,
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

  it("de-vigs Yes-only anytime goal markets proportionally with a configurable threshold", () => {
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
    expect(base.marketProbabilityOver).toBeCloseTo(0.25 / 1.08, 10);
    expect(base.flagType).toBeNull();
    expect(base.bestUnderPriceAmerican).toBeNull();
    expect(base.expectedValueUnder).toBeNull();
    const loose = compareModelWithMarket({
      marketType: "player_goal_scorer_anytime",
      expectedValue: 0.3,
      quotes,
      threshold: 0.02,
    })!;
    expect(loose.flagType).toBe("model_over");
  });

  it("labels Yes-only market probabilities as assumption-based, never as a de-vig", () => {
    const quotes: MarketPriceQuote[] = [
      { sportsbook_key: "dk", outcome_key: "yes", line_value: null, price_american: 300 },
    ];
    const result = compareModelWithMarket({
      marketType: "player_goal_scorer_anytime",
      expectedValue: 0.3,
      quotes,
      threshold: 0.02,
      yesOnlyOverround: 0.06,
    })!;
    expect(result.marketProbabilityBasis).toBe("yes-only-assumed-overround");
    expect(result.yesOnlyAssumption).toEqual({
      overround: 0.06, overroundSource: "argument", methods: ["proportional"], impliedProbabilityMedian: 0.25,
    });
    expect(result.marketProbabilityOver).toBeCloseTo(0.25 / 1.06, 10);
    // The zero-overround edge is the assumption-free (conservative) edge for an over.
    expect(result.probabilityEdgeAtZeroOverround).toBeCloseTo(result.model.overGivenNoPush - 0.25, 10);
    const row = buildModelMarketProbabilityFlagRow({
      asOfDate: "2026-10-22", entityType: "player", entityId: 1, gameId: 2, comparison: result, provider: "p",
    })!;
    expect(row.metadata).toMatchObject({
      devig_method: null,
      market_probability_basis: "yes-only-assumed-overround",
      yes_only_assumption: { assumed_overround: 0.06, overround_source: "argument", methods: ["proportional"], implied_probability_median: 0.25 },
    });
    expect((row.reasons as Array<Record<string, unknown>>)[0].market_probability_basis).toBe("yes-only-assumed-overround");

    const twoWay = compareModelWithMarket({ marketType: "player_goals", expectedValue: 0.3, quotes: pair("dk", 0.5, 500, -800) })!;
    expect(twoWay.marketProbabilityBasis).toBe("two-way-devig");
    expect(twoWay.yesOnlyAssumption).toBeNull();
    expect(twoWay.probabilityEdgeAtZeroOverround).toBeNull();
  });

  it("withholds model_under when no book at the line offers an under", () => {
    const yesOnly: MarketPriceQuote[] = [
      { sportsbook_key: "dk", outcome_key: "yes", line_value: null, price_american: 150 },
    ];
    const suppressed = compareModelWithMarket({ marketType: "player_goal_scorer_anytime", expectedValue: 0.3, quotes: yesOnly })!;
    expect(suppressed.probabilityEdge).toBeLessThan(-0.05);
    expect(suppressed.flagType).toBeNull();
    expect(suppressed.suppressedFlagType).toBe("model_under");
    expect(buildModelMarketProbabilityFlagRow({
      asOfDate: "2026-10-22", entityType: "player", entityId: 1, gameId: 2, comparison: suppressed, provider: null,
    })).toBeNull();

    // A book with an under at the same line makes the under bettable again.
    const mixed = compareModelWithMarket({
      marketType: "player_goals",
      expectedValue: 0.3,
      quotes: [...yesOnly.map((q) => ({ ...q, line_value: 0.5 })), ...pair("fd", 0.5, 150, -190)],
    })!;
    expect(mixed.marketProbabilityBasis).toBe("mixed-two-way-and-yes-only");
    expect(mixed.flagType).toBe("model_under");
    expect(mixed.suppressedFlagType).toBeNull();
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

  it("works from a hand-built summary without per-book quotes", () => {
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

  // BC W1-6 D18 / decision 30: the stage path (summary -> quotesFromMarketSummary)
  // averaged books at 2.5 and 3.5 into one 2.8333 line. Books stay per line.
  it("compares books at 2.5 and 3.5 separately through the served summary path", () => {
    const row = (book: string, outcome: string, line: number, price: number): PropMarketPriceContextRow => ({
      snapshot_date: "2026-04-21", game_id: 1, player_id: 42, market_type: "player_shots_on_goal",
      sportsbook_key: book, outcome_key: outcome, line_value: line, price_american: price,
      implied_probability: null, source_rank: 1, source_observed_at: "2026-04-21T18:00:00.000Z",
      freshness_expires_at: "2026-04-21T20:00:00.000Z", provenance: { provider: "p" }, metadata: {},
    });
    const summary = summarizePropMarketRows([
      row("a", "over", 2.5, -150), row("a", "under", 2.5, 130),
      row("b", "over", 2.5, -120), row("b", "under", 2.5, 100),
      row("c", "over", 3.5, 150), row("c", "under", 3.5, -180),
    ], "2026-04-21T18:30:00.000Z").player_shots_on_goal;
    expect(getConsensusLineValue(summary)).toBe(2.5);
    const result = compareModelWithMarket({
      marketType: "player_shots_on_goal",
      expectedValue: 3.2,
      quotes: quotesFromMarketSummary(summary),
    })!;
    expect(result.line).toBe(2.5);
    expect(result.bookCount).toBe(2);
    expect(result.marketProbabilityOver).toBeCloseTo(
      (devigFairOver(-150, 130) + devigFairOver(-120, 100)) / 2,
      8,
    );
    expect(result.model.over).toBeCloseTo(poissonOverProbability(3.2, 2.5)!, 10);
  });
});

function gameRow(book: string, market: string, outcome: string, line: number, price: number): MarketPriceContextRow {
  return {
    snapshot_date: "2026-04-21", game_id: 9, market_type: market, sportsbook_key: book,
    outcome_key: outcome, line_value: line, price_american: price, implied_probability: null,
    source_rank: 1, source_observed_at: "2026-04-21T18:00:00.000Z",
    freshness_expires_at: "2026-04-21T20:00:00.000Z", provenance: { provider: "p" }, metadata: {},
  };
}

function buildGameFlags(rows: MarketPriceContextRow[], home: number, away: number) {
  const summary = summarizeGameMarketRows(rows, "2026-04-21T18:30:00.000Z");
  return buildGameMarketFlagRows({
    asOfDate: "2026-04-21", gameId: 9, homeExpectedGoals: home, awayExpectedGoals: away,
    homeTeamAbbreviation: "BUF", awayTeamAbbreviation: "BOS",
    totalsSummary: summary.totals, spreadsSummary: summary.spreads, metadata: { run_id: "r" },
  });
}

describe("game market flags (decision 30)", () => {
  it("home cover probability uses the stated overtime rule (fixture .3808, mirrored .6192)", () => {
    const favourite = homeSpreadCoverProbabilities({ homeMean: 3.4, awayMean: 2.6, homeLine: -1.5 })!;
    expect(favourite.over).toBeCloseTo(0.3808, 4);
    expect(favourite.push).toBe(0);
    const mirrored = homeSpreadCoverProbabilities({ homeMean: 2.6, awayMean: 3.4, homeLine: 1.5 })!;
    expect(mirrored.over).toBeCloseTo(0.6192, 4);
    expect(favourite.over + mirrored.over).toBeCloseTo(1, 10);
    // At -1 an overtime win pushes, so the overtime split is needed; without it the answer is unknown.
    expect(homeSpreadCoverProbabilities({ homeMean: 3.4, awayMean: 2.6, homeLine: -1 })).toBeNull();
  });

  // BC W1-6 D4b: the old block stored margin - line = +2.30 "model_home_cover".
  it("spread flag compares the cover probability with the de-vigged home price", () => {
    const rows = buildGameFlags([
      gameRow("dk", "spreads", "team:BUF", -1.5, 120),
      gameRow("dk", "spreads", "team:BOS", 1.5, -140),
    ], 3.4, 2.6);
    const spread = rows.find((row) => row.market_type === "spreads")!;
    const marketHome = devigFairOver(120, -140);
    expect(spread.flag_type).toBe("model_away_cover");
    expect(spread.edge_value as number).toBeCloseTo(0.3808 - marketHome, 3);
    const reason = (spread.reasons as Array<Record<string, unknown>>)[0];
    expect(reason.home_line_value).toBe(-1.5);
    expect(reason.mean_minus_line).toBeCloseTo(-0.7, 10);
    expect(reason.model_probability_home_cover).toBeCloseTo(0.3808, 4);
    expect(reason.market_probability_home_cover).toBeCloseTo(marketHome, 4);
    expect(spread.metadata).toMatchObject({ run_id: "r", overtime_rule: "regulation-tie-settled-by-one-goal", devig_method: "shin" });
  });

  it("totals books at 5.5 and 6.5 are compared separately, never averaged", () => {
    const rows = buildGameFlags([
      gameRow("dk", "totals", "over", 5.5, 120), gameRow("dk", "totals", "under", 5.5, -140),
      gameRow("fd", "totals", "over", 5.5, 115), gameRow("fd", "totals", "under", 5.5, -135),
      gameRow("mgm", "totals", "over", 6.5, 200), gameRow("mgm", "totals", "under", 6.5, -250),
    ], 3.4, 2.6);
    const totals = rows.find((row) => row.market_type === "totals")!;
    const reason = (totals.reasons as Array<Record<string, unknown>>)[0];
    expect(reason.line_value).toBe(5.5);
    expect(reason.sportsbook_count).toBe(2);
    expect(reason.model_probability_over).toBeCloseTo(poissonOverProbability(6, 5.5)!, 4);
    expect(reason.market_probability_over).toBeCloseTo((devigFairOver(120, -140) + devigFairOver(115, -135)) / 2, 4);
    expect(totals.flag_type).toBe("model_over");
  });

  it("a one-sided game book is skipped, not estimated as a yes-only price", () => {
    expect(buildGameFlags([gameRow("dk", "totals", "over", 5.5, 120)], 3.4, 2.6)).toEqual([]);
  });

  // W3-4 N2: min(100, 50 * |edge| / threshold) stored 100 on a wrong-way flag.
  it("flag rows carry an honest edge/threshold ratio and no 0-100 confidence", () => {
    const rows = buildGameFlags([
      gameRow("dk", "spreads", "team:BUF", -1.5, 120),
      gameRow("dk", "spreads", "team:BOS", 1.5, -140),
    ], 3.4, 2.6);
    const spread = rows[0];
    expect(spread.confidence_0_to_100).toBeNull();
    const reason = (spread.reasons as Array<Record<string, unknown>>)[0];
    expect(reason.probability_edge_threshold).toBe(0.05);
    expect(reason.edge_to_threshold_ratio).toBeCloseTo(Math.abs(spread.edge_value as number) / 0.05, 3);
  });
});

describe("flag rows stay backward compatible", () => {
  it("legacy builder keeps its columns and the probability row keeps its columns and reason fields", () => {
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
    expect(legacy.confidence_0_to_100).toBeNull();

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
    expect(row.confidence_0_to_100).toBeNull();
    expect(reason.edge_to_threshold_ratio).toBeCloseTo(Math.abs(comparison.probabilityEdge) / 0.05, 3);

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
