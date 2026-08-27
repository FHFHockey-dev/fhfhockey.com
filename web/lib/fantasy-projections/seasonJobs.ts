import { createHash, randomUUID } from "crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

import { publishSeasonRunAsSystem, validateSeasonRun } from "./admin";
import {
  FANTASY_PROJECTION_SEASON_ID,
  FANTASY_PROJECTION_V4_CONTRACT_VERSION,
  FANTASY_PROJECTION_V5_CONTRACT_VERSION,
  GOALIE_FANTASY_V4_PRIMITIVE_TARGETS,
  GOALIE_PRIMITIVE_TARGETS,
  reconcileProjectionQuantiles,
  reconcileProjectionValues,
  SKATER_FANTASY_V4_PRIMITIVE_TARGETS,
  SKATER_PRIMITIVE_TARGETS,
  type FantasyProjectionPopulation,
  type ProjectionValues,
} from "./contracts";
import {
  aggregateSeasonGames,
  checksumCanonicalJson,
  emptySeasonAggregate,
  evaluatePortableSeasonGame,
  mergeAdvancedSeasonArtifact,
  verifyPortableSeasonArtifact,
  type AdvancedSeasonArtifact,
  type PortablePlayerPrior,
  type PortableSeasonArtifact,
  type SeasonGameContext,
} from "./evaluator";

type QueueJob = {
  id: string;
  season_id: number;
  view_key: "current" | "ros";
  team_id: number | null;
  opponent_team_id: number | null;
  fhfh_player_id: number | null;
  reasons: string[];
  claimed_watermark: string;
  metadata: Record<string, unknown> | null;
};

type DrainResult = {
  view: "current" | "ros";
  jobIds: string[];
  runId: string | null;
  affectedPlayers: number;
  affectedTeams: number;
  published: boolean;
  heldReasons: string[];
  errorCode?: string;
};

function errorCode(error: unknown): string {
  const value = error as { code?: unknown; message?: unknown } | null;
  const raw =
    (typeof value?.code === "string" && value.code) ||
    (typeof value?.message === "string" && value.message) ||
    "PLAYER_FORECAST_SEASON_EVENT_FAILED";
  return raw.replace(/[^A-Za-z0-9_:-]/g, "_").slice(0, 120);
}

function errorSummary(error: unknown): string {
  const value = error as { message?: unknown } | null;
  return (typeof value?.message === "string" ? value.message : "Season event processing failed.")
    .replace(/[\r\n]+/g, " ")
    .slice(0, 900);
}

async function selectAll(
  client: any,
  table: string,
  columns: string,
  configure: (query: any) => any,
): Promise<any[]> {
  const rows: any[] = [];
  for (let start = 0; ; start += 1000) {
    const { data, error } = await configure(
      client.from(table).select(columns).range(start, start + 999),
    );
    if (error) throw error;
    rows.push(...(data ?? []));
    if ((data ?? []).length < 1000) return rows;
  }
}

async function insertChunks(client: any, table: string, rows: any[]): Promise<void> {
  for (let start = 0; start < rows.length; start += 400) {
    const { error } = await client.from(table).insert(rows.slice(start, start + 400));
    if (error) throw error;
  }
}

function round(value: number): number {
  return Number(value.toFixed(10));
}

function nestedRecordValue(
  source: Record<string, unknown>,
  path: string[],
  value: unknown,
): Record<string, unknown> {
  const result = structuredClone(source);
  let cursor = result;
  for (const segment of path.slice(0, -1)) {
    const child = cursor[segment];
    cursor[segment] =
      child && typeof child === "object" && !Array.isArray(child)
        ? structuredClone(child as Record<string, unknown>)
        : {};
    cursor = cursor[segment] as Record<string, unknown>;
  }
  cursor[path[path.length - 1]] = value;
  return result;
}

export function applyPersistentPlayerAssumptions(
  prior: PortablePlayerPrior,
  overrides: Array<{ field_path: string; override_value: unknown }>,
): PortablePlayerPrior {
  let result: PortablePlayerPrior = {
    ...prior,
    ratings: { ...prior.ratings },
    deployment: structuredClone(prior.deployment),
  };
  for (const assumption of overrides) {
    const fieldPath = String(assumption.field_path);
    const value = assumption.override_value;
    if (fieldPath === "player.teamId") {
      result = { ...result, teamId: Number(value) };
    } else if (fieldPath === "player.position") {
      const position = String(value) as PortablePlayerPrior["position"];
      if ((position === "G") !== (result.population === "goalie")) {
        throw new Error("PLAYER_FORECAST_SEASON_POSITION_POPULATION_MISMATCH");
      }
      result = { ...result, position };
    } else if (fieldPath === "player.poolStatus") {
      result = { ...result, poolStatus: String(value) };
    } else if (fieldPath.startsWith("ratings.")) {
      result = {
        ...result,
        ratings: nestedRecordValue(
          result.ratings,
          fieldPath.split(".").slice(1),
          Number(value),
        ) as Record<string, number>,
      };
    } else if (fieldPath.startsWith("deployment.")) {
      result = {
        ...result,
        deployment: nestedRecordValue(
          result.deployment,
          fieldPath.split(".").slice(1),
          value,
        ),
      };
    }
  }
  return result;
}

