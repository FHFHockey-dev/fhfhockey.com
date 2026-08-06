import crypto from "crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

export const PLAYER_FORECAST_ARTIFACT_BUCKET = "player-forecast-models";

function safeSegment(value: string): string {
  const normalized = value.trim().toLowerCase().replace(/[^a-z0-9._-]+/g, "-");
  if (!normalized || normalized === "." || normalized === "..") {
    throw new Error("Artifact path segment is invalid.");
  }
  return normalized;
}

export async function ensurePlayerForecastArtifactBucket(
  supabase: SupabaseClient<any>,
): Promise<void> {
  const { data, error } = await supabase.storage.getBucket(PLAYER_FORECAST_ARTIFACT_BUCKET);
  if (data && !error) {
    if (data.public) throw new Error("Player forecast artifact bucket must remain private.");
    return;
  }
  const { error: createError } = await supabase.storage.createBucket(
    PLAYER_FORECAST_ARTIFACT_BUCKET,
    { public: false },
  );
  if (createError && !/already exists|duplicate/i.test(createError.message)) {
    throw createError;
  }
}

export async function uploadPlayerForecastArtifact(args: {
  supabase: SupabaseClient<any>;
  modelKey: string;
  filename: string;
  bytes: Uint8Array;
  contentType?: string;
}): Promise<{ uri: string; checksum: string; path: string }> {
  await ensurePlayerForecastArtifactBucket(args.supabase);
  const checksum = crypto.createHash("sha256").update(args.bytes).digest("hex");
  const path = `${safeSegment(args.modelKey)}/${checksum}/${safeSegment(args.filename)}`;
  const { error } = await args.supabase.storage
    .from(PLAYER_FORECAST_ARTIFACT_BUCKET)
    .upload(path, args.bytes, {
      contentType: args.contentType ?? "application/octet-stream",
      upsert: false,
    });
  if (error && !/already exists|duplicate/i.test(error.message)) throw error;
  return {
    uri: `supabase://${PLAYER_FORECAST_ARTIFACT_BUCKET}/${path}`,
    checksum,
    path,
  };
}

