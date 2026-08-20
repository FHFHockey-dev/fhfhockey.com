import type { SupabaseClient } from "@supabase/supabase-js";

import {
  FANTASY_PROJECTION_CONTRACT_CHECKSUM,
  FANTASY_PROJECTION_CONTRACT_VERSION,
  FANTASY_PROJECTION_SEASON_ID,
  FANTASY_PROJECTION_V4_CONTRACT_CHECKSUM,
  FANTASY_PROJECTION_V4_CONTRACT_VERSION,
  FANTASY_PROJECTION_V5_CONTRACT_CHECKSUM,
  FANTASY_PROJECTION_V5_CONTRACT_VERSION,
} from "./contracts";

const TABLES = [
  "player_forecast_season_artifacts",
  "player_forecast_season_roster_snapshots",
  "player_forecast_season_roster_members",
  "player_forecast_season_roster_observations",
  "player_forecast_season_roster_conflicts",
  "player_forecast_season_roster_conflict_members",
  "player_forecast_season_roster_conflict_resolutions",
  "player_forecast_season_player_pool_review",
  "player_forecast_season_schedule_snapshots",
  "player_forecast_season_schedule_games",
  "player_forecast_season_deployment_snapshots",
  "player_forecast_season_deployment_assignments",
  "player_forecast_season_runs",
  "player_forecast_season_game_outputs",
  "player_forecast_season_player_aggregates",
  "player_forecast_season_team_aggregates",
  "player_forecast_season_overrides",
  "player_forecast_season_completeness_waivers",
  "player_forecast_season_releases",
  "player_forecast_season_release_players",
  "player_forecast_season_release_teams",
  "player_forecast_season_active_releases",
  "player_forecast_season_release_events",
  "player_forecast_season_outcome_revisions",
  "player_forecast_season_evaluation_revisions",
  "player_forecast_season_queue",
] as const;

async function allRows(client: any, table: string, columns: string, configure: (query: any) => any) {
  const result: any[] = [];
  for (let start = 0; ; start += 1000) {
    const { data, error } = await configure(
      client.from(table).select(columns).range(start, start + 999),
    );
    if (error) throw error;
    result.push(...(data ?? []));
    if ((data ?? []).length < 1000) return result;
  }
}

async function allRpcRows(client: any, functionName: string, parameters: Record<string, unknown>) {
  const rows: any[] = [];
  for (let start = 0; ; start += 1000) {
    const { data, error } = await client
      .rpc(functionName, parameters)
      .range(start, start + 999);
    if (error) throw error;
    rows.push(...(data ?? []));
    if ((data ?? []).length < 1000) return rows;
  }
}

