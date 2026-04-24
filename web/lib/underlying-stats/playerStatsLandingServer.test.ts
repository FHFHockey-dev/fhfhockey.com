import { describe, expect, it } from "vitest";

import {
  createDefaultDetailFilterState,
  createDefaultLandingFilterState,
} from "./playerStatsFilters";
import {
  buildDetailApiResultFromAggregationRows,
  buildPlayerStatsSummaryPartitionSourceUrl,
  buildLandingApiResultFromAggregationRows,
  buildPlayerStatsDetailAggregationFromSummaryRows,
  buildPlayerStatsLandingAggregation,
  buildPlayerStatsLandingAggregationFromSummaryRows,
  buildPlayerStatsLandingParityByGame,
  buildPlayerStatsLandingSummarySnapshotsFromPayloadRows,
  buildPlayerStatsNativeGameParity,
  buildStoredPbpEventSequence,
  fetchSupabaseRowsForGameChunks,
  flattenPersistedSummaryRows,
  filterPlayerStatsLandingSourceGames,
  groupPlayerStatsSourceRowsByGameId,
  resolvePlayerStatsSeasonGameType,
  type PlayerStatsSourceEventRow,
  type PlayerStatsSourceGameRow,
  type PlayerStatsSourceRosterSpotRow,
  type PlayerStatsSourceShiftRow,
} from "./playerStatsLandingServer";

describe("resolvePlayerStatsSeasonGameType", () => {
  it("maps the canonical season types to NHL game types", () => {
    expect(resolvePlayerStatsSeasonGameType("preSeason")).toBe(1);
    expect(resolvePlayerStatsSeasonGameType("regularSeason")).toBe(2);
    expect(resolvePlayerStatsSeasonGameType("playoffs")).toBe(3);
  });
});

describe("filterPlayerStatsLandingSourceGames", () => {
  const games: PlayerStatsSourceGameRow[] = [
    {
      id: 1,
      seasonId: 20242025,
      date: "2024-10-10",
      startTime: "2024-10-10T23:00:00.000Z",
      homeTeamId: 10,
      awayTeamId: 20,
      type: 2,
      created_at: "2024-10-10T00:00:00.000Z",
    },
    {
      id: 2,
      seasonId: 20252026,
      date: "2025-10-10",
      startTime: "2025-10-10T23:00:00.000Z",
      homeTeamId: 30,
      awayTeamId: 10,
      type: 2,
      created_at: "2025-10-10T00:00:00.000Z",
    },
    {
      id: 3,
      seasonId: 20252026,
      date: "2026-04-25",
      startTime: "2026-04-25T23:00:00.000Z",
      homeTeamId: 10,
      awayTeamId: 40,
      type: 3,
      created_at: "2026-04-25T00:00:00.000Z",
    },
    {
      id: 4,
      seasonId: 20252026,
      date: "2026-04-02",
      startTime: "2026-04-02T23:00:00.000Z",
      homeTeamId: 10,
      awayTeamId: 50,
      type: 2,
      created_at: "2026-04-02T00:00:00.000Z",
    },
    {
      id: 5,
      seasonId: 20252026,
      date: "2026-04-02",
      startTime: "2026-04-02T10:00:00.000Z",
      homeTeamId: 10,
      awayTeamId: 60,
      type: 2,
      created_at: "2026-04-02T00:00:00.000Z",
    },
    {
      id: 6,
      seasonId: 20252026,
      date: "2026-04-03",
      startTime: "2026-04-03T23:00:00.000Z",
      homeTeamId: 10,
      awayTeamId: 70,
      type: 2,
      created_at: "2026-04-03T00:00:00.000Z",
    },
  ];

  const probeNow = new Date("2026-04-02T20:00:00.000Z");

  it("filters by season range and season type", () => {
    const state = createDefaultLandingFilterState({
      currentSeasonId: 20252026,
    });
    state.primary.seasonRange = {
      fromSeasonId: 20252026,
      throughSeasonId: 20252026,
    };

    expect(
      filterPlayerStatsLandingSourceGames(games, state, probeNow).map(
        (game) => game.id
      )
    ).toEqual([2, 5]);
  });

  it("filters by team and venue when a landing team filter is active", () => {
    const state = createDefaultLandingFilterState({
      currentSeasonId: 20252026,
    });
    state.primary.seasonRange = {
      fromSeasonId: 20242025,
      throughSeasonId: 20252026,
    };
    state.expandable.teamId = 10;
    state.expandable.venue = "home";

    expect(
      filterPlayerStatsLandingSourceGames(games, state, probeNow).map(
        (game) => game.id
      )
    ).toEqual([1, 5]);
  });

  it("filters by date-range scope before later player-level windowing", () => {
    const state = createDefaultLandingFilterState({
      currentSeasonId: 20252026,
    });
    state.primary.seasonRange = {
      fromSeasonId: 20242025,
      throughSeasonId: 20252026,
    };
    state.expandable.scope = {
      kind: "dateRange",
      startDate: "2025-10-01",
      endDate: "2025-12-01",
    };

    expect(
      filterPlayerStatsLandingSourceGames(games, state, probeNow).map(
        (game) => game.id
      )
    ).toEqual([2]);
  });

  it("excludes future and not-safely-finished same-day games from the landing sample", () => {
    const state = createDefaultLandingFilterState({
      currentSeasonId: 20252026,
    });
    state.primary.seasonRange = {
      fromSeasonId: 20252026,
      throughSeasonId: 20252026,
    };

    expect(
      filterPlayerStatsLandingSourceGames(games, state, probeNow).map(
        (game) => game.id
      )
    ).toEqual([2, 5]);
  });
});

describe("fetchSupabaseRowsForGameChunks", () => {
  it("passes the matching source-url chunk for each game-id chunk instead of reusing the first chunk", async () => {
    const gameIdChunks = [[101, 102], [201, 202], [301]];
    const sourceUrlChunks = gameIdChunks.map((chunk) =>
      chunk.map((gameId) =>
        buildPlayerStatsSummaryPartitionSourceUrl({
          gameId,
          mode: "onIce",
          strength: "fiveOnFive",
          scoreState: "allScores",
        })
      )
    );

    const rows = await fetchSupabaseRowsForGameChunks<{
      game_id: number;
      source_url: string;
    }>({
      gameIdChunks,
      fetchChunkPage: async (gameIdChunk, from, to, gameIdChunkIndex) => {
        expect(from).toBe(0);
        expect(to).toBeGreaterThanOrEqual(from);

        return {
          data: gameIdChunk.map((gameId, index) => ({
            game_id: gameId,
            source_url: sourceUrlChunks[gameIdChunkIndex]?.[index] ?? "missing",
          })),
          error: null,
        };
      },
    });

    expect(rows).toEqual([
      {
        game_id: 101,
        source_url: "derived://underlying-player-summary-v2/onIce/fiveOnFive/101",
      },
      {
        game_id: 102,
        source_url: "derived://underlying-player-summary-v2/onIce/fiveOnFive/102",
      },
      {
        game_id: 201,
        source_url: "derived://underlying-player-summary-v2/onIce/fiveOnFive/201",
      },
      {
        game_id: 202,
        source_url: "derived://underlying-player-summary-v2/onIce/fiveOnFive/202",
      },
      {
        game_id: 301,
        source_url: "derived://underlying-player-summary-v2/onIce/fiveOnFive/301",
      },
    ]);
  });
});

describe("buildStoredPbpEventSequence", () => {
  it("hydrates stored PBP rows into the normalized event sequence the parity helper expects", () => {
    const rows: PlayerStatsSourceEventRow[] = [
      {
        event_id: 20,
        assist1_player_id: null,
        assist2_player_id: null,
        away_goalie: null,
        away_score: 0,
        away_skaters: 5,
        away_sog: 0,
        blocking_player_id: null,
        committed_by_player_id: null,
        created_at: "2025-10-10T00:00:00.000Z",
        details: null,
        drawn_by_player_id: null,
        event_owner_side: null,
        event_owner_team_id: 20,
        game_date: "2025-10-10",
        game_id: 100,
        goalie_in_net_id: null,
        hittee_player_id: null,
        hitting_player_id: null,
        home_goalie: null,
        home_score: 0,
        home_skaters: 5,
        home_sog: 0,
        home_team_defending_side: "left",
        is_goal: false,
        is_penalty: false,
        is_shot_like: false,
        losing_player_id: 2002,
        parser_version: 1,
        penalty_desc_key: null,
        penalty_duration_minutes: null,
        penalty_type_code: null,
        period_number: 1,
        period_seconds_elapsed: 120,
        period_type: "REG",
        player_id: null,
        raw_event: null,
        reason: null,
        scoring_player_id: null,
        season_id: 20252026,
        secondary_reason: null,
        served_by_player_id: null,
        shooting_player_id: null,
        shot_type: null,
        situation_code: "1551",
        sort_order: 20,
        source_play_by_play_hash: "hash-a",
        strength_exact: "5v5",
        strength_state: "EV",
        strength_version: 1,
        time_in_period: "02:00",
        time_remaining: "18:00",
        time_remaining_seconds: 1080,
        type_code: 502,
        type_desc_key: "faceoff",
        updated_at: "2025-10-10T00:00:00.000Z",
        winning_player_id: 1001,
        x_coord: 0,
        y_coord: 0,
        zone_code: "N",
      },
      {
        event_id: 30,
        assist1_player_id: null,
        assist2_player_id: null,
        away_goalie: null,
        away_score: 0,
        away_skaters: 5,
        away_sog: 1,
        blocking_player_id: null,
        committed_by_player_id: null,
        created_at: "2025-10-10T00:00:00.000Z",
        details: null,
        drawn_by_player_id: null,
        event_owner_side: null,
        event_owner_team_id: 10,
        game_date: "2025-10-10",
        game_id: 100,
        goalie_in_net_id: 3001,
        hittee_player_id: null,
        hitting_player_id: null,
        home_goalie: null,
        home_score: 1,
        home_skaters: 5,
        home_sog: 1,
        home_team_defending_side: "left",
        is_goal: true,
        is_penalty: false,
        is_shot_like: true,
        losing_player_id: null,
        parser_version: 1,
        penalty_desc_key: null,
        penalty_duration_minutes: null,
        penalty_type_code: null,
        period_number: 1,
        period_seconds_elapsed: 180,
        period_type: "REG",
        player_id: null,
        raw_event: null,
        reason: null,
        scoring_player_id: 9001,
        season_id: 20252026,
        secondary_reason: null,
        served_by_player_id: null,
        shooting_player_id: 9001,
        shot_type: "wrist",
        situation_code: "1551",
        sort_order: 30,
        source_play_by_play_hash: "hash-b",
        strength_exact: "5v5",
        strength_state: "EV",
        strength_version: 1,
        time_in_period: "03:00",
        time_remaining: "17:00",
        time_remaining_seconds: 1020,
        type_code: 505,
        type_desc_key: "goal",
        updated_at: "2025-10-10T00:00:00.000Z",
        winning_player_id: null,
        x_coord: 70,
        y_coord: 12,
        zone_code: "O",
      },
    ];

    const parsed = buildStoredPbpEventSequence(rows, {
      homeTeamId: 10,
      awayTeamId: 20,
    });

    expect(parsed).toHaveLength(2);
    expect(parsed[0]).toMatchObject({
      event_index: 0,
      event_owner_side: "away",
      previous_event_id: null,
      next_event_id: 30,
      seconds_since_previous_event: null,
      period_duration_seconds: 1200,
      game_seconds_elapsed: 120,
    });
    expect(parsed[1]).toMatchObject({
      event_index: 1,
      event_owner_side: "home",
      previous_event_id: 20,
      next_event_id: null,
      seconds_since_previous_event: 60,
      period_duration_seconds: 1200,
      game_seconds_elapsed: 180,
    });
  });
});

