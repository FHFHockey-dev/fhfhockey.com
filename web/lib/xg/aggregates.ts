import { buildFlurryAdjustedPredictions } from "./flurryAdjusted";

export type XgAggregateGameRow = {
  id: number;
  seasonId: number | null;
  date: string | null;
  homeTeamId: number | null;
  awayTeamId: number | null;
};

export type XgAggregatePredictionRow = {
  model_version: string;
  prediction_type: string;
  feature_version: number;
  game_id: number;
  event_id: number;
  season_id: number | null;
  game_date: string | null;
  event_owner_team_id: number | null;
  shooter_player_id: number | null;
  goalie_in_net_id: number | null;
  label: boolean | null;
  xg: number;
  model_approved: boolean;
  flurry_sequence_id?: string | null;
  flurry_shot_index?: number | null;
};

export type XgFlurryMetadataRow = {
  feature_version: number;
  game_id: number;
  event_id: number;
  flurry_sequence_id: string | null;
  flurry_shot_index: number | null;
};

export type XgTeamGameAggregateRow = {
  model_version: string;
  feature_version: number;
  season_id: number | null;
  game_id: number;
  game_date: string | null;
  team_id: number;
  opponent_team_id: number | null;
  is_home: boolean | null;
  xg_for: number;
  xg_against: number;
  flurry_adjusted_xg_for: number;
  flurry_adjusted_xg_against: number;
  goals_for: number;
  goals_against: number;
  shot_attempts_for: number;
  shot_attempts_against: number;
  source_prediction_type: "shot_goal";
  source_model_approved: true;
  provenance: Record<string, unknown>;
  updated_at: string;
};

export type XgPlayerGameAggregateRow = {
  model_version: string;
  feature_version: number;
  season_id: number | null;
  game_id: number;
  game_date: string | null;
  player_id: number;
  team_id: number | null;
  ixg: number;
  flurry_adjusted_ixg: number;
  goals: number;
  shot_attempts: number;
  source_prediction_type: "shot_goal";
  source_model_approved: true;
  provenance: Record<string, unknown>;
  updated_at: string;
};

export type XgGoalieGameAggregateRow = {
  model_version: string;
  feature_version: number;
  season_id: number | null;
  game_id: number;
  game_date: string | null;
  goalie_player_id: number;
  team_id: number | null;
  opponent_team_id: number | null;
  xg_against: number;
  flurry_adjusted_xg_against: number;
  goals_against: number;
  shots_against: number;
  goals_saved_above_expected: number;
  flurry_adjusted_goals_saved_above_expected: number;
  source_prediction_type: "shot_goal";
  source_model_approved: true;
  provenance: Record<string, unknown>;
  updated_at: string;
};

export type XgTeamRollingAggregateRow = {
  model_version: string;
  feature_version: number;
  season_id: number | null;
  team_id: number;
  as_of_game_id: number;
  as_of_game_date: string | null;
  window_games: number;
  games_count: number;
  xg_for: number;
  xg_against: number;
  flurry_adjusted_xg_for: number;
  flurry_adjusted_xg_against: number;
  goals_for: number;
  goals_against: number;
  shot_attempts_for: number;
  shot_attempts_against: number;
  provenance: Record<string, unknown>;
  updated_at: string;
};

export type XgPlayerRollingAggregateRow = {
  model_version: string;
  feature_version: number;
  season_id: number | null;
  player_id: number;
  team_id: number | null;
  as_of_game_id: number;
  as_of_game_date: string | null;
  window_games: number;
  games_count: number;
  ixg: number;
  flurry_adjusted_ixg: number;
  goals: number;
  shot_attempts: number;
  provenance: Record<string, unknown>;
  updated_at: string;
};

export type XgGoalieRollingAggregateRow = {
  model_version: string;
  feature_version: number;
  season_id: number | null;
  goalie_player_id: number;
  team_id: number | null;
  as_of_game_id: number;
  as_of_game_date: string | null;
  window_games: number;
  games_count: number;
  xg_against: number;
  flurry_adjusted_xg_against: number;
  goals_against: number;
  shots_against: number;
  goals_saved_above_expected: number;
  flurry_adjusted_goals_saved_above_expected: number;
  provenance: Record<string, unknown>;
  updated_at: string;
};

export type XgAggregateBuildResult = {
  teamGameRows: XgTeamGameAggregateRow[];
  playerGameRows: XgPlayerGameAggregateRow[];
  goalieGameRows: XgGoalieGameAggregateRow[];
  teamRollingRows: XgTeamRollingAggregateRow[];
  playerRollingRows: XgPlayerRollingAggregateRow[];
  goalieRollingRows: XgGoalieRollingAggregateRow[];
  skippedPredictionRows: Array<{ gameId: number; eventId: number; reason: string }>;
};

export type BuildXgAggregatesOptions = {
  generatedAt?: string;
  rollingWindows?: number[];
};

export type XgAggregateReconciliationIssue = {
  scope: "team_game" | "player_game" | "goalie_game";
  key: string;
  metric: string;
  expected: number;
  actual: number;
  delta: number;
};

