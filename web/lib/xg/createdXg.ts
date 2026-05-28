export type CreatedXgShotAssistRow = {
  model_version: string;
  feature_version: number;
  game_id: number;
  event_id: number;
  season_id: number | null;
  game_date: string | null;
  event_owner_team_id: number | null;
  shooter_player_id: number | null;
  shot_assist_player_id: number;
  expected_primary_assists: number;
};

export type CreatedXgTransitionEventRow = {
  model_version: string;
  feature_version: number;
  game_id: number;
  event_id: number;
  transition_type: string;
  season_id: number | null;
  game_date: string | null;
  team_id: number | null;
  player_id: number | null;
  shot_event_id: number;
  transition_created_xg: number;
};

export type CreatedXgShotIdentityRow = {
  feature_version: number;
  game_id: number;
  event_id: number;
  shooter_player_id: number | null;
  event_owner_team_id: number | null;
};

export type PlayerCreatedXgGameAggregateRow = {
  model_version: string;
  feature_version: number;
  season_id: number | null;
  game_id: number;
  game_date: string | null;
  player_id: number;
  team_id: number | null;
  shot_assist_created_xg: number;
  transition_created_xg: number;
  rebound_created_xg: number;
  created_xg: number;
  shot_assist_events: number;
  transition_events: number;
  rebound_events: number;
  provenance: Record<string, unknown>;
  updated_at: string;
};

export type PlayerCreatedXgRollingAggregateRow = {
  model_version: string;
  feature_version: number;
  season_id: number | null;
  player_id: number;
  team_id: number | null;
  as_of_game_id: number;
  as_of_game_date: string | null;
  window_games: number;
  games_count: number;
  shot_assist_created_xg: number;
  transition_created_xg: number;
  rebound_created_xg: number;
  created_xg: number;
  shot_assist_events: number;
  transition_events: number;
  rebound_events: number;
  provenance: Record<string, unknown>;
  updated_at: string;
};

export type CreatedXgSkippedTransitionRow = {
  modelVersion: string;
  featureVersion: number;
  gameId: number;
  eventId: number;
  transitionType: string;
  reason: string;
};

export type CreatedXgReconciliationReport = {
  passed: boolean;
  tolerance: number;
  expected: {
    shotAssistCreatedXg: number;
    transitionCreatedXg: number;
    createdXg: number;
    shotAssistEvents: number;
    transitionEvents: number;
  };
  actual: {
    shotAssistCreatedXg: number;
    transitionCreatedXg: number;
    createdXg: number;
    shotAssistEvents: number;
    transitionEvents: number;
  };
  deltas: {
    shotAssistCreatedXg: number;
    transitionCreatedXg: number;
    createdXg: number;
    shotAssistEvents: number;
    transitionEvents: number;
  };
  skippedTransitionRows: CreatedXgSkippedTransitionRow[];
};

export type BuildCreatedXgAggregatesResult = {
  playerGameRows: PlayerCreatedXgGameAggregateRow[];
  playerRollingRows: PlayerCreatedXgRollingAggregateRow[];
  reconciliation: CreatedXgReconciliationReport;
};

export type BuildCreatedXgAggregatesOptions = {
  generatedAt?: string;
  rollingWindows?: number[];
  tolerance?: number;
};

const DEFAULT_ROLLING_WINDOWS = [5, 10, 20];
const DEFAULT_RECONCILIATION_TOLERANCE = 0.000001;
const TRANSITION_CREATOR_TYPES = new Set([
  "controlled_entry_proxy",
  "controlled_exit_proxy",
  "entry_assist_proxy",
]);

function roundMetric(value: number): number {
  return Number(value.toFixed(6));
}

function gameSortValue(row: { game_date?: string | null; game_id: number }): string {
  return `${row.game_date ?? "9999-12-31"}:${String(row.game_id).padStart(10, "0")}`;
}

