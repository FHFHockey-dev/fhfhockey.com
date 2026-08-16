import { spawnSync } from "child_process";
import { createHash } from "crypto";
import fs from "fs";
import path from "path";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env.development.local" });

import {
  FANTASY_PROJECTION_CONTRACT_CHECKSUM,
  FANTASY_PROJECTION_SEASON_ID,
  GOALIE_PRIMITIVE_TARGETS,
  SKATER_PRIMITIVE_TARGETS,
} from "../lib/fantasy-projections/contracts";
import { checksumCanonicalJson } from "../lib/fantasy-projections/evaluator";
import {
  allocateSeasonTotalAdjustment,
  FANTASY_PROJECTION_SCORING_VERSION,
  scoreSeasonPrimitive,
} from "../lib/fantasy-projections/settlement";
import { getServiceRoleClient } from "../lib/supabase/server";

type SettlementManifest = {
  schemaVersion: string;
  seasonId: number;
  cutoffAt: string;
  contractChecksum: string;
  scheduleRevisionHash: string;
  outcomes: { path: string; rows: number; sha256: string };
  completedGames: Array<{
    gameId: number;
    availableAt: string;
    finality: "provisional" | "final";
  }>;
  skippedUnmappedNhlPlayerIds: number[];
  bundleHash: string;
};

function argument(name: string): string {
  const prefix = `--${name}=`;
  const value = process.argv.find((item) => item.startsWith(prefix))?.slice(prefix.length);
  if (!value) throw new Error(`Pass ${prefix}/absolute/path.`);
  return path.resolve(value);
}

function sha256(filePath: string): string {
  return createHash("sha256")
    .update(fs.readFileSync(filePath) as unknown as Uint8Array)
    .digest("hex");
}

function assertLocalOnly(): void {
  if (process.env.PLAYER_FORECAST_SEASON_SETTLEMENT_IMPORT_CONFIRM !== "local-only") {
    throw new Error("PLAYER_FORECAST_SEASON_SETTLEMENT_IMPORT_CONFIRM must equal local-only.");
  }
  const apiUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ?? "";
  if (!/^https?:\/\/(127\.0\.0\.1|localhost)(:|\/)/.test(apiUrl)) {
    throw new Error("Season settlement import is restricted to local Supabase.");
  }
}

function readJsonLines(filePath: string): any[] {
  return fs.readFileSync(filePath, "utf8").split("\n").filter(Boolean).map((line) => JSON.parse(line));
}