function scheduleContextsByTeam(scheduleGames: any[]): Map<number, SeasonGameContext[]> {
  const byTeam = new Map<number, SeasonGameContext[]>();
  const ordered = [...scheduleGames]
    .filter((game) => String(game.game_status ?? "") !== "cancelled")
    .sort((left, right) => {
      const timeDifference =
        new Date(left.scheduled_start_at).getTime() -
        new Date(right.scheduled_start_at).getTime();
      return timeDifference || Number(left.game_id) - Number(right.game_id);
    });
  for (const game of ordered) {
    for (const [teamId, opponentTeamId, isHome] of [
      [Number(game.home_team_id), Number(game.away_team_id), true],
      [Number(game.away_team_id), Number(game.home_team_id), false],
    ] as const) {
      const games = byTeam.get(teamId) ?? [];
      const currentDay = Math.floor(
        new Date(game.scheduled_start_at).getTime() / 86_400_000,
      );
      const previousDay = games.length
        ? Math.floor(new Date(games[games.length - 1].scheduledStartAt).getTime() / 86_400_000)
        : null;
      const restDays = previousDay == null ? null : Math.max(0, currentDay - previousDay);
      games.push({
        gameId: Number(game.game_id),
        scheduledStartAt: String(game.scheduled_start_at),
        teamId,
        opponentTeamId,
        isHome,
        restDays,
        isBackToBack: restDays === 1,
      });
      byTeam.set(teamId, games);
    }
  }
  return byTeam;
}

function addActuals(
  values: ProjectionValues,
  actuals: ProjectionValues,
  population: FantasyProjectionPopulation,
): ProjectionValues {
  return reconcileProjectionValues(
    Object.fromEntries(
      Object.entries(values).map(([target, value]) => [
        target,
        round(value + (actuals[target] ?? 0)),
      ]),
    ),
    population,
  );
}

function targetsFor(
  prior: PortablePlayerPrior,
  contractVersion: string,
): readonly string[] {
  if (prior.primitiveTargets?.length) return prior.primitiveTargets;
  const fantasyV4 = [
    FANTASY_PROJECTION_V4_CONTRACT_VERSION,
    FANTASY_PROJECTION_V5_CONTRACT_VERSION,
  ].includes(contractVersion);
  return prior.population === "goalie"
    ? [
        ...GOALIE_PRIMITIVE_TARGETS,
        ...(fantasyV4 ? GOALIE_FANTASY_V4_PRIMITIVE_TARGETS : []),
      ]
    : [
        ...SKATER_PRIMITIVE_TARGETS,
        ...(fantasyV4 ? SKATER_FANTASY_V4_PRIMITIVE_TARGETS : []),
      ];
}

function teamDeployment(players: PortablePlayerPrior[]): Record<string, unknown> {
  const byToi = (population: FantasyProjectionPopulation) =>
    players
      .filter((player) => player.population === population)
      .sort(
        (left, right) =>
          Number(right.conditionalRates.TOTAL_TOI ?? 0) -
          Number(left.conditionalRates.TOTAL_TOI ?? 0),
      );
  const forwards = byToi("forward");
  const defense = byToi("defense");
  const skaters = [...forwards, ...defense];
  const goalies = byToi("goalie").sort(
    (left, right) => Number(right.startProbability ?? 0) - Number(left.startProbability ?? 0),
  );
  return {
    forwardLines: [0, 3, 6, 9].map((start) =>
      forwards.slice(start, start + 3).map((player) => player.fhfhPlayerId),
    ),
    defensePairs: [0, 2, 4].map((start) =>
      defense.slice(start, start + 2).map((player) => player.fhfhPlayerId),
    ),
    powerPlayUnits: [0, 5].map((start) =>
      [...skaters]
        .sort(
          (left, right) =>
            Number(right.conditionalRates.PP_TOI ?? 0) -
            Number(left.conditionalRates.PP_TOI ?? 0),
        )
        .slice(start, start + 5)
        .map((player) => player.fhfhPlayerId),
    ),
    penaltyKillUnits: [0, 4].map((start) =>
      [...skaters]
        .sort(
          (left, right) =>
            Number(right.conditionalRates.PK_TOI ?? 0) -
            Number(left.conditionalRates.PK_TOI ?? 0),
        )
        .slice(start, start + 4)
        .map((player) => player.fhfhPlayerId),
    ),
    goalieOrder: goalies.slice(0, 3).map((player) => player.fhfhPlayerId),
  };
}

