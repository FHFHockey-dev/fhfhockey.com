import supabase from "lib/supabase/server";
import { sha256CanonicalJson } from "lib/projections/materializationFingerprint";
import { SHIFT_RELATIONSHIP_ALGORITHM_VERSION } from "lib/projections/relationshipMaterialization";

import type {
  PreparedGoalieGameV2,
  ProjectionGoalieGameRow,
  ProjectionGoalieJustification,
  ProjectionGoalieOutcome,
} from "./buildGoalieGameV2";
import type {
  ProjectionPlayerStrengthRow,
  ProjectionTeamStrengthRow,
} from "./buildStrengthTablesV2";

export const PROJECTION_DERIVED_ALGORITHM_VERSION =
  "projection-derived-materialization-v1";

type ManifestRow = {
  game_id: number;
  input_status: string;
  input_fingerprint: string | null;
  input_version: number;
  relationship_status: string;
  relationship_input_fingerprint: string | null;
  relationship_version: number;
  relationship_algorithm_version: string | null;
};

type ManifestQuery = {
  select(columns: string): ManifestQuery;
  eq(column: string, value: number): ManifestQuery;
  maybeSingle(): Promise<{ data: unknown; error: unknown }>;
};

export type ProjectionDerivedPersistenceClient = {
  from(table: string): ManifestQuery;
  rpc(
    functionName: string,
    args: Record<string, unknown>,
  ): Promise<{ data: unknown; error: unknown }>;
};

export type ProjectionGameInputManifest = {
  gameId: number;
  inputFingerprint: string;
  inputVersion: number;
};

export type ProjectionGameDerivedReceipt = {
  gameId: number;
  inputFingerprint: string;
  inputVersion: number;
  derivedFingerprint: string;
  derivedVersion: number;
  algorithmVersion: string;
  goalieOutcome: ProjectionGoalieOutcome;
  goalieJustification: ProjectionGoalieJustification | null;
  expectedPlayerRows: number;
  observedPlayerRows: number;
  expectedTeamRows: number;
  observedTeamRows: number;
  expectedGoalieRows: number;
  observedGoalieRows: number;
  prunedPlayerRows: number;
  prunedTeamRows: number;
  prunedGoalieRows: number;
  idempotent: boolean;
  completedAt: string;
  /** Exact rows whose persisted scope the transaction verified. */
  verifiedRows: number;
  /** Exact rows written for a new logical materialization version. */
  upsertedRows: number;
  /** Stale rows removed from the exact persisted scope. */
  prunedRows: number;
  /** Logical upserts plus stale rows pruned from the exact scope. */
  affectedRows: number;
};

export type ProjectionDerivedPersistencePhase =
  | "input_manifest"
  | "persistence_rpc"
  | "receipt_validation";

export class ProjectionDerivedPersistenceError extends Error {
  readonly phase: ProjectionDerivedPersistencePhase;
  readonly gameId: number;
  readonly cause: unknown;

  constructor(args: {
    phase: ProjectionDerivedPersistencePhase;
    gameId: number;
    message: string;
    cause?: unknown;
  }) {
    super(args.message);
    this.name = "ProjectionDerivedPersistenceError";
    this.phase = args.phase;
    this.gameId = args.gameId;
    this.cause = args.cause;
  }
}

function defaultClient(): ProjectionDerivedPersistenceClient {
  if (!supabase) throw new Error("Supabase server client not available");
  return supabase as unknown as ProjectionDerivedPersistenceClient;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isSha256(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f]{64}$/.test(value);
}

function isPositiveVersion(value: unknown): value is number {
  return Number.isSafeInteger(value) && (value as number) > 0;
}

function isNonNegativeInteger(value: unknown): value is number {
  return Number.isSafeInteger(value) && (value as number) >= 0;
}

function isValidCompletedAt(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    !Number.isNaN(Date.parse(value))
  );
}

