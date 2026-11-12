import { describe, expect, it } from "vitest";

import {
  buildArtifactDriftReport,
  buildTeamSurfaceDriftReport,
  buildXgAggregates,
  buildXgPredictionCoverage,
  mergeXgFlurryMetadata,
  validateXgAggregateReconciliation,
  xgCoverageGameKey,
  xgFeatureEventKey,
  type XgAggregateGameRow,
  type XgAggregatePredictionRow,
  type XgParticipationRow,
} from "./aggregates";

function prediction(
  overrides: Partial<XgAggregatePredictionRow> = {}
): XgAggregatePredictionRow {
  return {
    model_version: "model-v1",
    prediction_type: "shot_goal",
    feature_version: 1,
    game_id: 2025020001,
    event_id: 101,
    season_id: 20252026,
    game_date: "2025-10-07",
    event_owner_team_id: 10,
    shooter_player_id: 91,
    goalie_in_net_id: 31,
    label: false,
    xg: 0.25,
    model_approved: true,
    ...overrides,
  };
}

describe("xG aggregates", () => {
  it("fails closed when flurry metadata coverage is incomplete", () => {
    const predictions = [
      prediction({ event_id: 101 }),
      prediction({ event_id: 102 }),
    ];

    expect(() =>
      mergeXgFlurryMetadata(predictions, [
        {
          feature_version: 1,
          game_id: 2025020001,
          event_id: 101,
          flurry_sequence_id: null,
          flurry_shot_index: null,
        },
      ])
    ).toThrow("Flurry metadata coverage is incomplete for 1/2 approved predictions");

    expect(
      mergeXgFlurryMetadata(predictions, [
        {
          feature_version: 1,
          game_id: 2025020001,
          event_id: 101,
          flurry_sequence_id: null,
          flurry_shot_index: null,
        },
        {
          feature_version: 1,
          game_id: 2025020001,
          event_id: 102,
          flurry_sequence_id: "sequence-1",
          flurry_shot_index: 2,
        },
      ])
    ).toEqual([
      expect.objectContaining({ event_id: 101, flurry_sequence_id: null }),
      expect.objectContaining({
        event_id: 102,
        flurry_sequence_id: "sequence-1",
        flurry_shot_index: 2,
      }),
    ]);
  });

  it("builds team, player, and goalie game aggregates from approved shot-goal rows", () => {
    const result = buildXgAggregates(
      [
        prediction({ event_id: 101, xg: 0.25, label: false }),
        prediction({ event_id: 102, xg: 0.5, label: true, shooter_player_id: 92 }),
        prediction({
          event_id: 103,
          event_owner_team_id: 20,
          shooter_player_id: 201,
          goalie_in_net_id: 41,
          xg: 0.1,
          label: false,
        }),
      ],
      [
        {
          id: 2025020001,
          seasonId: 20252026,
          date: "2025-10-07",
          homeTeamId: 10,
          awayTeamId: 20,
        },
      ],
      { generatedAt: "2026-05-27T20:00:00.000Z", rollingWindows: [2] }
    );

    expect(result.skippedPredictionRows).toEqual([]);
    expect(result.teamGameRows).toEqual([
      expect.objectContaining({
        team_id: 10,
        opponent_team_id: 20,
        is_home: true,
        xg_for: 0.75,
        xg_against: 0.1,
        goals_for: 1,
        goals_against: 0,
        shot_attempts_for: 2,
        shot_attempts_against: 1,
      }),
      expect.objectContaining({
        team_id: 20,
        opponent_team_id: 10,
        is_home: false,
        xg_for: 0.1,
        xg_against: 0.75,
        goals_for: 0,
        goals_against: 1,
        shot_attempts_for: 1,
        shot_attempts_against: 2,
      }),
    ]);
    expect([...result.playerGameRows].sort((left, right) => left.player_id - right.player_id)).toEqual([
      expect.objectContaining({ player_id: 91, team_id: 10, ixg: 0.25, goals: 0 }),
      expect.objectContaining({ player_id: 92, team_id: 10, ixg: 0.5, goals: 1 }),
      expect.objectContaining({ player_id: 201, team_id: 20, ixg: 0.1, goals: 0 }),
    ]);
    expect(result.goalieGameRows).toEqual([
      expect.objectContaining({
        goalie_player_id: 31,
        team_id: 20,
        opponent_team_id: 10,
        xg_against: 0.75,
        goals_against: 1,
        shots_against: 2,
        goals_saved_above_expected: -0.25,
      }),
      expect.objectContaining({
        goalie_player_id: 41,
        team_id: 10,
        opponent_team_id: 20,
        xg_against: 0.1,
        goals_against: 0,
        shots_against: 1,
        goals_saved_above_expected: 0.1,
      }),
    ]);
    expect(
      validateXgAggregateReconciliation(
        [
          prediction({ event_id: 101, xg: 0.25, label: false }),
          prediction({ event_id: 102, xg: 0.5, label: true, shooter_player_id: 92 }),
          prediction({
            event_id: 103,
            event_owner_team_id: 20,
            shooter_player_id: 201,
            goalie_in_net_id: 41,
            xg: 0.1,
            label: false,
          }),
        ],
        [
          {
            id: 2025020001,
            seasonId: 20252026,
            date: "2025-10-07",
            homeTeamId: 10,
            awayTeamId: 20,
          },
        ],
        result
      )
    ).toMatchObject({
      passed: true,
      checks: {
        teamGame: { passed: true, rowsChecked: 2, issueCount: 0 },
        playerGame: { passed: true, rowsChecked: 3, issueCount: 0 },
        goalieGame: { passed: true, rowsChecked: 2, issueCount: 0 },
      },
      exclusions: {
        emptyNetGoalieRows: 0,
        missingShooterRows: 0,
        missingGoalieRows: 0,
      },
    });
  });

  it("builds rolling aggregates and skips unapproved or non-shot-goal rows", () => {
    const result = buildXgAggregates(
      [
        prediction({ game_id: 1, event_id: 1, game_date: "2025-10-01", xg: 0.1 }),
        prediction({ game_id: 2, event_id: 2, game_date: "2025-10-02", xg: 0.2 }),
        prediction({ game_id: 3, event_id: 3, game_date: "2025-10-03", xg: 0.3 }),
        prediction({ game_id: 3, event_id: 4, prediction_type: "rebound_creation" }),
        prediction({ game_id: 3, event_id: 5, model_approved: false }),
      ],
      [
        { id: 1, seasonId: 20252026, date: "2025-10-01", homeTeamId: 10, awayTeamId: 20 },
        { id: 2, seasonId: 20252026, date: "2025-10-02", homeTeamId: 10, awayTeamId: 20 },
        { id: 3, seasonId: 20252026, date: "2025-10-03", homeTeamId: 10, awayTeamId: 20 },
      ],
      {
        generatedAt: "2026-05-27T20:00:00.000Z",
        rollingWindows: [2],
        coveredGameKeys: covered("model-v1", 1, [1, 2, 3]),
        participation: { players: [1, 2, 3].map((gameId) => dressed(91, gameId, `2025-10-0${gameId}`)) },
      }
    );

    expect(result.skippedPredictionRows).toEqual([
      { gameId: 3, eventId: 4, reason: "not_approved_shot_goal_prediction" },
      { gameId: 3, eventId: 5, reason: "not_approved_shot_goal_prediction" },
    ]);
    expect(
      result.teamRollingRows.find((row) => row.team_id === 10 && row.as_of_game_id === 3)
    ).toMatchObject({
      window_games: 2,
      games_count: 2,
      xg_for: 0.5,
      shot_attempts_for: 2,
    });
    expect(
      result.playerRollingRows.find((row) => row.player_id === 91 && row.as_of_game_id === 3)
    ).toMatchObject({
      window_games: 2,
      games_count: 2,
      ixg: 0.5,
      shot_attempts: 2,
    });
  });

  it("persists flurry-adjusted values in parallel without changing raw xG", () => {
    const result = buildXgAggregates(
      [
        prediction({
          event_id: 101,
          xg: 0.25,
          flurry_sequence_id: "sequence-1",
          flurry_shot_index: 1,
        }),
        prediction({
          event_id: 102,
          xg: 0.5,
          flurry_sequence_id: "sequence-1",
          flurry_shot_index: 2,
        }),
      ],
      [
        {
          id: 2025020001,
          seasonId: 20252026,
          date: "2025-10-07",
          homeTeamId: 10,
          awayTeamId: 20,
        },
      ],
      {
        generatedAt: "2026-07-12T23:00:00.000Z",
        rollingWindows: [1],
        coveredGameKeys: covered("model-v1", 1, [2025020001]),
      }
    );

    expect(result.teamGameRows.find((row) => row.team_id === 10)).toMatchObject({
      xg_for: 0.75,
      flurry_adjusted_xg_for: 0.625,
    });
    expect(result.playerGameRows[0]).toMatchObject({
      ixg: 0.75,
      flurry_adjusted_ixg: 0.625,
    });
    expect(result.goalieGameRows[0]).toMatchObject({
      xg_against: 0.75,
      flurry_adjusted_xg_against: 0.625,
    });
    expect(result.teamRollingRows.find((row) => row.team_id === 10)).toMatchObject({
      xg_for: 0.75,
      flurry_adjusted_xg_for: 0.625,
    });
  });

  it("reports aggregate reconciliation issues and unmapped goalie exclusions", () => {
    const predictions = [
      prediction({ event_id: 101, xg: 0.25, label: false, goalie_in_net_id: null }),
      prediction({ event_id: 102, xg: 0.5, label: true, shooter_player_id: null }),
    ];
    const games = [
      {
        id: 2025020001,
        seasonId: 20252026,
        date: "2025-10-07",
        homeTeamId: 10,
        awayTeamId: 20,
      },
    ];
    const emptyNetEventKeys = new Set([
      xgFeatureEventKey({ featureVersion: 1, gameId: 2025020001, eventId: 101 }),
    ]);
    const result = buildXgAggregates(predictions, games, {
      generatedAt: "2026-05-27T20:00:00.000Z",
      rollingWindows: [2],
      emptyNetEventKeys,
    });
    // The empty-net shot is outside the total: the correct xG for is 0.5.
    expect(result.teamGameRows[0]).toMatchObject({ team_id: 10, xg_for: 0.5 });
    result.teamGameRows[0]!.xg_for = 0.75;

    const qa = validateXgAggregateReconciliation(predictions, games, result, {
      emptyNetEventKeys,
    });

    expect(qa.passed).toBe(false);
    expect(qa.exclusions).toMatchObject({
      emptyNetGoalieRows: 1,
      emptyNetGoalieXg: 0.25,
      emptyNetGoalieGoals: 0,
      missingShooterRows: 1,
      missingGoalieRows: 0,
      missingGoalieXg: 0,
      missingGoalieGoals: 0,
    });
    expect(qa.issues).toEqual([
      expect.objectContaining({
        scope: "team_game",
        metric: "xg_for",
        expected: 0.5,
        actual: 0.75,
      }),
    ]);
  });

  it("builds artifact and external team-surface drift reports", () => {
    const predictions = [
      prediction({ event_id: 101, xg: 0.1, label: false }),
      prediction({ event_id: 102, xg: 0.3, label: true }),
    ];

    expect(
      buildArtifactDriftReport(predictions, {
        source: "artifact.json",
        exampleCount: 2,
        averagePrediction: 0.2,
        goalRate: 0.5,
      })
    ).toMatchObject({
      status: "checked",
      current: {
        predictionRows: 2,
        averagePrediction: 0.2,
        goalRate: 0.5,
      },
      deltas: {
        averagePrediction: 0,
        goalRate: 0,
        predictionRowsPct: 0,
      },
      warnings: [],
    });

    expect(
      buildTeamSurfaceDriftReport({
        source: "nst_team_gamelogs_as_counts",
        teamGameRows: [
          {
            model_version: "model-v1",
            feature_version: 1,
            season_id: 20252026,
            game_id: 1,
            game_date: "2025-10-07",
            team_id: 10,
            opponent_team_id: 20,
            is_home: true,
            xg_for: 2.5,
            xg_against: 1.5,
            flurry_adjusted_xg_for: 2.25,
            flurry_adjusted_xg_against: 1.4,
            goals_for: 2,
            goals_against: 1,
            shot_attempts_for: 30,
            shot_attempts_against: 22,
            source_prediction_type: "shot_goal",
            source_model_approved: true,
            provenance: {},
            updated_at: "2026-05-27T20:00:00.000Z",
          },
        ],
        externalRows: [
          {
            team_id: 10,
            game_date: "2025-10-07",
            xgf: 2.3,
            xga: 1.8,
          },
        ],
      })
    ).toMatchObject({
      status: "checked",
      rowsCompared: 1,
      missingComparisonRows: 0,
      metrics: {
        xgf: { averageAbsoluteDelta: 0.2, maxAbsoluteDelta: 0.2 },
        xga: { averageAbsoluteDelta: 0.3, maxAbsoluteDelta: 0.3 },
      },
      warnings: [],
    });
  });
});

