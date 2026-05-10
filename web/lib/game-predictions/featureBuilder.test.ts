import { describe, expect, it } from "vitest";

import {
  buildFeatureSnapshotInsert,
  buildGamePredictionFeatureSnapshotPayload,
  buildGoalieBlendFeatures,
  buildScheduleContextFeatures,
  type GamePredictionFeatureInputs,
  type NstTeamGamelogRow,
} from "./featureBuilder";
import { getFeatureSourceByTable } from "./featureSources";
import { buildGamePredictionSourceProvenanceRows } from "lib/predictions/sourceProvenance";

function createNstTeamGamelogRow(args: {
  teamAbbreviation: string;
  date: string;
  gf: number;
  ga: number;
  xgf: number;
  xga: number;
  sf: number;
  sa: number;
  points: number;
}): NstTeamGamelogRow {
  return {
    team_abbreviation: args.teamAbbreviation,
    date: args.date,
    gp: 1,
    wins: args.points === 2 ? 1 : 0,
    losses: args.points === 0 ? 1 : 0,
    otl: args.points === 1 ? 1 : 0,
    points: args.points,
    point_pct: args.points / 2,
    gf: args.gf,
    ga: args.ga,
    xgf: args.xgf,
    xga: args.xga,
    xgf_pct: (args.xgf / (args.xgf + args.xga)) * 100,
    sf: args.sf,
    sa: args.sa,
    sf_pct: (args.sf / (args.sf + args.sa)) * 100,
  };
}

