export type ReboundControlOutcome =
  | "second_chance_allowed"
  | "goalie_freeze"
  | "covered_puck"
  | "no_danger_continuation"
  | "unknown";

export type ReboundControlSourceRow = {
  model_version: string;
  prediction_type: "rebound_creation";
  feature_version: number;
  game_id: number;
  event_id: number;
  season_id: number | null;
  game_date: string | null;
  event_owner_team_id: number | null;
  shooter_player_id: number | null;
  goalie_in_net_id: number | null;
  shot_event_type: string | null;
  expected_rebound_probability: number;
  raw_probability: number | null;
  calibrated_probability: number | null;
  label: boolean | null;
  model_approved: boolean;
  creates_rebound: boolean;
  is_rebound_shot: boolean;
  is_empty_net_event: boolean;
  is_delayed_penalty_event: boolean;
  rebound_control_outcome?: ReboundControlOutcome | null;
  creates_goalie_freeze?: boolean | null;
  creates_covered_puck?: boolean | null;
  creates_no_danger_continuation?: boolean | null;
};

export type ReboundControlGameRow = {
  id: number;
  seasonId: number | null;
  date: string | null;
  homeTeamId: number | null;
  awayTeamId: number | null;
};

export type ReboundControlTeamGameAggregateRow = {
  rebound_model_version: string;
  feature_version: number;
  season_id: number | null;
  game_id: number;
  game_date: string | null;
  team_id: number;
  opponent_team_id: number | null;
  is_home: boolean | null;
  expected_rebounds_for: number;
  expected_rebounds_against: number;
  actual_rebounds_for: number;
  actual_rebounds_against: number;
  goalie_freezes_for: number;
  goalie_freezes_against: number;
  covered_pucks_for: number;
  covered_pucks_against: number;
  no_danger_continuations_for: number;
  no_danger_continuations_against: number;
  rebound_source_shots_for: number;
  rebound_source_shots_against: number;
  source_prediction_type: "rebound_creation";
  source_model_approved: true;
  freeze_model_status: "label_only_no_approved_model";
  confidence: "model" | "label_only";
  provenance: Record<string, unknown>;
  updated_at: string;
};

export type ReboundControlPlayerGameAggregateRow = {
  rebound_model_version: string;
  feature_version: number;
  season_id: number | null;
  game_id: number;
  game_date: string | null;
  player_id: number;
  team_id: number | null;
  expected_rebounds_created: number;
  actual_rebounds_created: number;
  goalie_freezes_created: number;
  no_danger_continuations: number;
  rebound_source_shots: number;
  source_prediction_type: "rebound_creation";
  source_model_approved: true;
  confidence: "model";
  provenance: Record<string, unknown>;
  updated_at: string;
};

export type ReboundControlGoalieGameAggregateRow = {
  rebound_model_version: string;
  feature_version: number;
  season_id: number | null;
  game_id: number;
  game_date: string | null;
  goalie_player_id: number;
  team_id: number | null;
  opponent_team_id: number | null;
  expected_rebounds_allowed: number;
  actual_rebounds_allowed: number;
  rebound_control_saved_above_expected: number;
  actual_goalie_freezes: number;
  actual_covered_pucks: number;
  no_danger_continuations_allowed: number;
  rebound_source_shots_against: number;
  source_prediction_type: "rebound_creation";
  source_model_approved: true;
  freeze_model_status: "label_only_no_approved_model";
  confidence: "model";
  provenance: Record<string, unknown>;
  updated_at: string;
};

export type ReboundControlQaReport = {
  passed: boolean;
  issueCount: number;
  issues: Array<{ scope: string; key: string; reason: string }>;
  exclusions: {
    skippedRows: number;
    emptyNetRows: number;
    delayedPenaltyRows: number;
    unapprovedRows: number;
    missingTeamRows: number;
    missingShooterRows: number;
    missingGoalieRows: number;
  };
};

export type ReboundControlBuildResult = {
  teamGameRows: ReboundControlTeamGameAggregateRow[];
  playerGameRows: ReboundControlPlayerGameAggregateRow[];
  goalieGameRows: ReboundControlGoalieGameAggregateRow[];
  skippedRows: Array<{ gameId: number; eventId: number; reason: string }>;
  qa: ReboundControlQaReport;
};