async function loadArtifact(
  client: any,
  run: any,
): Promise<PortableSeasonArtifact> {
  const { data: registry, error: registryError } = await client
    .from("player_forecast_season_artifacts")
    .select("artifact_checksum,artifact_path,contract_version,contract_checksum")
    .eq("id", run.artifact_id)
    .maybeSingle();
  if (registryError) throw registryError;
  if (!registry) throw new Error("PLAYER_FORECAST_SEASON_ARTIFACT_NOT_FOUND");
  const { data: blob, error: downloadError } = await client.storage
    .from("player-forecast-artifacts")
    .download(registry.artifact_path);
  if (downloadError) throw downloadError;
  const bytes = new Uint8Array(await blob.arrayBuffer());
  const checksum = createHash("sha256").update(bytes).digest("hex");
  if (checksum !== registry.artifact_checksum) {
    throw new Error("PLAYER_FORECAST_SEASON_ARTIFACT_CHECKSUM_MISMATCH");
  }
  const decoded = JSON.parse(new TextDecoder().decode(bytes)) as
    | PortableSeasonArtifact
    | AdvancedSeasonArtifact;
  let artifact: PortableSeasonArtifact;
  if (decoded.schemaVersion === "player-forecast-season-advanced-artifact-v1") {
    const advanced = decoded as AdvancedSeasonArtifact;
    const { data: baseRegistry, error: baseRegistryError } = await client
      .from("player_forecast_season_artifacts")
      .select("artifact_checksum,artifact_path")
      .eq("artifact_checksum", advanced.baseV4ArtifactChecksum)
      .limit(1)
      .maybeSingle();
    if (baseRegistryError) throw baseRegistryError;
    if (!baseRegistry) throw new Error("PLAYER_FORECAST_SEASON_BASE_ARTIFACT_NOT_FOUND");
    const { data: baseBlob, error: baseDownloadError } = await client.storage
      .from("player-forecast-artifacts")
      .download(baseRegistry.artifact_path);
    if (baseDownloadError) throw baseDownloadError;
    const baseBytes = new Uint8Array(await baseBlob.arrayBuffer());
    const baseChecksum = createHash("sha256").update(baseBytes).digest("hex");
    if (
      baseChecksum !== baseRegistry.artifact_checksum ||
      baseChecksum !== advanced.baseV4ArtifactChecksum
    ) {
      throw new Error("PLAYER_FORECAST_SEASON_BASE_ARTIFACT_CHECKSUM_MISMATCH");
    }
    const base = JSON.parse(new TextDecoder().decode(baseBytes)) as PortableSeasonArtifact;
    artifact = mergeAdvancedSeasonArtifact(base, advanced);
  } else {
    artifact = decoded as PortableSeasonArtifact;
  }
  verifyPortableSeasonArtifact(artifact);
  if (
    artifact.contractVersion !== run.contract_version ||
    artifact.contractChecksum !== run.contract_checksum ||
    registry.contract_version !== run.contract_version ||
    registry.contract_checksum !== run.contract_checksum
  ) {
    throw new Error("PLAYER_FORECAST_SEASON_RUNTIME_CONTRACT_MISMATCH");
  }
  return artifact;
}

async function activeActuals(
  client: any,
  playerIds: number[],
  cutoffAt: string,
): Promise<Map<number, ProjectionValues>> {
  if (playerIds.length === 0) return new Map();
  const rows = await selectAll(
    client,
    "player_forecast_season_outcome_revisions",
    "id,fhfh_player_id,primitive_values,supersedes_id,available_at",
    (query) =>
      query
        .eq("season_id", FANTASY_PROJECTION_SEASON_ID)
        .in("fhfh_player_id", playerIds)
        .lte("available_at", cutoffAt)
        .order("available_at", { ascending: true }),
  );
  const superseded = new Set(rows.map((row) => row.supersedes_id).filter(Boolean));
  const result = new Map<number, ProjectionValues>();
  for (const row of rows.filter((candidate) => !superseded.has(candidate.id))) {
    const playerId = Number(row.fhfh_player_id);
    const values = result.get(playerId) ?? {};
    for (const [target, raw] of Object.entries(row.primitive_values ?? {})) {
      const value = Number(raw);
      if (Number.isFinite(value)) values[target] = round((values[target] ?? 0) + value);
    }
    result.set(playerId, values);
  }
  return result;
}

