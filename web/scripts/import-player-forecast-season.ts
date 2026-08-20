import { createHash, randomUUID } from "crypto";
import fs from "fs";
import path from "path";
import { spawnSync } from "child_process";
import dotenv from "dotenv";
import { Client } from "pg";

dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env.development.local" });

import {
  FANTASY_PROJECTION_SEASON_ID,
  FANTASY_PROJECTION_SUPPORTED_CONTRACTS,
} from "../lib/fantasy-projections/contracts";
import { getServiceRoleClient } from "../lib/supabase/server";

type ManifestFile = { path: string; rows: number; sha256: string };
type ImportManifest = {
  schemaVersion: string;
  seasonId: number;
  view: "opening" | "current" | "ros";
  createdAt: string;
  freezeCreatedAt: string;
  cutoffAt: string;
  sourceHighWatermark: string;
  contractVersion: string;
  contractChecksum: string;
  artifactPath: string;
  artifactChecksum: string;
  artifactVersion: string;
  featureSchemaVersion: string;
  trainingCutoffAt: string;
  codeVersion: string;
  scheduleRevisionHash: string;
  rosterRevisionHash: string;
  runHash: string;
  metricSetVersion?: string;
  rosterObservedAt?: string;
  transactionCutoffAt?: string;
  transactionCoverage?: Record<string, unknown>;
  healthStatus?: string;
  healthSummary?: Record<string, unknown>;
  files: Record<string, ManifestFile>;
  schedule: ManifestFile;
  playerPool: ManifestFile;
  playerPoolReview: ManifestFile;
  teams: ManifestFile;
  season: ManifestFile;
  deploymentTallies: ManifestFile;
  lineSnapshots: ManifestFile;
};

function argument(name: string): string {
  const prefix = `--${name}=`;
  const value = process.argv.find((item) => item.startsWith(prefix))?.slice(prefix.length);
  if (!value) throw new Error(`Pass ${prefix}/absolute/path.`);
  return path.resolve(value);
}

function sha256(filePath: string): string {
  return createHash("sha256").update(fs.readFileSync(filePath) as unknown as Uint8Array).digest("hex");
}

function json<T>(filePath: string): T {
  return JSON.parse(fs.readFileSync(filePath, "utf8")) as T;
}

function jsonLines<T>(filePath: string): T[] {
  return fs.readFileSync(filePath, "utf8").split("\n").filter(Boolean).map(
    (line) => JSON.parse(line) as T,
  );
}

function rows(filePath: string): AsyncIterable<any> {
  return {
    async *[Symbol.asyncIterator]() {
      const stream = fs.createReadStream(filePath, { encoding: "utf8" });
      let pending = "";
      for await (const chunk of stream) {
        pending += chunk;
        const lines = pending.split("\n");
        pending = lines.pop() ?? "";
        for (const line of lines) if (line.trim()) yield JSON.parse(line);
      }
      if (pending.trim()) yield JSON.parse(pending);
    },
  };
}

function assertLocalOnly(): void {
  if (process.env.PLAYER_FORECAST_SEASON_IMPORT_CONFIRM !== "local-only") {
    throw new Error("PLAYER_FORECAST_SEASON_IMPORT_CONFIRM must equal local-only.");
  }
  const apiUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ?? "";
  const databaseUrl = process.env.PLAYER_FORECAST_DATABASE_URL?.trim() ?? "";
  if (
    !/^https?:\/\/(127\.0\.0\.1|localhost)(:|\/)/.test(apiUrl) ||
    !/^postgres(?:ql)?:\/\/[^@]*@(127\.0\.0\.1|localhost)(:|\/)/.test(databaseUrl)
  ) {
    throw new Error("Season import is restricted to local Supabase URLs.");
  }
}

function manifestPath(root: string, metadata: ManifestFile): string {
  return path.isAbsolute(metadata.path)
    ? metadata.path
    : path.resolve(root, metadata.path);
}