type TeamAccumulator = Omit<
  ReboundControlTeamGameAggregateRow,
  | "expected_rebounds_for"
  | "expected_rebounds_against"
  | "actual_rebounds_for"
  | "actual_rebounds_against"
  | "goalie_freezes_for"
  | "goalie_freezes_against"
  | "covered_pucks_for"
  | "covered_pucks_against"
  | "no_danger_continuations_for"
  | "no_danger_continuations_against"
  | "rebound_source_shots_for"
  | "rebound_source_shots_against"
> & {
  expected_rebounds_for: number;
  expected_rebounds_against: number;
  actual_rebounds_for: number;
  actual_rebounds_against: number;
  goalie_freezes_for: number;
  goalie_freezes_against: number;
  covered_pucks_for: number;
  covered_pucks_against: number;
  no_danger_continuations_for: number;
  no_danger_continuations_against: number;
  rebound_source_shots_for: number;
  rebound_source_shots_against: number;
};

function roundMetric(value: number): number {
  return Number(value.toFixed(6));
}

function gameSortValue(row: { game_date?: string | null; game_id: number }): string {
  return `${row.game_date ?? "9999-12-31"}:${String(row.game_id).padStart(10, "0")}`;
}

function gameMetadata(games: ReboundControlGameRow[]): Map<number, ReboundControlGameRow> {
  return new Map(games.map((game) => [game.id, game]));
}

function opponentFor(game: ReboundControlGameRow | null, teamId: number | null): number | null {
  if (!game || teamId == null) return null;
  if (game.homeTeamId === teamId) return game.awayTeamId ?? null;
  if (game.awayTeamId === teamId) return game.homeTeamId ?? null;
  return null;
}

function isHomeFor(game: ReboundControlGameRow | null, teamId: number | null): boolean | null {
  if (!game || teamId == null) return null;
  if (game.homeTeamId === teamId) return true;
  if (game.awayTeamId === teamId) return false;
  return null;
}

function defendingTeamFor(game: ReboundControlGameRow | null, ownerTeamId: number | null): number | null {
  return opponentFor(game, ownerTeamId);
}

function sourceProvenance(args: { modelVersion: string; generatedAt: string }) {
  return {
    sourceTables: ["nhl_xg_shot_features", "nhl_xg_shot_predictions"],
    predictionType: "rebound_creation",
    reboundModelVersion: args.modelVersion,
    expectedRebounds: "approved rebound_creation xG probability",
    freezeModelStatus: "label_only_no_approved_model",
    generatedAt: args.generatedAt,
  };
}

function rowOutcome(row: ReboundControlSourceRow): ReboundControlOutcome {
  if (row.rebound_control_outcome) return row.rebound_control_outcome;
  if (row.creates_rebound) return "second_chance_allowed";
  if (row.creates_goalie_freeze) return "goalie_freeze";
  if (row.creates_covered_puck) return "covered_puck";
  if (row.creates_no_danger_continuation) return "no_danger_continuation";
  return "unknown";
}

function buildTeamRow(args: {
  row: ReboundControlSourceRow;
  teamId: number;
  game: ReboundControlGameRow | null;
  generatedAt: string;
}): TeamAccumulator {
  return {
    rebound_model_version: args.row.model_version,
    feature_version: args.row.feature_version,
    season_id: args.row.season_id,
    game_id: args.row.game_id,
    game_date: args.row.game_date,
    team_id: args.teamId,
    opponent_team_id: opponentFor(args.game, args.teamId),
    is_home: isHomeFor(args.game, args.teamId),
    expected_rebounds_for: 0,
    expected_rebounds_against: 0,
    actual_rebounds_for: 0,
    actual_rebounds_against: 0,
    goalie_freezes_for: 0,
    goalie_freezes_against: 0,
    covered_pucks_for: 0,
    covered_pucks_against: 0,
    no_danger_continuations_for: 0,
    no_danger_continuations_against: 0,
    rebound_source_shots_for: 0,
    rebound_source_shots_against: 0,
    source_prediction_type: "rebound_creation",
    source_model_approved: true,
    freeze_model_status: "label_only_no_approved_model",
    confidence: "model",
    provenance: sourceProvenance({ modelVersion: args.row.model_version, generatedAt: args.generatedAt }),
    updated_at: args.generatedAt,
  };
}

