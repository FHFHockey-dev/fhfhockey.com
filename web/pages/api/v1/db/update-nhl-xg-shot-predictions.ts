import path from "path";

import type { NextApiRequest, NextApiResponse } from "next";

import { withCronJobAudit } from "lib/cron/withCronJobAudit";
import { getCurrentSeason } from "lib/NHL/server";
import supabase from "lib/supabase/server";
import { resolveRequestedGameIds } from "lib/supabase/Upserts/nhlRawGamecenterRoute";
import {
  buildPredictionDbRow,
  fetchPersistedFeatureRows,
  loadXgModelArtifact,
  predictShotGoalProbabilities,
  type PersistedFeatureRow,
  type XgShotPredictionType
} from "lib/xg/shotFeaturePersistence";

const PAGE_SIZE = 1000;
const DEFAULT_GAME_BATCH_SIZE = 1;
const DEFAULT_UPSERT_BATCH_SIZE = 500;
const DEFAULT_UPSERT_RETRIES = 4;
const MODEL_ARTIFACT_PATH_ENV_VAR = "NHL_XG_MODEL_ARTIFACT_PATH";

let activeXgShotPredictionRun: { startedAt: string; url: string | null } | null = null;

type ArtifactPathResolution = {
  path: string | null;
  source: "query" | "env" | "missing";
};