function shotIdentityKey(row: {
  feature_version: number;
  game_id: number;
  event_id: number;
}): string {
  return `${row.feature_version}:${row.game_id}:${row.event_id}`;
}

function sourceProvenance(args: {
  modelVersion: string;
  featureVersion: number;
  generatedAt: string;
  rollingWindowGames?: number;
}) {
  return {
    sourceTables: [
      "nhl_xg_shot_assist_candidates",
      "nhl_xg_transition_events",
      "nhl_xg_shot_features",
    ],
    contractVersion: 1,
    modelVersion: args.modelVersion,
    featureVersion: args.featureVersion,
    rollingWindowGames: args.rollingWindowGames ?? null,
    formula:
      "created_xg = shot_assist_created_xg + selected_non_shooter_transition_created_xg + rebound_created_xg",
    reboundCreatedXgIncluded: false,
    transitionSelection:
      "max one non-shooter creator credit per player-shot across controlled entry, controlled exit, and entry assist proxy events",
    generatedAt: args.generatedAt,
  };
}

function addGameRowComponent(
  rowsByKey: Map<string, PlayerCreatedXgGameAggregateRow>,
  args: {
    modelVersion: string;
    featureVersion: number;
    seasonId: number | null;
    gameId: number;
    gameDate: string | null;
    playerId: number;
    teamId: number | null;
    generatedAt: string;
    component: "shotAssist" | "transition";
    value: number;
  }
) {
  const key = `${args.modelVersion}:${args.featureVersion}:${args.gameId}:${args.playerId}`;
  const row =
    rowsByKey.get(key) ??
    ({
      model_version: args.modelVersion,
      feature_version: args.featureVersion,
      season_id: args.seasonId,
      game_id: args.gameId,
      game_date: args.gameDate,
      player_id: args.playerId,
      team_id: args.teamId,
      shot_assist_created_xg: 0,
      transition_created_xg: 0,
      rebound_created_xg: 0,
      created_xg: 0,
      shot_assist_events: 0,
      transition_events: 0,
      rebound_events: 0,
      provenance: sourceProvenance({
        modelVersion: args.modelVersion,
        featureVersion: args.featureVersion,
        generatedAt: args.generatedAt,
      }),
      updated_at: args.generatedAt,
    } satisfies PlayerCreatedXgGameAggregateRow);

  if (args.component === "shotAssist") {
    row.shot_assist_created_xg = roundMetric(row.shot_assist_created_xg + args.value);
    row.shot_assist_events += 1;
  } else {
    row.transition_created_xg = roundMetric(row.transition_created_xg + args.value);
    row.transition_events += 1;
  }
  row.created_xg = roundMetric(
    row.shot_assist_created_xg + row.transition_created_xg + row.rebound_created_xg
  );
  rowsByKey.set(key, row);
}

