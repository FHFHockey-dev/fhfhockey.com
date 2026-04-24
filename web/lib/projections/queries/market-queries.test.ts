import { describe, expect, it } from "vitest";

import {
  summarizeGameMarketRows,
  summarizePropMarketRows,
  type MarketPriceContextRow,
  type PropMarketPriceContextRow
} from "./market-queries";

describe("market-queries", () => {
  it("prefers fresh lowest-rank game market rows when summarizing consensus", () => {
    const rows: MarketPriceContextRow[] = [
      {
        snapshot_date: "2026-04-21",
        game_id: 1,
        market_type: "h2h",
        sportsbook_key: "fallbackbook",
        outcome_key: "team:TBL",
        line_value: null,
        price_american: -125,
        implied_probability: 0.5556,
        source_rank: 2,
        source_observed_at: "2026-04-21T17:00:00.000Z",
        freshness_expires_at: "2026-04-21T20:00:00.000Z",
        provenance: { provider: "nhl-schedule" },
        metadata: {}
      },
      {
        snapshot_date: "2026-04-21",
        game_id: 1,
        market_type: "h2h",
        sportsbook_key: "draftkings",
        outcome_key: "team:TBL",
        line_value: null,
        price_american: -135,
        implied_probability: 0.5745,
        source_rank: 1,
        source_observed_at: "2026-04-21T18:15:00.000Z",
        freshness_expires_at: "2026-04-21T19:15:00.000Z",
        provenance: { provider: "parlayapi" },
        metadata: {}
      },
      {
        snapshot_date: "2026-04-21",
        game_id: 1,
        market_type: "h2h",
        sportsbook_key: "fanduel",
        outcome_key: "team:TBL",
        line_value: null,
        price_american: -140,
        implied_probability: 0.5833,
        source_rank: 1,
        source_observed_at: "2026-04-21T18:20:00.000Z",
        freshness_expires_at: "2026-04-21T19:20:00.000Z",
        provenance: { provider: "parlayapi" },
        metadata: {}
      }
    ];

    const summary = summarizeGameMarketRows(rows, "2026-04-21T18:30:00.000Z");
    expect(summary.h2h).toMatchObject({
      sourceRank: 1,
      sourceNames: ["parlayapi"],
      sportsbookKeys: ["draftkings", "fanduel"]
    });
    expect(summary.h2h?.outcomes[0]).toMatchObject({
      outcomeKey: "team:TBL",
      averagePriceAmerican: -137.5,
      averageImpliedProbability: 0.5789,
      sportsbookCount: 2
    });
  });

  it("falls back to stale prop rows when no fresh rows exist", () => {
    const rows: PropMarketPriceContextRow[] = [
      {
        snapshot_date: "2026-04-21",
        game_id: 1,
        player_id: 42,
        market_type: "player_shots_on_goal",
        sportsbook_key: "draftkings",
        outcome_key: "over",
        line_value: 2.5,
        price_american: -120,
        implied_probability: 0.5455,
        source_rank: 1,
        source_observed_at: "2026-04-21T11:00:00.000Z",
        freshness_expires_at: "2026-04-21T11:10:00.000Z",
        provenance: { provider: "parlayapi" },
        metadata: {}
      }
    ];

    const summary = summarizePropMarketRows(rows, "2026-04-21T18:30:00.000Z");
    expect(summary.player_shots_on_goal).toMatchObject({
      sourceRank: 1,
      sourceNames: ["parlayapi"]
    });
    expect(summary.player_shots_on_goal?.outcomes[0]).toMatchObject({
      outcomeKey: "over",
      averageLineValue: 2.5,
      averagePriceAmerican: -120
    });
  });
});
