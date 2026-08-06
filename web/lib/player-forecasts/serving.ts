import crypto from "crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

import {
  PLAYER_FORECAST_ARTIFACT_BUCKET,
  uploadPlayerForecastArtifact,
} from "./artifacts";
import {
  PLAYER_FORECAST_APPROVED_CONTRACTS,
  PLAYER_FORECAST_VALIDATION_CONTRACT_VERSION,
} from "./researchContract";

type JsonObject = Record<string, any>;

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
        .map(([key, nested]) => [key, canonicalize(nested)]),
    );
  }
  return value;
}

export function playerForecastCanonicalHash(value: unknown): string {
  const encoded = JSON.stringify(canonicalize(value)).replace(
    /[\u007f-\uffff]/g,
    (character) => `\\u${character.charCodeAt(0).toString(16).padStart(4, "0")}`,
  );
  return crypto
    .createHash("sha256")
    .update(encoded)
    .digest("hex");
}

export function verifyPlayerForecastArtifact(artifact: JsonObject): void {
  const checksum = artifact.artifactChecksum;
  if (typeof checksum !== "string" || !checksum) {
    throw new Error("Player forecast artifact checksum is missing.");
  }
  const canonicalPayload = artifact.canonicalPayload;
  const unsigned = typeof canonicalPayload === "string"
    ? canonicalPayload
    : Object.fromEntries(Object.entries(artifact).filter(([key]) => key !== "artifactChecksum"));
  const actual = typeof unsigned === "string"
    ? crypto.createHash("sha256").update(unsigned).digest("hex")
    : playerForecastCanonicalHash(unsigned);
  if (actual !== checksum) {
    throw new Error("Player forecast artifact checksum mismatch.");
  }
  const payload = typeof canonicalPayload === "string" ? JSON.parse(canonicalPayload) : artifact;
  if (PLAYER_FORECAST_APPROVED_CONTRACTS[payload.contractVersion] !== payload.contractChecksum) {
    throw new Error("Player forecast artifact research contract mismatch.");
  }
}

