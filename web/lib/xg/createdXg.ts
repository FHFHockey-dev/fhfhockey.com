import {
  buildDressedRollingWindows,
  emptyXgRollingCoverageReport,
  type XgParticipationRow,
  type XgRollingCoverageReport,
} from "./aggregates";

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

/** The served xG of the shot a credit points at (same model and feature version). */
export type CreatedXgShotXgRow = {
  model_version: string;
  feature_version: number;
  game_id: number;
  event_id: number;
  xg: number;
  /** Only approved shot xG may anchor a credit (decision 101: shadow rows are never served). */
  model_approved: boolean;
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
  /** Decision 22: credits on one shot are exclusive and sum to at most its xG. */
  creditCap: {
    creditedShots: number;
    cappedShots: number;
    /** Credit removed by the cap (raw credit minus credited xG). */
    creditAboveShotXg: number;
    /** Credits skipped because the shot's xG under this model is unknown. */
    creditsWithoutShotXg: number;
    /** Shots whose credited total exceeds their xG after the cap (must be 0). */
    shotsOverCap: number;
  };
};

export type BuildCreatedXgAggregatesResult = {
  playerGameRows: PlayerCreatedXgGameAggregateRow[];
  playerRollingRows: PlayerCreatedXgRollingAggregateRow[];
  reconciliation: CreatedXgReconciliationReport;
  rollingCoverage: XgRollingCoverageReport["player"];
};

