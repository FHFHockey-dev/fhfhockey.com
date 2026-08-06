import crypto from "crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, nested]) => [key, canonicalize(nested)]),
    );
  }
  return value;
}

export function playerForecastSourcePayloadHash(payload: unknown): string {
  return crypto
    .createHash("sha256")
    .update(JSON.stringify(canonicalize(payload)))
    .digest("hex");
}

export async function capturePlayerForecastSourceObservation(args: {
  supabase: SupabaseClient<any>;
  provider: string;
  datasetKey: string;
  entityKind: string;
  entityKey: string;
  sourceUrl?: string | null;
  sourceRevisionKey?: string | null;
  observedAt?: string;
  availableAt?: string;
  payload: unknown;
  metadata?: Record<string, unknown>;
}): Promise<{ inserted: boolean; payloadHash: string }> {
  const availableAt = args.availableAt ?? new Date().toISOString();
  const observedAt = args.observedAt ?? availableAt;
  const payloadHash = playerForecastSourcePayloadHash(args.payload);
  const { error } = await args.supabase
    .from("player_forecast_source_observations")
    .insert({
      provider: args.provider,
      dataset_key: args.datasetKey,
      entity_kind: args.entityKind,
      entity_key: args.entityKey,
      source_url: args.sourceUrl ?? null,
      source_revision_key: args.sourceRevisionKey ?? null,
      observed_at: observedAt,
      available_at: availableAt,
      payload_hash: payloadHash,
      payload: args.payload,
      metadata: args.metadata ?? {},
    });
  if (error?.code === "23505") return { inserted: false, payloadHash };
  if (error) throw error;
  return { inserted: true, payloadHash };
}

