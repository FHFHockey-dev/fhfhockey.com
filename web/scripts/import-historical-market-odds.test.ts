import { describe, expect, it } from "vitest";

import {
  attachHistoricalMarketOddsImportFileMetadata,
  historicalMarketOddsImportContract,
  parseHistoricalMarketOddsImportArgs,
  parseHistoricalMarketOddsImportFileContent,
  summarizeHistoricalMarketOddsExpectedGames,
} from "./import-historical-market-odds";

describe("historical market odds import script", () => {
  it("parses dry-run-first CLI options and explicit write confirmation", () => {
    const options = parseHistoricalMarketOddsImportArgs([
      "--file",
      "odds.csv",
      "--write",
      "--confirm-write",
      "--expected-game-ids=1,2,2",
      "--season-id",
      "20252026",
      "--blind-date",
      "2026-01-15",
      "--horizon-days",
      "0,1",
      "--max-replay-games",
      "12",
    ]);

    expect(options).toMatchObject({
      file: "odds.csv",
      dryRun: false,
      confirmWrite: true,
      printExpectedGames: false,
      expectedGameIds: [1, 2],
      expectedWindow: {
        seasonId: 20252026,
        blindDate: "2026-01-15",
        horizonDays: [0, 1],
        maxReplayGames: 12,
      },
    });
  });

  it("supports read-only expected-game discovery without a source file", () => {
    const options = parseHistoricalMarketOddsImportArgs([
      "--print-expected-games",
      "--season-id=20252026",
      "--blind-date=2026-01-15",
      "--replay-end-date=2026-01-25",
      "--horizon-days=0,1",
      "--max-training-games=80",
      "--max-replay-games=20",
    ]);

    expect(options).toMatchObject({
      dryRun: true,
      confirmWrite: false,
      printExpectedGames: true,
      expectedWindow: {
        seasonId: 20252026,
        blindDate: "2026-01-15",
        replayEndDate: "2026-01-25",
        horizonDays: [0, 1],
        maxTrainingGames: 80,
        maxReplayGames: 20,
      },
    });
  });

  it("summarizes expected games with the historical odds file contract", () => {
    expect(
      summarizeHistoricalMarketOddsExpectedGames({
        expectedWindowResult: {
          gameIds: [2025020001, 2025020002],
          gameCount: 2,
          windowStartDate: "2026-01-10",
          windowEndDate: "2026-01-11",
        },
      }),
    ).toEqual({
      success: true,
      dryRun: true,
      mode: "expected_games",
      expectedGameSource: "expected_window",
      expectedWindow: {
        gameIds: [2025020001, 2025020002],
        gameCount: 2,
        windowStartDate: "2026-01-10",
        windowEndDate: "2026-01-11",
      },
      expectedGameIds: [2025020001, 2025020002],
      expectedGameCount: 2,
      importContract: historicalMarketOddsImportContract(),
    });
  });

  it("uses explicit expected game ids without requiring a Supabase window", () => {
    expect(
      summarizeHistoricalMarketOddsExpectedGames({
        expectedGameIds: [2025020003, 2025020004],
      }),
    ).toMatchObject({
      expectedGameSource: "explicit_expected_game_ids",
      expectedWindow: null,
      expectedGameIds: [2025020003, 2025020004],
      expectedGameCount: 2,
    });
  });

  it("normalizes JSON manifest rows and snake-case expected windows", () => {
    const manifest = parseHistoricalMarketOddsImportFileContent(
      JSON.stringify({
        rows: [
          {
            game_id: "2025020001",
            sportsbook: "DraftKings",
            observed_at: "2026-01-10T15:00:00.000Z",
            source_url: "https://example.com/odds/game-1",
            home_ml: "-130",
            away_ml: "+110",
            source_payload: "{\"archived\":true}",
            metadata: { archive: "vendor-a" },
          },
        ],
        expected_game_ids: "2025020001,2025020002",
        expected_window: {
          season_id: "20252026",
          horizon_days: "0,1",
          max_replay_games: "25",
        },
        import_batch_id: "historical-market-odds-2026-06-15",
      }),
      "odds.json",
    );

    expect(manifest).toMatchObject({
      expectedGameIds: [2025020001, 2025020002],
      expectedWindow: {
        seasonId: 20252026,
        horizonDays: [0, 1],
        maxReplayGames: 25,
      },
      importBatchId: "historical-market-odds-2026-06-15",
      sourceFile: {
        fileName: "odds.json",
        format: "json",
        bytes: expect.any(Number),
        sha256: expect.stringMatching(/^[a-f0-9]{64}$/),
      },
      rows: [
        {
          gameId: 2025020001,
          provider: "DraftKings",
          capturedAt: "2026-01-10T15:00:00.000Z",
          sourceUrl: "https://example.com/odds/game-1",
          homeMoneyline: "-130",
          awayMoneyline: "+110",
          sourcePayload: { archived: true },
          metadata: { archive: "vendor-a" },
        },
      ],
    });
  });

  it("normalizes CSV row aliases into import rows", () => {
    const manifest = parseHistoricalMarketOddsImportFileContent(
      [
        "game_id,book,captured_at,source_url,home_moneyline,away_moneyline,requested_date",
        "2025020001,FanDuel,2026-01-10T15:00:00.000Z,https://example.com/odds/game-1,-125,+105,2026-01-10",
      ].join("\n"),
      "odds.csv",
    );

    expect(manifest.rows).toEqual([
      expect.objectContaining({
        gameId: 2025020001,
        provider: "FanDuel",
        capturedAt: "2026-01-10T15:00:00.000Z",
        sourceUrl: "https://example.com/odds/game-1",
        homeMoneyline: "-125",
        awayMoneyline: "+105",
        requestedDate: "2026-01-10",
      }),
    ]);
    expect(manifest.sourceFile).toMatchObject({
      fileName: "odds.csv",
      format: "csv",
      bytes: expect.any(Number),
      sha256: expect.stringMatching(/^[a-f0-9]{64}$/),
    });
  });

  it("attaches import-file checksum metadata without replacing row metadata", () => {
    const rows = attachHistoricalMarketOddsImportFileMetadata(
      [
        {
          gameId: 2025020001,
          provider: "FanDuel",
          capturedAt: "2026-01-10T15:00:00.000Z",
          sourceUrl: "https://example.com/odds/game-1",
          homeMoneyline: "-125",
          awayMoneyline: "+105",
          metadata: { archive_vendor: "vendor-a" },
        },
      ],
      {
        fileName: "odds.csv",
        format: "csv",
        bytes: 128,
        sha256: "a".repeat(64),
      },
    );

    expect(rows[0].metadata).toEqual({
      archive_vendor: "vendor-a",
      historical_market_odds_import_file: {
        fileName: "odds.csv",
        format: "csv",
        bytes: 128,
        sha256: "a".repeat(64),
      },
    });
  });
});