export type XgAggregateReconciliationReport = {
  passed: boolean;
  tolerance: number;
  issueCount: number;
  issues: XgAggregateReconciliationIssue[];
  checks: {
    teamGame: { passed: boolean; rowsChecked: number; issueCount: number };
    playerGame: { passed: boolean; rowsChecked: number; issueCount: number };
    goalieGame: { passed: boolean; rowsChecked: number; issueCount: number };
  };
  exclusions: {
    skippedPredictionRows: number;
    emptyNetGoalieRows: number;
    emptyNetGoalieXg: number;
    emptyNetGoalieGoals: number;
    missingShooterRows: number;
    missingShooterXg: number;
    missingGoalieRows: number;
    missingGoalieXg: number;
    missingGoalieGoals: number;
  };
};

export type ValidateXgAggregateReconciliationOptions = {
  tolerance?: number;
  issueLimit?: number;
  emptyNetEventKeys?: Set<string>;
};

export type XgArtifactDriftBaseline = {
  source: string;
  exampleCount: number | null;
  averagePrediction: number | null;
  goalRate: number | null;
};

export type XgArtifactDriftReport = {
  status: "checked" | "skipped";
  source: string | null;
  current: {
    predictionRows: number;
    averagePrediction: number | null;
    goalRate: number | null;
  };
  baseline: XgArtifactDriftBaseline | null;
  deltas: {
    averagePrediction: number | null;
    goalRate: number | null;
    predictionRowsPct: number | null;
  };
  warnings: string[];
};

export type XgExternalTeamComparisonRow = {
  team_id: number;
  game_date: string | null;
  xgf: number | null;
  xga: number | null;
};

export type XgTeamSurfaceDriftReport = {
  status: "checked" | "unavailable";
  source: string;
  reason: string | null;
  rowsCompared: number;
  missingComparisonRows: number;
  metrics: {
    xgf: {
      averageAbsoluteDelta: number | null;
      maxAbsoluteDelta: number | null;
    };
    xga: {
      averageAbsoluteDelta: number | null;
      maxAbsoluteDelta: number | null;
    };
  };
  warnings: string[];
  samples: Array<{
    teamId: number;
    gameDate: string | null;
    inHouseXgf: number;
    externalXgf: number | null;
    inHouseXga: number;
    externalXga: number | null;
    xgfDelta: number | null;
    xgaDelta: number | null;
  }>;
};

const DEFAULT_ROLLING_WINDOWS = [5, 10, 20];
const DEFAULT_RECONCILIATION_TOLERANCE = 0.000001;
const DEFAULT_RECONCILIATION_ISSUE_LIMIT = 25;
const ARTIFACT_AVERAGE_PREDICTION_WARNING_DELTA = 0.015;
const ARTIFACT_GOAL_RATE_WARNING_DELTA = 0.015;
const TEAM_SURFACE_AVERAGE_ABS_DELTA_WARNING = 0.75;
const TEAM_SURFACE_MATCH_RATE_WARNING = 0.8;

function roundMetric(value: number): number {
  return Number(value.toFixed(6));
}

function predictionProvenance(args: {
  modelVersion: string;
  featureVersion: number;
  generatedAt: string;
  rollingWindowGames?: number;
}) {
  return {
    sourceTable: "nhl_xg_shot_predictions",
    sourcePredictionType: "shot_goal",
    sourceModelApproved: true,
    modelVersion: args.modelVersion,
    featureVersion: args.featureVersion,
    rollingWindowGames: args.rollingWindowGames ?? null,
    generatedAt: args.generatedAt,
  };
}

function gameSortValue(row: { game_date?: string | null; game_id: number }): string {
  return `${row.game_date ?? "9999-12-31"}:${String(row.game_id).padStart(10, "0")}`;
}

export function xgFeatureEventKey(args: {
  featureVersion: number;
  gameId: number;
  eventId: number;
}): string {
  return `${args.featureVersion}:${args.gameId}:${args.eventId}`;
}

export function mergeXgFlurryMetadata(
  predictions: XgAggregatePredictionRow[],
  metadataRows: XgFlurryMetadataRow[]
): XgAggregatePredictionRow[] {
  const metadataByKey = new Map(
    metadataRows.map((row) => [
      xgFeatureEventKey({
        featureVersion: Number(row.feature_version),
        gameId: Number(row.game_id),
        eventId: Number(row.event_id),
      }),
      {
        flurry_sequence_id: row.flurry_sequence_id ?? null,
        flurry_shot_index:
          row.flurry_shot_index == null ? null : Number(row.flurry_shot_index),
      },
    ])
  );
  const missingKeys = predictions.flatMap((row) => {
    const key = xgFeatureEventKey({
      featureVersion: row.feature_version,
      gameId: row.game_id,
      eventId: row.event_id,
    });
    return metadataByKey.has(key) ? [] : [key];
  });
  if (missingKeys.length > 0) {
    throw new Error(
      `Flurry metadata coverage is incomplete for ${missingKeys.length}/${predictions.length} approved predictions; samples=${missingKeys.slice(0, 5).join(",")}`
    );
  }

  return predictions.map((row) => ({
    ...row,
    ...metadataByKey.get(
      xgFeatureEventKey({
        featureVersion: row.feature_version,
        gameId: row.game_id,
        eventId: row.event_id,
      })
    )!,
  }));
}

function opponentTeamId(game: XgAggregateGameRow, teamId: number | null): number | null {
  if (teamId == null) return null;
  if (teamId === game.homeTeamId) return game.awayTeamId ?? null;
  if (teamId === game.awayTeamId) return game.homeTeamId ?? null;
  return null;
}

