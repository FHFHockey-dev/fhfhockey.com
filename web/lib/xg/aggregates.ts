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

export type XgRollingScope = "team" | "player" | "goalie";

export type XgRollingCoverageReport = Record<
  XgRollingScope,
  {
    /** Rolling rows written: every dressed game in the window is observed or a proven zero. */
    rowsEmitted: number;
    /** Windows left unknown because a dressed game lacks complete prediction coverage. */
    incompleteWindows: number;
    /** Set when no rolling rows can be built for the scope at all. */
    unavailableReason: "participation_ledger_missing" | "prediction_coverage_unproven" | null;
  }
>;

export type XgAggregateBuildResult = {
  teamGameRows: XgTeamGameAggregateRow[];
  playerGameRows: XgPlayerGameAggregateRow[];
  goalieGameRows: XgGoalieGameAggregateRow[];
  teamRollingRows: XgTeamRollingAggregateRow[];
  playerRollingRows: XgPlayerRollingAggregateRow[];
  goalieRollingRows: XgGoalieRollingAggregateRow[];
  skippedPredictionRows: Array<{ gameId: number; eventId: number; reason: string }>;
  rollingCoverage: XgRollingCoverageReport;
};

/**
 * One proven appearance: a team in a played game, a skater on a boxscore,
 * a goalie with time in net. Rolling windows count these games, never rows
 * that merely happened to contain an attempt.
 */
export type XgParticipationRow = {
  entity_id: number;
  game_id: number;
  game_date: string | null;
  season_id: number | null;
  team_id?: number | null;
};

export type BuildXgAggregatesOptions = {
  generatedAt?: string;
  rollingWindows?: number[];
  /**
   * `xgFeatureEventKey` of shots at an empty net (no goalie in the defending
   * net). They are excluded from xG, goals and attempt totals and reported
   * separately under `provenance.emptyNet` (decision 7). A shot taken while
   * the shooter's own net is empty is not in this set and stays in totals.
   */
  emptyNetEventKeys?: Set<string>;
  /**
   * `xgCoverageGameKey` of games whose every scoring-eligible shot has a
   * prediction from the aggregated model. Without it nothing is proven
   * complete: game rows are still built, but no rolling window can be.
   * With it, predictions from uncovered games are skipped.
   */
  coveredGameKeys?: Set<string>;
  /** Appearance ledgers; teams default to the home/away sides of `games`. */
  participation?: {
    teams?: XgParticipationRow[];
    players?: XgParticipationRow[];
    goalies?: XgParticipationRow[];
  };
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
  /** Same coverage proof the builder used; uncovered games are not expected. */
  coveredGameKeys?: Set<string>;
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

export function xgCoverageGameKey(args: {
  modelVersion: string;
  featureVersion: number;
  gameId: number;
}): string {
  return `${args.modelVersion}:${args.featureVersion}:${args.gameId}`;
}

export type XgCoverageFeatureRow = {
  feature_version: number;
  game_id: number;
  event_id: number;
  is_unblocked_shot_attempt: boolean | null;
  is_penalty_shot_event: boolean | null;
  is_shootout_event: boolean | null;
};

/**
 * Games whose scoring-eligible shots (unblocked, not penalty shot, not
 * shootout: the shot-goal scorer's own filter) all carry a prediction from
 * the given model. A game with no eligible feature rows is not proven.
 */
export function buildXgPredictionCoverage(args: {
  predictions: Pick<XgAggregatePredictionRow, "model_version" | "feature_version" | "game_id" | "event_id" | "prediction_type" | "model_approved">[];
  features: XgCoverageFeatureRow[];
}): Set<string> {
  const eligibleByFeatureGame = new Map<string, Set<number>>();
  for (const row of args.features) {
    if (row.is_unblocked_shot_attempt !== true || row.is_penalty_shot_event === true || row.is_shootout_event === true) continue;
    const key = `${Number(row.feature_version)}:${Number(row.game_id)}`;
    const events = eligibleByFeatureGame.get(key) ?? new Set<number>();
    events.add(Number(row.event_id));
    eligibleByFeatureGame.set(key, events);
  }
  const predictedByModelGame = new Map<
    string,
    { modelVersion: string; featureVersion: number; gameId: number; events: Set<number> }
  >();
  for (const row of args.predictions) {
    if (row.prediction_type !== "shot_goal" || row.model_approved !== true) continue;
    const key = xgCoverageGameKey({ modelVersion: row.model_version, featureVersion: row.feature_version, gameId: row.game_id });
    const entry = predictedByModelGame.get(key) ?? {
      modelVersion: row.model_version,
      featureVersion: row.feature_version,
      gameId: row.game_id,
      events: new Set<number>(),
    };
    entry.events.add(row.event_id);
    predictedByModelGame.set(key, entry);
  }
  const covered = new Set<string>();
  for (const [key, entry] of predictedByModelGame) {
    const eligible = eligibleByFeatureGame.get(`${entry.featureVersion}:${entry.gameId}`);
    if (!eligible || eligible.size === 0) continue;
    if ([...eligible].every((eventId) => entry.events.has(eventId))) covered.add(key);
  }
  return covered;
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
    provenance: {
      ...predictionProvenance({
        modelVersion: args.prediction.model_version,
        featureVersion: args.prediction.feature_version,
        generatedAt: args.generatedAt,
      }),
      emptyNet: emptyTeamEmptyNet(),
    },
    updated_at: args.generatedAt,
  };
  args.rowsByKey.set(key, row);
  return row;
}