describe("groupPlayerStatsSourceRowsByGameId", () => {
  it("groups stored source rows by game id and drops null game ids", () => {
    const grouped = groupPlayerStatsSourceRowsByGameId([
      { game_id: 10, event_id: 1 },
      { game_id: 10, event_id: 2 },
      { game_id: 20, event_id: 3 },
      { game_id: null, event_id: 4 },
    ]);

    expect(grouped.get(10)?.map((row) => row.event_id)).toEqual([1, 2]);
    expect(grouped.get(20)?.map((row) => row.event_id)).toEqual([3]);
    expect(grouped.has(0)).toBe(false);
    expect(grouped.size).toBe(2);
  });
});

describe("flattenPersistedSummaryRows", () => {
  it("normalizes direct-PG string game ids before matching payload game metadata", () => {
    const payloads = flattenPersistedSummaryRows([
      {
        game_id: "2025020564",
        fetched_at: "2026-04-02T00:00:00.000Z",
        source_url: "derived://underlying-player-summary-v2/onIce/fiveOnFive/2025020564",
        payload: {
          version: 1,
          generatedAt: "2026-04-02T00:00:00.000Z",
          game: {
            id: 2025020564,
            seasonId: 20252026,
            date: "2025-12-20",
            homeTeamId: 1,
            awayTeamId: 7,
          },
          rows: [
            {
              kind: "onIce",
              mode: "onIce",
              strength: "fiveOnFive",
              scoreState: "allScores",
              supportedDisplayModes: ["counts", "rates"],
              playerId: 8478402,
              playerName: "Test Skater",
              positionCode: "C",
              gameId: 2025020564,
              seasonId: 20252026,
              gameDate: "2025-12-20",
              teamId: 1,
              teamAbbrev: "NJD",
              opponentTeamId: 7,
              isHome: true,
              hasReliableToi: true,
              metrics: {
                toiSeconds: 600,
                gamesPlayed: 1,
                onIceGoalsForForIpp: 0,
                hasUnknownToi: false,
                hasUnknownOnIceGoalDenominator: false,
                individual: {
                  goals: 0,
                  totalAssists: 0,
                  firstAssists: 0,
                  secondAssists: 0,
                  shots: 0,
                  ixg: null,
                  iCf: 0,
                  iFf: 0,
                  iScf: null,
                  iHdcf: null,
                  rushAttempts: 0,
                  reboundsCreated: 0,
                  pim: 0,
                  totalPenalties: 0,
                  minorPenalties: 0,
                  majorPenalties: 0,
                  misconductPenalties: 0,
                  penaltiesDrawn: 0,
                  giveaways: 0,
                  takeaways: 0,
                  hits: 0,
                  hitsTaken: 0,
                  shotsBlocked: 0,
                  faceoffsWon: 0,
                  faceoffsLost: 0,
                },
                onIce: {
                  cf: 10,
                  ca: 8,
                  ff: 9,
                  fa: 7,
                  sf: 5,
                  sa: 4,
                  gf: 1,
                  ga: 0,
                  xgf: 0.8,
                  xga: 0.5,
                  scf: 4,
                  sca: 2,
                  hdcf: 1,
                  hdca: 1,
                  hdgf: 0,
                  hdga: 0,
                  mdcf: 1,
                  mdca: 1,
                  mdgf: 0,
                  mdga: 0,
                  ldcf: 1,
                },
                goalies: {
                  shotsAgainst: 0,
                  saves: 0,
                  goalsAgainst: 0,
                  xgAgainst: null,
                  hdShotsAgainst: 0,
                  hdSaves: 0,
                  hdGoalsAgainst: 0,
                  hdXgAgainst: null,
                  mdShotsAgainst: 0,
                  mdSaves: 0,
                  mdGoalsAgainst: 0,
                  mdXgAgainst: null,
                  ldShotsAgainst: 0,
                  ldSaves: 0,
                  ldGoalsAgainst: 0,
                  ldXgAgainst: null,
                  rushAttemptsAgainst: 0,
                  reboundAttemptsAgainst: 0,
                  shotDistanceTotal: 0,
                  shotDistanceCount: 0,
                  goalDistanceTotal: 0,
                  goalDistanceCount: 0,
                },
              },
            },
          ],
        },
      } as any,
    ]);

    expect(payloads.get(2025020564)?.game.id).toBe(2025020564);
    expect(payloads.get(2025020564)?.rows).toHaveLength(1);
  });

  it("drops persisted summary rows whose team mapping does not match the game teams", () => {
    const payloads = flattenPersistedSummaryRows([
      {
        game_id: 2025020565,
        fetched_at: "2026-04-02T00:00:00.000Z",
        source_url: "derived://underlying-player-summary/2025020565",
        payload: {
          version: 1,
          generatedAt: "2026-04-02T00:00:00.000Z",
          game: {
            id: 2025020565,
            seasonId: 20252026,
            date: "2025-12-21",
            homeTeamId: 1,
            awayTeamId: 7,
          },
          rows: [
            {
              kind: "individual",
              mode: "individual",
              strength: "allStrengths",
              supportedDisplayModes: ["counts", "rates"],
              playerId: 8476881,
              playerName: "Tomas Hertl",
              positionCode: "C",
              gameId: 2025020565,
              seasonId: 20252026,
              gameDate: "2025-12-21",
              teamId: 54,
              teamAbbrev: "VGK",
              opponentTeamId: 1,
              isHome: false,
              hasReliableToi: true,
              metrics: {
                toiSeconds: 1106,
                gamesPlayed: 1,
                onIceGoalsForForIpp: 0,
                hasUnknownToi: false,
                hasUnknownOnIceGoalDenominator: false,
                individual: {
                  goals: 0,
                  totalAssists: 0,
                  firstAssists: 0,
                  secondAssists: 0,
                  shots: 0,
                  ixg: 0,
                  iCf: 0,
                  iFf: 0,
                  iScf: 0,
                  iHdcf: 0,
                  rushAttempts: 0,
                  reboundsCreated: 0,
                  pim: 0,
                  totalPenalties: 0,
                  minorPenalties: 0,
                  majorPenalties: 0,
                  misconductPenalties: 0,
                  penaltiesDrawn: 0,
                  giveaways: 0,
                  takeaways: 0,
                  hits: 0,
                  hitsTaken: 0,
                  shotsBlocked: 0,
                  faceoffsWon: 0,
                  faceoffsLost: 0,
                },
                onIce: {
                  cf: 0,
                  ca: 0,
                  ff: 0,
                  fa: 0,
                  sf: 0,
                  sa: 0,
                  gf: 0,
                  ga: 0,
                  xgf: null,
                  xga: null,
                  scf: null,
                  sca: null,
                  hdcf: null,
                  hdca: null,
                  hdgf: null,
                  hdga: null,
                  mdcf: null,
                  mdca: null,
                  mdgf: null,
                  mdga: null,
                  ldcf: null,
                },
                goalies: {
                  shotsAgainst: 0,
                  saves: 0,
                  goalsAgainst: 0,
                  xgAgainst: null,
                  hdShotsAgainst: 0,
                  hdSaves: 0,
                  hdGoalsAgainst: 0,
                  hdXgAgainst: null,
                  mdShotsAgainst: 0,
                  mdSaves: 0,
                  mdGoalsAgainst: 0,
                  mdXgAgainst: null,
                  ldShotsAgainst: 0,
                  ldSaves: 0,
                  ldGoalsAgainst: 0,
                  ldXgAgainst: null,
                  rushAttemptsAgainst: 0,
                  reboundAttemptsAgainst: 0,
                  shotDistanceTotal: 0,
                  shotDistanceCount: 0,
                  goalDistanceTotal: 0,
                  goalDistanceCount: 0,
                },
              },
            },
          ],
        },
      } as any,
    ]);

    expect(payloads.get(2025020565)?.rows).toEqual([]);
  });

  it("normalizes legacy persisted summary rows without scoreState to allScores", () => {
    const payloads = flattenPersistedSummaryRows([
      {
        game_id: 2025020566,
        fetched_at: "2026-04-02T00:00:00.000Z",
        source_url: "derived://underlying-player-summary-v2/goalies/allStrengths/2025020566",
        payload: {
          version: 1,
          generatedAt: "2026-04-02T00:00:00.000Z",
          game: {
            id: 2025020566,
            seasonId: 20252026,
            date: "2025-12-22",
            homeTeamId: 1,
            awayTeamId: 7,
          },
          rows: [
            {
              kind: "goalies",
              mode: "goalies",
              strength: "allStrengths",
              supportedDisplayModes: ["counts", "rates"],
              playerId: 8477990,
              playerName: "Test Goalie",
              positionCode: "G",
              gameId: 2025020566,
              seasonId: 20252026,
              gameDate: "2025-12-22",
              teamId: 7,
              teamAbbrev: "BUF",
              opponentTeamId: 1,
              isHome: false,
              hasReliableToi: true,
              metrics: {
                toiSeconds: 1200,
                gamesPlayed: 1,
                onIceGoalsForForIpp: 0,
                hasUnknownToi: false,
                hasUnknownOnIceGoalDenominator: false,
                individual: {
                  goals: 0,
                  totalAssists: 0,
                  firstAssists: 0,
                  secondAssists: 0,
                  shots: 0,
                  ixg: null,
                  iCf: 0,
                  iFf: 0,
                  iScf: null,
                  iHdcf: null,
                  rushAttempts: 0,
                  reboundsCreated: 0,
                  pim: 0,
                  totalPenalties: 0,
                  minorPenalties: 0,
                  majorPenalties: 0,
                  misconductPenalties: 0,
                  penaltiesDrawn: 0,
                  giveaways: 0,
                  takeaways: 0,
                  hits: 0,
                  hitsTaken: 0,
                  shotsBlocked: 0,
                  faceoffsWon: 0,
                  faceoffsLost: 0,
                },
                onIce: {
                  cf: 0,
                  ca: 0,
                  ff: 0,
                  fa: 0,
                  sf: 0,
                  sa: 0,
                  gf: 0,
                  ga: 0,
                  xgf: null,
                  xga: null,
                  scf: null,
                  sca: null,
                  hdcf: null,
                  hdca: null,
                  hdgf: null,
                  hdga: null,
                  mdcf: null,
                  mdca: null,
                  mdgf: null,
                  mdga: null,
                  ldcf: null,
                },
                goalies: {
                  shotsAgainst: 30,
                  saves: 28,
                  goalsAgainst: 2,
                  xgAgainst: 2.4,
                  hdShotsAgainst: 6,
                  hdSaves: 5,
                  hdGoalsAgainst: 1,
                  hdXgAgainst: 1.1,
                  mdShotsAgainst: 10,
                  mdSaves: 9,
                  mdGoalsAgainst: 1,
                  mdXgAgainst: 0.8,
                  ldShotsAgainst: 14,
                  ldSaves: 14,
                  ldGoalsAgainst: 0,
                  ldXgAgainst: 0.5,
                  rushAttemptsAgainst: 2,
                  reboundAttemptsAgainst: 3,
                  shotDistanceTotal: 900,
                  shotDistanceCount: 30,
                  goalDistanceTotal: 45,
                  goalDistanceCount: 2,
                },
              },
            },
          ],
        },
      } as any,
    ]);

    expect(payloads.get(2025020566)?.rows[0]?.scoreState).toBe("allScores");
  });

  it("partitions summary snapshot source URLs by scoreState while keeping allScores on the legacy-compatible prefix", () => {
    const snapshots = buildPlayerStatsLandingSummarySnapshotsFromPayloadRows([
      {
        game_id: 2025020567,
        fetched_at: "2026-04-02T00:00:00.000Z",
        source_url: "derived://underlying-player-summary-v2/goalies/allStrengths/2025020567",
        payload: {
          version: 1,
          generatedAt: "2026-04-02T00:00:00.000Z",
          game: {
            id: 2025020567,
            seasonId: 20252026,
            date: "2025-12-23",
            homeTeamId: 1,
            awayTeamId: 7,
          },
          rows: [
            {
              kind: "goalies",
              mode: "goalies",
              strength: "allStrengths",
              scoreState: "allScores",
              supportedDisplayModes: ["counts", "rates"],
              playerId: 8477990,
              playerName: "Test Goalie",
              positionCode: "G",
              gameId: 2025020567,
              seasonId: 20252026,
              gameDate: "2025-12-23",
              teamId: 7,
              teamAbbrev: "BUF",
              opponentTeamId: 1,
              isHome: false,
              hasReliableToi: true,
              metrics: {
                toiSeconds: 600,
                gamesPlayed: 1,
                onIceGoalsForForIpp: 0,
                hasUnknownToi: false,
                hasUnknownOnIceGoalDenominator: false,
                individual: {
                  goals: 0,
                  totalAssists: 0,
                  firstAssists: 0,
                  secondAssists: 0,
                  shots: 0,
                  ixg: null,
                  iCf: 0,
                  iFf: 0,
                  iScf: null,
                  iHdcf: null,
                  rushAttempts: 0,
                  reboundsCreated: 0,
                  pim: 0,
                  totalPenalties: 0,
                  minorPenalties: 0,
                  majorPenalties: 0,
                  misconductPenalties: 0,
                  penaltiesDrawn: 0,
                  giveaways: 0,
                  takeaways: 0,
                  hits: 0,
                  hitsTaken: 0,
                  shotsBlocked: 0,
                  faceoffsWon: 0,
                  faceoffsLost: 0,
                },
                onIce: {
                  cf: 0,
                  ca: 0,
                  ff: 0,
                  fa: 0,
                  sf: 0,
                  sa: 0,
                  gf: 0,
                  ga: 0,
                  xgf: null,
                  xga: null,
                  scf: null,
                  sca: null,
                  hdcf: null,
                  hdca: null,
                  hdgf: null,
                  hdga: null,
                  mdcf: null,
                  mdca: null,
                  mdgf: null,
                  mdga: null,
                  ldcf: null,
                },
                goalies: {
                  shotsAgainst: 15,
                  saves: 14,
                  goalsAgainst: 1,
                  xgAgainst: 1.2,
                  hdShotsAgainst: 2,
                  hdSaves: 1,
                  hdGoalsAgainst: 1,
                  hdXgAgainst: 0.5,
                  mdShotsAgainst: 5,
                  mdSaves: 5,
                  mdGoalsAgainst: 0,
                  mdXgAgainst: 0.4,
                  ldShotsAgainst: 8,
                  ldSaves: 8,
                  ldGoalsAgainst: 0,
                  ldXgAgainst: 0.3,
                  rushAttemptsAgainst: 1,
                  reboundAttemptsAgainst: 1,
                  shotDistanceTotal: 420,
                  shotDistanceCount: 15,
                  goalDistanceTotal: 18,
                  goalDistanceCount: 1,
                },
              },
            },
            {
              kind: "goalies",
              mode: "goalies",
              strength: "allStrengths",
              scoreState: "leading",
              supportedDisplayModes: ["counts", "rates"],
              playerId: 8477990,
              playerName: "Test Goalie",
              positionCode: "G",
              gameId: 2025020567,
              seasonId: 20252026,
              gameDate: "2025-12-23",
              teamId: 7,
              teamAbbrev: "BUF",
              opponentTeamId: 1,
              isHome: false,
              hasReliableToi: true,
              metrics: {
                toiSeconds: 300,
                gamesPlayed: 1,
                onIceGoalsForForIpp: 0,
                hasUnknownToi: false,
                hasUnknownOnIceGoalDenominator: false,
                individual: {
                  goals: 0,
                  totalAssists: 0,
                  firstAssists: 0,
                  secondAssists: 0,
                  shots: 0,
                  ixg: null,
                  iCf: 0,
                  iFf: 0,
                  iScf: null,
                  iHdcf: null,
                  rushAttempts: 0,
                  reboundsCreated: 0,
                  pim: 0,
                  totalPenalties: 0,
                  minorPenalties: 0,
                  majorPenalties: 0,
                  misconductPenalties: 0,
                  penaltiesDrawn: 0,
                  giveaways: 0,
                  takeaways: 0,
                  hits: 0,
                  hitsTaken: 0,
                  shotsBlocked: 0,
                  faceoffsWon: 0,
                  faceoffsLost: 0,
                },
                onIce: {
                  cf: 0,
                  ca: 0,
                  ff: 0,
                  fa: 0,
                  sf: 0,
                  sa: 0,
                  gf: 0,
                  ga: 0,
                  xgf: null,
                  xga: null,
                  scf: null,
                  sca: null,
                  hdcf: null,
                  hdca: null,
                  hdgf: null,
                  hdga: null,
                  mdcf: null,
                  mdca: null,
                  mdgf: null,
                  mdga: null,
                  ldcf: null,
                },
                goalies: {
                  shotsAgainst: 8,
                  saves: 8,
                  goalsAgainst: 0,
                  xgAgainst: 0.6,
                  hdShotsAgainst: 1,
                  hdSaves: 1,
                  hdGoalsAgainst: 0,
                  hdXgAgainst: 0.2,
                  mdShotsAgainst: 3,
                  mdSaves: 3,
                  mdGoalsAgainst: 0,
                  mdXgAgainst: 0.2,
                  ldShotsAgainst: 4,
                  ldSaves: 4,
                  ldGoalsAgainst: 0,
                  ldXgAgainst: 0.2,
                  rushAttemptsAgainst: 0,
                  reboundAttemptsAgainst: 0,
                  shotDistanceTotal: 240,
                  shotDistanceCount: 8,
                  goalDistanceTotal: 0,
                  goalDistanceCount: 0,
                },
              },
            },
          ],
        },
      } as any,
    ]);

    expect(
      snapshots.map((snapshot) => snapshot.source_url).sort()
    ).toEqual([
      "derived://underlying-player-summary-v2/goalies/allStrengths/2025020567",
      "derived://underlying-player-summary-v2/goalies/allStrengths/leading/2025020567",
    ]);
  });
});