export type BuildCreatedXgAggregatesOptions = {
  generatedAt?: string;
  rollingWindows?: number[];
  tolerance?: number;
  /** Skater dressed-game ledger; without it no rolling rows are written. */
  participation?: XgParticipationRow[];
  /**
   * `xgCoverageGameKey` of games whose credit sources are known to have been
   * built for this model; only there is a dressed game with no credit a zero.
   */
  coveredGameKeys?: Set<string>;
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
    creditContract:
      "exclusive: credits on one shot sum to at most the shot's xG (decision 22); over-credited shots are scaled proportionally",
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

/**
 * Rolling created xG over the player's last N dressed games (not the last N
 * games that happened to carry a credit), per (model, feature, season).
 */
function buildRollingRows(args: {
  rows: PlayerCreatedXgGameAggregateRow[];
  windows: number[];
  generatedAt: string;
  participation: XgParticipationRow[] | undefined;
  coveredGameKeys: Set<string> | undefined;
  report: XgRollingCoverageReport;
}): PlayerCreatedXgRollingAggregateRow[] {
  const modelFeaturePairs = Array.from(
    new Map(
      args.rows.map((row) => [
        `${row.model_version}:${row.feature_version}`,
        { modelVersion: row.model_version, featureVersion: row.feature_version },
      ])
    ).values()
  );
  const windows = buildDressedRollingWindows({
    scope: "player",
    rows: args.rows,
    entityIdOf: (row) => row.player_id,
    participation: args.participation,
    modelFeaturePairs,
    windows: args.windows,
    coveredGameKeys: args.coveredGameKeys,
    report: args.report,
  });
  const sum = (rows: Array<PlayerCreatedXgGameAggregateRow | null>, value: (row: PlayerCreatedXgGameAggregateRow) => number) =>
    rows.reduce((total, row) => total + (row ? value(row) : 0), 0);

  return windows.map((window) => {
    const rows = window.rows;
    const shotAssistCreatedXg = roundMetric(sum(rows, (row) => row.shot_assist_created_xg));
    const transitionCreatedXg = roundMetric(sum(rows, (row) => row.transition_created_xg));
    const reboundCreatedXg = roundMetric(sum(rows, (row) => row.rebound_created_xg));
    const lastRow = rows[rows.length - 1] ?? null;
    return {
      model_version: window.modelVersion,
      feature_version: window.featureVersion,
      season_id: window.asOf.season_id,
      player_id: window.asOf.entity_id,
      team_id: window.asOf.team_id ?? lastRow?.team_id ?? null,
      as_of_game_id: window.asOf.game_id,
      as_of_game_date: window.asOf.game_date,
      window_games: window.windowGames,
      games_count: rows.length,
      shot_assist_created_xg: shotAssistCreatedXg,
      transition_created_xg: transitionCreatedXg,
      rebound_created_xg: reboundCreatedXg,
      created_xg: roundMetric(shotAssistCreatedXg + transitionCreatedXg + reboundCreatedXg),
      shot_assist_events: sum(rows, (row) => row.shot_assist_events),
      transition_events: sum(rows, (row) => row.transition_events),
      rebound_events: sum(rows, (row) => row.rebound_events),
      provenance: {
        ...sourceProvenance({
          modelVersion: window.modelVersion,
          featureVersion: window.featureVersion,
          generatedAt: args.generatedAt,
          rollingWindowGames: window.windowGames,
        }),
        windowBasis: "dressed_games",
      },
      updated_at: args.generatedAt,
    };
  });
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

type PendingCredit = {
  modelVersion: string;
  featureVersion: number;
  seasonId: number | null;
  gameId: number;
  gameDate: string | null;
  playerId: number;
  teamId: number | null;
  component: "shotAssist" | "transition";
  value: number;
};

function creditShotKey(modelVersion: string, featureVersion: number, gameId: number, shotEventId: number): string {
  return `${modelVersion}:${featureVersion}:${gameId}:${shotEventId}`;
}

export function buildCreatedXgAggregates(args: {
  shotAssistRows: CreatedXgShotAssistRow[];
  transitionRows: CreatedXgTransitionEventRow[];
  shotIdentityRows: CreatedXgShotIdentityRow[];
  /** Served shot xG; a credit on a shot without one is unknown and skipped. */
  shotXgRows: CreatedXgShotXgRow[];
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
  const shotXgByKey = new Map(
    args.shotXgRows
      .filter((row) => row.model_approved === true && Number.isFinite(row.xg) && row.xg >= 0)
      .map((row) => [creditShotKey(row.model_version, row.feature_version, row.game_id, row.event_id), row.xg])
  );
  const pendingByShot = new Map<string, PendingCredit[]>();
  const addPendingCredit = (shotKey: string, credit: PendingCredit) => {
    const credits = pendingByShot.get(shotKey);
    if (credits) credits.push(credit);
    else pendingByShot.set(shotKey, [credit]);
  };

  for (const row of args.shotAssistRows) {
    if (!Number.isFinite(row.expected_primary_assists)) continue;
    if (row.shot_assist_player_id === row.shooter_player_id) continue;

    addPendingCredit(creditShotKey(row.model_version, row.feature_version, row.game_id, row.event_id), {
      modelVersion: row.model_version,
      featureVersion: row.feature_version,
      seasonId: row.season_id,
      gameId: row.game_id,
      gameDate: row.game_date,
      playerId: row.shot_assist_player_id,
      teamId: row.event_owner_team_id,
      component: "shotAssist",
      value: roundMetric(row.expected_primary_assists),
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
    addPendingCredit(creditShotKey(row.model_version, row.feature_version, row.game_id, row.shot_event_id), {
      modelVersion: row.model_version,
      featureVersion: row.feature_version,
      seasonId: row.season_id,
      gameId: row.game_id,
      gameDate: row.game_date,
      playerId: row.player_id!,
      teamId: row.team_id,
      component: "transition",
      value: roundMetric(row.transition_created_xg),
    });
  }

  // Decision 22: the contributors on one shot share at most that shot's xG.
  // Over-credited shots are scaled proportionally (order-independent).
  const creditCap = {
    creditedShots: 0,
    cappedShots: 0,
    creditAboveShotXg: 0,
    creditsWithoutShotXg: 0,
    shotsOverCap: 0,
  };
  for (const [shotKey, credits] of pendingByShot) {
    const shotXg = shotXgByKey.get(shotKey);
    if (shotXg == null) {
      creditCap.creditsWithoutShotXg += credits.length;
      continue;
    }
    const raw = credits.reduce((sum, credit) => sum + Math.max(0, credit.value), 0);
    const scale = raw > shotXg && raw > 0 ? shotXg / raw : 1;
    creditCap.creditedShots += 1;
    if (scale < 1) {
      creditCap.cappedShots += 1;
      creditCap.creditAboveShotXg = roundMetric(creditCap.creditAboveShotXg + raw - shotXg);
    }
    let credited = 0;
    for (const credit of credits) {
      const value = Math.max(0, credit.value) * scale;
      credited += value;
      if (credit.component === "shotAssist") {
        expectedShotAssistCreatedXg += value;
        expectedShotAssistEvents += 1;
      } else {
        expectedTransitionCreatedXg += value;
        expectedTransitionEvents += 1;
      }
      addGameRowComponent(rowsByKey, { ...credit, generatedAt, value });
    }
    if (credited > shotXg + 1e-9) creditCap.shotsOverCap += 1;
  }
  expectedShotAssistCreatedXg = roundMetric(expectedShotAssistCreatedXg);
  expectedTransitionCreatedXg = roundMetric(expectedTransitionCreatedXg);

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

  const rollingReport = emptyXgRollingCoverageReport();
  const playerRollingRows = buildRollingRows({
    rows: playerGameRows,
    windows,
    generatedAt,
    participation: args.options?.participation,
    coveredGameKeys: args.options?.coveredGameKeys,
    report: rollingReport,
  });

  return {
    playerGameRows,
    playerRollingRows,
    rollingCoverage: rollingReport.player,
    reconciliation: {
      passed:
        creditCap.shotsOverCap === 0 &&
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
      creditCap,
    },
  };
}
