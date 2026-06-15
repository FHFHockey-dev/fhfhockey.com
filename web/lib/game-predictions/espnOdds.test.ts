import { afterEach, describe, expect, it, vi } from "vitest";

import {
  americanOddsToImpliedProbability,
  buildMarketOddsSourceProvenanceRows,
  buildRejectedMarketOddsSourceProvenanceRows,
  calculateNoVigMoneylineProbabilities,
  ESPN_MARKET_ODDS_SOURCE_NAME,
  ESPN_MARKET_ODDS_REJECTED_SOURCE_NAME,
  HISTORICAL_MARKET_ODDS_IMPORT_REJECTED_SOURCE_NAME,
  HISTORICAL_MARKET_ODDS_IMPORT_SOURCE_NAME,
  fetchEspnNhlOdds,
  importHistoricalMarketOddsSnapshots,
  ingestEspnNhlOddsSnapshots,
  marketOddsSnapshotRowToEspnGameOdds,
  mergeEspnOddsPreferPersisted,
  parseAmericanOdds,
  parseRequestedOddsDateBatches,
  parseRequestedOddsDates,
} from "./espnOdds";

describe("ESPN NHL odds", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("parses requested date ranges and caps the request window", () => {
    expect(
      parseRequestedOddsDates({
        fromDate: "2026-06-14",
        toDate: "2026-06-16",
      }),
    ).toEqual(["2026-06-14", "2026-06-15", "2026-06-16"]);

    expect(
      parseRequestedOddsDates({
        dates: "20260614,2026-06-14,invalid,20260615",
      }),
    ).toEqual(["2026-06-14", "2026-06-15"]);

    expect(
      parseRequestedOddsDates({
        fromDate: "2026-06-14",
      }),
    ).toEqual([
      "2026-06-14",
      "2026-06-15",
      "2026-06-16",
      "2026-06-17",
      "2026-06-18",
      "2026-06-19",
      "2026-06-20",
      "2026-06-21",
    ]);
  });

  it("chunks requested date windows into ESPN-safe batches", () => {
    expect(
      parseRequestedOddsDateBatches({
        fromDate: "2026-06-01",
        toDate: "2026-06-20",
      }).map((batch) => batch.length),
    ).toEqual([14, 6]);

    expect(
      parseRequestedOddsDateBatches({
        dates: "20260601,20260602,20260603,20260604",
        batchSize: 2,
        maxDates: 3,
      }),
    ).toEqual([
      ["2026-06-01", "2026-06-02"],
      ["2026-06-03"],
    ]);
  });

  it("supports relative date offsets for cron-safe odds windows", () => {
    const now = new Date("2026-06-15T23:30:00.000Z");

    expect(
      parseRequestedOddsDates({
        fromOffsetDays: -1,
        toOffsetDays: 1,
        now,
      }),
    ).toEqual(["2026-06-14", "2026-06-15", "2026-06-16"]);

    expect(
      parseRequestedOddsDateBatches({
        fromOffsetDays: 0,
        maxDates: 2,
        now,
      }),
    ).toEqual([["2026-06-15"]]);
  });

  it("converts American moneylines to no-vig probabilities", () => {
    expect(parseAmericanOdds("+120")).toBe(120);
    expect(parseAmericanOdds("-140")).toBe(-140);
    expect(americanOddsToImpliedProbability("-120")).toBeCloseTo(0.545455);

    expect(
      calculateNoVigMoneylineProbabilities({
        homeMoneyline: "-120",
        awayMoneyline: "+100",
      }),
    ).toMatchObject({
      home: 0.521739,
      away: 0.478261,
      overround: 0.045455,
    });
  });

  it("normalizes ESPN odds to the page payload shape", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          events: [
            {
              id: "401874176",
              name: "Carolina Hurricanes at Vegas Golden Knights",
              date: "2026-06-15T00:00Z",
              status: { type: { description: "Scheduled" } },
              competitions: [
                {
                  competitors: [
                    {
                      homeAway: "home",
                      team: { abbreviation: "VGK" },
                    },
                    {
                      homeAway: "away",
                      team: { abbreviation: "CAR" },
                    },
                  ],
                  odds: [
                    {
                      provider: { displayName: "DraftKings" },
                      moneyline: {
                        home: { close: { odds: "-105" } },
                        away: { close: { odds: "-115" } },
                      },
                      pointSpread: {
                        home: { close: { line: "+1.5", odds: "-265" } },
                        away: { close: { line: "-1.5", odds: "+215" } },
                      },
                      total: {
                        over: { close: { line: "o5.5", odds: "-130" } },
                        under: { close: { line: "u5.5", odds: "+110" } },
                      },
                    },
                  ],
                },
              ],
            },
          ],
        }),
      })),
    );

    const odds = await fetchEspnNhlOdds(["2026-06-14"]);

    expect(odds).toEqual([
      {
        gameId: "401874176",
        requestedDate: "2026-06-14",
        localDate: "2026-06-14",
        name: "Carolina Hurricanes at Vegas Golden Knights",
        date: "2026-06-15T00:00Z",
        status: "Scheduled",
        homeTeam: "VGK",
        awayTeam: "CAR",
        provider: "DraftKings",
        moneyline: { home: "-105", away: "-115" },
        spread: {
          home: { line: "+1.5", odds: "-265" },
          away: { line: "-1.5", odds: "+215" },
        },
        total: {
          over: { line: "o5.5", odds: "-130" },
          under: { line: "u5.5", odds: "+110" },
        },
      },
    ]);
  });

  it("stores canonical source provenance on live ESPN market odds snapshots", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          events: [
            {
              id: "401874176",
              name: "Carolina Hurricanes at Vegas Golden Knights",
              date: "2026-06-15T00:00:00.000Z",
              status: { type: { description: "Scheduled" } },
              competitions: [
                {
                  competitors: [
                    {
                      homeAway: "home",
                      team: { abbreviation: "VGK" },
                    },
                    {
                      homeAway: "away",
                      team: { abbreviation: "CAR" },
                    },
                  ],
                  odds: [
                    {
                      provider: { displayName: "DraftKings" },
                      moneyline: {
                        home: { close: { odds: "-105" } },
                        away: { close: { odds: "-115" } },
                      },
                    },
                  ],
                },
              ],
            },
          ],
        }),
      })),
    );
    const insertedSnapshots: any[] = [];
    const fromMock = vi.fn((table: string) => {
      if (table === "teams") {
        return {
          select: vi.fn(() => ({
            in: vi.fn().mockResolvedValue({
              data: [
                { id: 54, abbreviation: "VGK" },
                { id: 12, abbreviation: "CAR" },
              ],
              error: null,
            }),
          })),
        };
      }
      if (table === "games") {
        return {
          select: vi.fn(() => ({
            in: vi.fn().mockResolvedValue({
              data: [
                {
                  id: 2025020001,
                  date: "2026-06-14",
                  startTime: "2026-06-15T00:00:00.000Z",
                  homeTeamId: 54,
                  awayTeamId: 12,
                },
              ],
              error: null,
            }),
          })),
        };
      }
      if (table === "game_prediction_market_odds_snapshots") {
        return {
          insert: vi.fn((rows: any[]) => {
            insertedSnapshots.push(...rows);
            return Promise.resolve({ error: null });
          }),
        };
      }
      return {
        upsert: vi.fn().mockResolvedValue({ error: null }),
      };
    });

    const result = await ingestEspnNhlOddsSnapshots({
      client: { from: fromMock } as any,
      dates: ["2026-06-14"],
      capturedAt: "2026-06-14T23:50:00.000Z",
      now: new Date("2026-06-14T23:50:30.000Z"),
      dryRun: false,
    });

    expect(result.insertedSnapshots).toBe(1);
    expect(insertedSnapshots[0]).toMatchObject({
      provenance: {
        source_name: ESPN_MARKET_ODDS_SOURCE_NAME,
        provider: "espn_site_api",
        capture_recorded_at: "2026-06-14T23:50:30.000Z",
      },
      metadata: {
        source_name: ESPN_MARKET_ODDS_SOURCE_NAME,
        capture_recorded_at: "2026-06-14T23:50:30.000Z",
      },
    });
  });

  it("refuses to store odds captured after puck drop", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          events: [
            {
              id: "401874176",
              name: "Carolina Hurricanes at Vegas Golden Knights",
              date: "2026-06-15T00:00:00.000Z",
              status: { type: { description: "Scheduled" } },
              competitions: [
                {
                  competitors: [
                    {
                      homeAway: "home",
                      team: { abbreviation: "VGK" },
                    },
                    {
                      homeAway: "away",
                      team: { abbreviation: "CAR" },
                    },
                  ],
                  odds: [
                    {
                      provider: { displayName: "DraftKings" },
                      moneyline: {
                        home: { close: { odds: "-105" } },
                        away: { close: { odds: "-115" } },
                      },
                    },
                  ],
                },
              ],
            },
          ],
        }),
      })),
    );
    const fromMock = vi.fn((table: string) => {
      if (table === "teams") {
        return {
          select: vi.fn(() => ({
            in: vi.fn().mockResolvedValue({
              data: [
                { id: 54, abbreviation: "VGK" },
                { id: 12, abbreviation: "CAR" },
              ],
              error: null,
            }),
          })),
        };
      }
      if (table === "games") {
        return {
          select: vi.fn(() => ({
            in: vi.fn().mockResolvedValue({
              data: [
                {
                  id: 2025020001,
                  date: "2026-06-14",
                  startTime: "2026-06-15T00:00:00.000Z",
                  homeTeamId: 54,
                  awayTeamId: 12,
                },
              ],
              error: null,
            }),
          })),
        };
      }
      return {
        insert: vi.fn().mockResolvedValue({ error: null }),
      };
    });

    const result = await ingestEspnNhlOddsSnapshots({
      client: { from: fromMock } as any,
      dates: ["2026-06-14"],
      capturedAt: "2026-06-15T00:01:00.000Z",
      now: new Date("2026-06-15T00:01:30.000Z"),
      dryRun: true,
    });

    expect(result).toMatchObject({
      fetchedGames: 1,
      insertedSnapshots: 0,
      skippedSnapshots: 1,
      postStartSkippedSnapshots: 1,
      missingMoneylineSnapshots: 0,
      dryRun: true,
    });
    expect(fromMock).not.toHaveBeenCalledWith(
      "game_prediction_market_odds_snapshots",
    );
  });

  it("rejects backdated capture timestamps for live ESPN ingestion", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      ingestEspnNhlOddsSnapshots({
        client: { from: vi.fn() } as any,
        dates: ["2026-06-14"],
        capturedAt: "2026-06-14T12:00:00.000Z",
        now: new Date("2026-06-15T12:00:00.000Z"),
        dryRun: true,
      }),
    ).rejects.toThrow(/backdated or future capture timestamps/);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("converts persisted odds snapshots to the page payload shape", () => {
    expect(
      marketOddsSnapshotRowToEspnGameOdds({
        game_id: 1,
        espn_game_id: "espn-1",
        provider: "DraftKings",
        captured_at: "2026-04-27T12:00:00.000Z",
        requested_date: "2026-04-28",
        game_date: "2026-04-28",
        event_start_at: "2026-04-28T23:00:00.000Z",
        home_team_abbreviation: "BOS",
        away_team_abbreviation: "MTL",
        home_moneyline: -130,
        away_moneyline: 110,
        home_spread_line: -1.5,
        home_spread_odds: 180,
        away_spread_line: 1.5,
        away_spread_odds: -220,
        total_line: 5.5,
        over_odds: -105,
        under_odds: -115,
        source_payload: {
          name: "Montreal Canadiens at Boston Bruins",
          date: "2026-04-28T23:00:00.000Z",
        },
        metadata: { status: "Scheduled" },
      } as any),
    ).toEqual({
      gameId: "espn-1",
      requestedDate: "2026-04-28",
      localDate: "2026-04-28",
      name: "Montreal Canadiens at Boston Bruins",
      date: "2026-04-28T23:00:00.000Z",
      status: "Scheduled",
      homeTeam: "BOS",
      awayTeam: "MTL",
      provider: "DraftKings",
      moneyline: { home: "-130", away: "+110" },
      spread: {
        home: { line: "-1.5", odds: "+180" },
        away: { line: "+1.5", odds: "-220" },
      },
      total: {
        over: { line: "o5.5", odds: "-105" },
        under: { line: "u5.5", odds: "-115" },
      },
    });
  });

  it("prefers persisted odds snapshots over live ESPN rows for the same game", () => {
    const live = {
      gameId: "live",
      requestedDate: "2026-04-28",
      localDate: "2026-04-28",
      name: null,
      date: null,
      status: "Scheduled",
      homeTeam: "BOS",
      awayTeam: "MTL",
      provider: "ESPN BET",
      moneyline: { home: "-125", away: "+105" },
      spread: {
        home: { line: "-1.5", odds: "+190" },
        away: { line: "+1.5", odds: "-230" },
      },
      total: {
        over: { line: "o5.5", odds: "-110" },
        under: { line: "u5.5", odds: "-110" },
      },
    };
    const persisted = {
      ...live,
      gameId: "persisted",
      provider: "DraftKings",
      moneyline: { home: "-130", away: "+110" },
    };

    expect(
      mergeEspnOddsPreferPersisted({
        live: [live],
        persisted: [persisted],
      }),
    ).toEqual([persisted]);
  });

  it("builds source provenance rows for ingested odds snapshots", () => {
    const rows = buildMarketOddsSourceProvenanceRows([
      {
        game_id: 1,
        espn_game_id: "espn-1",
        provider: "DraftKings",
        captured_at: "2026-04-27T12:00:00.000Z",
        requested_date: "2026-04-28",
        game_date: "2026-04-28",
        event_start_at: "2026-04-28T00:00:00.000Z",
        home_team_id: 10,
        away_team_id: 20,
        home_team_abbreviation: "BOS",
        away_team_abbreviation: "MTL",
        home_moneyline: -130,
        away_moneyline: 110,
        home_market_no_vig_probability: 0.55,
        away_market_no_vig_probability: 0.45,
        market_overround: 0.04,
        source_url: "https://site.api.espn.com/apis/site/v2/sports/hockey/nhl/scoreboard?dates=20260428",
        source_payload: {},
        provenance: {},
        metadata: {},
      },
    ] as any);

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      snapshot_date: "2026-04-28",
      source_type: "game_prediction_market_odds",
      entity_type: "game",
      entity_id: 1,
      game_id: 1,
      source_name: "espn_site_api_market_odds",
      status: "observed",
      observed_at: "2026-04-27T12:00:00.000Z",
      freshness_expires_at: "2026-04-28T00:00:00.000Z",
      payload: {
        provider: "DraftKings",
        homeMoneyline: -130,
        awayMoneyline: 110,
        homeMarketNoVigProbability: 0.55,
      },
      metadata: {
        oddsSnapshotSource: "game_prediction_market_odds_snapshots",
        captureRecordedAt: "2026-04-27T12:00:00.000Z",
      },
    });
  });

  it("builds rejected source provenance rows for mapped but unusable odds", () => {
    const rows = buildRejectedMarketOddsSourceProvenanceRows([
      {
        capturedAt: "2026-04-28T00:05:00.000Z",
        captureRecordedAt: "2026-04-28T00:05:30.000Z",
        rejectionReason: "post_start_capture",
        game: {
          id: 1,
          date: "2026-04-27",
          startTime: "2026-04-28T00:00:00.000Z",
          homeTeamId: 10,
          awayTeamId: 20,
        },
        odds: {
          gameId: "espn-1",
          requestedDate: "2026-04-27",
          localDate: "2026-04-27",
          name: "Away at Home",
          date: "2026-04-28T00:00:00.000Z",
          status: "Scheduled",
          homeTeam: "BOS",
          awayTeam: "MTL",
          provider: "DraftKings",
          moneyline: { home: "-130", away: "110" },
          spread: {
            home: { line: null, odds: null },
            away: { line: null, odds: null },
          },
          total: {
            over: { line: null, odds: null },
            under: { line: null, odds: null },
          },
        },
      },
    ]);

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      snapshot_date: "2026-04-27",
      source_type: "game_prediction_market_odds",
      entity_type: "game",
      entity_id: 1,
      game_id: 1,
      source_name: ESPN_MARKET_ODDS_REJECTED_SOURCE_NAME,
      status: "rejected",
      observed_at: "2026-04-28T00:05:00.000Z",
      freshness_expires_at: "2026-04-28T00:00:00.000Z",
      metadata: {
        rejectionReason: "post_start_capture",
        canonicalObservedSourceName: "espn_site_api_market_odds",
        captureRecordedAt: "2026-04-28T00:05:30.000Z",
      },
    });
  });

  it("imports historical market odds only when captured before puck drop", async () => {
    const insertSnapshotsMock = vi.fn().mockResolvedValue({ error: null });
    const upsertProvenanceMock = vi.fn().mockResolvedValue({ error: null });
    const fromMock = vi.fn((table: string) => {
      if (table === "games") {
        return {
          select: vi.fn(() => ({
            in: vi.fn().mockResolvedValue({
              data: [
                {
                  id: 1,
                  date: "2026-01-10",
                  startTime: "2026-01-10T23:00:00.000Z",
                  homeTeamId: 10,
                  awayTeamId: 20,
                },
                {
                  id: 2,
                  date: "2026-01-11",
                  startTime: "2026-01-11T23:00:00.000Z",
                  homeTeamId: 10,
                  awayTeamId: 20,
                },
              ],
              error: null,
            }),
          })),
        };
      }
      if (table === "teams") {
        return {
          select: vi.fn(() => ({
            in: vi.fn().mockResolvedValue({
              data: [
                { id: 10, abbreviation: "BOS" },
                { id: 20, abbreviation: "MTL" },
              ],
              error: null,
            }),
          })),
        };
      }
      if (table === "game_prediction_market_odds_snapshots") {
        return { insert: insertSnapshotsMock };
      }
      if (table === "source_provenance_snapshots") {
        return { upsert: upsertProvenanceMock };
      }
      throw new Error(`Unexpected table ${table}`);
    });

    const result = await importHistoricalMarketOddsSnapshots({
      client: { from: fromMock } as any,
      importedAt: "2026-06-15T12:00:00.000Z",
      importBatchId: "market-import-2026-06-15",
      dryRun: false,
      rows: [
        {
          gameId: 1,
          provider: "DraftKings",
          capturedAt: "2026-01-10T15:00:00.000Z",
          sourceUrl: "https://example.com/odds/game-1",
          homeMoneyline: "-130",
          awayMoneyline: "+110",
          requestedDate: "2026-01-10",
          sourcePayload: { archived: true },
        },
        {
          gameId: 2,
          provider: "DraftKings",
          capturedAt: "2026-01-11T23:05:00.000Z",
          sourceUrl: "https://example.com/odds/game-2",
          homeMoneyline: "-120",
          awayMoneyline: "+100",
        },
      ],
    });

    expect(result).toMatchObject({
      importBatchId: "market-import-2026-06-15",
      requestedRows: 2,
      candidateSnapshots: 1,
      importedSnapshots: 1,
      rowsInserted: 1,
      skippedSnapshots: 1,
      postStartRejectedRows: 1,
      provenanceRows: 2,
      rejectedProvenanceRows: 1,
      dryRun: false,
      rejectionReasons: { post_start_capture: 1 },
    });
    expect(insertSnapshotsMock).toHaveBeenCalledWith([
      expect.objectContaining({
        game_id: 1,
        provider: "DraftKings",
        captured_at: "2026-01-10T15:00:00.000Z",
        home_team_abbreviation: "BOS",
        away_team_abbreviation: "MTL",
        home_moneyline: -130,
        away_moneyline: 110,
        home_market_no_vig_probability: expect.any(Number),
        source_url: "https://example.com/odds/game-1",
        metadata: expect.objectContaining({
          import_source_name: HISTORICAL_MARKET_ODDS_IMPORT_SOURCE_NAME,
          import_recorded_at: "2026-06-15T12:00:00.000Z",
          import_batch_id: "market-import-2026-06-15",
        }),
        provenance: expect.objectContaining({
          import_batch_id: "market-import-2026-06-15",
        }),
      }),
    ]);
    const provenanceRows = upsertProvenanceMock.mock.calls[0]?.[0] ?? [];
    expect(provenanceRows).toHaveLength(2);
    expect(provenanceRows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          game_id: 1,
          source_name: HISTORICAL_MARKET_ODDS_IMPORT_SOURCE_NAME,
          status: "observed",
          observed_at: "2026-01-10T15:00:00.000Z",
          metadata: expect.objectContaining({
            importBatchId: "market-import-2026-06-15",
          }),
        }),
        expect.objectContaining({
          game_id: 2,
          source_name: HISTORICAL_MARKET_ODDS_IMPORT_REJECTED_SOURCE_NAME,
          status: "rejected",
          observed_at: "2026-01-11T23:05:00.000Z",
          metadata: expect.objectContaining({
            rejectionReason: "post_start_capture",
            importBatchId: "market-import-2026-06-15",
          }),
        }),
      ]),
    );
  });
});