/** Shots at an empty net, kept out of the xG/goal/attempt totals (decision 7). */
type TeamEmptyNet = {
  xgFor: number;
  goalsFor: number;
  shotAttemptsFor: number;
  xgAgainst: number;
  goalsAgainst: number;
  shotAttemptsAgainst: number;
};
type PlayerEmptyNet = { ixg: number; goals: number; shotAttempts: number };

function emptyTeamEmptyNet(): TeamEmptyNet {
  return { xgFor: 0, goalsFor: 0, shotAttemptsFor: 0, xgAgainst: 0, goalsAgainst: 0, shotAttemptsAgainst: 0 };
}

function emptyPlayerEmptyNet(): PlayerEmptyNet {
  return { ixg: 0, goals: 0, shotAttempts: 0 };
}

function sumEmptyNet<T extends Record<string, number>>(
  zero: T,
  rows: ReadonlyArray<{ provenance: Record<string, unknown> } | null>
): T {
  const total = { ...zero } as Record<string, number>;
  for (const row of rows) {
    const part = row?.provenance.emptyNet as Record<string, number> | undefined;
    if (!part) continue;
    for (const key of Object.keys(total)) total[key] = roundMetric(total[key]! + (part[key] ?? 0));
  }
  return total as T;
}

type GameAggregateBase = {
  model_version: string;
  feature_version: number;
  season_id: number | null;
  game_id: number;
  game_date: string | null;
  provenance: Record<string, unknown>;
};

type DressedRollingWindow<T> = {
  modelVersion: string;
  featureVersion: number;
  asOf: XgParticipationRow;
  windowGames: number;
  /** One entry per dressed game in the window; null is a proven zero. */
  rows: Array<T | null>;
};

function participationSort(left: XgParticipationRow, right: XgParticipationRow): number {
  return gameSortValue(left).localeCompare(gameSortValue(right));
}

/**
 * Rolling windows over the last N games an entity actually played, within one
 * (model, feature version, season, entity) partition. A dressed game with no
 * aggregate row is a zero only when its predictions are proven complete;
 * otherwise the window is unknown and no row is written.
 */