export async function readProjectionGameInputManifest(args: {
  gameId: number;
  client?: ProjectionDerivedPersistenceClient;
}): Promise<ProjectionGameInputManifest> {
  const { gameId } = args;
  if (!Number.isSafeInteger(gameId) || gameId <= 0) {
    throw new ProjectionDerivedPersistenceError({
      phase: "input_manifest",
      gameId,
      message: `Invalid projection input manifest game ID ${gameId}`,
    });
  }
  const client = args.client ?? defaultClient();
  let result: { data: unknown; error: unknown };
  try {
    result = await client
      .from("projection_game_materialization_status")
      .select(
        "game_id,input_status,input_fingerprint,input_version,relationship_status,relationship_input_fingerprint,relationship_version,relationship_algorithm_version",
      )
      .eq("game_id", gameId)
      .maybeSingle();
  } catch (cause) {
    throw new ProjectionDerivedPersistenceError({
      phase: "input_manifest",
      gameId,
      message: `Could not read the projection input manifest for game ${gameId}`,
      cause,
    });
  }
  if (result.error || !isRecord(result.data)) {
    throw new ProjectionDerivedPersistenceError({
      phase: "input_manifest",
      gameId,
      message: `Projection input manifest is unavailable for game ${gameId}`,
      cause: result.error,
    });
  }
  const row = result.data as ManifestRow;
  if (
    row.game_id !== gameId ||
    row.input_status !== "complete" ||
    !isSha256(row.input_fingerprint) ||
    !isPositiveVersion(row.input_version) ||
    row.relationship_status !== "complete" ||
    row.relationship_input_fingerprint !== row.input_fingerprint ||
    !isPositiveVersion(row.relationship_version) ||
    row.relationship_algorithm_version !== SHIFT_RELATIONSHIP_ALGORITHM_VERSION
  ) {
    throw new ProjectionDerivedPersistenceError({
      phase: "input_manifest",
      gameId,
      message: `Projection input and relationship manifest is not complete for game ${gameId}`,
    });
  }
  return {
    gameId,
    inputFingerprint: row.input_fingerprint,
    inputVersion: row.input_version,
  };
}

function parseReceipt(args: {
  data: unknown;
  gameId: number;
  manifest: ProjectionGameInputManifest;
  derivedFingerprint: string;
  goalieOutcome: ProjectionGoalieOutcome;
  goalieJustification: ProjectionGoalieJustification | null;
  playerCount: number;
  teamCount: number;
  goalieCount: number;
}): ProjectionGameDerivedReceipt {
  const row =
    Array.isArray(args.data) && args.data.length === 1 ? args.data[0] : null;
  if (!isRecord(row)) {
    throw new ProjectionDerivedPersistenceError({
      phase: "receipt_validation",
      gameId: args.gameId,
      message: `Projection derived RPC returned no exact receipt for game ${args.gameId}`,
    });
  }
  const counts = [
    row.expected_player_rows,
    row.observed_player_rows,
    row.expected_team_rows,
    row.observed_team_rows,
    row.expected_goalie_rows,
    row.observed_goalie_rows,
    row.pruned_player_rows,
    row.pruned_team_rows,
    row.pruned_goalie_rows,
  ];
  if (
    row.game_id !== args.gameId ||
    row.input_fingerprint !== args.manifest.inputFingerprint ||
    row.input_version !== args.manifest.inputVersion ||
    row.derived_status !== "complete" ||
    row.derived_fingerprint !== args.derivedFingerprint ||
    !isPositiveVersion(row.derived_version) ||
    row.algorithm_version !== PROJECTION_DERIVED_ALGORITHM_VERSION ||
    row.goalie_outcome !== args.goalieOutcome ||
    row.goalie_justification !== args.goalieJustification ||
    row.expected_player_rows !== args.playerCount ||
    row.observed_player_rows !== args.playerCount ||
    row.expected_team_rows !== args.teamCount ||
    row.observed_team_rows !== args.teamCount ||
    row.expected_goalie_rows !== args.goalieCount ||
    row.observed_goalie_rows !== args.goalieCount ||
    !counts.every(isNonNegativeInteger) ||
    typeof row.idempotent !== "boolean" ||
    !isValidCompletedAt(row.completed_at)
  ) {
    throw new ProjectionDerivedPersistenceError({
      phase: "receipt_validation",
      gameId: args.gameId,
      message: `Projection derived RPC receipt mismatched the requested input version or exact row counts for game ${args.gameId}`,
    });
  }

  const verifiedRows =
    (row.observed_player_rows as number) +
    (row.observed_team_rows as number) +
    (row.observed_goalie_rows as number);
  const prunedRows =
    (row.pruned_player_rows as number) +
    (row.pruned_team_rows as number) +
    (row.pruned_goalie_rows as number);
  const upsertedRows = row.idempotent ? 0 : verifiedRows;

  return {
    gameId: row.game_id as number,
    inputFingerprint: row.input_fingerprint as string,
    inputVersion: row.input_version as number,
    derivedFingerprint: row.derived_fingerprint as string,
    derivedVersion: row.derived_version as number,
    algorithmVersion: row.algorithm_version as string,
    goalieOutcome: row.goalie_outcome as ProjectionGoalieOutcome,
    goalieJustification:
      row.goalie_justification as ProjectionGoalieJustification | null,
    expectedPlayerRows: row.expected_player_rows as number,
    observedPlayerRows: row.observed_player_rows as number,
    expectedTeamRows: row.expected_team_rows as number,
    observedTeamRows: row.observed_team_rows as number,
    expectedGoalieRows: row.expected_goalie_rows as number,
    observedGoalieRows: row.observed_goalie_rows as number,
    prunedPlayerRows: row.pruned_player_rows as number,
    prunedTeamRows: row.pruned_team_rows as number,
    prunedGoalieRows: row.pruned_goalie_rows as number,
    idempotent: row.idempotent as boolean,
    completedAt: row.completed_at as string,
    verifiedRows,
    upsertedRows,
    prunedRows,
    affectedRows: upsertedRows + prunedRows,
  };
}