function isHomeTeam(game: XgAggregateGameRow, teamId: number | null): boolean | null {
  if (teamId == null) return null;
  if (teamId === game.homeTeamId) return true;
  if (teamId === game.awayTeamId) return false;
  return null;
}

function incrementMetric(
  map: Map<string, Record<string, number>>,
  key: string,
  metric: string,
  value: number
) {
  const current = map.get(key) ?? {};
  current[metric] = roundMetric((current[metric] ?? 0) + value);
  map.set(key, current);
}

function addReconciliationIssues(args: {
  issues: XgAggregateReconciliationIssue[];
  issueLimit: number;
  issueCountByScope: Map<XgAggregateReconciliationIssue["scope"], number>;
  scope: XgAggregateReconciliationIssue["scope"];
  expectedByKey: Map<string, Record<string, number>>;
  actualByKey: Map<string, Record<string, number>>;
  metrics: string[];
  tolerance: number;
}) {
  const keys = new Set([...args.expectedByKey.keys(), ...args.actualByKey.keys()]);
  for (const key of keys) {
    const expected = args.expectedByKey.get(key) ?? {};
    const actual = args.actualByKey.get(key) ?? {};
    for (const metric of args.metrics) {
      const expectedValue = roundMetric(expected[metric] ?? 0);
      const actualValue = roundMetric(actual[metric] ?? 0);
      const delta = roundMetric(actualValue - expectedValue);
      if (Math.abs(delta) <= args.tolerance) continue;
      args.issueCountByScope.set(
        args.scope,
        (args.issueCountByScope.get(args.scope) ?? 0) + 1
      );
      if (args.issues.length >= args.issueLimit) continue;
      args.issues.push({
        scope: args.scope,
        key,
        metric,
        expected: expectedValue,
        actual: actualValue,
        delta,
      });
    }
  }
}