describe("buildPlayerStatsDetailAggregationFromSummaryRows", () => {
  function createSummaryMetrics() {
    return {
      toiSeconds: 900,
      gamesPlayed: 1,
      onIceGoalsForForIpp: 1,
      hasUnknownToi: false,
      hasUnknownOnIceGoalDenominator: false,
      individual: {
        goals: 1,
        totalAssists: 1,
        firstAssists: 1,
        secondAssists: 0,
        shots: 3,
        ixg: 0.4,
        iCf: 4,
        iFf: 3,
        iScf: 2,
        iHdcf: 1,
        rushAttempts: 0,
        reboundsCreated: 0,
        pim: 0,
        totalPenalties: 0,
        minorPenalties: 0,
        majorPenalties: 0,
        misconductPenalties: 0,
        penaltiesDrawn: 0,
        giveaways: 0,
        takeaways: 0,
        hits: 0,
        hitsTaken: 0,
        shotsBlocked: 0,
        faceoffsWon: 0,
        faceoffsLost: 0,
      },
      onIce: {
        cf: 5,
        ca: 4,
        ff: 4,
        fa: 3,
        sf: 3,
        sa: 2,
        gf: 1,
        ga: 0,
        xgf: 0.8,
        xga: 0.4,
        scf: 2,
        sca: 1,
        hdcf: 1,
        hdca: 0,
        hdgf: 1,
        hdga: 0,
        mdcf: 1,
        mdca: 1,
        mdgf: 0,
        mdga: 0,
        ldcf: 1,
      },
      goalies: {
        shotsAgainst: 0,
        saves: 0,
        goalsAgainst: 0,
        xgAgainst: null,
        hdShotsAgainst: 0,
        hdSaves: 0,
        hdGoalsAgainst: 0,
        hdXgAgainst: null,
        mdShotsAgainst: 0,
        mdSaves: 0,
        mdGoalsAgainst: 0,
        mdXgAgainst: null,
        ldShotsAgainst: 0,
        ldSaves: 0,
        ldGoalsAgainst: 0,
        ldXgAgainst: null,
        rushAttemptsAgainst: 0,
        reboundAttemptsAgainst: 0,
        shotDistanceTotal: 0,
        shotDistanceCount: 0,
        goalDistanceTotal: 0,
        goalDistanceCount: 0,
      },
    };
  }

  it("groups one row per season by default and splits season-team rows only when tradeMode is split", () => {
    const games: PlayerStatsSourceGameRow[] = [
      {
        id: 101,
        seasonId: 20252026,
        date: "2025-10-10",
        startTime: "2025-10-10T23:00:00.000Z",
        homeTeamId: 6,
        awayTeamId: 14,
        type: 2,
        created_at: "2025-10-10T00:00:00.000Z",
      },
      {
        id: 102,
        seasonId: 20252026,
        date: "2026-02-10",
        startTime: "2026-02-10T23:00:00.000Z",
        homeTeamId: 1,
        awayTeamId: 14,
        type: 2,
        created_at: "2026-02-10T00:00:00.000Z",
      },
    ];

    const summaryRows = [
      {
        kind: "individual",
        mode: "individual",
        strength: "fiveOnFive",
        supportedDisplayModes: ["counts", "rates"],
        playerId: 8478401,
        playerName: "Pavel Zacha",
        positionCode: "C",
        gameId: 101,
        seasonId: 20252026,
        gameDate: "2025-10-10",
        teamId: 6,
        teamAbbrev: "BOS",
        opponentTeamId: 14,
        isHome: true,
        hasReliableToi: true,
        metrics: createSummaryMetrics(),
      },
      {
        kind: "individual",
        mode: "individual",
        strength: "fiveOnFive",
        supportedDisplayModes: ["counts", "rates"],
        playerId: 8478401,
        playerName: "Pavel Zacha",
        positionCode: "C",
        gameId: 102,
        seasonId: 20252026,
        gameDate: "2026-02-10",
        teamId: 1,
        teamAbbrev: "NJD",
        opponentTeamId: 14,
        isHome: true,
        hasReliableToi: true,
        metrics: createSummaryMetrics(),
      },
    ] as const;

    const combineState = createDefaultDetailFilterState({
      currentSeasonId: 20252026,
    });
    combineState.primary.statMode = "individual";
    combineState.primary.displayMode = "counts";
    combineState.primary.strength = "fiveOnFive";

    const combinedRows = buildPlayerStatsDetailAggregationFromSummaryRows({
      playerId: 8478401,
      state: combineState,
      games,
      rows: summaryRows,
    });

    expect(combinedRows).toHaveLength(1);
    expect(combinedRows[0]).toMatchObject({
      rowKey: "detail:season:8478401:20252026",
      seasonId: 20252026,
      seasonLabel: "2025-26",
      gamesPlayed: 2,
      teamLabel: "BOS / NJD",
    });

    const splitState = createDefaultDetailFilterState({
      currentSeasonId: 20252026,
    });
    splitState.primary.statMode = "individual";
    splitState.primary.displayMode = "counts";
    splitState.primary.strength = "fiveOnFive";
    splitState.expandable.tradeMode = "split";

    const splitRows = buildPlayerStatsDetailAggregationFromSummaryRows({
      playerId: 8478401,
      state: splitState,
      games,
      rows: summaryRows,
    });

    expect(splitRows).toHaveLength(2);
    expect(splitRows.map((row) => row.rowKey)).toEqual([
      "detail:seasonTeam:8478401:20252026:6",
      "detail:seasonTeam:8478401:20252026:1",
    ]);
    expect(splitRows.map((row) => row.teamLabel)).toEqual(["BOS", "NJD"]);
    expect(splitRows.every((row) => row.gamesPlayed === 1)).toBe(true);
  });

  it("retains partial-season detail rows across a multi-season range without normalizing them", () => {
    const games: PlayerStatsSourceGameRow[] = [
      {
        id: 111,
        seasonId: 20242025,
        date: "2024-11-01",
        startTime: "2024-11-01T23:00:00.000Z",
        homeTeamId: 6,
        awayTeamId: 14,
        type: 2,
        created_at: "2024-11-01T00:00:00.000Z",
      },
      {
        id: 211,
        seasonId: 20252026,
        date: "2025-10-10",
        startTime: "2025-10-10T23:00:00.000Z",
        homeTeamId: 6,
        awayTeamId: 14,
        type: 2,
        created_at: "2025-10-10T00:00:00.000Z",
      },
      {
        id: 212,
        seasonId: 20252026,
        date: "2025-10-12",
        startTime: "2025-10-12T23:00:00.000Z",
        homeTeamId: 6,
        awayTeamId: 14,
        type: 2,
        created_at: "2025-10-12T00:00:00.000Z",
      },
    ];

    const state = createDefaultDetailFilterState({
      currentSeasonId: 20252026,
    });
    state.primary.seasonRange = {
      fromSeasonId: 20242025,
      throughSeasonId: 20252026,
    };
    state.primary.statMode = "individual";
    state.primary.displayMode = "counts";
    state.primary.strength = "fiveOnFive";

    const rows = buildPlayerStatsDetailAggregationFromSummaryRows({
      playerId: 8478401,
      state,
      games,
      rows: [
        {
          kind: "individual",
          mode: "individual",
          strength: "fiveOnFive",
          supportedDisplayModes: ["counts", "rates"],
          playerId: 8478401,
          playerName: "Pavel Zacha",
          positionCode: "C",
          gameId: 111,
          seasonId: 20242025,
          gameDate: "2024-11-01",
          teamId: 6,
          teamAbbrev: "BOS",
          opponentTeamId: 14,
          isHome: true,
          hasReliableToi: true,
          metrics: createSummaryMetrics({
            toiSeconds: 600,
            goals: 0,
            totalAssists: 1,
            shots: 2,
          }),
        },
        {
          kind: "individual",
          mode: "individual",
          strength: "fiveOnFive",
          supportedDisplayModes: ["counts", "rates"],
          playerId: 8478401,
          playerName: "Pavel Zacha",
          positionCode: "C",
          gameId: 211,
          seasonId: 20252026,
          gameDate: "2025-10-10",
          teamId: 6,
          teamAbbrev: "BOS",
          opponentTeamId: 14,
          isHome: true,
          hasReliableToi: true,
          metrics: createSummaryMetrics({
            toiSeconds: 900,
            goals: 1,
            totalAssists: 1,
            shots: 3,
          }),
        },
        {
          kind: "individual",
          mode: "individual",
          strength: "fiveOnFive",
          supportedDisplayModes: ["counts", "rates"],
          playerId: 8478401,
          playerName: "Pavel Zacha",
          positionCode: "C",
          gameId: 212,
          seasonId: 20252026,
          gameDate: "2025-10-12",
          teamId: 6,
          teamAbbrev: "BOS",
          opponentTeamId: 14,
          isHome: true,
          hasReliableToi: true,
          metrics: createSummaryMetrics({
            toiSeconds: 900,
            goals: 1,
            totalAssists: 0,
            shots: 4,
          }),
        },
      ] as any,
    });

    expect(rows).toHaveLength(2);

    const rowsBySeasonLabel = new Map(
      rows.map((row) => [row.seasonLabel, row] as const)
    );

    expect(rowsBySeasonLabel.get("2025-26")).toMatchObject({
      gamesPlayed: 2,
    });
    expect(rowsBySeasonLabel.get("2024-25")).toMatchObject({
      gamesPlayed: 1,
    });
  });

  it("server-paginates large detail result sets after sorting instead of returning every row", () => {
    const games = Array.from({ length: 120 }, (_, index) => ({
      id: 700 + index,
      seasonId: 20252026 - index,
      date: `${2025 - index}-10-01`,
      startTime: `${2025 - index}-10-01T23:00:00.000Z`,
      homeTeamId: 6,
      awayTeamId: 14,
      type: 2,
      created_at: `${2025 - index}-10-01T00:00:00.000Z`,
    })) as PlayerStatsSourceGameRow[];

    const state = createDefaultDetailFilterState({
      currentSeasonId: 20252026,
      pageSize: 50,
    });
    state.primary.seasonRange = {
      fromSeasonId: 20252026 - 119,
      throughSeasonId: 20252026,
    };
    state.primary.statMode = "individual";
    state.primary.displayMode = "counts";
    state.primary.strength = "fiveOnFive";
    state.view.sort = { sortKey: "totalPoints", direction: "desc" };
    state.view.pagination = { page: 2, pageSize: 50 };

    const aggregationRows = buildPlayerStatsDetailAggregationFromSummaryRows({
      playerId: 8478401,
      state,
      games,
      rows: games.map((game, index) => ({
        kind: "individual",
        mode: "individual",
        strength: "fiveOnFive",
        supportedDisplayModes: ["counts", "rates"],
        playerId: 8478401,
        playerName: "Pavel Zacha",
        positionCode: "C",
        gameId: game.id,
        seasonId: game.seasonId,
        gameDate: game.date,
        teamId: 6,
        teamAbbrev: "BOS",
        opponentTeamId: 14,
        isHome: true,
        hasReliableToi: true,
        metrics: createSummaryMetrics({
          toiSeconds: 900,
          goals: 120 - index,
          totalAssists: 0,
          shots: 120 - index,
        }),
      })) as any,
    });

    const pageOneResult = buildDetailApiResultFromAggregationRows({
      playerId: 8478401,
      state: {
        ...state,
        view: {
          ...state.view,
          pagination: { page: 1, pageSize: 50 },
        },
      },
      rows: aggregationRows,
    });

    const result = buildDetailApiResultFromAggregationRows({
      playerId: 8478401,
      state,
      rows: aggregationRows,
    });

    expect(result.pagination).toMatchObject({
      page: 2,
      pageSize: 50,
      totalRows: 120,
      totalPages: 3,
    });
    expect(pageOneResult.rows).toHaveLength(50);
    expect(result.rows).toHaveLength(50);
    const pageOneKeys = new Set(pageOneResult.rows.map((row) => row.rowKey));
    expect(result.rows.every((row) => pageOneKeys.has(row.rowKey) === false)).toBe(true);
  });
});