function verifyManifest(root: string, manifest: ImportManifest): void {
  if (
    manifest.schemaVersion !== "player-forecast-season-import-v1" ||
    manifest.seasonId !== FANTASY_PROJECTION_SEASON_ID ||
    FANTASY_PROJECTION_SUPPORTED_CONTRACTS[manifest.contractVersion] !==
      manifest.contractChecksum
  ) {
    throw new Error("Season import contract mismatch.");
  }
  for (const [name, metadata] of Object.entries({
    ...manifest.files,
    schedule: manifest.schedule,
    playerPool: manifest.playerPool,
    playerPoolReview: manifest.playerPoolReview,
    teams: manifest.teams,
    season: manifest.season,
    deploymentTallies: manifest.deploymentTallies,
    lineSnapshots: manifest.lineSnapshots,
  })) {
    const filePath = manifestPath(root, metadata);
    if (!fs.statSync(filePath).isFile() || sha256(filePath) !== metadata.sha256) {
      throw new Error(`${name} checksum verification failed.`);
    }
  }
  if (sha256(manifest.artifactPath) !== manifest.artifactChecksum) {
    throw new Error("Artifact checksum verification failed.");
  }
  const verification = spawnSync(
    process.env.PLAYER_FORECAST_PYTHON?.trim() || "python3",
    ["-m", "modeling.player_forecasts", "season-verify", "--bundle", root],
    { cwd: path.resolve(process.cwd(), ".."), encoding: "utf8" },
  );
  if (verification.status !== 0 || JSON.parse(verification.stdout).valid !== true) {
    throw new Error("Python release-bundle verification failed.");
  }
}

async function insertChunks(
  table: string,
  source: AsyncIterable<any>,
  transform: (value: any) => Record<string, unknown>,
  conflictColumns: string,
  chunkSize = 250,
): Promise<number> {
  const supabase = getServiceRoleClient() as any;
  let chunk: Record<string, unknown>[] = [];
  let count = 0;
  for await (const value of source) {
    chunk.push(transform(value));
    if (chunk.length < chunkSize) continue;
    const { error } = await supabase.from(table).upsert(chunk, {
      onConflict: conflictColumns,
      ignoreDuplicates: true,
    });
    if (error) throw error;
    count += chunk.length;
    chunk = [];
  }
  if (chunk.length) {
    const { error } = await supabase.from(table).upsert(chunk, {
      onConflict: conflictColumns,
      ignoreDuplicates: true,
    });
    if (error) throw error;
    count += chunk.length;
  }
  return count;
}

async function countRunRows(table: string, runId: string): Promise<number> {
  const supabase = getServiceRoleClient() as any;
  const { count, error } = await supabase
    .from(table)
    .select("id", { count: "exact", head: true })
    .eq("run_id", runId);
  if (error) throw error;
  return Number(count ?? 0);
}

async function selectAll(
  table: string,
  columns: string,
  configure: (query: any) => any,
): Promise<any[]> {
  const supabase = getServiceRoleClient() as any;
  const result: any[] = [];
  for (let start = 0; ; start += 1000) {
    const { data, error } = await configure(
      supabase.from(table).select(columns).range(start, start + 999),
    );
    if (error) throw error;
    result.push(...(data ?? []));
    if ((data ?? []).length < 1000) return result;
  }
}