function checksumUuid(checksum: string): string {
  const bytes = Buffer.from(checksum.slice(0, 32), "hex");
  bytes[6] = (bytes[6]! & 0x0f) | 0x50;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;
  const hex = bytes.toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export function createPlayerForecastServingArtifact(
  offlineArtifact: JsonObject,
  options: {
    sourceChecksumVerifiedExternally?: boolean;
    primaryReceiptChecksum?: string;
    lockboxEvidenceChecksum?: string;
  } = {},
): JsonObject {
  if (!options.sourceChecksumVerifiedExternally) verifyPlayerForecastArtifact(offlineArtifact);
  if (PLAYER_FORECAST_APPROVED_CONTRACTS[offlineArtifact.contractVersion] !== offlineArtifact.contractChecksum) {
    throw new Error("Player forecast artifact research contract mismatch.");
  }
  const sourceArtifactChecksum = String(offlineArtifact.artifactChecksum);
  if (offlineArtifact.lockboxReady === true && (!options.primaryReceiptChecksum || !options.lockboxEvidenceChecksum)) {
    throw new Error("Lockbox-ready artifacts require their primary receipt and evidence companion.");
  }
  const servingFormatVersion = "canonical-payload-envelope-v2";
  const servingPayload: JsonObject = {
    ...offlineArtifact,
    id: checksumUuid(playerForecastCanonicalHash({ sourceArtifactChecksum, servingFormatVersion })),
    sourceArtifactChecksum,
    servingFormatVersion,
    servingChannel: "private_shadow",
    primaryReceiptChecksum: options.primaryReceiptChecksum ?? null,
    lockboxEvidenceChecksum: options.lockboxEvidenceChecksum ?? null,
  };
  delete servingPayload.artifactChecksum;
  const canonicalPayload = JSON.stringify(canonicalize(servingPayload));
  return {
    canonicalPayload,
    artifactChecksum: crypto.createHash("sha256").update(canonicalPayload).digest("hex"),
  };
}

export async function registerPlayerForecastServingArtifact(args: {
  supabase: SupabaseClient<any>;
  offlineArtifact: JsonObject;
  sourceChecksumVerifiedExternally?: boolean;
  evidenceDocuments?: {
    primaryReceipt: Uint8Array;
    receiptChecksum: string;
    companion: Uint8Array;
    evidenceChecksum: string;
  };
}): Promise<{ id: string; checksum: string; uri: string; artifact: JsonObject }> {
  const artifact = createPlayerForecastServingArtifact(args.offlineArtifact, {
    sourceChecksumVerifiedExternally: args.sourceChecksumVerifiedExternally,
    primaryReceiptChecksum: args.evidenceDocuments?.receiptChecksum,
    lockboxEvidenceChecksum: args.evidenceDocuments?.evidenceChecksum,
  });
  const artifactPayload = JSON.parse(String(artifact.canonicalPayload));
  const bytes = new TextEncoder().encode(JSON.stringify(canonicalize(artifact)));
  const uploaded = await uploadPlayerForecastArtifact({
    supabase: args.supabase,
    modelKey: String(artifactPayload.modelKey),
    filename: "model-artifact.json",
    bytes,
    contentType: "application/json",
  });
  const populations = Object.keys(artifactPayload.segments ?? {}).sort();
  const targetKeys = Array.from(new Set([
    ...Object.keys(artifactPayload.targets ?? {}),
    ...Object.values(artifactPayload.segments ?? {}).flatMap((targets: any) => Object.keys(targets ?? {})),
  ])).sort();
  const primaryReceiptUpload = args.evidenceDocuments
    ? await uploadPlayerForecastArtifact({
        supabase: args.supabase,
        modelKey: String(artifactPayload.modelKey),
        filename: "primary-lockbox-receipt.json",
        bytes: args.evidenceDocuments.primaryReceipt,
        contentType: "application/json",
      })
    : null;
  const evidenceUpload = args.evidenceDocuments
    ? await uploadPlayerForecastArtifact({
        supabase: args.supabase,
        modelKey: String(artifactPayload.modelKey),
        filename: "lockbox-evidence.json",
        bytes: args.evidenceDocuments.companion,
        contentType: "application/json",
      })
    : null;
  const { error } = await args.supabase
    .from("player_forecast_model_artifacts")
    .upsert({
      id: artifactPayload.id,
      model_key: artifactPayload.modelKey,
      model_version: artifactPayload.modelVersion,
      feature_schema_version: artifactPayload.featureSchemaVersion,
      calibration_version: "development-diagnostics-v1",
      population: "opportunity",
      target_keys: targetKeys,
      horizon_min: 1,
      horizon_max: 10,
      artifact_uri: uploaded.uri,
      artifact_checksum: uploaded.checksum,
      training_cutoff_at: `${artifactPayload.trainingCutoffInclusive}T23:59:59Z`,
      code_version: artifactPayload.modelVersion,
      lifecycle_status: "shadow",
      evidence: {
        contractVersion: artifactPayload.contractVersion,
        evidenceClassification: artifactPayload.evidenceClassification ?? null,
        consumedLockboxRead: artifactPayload.consumedLockboxRead ?? null,
        sourceArtifactChecksum: artifactPayload.sourceArtifactChecksum,
        payloadChecksum: artifact.artifactChecksum,
        populations,
        lockboxReview: artifactPayload.lockboxReview ?? null,
        promotionEligible: false,
        primaryReceipt: primaryReceiptUpload ? {
          uri: primaryReceiptUpload.uri,
          blobChecksum: primaryReceiptUpload.checksum,
          documentChecksum: args.evidenceDocuments?.receiptChecksum,
        } : null,
        lockboxEvidence: evidenceUpload ? {
          uri: evidenceUpload.uri,
          blobChecksum: evidenceUpload.checksum,
          documentChecksum: args.evidenceDocuments?.evidenceChecksum,
        } : null,
      },
    }, { onConflict: "id", ignoreDuplicates: true });
  if (error) throw error;
  return { id: artifactPayload.id, checksum: uploaded.checksum, uri: uploaded.uri, artifact };
}

function storagePath(uri: string): string {
  const prefix = `supabase://${PLAYER_FORECAST_ARTIFACT_BUCKET}/`;
  if (!uri.startsWith(prefix)) throw new Error("Unsupported player forecast artifact URI.");
  return uri.slice(prefix.length);
}

export async function ensureValidationFeatureSnapshots(args: {
  supabase: SupabaseClient<any>;
  artifactPayload: JsonObject;
  featureSchemaVersion: string;
  gameId: number;
  teamId: number;
  horizon: number;
  sourceHighWatermark: string;
  seasonId: number;
  gameStartTime: string;
  opponentTeamId: number;
  homeIndicator: number;
  restDays: number;
}): Promise<void> {
  const { data, error } = await args.supabase.rpc("build_player_forecast_runtime_features", {
    p_team_id: args.teamId,
    p_opponent_team_id: args.opponentTeamId,
    p_season_id: args.seasonId,
    p_cutoff_at: args.sourceHighWatermark,
  } as never);
  if (error) throw error;
  if (!Array.isArray(data) || data.length === 0) {
    throw new Error("No current skater candidates are available for validation inference.");
  }
  const rows = data.map((featureRow: any) => {
    const identityHash = playerForecastCanonicalHash({
      gameId: args.gameId,
      teamId: args.teamId,
      playerId: Number(featureRow.player_id),
      horizon: args.horizon,
      sourceHighWatermark: args.sourceHighWatermark,
      featureSchemaVersion: args.featureSchemaVersion,
      contractChecksum: args.artifactPayload.contractChecksum,
      opponentTeamId: args.opponentTeamId,
      homeIndicator: args.homeIndicator,
      restDays: args.restDays,
    });
    const id = checksumUuid(identityHash);
    const targetModels = args.artifactPayload.segments?.[featureRow.population] ?? {};
    const features = Object.fromEntries(
      Object.entries(featureRow.features ?? {}).map(([targetKey, targetFeatures]: [string, any]) => [
        targetKey,
        {
          ...(targetFeatures ?? {}),
          opponent_team_id: args.opponentTeamId,
          home_indicator: args.homeIndicator,
          rest_days: args.restDays,
        },
      ]),
    );
    const unsigned = {
      id,
      contractChecksum: args.artifactPayload.contractChecksum,
      sourceHighWatermark: args.sourceHighWatermark,
      rows: Object.entries(targetModels).map(([targetKey, targetModel]: [string, any]) => ({
        playerId: Number(featureRow.player_id),
        population: featureRow.population,
        targetKey,
        conditioning: "conditional_playing",
        features: features[targetKey] ?? {},
        candidate: targetModel.candidate,
        issuedAt: args.sourceHighWatermark,
        gameStartTime: args.gameStartTime,
      })),
    };
    return {
      id,
      content_hash: playerForecastCanonicalHash(unsigned),
      game_id: args.gameId,
      team_id: args.teamId,
      player_id: Number(featureRow.player_id),
      population: featureRow.population,
      team_game_horizon: args.horizon,
      cutoff_at: args.sourceHighWatermark,
      feature_schema_version: args.featureSchemaVersion,
      source_high_watermark: args.sourceHighWatermark,
      features,
      missingness: featureRow.missingness ?? {},
      fallback_flags: [
        "validation_only",
        ...(featureRow.missingness?.no_completed_game_history ? ["position_prior_fallback"] : []),
      ],
      source_manifest: featureRow.source_manifest ?? [],
    };
  });
  const { error: insertError } = await args.supabase
    .from("player_forecast_feature_snapshots")
    .upsert(rows, { onConflict: "id", ignoreDuplicates: true });
  if (insertError) throw insertError;
}

export async function loadPlayerForecastInferenceInputs(args: {
  supabase: SupabaseClient<any>;
  gameId: number;
  teamId: number;
  horizon: number;
  sourceHighWatermark: string;
}): Promise<{
  modelArtifact: JsonObject;
  featureSnapshots: JsonObject[];
  researchContractVersion: string;
  researchContractChecksum: string;
}> {
  const { modelArtifact, artifactPayload, registry } = await loadLatestPlayerForecastServingArtifact(args.supabase);
  const validationContract = artifactPayload.contractVersion === PLAYER_FORECAST_VALIDATION_CONTRACT_VERSION;
  let gameStartTime: string | null = null;
  let seasonId: number | null = null;
  if (validationContract) {
    const { data: game, error: gameError } = await args.supabase
      .from("games")
      .select("seasonId,date,startTime,homeTeamId,awayTeamId")
      .eq("id", args.gameId)
      .maybeSingle();
    if (gameError) throw gameError;
    if (!game?.startTime) throw new Error("Validation inference requires the target game's start time.");
    gameStartTime = new Date(game.startTime).toISOString();
    seasonId = Number(game.seasonId);
    const homeIndicator = Number(game.homeTeamId) === args.teamId ? 1 : 0;
    const opponentTeamId = homeIndicator ? Number(game.awayTeamId) : Number(game.homeTeamId);
    const { data: previousGame, error: previousGameError } = await args.supabase
      .from("games")
      .select("date,startTime")
      .eq("seasonId", seasonId)
      .eq("type", 2)
      .or(`homeTeamId.eq.${args.teamId},awayTeamId.eq.${args.teamId}`)
      .lt("startTime", gameStartTime)
      .order("startTime", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (previousGameError) throw previousGameError;
    const restDays = previousGame?.date
      ? Math.max(0, Math.round(
        (Date.parse(`${game.date}T00:00:00Z`) - Date.parse(`${previousGame.date}T00:00:00Z`)) / 86_400_000,
      ) - 1)
      : 0;
    await ensureValidationFeatureSnapshots({
      supabase: args.supabase,
      artifactPayload,
      featureSchemaVersion: String(registry.feature_schema_version),
      gameId: args.gameId,
      teamId: args.teamId,
      horizon: args.horizon,
      sourceHighWatermark: args.sourceHighWatermark,
      seasonId,
      gameStartTime,
      opponentTeamId,
      homeIndicator,
      restDays,
    });
  }
  const { data: rows, error: snapshotError } = await args.supabase
    .from("player_forecast_feature_snapshots")
    .select("id,content_hash,player_id,population,features,source_high_watermark,cutoff_at")
    .eq("game_id", args.gameId)
    .eq("team_id", args.teamId)
    .eq("team_game_horizon", args.horizon)
    .eq("feature_schema_version", registry.feature_schema_version)
    .lte("cutoff_at", args.sourceHighWatermark)
    .order("cutoff_at", { ascending: false });
  if (snapshotError) throw snapshotError;
  const latestByPlayer = new Map<number, any>();
  for (const row of rows ?? []) {
    if (!latestByPlayer.has(Number(row.player_id))) latestByPlayer.set(Number(row.player_id), row);
  }
  const featureSnapshots = Array.from(latestByPlayer.values()).map((row) => {
    const targetModels = artifactPayload.segments?.[row.population] ?? {};
    const unsigned: JsonObject = {
      id: row.id,
      contractChecksum: artifactPayload.contractChecksum,
      sourceHighWatermark: args.sourceHighWatermark,
      rows: Object.entries(targetModels).map(([targetKey, targetModel]: [string, any]) => ({
        playerId: Number(row.player_id),
        population: row.population,
        targetKey,
        conditioning: "conditional_playing",
        features:
          row.features?.[targetKey] && typeof row.features[targetKey] === "object"
            ? row.features[targetKey]
            : row.features,
        candidate: targetModel.candidate,
        ...(validationContract ? {
          issuedAt: new Date(row.cutoff_at).toISOString(),
          gameStartTime,
        } : {}),
      })),
    };
    const encoded = { ...unsigned, contentHash: playerForecastCanonicalHash(unsigned) };
    const rowWatermark = new Date(row.source_high_watermark).toISOString();
    const claimedWatermark = new Date(args.sourceHighWatermark).toISOString();
    if (encoded.contentHash !== row.content_hash || rowWatermark !== claimedWatermark) {
      throw new Error(`Feature snapshot ${row.id} is not bound to the claimed source watermark.`);
    }
    return encoded;
  });
  if (featureSnapshots.length === 0) {
    throw new Error("No cutoff-safe player forecast feature snapshots are available.");
  }
  return {
    modelArtifact,
    featureSnapshots,
    researchContractVersion: String(artifactPayload.contractVersion),
    researchContractChecksum: String(artifactPayload.contractChecksum),
  };
}

export async function loadLatestPlayerForecastServingArtifact(
  supabase: SupabaseClient<any>,
): Promise<{ modelArtifact: JsonObject; artifactPayload: JsonObject; registry: JsonObject }> {
  const { data: registry, error: registryError } = await supabase
    .from("player_forecast_model_artifacts")
    .select("id,artifact_uri,artifact_checksum,feature_schema_version")
    .eq("lifecycle_status", "shadow")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (registryError) throw registryError;
  if (!registry) throw new Error("No private-shadow player forecast artifact is registered.");
  const { data: artifactBlob, error: downloadError } = await supabase.storage
    .from(PLAYER_FORECAST_ARTIFACT_BUCKET)
    .download(storagePath(registry.artifact_uri));
  if (downloadError) throw downloadError;
  const artifactBytes = new Uint8Array(await artifactBlob.arrayBuffer());
  const storageChecksum = crypto.createHash("sha256").update(artifactBytes).digest("hex");
  if (storageChecksum !== registry.artifact_checksum) {
    throw new Error("Downloaded player forecast artifact checksum mismatch.");
  }
  const modelArtifact = JSON.parse(new TextDecoder().decode(artifactBytes));
  verifyPlayerForecastArtifact(modelArtifact);
  const artifactPayload = typeof modelArtifact.canonicalPayload === "string"
    ? JSON.parse(modelArtifact.canonicalPayload)
    : modelArtifact;
  if (artifactPayload.id !== registry.id) {
    throw new Error("Player forecast registry identity does not match its artifact.");
  }

  return { modelArtifact, artifactPayload, registry };
}