export async function persistProjectionGameDerivedV1(args: {
  gameId: number;
  manifest: ProjectionGameInputManifest;
  playerRows: ProjectionPlayerStrengthRow[];
  teamRows: ProjectionTeamStrengthRow[];
  goalie: PreparedGoalieGameV2;
  client?: ProjectionDerivedPersistenceClient;
}): Promise<ProjectionGameDerivedReceipt> {
  const goalieRows: ProjectionGoalieGameRow[] = args.goalie.rows;
  const justifiedNotObserved =
    args.goalie.justification ===
      "completed_pbp_contains_no_countable_shot_events" ||
    args.goalie.justification ===
      "completed_pbp_countable_events_are_all_empty_net";
  if (
    args.manifest.gameId !== args.gameId ||
    args.playerRows.length < 1 ||
    args.playerRows.length > 100 ||
    args.teamRows.length !== 2 ||
    goalieRows.length > 4 ||
    (args.goalie.outcome === "complete" &&
      (goalieRows.length === 0 || args.goalie.justification !== null)) ||
    (args.goalie.outcome === "not_observed" &&
      (goalieRows.length !== 0 || !justifiedNotObserved))
  ) {
    throw new ProjectionDerivedPersistenceError({
      phase: "persistence_rpc",
      gameId: args.gameId,
      message: `Projection derived payload is invalid for game ${args.gameId}`,
    });
  }

  const derivedFingerprint = sha256CanonicalJson({
    algorithm_version: PROJECTION_DERIVED_ALGORITHM_VERSION,
    input_fingerprint: args.manifest.inputFingerprint,
    goalie_outcome: args.goalie.outcome,
    goalie_justification: args.goalie.justification,
    player_rows: args.playerRows,
    team_rows: args.teamRows,
    goalie_rows: goalieRows,
  });
  const client = args.client ?? defaultClient();
  let result: { data: unknown; error: unknown };
  try {
    result = await client.rpc("persist_projection_game_derived_v1", {
      p_game_id: args.gameId,
      p_expected_input_fingerprint: args.manifest.inputFingerprint,
      p_expected_input_version: args.manifest.inputVersion,
      p_derived_fingerprint: derivedFingerprint,
      p_algorithm_version: PROJECTION_DERIVED_ALGORITHM_VERSION,
      p_player_rows: args.playerRows,
      p_team_rows: args.teamRows,
      p_goalie_rows: goalieRows,
      p_expected_player_rows: args.playerRows.length,
      p_expected_team_rows: args.teamRows.length,
      p_expected_goalie_rows: goalieRows.length,
      p_goalie_outcome: args.goalie.outcome,
      p_goalie_justification: args.goalie.justification,
    });
  } catch (cause) {
    throw new ProjectionDerivedPersistenceError({
      phase: "persistence_rpc",
      gameId: args.gameId,
      message: `Projection derived persistence failed for game ${args.gameId}`,
      cause,
    });
  }
  if (result.error) {
    throw new ProjectionDerivedPersistenceError({
      phase: "persistence_rpc",
      gameId: args.gameId,
      message: `Projection derived persistence failed for game ${args.gameId}`,
      cause: result.error,
    });
  }
  return parseReceipt({
    data: result.data,
    gameId: args.gameId,
    manifest: args.manifest,
    derivedFingerprint,
    goalieOutcome: args.goalie.outcome,
    goalieJustification: args.goalie.justification,
    playerCount: args.playerRows.length,
    teamCount: args.teamRows.length,
    goalieCount: goalieRows.length,
  });
}