async function selectAll(
  table: string,
  columns: string,
  configure: (query: any) => any,
): Promise<any[]> {
  const client = getServiceRoleClient() as any;
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

async function insertChunks(table: string, rows: any[], size = 250): Promise<void> {
  const client = getServiceRoleClient() as any;
  for (let start = 0; start < rows.length; start += size) {
    const { error } = await client.from(table).insert(rows.slice(start, start + size));
    if (error) throw error;
  }
}

function outcomeKey(gameId: number, playerId: number): string {
  return `${gameId}:${playerId}`;
}

async function main(): Promise<void> {
  assertLocalOnly();
  const root = argument("bundle");
  const manifest = JSON.parse(
    fs.readFileSync(path.join(root, "settlement-manifest.json"), "utf8"),
  ) as SettlementManifest;
  const unsigned = Object.fromEntries(
    Object.entries(manifest).filter(([key]) => key !== "bundleHash"),
  );
  const outcomesPath = path.join(root, manifest.outcomes.path);
  if (
    manifest.schemaVersion !== "player-forecast-season-settlement-v1" ||
    manifest.seasonId !== FANTASY_PROJECTION_SEASON_ID ||
    manifest.contractChecksum !== FANTASY_PROJECTION_CONTRACT_CHECKSUM ||
    checksumCanonicalJson(unsigned) !== manifest.bundleHash ||
    sha256(outcomesPath) !== manifest.outcomes.sha256
  ) {
    throw new Error("Season settlement bundle verification failed.");
  }
  const verification = spawnSync(
    process.env.PLAYER_FORECAST_PYTHON?.trim() || "python3",
    ["-m", "modeling.player_forecasts", "season-settlement-verify", "--bundle", root],
    { cwd: path.resolve(process.cwd(), ".."), encoding: "utf8" },
  );
  if (verification.status !== 0 || JSON.parse(verification.stdout).valid !== true) {
    throw new Error("Python settlement-bundle verification failed.");
  }

  const client = getServiceRoleClient() as any;
  const { data: snapshot, error: snapshotError } = await client
    .from("player_forecast_season_schedule_snapshots")
    .select("id")
    .eq("season_id", manifest.seasonId)
    .eq("revision_hash", manifest.scheduleRevisionHash)
    .maybeSingle();
  if (snapshotError) throw snapshotError;
  if (!snapshot) throw new Error("Settlement schedule snapshot is not imported.");
  const scheduleRows = await selectAll(
    "player_forecast_season_schedule_games",
    "id,game_id",
    (query) => query.eq("snapshot_id", snapshot.id),
  );
  const scheduleIdByGame = new Map(
    scheduleRows.map((row) => [Number(row.game_id), String(row.id)]),
  );
  const completed = new Map(manifest.completedGames.map((row) => [Number(row.gameId), row]));
  const actualRows = readJsonLines(outcomesPath);
  if (actualRows.length !== manifest.outcomes.rows) {
    throw new Error("Settlement outcome row count mismatch.");
  }
  const actualByKey = new Map(
    actualRows.map((row) => [outcomeKey(Number(row.gameId), Number(row.fhfhPlayerId)), row]),
  );

  const releases = await selectAll(
    "player_forecast_season_releases",
    "id,run_id,cutoff_at,view_key,release_number",
    (query) => query.eq("season_id", manifest.seasonId),
  );
  const releaseInputs: Array<{
    release: any;
    outputs: any[];
    players: Map<number, any>;
  }> = [];
  for (const release of releases) {
    const outputs = await selectAll(
      "player_forecast_season_game_outputs",
      "schedule_game_id,fhfh_player_id,population,playing_probability,start_probability,unconditional_means,baseline_unconditional_means,quantiles",
      (query) => query.eq("run_id", release.run_id),
    );
    const players = await selectAll(
      "player_forecast_season_release_players",
      "fhfh_player_id,base_values,published_values,adjustment_delta",
      (query) => query.eq("release_id", release.id),
    );
    releaseInputs.push({
      release,
      outputs,
      players: new Map(players.map((row) => [Number(row.fhfh_player_id), row])),
    });
  }

  const gameIdBySchedule = new Map(
    scheduleRows.map((row) => [String(row.id), Number(row.game_id)]),
  );
  const outcomeCandidates = new Map<string, any>(actualByKey);
  for (const input of releaseInputs) {
    for (const output of input.outputs) {
      const gameId = gameIdBySchedule.get(String(output.schedule_game_id));
      const complete = gameId == null ? null : completed.get(gameId);
      if (!complete || gameId == null) continue;
      const playerId = Number(output.fhfh_player_id);
      const key = outcomeKey(gameId, playerId);
      if (outcomeCandidates.has(key)) continue;
      const targets = output.population === "goalie"
        ? GOALIE_PRIMITIVE_TARGETS
        : SKATER_PRIMITIVE_TARGETS;
      const primitiveValues = Object.fromEntries(targets.map((target) => [target, 0]));
      const unsignedOutcome = {
        gameId,
        fhfhPlayerId: playerId,
        nhlPlayerId: null,
        population: output.population,
        primitiveValues,
        observedAt: complete.availableAt,
        availableAt: complete.availableAt,
        eligibleFinality: complete.finality,
        source: "nhl_gamecenter_complete_boxscore_absence",
        sourceRevisionKey: checksumCanonicalJson({
          gameId,
          fhfhPlayerId: playerId,
          primitiveValues,
          sourceAvailableAt: complete.availableAt,
        }),
      };
      outcomeCandidates.set(key, {
        ...unsignedOutcome,
        revisionHash: checksumCanonicalJson(unsignedOutcome),
        provenance: {
          scheduleRevisionHash: manifest.scheduleRevisionHash,
          derivedAbsence: true,
          availabilityPolicy: "complete immutable Gamecenter capture",
        },
      });
    }
  }

  const existingOutcomes = await selectAll(
    "player_forecast_season_outcome_revisions",
    "id,schedule_game_id,fhfh_player_id,primitive_values,finality,revision_hash,available_at",
    (query) => query.eq("season_id", manifest.seasonId).order("available_at", { ascending: false }),
  );
  const latestByKey = new Map<string, any>();
  const existingHashes = new Set<string>();
  for (const row of existingOutcomes) {
    existingHashes.add(String(row.revision_hash));
    const gameId = gameIdBySchedule.get(String(row.schedule_game_id));
    if (gameId == null) continue;
    const key = outcomeKey(gameId, Number(row.fhfh_player_id));
    if (!latestByKey.has(key)) latestByKey.set(key, row);
  }
  const inserts: any[] = [];
  for (const [key, candidate] of outcomeCandidates) {
    if (existingHashes.has(String(candidate.revisionHash))) continue;
    const prior = latestByKey.get(key);
    const finality = candidate.eligibleFinality === "final"
      ? "final"
      : prior && JSON.stringify(prior.primitive_values) !== JSON.stringify(candidate.primitiveValues)
        ? "corrected"
        : "provisional";
    inserts.push({
      season_id: manifest.seasonId,
      schedule_game_id: scheduleIdByGame.get(Number(candidate.gameId)),
      fhfh_player_id: candidate.fhfhPlayerId,
      population: candidate.population,
      primitive_values: candidate.primitiveValues,
      source: candidate.source,
      observed_at: candidate.observedAt,
      available_at: candidate.availableAt,
      finality,
      revision_hash: candidate.revisionHash,
      supersedes_id: prior?.id ?? null,
      provenance: candidate.provenance,
    });
  }
  await insertChunks("player_forecast_season_outcome_revisions", inserts);

  const storedOutcomes = await selectAll(
    "player_forecast_season_outcome_revisions",
    "id,schedule_game_id,fhfh_player_id,primitive_values,finality,revision_hash,available_at",
    (query) => query.eq("season_id", manifest.seasonId).order("available_at", { ascending: false }),
  );
  const storedLatest = new Map<string, any>();
  for (const row of storedOutcomes) {
    const gameId = gameIdBySchedule.get(String(row.schedule_game_id));
    if (gameId == null) continue;
    const key = outcomeKey(gameId, Number(row.fhfh_player_id));
    if (!storedLatest.has(key)) storedLatest.set(key, row);
  }
  const evaluations: any[] = [];
  const evaluatedAt = new Date().toISOString();
  for (const input of releaseInputs) {
    for (const output of input.outputs) {
      const gameId = gameIdBySchedule.get(String(output.schedule_game_id));
      if (gameId == null || !completed.has(gameId)) continue;
      const playerId = Number(output.fhfh_player_id);
      const outcome = storedLatest.get(outcomeKey(gameId, playerId));
      if (!outcome) continue;
      const releasePlayer = input.players.get(playerId);
      const targets = output.population === "goalie"
        ? GOALIE_PRIMITIVE_TARGETS
        : SKATER_PRIMITIVE_TARGETS;
      const modelLosses: Record<string, unknown> = {};
      const publishedLosses: Record<string, unknown> = {};
      for (const target of targets) {
        const actual = Number(outcome.primitive_values?.[target] ?? 0);
        const probability = target === "GAMES_PLAYED" || target === "GAMES_STARTED";
        const modelForecast = probability
          ? Number(target === "GAMES_STARTED" ? output.start_probability : output.playing_probability)
          : Number(output.unconditional_means?.[target] ?? 0);
        const baselineForecast = Number(output.baseline_unconditional_means?.[target] ?? 0);
        const adjustmentDelta = Number(releasePlayer?.adjustment_delta?.[target] ?? 0);
        const publishedForecast = allocateSeasonTotalAdjustment({
          modelGameForecast: modelForecast,
          modelRemainingTotal: Number(releasePlayer?.base_values?.[target] ?? 0),
          adjustmentDelta,
          remainingGames: Math.max(1, Number(releasePlayer?.base_values?.GAMES_PLAYED ?? 1)),
        });
        const common = {
          actual,
          baselineForecast,
          p10: output.quantiles?.p10?.[target],
          p90: output.quantiles?.p90?.[target],
          probability,
        };
        modelLosses[target] = scoreSeasonPrimitive({ ...common, forecast: modelForecast });
        publishedLosses[target] = scoreSeasonPrimitive({ ...common, forecast: publishedForecast });
      }
      evaluations.push({
        release_id: input.release.id,
        outcome_revision_id: outcome.id,
        fhfh_player_id: playerId,
        scoring_version: FANTASY_PROJECTION_SCORING_VERSION,
        model_losses: modelLosses,
        published_losses: publishedLosses,
        finality: outcome.finality,
        evaluated_at: evaluatedAt,
        provenance: {
          releaseView: input.release.view_key,
          releaseNumber: input.release.release_number,
          settlementBundleHash: manifest.bundleHash,
        },
      });
    }
  }
  if (evaluations.length) {
    for (let start = 0; start < evaluations.length; start += 250) {
      const { error } = await client
        .from("player_forecast_season_evaluation_revisions")
        .upsert(evaluations.slice(start, start + 250), {
          onConflict: "release_id,outcome_revision_id,scoring_version",
          ignoreDuplicates: true,
        });
      if (error) throw error;
    }
  }
  process.stdout.write(`${JSON.stringify({
    outcomesAppended: inserts.length,
    evaluationsAttempted: evaluations.length,
    releasesEvaluated: releaseInputs.length,
    completedGames: completed.size,
    skippedUnmappedNhlPlayerIds: manifest.skippedUnmappedNhlPlayerIds,
  }, null, 2)}\n`);
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : "Season settlement import failed."}\n`);
  process.exitCode = 1;
});