async function seedReferences(
  manifest: ImportManifest,
  bundleRoot: string,
  playerPool: any[],
): Promise<void> {
  const pg = new Client({ connectionString: process.env.PLAYER_FORECAST_DATABASE_URL });
  await pg.connect();
  try {
    await pg.query("begin");
    const season = json<any>(manifestPath(bundleRoot, manifest.season));
    await pg.query(
      `insert into public.seasons (id, "startDate", "endDate", "regularSeasonEndDate", "numberOfGames")
       values ($1,$2,$3,$4,$5) on conflict (id) do nothing`,
      [season.id, season.start_date, season.end_date, season.regular_season_end_date, season.number_of_games],
    );
    for (const team of json<any[]>(manifestPath(bundleRoot, manifest.teams))) {
      await pg.query(
        "insert into public.teams (id,name,abbreviation) values ($1,$2,$3) on conflict (id) do update set name=excluded.name, abbreviation=excluded.abbreviation",
        [team.team_id, team.name, team.abbreviation],
      );
    }
    for (const player of playerPool) {
      if (player.nhl_player_id != null) {
        const parts = String(player.player_name).trim().split(/\s+/);
        await pg.query(
          `insert into public.players
             (id,"firstName","lastName","fullName","position","birthDate","heightInCentimeters","weightInKilograms",team_id)
           values ($1,$2,$3,$4,$5,'1900-01-01',180,80,$6)
           on conflict (id) do update set "fullName"=excluded."fullName", "position"=excluded."position", team_id=excluded.team_id`,
          [player.nhl_player_id, parts[0] || player.player_name, parts.slice(1).join(" ") || player.player_name, player.player_name, player.position, player.team_id],
        );
      }
      await pg.query(
        `insert into public.fhfh_player_identities
           (id,nhl_player_id,canonical_name,canonical_position,current_nhl_team_id,current_organization_type,lifecycle_status,verification_status,source_provenance)
         overriding system value values ($1,$2,$3,$4,$5,'nhl',$6,'verified',$7::jsonb)
         on conflict (id) do update set canonical_name=excluded.canonical_name, canonical_position=excluded.canonical_position,
           current_nhl_team_id=excluded.current_nhl_team_id, lifecycle_status=excluded.lifecycle_status,
           verification_status='verified', source_provenance=excluded.source_provenance`,
        [
          player.fhfh_player_id,
          player.nhl_player_id,
          player.player_name,
          player.position,
          player.team_id,
          player.pool_status === "active_prospect" ? "active_prospect" : player.pool_status === "unsigned_relevant" ? "unsigned_relevant" : "active_nhl",
          JSON.stringify({ ...player.source_provenance, localSeasonImport: true }),
        ],
      );
    }
    await pg.query("commit");
  } catch (error) {
    await pg.query("rollback");
    throw error;
  } finally {
    await pg.end();
  }
}