function buildDressedRollingWindows<T extends GameAggregateBase>(args: {
  scope: XgRollingScope;
  rows: T[];
  entityIdOf: (row: T) => number;
  participation: XgParticipationRow[] | undefined;
  modelFeaturePairs: Array<{ modelVersion: string; featureVersion: number }>;
  windows: number[];
  coveredGameKeys: Set<string> | undefined;
  report: XgRollingCoverageReport;
}): DressedRollingWindow<T>[] {
  const report = args.report[args.scope];
  if (!args.participation) {
    report.unavailableReason = "participation_ledger_missing";
    return [];
  }
  if (!args.coveredGameKeys) {
    report.unavailableReason = "prediction_coverage_unproven";
    return [];
  }
  const rowByKey = new Map(
    args.rows.map((row) => [
      `${row.model_version}:${row.feature_version}:${args.entityIdOf(row)}:${row.game_id}`,
      row,
    ])
  );
  const ledger = new Map<string, Map<number, XgParticipationRow>>();
  for (const row of args.participation) {
    const key = `${row.season_id ?? "none"}:${row.entity_id}`;
    const games = ledger.get(key) ?? new Map<number, XgParticipationRow>();
    if (!games.has(row.game_id)) games.set(row.game_id, row);
    ledger.set(key, games);
  }

  const out: DressedRollingWindow<T>[] = [];
  for (const { modelVersion, featureVersion } of args.modelFeaturePairs) {
    for (const games of ledger.values()) {
      const dressed = [...games.values()].sort(participationSort);
      for (let index = 0; index < dressed.length; index += 1) {
        const asOf = dressed[index]!;
        for (const windowGames of args.windows) {
          const window = dressed.slice(Math.max(0, index - windowGames + 1), index + 1);
          const rows: Array<T | null> = [];
          let complete = true;
          for (const game of window) {
            const row = rowByKey.get(`${modelVersion}:${featureVersion}:${game.entity_id}:${game.game_id}`);
            if (row) {
              rows.push(row);
            } else if (
              args.coveredGameKeys.has(xgCoverageGameKey({ modelVersion, featureVersion, gameId: game.game_id }))
            ) {
              rows.push(null);
            } else {
              complete = false;
              break;
            }
          }
          if (!complete) {
            report.incompleteWindows += 1;
            continue;
          }
          report.rowsEmitted += 1;
          out.push({ modelVersion, featureVersion, asOf, windowGames, rows });
        }
      }
    }
  }
  return out;
}

function sumOf<T>(rows: ReadonlyArray<T | null>, value: (row: T) => number): number {
  return rows.reduce((sum, row) => sum + (row ? value(row) : 0), 0);
}

function rollingProvenance(window: DressedRollingWindow<unknown>, generatedAt: string) {
  return predictionProvenance({
    modelVersion: window.modelVersion,
    featureVersion: window.featureVersion,
    generatedAt,
    rollingWindowGames: window.windowGames,
  });
}

function buildRollingTeamRows(
  windows: DressedRollingWindow<XgTeamGameAggregateRow>[],
  generatedAt: string
): XgTeamRollingAggregateRow[] {
  return windows.map((window) => {
    const rows = window.rows;
    return {
      model_version: window.modelVersion,
      feature_version: window.featureVersion,
      season_id: window.asOf.season_id,
      team_id: window.asOf.entity_id,
      as_of_game_id: window.asOf.game_id,
      as_of_game_date: window.asOf.game_date,
      window_games: window.windowGames,
      games_count: rows.length,
      xg_for: roundMetric(sumOf(rows, (row) => row.xg_for)),
      xg_against: roundMetric(sumOf(rows, (row) => row.xg_against)),
      flurry_adjusted_xg_for: roundMetric(sumOf(rows, (row) => row.flurry_adjusted_xg_for)),
      flurry_adjusted_xg_against: roundMetric(sumOf(rows, (row) => row.flurry_adjusted_xg_against)),
      goals_for: sumOf(rows, (row) => row.goals_for),
      goals_against: sumOf(rows, (row) => row.goals_against),
      shot_attempts_for: sumOf(rows, (row) => row.shot_attempts_for),
      shot_attempts_against: sumOf(rows, (row) => row.shot_attempts_against),
      provenance: {
        ...rollingProvenance(window, generatedAt),
        windowBasis: "dressed_games",
        emptyNet: sumEmptyNet(emptyTeamEmptyNet(), rows),
      },
      updated_at: generatedAt,
    };
  });
}