describe("buildPlayerStatsLandingAggregationFromSummaryRows", () => {
  function createSummaryMetrics(args?: {
    toiSeconds?: number;
    gamesPlayed?: number;
    goals?: number;
    totalAssists?: number;
    shots?: number;
  }) {
    return {
      toiSeconds: args?.toiSeconds ?? 900,
      gamesPlayed: args?.gamesPlayed ?? 1,
      onIceGoalsForForIpp: 1,
      hasUnknownToi: false,
      hasUnknownOnIceGoalDenominator: false,
      individual: {
        goals: args?.goals ?? 1,
        totalAssists: args?.totalAssists ?? 1,
        firstAssists: args?.totalAssists ?? 1,
        secondAssists: 0,
        shots: args?.shots ?? 3,
        ixg: 0.4,
        iCf: 4,
        iFf: 3,
        iScf: 2,
        iHdcf: 1,
        rushAttempts: 0,
        reboundsCreated: 0,
        pim: 0,
        totalPenalties: 0,
        minorPenalties: 0,
        majorPenalties: 0,
        misconductPenalties: 0,
        penaltiesDrawn: 0,
        giveaways: 0,
        takeaways: 0,
        hits: 0,
        hitsTaken: 0,
        shotsBlocked: 0,
        faceoffsWon: 0,
        faceoffsLost: 0,
      },
      onIce: {
        cf: 5,
        ca: 4,
        ff: 4,
        fa: 3,
        sf: 3,
        sa: 2,
        gf: 1,
        ga: 0,
        xgf: 0.8,
        xga: 0.4,
        scf: 2,
        sca: 1,
        hdcf: 1,
        hdca: 0,
        hdgf: 1,
        hdga: 0,
        mdcf: 1,
        mdca: 1,
        mdgf: 0,
        mdga: 0,
        ldcf: 1,
      },
      goalies: {
        shotsAgainst: 0,
        saves: 0,
        goalsAgainst: 0,
        xgAgainst: null,
        hdShotsAgainst: 0,
        hdSaves: 0,
        hdGoalsAgainst: 0,
        hdXgAgainst: null,
        mdShotsAgainst: 0,
        mdSaves: 0,
        mdGoalsAgainst: 0,
        mdXgAgainst: null,
        ldShotsAgainst: 0,
        ldSaves: 0,
        ldGoalsAgainst: 0,
        ldXgAgainst: null,
        rushAttemptsAgainst: 0,
        reboundAttemptsAgainst: 0,
        shotDistanceTotal: 0,
        shotDistanceCount: 0,
        goalDistanceTotal: 0,
        goalDistanceCount: 0,
      },
    };
  }

  function createSummaryRow(args: {
    playerId: number;
    playerName: string;
    positionCode: string;
    gameId: number;
    seasonId: number;
    gameDate: string;
    teamId: number;
    teamAbbrev: string;
    opponentTeamId: number;
    isHome?: boolean;
    toiSeconds?: number;
    goals?: number;
    totalAssists?: number;
    shots?: number;
  }) {
    return {
      kind: "individual",
      mode: "individual",
      strength: "fiveOnFive",
      supportedDisplayModes: ["counts", "rates"],
      playerId: args.playerId,
      playerName: args.playerName,
      positionCode: args.positionCode,
      gameId: args.gameId,
      seasonId: args.seasonId,
      gameDate: args.gameDate,
      teamId: args.teamId,
      teamAbbrev: args.teamAbbrev,
      opponentTeamId: args.opponentTeamId,
      isHome: args.isHome ?? true,
      hasReliableToi: true,
      metrics: createSummaryMetrics({
        toiSeconds: args.toiSeconds,
        goals: args.goals,
        totalAssists: args.totalAssists,
        shots: args.shots,
      }),
    } as const;
  }

  it("applies game-range windows before final landing aggregation", () => {
    const games: PlayerStatsSourceGameRow[] = [
      {
        id: 201,
        seasonId: 20252026,
        date: "2025-10-10",
        startTime: "2025-10-10T23:00:00.000Z",
        homeTeamId: 6,
        awayTeamId: 14,
        type: 2,
        created_at: "2025-10-10T00:00:00.000Z",
      },
      {
        id: 202,
        seasonId: 20252026,
        date: "2025-10-12",
        startTime: "2025-10-12T23:00:00.000Z",
        homeTeamId: 6,
        awayTeamId: 14,
        type: 2,
        created_at: "2025-10-12T00:00:00.000Z",
      },
      {
        id: 203,
        seasonId: 20252026,
        date: "2025-10-14",
        startTime: "2025-10-14T23:00:00.000Z",
        homeTeamId: 6,
        awayTeamId: 14,
        type: 2,
        created_at: "2025-10-14T00:00:00.000Z",
      },
    ];

    const state = createDefaultLandingFilterState({
      currentSeasonId: 20252026,
    });
    state.primary.statMode = "individual";
    state.primary.displayMode = "counts";
    state.primary.strength = "fiveOnFive";
    state.expandable.scope = { kind: "gameRange", value: 2 };
    state.view.sort = { sortKey: "gamesPlayed", direction: "desc" };

    const aggregationRows = buildPlayerStatsLandingAggregationFromSummaryRows({
      state,
      games,
      rows: [
        createSummaryRow({
          playerId: 9001,
          playerName: "Taylor Test",
          positionCode: "C",
          gameId: 201,
          seasonId: 20252026,
          gameDate: "2025-10-10",
          teamId: 6,
          teamAbbrev: "BOS",
          opponentTeamId: 14,
        }),
        createSummaryRow({
          playerId: 9001,
          playerName: "Taylor Test",
          positionCode: "C",
          gameId: 202,
          seasonId: 20252026,
          gameDate: "2025-10-12",
          teamId: 6,
          teamAbbrev: "BOS",
          opponentTeamId: 14,
        }),
        createSummaryRow({
          playerId: 9001,
          playerName: "Taylor Test",
          positionCode: "C",
          gameId: 203,
          seasonId: 20252026,
          gameDate: "2025-10-14",
          teamId: 6,
          teamAbbrev: "BOS",
          opponentTeamId: 14,
        }),
      ] as any,
    });

    const result = buildLandingApiResultFromAggregationRows({
      state,
      rows: aggregationRows,
    });

    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]).toMatchObject({
      playerName: "Taylor Test",
      gamesPlayed: 2,
      totalPoints: 4,
      toiSeconds: 1800,
    });
  });

  it("supports landing combine rows by default and split rows when tradeMode is split", () => {
    const games: PlayerStatsSourceGameRow[] = [
      {
        id: 301,
        seasonId: 20252026,
        date: "2025-10-10",
        startTime: "2025-10-10T23:00:00.000Z",
        homeTeamId: 6,
        awayTeamId: 14,
        type: 2,
        created_at: "2025-10-10T00:00:00.000Z",
      },
      {
        id: 302,
        seasonId: 20252026,
        date: "2026-02-10",
        startTime: "2026-02-10T23:00:00.000Z",
        homeTeamId: 1,
        awayTeamId: 14,
        type: 2,
        created_at: "2026-02-10T00:00:00.000Z",
      },
    ];

    const rows = [
      createSummaryRow({
        playerId: 8478401,
        playerName: "Pavel Zacha",
        positionCode: "C",
        gameId: 301,
        seasonId: 20252026,
        gameDate: "2025-10-10",
        teamId: 6,
        teamAbbrev: "BOS",
        opponentTeamId: 14,
      }),
      createSummaryRow({
        playerId: 8478401,
        playerName: "Pavel Zacha",
        positionCode: "C",
        gameId: 302,
        seasonId: 20252026,
        gameDate: "2026-02-10",
        teamId: 1,
        teamAbbrev: "NJD",
        opponentTeamId: 14,
      }),
    ] as any;

    const combineState = createDefaultLandingFilterState({
      currentSeasonId: 20252026,
    });
    combineState.primary.statMode = "individual";
    combineState.primary.displayMode = "counts";
    combineState.primary.strength = "fiveOnFive";
    combineState.expandable.tradeMode = "combine";

    const combinedResult = buildLandingApiResultFromAggregationRows({
      state: combineState,
      rows: buildPlayerStatsLandingAggregationFromSummaryRows({
        state: combineState,
        games,
        rows,
      }),
    });

    expect(combinedResult.rows).toHaveLength(1);
    expect(combinedResult.rows[0]).toMatchObject({
      rowKey: "landing:player:8478401",
      teamLabel: "BOS / NJD",
      gamesPlayed: 2,
    });

    const splitState = createDefaultLandingFilterState({
      currentSeasonId: 20252026,
    });
    splitState.primary.statMode = "individual";
    splitState.primary.displayMode = "counts";
    splitState.primary.strength = "fiveOnFive";
    splitState.expandable.tradeMode = "split";

    const splitResult = buildLandingApiResultFromAggregationRows({
      state: splitState,
      rows: buildPlayerStatsLandingAggregationFromSummaryRows({
        state: splitState,
        games,
        rows,
      }),
    });

    expect(splitResult.rows).toHaveLength(2);
    expect(splitResult.rows.map((row) => row.rowKey)).toEqual([
      "landing:playerTeam:8478401:6",
      "landing:playerTeam:8478401:1",
    ]);
    expect(splitResult.rows.map((row) => row.teamLabel)).toEqual(["BOS", "NJD"]);
  });

  it("applies minimum TOI after summary-row aggregation eligibility is resolved", () => {
    const games: PlayerStatsSourceGameRow[] = [
      {
        id: 401,
        seasonId: 20252026,
        date: "2025-10-10",
        startTime: "2025-10-10T23:00:00.000Z",
        homeTeamId: 6,
        awayTeamId: 14,
        type: 2,
        created_at: "2025-10-10T00:00:00.000Z",
      },
      {
        id: 402,
        seasonId: 20252026,
        date: "2025-10-12",
        startTime: "2025-10-12T23:00:00.000Z",
        homeTeamId: 6,
        awayTeamId: 14,
        type: 2,
        created_at: "2025-10-12T00:00:00.000Z",
      },
    ];

    const state = createDefaultLandingFilterState({
      currentSeasonId: 20252026,
    });
    state.primary.statMode = "individual";
    state.primary.displayMode = "counts";
    state.primary.strength = "fiveOnFive";
    state.expandable.minimumToiSeconds = 1000;
    state.view.sort = { sortKey: "gamesPlayed", direction: "desc" };

    const result = buildLandingApiResultFromAggregationRows({
      state,
      rows: buildPlayerStatsLandingAggregationFromSummaryRows({
        state,
        games,
        rows: [
          createSummaryRow({
            playerId: 9001,
            playerName: "Eligible Skater",
            positionCode: "C",
            gameId: 401,
            seasonId: 20252026,
            gameDate: "2025-10-10",
            teamId: 6,
            teamAbbrev: "BOS",
            opponentTeamId: 14,
            toiSeconds: 600,
          }),
          createSummaryRow({
            playerId: 9001,
            playerName: "Eligible Skater",
            positionCode: "C",
            gameId: 402,
            seasonId: 20252026,
            gameDate: "2025-10-12",
            teamId: 6,
            teamAbbrev: "BOS",
            opponentTeamId: 14,
            toiSeconds: 500,
          }),
          createSummaryRow({
            playerId: 9002,
            playerName: "Short TOI",
            positionCode: "C",
            gameId: 401,
            seasonId: 20252026,
            gameDate: "2025-10-10",
            teamId: 6,
            teamAbbrev: "BOS",
            opponentTeamId: 14,
            toiSeconds: 450,
          }),
          createSummaryRow({
            playerId: 9002,
            playerName: "Short TOI",
            positionCode: "C",
            gameId: 402,
            seasonId: 20252026,
            gameDate: "2025-10-12",
            teamId: 6,
            teamAbbrev: "BOS",
            opponentTeamId: 14,
            toiSeconds: 450,
          }),
        ] as any,
      }),
    });

    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]).toMatchObject({
      playerName: "Eligible Skater",
      toiSeconds: 1100,
      gamesPlayed: 2,
    });
  });

  it("returns null rate metrics when the relevant denominator is zero", () => {
    const games: PlayerStatsSourceGameRow[] = [
      {
        id: 451,
        seasonId: 20252026,
        date: "2025-10-10",
        startTime: "2025-10-10T23:00:00.000Z",
        homeTeamId: 6,
        awayTeamId: 14,
        type: 2,
        created_at: "2025-10-10T00:00:00.000Z",
      },
    ];

    const state = createDefaultLandingFilterState({
      currentSeasonId: 20252026,
    });
    state.primary.statMode = "individual";
    state.primary.displayMode = "rates";
    state.primary.strength = "fiveOnFive";

    const zeroRow = createSummaryRow({
      playerId: 9003,
      playerName: "Zero Denominator",
      positionCode: "C",
      gameId: 451,
      seasonId: 20252026,
      gameDate: "2025-10-10",
      teamId: 6,
      teamAbbrev: "BOS",
      opponentTeamId: 14,
      toiSeconds: 0,
      goals: 0,
      totalAssists: 0,
      shots: 0,
    }) as any;
    zeroRow.metrics.onIceGoalsForForIpp = 0;

    const result = buildLandingApiResultFromAggregationRows({
      state,
      rows: buildPlayerStatsLandingAggregationFromSummaryRows({
        state,
        games,
        rows: [zeroRow],
      }),
    });

    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]).toMatchObject({
      playerName: "Zero Denominator",
      toiSeconds: 0,
      goalsPer60: null,
      totalPointsPer60: null,
      shootingPct: null,
      faceoffPct: null,
      ipp: null,
    });
  });

  it("counts only appearances inside a by-team-games window when the player missed one of the team games", () => {
    const games: PlayerStatsSourceGameRow[] = [
      {
        id: 501,
        seasonId: 20252026,
        date: "2025-10-08",
        startTime: "2025-10-08T23:00:00.000Z",
        homeTeamId: 6,
        awayTeamId: 14,
        type: 2,
        created_at: "2025-10-08T00:00:00.000Z",
      },
      {
        id: 502,
        seasonId: 20252026,
        date: "2025-10-10",
        startTime: "2025-10-10T23:00:00.000Z",
        homeTeamId: 6,
        awayTeamId: 14,
        type: 2,
        created_at: "2025-10-10T00:00:00.000Z",
      },
      {
        id: 503,
        seasonId: 20252026,
        date: "2025-10-12",
        startTime: "2025-10-12T23:00:00.000Z",
        homeTeamId: 6,
        awayTeamId: 14,
        type: 2,
        created_at: "2025-10-12T00:00:00.000Z",
      },
    ];

    const state = createDefaultLandingFilterState({
      currentSeasonId: 20252026,
    });
    state.primary.statMode = "individual";
    state.primary.displayMode = "counts";
    state.primary.strength = "fiveOnFive";
    state.expandable.scope = { kind: "byTeamGames", value: 2 };
    state.view.sort = { sortKey: "gamesPlayed", direction: "desc" };

    const result = buildLandingApiResultFromAggregationRows({
      state,
      rows: buildPlayerStatsLandingAggregationFromSummaryRows({
        state,
        games,
        rows: [
          createSummaryRow({
            playerId: 9004,
            playerName: "Missed One Game",
            positionCode: "C",
            gameId: 501,
            seasonId: 20252026,
            gameDate: "2025-10-08",
            teamId: 6,
            teamAbbrev: "BOS",
            opponentTeamId: 14,
            goals: 2,
            totalAssists: 1,
          }),
          createSummaryRow({
            playerId: 9004,
            playerName: "Missed One Game",
            positionCode: "C",
            gameId: 502,
            seasonId: 20252026,
            gameDate: "2025-10-10",
            teamId: 6,
            teamAbbrev: "BOS",
            opponentTeamId: 14,
            goals: 1,
            totalAssists: 1,
          }),
        ] as any,
      }),
    });

    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]).toMatchObject({
      playerName: "Missed One Game",
      gamesPlayed: 1,
      totalPoints: 2,
    });
  });

  it("server-paginates large landing result sets after sorting so wide tables only render the active page", () => {
    const state = createDefaultLandingFilterState({
      currentSeasonId: 20252026,
      pageSize: 50,
    });
    state.primary.statMode = "individual";
    state.primary.displayMode = "counts";
    state.primary.strength = "fiveOnFive";
    state.view.sort = { sortKey: "totalPoints", direction: "desc" };
    state.view.pagination = { page: 3, pageSize: 50 };

    const result = buildLandingApiResultFromAggregationRows({
      state,
      rows: Array.from({ length: 123 }, (_, index) => ({
        rowKey: `landing:player:${index + 1}`,
        playerId: index + 1,
        playerName: `Player ${index + 1}`,
        positionCode: "C",
        teamId: 6,
        teamLabel: "BOS",
        gamesPlayed: 1,
        toiSeconds: 900,
        toiPerGameSeconds: 900,
        sortTeamDate: "2025-10-01",
        metrics: {
          ...createSummaryMetrics({
            toiSeconds: 900,
            goals: 123 - index,
            totalAssists: 0,
            shots: 123 - index,
          }),
        },
      })) as any,
    });

    expect(result.pagination).toMatchObject({
      page: 3,
      pageSize: 50,
      totalRows: 123,
      totalPages: 3,
    });
    expect(result.rows).toHaveLength(23);
    expect(result.rows[0]).toMatchObject({
      playerName: "Player 101",
      totalPoints: 23,
    });
    expect(result.rows.at(-1)).toMatchObject({
      playerName: "Player 123",
      totalPoints: 1,
    });
  });
});