function firstQueryValue(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

function parseInteger(value: string | null, fallback: number): number {
  if (!value) return fallback;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function parseOptionalInteger(value: string | null): number | null {
  if (!value) return null;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function parseBoolean(value: string | null): boolean {
  return value != null && ["1", "true", "yes", "y"].includes(value.toLowerCase());
}

function parseQueryFlag(value: string | string[] | undefined): boolean {
  const normalized = firstQueryValue(value)?.toLowerCase();
  return normalized != null && ["1", "true", "yes", "y", "all", "full"].includes(normalized);
}

function parsePredictionType(value: string | null): XgShotPredictionType {
  return value === "rebound_creation" ? "rebound_creation" : "shot_goal";
}

function resolveArtifactPath(req: NextApiRequest): ArtifactPathResolution {
  const queryPath = firstQueryValue(req.query.modelArtifactPath);
  const envPath = process.env[MODEL_ARTIFACT_PATH_ENV_VAR] ?? null;
  const raw = queryPath ?? envPath;
  if (!raw) return { path: null, source: "missing" };

  return {
    path: path.isAbsolute(raw) ? raw : path.resolve(process.cwd(), raw),
    source: queryPath != null ? "query" : "env"
  };
}

function isHealthRequest(req: NextApiRequest): boolean {
  const action = firstQueryValue(req.query.action)?.toLowerCase();
  return action === "health" || action === "status" || parseBoolean(firstQueryValue(req.query.health));
}

function buildArtifactHealthResponse(resolution: ArtifactPathResolution) {
  if (!resolution.path) {
    return {
      statusCode: 503,
      body: {
        success: false,
        configured: false,
        artifactPathSource: resolution.source,
        requiredEnvVar: MODEL_ARTIFACT_PATH_ENV_VAR,
        error:
          `No xG model artifact is configured. Set ${MODEL_ARTIFACT_PATH_ENV_VAR} ` +
          "or pass modelArtifactPath for local diagnostics."
      }
    };
  }

  try {
    const artifact = loadXgModelArtifact(resolution.path);
    const modelApproved = artifact.approvalGradeEligibility?.isEligible === true;

    return {
      statusCode: modelApproved ? 200 : 409,
      body: {
        success: modelApproved,
        configured: true,
        artifactPath: resolution.path,
        artifactPathSource: resolution.source,
        artifactTag: artifact.artifactTag,
        modelFamily: artifact.family,
        featureFamily: artifact.featureFamily ?? null,
        featureVersion: artifact.featureVersion,
        modelApproved,
        blockingReasons: artifact.approvalGradeEligibility?.blockingReasons ?? [],
        calibration: {
          selectedMethod: artifact.calibration?.selectedMethod ?? null,
          applied: artifact.calibration?.applied === true,
          hasSerializedModel: artifact.calibration?.model != null
        },
        selectedFeatureCounts: {
          numeric: artifact.selectedFeatures.numeric.length,
          boolean: artifact.selectedFeatures.boolean.length,
          categorical: artifact.selectedFeatures.categorical.length
        }
      }
    };
  } catch (error) {
    return {
      statusCode: 503,
      body: {
        success: false,
        configured: true,
        artifactPath: resolution.path,
        artifactPathSource: resolution.source,
        requiredEnvVar: MODEL_ARTIFACT_PATH_ENV_VAR,
        error: `Failed to load xG model artifact: ${getErrorMessage(error)}`
      }
    };
  }
}

function chunkNumbers(values: number[], size: number): number[][] {
  const chunks: number[][] = [];
  for (let index = 0; index < values.length; index += size) {
    chunks.push(values.slice(index, index + size));
  }
  return chunks;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (error && typeof error === "object" && "message" in error) {
    return String((error as { message?: unknown }).message);
  }
  return String(error);
}

function isRetryableSupabaseError(error: unknown): boolean {
  const message = getErrorMessage(error).toLowerCase();
  return (
    message.includes("fetch failed") ||
    message.includes("timeout") ||
    message.includes("econnreset") ||
    message.includes("socket") ||
    message.includes("network")
  );
}

async function resolveSeasonId(query: NextApiRequest["query"]): Promise<number> {
  const explicit = parseOptionalInteger(firstQueryValue(query.seasonId));
  if (explicit != null) return explicit;
  const season = await getCurrentSeason();
  return season.seasonId;
}

async function fetchPersistedFeatureRowsPage(args: {
  seasonId: number;
  featureVersion: number;
  from: number;
  to: number;
}): Promise<PersistedFeatureRow[]> {
  const { data, error } = await supabase
    .from("nhl_xg_shot_features" as any)
    .select(
      "feature_version, game_id, event_id, season_id, game_date, event_owner_team_id, shooter_player_id, goalie_in_net_id, shot_event_type, is_goal, creates_rebound, feature_payload"
    )
    .eq("feature_version", args.featureVersion)
    .eq("season_id", args.seasonId)
    .eq("is_unblocked_shot_attempt", true)
    .eq("is_penalty_shot_event", false)
    .eq("is_shootout_event", false)
    .order("game_id", { ascending: true })
    .order("event_id", { ascending: true })
    .range(args.from, args.to);

  if (error) {
    throw new Error(`Failed to fetch nhl_xg_shot_features page: ${error.message}`);
  }

  return ((data ?? []) as unknown) as PersistedFeatureRow[];
}

function predictionKey(row: { game_id: number; event_id: number }): string {
  return `${row.game_id}:${row.event_id}`;
}

async function fetchExistingPredictionKeys(args: {
  modelVersion: string;
  predictionType: XgShotPredictionType;
  featureRows: PersistedFeatureRow[];
}): Promise<Set<string>> {
  if (args.featureRows.length === 0) return new Set();

  const gameIds = Array.from(new Set(args.featureRows.map((row) => row.game_id)));
  const eventIds = Array.from(new Set(args.featureRows.map((row) => row.event_id)));
  const existing = new Set<string>();

  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await supabase
      .from("nhl_xg_shot_predictions" as any)
      .select("game_id,event_id")
      .eq("model_version", args.modelVersion)
      .eq("prediction_type", args.predictionType)
      .in("game_id", gameIds)
      .in("event_id", eventIds)
      .range(from, from + PAGE_SIZE - 1);

    if (error) {
      throw new Error(`Failed to fetch existing xG predictions: ${error.message}`);
    }

    if (!data?.length) break;

    for (const row of data as unknown as Array<{ game_id: number | string; event_id: number | string }>) {
      const gameId = Number(row.game_id);
      const eventId = Number(row.event_id);
      if (Number.isFinite(gameId) && Number.isFinite(eventId)) {
        existing.add(`${gameId}:${eventId}`);
      }
    }

    if (data.length < PAGE_SIZE) break;
  }

  return existing;
}

function buildPredictionRows(args: {
  featureRows: PersistedFeatureRow[];
  artifact: ReturnType<typeof loadXgModelArtifact>;
  modelArtifactPath: string | null;
  predictionType: XgShotPredictionType;
}) {
  return args.featureRows.map((feature) => {
    const probabilities = predictShotGoalProbabilities(feature.feature_payload, args.artifact);
    return buildPredictionDbRow({
      feature,
      artifact: args.artifact,
      modelArtifactPath: args.modelArtifactPath,
      predictionType: args.predictionType,
      rawProbability: probabilities.rawProbability,
      calibratedProbability: probabilities.calibratedProbability,
      xg: probabilities.xg
    });
  });
}

async function upsertPredictionRows(
  rows: unknown[],
  options?: { batchSize?: number; maxRetries?: number }
): Promise<number> {
  if (rows.length === 0) return 0;

  const batchSize = Math.max(1, options?.batchSize ?? DEFAULT_UPSERT_BATCH_SIZE);
  const maxRetries = Math.max(0, options?.maxRetries ?? DEFAULT_UPSERT_RETRIES);
  let upserted = 0;

  for (let index = 0; index < rows.length; index += batchSize) {
    const batch = rows.slice(index, index + batchSize);

    for (let attempt = 0; ; attempt += 1) {
      try {
        const { error } = await supabase
          .from("nhl_xg_shot_predictions" as any)
          .upsert(batch as any, {
            onConflict: "model_version,prediction_type,game_id,event_id"
          });

        if (error) throw error;
        break;
      } catch (error) {
        if (attempt >= maxRetries || !isRetryableSupabaseError(error)) {
          throw new Error(
            `Failed to upsert nhl_xg_shot_predictions at row ${index}: ${getErrorMessage(error)}`
          );
        }

        await sleep(1000 * 2 ** attempt);
      }
    }

    upserted += batch.length;
  }

  return upserted;
}

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET" && req.method !== "POST") {
    res.setHeader("Allow", ["GET", "POST"]);
    return res.status(405).json({ success: false, error: "Method not allowed" });
  }

  const artifactPathResolution = resolveArtifactPath(req);
  if (isHealthRequest(req)) {
    const health = buildArtifactHealthResponse(artifactPathResolution);
    return res.status(health.statusCode).json(health.body);
  }

  if (activeXgShotPredictionRun != null) {
    return res.status(409).json({
      success: false,
      error: "update-nhl-xg-shot-predictions is already running in this server process",
      activeRun: activeXgShotPredictionRun
    });
  }

  activeXgShotPredictionRun = {
    startedAt: new Date().toISOString(),
    url: req.url ?? null
  };

  try {
    const predictionType = parsePredictionType(firstQueryValue(req.query.predictionType));
    if (predictionType !== "shot_goal") {
      return res.status(501).json({
        success: false,
        predictionType,
        error:
          "Rebound-creation prediction storage is available, but no rebound model artifact contract has been approved yet."
      });
    }

    const modelArtifactPath = artifactPathResolution.path;
    if (!modelArtifactPath) {
      return res.status(400).json({
        success: false,
        requiredEnvVar: MODEL_ARTIFACT_PATH_ENV_VAR,
        error:
          `Provide modelArtifactPath or set ${MODEL_ARTIFACT_PATH_ENV_VAR} ` +
          "before scoring xG predictions."
      });
    }

    const artifact = loadXgModelArtifact(modelArtifactPath);
    const allowUnapproved = parseBoolean(firstQueryValue(req.query.allowUnapproved));
    const modelApproved = artifact.approvalGradeEligibility?.isEligible === true;

    if (!modelApproved && !allowUnapproved) {
      return res.status(409).json({
        success: false,
        artifactTag: artifact.artifactTag,
        modelFamily: artifact.family,
        modelApproved,
        error:
          "The selected xG artifact is not approval-grade. Re-run with allowUnapproved=true only for local diagnostics.",
        blockingReasons: artifact.approvalGradeEligibility?.blockingReasons ?? []
      });
    }

    const featureVersion = parseInteger(
      firstQueryValue(req.query.featureVersion),
      artifact.featureVersion ?? 1
    );
    const gameBatchSize = Math.max(
      1,
      parseInteger(firstQueryValue(req.query.gameBatchSize), DEFAULT_GAME_BATCH_SIZE)
    );
    const upsertBatchSize = Math.max(
      1,
      parseInteger(firstQueryValue(req.query.upsertBatchSize), DEFAULT_UPSERT_BATCH_SIZE)
    );
    const backfill = parseQueryFlag(req.query.backfill) || parseQueryFlag(req.query.games);
    const limit = parseOptionalInteger(firstQueryValue(req.query.limit));

    if (backfill) {
      const seasonId = await resolveSeasonId(req.query);
      const gameIds = new Set<number>();
      let featureRowCount = 0;
      let rowsUpserted = 0;
      let featureRowsScanned = 0;

      for (
        let from = 0;
        limit == null || featureRowCount < limit;
        from += PAGE_SIZE
      ) {
        const pageLimit = limit == null ? PAGE_SIZE : Math.min(PAGE_SIZE, limit - featureRowCount);
        const featureRows = await fetchPersistedFeatureRowsPage({
          seasonId,
          featureVersion,
          from,
          to: from + pageLimit - 1
        });

        if (featureRows.length === 0) break;

        featureRowsScanned += featureRows.length;
        const existingPredictionKeys = await fetchExistingPredictionKeys({
          modelVersion: artifact.artifactTag,
          predictionType,
          featureRows
        });
        const unscoredFeatureRows = featureRows
          .filter((row) => !existingPredictionKeys.has(predictionKey(row)))
          .slice(0, limit == null ? undefined : limit - featureRowCount);

        if (unscoredFeatureRows.length === 0) {
          if (featureRows.length < pageLimit) break;
          continue;
        }

        for (const row of unscoredFeatureRows) {
          gameIds.add(row.game_id);
        }

        const predictionRows = buildPredictionRows({
          featureRows: unscoredFeatureRows,
          artifact,
          modelArtifactPath,
          predictionType
        });

        featureRowCount += unscoredFeatureRows.length;
        rowsUpserted += await upsertPredictionRows(predictionRows, {
          batchSize: upsertBatchSize
        });

        if (featureRows.length < pageLimit) break;
      }

      return res.status(200).json({
        success: true,
        mode: "backfill_batch",
        seasonId,
        artifactTag: artifact.artifactTag,
        modelFamily: artifact.family,
        modelApproved,
        predictionType,
        featureVersion,
        requestedGameCount: gameIds.size,
        featureRows: featureRowCount,
        featureRowsScanned,
        rowsUpserted,
        batches: {
          featurePageSize: PAGE_SIZE,
          upsertBatchSize
        },
        notes: modelApproved
          ? []
          : [
              "This run used an unapproved model artifact because allowUnapproved=true was supplied."
            ]
      });
    }

    const selection = await resolveRequestedGameIds(req.query, supabase);

    if (selection.gameIds.length === 0) {
      return res.status(200).json({
        success: true,
        mode: selection.mode,
        seasonId: selection.seasonId,
        artifactTag: artifact.artifactTag,
        modelFamily: artifact.family,
        modelApproved,
        predictionType,
        featureVersion,
        requestedGameCount: 0,
        featureRows: 0,
        rowsUpserted: 0,
        message:
          "No matching persisted shot features require prediction materialization for this selection."
      });
    }

    let featureRowCount = 0;
    let rowsUpserted = 0;

    for (const gameIdBatch of chunkNumbers(selection.gameIds, gameBatchSize)) {
      const featureRows = await fetchPersistedFeatureRows({
        supabase,
        gameIds: gameIdBatch,
        featureVersion,
        limit: null
      });

      if (featureRows.length === 0) continue;

      const predictionRows = featureRows.map((feature) => {
        const probabilities = predictShotGoalProbabilities(feature.feature_payload, artifact);
        return buildPredictionDbRow({
          feature,
          artifact,
          modelArtifactPath,
          predictionType,
          rawProbability: probabilities.rawProbability,
          calibratedProbability: probabilities.calibratedProbability,
          xg: probabilities.xg
        });
      });

      featureRowCount += featureRows.length;
      rowsUpserted += await upsertPredictionRows(predictionRows, {
        batchSize: upsertBatchSize
      });
    }

    return res.status(200).json({
      success: true,
      mode: selection.mode,
      seasonId: selection.seasonId,
      artifactTag: artifact.artifactTag,
      modelFamily: artifact.family,
      modelApproved,
      predictionType,
      featureVersion,
      requestedGameCount: selection.gameIds.length,
      featureRows: featureRowCount,
      rowsUpserted,
      batches: {
        gameBatchSize,
        upsertBatchSize
      },
      notes: modelApproved
        ? []
        : [
            "This run used an unapproved model artifact because allowUnapproved=true was supplied."
          ]
    });
  } finally {
    activeXgShotPredictionRun = null;
  }
}

export default withCronJobAudit(handler, {
  jobName: "update-nhl-xg-shot-predictions"
});