function covered(modelVersion: string, featureVersion: number, gameIds: number[]): Set<string> {
  return new Set(gameIds.map((gameId) => xgCoverageGameKey({ modelVersion, featureVersion, gameId })));
}

function dressed(entityId: number, gameId: number, date: string, seasonId = 20252026, teamId = 10): XgParticipationRow {
  return { entity_id: entityId, game_id: gameId, game_date: date, season_id: seasonId, team_id: teamId };
}

function game(id: number, date: string, seasonId = 20252026): XgAggregateGameRow {
  return { id, seasonId, date, homeTeamId: 10, awayTeamId: 20 };
}

describe("xG aggregates: empty net (decision 7)", () => {
  const games = [game(2025020001, "2025-10-07")];
  const enShot = prediction({ event_id: 201, xg: 0.9, label: true, goalie_in_net_id: null, shooter_player_id: 92 });
  const ownNetEmptyShot = prediction({ event_id: 202, xg: 0.2, label: false, goalie_in_net_id: 31 });
  const regular = prediction({ event_id: 203, xg: 0.3, label: false });
  const emptyNetEventKeys = new Set(
    [201, 202].map((eventId) => xgFeatureEventKey({ featureVersion: 1, gameId: 2025020001, eventId }))
  );

  it("excludes shots at an empty net from xG, goals and attempts and reports them separately", () => {
    const result = buildXgAggregates([enShot, ownNetEmptyShot, regular], games, {
      generatedAt: "2026-11-11T00:00:00.000Z",
      emptyNetEventKeys,
    });
    const forRow = result.teamGameRows.find((row) => row.team_id === 10)!;
    const againstRow = result.teamGameRows.find((row) => row.team_id === 20)!;
    // The shooter's own empty net (goalie in the defending net) stays in.
    expect(forRow).toMatchObject({ xg_for: 0.5, goals_for: 0, shot_attempts_for: 2 });
    expect(forRow.provenance.emptyNet).toEqual({
      xgFor: 0.9, goalsFor: 1, shotAttemptsFor: 1, xgAgainst: 0, goalsAgainst: 0, shotAttemptsAgainst: 0,
    });
    expect(againstRow).toMatchObject({ xg_against: 0.5, goals_against: 0, shot_attempts_against: 2 });
    expect(againstRow.provenance.emptyNet).toMatchObject({ xgAgainst: 0.9, goalsAgainst: 1, shotAttemptsAgainst: 1 });
    const shooter = result.playerGameRows.find((row) => row.player_id === 92)!;
    expect(shooter).toMatchObject({ ixg: 0, goals: 0, shot_attempts: 0 });
    expect(shooter.provenance.emptyNet).toEqual({ ixg: 0.9, goals: 1, shotAttempts: 1 });
    expect(result.goalieGameRows).toEqual([
      expect.objectContaining({ goalie_player_id: 31, xg_against: 0.5, goals_against: 0 }),
    ]);
    expect(
      validateXgAggregateReconciliation([enShot, ownNetEmptyShot, regular], games, result, { emptyNetEventKeys }).passed
    ).toBe(true);
  });
});