async function finishJobs(
  client: any,
  jobs: QueueJob[],
  ownerToken: string,
  succeeded: boolean,
  error?: unknown,
): Promise<void> {
  for (const job of jobs) {
    const { error: finishError } = await client.rpc("finish_player_forecast_season_job", {
      p_job_id: job.id,
      p_owner_token: ownerToken,
      p_succeeded: succeeded,
      p_error_code: succeeded ? null : errorCode(error),
      p_error_summary: succeeded ? null : errorSummary(error),
    });
    if (finishError) throw finishError;
  }
}

async function processView(
  supabase: SupabaseClient<any>,
  jobs: QueueJob[],
  ownerToken: string,
  now: Date,
): Promise<DrainResult> {
  const client = supabase as any;
  const view = jobs[0].view_key;
  const jobIds = jobs.map((job) => job.id);
  let eventRunId: string | null = null;
  let jobsFinished = false;
  try {
    const cutoffAt = now.toISOString();
    const { data: activePointer, error: activePointerError } = await client
      .from("player_forecast_season_active_releases")
      .select("release_id")
      .eq("season_id", FANTASY_PROJECTION_SEASON_ID)
      .eq("view_key", view)
      .maybeSingle();
    if (activePointerError) throw activePointerError;
    if (!activePointer) throw new Error("PLAYER_FORECAST_SEASON_ACTIVE_RELEASE_NOT_FOUND");
    const { data: activeRelease, error: activeReleaseError } = await client
      .from("player_forecast_season_releases")
      .select("run_id")
      .eq("id", activePointer.release_id)
      .eq("season_id", FANTASY_PROJECTION_SEASON_ID)
      .eq("view_key", view)
      .maybeSingle();
    if (activeReleaseError) throw activeReleaseError;
    if (!activeRelease) throw new Error("PLAYER_FORECAST_SEASON_ACTIVE_RELEASE_INVALID");
    const { data: sourceRun, error: sourceRunError } = await client
      .from("player_forecast_season_runs")
      .select("*")
      .eq("id", activeRelease.run_id)
      .eq("status", "validated")
      .maybeSingle();
    if (sourceRunError) throw sourceRunError;
    if (!sourceRun) throw new Error("PLAYER_FORECAST_SEASON_VALIDATED_SOURCE_NOT_FOUND");

    const [rosterResult, scheduleResult] = await Promise.all([
      client
        .from("player_forecast_season_roster_snapshots")
        .select("*")
        .eq("season_id", FANTASY_PROJECTION_SEASON_ID)
        .lte("available_at", cutoffAt)
        .order("available_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      client
        .from("player_forecast_season_schedule_snapshots")
        .select("*")
        .eq("season_id", FANTASY_PROJECTION_SEASON_ID)
        .lte("available_at", cutoffAt)
        .order("available_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);
    if (rosterResult.error) throw rosterResult.error;
    if (scheduleResult.error) throw scheduleResult.error;
    if (!rosterResult.data || !scheduleResult.data) {
      throw new Error("PLAYER_FORECAST_SEASON_CURRENT_SNAPSHOTS_NOT_FOUND");
    }
    const rosterSnapshot = rosterResult.data;
    const scheduleSnapshot = scheduleResult.data;
    const [rosterMembers, scheduleGames, sourcePlayers, sourceTeams, artifact] =
      await Promise.all([
        selectAll(client, "player_forecast_season_roster_members", "*", (query) =>
          query.eq("snapshot_id", rosterSnapshot.id).order("fhfh_player_id"),
        ),
        selectAll(client, "player_forecast_season_schedule_games", "*", (query) =>
          query.eq("snapshot_id", scheduleSnapshot.id).order("scheduled_start_at"),
        ),
        selectAll(client, "player_forecast_season_player_aggregates", "*", (query) =>
          query.eq("run_id", sourceRun.id).order("fhfh_player_id"),
        ),
        selectAll(client, "player_forecast_season_team_aggregates", "*", (query) =>
          query.eq("run_id", sourceRun.id).order("team_id"),
        ),
        loadArtifact(client, sourceRun),
      ]);

    const rosterByPlayer = new Map(
      rosterMembers.map((row) => [Number(row.fhfh_player_id), row]),
    );
    const sourceByPlayer = new Map(
      sourcePlayers.map((row) => [Number(row.fhfh_player_id), row]),
    );
    const teamIds = new Set<number>();
    const affectedPlayerIds = new Set<number>();
    const allLeague = jobs.some(
      (job) => job.metadata?.allLeague === true || job.reasons.includes("daily_refresh"),
    );
    for (const job of jobs) {
      if (job.team_id != null) teamIds.add(Number(job.team_id));
      if (job.opponent_team_id != null) teamIds.add(Number(job.opponent_team_id));
      if (job.fhfh_player_id != null) {
        const playerId = Number(job.fhfh_player_id);
        affectedPlayerIds.add(playerId);
        const currentTeam = rosterByPlayer.get(playerId)?.team_id;
        const priorTeam = sourceByPlayer.get(playerId)?.team_id;
        if (currentTeam != null) teamIds.add(Number(currentTeam));
        if (priorTeam != null) teamIds.add(Number(priorTeam));
      }
    }
    if (allLeague) {
      for (const game of scheduleGames) {
        teamIds.add(Number(game.home_team_id));
        teamIds.add(Number(game.away_team_id));
      }
    }
    const sourceCutoff = new Date(sourceRun.cutoff_at).getTime();
    const cutoff = now.getTime();
    for (const game of scheduleGames) {
      const startsAt = new Date(game.scheduled_start_at).getTime();
      if (startsAt > sourceCutoff && startsAt <= cutoff) {
        teamIds.add(Number(game.home_team_id));
        teamIds.add(Number(game.away_team_id));
      }
    }
    const playerTeamIds = new Set(teamIds);
    const aggregateTeamIds = new Set(teamIds);
    for (const game of scheduleGames) {
      if (new Date(game.scheduled_start_at).getTime() <= cutoff) continue;
      if (playerTeamIds.has(Number(game.home_team_id))) {
        aggregateTeamIds.add(Number(game.away_team_id));
      }
      if (playerTeamIds.has(Number(game.away_team_id))) {
        aggregateTeamIds.add(Number(game.home_team_id));
      }
    }
    for (const row of rosterMembers) {
      if (row.team_id != null && playerTeamIds.has(Number(row.team_id))) {
        affectedPlayerIds.add(Number(row.fhfh_player_id));
      }
    }
    for (const row of sourcePlayers) {
      if (row.team_id != null && playerTeamIds.has(Number(row.team_id))) {
        affectedPlayerIds.add(Number(row.fhfh_player_id));
      }
    }

    const highWatermark = jobs
      .map((job) => job.claimed_watermark)
      .concat(String(sourceRun.source_high_watermark))
      .sort()
      .at(-1) as string;
    const idempotencyKey = `event:${checksumCanonicalJson({
      sourceRunId: sourceRun.id,
      rosterSnapshotId: rosterSnapshot.id,
      scheduleSnapshotId: scheduleSnapshot.id,
      cutoffAt,
      jobs: jobs.map((job) => ({ id: job.id, watermark: job.claimed_watermark })).sort((a, b) =>
        a.id.localeCompare(b.id),
      ),
    })}`;
    const affectedPlayers = [...affectedPlayerIds].sort((left, right) => left - right);
    const affectedTeams = [...aggregateTeamIds].sort((left, right) => left - right);
    const overrideIds = Array.from(new Set(
      jobs
        .map((job) => job.metadata?.overrideId)
        .filter((value): value is string => typeof value === "string" && value.length > 0),
    ));
    let overrideSourceRunIds: string[] = [];
    if (overrideIds.length > 0) {
      const { data: overrideRows, error: overrideRowsError } = await client
        .from("player_forecast_season_overrides")
        .select("id,run_id")
        .in("id", overrideIds);
      if (overrideRowsError) throw overrideRowsError;
      overrideSourceRunIds = Array.from(new Set(
        (overrideRows ?? []).map((row: any) => String(row.run_id)),
      ));
    }
    const { data: eventRunRaw, error: eventRunError } = await client.rpc(
      "create_player_forecast_season_event_run_with_assumptions",
      {
        p_source_run_id: sourceRun.id,
        p_roster_snapshot_id: rosterSnapshot.id,
        p_schedule_snapshot_id: scheduleSnapshot.id,
        p_cutoff_at: cutoffAt,
        p_source_high_watermark: highWatermark,
        p_idempotency_key: idempotencyKey,
        p_affected_player_ids: affectedPlayers,
        p_affected_team_ids: affectedTeams,
        p_override_source_run_ids: overrideSourceRunIds,
      },
    );
    if (eventRunError) throw eventRunError;
    const eventRun = Array.isArray(eventRunRaw) ? eventRunRaw[0] : eventRunRaw;
    if (!eventRun?.id) throw new Error("PLAYER_FORECAST_SEASON_EVENT_RUN_CREATE_FAILED");
    eventRunId = String(eventRun.id);
    const { error: lineageError } = await client
      .from("player_forecast_season_runs")
      .update({ source_run_id: sourceRun.id })
      .eq("id", eventRunId)
      .is("source_run_id", null);
    if (lineageError) throw lineageError;

    const eventOverrides = await selectAll(
      client,
      "player_forecast_season_overrides",
      "field_path,override_value,scope_type,fhfh_player_id",
      (query) => query.eq("run_id", eventRunId).order("created_at"),
    );
    const playerAssumptions = new Map<number, any[]>();
    for (const assumption of eventOverrides) {
      if (assumption.scope_type !== "player") continue;
      const playerId = Number(assumption.fhfh_player_id);
      playerAssumptions.set(playerId, [
        ...(playerAssumptions.get(playerId) ?? []),
        assumption,
      ]);
    }

    const currentPlayers: Record<string, PortablePlayerPrior> = {};
    for (const [playerKey, sourcePrior] of Object.entries(artifact.players)) {
      const member = rosterByPlayer.get(Number(playerKey));
      const rosterAdjustedPrior: PortablePlayerPrior = {
        ...sourcePrior,
        teamId: member ? (member.team_id == null ? null : Number(member.team_id)) : sourcePrior.teamId,
        position: member?.position ?? sourcePrior.position,
        poolStatus: member?.pool_status ?? sourcePrior.poolStatus,
        rosterStatus: member?.roster_status ?? sourcePrior.rosterStatus,
        rosterConfidence:
          member?.roster_confidence == null
            ? sourcePrior.rosterConfidence
            : Number(member.roster_confidence),
      };
      currentPlayers[playerKey] = applyPersistentPlayerAssumptions(
        rosterAdjustedPrior,
        playerAssumptions.get(Number(playerKey)) ?? [],
      );
    }
    const runtimeArtifact: PortableSeasonArtifact = { ...artifact, players: currentPlayers };
    const actuals =
      view === "current"
        ? await activeActuals(client, affectedPlayers, cutoffAt)
        : new Map<number, ProjectionValues>();
    const scheduleIdByGame = new Map(
      scheduleGames.map((game) => [Number(game.game_id), String(game.id)]),
    );
    const scheduleStatusByGame = new Map(
      scheduleGames.map((game) => [Number(game.game_id), String(game.game_status)]),
    );
    const scheduleContexts = scheduleContextsByTeam(scheduleGames);
    const gameOutputRows: any[] = [];
    const aggregateRows: any[] = [];
    for (const playerId of affectedPlayers) {
      const prior = runtimeArtifact.players[String(playerId)];
      const source = sourceByPlayer.get(playerId);
      if (!prior || !source) {
        throw new Error(`PLAYER_FORECAST_SEASON_PLAYER_PRIOR_NOT_FOUND:${playerId}`);
      }
      const member = rosterByPlayer.get(playerId);
      const teamId = prior.teamId;
      const poolStatus = String(member?.pool_status ?? source.pool_status);
      const remainingGames =
        teamId == null || poolStatus === "excluded"
          ? []
          : (scheduleContexts.get(teamId) ?? []).filter(
              (game) =>
                new Date(game.scheduledStartAt).getTime() > cutoff &&
                !["cancelled", "started", "final"].includes(
                  scheduleStatusByGame.get(game.gameId) ?? "",
                ),
            );
      const evaluations = remainingGames.map((game) =>
        evaluatePortableSeasonGame(runtimeArtifact, playerId, game),
      );
      for (const output of evaluations) {
        gameOutputRows.push({
          run_id: eventRunId,
          schedule_game_id: scheduleIdByGame.get(output.gameId),
          fhfh_player_id: output.fhfhPlayerId,
          team_id: output.teamId,
          opponent_team_id: output.opponentTeamId,
          population: output.population,
          playing_probability: output.playingProbability,
          start_probability: output.startProbability,
          conditional_means: output.conditionalMeans,
          unconditional_means: output.unconditionalMeans,
          baseline_unconditional_means: output.baselineUnconditionalMeans,
          variances: output.variances,
          quantiles: output.quantiles,
          deployment: output.deployment,
          fallback_flags: output.fallbackFlags,
          component_hash: output.componentHash,
        });
      }
      const aggregate = evaluations.length
        ? aggregateSeasonGames(evaluations)
        : emptySeasonAggregate(
            prior.population,
            targetsFor(prior, runtimeArtifact.contractVersion),
          );
      const playerActuals = actuals.get(playerId) ?? {};
      const means =
        view === "current"
          ? addActuals(aggregate.means, playerActuals, prior.population)
          : aggregate.means;
      const rawQuantiles = Object.fromEntries(
        Object.entries(aggregate.quantiles).map(([key, values]) => [
          key,
          view === "current"
            ? addActuals(values, playerActuals, prior.population)
            : values,
        ]),
      ) as typeof aggregate.quantiles;
      const quantiles = reconcileProjectionQuantiles(rawQuantiles, prior.population);
      const fallbackFlags = new Set<string>([
        ...(source.fallback_flags ?? []),
        ...(prior.fallbackFlags ?? []),
        "incremental_event_recompute",
      ]);
      if (Number(source.team_id) !== teamId) fallbackFlags.add("roster_changed");
      aggregateRows.push({
        run_id: eventRunId,
        fhfh_player_id: playerId,
        team_id: teamId,
        player_name: source.player_name,
        position: prior.position,
        population: prior.population,
        pool_status: poolStatus,
        roster_status: member?.roster_status ?? source.roster_status ?? "unresolved",
        roster_confidence: Number(
          member?.roster_confidence ?? source.roster_confidence ?? prior.rosterConfidence ?? 0,
        ),
        source_fresh_at: member?.source_fresh_at ?? source.source_fresh_at,
        rookie_profile: prior.rookieProfile ?? source.rookie_profile ?? {},
        expected_games: means.GAMES_PLAYED ?? 0,
        expected_starts: prior.population === "goalie" ? means.GAMES_STARTED ?? 0 : null,
        expected_toi: {
          total: means.TOTAL_TOI ?? 0,
          evenStrength: means.EV_TOI ?? 0,
          powerPlay: means.PP_TOI ?? 0,
          penaltyKill: means.PK_TOI ?? 0,
        },
        ratings: source.ratings,
        deployment: prior.deployment,
        model_means: means,
        p10: quantiles.p10,
        p50: quantiles.p50,
        p90: quantiles.p90,
        component_manifest: aggregate.componentManifest,
        fallback_flags: [...fallbackFlags].sort(),
        provenance: {
          ...(source.provenance ?? {}),
          source: "checksum_verified_typescript_event_evaluation",
          sourceRunId: sourceRun.id,
          rosterSnapshotId: rosterSnapshot.id,
          scheduleSnapshotId: scheduleSnapshot.id,
          cutoffAt,
        },
        aggregate_hash: aggregate.aggregateHash,
      });
    }
    await insertChunks(client, "player_forecast_season_game_outputs", gameOutputRows);
    await insertChunks(client, "player_forecast_season_player_aggregates", aggregateRows);

    const membersByTeam = new Map<number, PortablePlayerPrior[]>();
    for (const prior of Object.values(runtimeArtifact.players)) {
      if (prior.teamId == null || prior.poolStatus === "excluded") continue;
      membersByTeam.set(prior.teamId, [...(membersByTeam.get(prior.teamId) ?? []), prior]);
    }
    const sourceTeamById = new Map(sourceTeams.map((row) => [Number(row.team_id), row]));
    const teamRows = affectedTeams.map((teamId) => {
      const source = sourceTeamById.get(teamId);
      const context = runtimeArtifact.teams[String(teamId)];
      if (!source || !context) {
        throw new Error(`PLAYER_FORECAST_SEASON_TEAM_CONTEXT_NOT_FOUND:${teamId}`);
      }
      const members = membersByTeam.get(teamId) ?? [];
      const rosterCounts = {
        forwards: members.filter((player) => player.population === "forward").length,
        defensemen: members.filter((player) => player.population === "defense").length,
        goalies: members.filter((player) => player.population === "goalie").length,
      };
      const deployment = teamDeployment(members);
      const unsigned = {
        teamId,
        ratings: source.ratings,
        deployment,
        rosterCounts,
        modelMeans: source.model_means ?? {},
        p10: source.p10 ?? {},
        p50: source.p50 ?? {},
        p90: source.p90 ?? {},
        scheduleNeutralGoalDifferential: source.schedule_neutral_goal_differential,
      };
      return {
        run_id: eventRunId,
        team_id: teamId,
        team_name: source.team_name,
        abbreviation: source.abbreviation,
        ratings: source.ratings,
        deployment,
        roster_counts: rosterCounts,
        model_means: source.model_means ?? {},
        p10: source.p10 ?? {},
        p50: source.p50 ?? {},
        p90: source.p90 ?? {},
        schedule_neutral_goal_differential: source.schedule_neutral_goal_differential,
        confidence: source.confidence,
        provenance: {
          ...(source.provenance ?? {}),
          source: "checksum_verified_typescript_event_evaluation",
          rosterSnapshotId: rosterSnapshot.id,
          artifactVersion: runtimeArtifact.artifactVersion,
        },
        aggregate_hash: checksumCanonicalJson(unsigned),
      };
    });
    await insertChunks(client, "player_forecast_season_team_aggregates", teamRows);

    const validation = await validateSeasonRun(supabase, eventRunId, {
      ignoreQueueIds: jobIds,
    });
    if (!validation.valid) {
      throw new Error(`PLAYER_FORECAST_SEASON_EVENT_VALIDATION_FAILED:${validation.issues
        .map((issue) => issue.code)
        .join(",")}`);
    }
    await finishJobs(client, jobs, ownerToken, true);
    jobsFinished = true;
    const { count: dirtyCount, error: dirtyError } = await client
      .from("player_forecast_season_queue")
      .select("id", { count: "exact", head: true })
      .eq("season_id", FANTASY_PROJECTION_SEASON_ID)
      .eq("view_key", view)
      .in("status", ["pending", "running", "failed"]);
    if (dirtyError) throw dirtyError;
    const heldReasons: string[] = [];
    let published = false;
    if ((dirtyCount ?? 0) > 0) {
      heldReasons.push("dirty_queue");
    } else {
      try {
        await publishSeasonRunAsSystem({
          supabase,
          runId: eventRunId,
          label: `${view === "current" ? "Current" : "ROS"} ${cutoffAt.slice(0, 10)}`,
          reason: "Healthy checksum-verified incremental season update.",
        });
        published = true;
      } catch (publicationError) {
        heldReasons.push(errorCode(publicationError));
      }
    }
    return {
      view,
      jobIds,
      runId: eventRunId,
      affectedPlayers: affectedPlayers.length,
      affectedTeams: affectedTeams.length,
      published,
      heldReasons,
    };
  } catch (error) {
    if (eventRunId) {
      await client
        .from("player_forecast_season_runs")
        .update({
          status: "failed",
          hold_reason_code: errorCode(error),
          completed_at: new Date().toISOString(),
        })
        .eq("id", eventRunId)
        .eq("status", "draft");
    }
    if (!jobsFinished) {
      await finishJobs(client, jobs, ownerToken, false, error);
    }
    return {
      view,
      jobIds,
      runId: eventRunId,
      affectedPlayers: 0,
      affectedTeams: 0,
      published: false,
      heldReasons: ["event_processing_failed"],
      errorCode: errorCode(error),
    };
  }
}

export async function drainSeasonProjectionJobs(args: {
  supabase: SupabaseClient<any>;
  limit?: number;
  now?: Date;
}): Promise<{ claimed: number; results: DrainResult[] }> {
  const client = args.supabase as any;
  const ownerToken = randomUUID();
  const limit = Math.min(50, Math.max(1, Math.trunc(args.limit ?? 8)));
  const { data, error } = await client.rpc("claim_player_forecast_season_jobs", {
    p_owner_token: ownerToken,
    p_limit: limit,
    p_lease_seconds: 780,
  });
  if (error) throw error;
  const jobs = (data ?? []) as QueueJob[];
  const byView = new Map<"current" | "ros", QueueJob[]>();
  for (const job of jobs) {
    byView.set(job.view_key, [...(byView.get(job.view_key) ?? []), job]);
  }
  const results: DrainResult[] = [];
  for (const viewJobs of byView.values()) {
    results.push(
      await processView(args.supabase, viewJobs, ownerToken, args.now ?? new Date()),
    );
  }
  return { claimed: jobs.length, results };
}

export async function enqueueDailySeasonProjectionJobs(args: {
  supabase: SupabaseClient<any>;
  now?: Date;
}): Promise<{ queued: number; scopeKeys: string[] }> {
  const client = args.supabase as any;
  const now = args.now ?? new Date();
  const observedAt = now.toISOString();
  const date = observedAt.slice(0, 10);
  const scopeKeys: string[] = [];
  for (const view of ["current", "ros"] as const) {
    const scopeKey = `season:${FANTASY_PROJECTION_SEASON_ID}:view:${view}:daily:${date}`;
    const { error } = await client.rpc("enqueue_player_forecast_season_job", {
      p_scope_key: scopeKey,
      p_season_id: FANTASY_PROJECTION_SEASON_ID,
      p_view_key: view,
      p_team_id: null,
      p_opponent_team_id: null,
      p_fhfh_player_id: null,
      p_reason: "daily_refresh",
      p_source_high_watermark: observedAt,
      p_not_before: observedAt,
      p_metadata: { allLeague: true, source: "season_daily_coordinator" },
    });
    if (error) throw error;
    scopeKeys.push(scopeKey);
  }
  return { queued: scopeKeys.length, scopeKeys };
}