describe("buildPlayerStatsNativeGameParity", () => {
  it("builds native per-game parity from stored games, events, and shifts", () => {
    const game: PlayerStatsSourceGameRow = {
      id: 100,
      seasonId: 20252026,
      date: "2025-10-10",
      startTime: "2025-10-10T23:00:00.000Z",
      homeTeamId: 10,
      awayTeamId: 20,
      type: 2,
      created_at: "2025-10-10T00:00:00.000Z",
    };

    const events: PlayerStatsSourceEventRow[] = [
      {
        event_id: 30,
        assist1_player_id: null,
        assist2_player_id: null,
        away_goalie: null,
        away_score: 0,
        away_skaters: 5,
        away_sog: 1,
        blocking_player_id: null,
        committed_by_player_id: null,
        created_at: "2025-10-10T00:00:00.000Z",
        details: null,
        drawn_by_player_id: null,
        event_owner_side: null,
        event_owner_team_id: 10,
        game_date: "2025-10-10",
        game_id: 100,
        goalie_in_net_id: 3001,
        hittee_player_id: null,
        hitting_player_id: null,
        home_goalie: null,
        home_score: 1,
        home_skaters: 5,
        home_sog: 1,
        home_team_defending_side: "left",
        is_goal: true,
        is_penalty: false,
        is_shot_like: true,
        losing_player_id: null,
        parser_version: 1,
        penalty_desc_key: null,
        penalty_duration_minutes: null,
        penalty_type_code: null,
        period_number: 1,
        period_seconds_elapsed: 180,
        period_type: "REG",
        player_id: null,
        raw_event: null,
        reason: null,
        scoring_player_id: 9001,
        season_id: 20252026,
        secondary_reason: null,
        served_by_player_id: null,
        shooting_player_id: 9001,
        shot_type: "wrist",
        situation_code: "1551",
        sort_order: 30,
        source_play_by_play_hash: "hash-b",
        strength_exact: "5v5",
        strength_state: "EV",
        strength_version: 1,
        time_in_period: "03:00",
        time_remaining: "17:00",
        time_remaining_seconds: 1020,
        type_code: 505,
        type_desc_key: "goal",
        updated_at: "2025-10-10T00:00:00.000Z",
        winning_player_id: null,
        x_coord: 70,
        y_coord: 12,
        zone_code: "O",
      },
    ];

    const shiftRows: PlayerStatsSourceShiftRow[] = [
      {
        created_at: "2025-10-10T00:00:00.000Z",
        detail_code: null,
        duration: "05:00",
        duration_seconds: 300,
        end_seconds: 300,
        end_time: "05:00",
        event_description: null,
        event_details: null,
        event_number: null,
        first_name: "Test",
        game_date: "2025-10-10",
        game_id: 100,
        hex_value: null,
        last_name: "Skater",
        parser_version: 1,
        period: 1,
        player_id: 9001,
        raw_shift: null,
        season_id: 20252026,
        shift_id: 1,
        shift_number: 1,
        source_shiftcharts_hash: "shift-a",
        start_seconds: 0,
        start_time: "00:00",
        team_abbrev: "HME",
        team_id: 10,
        team_name: "Home",
        type_code: null,
        updated_at: "2025-10-10T00:00:00.000Z",
      },
      {
        created_at: "2025-10-10T00:00:00.000Z",
        detail_code: null,
        duration: "05:00",
        duration_seconds: 300,
        end_seconds: 300,
        end_time: "05:00",
        event_description: null,
        event_details: null,
        event_number: null,
        first_name: "Test",
        game_date: "2025-10-10",
        game_id: 100,
        hex_value: null,
        last_name: "Goalie",
        parser_version: 1,
        period: 1,
        player_id: 3001,
        raw_shift: null,
        season_id: 20252026,
        shift_id: 2,
        shift_number: 1,
        source_shiftcharts_hash: "shift-b",
        start_seconds: 0,
        start_time: "00:00",
        team_abbrev: "AWY",
        team_id: 20,
        team_name: "Away",
        type_code: null,
        updated_at: "2025-10-10T00:00:00.000Z",
      },
    ];

    const parity = buildPlayerStatsNativeGameParity({
      game,
      events,
      shiftRows,
    });

    expect(parity.parity.skaters.all.counts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          player_id: 9001,
          gp: 1,
          toi: 300,
          goals: 1,
          shots: 1,
          total_points: 1,
        }),
      ])
    );

    expect(parity.parity.goalies.all.counts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          player_id: 3001,
          gp: 1,
          toi: 300,
          shots_against: 1,
          saves: 0,
          goals_against: 1,
        }),
      ])
    );
  });

  it("builds parity bundles across multiple selected games", () => {
    const game: PlayerStatsSourceGameRow = {
      id: 100,
      seasonId: 20252026,
      date: "2025-10-10",
      startTime: "2025-10-10T23:00:00.000Z",
      homeTeamId: 10,
      awayTeamId: 20,
      type: 2,
      created_at: "2025-10-10T00:00:00.000Z",
    };

    const parityByGame = buildPlayerStatsLandingParityByGame({
      games: [game],
      eventsByGameId: groupPlayerStatsSourceRowsByGameId([
        {
          game_id: 100,
          event_id: 30,
          assist1_player_id: null,
          assist2_player_id: null,
          away_goalie: null,
          away_score: 0,
          away_skaters: 5,
          away_sog: 1,
          blocking_player_id: null,
          committed_by_player_id: null,
          created_at: "2025-10-10T00:00:00.000Z",
          details: null,
          drawn_by_player_id: null,
          event_owner_side: null,
          event_owner_team_id: 10,
          game_date: "2025-10-10",
          goalie_in_net_id: 3001,
          hittee_player_id: null,
          hitting_player_id: null,
          home_goalie: null,
          home_score: 1,
          home_skaters: 5,
          home_sog: 1,
          home_team_defending_side: "left",
          is_goal: true,
          is_penalty: false,
          is_shot_like: true,
          losing_player_id: null,
          parser_version: 1,
          penalty_desc_key: null,
          penalty_duration_minutes: null,
          penalty_type_code: null,
          period_number: 1,
          period_seconds_elapsed: 180,
          period_type: "REG",
          player_id: null,
          raw_event: null,
          reason: null,
          scoring_player_id: 9001,
          season_id: 20252026,
          secondary_reason: null,
          served_by_player_id: null,
          shooting_player_id: 9001,
          shot_type: "wrist",
          situation_code: "1551",
          sort_order: 30,
          source_play_by_play_hash: "hash-b",
          strength_exact: "5v5",
          strength_state: "EV",
          strength_version: 1,
          time_in_period: "03:00",
          time_remaining: "17:00",
          time_remaining_seconds: 1020,
          type_code: 505,
          type_desc_key: "goal",
          updated_at: "2025-10-10T00:00:00.000Z",
          winning_player_id: null,
          x_coord: 70,
          y_coord: 12,
          zone_code: "O",
        },
      ]),
      shiftRowsByGameId: groupPlayerStatsSourceRowsByGameId([
        {
          created_at: "2025-10-10T00:00:00.000Z",
          detail_code: null,
          duration: "05:00",
          duration_seconds: 300,
          end_seconds: 300,
          end_time: "05:00",
          event_description: null,
          event_details: null,
          event_number: null,
          first_name: "Test",
          game_date: "2025-10-10",
          game_id: 100,
          hex_value: null,
          last_name: "Skater",
          parser_version: 1,
          period: 1,
          player_id: 9001,
          raw_shift: null,
          season_id: 20252026,
          shift_id: 1,
          shift_number: 1,
          source_shiftcharts_hash: "shift-a",
          start_seconds: 0,
          start_time: "00:00",
          team_abbrev: "HME",
          team_id: 10,
          team_name: "Home",
          type_code: null,
          updated_at: "2025-10-10T00:00:00.000Z",
        },
        {
          created_at: "2025-10-10T00:00:00.000Z",
          detail_code: null,
          duration: "05:00",
          duration_seconds: 300,
          end_seconds: 300,
          end_time: "05:00",
          event_description: null,
          event_details: null,
          event_number: null,
          first_name: "Test",
          game_date: "2025-10-10",
          game_id: 100,
          hex_value: null,
          last_name: "Goalie",
          parser_version: 1,
          period: 1,
          player_id: 3001,
          raw_shift: null,
          season_id: 20252026,
          shift_id: 2,
          shift_number: 1,
          source_shiftcharts_hash: "shift-b",
          start_seconds: 0,
          start_time: "00:00",
          team_abbrev: "AWY",
          team_id: 20,
          team_name: "Away",
          type_code: null,
          updated_at: "2025-10-10T00:00:00.000Z",
        },
      ]),
      rosterSpotsByGameId: new Map(),
      ownGoalEventIdsByGameId: new Map(),
    });

    expect(parityByGame).toHaveLength(1);
    expect(parityByGame[0].game.id).toBe(100);
    expect(parityByGame[0].parity.skaters.all.counts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          player_id: 9001,
        }),
      ])
    );
    expect(parityByGame[0].shotFeatures).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          eventId: 30,
        }),
      ])
    );
  });
});