function buildRollingPlayerRows(
  windows: DressedRollingWindow<XgPlayerGameAggregateRow>[],
  generatedAt: string
): XgPlayerRollingAggregateRow[] {
  return windows.map((window) => {
    const rows = window.rows;
    const asOfRow = rows[rows.length - 1] ?? null;
    return {
      model_version: window.modelVersion,
      feature_version: window.featureVersion,
      season_id: window.asOf.season_id,
      player_id: window.asOf.entity_id,
      team_id: window.asOf.team_id ?? asOfRow?.team_id ?? null,
      as_of_game_id: window.asOf.game_id,
      as_of_game_date: window.asOf.game_date,
      window_games: window.windowGames,
      games_count: rows.length,
      ixg: roundMetric(sumOf(rows, (row) => row.ixg)),
      flurry_adjusted_ixg: roundMetric(sumOf(rows, (row) => row.flurry_adjusted_ixg)),
      goals: sumOf(rows, (row) => row.goals),
      shot_attempts: sumOf(rows, (row) => row.shot_attempts),
      provenance: {
        ...rollingProvenance(window, generatedAt),
        windowBasis: "dressed_games",
        emptyNet: sumEmptyNet(emptyPlayerEmptyNet(), rows),
      },
      updated_at: generatedAt,
    };
  });
}

function buildRollingGoalieRows(
  windows: DressedRollingWindow<XgGoalieGameAggregateRow>[],
  generatedAt: string
): XgGoalieRollingAggregateRow[] {
  return windows.map((window) => {
    const rows = window.rows;
    const asOfRow = rows[rows.length - 1] ?? null;
    const xgAgainst = roundMetric(sumOf(rows, (row) => row.xg_against));
    const flurryAdjustedXgAgainst = roundMetric(sumOf(rows, (row) => row.flurry_adjusted_xg_against));
    const goalsAgainst = sumOf(rows, (row) => row.goals_against);
    return {
      model_version: window.modelVersion,
      feature_version: window.featureVersion,
      season_id: window.asOf.season_id,
      goalie_player_id: window.asOf.entity_id,
      team_id: window.asOf.team_id ?? asOfRow?.team_id ?? null,
      as_of_game_id: window.asOf.game_id,
      as_of_game_date: window.asOf.game_date,
      window_games: window.windowGames,
      games_count: rows.length,
      xg_against: xgAgainst,
      flurry_adjusted_xg_against: flurryAdjustedXgAgainst,
      goals_against: goalsAgainst,
      shots_against: sumOf(rows, (row) => row.shots_against),
      goals_saved_above_expected: roundMetric(xgAgainst - goalsAgainst),
      flurry_adjusted_goals_saved_above_expected: roundMetric(flurryAdjustedXgAgainst - goalsAgainst),
      provenance: { ...rollingProvenance(window, generatedAt), windowBasis: "appearances" },
      updated_at: generatedAt,
    };
  });
}

export function isXgEmptyNetTarget(
  prediction: Pick<XgAggregatePredictionRow, "feature_version" | "game_id" | "event_id" | "goalie_in_net_id">,
  emptyNetEventKeys: Set<string> | undefined
): boolean {
  return (
    prediction.goalie_in_net_id == null &&
    emptyNetEventKeys != null &&
    emptyNetEventKeys.has(
      xgFeatureEventKey({
        featureVersion: prediction.feature_version,
        gameId: prediction.game_id,
        eventId: prediction.event_id,
      })
    )
  );
}

function modelFeatureKey(row: { model_version: string; feature_version: number }): string {
  return `${row.model_version}:${row.feature_version}`;
}