function average(values: number[]): number | null {
  if (values.length === 0) return null;
  return roundMetric(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function addTeamGameRow(args: {
  rowsByKey: Map<string, XgTeamGameAggregateRow>;
  prediction: XgAggregatePredictionRow;
  game: XgAggregateGameRow;
  teamId: number;
  generatedAt: string;
}) {
  const key = `${args.prediction.model_version}:${args.prediction.feature_version}:${args.prediction.game_id}:${args.teamId}`;
  const existing = args.rowsByKey.get(key);
  if (existing) return existing;

  const row: XgTeamGameAggregateRow = {
    model_version: args.prediction.model_version,
    feature_version: args.prediction.feature_version,
    season_id: args.prediction.season_id ?? args.game.seasonId,
    game_id: args.prediction.game_id,
    game_date: args.prediction.game_date ?? args.game.date,
    team_id: args.teamId,
    opponent_team_id: opponentTeamId(args.game, args.teamId),
    is_home: isHomeTeam(args.game, args.teamId),
    xg_for: 0,
    xg_against: 0,
    flurry_adjusted_xg_for: 0,
    flurry_adjusted_xg_against: 0,
    goals_for: 0,
    goals_against: 0,
    shot_attempts_for: 0,
    shot_attempts_against: 0,
    source_prediction_type: "shot_goal",
    source_model_approved: true,
    provenance: predictionProvenance({
      modelVersion: args.prediction.model_version,
      featureVersion: args.prediction.feature_version,
      generatedAt: args.generatedAt,
    }),
    updated_at: args.generatedAt,
  };
  args.rowsByKey.set(key, row);
  return row;
}

function buildRollingTeamRows(args: {
  rows: XgTeamGameAggregateRow[];
  windows: number[];
  generatedAt: string;
}): XgTeamRollingAggregateRow[] {
  const byTeam = new Map<number, XgTeamGameAggregateRow[]>();
  for (const row of args.rows) {
    const current = byTeam.get(row.team_id) ?? [];
    current.push(row);
    byTeam.set(row.team_id, current);
  }

  const out: XgTeamRollingAggregateRow[] = [];
  for (const [teamId, rows] of byTeam) {
    const sorted = [...rows].sort((left, right) =>
      gameSortValue(left).localeCompare(gameSortValue(right))
    );
    for (let index = 0; index < sorted.length; index += 1) {
      const current = sorted[index]!;
      for (const windowGames of args.windows) {
        const windowRows = sorted.slice(Math.max(0, index - windowGames + 1), index + 1);
        out.push({
          model_version: current.model_version,
          feature_version: current.feature_version,
          season_id: current.season_id,
          team_id: teamId,
          as_of_game_id: current.game_id,
          as_of_game_date: current.game_date,
          window_games: windowGames,
          games_count: windowRows.length,
          xg_for: roundMetric(windowRows.reduce((sum, row) => sum + row.xg_for, 0)),
          xg_against: roundMetric(windowRows.reduce((sum, row) => sum + row.xg_against, 0)),
          flurry_adjusted_xg_for: roundMetric(windowRows.reduce((sum, row) => sum + row.flurry_adjusted_xg_for, 0)),
          flurry_adjusted_xg_against: roundMetric(windowRows.reduce((sum, row) => sum + row.flurry_adjusted_xg_against, 0)),
          goals_for: windowRows.reduce((sum, row) => sum + row.goals_for, 0),
          goals_against: windowRows.reduce((sum, row) => sum + row.goals_against, 0),
          shot_attempts_for: windowRows.reduce((sum, row) => sum + row.shot_attempts_for, 0),
          shot_attempts_against: windowRows.reduce((sum, row) => sum + row.shot_attempts_against, 0),
          provenance: predictionProvenance({
            modelVersion: current.model_version,
            featureVersion: current.feature_version,
            generatedAt: args.generatedAt,
            rollingWindowGames: windowGames,
          }),
          updated_at: args.generatedAt,
        });
      }
    }
  }
  return out;
}

function buildRollingPlayerRows(args: {
  rows: XgPlayerGameAggregateRow[];
  windows: number[];
  generatedAt: string;
}): XgPlayerRollingAggregateRow[] {
  const byPlayer = new Map<number, XgPlayerGameAggregateRow[]>();
  for (const row of args.rows) {
    const current = byPlayer.get(row.player_id) ?? [];
    current.push(row);
    byPlayer.set(row.player_id, current);
  }

  const out: XgPlayerRollingAggregateRow[] = [];
  for (const [playerId, rows] of byPlayer) {
    const sorted = [...rows].sort((left, right) =>
      gameSortValue(left).localeCompare(gameSortValue(right))
    );
    for (let index = 0; index < sorted.length; index += 1) {
      const current = sorted[index]!;
      for (const windowGames of args.windows) {
        const windowRows = sorted.slice(Math.max(0, index - windowGames + 1), index + 1);
        out.push({
          model_version: current.model_version,
          feature_version: current.feature_version,
          season_id: current.season_id,
          player_id: playerId,
          team_id: current.team_id,
          as_of_game_id: current.game_id,
          as_of_game_date: current.game_date,
          window_games: windowGames,
          games_count: windowRows.length,
          ixg: roundMetric(windowRows.reduce((sum, row) => sum + row.ixg, 0)),
          flurry_adjusted_ixg: roundMetric(windowRows.reduce((sum, row) => sum + row.flurry_adjusted_ixg, 0)),
          goals: windowRows.reduce((sum, row) => sum + row.goals, 0),
          shot_attempts: windowRows.reduce((sum, row) => sum + row.shot_attempts, 0),
          provenance: predictionProvenance({
            modelVersion: current.model_version,
            featureVersion: current.feature_version,
            generatedAt: args.generatedAt,
            rollingWindowGames: windowGames,
          }),
          updated_at: args.generatedAt,
        });
      }
    }
  }
  return out;
}

function buildRollingGoalieRows(args: {
  rows: XgGoalieGameAggregateRow[];
  windows: number[];
  generatedAt: string;
}): XgGoalieRollingAggregateRow[] {
  const byGoalie = new Map<number, XgGoalieGameAggregateRow[]>();
  for (const row of args.rows) {
    const current = byGoalie.get(row.goalie_player_id) ?? [];
    current.push(row);
    byGoalie.set(row.goalie_player_id, current);
  }

  const out: XgGoalieRollingAggregateRow[] = [];
  for (const [goaliePlayerId, rows] of byGoalie) {
    const sorted = [...rows].sort((left, right) =>
      gameSortValue(left).localeCompare(gameSortValue(right))
    );
    for (let index = 0; index < sorted.length; index += 1) {
      const current = sorted[index]!;
      for (const windowGames of args.windows) {
        const windowRows = sorted.slice(Math.max(0, index - windowGames + 1), index + 1);
        const xgAgainst = roundMetric(windowRows.reduce((sum, row) => sum + row.xg_against, 0));
        const flurryAdjustedXgAgainst = roundMetric(windowRows.reduce((sum, row) => sum + row.flurry_adjusted_xg_against, 0));
        const goalsAgainst = windowRows.reduce((sum, row) => sum + row.goals_against, 0);
        out.push({
          model_version: current.model_version,
          feature_version: current.feature_version,
          season_id: current.season_id,
          goalie_player_id: goaliePlayerId,
          team_id: current.team_id,
          as_of_game_id: current.game_id,
          as_of_game_date: current.game_date,
          window_games: windowGames,
          games_count: windowRows.length,
          xg_against: xgAgainst,
          flurry_adjusted_xg_against: flurryAdjustedXgAgainst,
          goals_against: goalsAgainst,
          shots_against: windowRows.reduce((sum, row) => sum + row.shots_against, 0),
          goals_saved_above_expected: roundMetric(xgAgainst - goalsAgainst),
          flurry_adjusted_goals_saved_above_expected: roundMetric(flurryAdjustedXgAgainst - goalsAgainst),
          provenance: predictionProvenance({
            modelVersion: current.model_version,
            featureVersion: current.feature_version,
            generatedAt: args.generatedAt,
            rollingWindowGames: windowGames,
          }),
          updated_at: args.generatedAt,
        });
      }
    }
  }
  return out;
}

export function buildXgAggregates(
  predictions: XgAggregatePredictionRow[],
  games: XgAggregateGameRow[],
  options: BuildXgAggregatesOptions = {}
): XgAggregateBuildResult {
  const generatedAt = options.generatedAt ?? new Date().toISOString();
  const windows = options.rollingWindows?.length
    ? Array.from(new Set(options.rollingWindows.filter((value) => Number.isInteger(value) && value > 0)))
    : DEFAULT_ROLLING_WINDOWS;
  const gameById = new Map(games.map((game) => [game.id, game]));
  const skippedPredictionRows: XgAggregateBuildResult["skippedPredictionRows"] = [];
  const teamRowsByKey = new Map<string, XgTeamGameAggregateRow>();
  const playerRowsByKey = new Map<string, XgPlayerGameAggregateRow>();
  const goalieRowsByKey = new Map<string, XgGoalieGameAggregateRow>();
  const flurryAdjustedByEvent = new Map(
    buildFlurryAdjustedPredictions(
      predictions
        .filter((row) => row.prediction_type === "shot_goal" && row.model_approved === true)
        .map((row) => ({
          gameId: row.game_id,
          eventId: row.event_id,
          rawXg: row.xg,
          flurrySequenceId: row.flurry_sequence_id ?? null,
          flurryShotIndex: row.flurry_shot_index ?? null,
        }))
    ).map((row) => [`${row.gameId}:${row.eventId}`, row.flurryAdjustedXg])
  );

  for (const prediction of predictions) {
    if (prediction.prediction_type !== "shot_goal" || prediction.model_approved !== true) {
      skippedPredictionRows.push({
        gameId: prediction.game_id,
        eventId: prediction.event_id,
        reason: "not_approved_shot_goal_prediction",
      });
      continue;
    }

    const game = gameById.get(prediction.game_id);
    if (!game) {
      skippedPredictionRows.push({
        gameId: prediction.game_id,
        eventId: prediction.event_id,
        reason: "missing_game_row",
      });
      continue;
    }

    const ownerTeamId = prediction.event_owner_team_id;
    if (ownerTeamId == null) {
      skippedPredictionRows.push({
        gameId: prediction.game_id,
        eventId: prediction.event_id,
        reason: "missing_event_owner_team_id",
      });
      continue;
    }

    const opponentId = opponentTeamId(game, ownerTeamId);
    const isGoal = prediction.label === true ? 1 : 0;
    const xg = Number.isFinite(prediction.xg) ? prediction.xg : 0;
    const flurryAdjustedXg = flurryAdjustedByEvent.get(
      `${prediction.game_id}:${prediction.event_id}`
    ) ?? xg;
    const forRow = addTeamGameRow({
      rowsByKey: teamRowsByKey,
      prediction,
      game,
      teamId: ownerTeamId,
      generatedAt,
    });
    forRow.xg_for = roundMetric(forRow.xg_for + xg);
    forRow.flurry_adjusted_xg_for = roundMetric(
      forRow.flurry_adjusted_xg_for + flurryAdjustedXg
    );
    forRow.goals_for += isGoal;
    forRow.shot_attempts_for += 1;

    if (opponentId != null) {
      const againstRow = addTeamGameRow({
        rowsByKey: teamRowsByKey,
        prediction,
        game,
        teamId: opponentId,
        generatedAt,
      });
      againstRow.xg_against = roundMetric(againstRow.xg_against + xg);
      againstRow.flurry_adjusted_xg_against = roundMetric(
        againstRow.flurry_adjusted_xg_against + flurryAdjustedXg
      );
      againstRow.goals_against += isGoal;
      againstRow.shot_attempts_against += 1;
    }

    if (prediction.shooter_player_id != null) {
      const playerKey = `${prediction.model_version}:${prediction.feature_version}:${prediction.game_id}:${prediction.shooter_player_id}`;
      const current = playerRowsByKey.get(playerKey) ?? {
        model_version: prediction.model_version,
        feature_version: prediction.feature_version,
        season_id: prediction.season_id ?? game.seasonId,
        game_id: prediction.game_id,
        game_date: prediction.game_date ?? game.date,
        player_id: prediction.shooter_player_id,
        team_id: ownerTeamId,
        ixg: 0,
        flurry_adjusted_ixg: 0,
        goals: 0,
        shot_attempts: 0,
        source_prediction_type: "shot_goal" as const,
        source_model_approved: true as const,
        provenance: predictionProvenance({
          modelVersion: prediction.model_version,
          featureVersion: prediction.feature_version,
          generatedAt,
        }),
        updated_at: generatedAt,
      };
      current.ixg = roundMetric(current.ixg + xg);
      current.flurry_adjusted_ixg = roundMetric(
        current.flurry_adjusted_ixg + flurryAdjustedXg
      );
      current.goals += isGoal;
      current.shot_attempts += 1;
      playerRowsByKey.set(playerKey, current);
    }

    if (prediction.goalie_in_net_id != null) {
      const goalieKey = `${prediction.model_version}:${prediction.feature_version}:${prediction.game_id}:${prediction.goalie_in_net_id}`;
      const current = goalieRowsByKey.get(goalieKey) ?? {
        model_version: prediction.model_version,
        feature_version: prediction.feature_version,
        season_id: prediction.season_id ?? game.seasonId,
        game_id: prediction.game_id,
        game_date: prediction.game_date ?? game.date,
        goalie_player_id: prediction.goalie_in_net_id,
        team_id: opponentId,
        opponent_team_id: ownerTeamId,
        xg_against: 0,
        flurry_adjusted_xg_against: 0,
        goals_against: 0,
        shots_against: 0,
        goals_saved_above_expected: 0,
        flurry_adjusted_goals_saved_above_expected: 0,
        source_prediction_type: "shot_goal" as const,
        source_model_approved: true as const,
        provenance: predictionProvenance({
          modelVersion: prediction.model_version,
          featureVersion: prediction.feature_version,
          generatedAt,
        }),
        updated_at: generatedAt,
      };
      current.xg_against = roundMetric(current.xg_against + xg);
      current.flurry_adjusted_xg_against = roundMetric(
        current.flurry_adjusted_xg_against + flurryAdjustedXg
      );
      current.goals_against += isGoal;
      current.shots_against += 1;
      current.goals_saved_above_expected = roundMetric(
        current.xg_against - current.goals_against
      );
      current.flurry_adjusted_goals_saved_above_expected = roundMetric(
        current.flurry_adjusted_xg_against - current.goals_against
      );
      goalieRowsByKey.set(goalieKey, current);
    }
  }

  const teamGameRows = Array.from(teamRowsByKey.values()).sort((left, right) =>
    `${gameSortValue(left)}:${left.team_id}`.localeCompare(`${gameSortValue(right)}:${right.team_id}`)
  );
  const playerGameRows = Array.from(playerRowsByKey.values()).sort((left, right) =>
    `${gameSortValue(left)}:${left.player_id}`.localeCompare(`${gameSortValue(right)}:${right.player_id}`)
  );
  const goalieGameRows = Array.from(goalieRowsByKey.values()).sort((left, right) =>
    `${gameSortValue(left)}:${left.goalie_player_id}`.localeCompare(`${gameSortValue(right)}:${right.goalie_player_id}`)
  );

  return {
    teamGameRows,
    playerGameRows,
    goalieGameRows,
    teamRollingRows: buildRollingTeamRows({ rows: teamGameRows, windows, generatedAt }),
    playerRollingRows: buildRollingPlayerRows({ rows: playerGameRows, windows, generatedAt }),
    goalieRollingRows: buildRollingGoalieRows({ rows: goalieGameRows, windows, generatedAt }),
    skippedPredictionRows,
  };
}

export function validateXgAggregateReconciliation(
  predictions: XgAggregatePredictionRow[],
  games: XgAggregateGameRow[],
  aggregates: Pick<
    XgAggregateBuildResult,
    "teamGameRows" | "playerGameRows" | "goalieGameRows" | "skippedPredictionRows"
  >,
  options: ValidateXgAggregateReconciliationOptions = {}
): XgAggregateReconciliationReport {
  const tolerance = options.tolerance ?? DEFAULT_RECONCILIATION_TOLERANCE;
  const issueLimit = options.issueLimit ?? DEFAULT_RECONCILIATION_ISSUE_LIMIT;
  const gameById = new Map(games.map((game) => [game.id, game]));
  const teamExpected = new Map<string, Record<string, number>>();
  const playerExpected = new Map<string, Record<string, number>>();
  const goalieExpected = new Map<string, Record<string, number>>();
  const emptyNetEventKeys = options.emptyNetEventKeys ?? new Set<string>();
  let emptyNetGoalieRows = 0;
  let emptyNetGoalieXg = 0;
  let emptyNetGoalieGoals = 0;
  let missingShooterRows = 0;
  let missingShooterXg = 0;
  let missingGoalieRows = 0;
  let missingGoalieXg = 0;
  let missingGoalieGoals = 0;

  for (const prediction of predictions) {
    if (prediction.prediction_type !== "shot_goal" || prediction.model_approved !== true) {
      continue;
    }
    const game = gameById.get(prediction.game_id);
    if (!game || prediction.event_owner_team_id == null) continue;

    const ownerTeamId = prediction.event_owner_team_id;
    const opponentId = opponentTeamId(game, ownerTeamId);
    const isGoal = prediction.label === true ? 1 : 0;
    const xg = Number.isFinite(prediction.xg) ? prediction.xg : 0;
    const teamForKey = `${prediction.model_version}:${prediction.feature_version}:${prediction.game_id}:${ownerTeamId}`;
    incrementMetric(teamExpected, teamForKey, "xg_for", xg);
    incrementMetric(teamExpected, teamForKey, "goals_for", isGoal);
    incrementMetric(teamExpected, teamForKey, "shot_attempts_for", 1);

    if (opponentId != null) {
      const teamAgainstKey = `${prediction.model_version}:${prediction.feature_version}:${prediction.game_id}:${opponentId}`;
      incrementMetric(teamExpected, teamAgainstKey, "xg_against", xg);
      incrementMetric(teamExpected, teamAgainstKey, "goals_against", isGoal);
      incrementMetric(teamExpected, teamAgainstKey, "shot_attempts_against", 1);
    }

    if (prediction.shooter_player_id != null) {
      const playerKey = `${prediction.model_version}:${prediction.feature_version}:${prediction.game_id}:${prediction.shooter_player_id}`;
      incrementMetric(playerExpected, playerKey, "ixg", xg);
      incrementMetric(playerExpected, playerKey, "goals", isGoal);
      incrementMetric(playerExpected, playerKey, "shot_attempts", 1);
    } else {
      missingShooterRows += 1;
      missingShooterXg = roundMetric(missingShooterXg + xg);
    }

    if (prediction.goalie_in_net_id != null) {
      const goalieKey = `${prediction.model_version}:${prediction.feature_version}:${prediction.game_id}:${prediction.goalie_in_net_id}`;
      incrementMetric(goalieExpected, goalieKey, "xg_against", xg);
      incrementMetric(goalieExpected, goalieKey, "goals_against", isGoal);
      incrementMetric(goalieExpected, goalieKey, "shots_against", 1);
      incrementMetric(goalieExpected, goalieKey, "goals_saved_above_expected", xg - isGoal);
    } else if (
      emptyNetEventKeys.has(
        xgFeatureEventKey({
          featureVersion: prediction.feature_version,
          gameId: prediction.game_id,
          eventId: prediction.event_id,
        })
      )
    ) {
      emptyNetGoalieRows += 1;
      emptyNetGoalieXg = roundMetric(emptyNetGoalieXg + xg);
      emptyNetGoalieGoals += isGoal;
    } else {
      missingGoalieRows += 1;
      missingGoalieXg = roundMetric(missingGoalieXg + xg);
      missingGoalieGoals += isGoal;
    }
  }

  const teamActual = new Map<string, Record<string, number>>();
  for (const row of aggregates.teamGameRows) {
    const key = `${row.model_version}:${row.feature_version}:${row.game_id}:${row.team_id}`;
    teamActual.set(key, {
      xg_for: row.xg_for,
      xg_against: row.xg_against,
      goals_for: row.goals_for,
      goals_against: row.goals_against,
      shot_attempts_for: row.shot_attempts_for,
      shot_attempts_against: row.shot_attempts_against,
    });
  }

  const playerActual = new Map<string, Record<string, number>>();
  for (const row of aggregates.playerGameRows) {
    const key = `${row.model_version}:${row.feature_version}:${row.game_id}:${row.player_id}`;
    playerActual.set(key, {
      ixg: row.ixg,
      goals: row.goals,
      shot_attempts: row.shot_attempts,
    });
  }

  const goalieActual = new Map<string, Record<string, number>>();
  for (const row of aggregates.goalieGameRows) {
    const key = `${row.model_version}:${row.feature_version}:${row.game_id}:${row.goalie_player_id}`;
    goalieActual.set(key, {
      xg_against: row.xg_against,
      goals_against: row.goals_against,
      shots_against: row.shots_against,
      goals_saved_above_expected: row.goals_saved_above_expected,
    });
  }

  const issues: XgAggregateReconciliationIssue[] = [];
  const issueCountByScope = new Map<XgAggregateReconciliationIssue["scope"], number>();
  addReconciliationIssues({
    issues,
    issueLimit,
    issueCountByScope,
    scope: "team_game",
    expectedByKey: teamExpected,
    actualByKey: teamActual,
    metrics: [
      "xg_for",
      "xg_against",
      "goals_for",
      "goals_against",
      "shot_attempts_for",
      "shot_attempts_against",
    ],
    tolerance,
  });
  addReconciliationIssues({
    issues,
    issueLimit,
    issueCountByScope,
    scope: "player_game",
    expectedByKey: playerExpected,
    actualByKey: playerActual,
    metrics: ["ixg", "goals", "shot_attempts"],
    tolerance,
  });
  addReconciliationIssues({
    issues,
    issueLimit,
    issueCountByScope,
    scope: "goalie_game",
    expectedByKey: goalieExpected,
    actualByKey: goalieActual,
    metrics: [
      "xg_against",
      "goals_against",
      "shots_against",
      "goals_saved_above_expected",
    ],
    tolerance,
  });

  const teamIssueCount = issueCountByScope.get("team_game") ?? 0;
  const playerIssueCount = issueCountByScope.get("player_game") ?? 0;
  const goalieIssueCount = issueCountByScope.get("goalie_game") ?? 0;
  const issueCount = teamIssueCount + playerIssueCount + goalieIssueCount;

  return {
    passed: issueCount === 0,
    tolerance,
    issueCount,
    issues,
    checks: {
      teamGame: {
        passed: teamIssueCount === 0,
        rowsChecked: teamExpected.size,
        issueCount: teamIssueCount,
      },
      playerGame: {
        passed: playerIssueCount === 0,
        rowsChecked: playerExpected.size,
        issueCount: playerIssueCount,
      },
      goalieGame: {
        passed: goalieIssueCount === 0,
        rowsChecked: goalieExpected.size,
        issueCount: goalieIssueCount,
      },
    },
    exclusions: {
      skippedPredictionRows: aggregates.skippedPredictionRows.length,
      emptyNetGoalieRows,
      emptyNetGoalieXg,
      emptyNetGoalieGoals,
      missingShooterRows,
      missingShooterXg,
      missingGoalieRows,
      missingGoalieXg,
      missingGoalieGoals,
    },
  };
}

export function buildArtifactDriftReport(
  predictions: XgAggregatePredictionRow[],
  baseline: XgArtifactDriftBaseline | null
): XgArtifactDriftReport {
  const approvedShotGoalRows = predictions.filter(
    (row) => row.prediction_type === "shot_goal" && row.model_approved === true
  );
  const predictionRows = approvedShotGoalRows.length;
  const averagePrediction = average(
    approvedShotGoalRows.map((row) => (Number.isFinite(row.xg) ? row.xg : 0))
  );
  const goalRate =
    predictionRows > 0
      ? roundMetric(
          approvedShotGoalRows.reduce(
            (sum, row) => sum + (row.label === true ? 1 : 0),
            0
          ) / predictionRows
        )
      : null;

  if (!baseline) {
    return {
      status: "skipped",
      source: null,
      current: { predictionRows, averagePrediction, goalRate },
      baseline: null,
      deltas: {
        averagePrediction: null,
        goalRate: null,
        predictionRowsPct: null,
      },
      warnings: ["No artifact baseline was supplied for drift comparison."],
    };
  }

  const averagePredictionDelta =
    averagePrediction != null && baseline.averagePrediction != null
      ? roundMetric(averagePrediction - baseline.averagePrediction)
      : null;
  const goalRateDelta =
    goalRate != null && baseline.goalRate != null
      ? roundMetric(goalRate - baseline.goalRate)
      : null;
  const predictionRowsPct =
    baseline.exampleCount != null && baseline.exampleCount > 0
      ? roundMetric((predictionRows - baseline.exampleCount) / baseline.exampleCount)
      : null;
  const warnings: string[] = [];

  if (
    averagePredictionDelta != null &&
    Math.abs(averagePredictionDelta) > ARTIFACT_AVERAGE_PREDICTION_WARNING_DELTA
  ) {
    warnings.push("average_prediction_drift");
  }
  if (
    goalRateDelta != null &&
    Math.abs(goalRateDelta) > ARTIFACT_GOAL_RATE_WARNING_DELTA
  ) {
    warnings.push("goal_rate_drift");
  }

  return {
    status: "checked",
    source: baseline.source,
    current: { predictionRows, averagePrediction, goalRate },
    baseline,
    deltas: {
      averagePrediction: averagePredictionDelta,
      goalRate: goalRateDelta,
      predictionRowsPct,
    },
    warnings,
  };
}

export function buildTeamSurfaceDriftReport(args: {
  source: string;
  teamGameRows: XgTeamGameAggregateRow[];
  externalRows: XgExternalTeamComparisonRow[];
  unavailableReason?: string | null;
  sampleLimit?: number;
}): XgTeamSurfaceDriftReport {
  if (args.unavailableReason) {
    return {
      status: "unavailable",
      source: args.source,
      reason: args.unavailableReason,
      rowsCompared: 0,
      missingComparisonRows: args.teamGameRows.length,
      metrics: {
        xgf: { averageAbsoluteDelta: null, maxAbsoluteDelta: null },
        xga: { averageAbsoluteDelta: null, maxAbsoluteDelta: null },
      },
      warnings: ["external_surface_unavailable"],
      samples: [],
    };
  }

  const externalByKey = new Map(
    args.externalRows.map((row) => [`${row.team_id}:${row.game_date ?? ""}`, row])
  );
  const xgfAbsDeltas: number[] = [];
  const xgaAbsDeltas: number[] = [];
  const samples: XgTeamSurfaceDriftReport["samples"] = [];
  let missingComparisonRows = 0;

  for (const row of args.teamGameRows) {
    const external = externalByKey.get(`${row.team_id}:${row.game_date ?? ""}`);
    if (!external) {
      missingComparisonRows += 1;
      continue;
    }

    const xgfDelta =
      external.xgf != null ? roundMetric(row.xg_for - external.xgf) : null;
    const xgaDelta =
      external.xga != null ? roundMetric(row.xg_against - external.xga) : null;
    if (xgfDelta != null) xgfAbsDeltas.push(Math.abs(xgfDelta));
    if (xgaDelta != null) xgaAbsDeltas.push(Math.abs(xgaDelta));

    if (samples.length < (args.sampleLimit ?? 10)) {
      samples.push({
        teamId: row.team_id,
        gameDate: row.game_date,
        inHouseXgf: row.xg_for,
        externalXgf: external.xgf,
        inHouseXga: row.xg_against,
        externalXga: external.xga,
        xgfDelta,
        xgaDelta,
      });
    }
  }

  const rowsCompared = args.teamGameRows.length - missingComparisonRows;
  const xgfAverageAbsoluteDelta = average(xgfAbsDeltas);
  const xgaAverageAbsoluteDelta = average(xgaAbsDeltas);
  const warnings: string[] = [];
  const matchRate =
    args.teamGameRows.length > 0 ? rowsCompared / args.teamGameRows.length : 1;

  if (matchRate < TEAM_SURFACE_MATCH_RATE_WARNING) {
    warnings.push("low_external_match_rate");
  }
  if (
    (xgfAverageAbsoluteDelta != null &&
      xgfAverageAbsoluteDelta > TEAM_SURFACE_AVERAGE_ABS_DELTA_WARNING) ||
    (xgaAverageAbsoluteDelta != null &&
      xgaAverageAbsoluteDelta > TEAM_SURFACE_AVERAGE_ABS_DELTA_WARNING)
  ) {
    warnings.push("large_team_xg_surface_delta");
  }

  return {
    status: "checked",
    source: args.source,
    reason: null,
    rowsCompared,
    missingComparisonRows,
    metrics: {
      xgf: {
        averageAbsoluteDelta: xgfAverageAbsoluteDelta,
        maxAbsoluteDelta: xgfAbsDeltas.length ? roundMetric(Math.max(...xgfAbsDeltas)) : null,
      },
      xga: {
        averageAbsoluteDelta: xgaAverageAbsoluteDelta,
        maxAbsoluteDelta: xgaAbsDeltas.length ? roundMetric(Math.max(...xgaAbsDeltas)) : null,
      },
    },
    warnings,
    samples,
  };
}