async function main(): Promise<void> {
  assertLocalOnly();
  const bundleRoot = argument("bundle");
  const manifest = json<ImportManifest>(path.join(bundleRoot, "import-manifest.json"));
  verifyManifest(bundleRoot, manifest);
  const supabase = getServiceRoleClient() as any;
  const playerPool = json<any[]>(manifestPath(bundleRoot, manifest.playerPool));
  await seedReferences(manifest, bundleRoot, playerPool);

  const { data: existing, error: existingError } = await supabase
    .from("player_forecast_season_runs")
    .select("id,status")
    .eq("idempotency_key", `local-import:${manifest.runHash}`)
    .maybeSingle();
  if (existingError) throw existingError;
  if (existing) {
    const existingCounts = await Promise.all([
      countRunRows("player_forecast_season_game_outputs", existing.id),
      countRunRows("player_forecast_season_player_aggregates", existing.id),
      countRunRows("player_forecast_season_team_aggregates", existing.id),
    ]);
    const expectedCounts = [
      manifest.files["game-outputs"].rows,
      manifest.files["player-aggregates"].rows,
      manifest.files["team-aggregates"].rows,
    ];
    if (existingCounts.every((count, index) => count === expectedCounts[index])) {
      process.stdout.write(`${JSON.stringify({
        idempotent: true,
        runId: existing.id,
        status: existing.status,
        gameOutputs: existingCounts[0],
        players: existingCounts[1],
        teams: existingCounts[2],
      }, null, 2)}\n`);
      return;
    }
    if (existing.status !== "draft") {
      throw new Error("An incomplete season import can only resume while its run is a draft.");
    }
  }

  const storagePath = `sha256/${manifest.artifactChecksum}/season-artifact.json`;
  const artifact = json<any>(manifest.artifactPath);
  const { data: existingArtifact, error: existingArtifactError } = await supabase
    .from("player_forecast_season_artifacts")
    .select("id")
    .eq("season_id", manifest.seasonId)
    .eq("artifact_version", manifest.artifactVersion)
    .eq("artifact_checksum", manifest.artifactChecksum)
    .maybeSingle();
  if (existingArtifactError) throw existingArtifactError;
  let artifactRow = existingArtifact;
  if (!artifactRow) {
    const artifactBytes = fs.readFileSync(manifest.artifactPath);
    const { error: uploadError } = await supabase.storage
      .from("player-forecast-artifacts")
      .upload(storagePath, artifactBytes, { contentType: "application/json", upsert: false });
    if (uploadError && !/already exists|Duplicate/i.test(uploadError.message)) throw uploadError;
    const { data, error } = await supabase
      .from("player_forecast_season_artifacts")
      .insert({
        season_id: manifest.seasonId,
        artifact_version: manifest.artifactVersion,
        artifact_checksum: manifest.artifactChecksum,
        artifact_path: storagePath,
        contract_version: manifest.contractVersion,
        contract_checksum: manifest.contractChecksum,
        feature_schema_version: manifest.featureSchemaVersion,
        training_cutoff_at: manifest.trainingCutoffAt,
        code_version: manifest.codeVersion,
        model_manifest: artifact.review ?? {},
        golden_vectors: artifact.goldenVectors ?? [],
        lifecycle_status: manifest.view === "opening" ? "frozen_opening" : "shadow",
      })
      .select("id")
      .single();
    if (error) throw error;
    artifactRow = data;
  }

  const snapshotSource = "local_checksum_verified_import";
  const snapshotMetadata = {
    suppressEnqueue: true,
    importRunHash: manifest.runHash,
    transactionCoverage: manifest.transactionCoverage ?? {},
  };
  const mappedOfficialRosterPlayers = playerPool.filter(
    (player) => player.source_provenance?.officialRoster,
  ).length;
  const unmappedOfficialRosterPlayers = Number(
    manifest.healthSummary?.unmappedOfficialRosterPlayers ?? 0,
  );
  const officialRosterWarnings = Number(manifest.healthSummary?.officialRosterWarnings ?? 0);
  const rosterCompleteness =
    manifest.healthStatus === "healthy" &&
    unmappedOfficialRosterPlayers === 0 &&
    officialRosterWarnings === 0
      ? 1
      : mappedOfficialRosterPlayers /
        Math.max(1, mappedOfficialRosterPlayers + unmappedOfficialRosterPlayers);
  const { data: existingRosterSnapshot, error: rosterLookupError } = await supabase
    .from("player_forecast_season_roster_snapshots")
    .select("id")
    .eq("season_id", manifest.seasonId)
    .eq("revision_hash", manifest.rosterRevisionHash)
    .maybeSingle();
  if (rosterLookupError) throw rosterLookupError;
  let rosterSnapshot = existingRosterSnapshot;
  if (!rosterSnapshot) {
    const { data, error } = await supabase
      .from("player_forecast_season_roster_snapshots")
      .insert({
        season_id: manifest.seasonId,
        source: snapshotSource,
        observed_at: manifest.freezeCreatedAt,
        available_at: manifest.freezeCreatedAt,
        completeness: rosterCompleteness,
        revision_hash: manifest.rosterRevisionHash,
        source_manifest: [{ ...manifest.playerPool, path: path.basename(manifest.playerPool.path) }],
        metadata: snapshotMetadata,
      })
      .select("id")
      .single();
    if (error) throw error;
    rosterSnapshot = data;
    const { error: memberError } = await supabase
      .from("player_forecast_season_roster_members")
      .insert(playerPool.map((player) => ({
        snapshot_id: rosterSnapshot.id,
        fhfh_player_id: player.fhfh_player_id,
        team_id: player.team_id,
        previous_team_id: null,
        position: player.position,
        pool_status: player.pool_status,
        roster_status:
          player.pool_status === "verified_active"
            ? "active_nhl"
            : player.pool_status === "active_prospect"
              ? "prospect_reserve"
              : "unsigned",
        roster_confidence: player.roster_confidence,
        prior_based: player.prior_based,
        source_fresh_at: manifest.rosterObservedAt ?? manifest.freezeCreatedAt,
        source_provenance: player.source_provenance,
      })));
    if (memberError) throw memberError;
  }

  const { data: existingScheduleSnapshot, error: scheduleLookupError } = await supabase
    .from("player_forecast_season_schedule_snapshots")
    .select("id")
    .eq("season_id", manifest.seasonId)
    .eq("revision_hash", manifest.scheduleRevisionHash)
    .maybeSingle();
  if (scheduleLookupError) throw scheduleLookupError;
  let scheduleSnapshot = existingScheduleSnapshot;

  const scheduleRows = json<any[]>(manifestPath(bundleRoot, manifest.schedule));
  if (!scheduleSnapshot) {
    const { data, error } = await supabase
      .from("player_forecast_season_schedule_snapshots")
      .insert({
        season_id: manifest.seasonId,
        source: snapshotSource,
        observed_at: manifest.freezeCreatedAt,
        available_at: manifest.freezeCreatedAt,
        completeness: 1,
        revision_hash: manifest.scheduleRevisionHash,
        source_manifest: [{ ...manifest.schedule, path: path.basename(manifest.schedule.path) }],
        metadata: snapshotMetadata,
      })
      .select("id")
      .single();
    if (error) throw error;
    scheduleSnapshot = data;
    const { error: gameError } = await supabase
      .from("player_forecast_season_schedule_games")
      .insert(scheduleRows.map((game) => ({
        snapshot_id: scheduleSnapshot.id,
        game_id: game.game_id,
        game_type: game.game_type,
        scheduled_start_at: game.scheduled_start_at,
        home_team_id: game.home_team_id,
        away_team_id: game.away_team_id,
        game_status: game.game_status,
        source_revision_key: game.source_revision_key,
        metadata: snapshotMetadata,
      })));
    if (gameError) throw gameError;
  }
  const insertedGames = await selectAll(
    "player_forecast_season_schedule_games",
    "id,game_id",
    (query) => query.eq("snapshot_id", scheduleSnapshot.id),
  );
  const scheduleIds = new Map(insertedGames.map((game: any) => [Number(game.game_id), game.id]));

  const reviewRows = json<any[]>(manifestPath(bundleRoot, manifest.playerPoolReview));
  if (!existingRosterSnapshot && reviewRows.length) {
    const { error: reviewError } = await supabase
      .from("player_forecast_season_player_pool_review")
      .insert(reviewRows.map((review) => ({
        review_key: `${manifest.seasonId}:nhl:${review.nhl_player_id}:${manifest.rosterRevisionHash}`,
        season_id: manifest.seasonId,
        nhl_player_id: review.nhl_player_id,
        raw_player_name: review.player_name,
        team_id: review.team_id,
        position: review.position,
        issue_code: review.issue_code,
        resolution_status: "pending",
        source_provenance: { officialRoster: review.official_roster, rosterRevisionHash: manifest.rosterRevisionHash },
      })));
    if (reviewError) throw reviewError;
  }

  const runId = existing?.id ?? randomUUID();
  if (!existing) {
    const { error: runError } = await supabase.from("player_forecast_season_runs").insert({
      id: runId,
      idempotency_key: `local-import:${manifest.runHash}`,
      season_id: manifest.seasonId,
      view_key: manifest.view,
      run_kind: "local_import",
      status: "draft",
      artifact_id: artifactRow.id,
      roster_snapshot_id: rosterSnapshot.id,
      schedule_snapshot_id: scheduleSnapshot.id,
      cutoff_at: manifest.cutoffAt,
      source_high_watermark: manifest.sourceHighWatermark,
      contract_version: manifest.contractVersion,
      contract_checksum: manifest.contractChecksum,
      deterministic_hash: manifest.runHash,
    });
    if (runError) throw runError;
  }

  const gameOutputPath = manifestPath(bundleRoot, manifest.files["game-outputs"]);
  await insertChunks(
    "player_forecast_season_game_outputs",
    rows(gameOutputPath),
    (value) => ({
      run_id: runId,
      schedule_game_id: scheduleIds.get(Number(value.gameId)),
      fhfh_player_id: value.fhfhPlayerId,
      team_id: value.teamId,
      opponent_team_id: value.opponentTeamId,
      population: value.population,
      playing_probability: value.playingProbability,
      start_probability: value.startProbability,
      conditional_means: value.conditionalMeans,
      unconditional_means: value.unconditionalMeans,
      baseline_unconditional_means: value.baselineUnconditionalMeans,
      variances: value.variances,
      quantiles: value.quantiles,
      deployment: value.deployment,
      fallback_flags: value.fallbackFlags,
      component_hash: value.componentHash,
    }),
    "run_id,schedule_game_id,fhfh_player_id",
  );
  await insertChunks(
    "player_forecast_season_player_aggregates",
    rows(manifestPath(bundleRoot, manifest.files["player-aggregates"])),
    (value) => ({ ...value, run_id: runId }),
    "run_id,fhfh_player_id",
  );
  await insertChunks(
    "player_forecast_season_team_aggregates",
    rows(manifestPath(bundleRoot, manifest.files["team-aggregates"])),
    (value) => ({ ...value, run_id: runId }),
    "run_id,team_id",
  );
  const importedPlayerAggregates = jsonLines<any>(
    manifestPath(bundleRoot, manifest.files["player-aggregates"]),
  );
  const importedTeamAggregates = jsonLines<any>(
    manifestPath(bundleRoot, manifest.files["team-aggregates"]),
  );
  for (const team of importedTeamAggregates) {
    const { data: existingDeployment, error: deploymentLookupError } = await supabase
      .from("player_forecast_season_deployment_snapshots")
      .select("id")
      .eq("season_id", manifest.seasonId)
      .eq("team_id", team.team_id)
      .eq("revision_hash", team.aggregate_hash)
      .maybeSingle();
    if (deploymentLookupError) throw deploymentLookupError;
    if (existingDeployment) continue;
    const { data: deploymentSnapshot, error: deploymentSnapshotError } = await supabase
      .from("player_forecast_season_deployment_snapshots")
      .insert({
        season_id: manifest.seasonId,
        team_id: team.team_id,
        source: "checksum_verified_processed_deployment_evidence",
        observed_at: manifest.freezeCreatedAt,
        available_at: manifest.freezeCreatedAt,
        revision_hash: team.aggregate_hash,
        processing_status: "trusted",
        forecast_relevant: true,
        completeness: 1,
        source_manifest: [
          { source: "processed_line_snapshots", checksum: manifest.lineSnapshots.sha256 },
          { source: "historical_deployment_tallies", checksum: manifest.deploymentTallies.sha256 },
        ],
        metadata: {
          ...snapshotMetadata,
          artifactChecksum: manifest.artifactChecksum,
        },
      })
      .select("id")
      .single();
    if (deploymentSnapshotError) throw deploymentSnapshotError;
    const assignments = importedPlayerAggregates
      .filter((player) => Number(player.team_id) === Number(team.team_id))
      .map((player) => ({
        snapshot_id: deploymentSnapshot.id,
        fhfh_player_id: player.fhfh_player_id,
        position: player.position,
        most_likely_role: player.deployment?.mostLikelyRole ?? {},
        role_probabilities: player.deployment?.roleProbabilities ?? {},
        confidence: player.deployment?.confidence ?? 0,
        expected_toi: player.expected_toi ?? {},
        source_provenance: {
          ...(player.provenance ?? {}),
          sourceManifest: player.deployment?.sourceManifest ?? [],
        },
      }));
    if (assignments.length) {
      const { error: assignmentError } = await supabase
        .from("player_forecast_season_deployment_assignments")
        .insert(assignments);
      if (assignmentError) throw assignmentError;
    }
  }
  const importedCounts = await Promise.all([
    countRunRows("player_forecast_season_game_outputs", runId),
    countRunRows("player_forecast_season_player_aggregates", runId),
    countRunRows("player_forecast_season_team_aggregates", runId),
  ]);
  const expectedCounts = [
    manifest.files["game-outputs"].rows,
    manifest.files["player-aggregates"].rows,
    manifest.files["team-aggregates"].rows,
  ];
  if (importedCounts.some((count, index) => count !== expectedCounts[index])) {
    throw new Error(
      `Season import row-count mismatch: expected ${expectedCounts.join("/")}, found ${importedCounts.join("/")}.`,
    );
  }
  process.stdout.write(`${JSON.stringify({
    idempotent: false,
    resumed: Boolean(existing),
    runId,
    artifactId: artifactRow.id,
    gameOutputs: importedCounts[0],
    players: importedCounts[1],
    teams: importedCounts[2],
    publicationBlockedByPlayerPoolReview: reviewRows.length,
  }, null, 2)}\n`);
}

main().catch((error) => {
  const message =
    error instanceof Error
      ? error.message
      : error && typeof error === "object"
        ? JSON.stringify(error)
        : String(error ?? "Season import failed.");
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
});