function buildRollingRows(args: {
  rows: PlayerCreatedXgGameAggregateRow[];
  windows: number[];
  generatedAt: string;
}): PlayerCreatedXgRollingAggregateRow[] {
  const byPlayer = new Map<number, PlayerCreatedXgGameAggregateRow[]>();
  for (const row of args.rows) {
    const current = byPlayer.get(row.player_id) ?? [];
    current.push(row);
    byPlayer.set(row.player_id, current);
  }

  const out: PlayerCreatedXgRollingAggregateRow[] = [];
  for (const [playerId, rows] of byPlayer) {
    const sorted = [...rows].sort((left, right) =>
      gameSortValue(left).localeCompare(gameSortValue(right))
    );
    for (let index = 0; index < sorted.length; index += 1) {
      const current = sorted[index]!;
      for (const windowGames of args.windows) {
        const windowRows = sorted.slice(Math.max(0, index - windowGames + 1), index + 1);
        const shotAssistCreatedXg = roundMetric(
          windowRows.reduce((sum, row) => sum + row.shot_assist_created_xg, 0)
        );
        const transitionCreatedXg = roundMetric(
          windowRows.reduce((sum, row) => sum + row.transition_created_xg, 0)
        );
        const reboundCreatedXg = roundMetric(
          windowRows.reduce((sum, row) => sum + row.rebound_created_xg, 0)
        );

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
          shot_assist_created_xg: shotAssistCreatedXg,
          transition_created_xg: transitionCreatedXg,
          rebound_created_xg: reboundCreatedXg,
          created_xg: roundMetric(
            shotAssistCreatedXg + transitionCreatedXg + reboundCreatedXg
          ),
          shot_assist_events: windowRows.reduce(
            (sum, row) => sum + row.shot_assist_events,
            0
          ),
          transition_events: windowRows.reduce(
            (sum, row) => sum + row.transition_events,
            0
          ),
          rebound_events: windowRows.reduce((sum, row) => sum + row.rebound_events, 0),
          provenance: sourceProvenance({
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

function summarize(rows: PlayerCreatedXgGameAggregateRow[]) {
  return rows.reduce(
    (sum, row) => ({
      shotAssistCreatedXg: roundMetric(
        sum.shotAssistCreatedXg + row.shot_assist_created_xg
      ),
      transitionCreatedXg: roundMetric(sum.transitionCreatedXg + row.transition_created_xg),
      createdXg: roundMetric(sum.createdXg + row.created_xg),
      shotAssistEvents: sum.shotAssistEvents + row.shot_assist_events,
      transitionEvents: sum.transitionEvents + row.transition_events,
    }),
    {
      shotAssistCreatedXg: 0,
      transitionCreatedXg: 0,
      createdXg: 0,
      shotAssistEvents: 0,
      transitionEvents: 0,
    }
  );
}

export function buildCreatedXgAggregates(args: {
  shotAssistRows: CreatedXgShotAssistRow[];
  transitionRows: CreatedXgTransitionEventRow[];
  shotIdentityRows: CreatedXgShotIdentityRow[];
  options?: BuildCreatedXgAggregatesOptions;
}): BuildCreatedXgAggregatesResult {
  const generatedAt = args.options?.generatedAt ?? new Date().toISOString();
  const windows = args.options?.rollingWindows?.length
    ? Array.from(
        new Set(args.options.rollingWindows.filter((value) => Number.isInteger(value) && value > 0))
      )
    : DEFAULT_ROLLING_WINDOWS;
  const tolerance = args.options?.tolerance ?? DEFAULT_RECONCILIATION_TOLERANCE;
  const shotIdentityByKey = new Map(
    args.shotIdentityRows.map((row) => [shotIdentityKey(row), row])
  );
  const rowsByKey = new Map<string, PlayerCreatedXgGameAggregateRow>();
  const skippedTransitionRows: CreatedXgSkippedTransitionRow[] = [];
  let expectedShotAssistCreatedXg = 0;
  let expectedTransitionCreatedXg = 0;
  let expectedShotAssistEvents = 0;
  let expectedTransitionEvents = 0;

  for (const row of args.shotAssistRows) {
    if (!Number.isFinite(row.expected_primary_assists)) continue;
    if (row.shot_assist_player_id === row.shooter_player_id) continue;

    const value = roundMetric(row.expected_primary_assists);
    expectedShotAssistCreatedXg = roundMetric(expectedShotAssistCreatedXg + value);
    expectedShotAssistEvents += 1;
    addGameRowComponent(rowsByKey, {
      modelVersion: row.model_version,
      featureVersion: row.feature_version,
      seasonId: row.season_id,
      gameId: row.game_id,
      gameDate: row.game_date,
      playerId: row.shot_assist_player_id,
      teamId: row.event_owner_team_id,
      generatedAt,
      component: "shotAssist",
      value,
    });
  }

  const bestTransitionByPlayerShot = new Map<string, CreatedXgTransitionEventRow>();
  for (const row of args.transitionRows) {
    if (!TRANSITION_CREATOR_TYPES.has(row.transition_type)) continue;
    if (row.player_id == null) {
      skippedTransitionRows.push({
        modelVersion: row.model_version,
        featureVersion: row.feature_version,
        gameId: row.game_id,
        eventId: row.event_id,
        transitionType: row.transition_type,
        reason: "missing_creator_player_id",
      });
      continue;
    }

    const identity = shotIdentityByKey.get(
      shotIdentityKey({
        feature_version: row.feature_version,
        game_id: row.game_id,
        event_id: row.shot_event_id,
      })
    );
    if (!identity) {
      skippedTransitionRows.push({
        modelVersion: row.model_version,
        featureVersion: row.feature_version,
        gameId: row.game_id,
        eventId: row.event_id,
        transitionType: row.transition_type,
        reason: "missing_shot_identity",
      });
      continue;
    }
    if (identity.shooter_player_id === row.player_id) {
      skippedTransitionRows.push({
        modelVersion: row.model_version,
        featureVersion: row.feature_version,
        gameId: row.game_id,
        eventId: row.event_id,
        transitionType: row.transition_type,
        reason: "shooter_self_credit_excluded",
      });
      continue;
    }
    if (!Number.isFinite(row.transition_created_xg)) continue;

    const key = `${row.model_version}:${row.feature_version}:${row.game_id}:${row.shot_event_id}:${row.player_id}`;
    const existing = bestTransitionByPlayerShot.get(key);
    if (!existing || row.transition_created_xg > existing.transition_created_xg) {
      bestTransitionByPlayerShot.set(key, row);
    }
  }

  for (const row of bestTransitionByPlayerShot.values()) {
    const value = roundMetric(row.transition_created_xg);
    expectedTransitionCreatedXg = roundMetric(expectedTransitionCreatedXg + value);
    expectedTransitionEvents += 1;
    addGameRowComponent(rowsByKey, {
      modelVersion: row.model_version,
      featureVersion: row.feature_version,
      seasonId: row.season_id,
      gameId: row.game_id,
      gameDate: row.game_date,
      playerId: row.player_id!,
      teamId: row.team_id,
      generatedAt,
      component: "transition",
      value,
    });
  }

  const playerGameRows = Array.from(rowsByKey.values()).sort((left, right) =>
    `${gameSortValue(left)}:${left.player_id}`.localeCompare(
      `${gameSortValue(right)}:${right.player_id}`
    )
  );
  const actual = summarize(playerGameRows);
  const expected = {
    shotAssistCreatedXg: expectedShotAssistCreatedXg,
    transitionCreatedXg: expectedTransitionCreatedXg,
    createdXg: roundMetric(expectedShotAssistCreatedXg + expectedTransitionCreatedXg),
    shotAssistEvents: expectedShotAssistEvents,
    transitionEvents: expectedTransitionEvents,
  };
  const deltas = {
    shotAssistCreatedXg: roundMetric(actual.shotAssistCreatedXg - expected.shotAssistCreatedXg),
    transitionCreatedXg: roundMetric(actual.transitionCreatedXg - expected.transitionCreatedXg),
    createdXg: roundMetric(actual.createdXg - expected.createdXg),
    shotAssistEvents: actual.shotAssistEvents - expected.shotAssistEvents,
    transitionEvents: actual.transitionEvents - expected.transitionEvents,
  };

  return {
    playerGameRows,
    playerRollingRows: buildRollingRows({ rows: playerGameRows, windows, generatedAt }),
    reconciliation: {
      passed:
        Math.abs(deltas.shotAssistCreatedXg) <= tolerance &&
        Math.abs(deltas.transitionCreatedXg) <= tolerance &&
        Math.abs(deltas.createdXg) <= tolerance &&
        deltas.shotAssistEvents === 0 &&
        deltas.transitionEvents === 0,
      tolerance,
      expected,
      actual,
      deltas,
      skippedTransitionRows,
    },
  };
}
