import { describe, expect, it } from "vitest";

import {
  buildFeatureSnapshotInsert,
  buildGamePredictionFeatureSnapshotPayload,
  buildGoalieBlendFeatures,
  buildScheduleContextFeatures,
  type GamePredictionFeatureInputs,
} from "./featureBuilder";
import { getFeatureSourceByTable } from "./featureSources";

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
      feature_set_version: "game_features_v1",
      home_team_id: 1,
      away_team_id: 2,
    });
  });
});