describe("buildPlayerStatsLandingAggregation", () => {
  const games: PlayerStatsSourceGameRow[] = [
    {
      id: 100,
      seasonId: 20252026,
      date: "2025-10-10",
      startTime: "2025-10-10T23:00:00.000Z",
      homeTeamId: 10,
      awayTeamId: 20,
      type: 2,
      created_at: "2025-10-10T00:00:00.000Z",
    },
    {
      id: 101,
      seasonId: 20252026,
      date: "2025-10-12",
      startTime: "2025-10-12T23:00:00.000Z",
      homeTeamId: 30,
      awayTeamId: 20,
      type: 2,
      created_at: "2025-10-12T00:00:00.000Z",
    },
    {
      id: 102,
      seasonId: 20252026,
      date: "2025-10-14",
      startTime: "2025-10-14T23:00:00.000Z",
      homeTeamId: 10,
      awayTeamId: 40,
      type: 2,
      created_at: "2025-10-14T00:00:00.000Z",
    },
  ];

  it("aggregates combine rows across multiple team contexts and sorts by the active family", () => {
    const state = createDefaultLandingFilterState({
      currentSeasonId: 20252026,
    });
    state.primary.statMode = "individual";
    state.primary.displayMode = "counts";
    state.primary.strength = "fiveOnFive";
    state.expandable.tradeMode = "combine";
    state.view.sort = { sortKey: "totalPoints", direction: "desc" };

    const result = buildPlayerStatsLandingAggregation({
      state,
      bundle: {
        games,
        eventsByGameId: new Map(),
        shiftRowsByGameId: new Map([
          [
            100,
            [
              {
                created_at: "",
                detail_code: null,
                duration: "05:00",
                duration_seconds: 300,
                end_seconds: 300,
                end_time: "05:00",
                event_description: null,
                event_details: null,
                event_number: null,
                first_name: "Taylor",
                game_date: games[0].date,
                game_id: 100,
                hex_value: null,
                last_name: "Test",
                parser_version: 1,
                period: 1,
                player_id: 9001,
                raw_shift: null,
                season_id: 20252026,
                shift_id: 1,
                shift_number: 1,
                source_shiftcharts_hash: "a",
                start_seconds: 0,
                start_time: "00:00",
                team_abbrev: "AAA",
                team_id: 10,
                team_name: "Alpha",
                type_code: null,
                updated_at: "",
              },
            ],
          ],
          [
            101,
            [
              {
                created_at: "",
                detail_code: null,
                duration: "04:00",
                duration_seconds: 240,
                end_seconds: 240,
                end_time: "04:00",
                event_description: null,
                event_details: null,
                event_number: null,
                first_name: "Taylor",
                game_date: games[1].date,
                game_id: 101,
                hex_value: null,
                last_name: "Test",
                parser_version: 1,
                period: 1,
                player_id: 9001,
                raw_shift: null,
                season_id: 20252026,
                shift_id: 2,
                shift_number: 1,
                source_shiftcharts_hash: "b",
                start_seconds: 0,
                start_time: "00:00",
                team_abbrev: "BBB",
                team_id: 20,
                team_name: "Beta",
                type_code: null,
                updated_at: "",
              },
            ],
          ],
        ]),
        rosterSpotsByGameId: new Map(),
        ownGoalEventIdsByGameId: new Map(),
      },
      parityByGame: [
        {
          game: games[0],
          parity: {
            skaters: {
              all: { counts: [], rates: [], countsOi: [], ratesOi: [] },
              ev: { counts: [], rates: [], countsOi: [], ratesOi: [] },
              fiveOnFive: {
                counts: [
                  {
                    player_id: 9001,
                    season: 20252026,
                    date_scraped: games[0].date,
                    gp: 1,
                    toi: 300,
                    goals: 1,
                    total_assists: 1,
                    first_assists: 1,
                    second_assists: 0,
                    total_points: 2,
                    shots: 3,
                    ixg: 0.7,
                    icf: 3,
                    iff: 2,
                    iscfs: 2,
                    hdcf: 1,
                    rush_attempts: 1,
                    rebounds_created: 0,
                    pim: 0,
                    total_penalties: 0,
                    minor_penalties: 0,
                    major_penalties: 0,
                    misconduct_penalties: 0,
                    penalties_drawn: 0,
                    giveaways: 0,
                    takeaways: 1,
                    hits: 2,
                    hits_taken: 0,
                    shots_blocked: 1,
                    faceoffs_won: 4,
                    faceoffs_lost: 2,
                    ipp: 100,
                  },
                ],
                rates: [],
                countsOi: [
                  {
                    player_id: 9001,
                    season: 20252026,
                    date_scraped: games[0].date,
                    gp: 1,
                    toi: 300,
                    cf: 8,
                    ca: 4,
                    cf_pct: 66.67,
                    ff: 6,
                    fa: 3,
                    ff_pct: 66.67,
                    sf: 4,
                    sa: 2,
                    sf_pct: 66.67,
                    gf: 2,
                    ga: 1,
                    gf_pct: 66.67,
                    xgf: 1.2,
                    xga: 0.6,
                    xgf_pct: 66.67,
                    scf: 3,
                    sca: 1,
                    scf_pct: 75,
                    hdcf: 2,
                    hdca: 1,
                    hdcf_pct: 66.67,
                    hdgf: 1,
                    hdga: 0,
                    hdgf_pct: 100,
                    mdcf: 1,
                    mdca: 0,
                    mdcf_pct: 100,
                    mdgf: 0,
                    mdga: 0,
                    mdgf_pct: null,
                    ldcf: 0,
                    ldca: 0,
                    ldcf_pct: null,
                    ldgf: 0,
                    ldga: 0,
                    ldgf_pct: null,
                    on_ice_sh_pct: 50,
                    on_ice_sv_pct: 50,
                    off_zone_starts: 0,
                    neu_zone_starts: 0,
                    def_zone_starts: 0,
                    off_zone_start_pct: null,
                    off_zone_faceoffs: 0,
                    neu_zone_faceoffs: 0,
                    def_zone_faceoffs: 0,
                    off_zone_faceoff_pct: null,
                    pdo: 100,
                    shots_blocked: 0,
                  },
                ],
                ratesOi: [],
              },
              pp: { counts: [], rates: [], countsOi: [], ratesOi: [] },
              pk: { counts: [], rates: [], countsOi: [], ratesOi: [] },
            },
            goalies: {
              all: { counts: [], rates: [] },
              ev: { counts: [], rates: [] },
              fiveOnFive: { counts: [], rates: [] },
              pp: { counts: [], rates: [] },
              pk: { counts: [], rates: [] },
            },
          },
          shotFeatures: [],
        },
        {
          game: games[1],
          parity: {
            skaters: {
              all: { counts: [], rates: [], countsOi: [], ratesOi: [] },
              ev: { counts: [], rates: [], countsOi: [], ratesOi: [] },
              fiveOnFive: {
                counts: [
                  {
                    player_id: 9001,
                    season: 20252026,
                    date_scraped: games[1].date,
                    gp: 1,
                    toi: 240,
                    goals: 1,
                    total_assists: 0,
                    first_assists: 0,
                    second_assists: 0,
                    total_points: 1,
                    shots: 2,
                    ixg: 0.5,
                    icf: 2,
                    iff: 2,
                    iscfs: 1,
                    hdcf: 1,
                    rush_attempts: 0,
                    rebounds_created: 1,
                    pim: 0,
                    total_penalties: 0,
                    minor_penalties: 0,
                    major_penalties: 0,
                    misconduct_penalties: 0,
                    penalties_drawn: 1,
                    giveaways: 1,
                    takeaways: 0,
                    hits: 1,
                    hits_taken: 1,
                    shots_blocked: 0,
                    faceoffs_won: 2,
                    faceoffs_lost: 1,
                    ipp: 100,
                  },
                ],
                rates: [],
                countsOi: [
                  {
                    player_id: 9001,
                    season: 20252026,
                    date_scraped: games[1].date,
                    gp: 1,
                    toi: 240,
                    cf: 5,
                    ca: 4,
                    cf_pct: 55.56,
                    ff: 4,
                    fa: 3,
                    ff_pct: 57.14,
                    sf: 3,
                    sa: 2,
                    sf_pct: 60,
                    gf: 1,
                    ga: 0,
                    gf_pct: 100,
                    xgf: 0.9,
                    xga: 0.4,
                    xgf_pct: 69.23,
                    scf: 2,
                    sca: 1,
                    scf_pct: 66.67,
                    hdcf: 1,
                    hdca: 0,
                    hdcf_pct: 100,
                    hdgf: 1,
                    hdga: 0,
                    hdgf_pct: 100,
                    mdcf: 1,
                    mdca: 1,
                    mdcf_pct: 50,
                    mdgf: 0,
                    mdga: 0,
                    mdgf_pct: null,
                    ldcf: 0,
                    ldca: 0,
                    ldcf_pct: null,
                    ldgf: 0,
                    ldga: 0,
                    ldgf_pct: null,
                    on_ice_sh_pct: 33.33,
                    on_ice_sv_pct: 100,
                    off_zone_starts: 0,
                    neu_zone_starts: 0,
                    def_zone_starts: 0,
                    off_zone_start_pct: null,
                    off_zone_faceoffs: 0,
                    neu_zone_faceoffs: 0,
                    def_zone_faceoffs: 0,
                    off_zone_faceoff_pct: null,
                    pdo: 133.33,
                    shots_blocked: 0,
                  },
                ],
                ratesOi: [],
              },
              pp: { counts: [], rates: [], countsOi: [], ratesOi: [] },
              pk: { counts: [], rates: [], countsOi: [], ratesOi: [] },
            },
            goalies: {
              all: { counts: [], rates: [] },
              ev: { counts: [], rates: [] },
              fiveOnFive: { counts: [], rates: [] },
              pp: { counts: [], rates: [] },
              pk: { counts: [], rates: [] },
            },
          },
          shotFeatures: [],
        },
      ],
      identityMaps: {
        playersById: new Map([
          [
            9001,
            {
              id: 9001,
              fullName: "Taylor Test",
              position: "C",
            },
          ],
        ]) as any,
        teamsById: new Map([
          [10, { id: 10, abbreviation: "AAA", name: "Alpha", created_at: "" }],
          [20, { id: 20, abbreviation: "BBB", name: "Beta", created_at: "" }],
          [30, { id: 30, abbreviation: "CCC", name: "Gamma", created_at: "" }],
        ]),
        fallbackPlayerNamesById: new Map(),
      },
    });

    expect(result.family).toBe("individualCounts");
    expect(result.pagination.totalRows).toBe(1);
    expect(result.rows[0]).toMatchObject({
      playerName: "Taylor Test",
      teamLabel: "AAA / BBB",
      gamesPlayed: 2,
      totalPoints: 3,
      toiSeconds: 540,
      faceoffPct: 2 / 3,
    });
  });

  it("applies by-team-games windows and post-aggregation minimum TOI", () => {
    const state = createDefaultLandingFilterState({
      currentSeasonId: 20252026,
    });
    state.primary.statMode = "individual";
    state.primary.displayMode = "counts";
    state.primary.strength = "fiveOnFive";
    state.expandable.tradeMode = "split";
    state.expandable.scope = { kind: "byTeamGames", value: 1 };
    state.expandable.minimumToiSeconds = 250;

    const result = buildPlayerStatsLandingAggregation({
      state,
      bundle: {
        games,
        eventsByGameId: new Map(),
        shiftRowsByGameId: new Map([
          [
            100,
            [
              {
                created_at: "",
                detail_code: null,
                duration: "05:00",
                duration_seconds: 300,
                end_seconds: 300,
                end_time: "05:00",
                event_description: null,
                event_details: null,
                event_number: null,
                first_name: "Taylor",
                game_date: games[0].date,
                game_id: 100,
                hex_value: null,
                last_name: "Test",
                parser_version: 1,
                period: 1,
                player_id: 9001,
                raw_shift: null,
                season_id: 20252026,
                shift_id: 1,
                shift_number: 1,
                source_shiftcharts_hash: "a",
                start_seconds: 0,
                start_time: "00:00",
                team_abbrev: "AAA",
                team_id: 10,
                team_name: "Alpha",
                type_code: null,
                updated_at: "",
              },
            ],
          ],
        ]),
        rosterSpotsByGameId: new Map(),
        ownGoalEventIdsByGameId: new Map(),
      },
      parityByGame: [
        {
          game: games[0],
          parity: {
            skaters: {
              all: { counts: [], rates: [], countsOi: [], ratesOi: [] },
              ev: { counts: [], rates: [], countsOi: [], ratesOi: [] },
              fiveOnFive: {
                counts: [
                  {
                    player_id: 9001,
                    season: 20252026,
                    date_scraped: games[0].date,
                    gp: 1,
                    toi: 300,
                    goals: 1,
                    total_assists: 0,
                    first_assists: 0,
                    second_assists: 0,
                    total_points: 1,
                    shots: 2,
                    ixg: 0.4,
                    icf: 2,
                    iff: 2,
                    iscfs: 1,
                    hdcf: 1,
                    rush_attempts: 0,
                    rebounds_created: 0,
                    pim: 0,
                    total_penalties: 0,
                    minor_penalties: 0,
                    major_penalties: 0,
                    misconduct_penalties: 0,
                    penalties_drawn: 0,
                    giveaways: 0,
                    takeaways: 0,
                    hits: 0,
                    hits_taken: 0,
                    shots_blocked: 0,
                    faceoffs_won: 0,
                    faceoffs_lost: 0,
                    ipp: 100,
                  },
                ],
                rates: [],
                countsOi: [
                  {
                    player_id: 9001,
                    season: 20252026,
                    date_scraped: games[0].date,
                    gp: 1,
                    toi: 300,
                    cf: 2,
                    ca: 2,
                    cf_pct: 50,
                    ff: 2,
                    fa: 2,
                    ff_pct: 50,
                    sf: 1,
                    sa: 1,
                    sf_pct: 50,
                    gf: 1,
                    ga: 0,
                    gf_pct: 100,
                    xgf: 0.4,
                    xga: 0.3,
                    xgf_pct: 57.14,
                    scf: 1,
                    sca: 0,
                    scf_pct: 100,
                    hdcf: 1,
                    hdca: 0,
                    hdcf_pct: 100,
                    hdgf: 1,
                    hdga: 0,
                    hdgf_pct: 100,
                    mdcf: 0,
                    mdca: 0,
                    mdcf_pct: null,
                    mdgf: 0,
                    mdga: 0,
                    mdgf_pct: null,
                    ldcf: 0,
                    ldca: 0,
                    ldcf_pct: null,
                    ldgf: 0,
                    ldga: 0,
                    ldgf_pct: null,
                    on_ice_sh_pct: 100,
                    on_ice_sv_pct: 100,
                    off_zone_starts: 0,
                    neu_zone_starts: 0,
                    def_zone_starts: 0,
                    off_zone_start_pct: null,
                    off_zone_faceoffs: 0,
                    neu_zone_faceoffs: 0,
                    def_zone_faceoffs: 0,
                    off_zone_faceoff_pct: null,
                    pdo: 200,
                    shots_blocked: 0,
                  },
                ],
                ratesOi: [],
              },
              pp: { counts: [], rates: [], countsOi: [], ratesOi: [] },
              pk: { counts: [], rates: [], countsOi: [], ratesOi: [] },
            },
            goalies: {
              all: { counts: [], rates: [] },
              ev: { counts: [], rates: [] },
              fiveOnFive: { counts: [], rates: [] },
              pp: { counts: [], rates: [] },
              pk: { counts: [], rates: [] },
            },
          },
          shotFeatures: [],
        },
      ],
      identityMaps: {
        playersById: new Map([
          [
            9001,
            {
              id: 9001,
              fullName: "Taylor Test",
              position: "C",
            },
          ],
        ]) as any,
        teamsById: new Map([
          [10, { id: 10, abbreviation: "AAA", name: "Alpha", created_at: "" }],
          [20, { id: 20, abbreviation: "BBB", name: "Beta", created_at: "" }],
          [30, { id: 30, abbreviation: "CCC", name: "Gamma", created_at: "" }],
          [40, { id: 40, abbreviation: "DDD", name: "Delta", created_at: "" }],
        ]),
        fallbackPlayerNamesById: new Map(),
      },
    });

    expect(result.pagination.totalRows).toBe(0);
    expect(result.rows).toEqual([]);
  });

  it("falls back to PBP-only individual counts when shiftcharts are empty", () => {
    const state = createDefaultLandingFilterState({
      currentSeasonId: 20252026,
    });
    state.primary.statMode = "individual";
    state.primary.displayMode = "counts";
    state.primary.strength = "fiveOnFive";
    state.view.sort = { sortKey: "totalPoints", direction: "desc" };

    const game: PlayerStatsSourceGameRow = {
      id: 200,
      seasonId: 20252026,
      date: "2026-03-03",
      startTime: "2026-03-04T00:00:00.000Z",
      homeTeamId: 10,
      awayTeamId: 20,
      type: 2,
      created_at: "2026-03-03T00:00:00.000Z",
    };

    const events: PlayerStatsSourceEventRow[] = [
      {
        event_id: 20,
        assist1_player_id: null,
        assist2_player_id: null,
        away_goalie: null,
        away_score: 0,
        away_skaters: 5,
        away_sog: 0,
        blocking_player_id: null,
        committed_by_player_id: null,
        created_at: "2026-03-03T00:00:00.000Z",
        details: null,
        drawn_by_player_id: null,
        event_owner_side: null,
        event_owner_team_id: 10,
        game_date: game.date,
        game_id: game.id,
        goalie_in_net_id: null,
        hittee_player_id: null,
        hitting_player_id: null,
        home_goalie: null,
        home_score: 0,
        home_skaters: 5,
        home_sog: 0,
        home_team_defending_side: "left",
        is_goal: false,
        is_penalty: false,
        is_shot_like: false,
        losing_player_id: 9003,
        parser_version: 1,
        penalty_desc_key: null,
        penalty_duration_minutes: null,
        penalty_type_code: null,
        period_number: 1,
        period_seconds_elapsed: 120,
        period_type: "REG",
        player_id: null,
        raw_event: null,
        reason: null,
        scoring_player_id: null,
        season_id: 20252026,
        secondary_reason: null,
        served_by_player_id: null,
        shooting_player_id: null,
        shot_type: null,
        situation_code: "1551",
        sort_order: 20,
        source_play_by_play_hash: "hash-faceoff",
        strength_exact: "5v5",
        strength_state: "EV",
        strength_version: 1,
        time_in_period: "02:00",
        time_remaining: "18:00",
        time_remaining_seconds: 1080,
        type_code: 502,
        type_desc_key: "faceoff",
        updated_at: "2026-03-03T00:00:00.000Z",
        winning_player_id: 9001,
        x_coord: 0,
        y_coord: 0,
        zone_code: "N",
      },
      {
        event_id: 30,
        assist1_player_id: 9002,
        assist2_player_id: null,
        away_goalie: null,
        away_score: 0,
        away_skaters: 5,
        away_sog: 0,
        blocking_player_id: null,
        committed_by_player_id: null,
        created_at: "2026-03-03T00:00:00.000Z",
        details: null,
        drawn_by_player_id: null,
        event_owner_side: null,
        event_owner_team_id: 10,
        game_date: game.date,
        game_id: game.id,
        goalie_in_net_id: 8001,
        hittee_player_id: null,
        hitting_player_id: null,
        home_goalie: null,
        home_score: 1,
        home_skaters: 5,
        home_sog: 1,
        home_team_defending_side: "left",
        is_goal: true,
        is_penalty: false,
        is_shot_like: true,
        losing_player_id: null,
        parser_version: 1,
        penalty_desc_key: null,
        penalty_duration_minutes: null,
        penalty_type_code: null,
        period_number: 1,
        period_seconds_elapsed: 180,
        period_type: "REG",
        player_id: null,
        raw_event: null,
        reason: null,
        scoring_player_id: 9001,
        season_id: 20252026,
        secondary_reason: null,
        served_by_player_id: null,
        shooting_player_id: 9001,
        shot_type: "wrist",
        situation_code: "1551",
        sort_order: 30,
        source_play_by_play_hash: "hash-goal",
        strength_exact: "5v5",
        strength_state: "EV",
        strength_version: 1,
        time_in_period: "03:00",
        time_remaining: "17:00",
        time_remaining_seconds: 1020,
        type_code: 505,
        type_desc_key: "goal",
        updated_at: "2026-03-03T00:00:00.000Z",
        winning_player_id: null,
        x_coord: 70,
        y_coord: 12,
        zone_code: "O",
      },
    ];

    const rosterSpots: PlayerStatsSourceRosterSpotRow[] = [
      {
        game_id: game.id,
        season_id: game.seasonId,
        game_date: game.date,
        team_id: 10,
        player_id: 9001,
        first_name: "Taylor",
        last_name: "Test",
        sweater_number: 19,
        position_code: "C",
        headshot_url: null,
        created_at: "2026-03-03T00:00:00.000Z",
        updated_at: "2026-03-03T00:00:00.000Z",
        source_play_by_play_hash: "hash-goal",
        parser_version: 1,
        raw_spot: null,
      },
      {
        game_id: game.id,
        season_id: game.seasonId,
        game_date: game.date,
        team_id: 10,
        player_id: 9002,
        first_name: "Alex",
        last_name: "Setup",
        sweater_number: 11,
        position_code: "L",
        headshot_url: null,
        created_at: "2026-03-03T00:00:00.000Z",
        updated_at: "2026-03-03T00:00:00.000Z",
        source_play_by_play_hash: "hash-goal",
        parser_version: 1,
        raw_spot: null,
      },
      {
        game_id: game.id,
        season_id: game.seasonId,
        game_date: game.date,
        team_id: 20,
        player_id: 9003,
        first_name: "Casey",
        last_name: "Draw",
        sweater_number: 27,
        position_code: "C",
        headshot_url: null,
        created_at: "2026-03-03T00:00:00.000Z",
        updated_at: "2026-03-03T00:00:00.000Z",
        source_play_by_play_hash: "hash-faceoff",
        parser_version: 1,
        raw_spot: null,
      },
    ];

    const bundle = {
      games: [game],
      eventsByGameId: groupPlayerStatsSourceRowsByGameId(events),
      shiftRowsByGameId: new Map(),
      rosterSpotsByGameId: groupPlayerStatsSourceRowsByGameId(rosterSpots),
      ownGoalEventIdsByGameId: new Map(),
    };

    const result = buildPlayerStatsLandingAggregation({
      state,
      bundle,
      parityByGame: buildPlayerStatsLandingParityByGame(bundle),
      identityMaps: {
        playersById: new Map([
          [9001, { id: 9001, fullName: "Taylor Test", position: "C" }],
          [9002, { id: 9002, fullName: "Alex Setup", position: "L" }],
          [9003, { id: 9003, fullName: "Casey Draw", position: "C" }],
        ]) as any,
        teamsById: new Map([
          [10, { id: 10, abbreviation: "AAA", name: "Alpha", created_at: "" }],
          [20, { id: 20, abbreviation: "BBB", name: "Beta", created_at: "" }],
        ]),
        fallbackPlayerNamesById: new Map(),
      },
    });

    expect(result.family).toBe("individualCounts");
    expect(result.pagination.totalRows).toBe(3);
    const taylorRow = result.rows.find((row) => row.playerName === "Taylor Test");
    const alexRow = result.rows.find((row) => row.playerName === "Alex Setup");
    const caseyRow = result.rows.find((row) => row.playerName === "Casey Draw");

    expect(taylorRow).toMatchObject({
      playerName: "Taylor Test",
      teamLabel: "AAA",
      gamesPlayed: 1,
      toiSeconds: null,
      goals: 1,
      totalPoints: 1,
      shots: 1,
      faceoffsWon: 1,
      ipp: null,
    });
    expect(alexRow).toMatchObject({
      playerName: "Alex Setup",
      totalAssists: 1,
      totalPoints: 1,
      toiSeconds: null,
    });
    expect(caseyRow).toMatchObject({
      playerName: "Casey Draw",
      teamLabel: "BBB",
      faceoffsLost: 1,
      toiSeconds: null,
    });
  });
});