export async function collectSeasonProjectionReadiness(args: {
  supabase: SupabaseClient<any>;
  environment?: Record<string, string | undefined>;
}) {
  const client = args.supabase as any;
  const environment = args.environment ?? process.env;
  const tableChecks = await Promise.all(
    TABLES.map(async (table) => {
      const { error } = await client.from(table).select("*").limit(1);
      return { table, present: !error, errorCode: error?.code ?? null };
    }),
  );
  const missingTables = tableChecks.filter((check) => !check.present).map((check) => check.table);
  if (missingTables.length) {
    return {
      success: true as const,
      generatedAt: new Date().toISOString(),
      contract: { version: FANTASY_PROJECTION_V5_CONTRACT_VERSION, checksum: FANTASY_PROJECTION_V5_CONTRACT_CHECKSUM },
      database: { requiredTables: TABLES.length, missingTables },
      readyForLocalDraft: false,
      readyForPublication: false,
    };
  }

  const [
    scheduleSnapshots,
    runs,
    releases,
    queueRows,
    reviewRows,
    artifactRows,
    bucketResult,
    outcomeRows,
    evaluationRows,
    rosterSnapshots,
    rosterObservations,
    rosterConflicts,
  ] = await Promise.all([
    client.from("player_forecast_season_schedule_snapshots").select("id,revision_hash,available_at").eq("season_id", FANTASY_PROJECTION_SEASON_ID).order("available_at", { ascending: false }).limit(1),
    client.from("player_forecast_season_runs").select("id,view_key,status,cutoff_at,hold_reason_code,validation_receipt,created_at").eq("season_id", FANTASY_PROJECTION_SEASON_ID).order("created_at", { ascending: false }).limit(10),
    client.from("player_forecast_season_releases").select("id,view_key,release_number,issued_at,release_hash,metric_set_version,roster_observed_at,transaction_cutoff_at,health_status,health_summary").eq("season_id", FANTASY_PROJECTION_SEASON_ID).order("issued_at", { ascending: false }).limit(10),
    allRows(client, "player_forecast_season_queue", "status,lease_expires_at,not_before", (query) => query.eq("season_id", FANTASY_PROJECTION_SEASON_ID)),
    allRows(client, "player_forecast_season_player_pool_review", "id,resolution_status,supersedes_id", (query) => query.eq("season_id", FANTASY_PROJECTION_SEASON_ID)),
    client.from("player_forecast_season_artifacts").select("id,artifact_version,artifact_checksum,contract_version,contract_checksum,lifecycle_status,golden_vectors,created_at").eq("season_id", FANTASY_PROJECTION_SEASON_ID).order("created_at", { ascending: false }).limit(1),
    client.storage.getBucket("player-forecast-artifacts"),
    allRows(client, "player_forecast_season_outcome_revisions", "schedule_game_id,finality,available_at", (query) => query.eq("season_id", FANTASY_PROJECTION_SEASON_ID)),
    client.from("player_forecast_season_evaluation_revisions").select("evaluated_at,finality").order("evaluated_at", { ascending: false }).limit(1),
    client.from("player_forecast_season_roster_snapshots").select("id,observed_at,available_at,completeness,revision_hash,metadata").eq("season_id", FANTASY_PROJECTION_SEASON_ID).order("available_at", { ascending: false }).limit(1),
    allRpcRows(client, "latest_player_forecast_season_roster_observations", { p_season_id: FANTASY_PROJECTION_SEASON_ID }),
    client.from("player_forecast_season_roster_conflicts").select("id,fhfh_player_id,nhl_player_id,supersedes_id").eq("season_id", FANTASY_PROJECTION_SEASON_ID).order("detected_at", { ascending: false }).limit(2000),
  ]);
  for (const result of [scheduleSnapshots, runs, releases, artifactRows, evaluationRows, rosterSnapshots, rosterConflicts]) {
    if (result.error) throw result.error;
  }
  const scheduleSnapshot = scheduleSnapshots.data?.[0] ?? null;
  const scheduleGames = scheduleSnapshot
    ? await allRows(
        client,
        "player_forecast_season_schedule_games",
        "id,game_id,home_team_id,away_team_id,game_type,game_status",
        (query) => query.eq("snapshot_id", scheduleSnapshot.id).eq("game_type", 2),
      )
    : [];
  const gamesPerTeam = new Map<number, number>();
  for (const game of scheduleGames) {
    for (const teamId of [Number(game.home_team_id), Number(game.away_team_id)]) {
      gamesPerTeam.set(teamId, (gamesPerTeam.get(teamId) ?? 0) + 1);
    }
  }
  const superseded = new Set(reviewRows.map((row: any) => row.supersedes_id).filter(Boolean));
  const pendingReviews = reviewRows.filter(
    (row: any) => !superseded.has(row.id) && row.resolution_status === "pending",
  ).length;
  const queue = { pending: 0, running: 0, succeeded: 0, failed: 0, cancelled: 0, expiredLeases: 0 };
  const now = Date.now();
  for (const row of queueRows) {
    if (row.status in queue) queue[row.status as "pending"] += 1;
    if (row.status === "running" && Date.parse(row.lease_expires_at ?? "") <= now) queue.expiredLeases += 1;
  }
  const scheduleValid =
    scheduleGames.length === 1344 &&
    gamesPerTeam.size === 32 &&
    [...gamesPerTeam.values()].every((games) => games === 84);
  const latestArtifact = artifactRows.data?.[0] ?? null;
  const goldenVectorCount = Array.isArray(latestArtifact?.golden_vectors)
    ? latestArtifact.golden_vectors.length
    : 0;
  const queueHealthy = queue.pending + queue.running + queue.failed + queue.expiredLeases === 0;
  const latestValidated = (runs.data ?? []).find((run: any) => run.status === "validated") ?? null;
  const completedGames = scheduleGames.filter((game) => game.game_status === "final");
  const settledGameIds = new Set(outcomeRows.map((row: any) => row.schedule_game_id));
  const unsettledCompletedGames = completedGames.filter((game) => !settledGameIds.has(game.id)).length;
  const latestOutcomeAvailableAt = outcomeRows.reduce<string | null>(
    (latest, row: any) => !latest || row.available_at > latest ? row.available_at : latest,
    null,
  );
  const settlement = {
    completedGames: completedGames.length,
    unsettledCompletedGames,
    outcomeRevisions: outcomeRows.length,
    provisional: outcomeRows.filter((row: any) => row.finality === "provisional").length,
    corrected: outcomeRows.filter((row: any) => row.finality === "corrected").length,
    final: outcomeRows.filter((row: any) => row.finality === "final").length,
    latestOutcomeAvailableAt,
    latestEvaluationAt: evaluationRows.data?.[0]?.evaluated_at ?? null,
    healthy: unsettledCompletedGames === 0,
  };
  const latestRosterSnapshot = rosterSnapshots.data?.[0] ?? null;
  const currentRosterObservations = rosterObservations;
  const rosterFreshAt = currentRosterObservations.reduce(
    (latest: string | null, row: any) =>
      !latest || String(row.available_at) > latest ? String(row.available_at) : latest,
    null,
  );
  const transactionCutoffAt = currentRosterObservations
    .filter((row: any) => ["official_transaction", "trusted_ifttt"].includes(row.observation_kind))
    .reduce(
      (latest: string | null, row: any) =>
        !latest || String(row.available_at) > latest ? String(row.available_at) : latest,
      null,
    );
  const supersededConflicts = new Set(
    (rosterConflicts.data ?? []).map((row: any) => row.supersedes_id).filter(Boolean),
  );
  const conflictIds = (rosterConflicts.data ?? []).map((row: any) => String(row.id));
  const [conflictMembers, conflictResolutions] = conflictIds.length
    ? await Promise.all([
        allRows(
          client,
          "player_forecast_season_roster_conflict_members",
          "conflict_id,observation_id",
          (query) => query.in("conflict_id", conflictIds),
        ),
        allRows(
          client,
          "player_forecast_season_roster_conflict_resolutions",
          "id,conflict_id,supersedes_id",
          (query) => query.in("conflict_id", conflictIds),
        ),
      ])
    : [[], []];
  const conflictObservationIds = Array.from(
    new Set(conflictMembers.map((row: any) => String(row.observation_id))),
  );
  const conflictObservations = conflictObservationIds.length
    ? await allRows(
        client,
        "player_forecast_season_roster_observations",
        "id,confidence",
        (query) => query.in("id", conflictObservationIds),
      )
    : [];
  const confidenceByObservation = new Map(
    conflictObservations.map((row: any) => [String(row.id), Number(row.confidence)]),
  );
  const activeConflictResolutionIds = new Set(
    conflictResolutions.map((row: any) => row.supersedes_id).filter(Boolean).map(String),
  );
  const resolvedConflictIds = new Set(
    conflictResolutions
      .filter((row: any) => !activeConflictResolutionIds.has(String(row.id)))
      .map((row: any) => String(row.conflict_id)),
  );
  const openRosterConflicts = (rosterConflicts.data ?? []).filter(
    (row: any) =>
      !supersededConflicts.has(row.id) &&
      !resolvedConflictIds.has(String(row.id)),
  );
  const highConfidenceRosterConflicts = openRosterConflicts.filter((row: any) =>
    conflictMembers.some(
      (member: any) =>
        String(member.conflict_id) === String(row.id) &&
        (confidenceByObservation.get(String(member.observation_id)) ?? 0) >= 0.9,
    ),
  );
  const rosterObservationsByPlayer = new Map<number, Map<string, any>>();
  for (const row of currentRosterObservations) {
    if (row.fhfh_player_id == null) continue;
    const byKind = rosterObservationsByPlayer.get(Number(row.fhfh_player_id)) ?? new Map();
    byKind.set(String(row.observation_kind), row);
    rosterObservationsByPlayer.set(Number(row.fhfh_player_id), byKind);
  }
  const rosterMembers = latestRosterSnapshot
    ? await allRows(
        client,
        "player_forecast_season_roster_members",
        "fhfh_player_id,team_id,roster_status",
        (query) => query.eq("snapshot_id", latestRosterSnapshot.id),
      )
    : [];
  const rosterMemberByPlayer = new Map(
    rosterMembers.map((row: any) => [Number(row.fhfh_player_id), row]),
  );
  let resolvedAssignmentMismatches = 0;
  for (const [playerId, byKind] of rosterObservationsByPlayer) {
    const roster = byKind.get("official_roster");
    const landing = byKind.get("player_landing");
    if (
      roster?.organization_team_id != null &&
      Number(roster.organization_team_id) === Number(landing?.organization_team_id) &&
      Number(rosterMemberByPlayer.get(playerId)?.team_id) !== Number(roster.organization_team_id)
    ) {
      resolvedAssignmentMismatches += 1;
    }
  }
  const rosterStale = !rosterFreshAt || Date.now() - Date.parse(rosterFreshAt) > 36 * 60 * 60 * 1000;
  const snapshotTransactionCoverage =
    latestRosterSnapshot?.metadata?.transactionCoverage &&
    typeof latestRosterSnapshot.metadata.transactionCoverage === "object"
      ? latestRosterSnapshot.metadata.transactionCoverage
      : {};
  const transactionCoverage = {
    windowStart: snapshotTransactionCoverage.windowStart ?? "2026-06-16T00:00:00Z",
    cutoffAt: snapshotTransactionCoverage.cutoffAt ?? transactionCutoffAt,
    normalizedObservations: Math.max(
      Number(snapshotTransactionCoverage.normalizedObservations ?? 0),
      currentRosterObservations.filter((row: any) =>
        ["official_transaction", "trusted_ifttt"].includes(row.observation_kind),
      ).length,
    ),
    officialObservations: Math.max(
      Number(snapshotTransactionCoverage.officialObservations ?? 0),
      currentRosterObservations.filter(
        (row: any) => row.observation_kind === "official_transaction",
      ).length,
    ),
    complete: snapshotTransactionCoverage.complete === true,
    status: String(snapshotTransactionCoverage.status ?? "missing"),
    holdReason:
      snapshotTransactionCoverage.complete === true
        ? null
        : snapshotTransactionCoverage.holdReason ??
          "A complete official transaction audit has not been imported.",
    stale:
      !String(snapshotTransactionCoverage.cutoffAt ?? transactionCutoffAt ?? "") ||
      Date.now() - Date.parse(
        String(snapshotTransactionCoverage.cutoffAt ?? transactionCutoffAt),
      ) > 36 * 60 * 60 * 1000,
  };
  const rosterIntegrity = {
    latestSnapshot: latestRosterSnapshot,
    rosterFreshAt,
    transactionCutoffAt,
    sourceKinds: Array.from(
      new Set(currentRosterObservations.map((row: any) => String(row.observation_kind))),
    ).sort(),
    transactionCoverage,
    observationCount: currentRosterObservations.length,
    openConflicts: openRosterConflicts.length,
    highConfidenceOpenConflicts: highConfidenceRosterConflicts.length,
    resolvedAssignmentMismatches,
    stale: rosterStale,
    healthy:
      Boolean(latestRosterSnapshot) &&
      !rosterStale &&
      transactionCoverage.complete &&
      !transactionCoverage.stale &&
      highConfidenceRosterConflicts.length === 0 &&
      resolvedAssignmentMismatches === 0,
  };
  return {
    success: true as const,
    generatedAt: new Date().toISOString(),
    contract: {
      version: FANTASY_PROJECTION_V5_CONTRACT_VERSION,
      checksum: FANTASY_PROJECTION_V5_CONTRACT_CHECKSUM,
      predecessorVersion: FANTASY_PROJECTION_V4_CONTRACT_VERSION,
      predecessorChecksum: FANTASY_PROJECTION_V4_CONTRACT_CHECKSUM,
      legacyVersion: FANTASY_PROJECTION_CONTRACT_VERSION,
      legacyChecksum: FANTASY_PROJECTION_CONTRACT_CHECKSUM,
    },
    environment: {
      supabaseUrl: Boolean(environment.NEXT_PUBLIC_SUPABASE_URL?.trim()),
      serviceRole: Boolean(environment.SUPABASE_SERVICE_ROLE_KEY?.trim()),
      cronSecret: Boolean(environment.CRON_SECRET?.trim()),
      soleEditorConfigured: (environment.PLAYER_FORECAST_EDITOR_USER_IDS ?? "").split(",").filter(Boolean).length === 1,
      hostedInferenceEnabled: environment.PLAYER_FORECAST_SEASON_INFERENCE_ENABLED === "true",
      rosterRefreshEnabled: environment.PLAYER_FORECAST_ROSTER_REFRESH_ENABLED === "true",
    },
    database: { requiredTables: TABLES.length, missingTables },
    schedule: { games: scheduleGames.length, teams: gamesPerTeam.size, gamesPerTeam: Object.fromEntries(gamesPerTeam), valid: scheduleValid },
    playerPool: { pendingIdentityReviews: pendingReviews },
    rosterIntegrity,
    artifact: {
      registered: Boolean(latestArtifact),
      version: latestArtifact?.artifact_version ?? null,
      checksum: latestArtifact?.artifact_checksum ?? null,
      goldenVectorCount,
      storageExists: Boolean(bucketResult.data),
      storagePrivate: Boolean(bucketResult.data && !bucketResult.data.public),
    },
    queue: { ...queue, healthy: queueHealthy },
    settlement,
    latestValidatedRun: latestValidated,
    releases: releases.data ?? [],
    readyForLocalDraft:
      scheduleValid &&
      Boolean(latestArtifact) &&
      goldenVectorCount >= (latestArtifact?.contract_version === FANTASY_PROJECTION_V5_CONTRACT_VERSION ? 1 : 3) &&
      rosterIntegrity.resolvedAssignmentMismatches === 0,
    readyForPublication:
      scheduleValid &&
      pendingReviews === 0 &&
      rosterIntegrity.healthy &&
      queueHealthy &&
      settlement.healthy &&
      Boolean(latestValidated) &&
      Boolean(bucketResult.data && !bucketResult.data.public),
  };
}