function createInputs(
  overrides: Partial<GamePredictionFeatureInputs> = {},
): GamePredictionFeatureInputs {
  return {
    game: {
      id: 2025020001,
      date: "2026-01-10",
      startTime: "2026-01-10T23:00:00+00:00",
      seasonId: 20252026,
      homeTeamId: 1,
      awayTeamId: 2,
      type: 2,
    },
    sourceAsOfDate: "2026-01-10",
    homeTeam: { id: 1, abbreviation: "BOS", name: "Boston Bruins" },
    awayTeam: { id: 2, abbreviation: "MTL", name: "Montreal Canadiens" },
    teamRows: [
      { id: 1, abbreviation: "BOS", name: "Boston Bruins" },
      { id: 2, abbreviation: "MTL", name: "Montreal Canadiens" },
      { id: 3, abbreviation: "TOR", name: "Toronto Maple Leafs" },
      { id: 4, abbreviation: "OTT", name: "Ottawa Senators" },
    ],
    priorGames: [
      {
        id: 2025020000,
        date: "2026-01-09",
        startTime: "2026-01-09T23:00:00+00:00",
        seasonId: 20252026,
        homeTeamId: 1,
        awayTeamId: 3,
        type: 2,
      },
      {
        id: 2025019999,
        date: "2026-01-06",
        startTime: "2026-01-06T23:00:00+00:00",
        seasonId: 20252026,
        homeTeamId: 4,
        awayTeamId: 2,
        type: 2,
      },
    ],
    teamPowerRows: [
      {
        team_abbreviation: "BOS",
        date: "2026-01-09",
        off_rating: 56,
        def_rating: 52,
        goalie_rating: 51,
        special_rating: 54,
        pace_rating: 49,
        xgf60: 3.1,
        xga60: 2.5,
        gf60: 3.2,
        ga60: 2.6,
        sf60: 32,
        sa60: 28,
      },
      {
        team_abbreviation: "MTL",
        date: "2026-01-10",
        off_rating: 99,
        def_rating: 99,
        goalie_rating: 99,
        special_rating: 99,
        pace_rating: 99,
        xgf60: 9.9,
        xga60: 9.9,
        gf60: 9.9,
        ga60: 9.9,
        sf60: 99,
        sa60: 99,
      },
      {
        team_abbreviation: "MTL",
        date: "2026-01-08",
        off_rating: 47,
        def_rating: 49,
        goalie_rating: 50,
        special_rating: 45,
        pace_rating: 51,
        xgf60: 2.7,
        xga60: 3,
        gf60: 2.8,
        ga60: 3.1,
        sf60: 29,
        sa60: 31,
      },
      {
        team_abbreviation: "TOR",
        date: "2026-01-09",
        off_rating: 60,
        def_rating: 58,
        goalie_rating: 57,
        special_rating: 55,
        pace_rating: 52,
        xgf60: 3.4,
        xga60: 2.4,
        gf60: 3.5,
        ga60: 2.5,
        sf60: 34,
        sa60: 27,
      },
      {
        team_abbreviation: "OTT",
        date: "2026-01-09",
        off_rating: 44,
        def_rating: 43,
        goalie_rating: 42,
        special_rating: 41,
        pace_rating: 48,
        xgf60: 2.3,
        xga60: 3.3,
        gf60: 2.4,
        ga60: 3.4,
        sf60: 27,
        sa60: 35,
      },
    ],
    standingsRows: [
      {
        team_abbrev: "BOS",
        date: "2026-01-09",
        games_played: 40,
        point_pctg: 0.61,
        win_pctg: 0.55,
        goal_differential: 18,
        l10_games_played: 10,
        l10_goal_differential: 4,
      },
      {
        team_abbrev: "MTL",
        date: "2026-01-09",
        games_played: 40,
        point_pctg: 0.48,
        win_pctg: 0.43,
        goal_differential: -8,
        l10_games_played: 10,
        l10_goal_differential: -3,
      },
    ],
    wgoTeamRows: [],
    nstTeamGamelogRows: [
      createNstTeamGamelogRow({
        teamAbbreviation: "BOS",
        date: "2026-01-09",
        gf: 4,
        ga: 2,
        xgf: 3,
        xga: 2,
        sf: 35,
        sa: 25,
        points: 2,
      }),
      createNstTeamGamelogRow({
        teamAbbreviation: "BOS",
        date: "2026-01-07",
        gf: 3,
        ga: 2,
        xgf: 2.6,
        xga: 2.4,
        sf: 31,
        sa: 29,
        points: 1,
      }),
      createNstTeamGamelogRow({
        teamAbbreviation: "MTL",
        date: "2026-01-09",
        gf: 2,
        ga: 3,
        xgf: 2,
        xga: 3,
        sf: 27,
        sa: 33,
        points: 0,
      }),
      createNstTeamGamelogRow({
        teamAbbreviation: "MTL",
        date: "2026-01-08",
        gf: 1,
        ga: 4,
        xgf: 2,
        xga: 3,
        sf: 26,
        sa: 34,
        points: 1,
      }),
    ],
    teamCtpiRows: [
      {
        team: "BOS",
        date: "2026-01-09",
        computed_at: "2026-01-09T10:00:00+00:00",
        ctpi_0_to_100: 64,
        ctpi_raw: 0.64,
        offense: 65,
        defense: 62,
        goaltending: 61,
        special_teams: 66,
        luck: 50,
      },
      {
        team: "MTL",
        date: "2026-01-10",
        computed_at: "2026-01-10T10:00:00+00:00",
        ctpi_0_to_100: 99,
        ctpi_raw: 0.99,
        offense: 99,
        defense: 99,
        goaltending: 99,
        special_teams: 99,
        luck: 99,
      },
      {
        team: "MTL",
        date: "2026-01-08",
        computed_at: "2026-01-08T10:00:00+00:00",
        ctpi_0_to_100: 48,
        ctpi_raw: 0.48,
        offense: 47,
        defense: 49,
        goaltending: 50,
        special_teams: 45,
        luck: 52,
      },
    ],
    goalieStartRows: [
      {
        game_id: 2025020001,
        team_id: 1,
        player_id: 100,
        game_date: "2026-01-10",
        start_probability: 0.75,
        confirmed_status: false,
        projected_gsaa_per_60: 0.4,
        created_at: "2026-01-10T14:00:00+00:00",
        updated_at: "2026-01-10T14:00:00+00:00",
      },
      {
        game_id: 2025020001,
        team_id: 1,
        player_id: 101,
        game_date: "2026-01-10",
        start_probability: 0.25,
        confirmed_status: false,
        projected_gsaa_per_60: -0.2,
        created_at: "2026-01-10T14:00:00+00:00",
        updated_at: "2026-01-10T14:00:00+00:00",
      },
      {
        game_id: 2025020001,
        team_id: 2,
        player_id: 200,
        game_date: "2026-01-10",
        start_probability: 1,
        confirmed_status: true,
        projected_gsaa_per_60: 0.1,
        created_at: "2026-01-10T14:00:00+00:00",
        updated_at: "2026-01-10T14:00:00+00:00",
      },
    ],
    lineCombinationRows: [
      {
        gameId: 2025020001,
        teamId: 1,
        forwards: [1, 2, 3, 4, 5, 6],
        defensemen: [7, 8, 9, 10],
        goalies: [100, 101],
      },
    ],
    linesCccRows: [],
    goaliePerformanceRows: [],
    forgeGoalieGameRows: [
      {
        game_id: 2025019990,
        game_date: "2026-01-09",
        goalie_id: 100,
        team_id: 1,
        shots_against: 32,
        saves: 30,
        goals_allowed: 2,
        toi_seconds: 3600,
      },
      {
        game_id: 2025019989,
        game_date: "2026-01-06",
        goalie_id: 100,
        team_id: 1,
        shots_against: 28,
        saves: 25,
        goals_allowed: 3,
        toi_seconds: 3580,
      },
      {
        game_id: 2025019988,
        game_date: "2026-01-09",
        goalie_id: 200,
        team_id: 2,
        shots_against: 30,
        saves: 27,
        goals_allowed: 3,
        toi_seconds: 3600,
      },
    ],
    wgoGoalieRows: [
      {
        goalie_id: 100,
        goalie_name: "Home Starter",
        team_abbreviation: "BOS",
        date: "2026-01-09",
        games_played: 25,
        games_started: 23,
        save_pct: 0.918,
        shots_against_per_60: 30.5,
        quality_start: 14,
        quality_starts_pct: 60,
        games_played_days_rest_0: 2,
        games_played_days_rest_1: 8,
        games_played_days_rest_2: 5,
        games_played_days_rest_3: 4,
        games_played_days_rest_4_plus: 6,
        save_pct_days_rest_0: 0.9,
        save_pct_days_rest_1: 0.914,
        save_pct_days_rest_2: 0.92,
        save_pct_days_rest_3: 0.922,
        save_pct_days_rest_4_plus: 0.925,
      },
      {
        goalie_id: 200,
        goalie_name: "Away Starter",
        team_abbreviation: "MTL",
        date: "2026-01-09",
        games_played: 20,
        games_started: 18,
        save_pct: 0.905,
        shots_against_per_60: 32,
        quality_start: 8,
        quality_starts_pct: 44,
        games_played_days_rest_0: 3,
        games_played_days_rest_1: 6,
        games_played_days_rest_2: 4,
        games_played_days_rest_3: 3,
        games_played_days_rest_4_plus: 4,
        save_pct_days_rest_0: 0.891,
        save_pct_days_rest_1: 0.904,
        save_pct_days_rest_2: 0.91,
        save_pct_days_rest_3: 0.907,
        save_pct_days_rest_4_plus: 0.912,
      },
    ],
    forgeTeamProjectionRows: [],
    ...overrides,
  };
}