describe("xG aggregates: rolling windows (W3-1 D1, A4)", () => {
  const gamesFour = [1, 2, 3, 4].map((id) => game(id, `2025-10-0${id}`));
  const shot = (gameId: number, eventId: number, xg: number, overrides: Partial<XgAggregatePredictionRow> = {}) =>
    prediction({ game_id: gameId, event_id: eventId, game_date: `2025-10-0${gameId}`, xg, ...overrides });

  it("counts the last N dressed games, with proven zero-attempt games, not the last N rows with an attempt", () => {
    // Player 91 dressed in games 1-4 and shot only in games 1, 3 and 4.
    const predictions = [shot(1, 1, 0.4), shot(2, 2, 0.1, { shooter_player_id: 92 }), shot(3, 3, 0.2), shot(4, 4, 0.3)];
    const result = buildXgAggregates(predictions, gamesFour, {
      generatedAt: "2026-11-11T00:00:00.000Z",
      rollingWindows: [2],
      coveredGameKeys: covered("model-v1", 1, [1, 2, 3, 4]),
      participation: { players: [1, 2, 3, 4].map((gameId) => dressed(91, gameId, `2025-10-0${gameId}`)) },
    });
    const asOf = (gameId: number) =>
      result.playerRollingRows.find((row) => row.player_id === 91 && row.as_of_game_id === gameId);
    // As of game 3 the last two dressed games are 2 (zero) and 3: 0.2, not 0.4 + 0.2.
    expect(asOf(3)).toMatchObject({ games_count: 2, ixg: 0.2, shot_attempts: 1 });
    // A dressed game with no attempt still produces its own as-of row.
    expect(asOf(2)).toMatchObject({ games_count: 2, ixg: 0.4, shot_attempts: 1 });
    expect(asOf(4)).toMatchObject({ games_count: 2, ixg: 0.5, shot_attempts: 2 });
  });

  it("leaves a window unknown when a dressed game lacks complete prediction coverage", () => {
    const predictions = [shot(1, 1, 0.4), shot(3, 3, 0.2), shot(4, 4, 0.3)];
    const result = buildXgAggregates(predictions, gamesFour, {
      generatedAt: "2026-11-11T00:00:00.000Z",
      rollingWindows: [2],
      coveredGameKeys: covered("model-v1", 1, [1, 3, 4]),
      participation: { players: [1, 2, 3, 4].map((gameId) => dressed(91, gameId, `2025-10-0${gameId}`)) },
    });
    const asOfIds = result.playerRollingRows.filter((row) => row.player_id === 91).map((row) => row.as_of_game_id);
    expect(asOfIds).toEqual([1, 4]);
    expect(result.rollingCoverage.player).toEqual({ rowsEmitted: 2, incompleteWindows: 2, unavailableReason: null });
    // Team windows over games 2-3 are unknown too (team participation comes from the games).
    expect(result.teamRollingRows.filter((row) => row.team_id === 10).map((row) => row.as_of_game_id)).toEqual([1, 4]);
  });

  it("writes no rolling rows when participation or coverage is unproven", () => {
    const predictions = [shot(1, 1, 0.4)];
    const noCoverage = buildXgAggregates(predictions, gamesFour.slice(0, 1), {
      participation: { players: [dressed(91, 1, "2025-10-01")] },
    });
    expect(noCoverage.playerRollingRows).toEqual([]);
    expect(noCoverage.teamRollingRows).toEqual([]);
    expect(noCoverage.rollingCoverage.team.unavailableReason).toBe("prediction_coverage_unproven");
    const noLedger = buildXgAggregates(predictions, gamesFour.slice(0, 1), {
      coveredGameKeys: covered("model-v1", 1, [1]),
    });
    expect(noLedger.playerRollingRows).toEqual([]);
    expect(noLedger.goalieRollingRows).toEqual([]);
    expect(noLedger.rollingCoverage.player.unavailableReason).toBe("participation_ledger_missing");
    expect(noLedger.teamRollingRows).toHaveLength(6); // teams 10 and 20 x default windows 5, 10, 20
  });

  it("isolates feature versions in game rows, rolling rows and the flurry adjustment", () => {
    // One game scored under feature v1 (no flurry ids) and v2 (a two-shot flurry).
    const v1 = [shot(1, 1, 0.25), shot(1, 2, 0.5)];
    const v2 = [
      shot(1, 1, 0.25, { feature_version: 2, flurry_sequence_id: "s1", flurry_shot_index: 1 }),
      shot(1, 2, 0.5, { feature_version: 2, flurry_sequence_id: "s1", flurry_shot_index: 2 }),
    ];
    const result = buildXgAggregates([...v2, ...v1], gamesFour.slice(0, 1), {
      generatedAt: "2026-11-11T00:00:00.000Z",
      rollingWindows: [5],
      coveredGameKeys: new Set([...covered("model-v1", 1, [1]), ...covered("model-v1", 2, [1])]),
      participation: { players: [dressed(91, 1, "2025-10-01")] },
    });
    const rolling = (featureVersion: number) =>
      result.playerRollingRows.find((row) => row.player_id === 91 && row.feature_version === featureVersion);
    // No flurry ids: adjusted equals raw.
    expect(rolling(1)).toMatchObject({ games_count: 1, ixg: 0.75, flurry_adjusted_ixg: 0.75 });
    // Second shot of the flurry: 0.5 x (1 - 0.25) = 0.375.
    expect(rolling(2)).toMatchObject({ games_count: 1, ixg: 0.75, flurry_adjusted_ixg: 0.625 });
    expect(result.playerGameRows.map((row) => [row.feature_version, row.flurry_adjusted_ixg]).sort()).toEqual([
      [1, 0.75],
      [2, 0.625],
    ]);
  });

  it("never lets a window cross seasons", () => {
    const games = [game(1, "2025-04-10", 20242025), game(2, "2025-10-07", 20252026)];
    const predictions = [
      prediction({ game_id: 1, event_id: 1, game_date: "2025-04-10", season_id: 20242025, xg: 0.4 }),
      prediction({ game_id: 2, event_id: 2, game_date: "2025-10-07", season_id: 20252026, xg: 0.1 }),
    ];
    const result = buildXgAggregates(predictions, games, {
      generatedAt: "2026-11-11T00:00:00.000Z",
      rollingWindows: [5],
      coveredGameKeys: covered("model-v1", 1, [1, 2]),
      participation: {
        players: [dressed(91, 1, "2025-04-10", 20242025), dressed(91, 2, "2025-10-07", 20252026)],
      },
    });
    expect(result.playerRollingRows.find((row) => row.as_of_game_id === 2)).toMatchObject({
      season_id: 20252026,
      games_count: 1,
      ixg: 0.1,
    });
  });

  it("does not depend on prediction or ledger order", () => {
    const predictions = [shot(1, 1, 0.4), shot(3, 3, 0.2), shot(4, 4, 0.3), shot(2, 5, 0.15, { shooter_player_id: 92 })];
    const ledger = [1, 2, 3, 4].map((gameId) => dressed(91, gameId, `2025-10-0${gameId}`));
    const options = {
      generatedAt: "2026-11-11T00:00:00.000Z",
      rollingWindows: [2, 3],
      coveredGameKeys: covered("model-v1", 1, [1, 2, 3, 4]),
    };
    const forward = buildXgAggregates(predictions, gamesFour, { ...options, participation: { players: ledger } });
    const reversed = buildXgAggregates([...predictions].reverse(), [...gamesFour].reverse(), {
      ...options,
      participation: { players: [...ledger].reverse() },
    });
    const key = (row: { player_id: number; as_of_game_id: number; window_games: number }) =>
      `${row.player_id}:${row.as_of_game_id}:${row.window_games}`;
    const sortRows = <T extends { player_id: number; as_of_game_id: number; window_games: number }>(rows: T[]) =>
      [...rows].sort((a, b) => key(a).localeCompare(key(b)));
    expect(sortRows(reversed.playerRollingRows)).toEqual(sortRows(forward.playerRollingRows));
    expect(reversed.teamRollingRows.length).toBe(forward.teamRollingRows.length);
  });
});

describe("buildXgPredictionCoverage", () => {
  const feature = (gameId: number, eventId: number, overrides: Record<string, boolean> = {}) => ({
    feature_version: 1, game_id: gameId, event_id: eventId,
    is_unblocked_shot_attempt: true, is_penalty_shot_event: false, is_shootout_event: false, ...overrides,
  });

  it("proves a game only when every scoring-eligible shot has a prediction", () => {
    const coverage = buildXgPredictionCoverage({
      predictions: [
        prediction({ game_id: 1, event_id: 1 }),
        prediction({ game_id: 1, event_id: 2 }),
        prediction({ game_id: 2, event_id: 1 }),
      ],
      features: [
        feature(1, 1), feature(1, 2),
        feature(1, 3, { is_unblocked_shot_attempt: false }),
        feature(1, 4, { is_shootout_event: true }),
        feature(2, 1), feature(2, 2),
      ],
    });
    expect([...coverage]).toEqual([xgCoverageGameKey({ modelVersion: "model-v1", featureVersion: 1, gameId: 1 })]);
  });
});