export function buildReboundControlAggregates(
  rows: ReboundControlSourceRow[],
  games: ReboundControlGameRow[],
  options: { generatedAt?: string } = {}
): ReboundControlBuildResult {
  const generatedAt = options.generatedAt ?? new Date().toISOString();
  const gamesById = gameMetadata(games);
  const teamRows = new Map<string, TeamAccumulator>();
  const playerRows = new Map<string, ReboundControlPlayerGameAggregateRow>();
  const goalieRows = new Map<string, ReboundControlGoalieGameAggregateRow>();
  const skippedRows: Array<{ gameId: number; eventId: number; reason: string }> = [];
  const exclusions = {
    skippedRows: 0,
    emptyNetRows: 0,
    delayedPenaltyRows: 0,
    unapprovedRows: 0,
    missingTeamRows: 0,
    missingShooterRows: 0,
    missingGoalieRows: 0,
  };

  for (const row of rows) {
    if (row.prediction_type !== "rebound_creation" || !row.model_approved) {
      skippedRows.push({ gameId: row.game_id, eventId: row.event_id, reason: "not_approved_rebound_prediction" });
      exclusions.unapprovedRows += 1;
      continue;
    }
    if (row.is_delayed_penalty_event) {
      skippedRows.push({ gameId: row.game_id, eventId: row.event_id, reason: "delayed_penalty_rebound_context_excluded" });
      exclusions.delayedPenaltyRows += 1;
      continue;
    }

    const game = gamesById.get(row.game_id) ?? null;
    const ownerTeamId = row.event_owner_team_id;
    const defendingTeamId = defendingTeamFor(game, ownerTeamId);
    if (ownerTeamId == null || defendingTeamId == null) {
      skippedRows.push({ gameId: row.game_id, eventId: row.event_id, reason: "missing_team_context" });
      exclusions.missingTeamRows += 1;
      continue;
    }

    const expected = roundMetric(row.expected_rebound_probability);
    const actual = row.creates_rebound || row.label === true ? 1 : 0;
    const outcome = rowOutcome(row);
    const goalieFreeze = outcome === "goalie_freeze" || row.creates_goalie_freeze === true ? 1 : 0;
    const coveredPuck = outcome === "covered_puck" || row.creates_covered_puck === true || goalieFreeze ? 1 : 0;
    const noDanger = outcome === "no_danger_continuation" || row.creates_no_danger_continuation === true ? 1 : 0;

    for (const teamId of [ownerTeamId, defendingTeamId]) {
      const key = `${row.model_version}:${row.feature_version}:${row.game_id}:${teamId}`;
      const team = teamRows.get(key) ?? buildTeamRow({ row, teamId, game, generatedAt });
      if (teamId === ownerTeamId) {
        team.expected_rebounds_for += expected;
        team.actual_rebounds_for += actual;
        team.goalie_freezes_for += goalieFreeze;
        team.covered_pucks_for += coveredPuck;
        team.no_danger_continuations_for += noDanger;
        team.rebound_source_shots_for += 1;
      } else {
        team.expected_rebounds_against += expected;
        team.actual_rebounds_against += actual;
        team.goalie_freezes_against += goalieFreeze;
        team.covered_pucks_against += coveredPuck;
        team.no_danger_continuations_against += noDanger;
        team.rebound_source_shots_against += 1;
      }
      teamRows.set(key, team);
    }

    if (row.shooter_player_id == null) {
      exclusions.missingShooterRows += 1;
    } else {
      const key = `${row.model_version}:${row.feature_version}:${row.game_id}:${row.shooter_player_id}`;
      const player = playerRows.get(key) ?? {
        rebound_model_version: row.model_version,
        feature_version: row.feature_version,
        season_id: row.season_id,
        game_id: row.game_id,
        game_date: row.game_date,
        player_id: row.shooter_player_id,
        team_id: ownerTeamId,
        expected_rebounds_created: 0,
        actual_rebounds_created: 0,
        goalie_freezes_created: 0,
        no_danger_continuations: 0,
        rebound_source_shots: 0,
        source_prediction_type: "rebound_creation",
        source_model_approved: true,
        confidence: "model",
        provenance: sourceProvenance({ modelVersion: row.model_version, generatedAt }),
        updated_at: generatedAt,
      };
      player.expected_rebounds_created += expected;
      player.actual_rebounds_created += actual;
      player.goalie_freezes_created += goalieFreeze;
      player.no_danger_continuations += noDanger;
      player.rebound_source_shots += 1;
      playerRows.set(key, player);
    }

    if (row.is_empty_net_event) {
      exclusions.emptyNetRows += 1;
    } else if (row.goalie_in_net_id == null) {
      exclusions.missingGoalieRows += 1;
    } else {
      const key = `${row.model_version}:${row.feature_version}:${row.game_id}:${row.goalie_in_net_id}`;
      const goalie = goalieRows.get(key) ?? {
        rebound_model_version: row.model_version,
        feature_version: row.feature_version,
        season_id: row.season_id,
        game_id: row.game_id,
        game_date: row.game_date,
        goalie_player_id: row.goalie_in_net_id,
        team_id: defendingTeamId,
        opponent_team_id: ownerTeamId,
        expected_rebounds_allowed: 0,
        actual_rebounds_allowed: 0,
        rebound_control_saved_above_expected: 0,
        actual_goalie_freezes: 0,
        actual_covered_pucks: 0,
        no_danger_continuations_allowed: 0,
        rebound_source_shots_against: 0,
        source_prediction_type: "rebound_creation",
        source_model_approved: true,
        freeze_model_status: "label_only_no_approved_model",
        confidence: "model",
        provenance: sourceProvenance({ modelVersion: row.model_version, generatedAt }),
        updated_at: generatedAt,
      };
      goalie.expected_rebounds_allowed += expected;
      goalie.actual_rebounds_allowed += actual;
      goalie.rebound_control_saved_above_expected =
        goalie.expected_rebounds_allowed - goalie.actual_rebounds_allowed;
      goalie.actual_goalie_freezes += goalieFreeze;
      goalie.actual_covered_pucks += coveredPuck;
      goalie.no_danger_continuations_allowed += noDanger;
      goalie.rebound_source_shots_against += 1;
      goalieRows.set(key, goalie);
    }
  }

  exclusions.skippedRows = skippedRows.length;
  const finalize = <T extends Record<string, unknown>>(items: Iterable<T>): T[] =>
    Array.from(items).map((item) => {
      const out: Record<string, unknown> = { ...item };
      for (const [key, value] of Object.entries(out)) {
        if (typeof value === "number" && !Number.isInteger(value)) {
          out[key] = roundMetric(value);
        }
      }
      return out as T;
    });

  const teamGameRows = finalize(teamRows.values()) as ReboundControlTeamGameAggregateRow[];
  const playerGameRows = finalize(playerRows.values()) as ReboundControlPlayerGameAggregateRow[];
  const goalieGameRows = finalize(goalieRows.values()) as ReboundControlGoalieGameAggregateRow[];
  const issues: ReboundControlQaReport["issues"] = [];
  if (exclusions.delayedPenaltyRows > 0) {
    issues.push({ scope: "row_exclusion", key: "delayed_penalty", reason: "delayed penalty rebound context excluded from v1 QA cohort" });
  }
  if (exclusions.emptyNetRows > 0) {
    issues.push({ scope: "goalie_exclusion", key: "empty_net", reason: "empty-net rows excluded from goalie rebound-control aggregates" });
  }

  return {
    teamGameRows: teamGameRows.sort((a, b) => gameSortValue(a).localeCompare(gameSortValue(b)) || a.team_id - b.team_id),
    playerGameRows: playerGameRows.sort((a, b) => gameSortValue(a).localeCompare(gameSortValue(b)) || a.player_id - b.player_id),
    goalieGameRows: goalieGameRows.sort((a, b) => gameSortValue(a).localeCompare(gameSortValue(b)) || a.goalie_player_id - b.goalie_player_id),
    skippedRows,
    qa: {
      passed: issues.length === 0,
      issueCount: issues.length,
      issues,
      exclusions,
    },
  };
}
