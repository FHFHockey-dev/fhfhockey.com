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

  // Astra AF-04: stale rows are dropped, never used as a fallback.
  it("returns no summary when only stale prop rows exist", () => {
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

    expect(summarizePropMarketRows(rows, "2026-04-21T18:30:00.000Z")).toEqual({});
    expect(summarizePropMarketRows(rows, "2026-04-21T11:05:00.000Z").player_shots_on_goal?.outcomes[0]).toMatchObject({
      outcomeKey: "over",
      averageLineValue: 2.5,
      averagePriceAmerican: -120
    });
  });

  it("drops untimestamped, unexpiring and not-yet-observed rows and keeps fresh ones beside stale books", () => {
    const row = (book: string, observedAt: string | null, expiresAt: string | null): MarketPriceContextRow => ({
      snapshot_date: "2026-04-21", game_id: 1, market_type: "h2h", sportsbook_key: book, outcome_key: "team:TBL",
      line_value: null, price_american: -120, implied_probability: null, source_rank: 1, source_observed_at: observedAt,
      freshness_expires_at: expiresAt, provenance: { provider: "parlayapi" }, metadata: {}
    });
    const now = "2026-04-21T18:30:00.000Z";
    expect(summarizeGameMarketRows([row("a", null, null)], now)).toEqual({});
    expect(summarizeGameMarketRows([row("a", null, "2026-04-21T19:00:00.000Z")], now)).toEqual({});
    expect(summarizeGameMarketRows([row("a", "2026-04-21T18:00:00.000Z", null)], now)).toEqual({});
    expect(summarizeGameMarketRows([row("a", "2026-04-21T18:45:00.000Z", "2026-04-21T19:00:00.000Z")], now)).toEqual({});
    const mixed = summarizeGameMarketRows([
      row("stale", "2026-04-21T09:00:00.000Z", "2026-04-21T09:15:00.000Z"),
      row("fresh", "2026-04-21T18:20:00+00:00", "2026-04-21T18:35:00+00:00")
    ], now).h2h!;
    expect(mixed.sportsbookKeys).toEqual(["fresh"]);
    expect(mixed.quotes).toEqual([{ sportsbook_key: "fresh", outcome_key: "team:TBL", line_value: null, price_american: -120,
      source_observed_at: "2026-04-21T18:20:00.000Z", freshness_expires_at: "2026-04-21T18:35:00.000Z" }]);
  });

  it("keeps one quote per book and never averages differing lines", () => {
    const row = (book: string, line: number, price: number, at: string): PropMarketPriceContextRow => ({
      snapshot_date: "2026-04-21", game_id: 1, player_id: 42, market_type: "player_shots_on_goal",
      sportsbook_key: book, outcome_key: "over", line_value: line, price_american: price,
      implied_probability: null, source_rank: 1, source_observed_at: at,
      freshness_expires_at: "2026-04-21T20:00:00.000Z", provenance: { provider: "parlayapi" }, metadata: {}
    });
    const rows = [
      row("a", 2.5, -150, "2026-04-21T17:00:00.000Z"),
      row("a", 2.5, -160, "2026-04-21T18:00:00.000Z"),
      row("b", 3.5, 140, "2026-04-21T18:00:00.000Z")
    ];
    const forward = summarizePropMarketRows(rows, "2026-04-21T18:30:00.000Z").player_shots_on_goal!;
    const reversed = summarizePropMarketRows([...rows].reverse(), "2026-04-21T18:30:00.000Z").player_shots_on_goal!;
    expect(forward.outcomes[0].averageLineValue).toBeNull();
    const timestamps = (at: string) => ({ source_observed_at: at, freshness_expires_at: "2026-04-21T20:00:00.000Z" });
    expect(forward.quotes).toEqual([
      { sportsbook_key: "a", outcome_key: "over", line_value: 2.5, price_american: -160, ...timestamps("2026-04-21T18:00:00.000Z") },
      { sportsbook_key: "b", outcome_key: "over", line_value: 3.5, price_american: 140, ...timestamps("2026-04-21T18:00:00.000Z") }
    ]);
    expect(reversed.quotes).toEqual(forward.quotes);
  });
});