describe("game prediction feature sources", () => {
  it("marks latest-only team display data as excluded", () => {
    expect(getFeatureSourceByTable("nhl_team_data")).toMatchObject({
      use: "excluded",
      goNoGo: "no_go",
    });
  });
});

describe("game prediction feature builder", () => {
  it("computes rest context from prior games", () => {
    const context = buildScheduleContextFeatures({
      game: createInputs().game,
      teamId: 1,
      priorGames: createInputs().priorGames,
    });

    expect(context).toEqual({
      daysRest: 0,
      isBackToBack: true,
      gamesInLast3Days: 1,
    });
  });

  it("uses only rows before game date for team features", () => {
    const payload = buildGamePredictionFeatureSnapshotPayload(createInputs());

    expect(payload.away.teamPower?.sourceDate).toBe("2026-01-08");
    expect(payload.away.teamPower?.offRating).toBe(47);
  });

  it("builds recent team form from NST gamelog rows", () => {
    const payload = buildGamePredictionFeatureSnapshotPayload(createInputs());

    expect(payload.home.recentForm).toMatchObject({
      sourceMaxDate: "2026-01-09",
      last5Games: 2,
      last10Games: 2,
      last10GoalDifferentialPerGame: 1.5,
      last10PointPct: 0.75,
    });
    expect(payload.away.recentForm?.last10GoalDifferentialPerGame).toBe(-2);
    expect(
      payload.matchup.homeMinusAwayRecent10GoalDifferentialPerGame,
    ).toBe(3.5);
    expect(payload.matchup.homeMinusAwayRecent10XgfPct).toBeCloseTo(0.16);
    expect(payload.matchup.homeMinusAwayRecent10PointPct).toBe(0.5);
  });

  it("builds CTPI and schedule-strength context without using same-day rows", () => {
    const payload = buildGamePredictionFeatureSnapshotPayload(
      createInputs({
        forgeTeamProjectionRows: [
          {
            run_id: "run-1",
            game_id: 2025020001,
            team_id: 1,
            horizon_games: 1,
            proj_goals_es: 2.4,
            proj_goals_pp: 0.6,
            proj_shots_es: 26,
            proj_shots_pp: 5,
            updated_at: "2026-01-10T15:00:00+00:00",
          },
          {
            run_id: "run-1",
            game_id: 2025020001,
            team_id: 2,
            horizon_games: 1,
            proj_goals_es: 1.9,
            proj_goals_pp: 0.3,
            proj_shots_es: 24,
            proj_shots_pp: 4,
            updated_at: "2026-01-10T15:00:00+00:00",
          },
        ],
      }),
    );

    expect(payload.home.ctpi).toMatchObject({
      sourceDate: "2026-01-09",
      ctpi0To100: 64,
      offense: 65,
    });
    expect(payload.away.ctpi).toMatchObject({
      sourceDate: "2026-01-08",
      ctpi0To100: 48,
    });
    expect(payload.home.scheduleStrength).toMatchObject({
      sourceMaxDate: "2026-01-09",
      pastOpponentGames: 1,
      pastOpponentAvgOffRating: 60,
      pastOpponentCompositeRating: 57.5,
    });
    expect(payload.away.scheduleStrength).toMatchObject({
      pastOpponentGames: 1,
      pastOpponentAvgOffRating: 44,
      pastOpponentCompositeRating: 42.5,
    });
    expect(payload.matchup.homeMinusAwayCtpi).toBe(16);
    expect(payload.matchup.homeMinusAwayPastOpponentCompositeRating).toBe(15);
    expect(payload.matchup.homeMinusAwayForgeProjectedGoals).toBeCloseTo(0.8);
    expect(payload.matchup.homeMinusAwayForgeProjectedShots).toBe(3);
    expect(payload.sourceCutoffs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          table: "team_ctpi_daily",
          cutoff: "2026-01-09",
        }),
        expect.objectContaining({
          table: "team_power_ratings_daily",
          cutoff: "2026-01-09",
          asOfRule: "strict_before_source_as_of_date_for_schedule_strength",
        }),
        expect.objectContaining({
          table: "forge_team_projections",
          cutoff: "2026-01-10",
          asOfRule: "current_prediction_only",
        }),
      ]),
    );
  });

  it("blends unconfirmed goalie candidates and collapses confirmed candidates", () => {
    const homeGoalie = buildGoalieBlendFeatures(
      createInputs().goalieStartRows,
      1,
    );
    expect(homeGoalie).toMatchObject({
      source: "goalie_start_projections",
      confirmed: false,
      candidateCount: 2,
      topGoalieId: 100,
      topGoalieStartProbability: 0.75,
    });
    expect(homeGoalie.weightedProjectedGsaaPer60).toBeCloseTo(0.25);

    expect(
      buildGoalieBlendFeatures(createInputs().goalieStartRows, 2),
    ).toMatchObject({
      confirmed: true,
      candidateCount: 1,
      topGoalieId: 200,
      weightedProjectedGsaaPer60: 0.1,
    });
  });

  it("attaches goalie workload, rest, and quality-start context", () => {
    const payload = buildGamePredictionFeatureSnapshotPayload(createInputs());

    expect(payload.home.goalie.context).toMatchObject({
      sourceMaxDate: "2026-01-09",
      gamesPlayedLast14Days: 2,
      startsLast14Days: 2,
      daysSinceLastStart: 1,
      isGoalieBackToBack: true,
      seasonGamesPlayed: 25,
      seasonGamesStarted: 23,
      seasonSavePct: 0.918,
      seasonShotsAgainstPer60: 30.5,
      qualityStarts: 14,
      qualityStartsPct: 0.6,
      restSplitGamesPlayed: {
        rest0: 2,
        rest4Plus: 6,
      },
    });
    expect(payload.home.goalie.context?.last5ShotsAgainstPerGame).toBe(30);
    expect(payload.home.goalie.context?.last5SavePct).toBeCloseTo(55 / 60);
    expect(payload.sourceCutoffs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          table: "forge_goalie_game",
          cutoff: "2026-01-09",
        }),
        expect.objectContaining({
          table: "wgo_goalie_stats",
          cutoff: "2026-01-09",
        }),
      ]),
    );
  });

  it("prefers accepted CCC confirmed goalies over projection rows", () => {
    const payload = buildGamePredictionFeatureSnapshotPayload(
      createInputs({
        linesCccRows: [
          {
            game_id: 2025020001,
            team_id: 1,
            observed_at: "2026-01-10T16:00:00+00:00",
            tweet_posted_at: "2026-01-10T15:58:00+00:00",
            classification: "confirmed",
            status: "observed",
            nhl_filter_status: "accepted",
            goalie_1_player_id: 999,
            goalie_1_name: "Confirmed Starter",
            goalie_2_player_id: null,
            goalie_2_name: null,
          },
        ],
      }),
    );

    expect(payload.home.goalie).toMatchObject({
      source: "lines_ccc",
      confirmed: true,
      topGoalieId: 999,
      topGoalieName: "Confirmed Starter",
      topGoalieStartProbability: 1,
    });
  });

  it("infers an unconfirmed goalie from recent prior starters when projection rows are absent", () => {
    const payload = buildGamePredictionFeatureSnapshotPayload(
      createInputs({
        goalieStartRows: [],
        lineCombinationRows: [
          {
            gameId: 2025019998,
            teamId: 1,
            forwards: [],
            defensemen: [],
            goalies: [300],
          },
          {
            gameId: 2025019999,
            teamId: 1,
            forwards: [],
            defensemen: [],
            goalies: [301],
          },
          {
            gameId: 2025020000,
            teamId: 1,
            forwards: [],
            defensemen: [],
            goalies: [300],
          },
        ],
        goaliePerformanceRows: [
          {
            player_id: 300,
            team_id: 1,
            date: "2026-01-08",
            player_name: "Recent Starter",
            nst_all_rates_gsaa_per_60: 0.42,
            nst_5v5_rates_gsaa_per_60: 0.31,
          },
        ],
        priorGames: [
          {
            id: 2025020000,
            date: "2026-01-09",
            startTime: "2026-01-09T23:00:00+00:00",
            seasonId: 20252026,
            homeTeamId: 1,
            awayTeamId: 3,
            type: 2,
          },
          {
            id: 2025019999,
            date: "2026-01-07",
            startTime: "2026-01-07T23:00:00+00:00",
            seasonId: 20252026,
            homeTeamId: 4,
            awayTeamId: 1,
            type: 2,
          },
          {
            id: 2025019998,
            date: "2026-01-05",
            startTime: "2026-01-05T23:00:00+00:00",
            seasonId: 20252026,
            homeTeamId: 1,
            awayTeamId: 5,
            type: 2,
          },
        ],
      }),
    );

    expect(payload.home.goalie).toMatchObject({
      source: "recent_usage",
      confirmed: false,
      candidateCount: 2,
      topGoalieId: 300,
      weightedProjectedGsaaPer60: 0.42,
    });
    expect(payload.home.goalie.topGoalieStartProbability).toBeCloseTo(2 / 3);
  });

  it("clips audited WGO and goalie projection outliers before building model features", () => {
    const payload = buildGamePredictionFeatureSnapshotPayload(
      createInputs({
        wgoTeamRows: [
          {
            team_id: 1,
            date: "2026-01-09",
            game_id: null,
            opponent_id: null,
            goals_for_per_game: 12,
            goals_against_per_game: -1,
            shots_for_per_game: 77,
            shots_against_per_game: 80,
            power_play_pct: 0.2,
            penalty_kill_pct: 0.81,
          },
          {
            team_id: 2,
            date: "2026-01-09",
            game_id: null,
            opponent_id: null,
            goals_for_per_game: 2,
            goals_against_per_game: 3,
            shots_for_per_game: 28,
            shots_against_per_game: 31,
            power_play_pct: 0.18,
            penalty_kill_pct: 0.78,
          },
        ],
        goalieStartRows: [
          {
            game_id: 2025020001,
            team_id: 1,
            player_id: 100,
            game_date: "2026-01-10",
            start_probability: 0.5,
            confirmed_status: false,
            projected_gsaa_per_60: 9,
            created_at: "2026-01-10T14:00:00+00:00",
            updated_at: "2026-01-10T14:00:00+00:00",
          },
          {
            game_id: 2025020001,
            team_id: 1,
            player_id: 101,
            game_date: "2026-01-10",
            start_probability: 0.5,
            confirmed_status: false,
            projected_gsaa_per_60: -9,
            created_at: "2026-01-10T14:00:00+00:00",
            updated_at: "2026-01-10T14:00:00+00:00",
          },
        ],
      }),
    );

    expect(payload.home.wgoTeam).toMatchObject({
      goalsForPerGame: 8,
      goalsAgainstPerGame: 0,
      shotsForPerGame: 60,
      shotsAgainstPerGame: 60,
    });
    expect(payload.home.goalie.weightedProjectedGsaaPer60).toBe(0);
  });

  it("builds matchup features, fallback flags, and snapshot insert payload", () => {
    const payload = buildGamePredictionFeatureSnapshotPayload(createInputs());

    expect(payload.matchup.homeMinusAwayOffRating).toBe(9);
    expect(payload.matchup.homeMinusAwayGoalDifferential).toBe(26);
    expect(payload.fallbackFlags.away_wgo_team_fallback).toBe(true);
    expect(payload.home.lineup).toMatchObject({
      forwardCount: 6,
      defensemanCount: 4,
      goalieCount: 2,
    });

    const insert = buildFeatureSnapshotInsert({
      payload,
      modelName: "baseline_logistic",
      modelVersion: "v0",
      predictionCutoffAt: "2026-01-10T18:00:00+00:00",
    });

    expect(insert).toMatchObject({
      game_id: 2025020001,
      snapshot_date: "2026-01-10",
      model_name: "baseline_logistic",
      model_version: "v0",
      feature_set_version: "game_features_v4_roster_sos_context",
      home_team_id: 1,
      away_team_id: 2,
    });
    expect(insert.metadata).toMatchObject({
      prediction_contract: {
        modelName: "baseline_logistic",
        modelVersion: "v0",
        featureSetVersion: "game_features_v4_roster_sos_context",
        asOfDate: "2026-01-10",
        fallbackFlags: {
          away_wgo_team_fallback: true,
        },
      },
    });
    expect(insert.provenance).toMatchObject({
      source_freshness: expect.arrayContaining([
        expect.objectContaining({
          source: "team_power_ratings_daily",
          degradedState: "fresh",
          stale: false,
        }),
      ]),
    });
    expect(payload.sourceCutoffs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          table: "goalie_start_projections",
          asOfRule: "current_prediction_only",
        }),
        expect.objectContaining({
          table: "lineCombinations",
          asOfRule: "current_prediction_only",
        }),
      ]),
    );
  });

  it("emits warnings for stale, sparse, and fallback feature sources", () => {
    const payload = buildGamePredictionFeatureSnapshotPayload(
      createInputs({
        sourceAsOfDate: "2026-02-01",
        teamPowerRows: [
          {
            team_abbreviation: "BOS",
            date: "2026-01-01",
            off_rating: 56,
            def_rating: 52,
            goalie_rating: 51,
            special_rating: 54,
            pace_rating: 49,
            xgf60: 3.1,
            xga60: 2.5,
            gf60: 3.2,
            ga60: 2.6,
            sf60: 32,
            sa60: 28,
          },
        ],
        lineCombinationRows: [],
        forgeGoalieGameRows: [],
        wgoGoalieRows: [],
      }),
    );

    expect(payload.warnings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "stale_source",
          source: "team_power_ratings_daily",
        }),
        expect.objectContaining({
          code: "missing_source",
          source: "lineCombinations",
        }),
        expect.objectContaining({
          code: "fallback_lineup_omitted",
          source: "lineCombinations",
        }),
      ]),
    );
    expect(payload.fallbackFlags.home_lineup_omitted).toBe(true);
  });

  it("builds deduplicated game-scoped source provenance rows for prediction health", () => {
    const payload = buildGamePredictionFeatureSnapshotPayload(createInputs());
    const rows = buildGamePredictionSourceProvenanceRows({
      payload,
      prediction: {
        gameId: payload.gameId,
        snapshotDate: payload.gameDate,
        predictionScope: "pregame",
        predictionCutoffAt: "2026-01-10T18:00:00+00:00",
        modelName: "baseline_logistic",
        modelVersion: "v0",
        featureSetVersion: payload.featureSetVersion,
        homeTeamId: payload.home.teamId,
        awayTeamId: payload.away.teamId,
        homeWinProbability: 0.55,
        awayWinProbability: 0.45,
        predictedWinnerTeamId: payload.home.teamId,
        confidenceLabel: "medium",
        topFactors: [],
        components: {},
        provenance: {},
        metadata: {},
      },
    });

    const sourceNames = rows.map((row) => row.source_name);
    expect(sourceNames).toContain("team_power_ratings_daily");
    expect(sourceNames).toContain("goalie_start_projections");
    expect(sourceNames).toContain("lineCombinations");
    expect(sourceNames).toContain("game_prediction_outputs");
    expect(new Set(sourceNames).size).toBe(sourceNames.length);
    expect(
      rows.every(
        (row) =>
          row.entity_type === "game" &&
          row.entity_id === payload.gameId &&
          row.game_id === payload.gameId,
      ),
    ).toBe(true);
  });
});