function teamParticipationFromGames(games: XgAggregateGameRow[]): XgParticipationRow[] {
  return games.flatMap((game) =>
    [game.homeTeamId, game.awayTeamId]
      .filter((teamId): teamId is number => teamId != null)
      .map((teamId) => ({
        entity_id: teamId,
        game_id: game.id,
        game_date: game.date,
        season_id: game.seasonId,
        team_id: teamId,
      }))
  );
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
  const approved = predictions.filter(
    (row) => row.prediction_type === "shot_goal" && row.model_approved === true
  );
  // Flurry survival chains are computed per model and feature version: the
  // same game scored under two versions must never share one sequence.
  const approvedByVersion = new Map<string, XgAggregatePredictionRow[]>();
  for (const row of approved) {
    const group = approvedByVersion.get(modelFeatureKey(row)) ?? [];
    group.push(row);
    approvedByVersion.set(modelFeatureKey(row), group);
  }
  const flurryAdjustedByEvent = new Map<string, number>();
  const modelFeaturePairs: Array<{ modelVersion: string; featureVersion: number }> = [];
  for (const [versionKey, rows] of approvedByVersion) {
    modelFeaturePairs.push({ modelVersion: rows[0]!.model_version, featureVersion: rows[0]!.feature_version });
    for (const adjusted of buildFlurryAdjustedPredictions(
      rows.map((row) => ({
        gameId: row.game_id,
        eventId: row.event_id,
        rawXg: row.xg,
        flurrySequenceId: row.flurry_sequence_id ?? null,
        flurryShotIndex: row.flurry_shot_index ?? null,
      }))
    )) {
      flurryAdjustedByEvent.set(`${versionKey}:${adjusted.gameId}:${adjusted.eventId}`, adjusted.flurryAdjustedXg);
    }
  }

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

    if (
      options.coveredGameKeys &&
      !options.coveredGameKeys.has(
        xgCoverageGameKey({
          modelVersion: prediction.model_version,
          featureVersion: prediction.feature_version,
          gameId: prediction.game_id,
        })
      )
    ) {
      skippedPredictionRows.push({
        gameId: prediction.game_id,
        eventId: prediction.event_id,
        reason: "incomplete_prediction_coverage",
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
      `${modelFeatureKey(prediction)}:${prediction.game_id}:${prediction.event_id}`
    ) ?? xg;
    const emptyNetTarget = isXgEmptyNetTarget(prediction, options.emptyNetEventKeys);
    const forRow = addTeamGameRow({
      rowsByKey: teamRowsByKey,
      prediction,
      game,
      teamId: ownerTeamId,
      generatedAt,
    });
    if (emptyNetTarget) {
      const emptyNet = forRow.provenance.emptyNet as TeamEmptyNet;
      emptyNet.xgFor = roundMetric(emptyNet.xgFor + xg);
      emptyNet.goalsFor += isGoal;
      emptyNet.shotAttemptsFor += 1;
    } else {
      forRow.xg_for = roundMetric(forRow.xg_for + xg);
      forRow.flurry_adjusted_xg_for = roundMetric(
        forRow.flurry_adjusted_xg_for + flurryAdjustedXg
      );
      forRow.goals_for += isGoal;
      forRow.shot_attempts_for += 1;
    }

    if (opponentId != null) {
      const againstRow = addTeamGameRow({
        rowsByKey: teamRowsByKey,
        prediction,
        game,
        teamId: opponentId,
        generatedAt,
      });
      if (emptyNetTarget) {
        const emptyNet = againstRow.provenance.emptyNet as TeamEmptyNet;
        emptyNet.xgAgainst = roundMetric(emptyNet.xgAgainst + xg);
        emptyNet.goalsAgainst += isGoal;
        emptyNet.shotAttemptsAgainst += 1;
      } else {
        againstRow.xg_against = roundMetric(againstRow.xg_against + xg);
        againstRow.flurry_adjusted_xg_against = roundMetric(
          againstRow.flurry_adjusted_xg_against + flurryAdjustedXg
        );
        againstRow.goals_against += isGoal;
        againstRow.shot_attempts_against += 1;
      }
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
        provenance: {
          ...predictionProvenance({
            modelVersion: prediction.model_version,
            featureVersion: prediction.feature_version,
            generatedAt,
          }),
          emptyNet: emptyPlayerEmptyNet(),
        },
        updated_at: generatedAt,
      };
      if (emptyNetTarget) {
        const emptyNet = current.provenance.emptyNet as PlayerEmptyNet;
        emptyNet.ixg = roundMetric(emptyNet.ixg + xg);
        emptyNet.goals += isGoal;
        emptyNet.shotAttempts += 1;
      } else {
        current.ixg = roundMetric(current.ixg + xg);
        current.flurry_adjusted_ixg = roundMetric(
          current.flurry_adjusted_ixg + flurryAdjustedXg
        );
        current.goals += isGoal;
        current.shot_attempts += 1;
      }
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

  const rollingCoverage: XgRollingCoverageReport = {
    team: { rowsEmitted: 0, incompleteWindows: 0, unavailableReason: null },
    player: { rowsEmitted: 0, incompleteWindows: 0, unavailableReason: null },
    goalie: { rowsEmitted: 0, incompleteWindows: 0, unavailableReason: null },
  };
  const rollingInputs = {
    modelFeaturePairs,
    windows,
    coveredGameKeys: options.coveredGameKeys,
    report: rollingCoverage,
  };

  return {
    teamGameRows,
    playerGameRows,
    goalieGameRows,
    teamRollingRows: buildRollingTeamRows(
      buildDressedRollingWindows({
        ...rollingInputs,
        scope: "team",
        rows: teamGameRows,
        entityIdOf: (row) => row.team_id,
        participation: options.participation?.teams ?? teamParticipationFromGames(games),
      }),
      generatedAt
    ),
    playerRollingRows: buildRollingPlayerRows(
      buildDressedRollingWindows({
        ...rollingInputs,
        scope: "player",
        rows: playerGameRows,
        entityIdOf: (row) => row.player_id,
        participation: options.participation?.players,
      }),
      generatedAt
    ),
    goalieRollingRows: buildRollingGoalieRows(
      buildDressedRollingWindows({
        ...rollingInputs,
        scope: "goalie",
        rows: goalieGameRows,
        entityIdOf: (row) => row.goalie_player_id,
        participation: options.participation?.goalies,
      }),
      generatedAt
    ),
    skippedPredictionRows,
    rollingCoverage,
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
    if (
      options.coveredGameKeys &&
      !options.coveredGameKeys.has(
        xgCoverageGameKey({
          modelVersion: prediction.model_version,
          featureVersion: prediction.feature_version,
          gameId: prediction.game_id,
        })
      )
    ) continue;

    const ownerTeamId = prediction.event_owner_team_id;
    const opponentId = opponentTeamId(game, ownerTeamId);
    const isGoal = prediction.label === true ? 1 : 0;
    const xg = Number.isFinite(prediction.xg) ? prediction.xg : 0;
    // Shots at an empty net are outside every total (decision 7); they are
    // counted in the emptyNet exclusions below.
    const emptyNetTarget = isXgEmptyNetTarget(prediction, emptyNetEventKeys);
    const teamForKey = `${prediction.model_version}:${prediction.feature_version}:${prediction.game_id}:${ownerTeamId}`;
    const counted = emptyNetTarget ? 0 : 1;
    incrementMetric(teamExpected, teamForKey, "xg_for", xg * counted);
    incrementMetric(teamExpected, teamForKey, "goals_for", isGoal * counted);
    incrementMetric(teamExpected, teamForKey, "shot_attempts_for", counted);

    if (opponentId != null) {
      const teamAgainstKey = `${prediction.model_version}:${prediction.feature_version}:${prediction.game_id}:${opponentId}`;
      incrementMetric(teamExpected, teamAgainstKey, "xg_against", xg * counted);
      incrementMetric(teamExpected, teamAgainstKey, "goals_against", isGoal * counted);
      incrementMetric(teamExpected, teamAgainstKey, "shot_attempts_against", counted);
    }

    if (prediction.shooter_player_id != null) {
      const playerKey = `${prediction.model_version}:${prediction.feature_version}:${prediction.game_id}:${prediction.shooter_player_id}`;
      incrementMetric(playerExpected, playerKey, "ixg", xg * counted);
      incrementMetric(playerExpected, playerKey, "goals", isGoal * counted);
      incrementMetric(playerExpected, playerKey, "shot_attempts", counted);
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
