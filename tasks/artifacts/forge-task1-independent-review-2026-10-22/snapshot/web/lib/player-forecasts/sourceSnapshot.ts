import crypto from "crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { timestampMicros } from "../projections/evidenceTime";

export type PlannedSourceObservation = {
  id: string; provider: string; dataset_key: string; entity_kind: string; entity_key: string;
  source_url: string | null; source_revision_key: string | null;
  observed_at: string; available_at: string; payload_hash: string; payload: unknown; metadata: Record<string, unknown>;
};
export const SOURCE_OBSERVATION_COLUMNS = "id,provider,dataset_key,entity_kind,entity_key,source_url,source_revision_key,observed_at,available_at,payload_hash,payload,metadata";
export function validPlannedObservationId(value: string) {
  return /^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(value);
}
export function matchesPlannedObservation(actual: any, expected: PlannedSourceObservation): boolean {
  return !!actual && ["id", "provider", "dataset_key", "entity_kind", "entity_key", "source_url", "source_revision_key", "payload_hash"]
    .every(key => actual[key] === expected[key as keyof PlannedSourceObservation])
    && ["observed_at", "available_at"].every(key => timestampMicros(expected[key as "observed_at"]) !== null
      && timestampMicros(actual[key]) === timestampMicros(expected[key as "observed_at"]))
    && actual.payload_hash === playerForecastSourcePayloadHash(actual.payload)
    && playerForecastSourcePayloadHash(actual.payload) === playerForecastSourcePayloadHash(expected.payload)
    && playerForecastSourcePayloadHash(actual.metadata) === playerForecastSourcePayloadHash(expected.metadata);
}
export async function verifyPlannedObservation(db: SupabaseClient<any>, expected: PlannedSourceObservation) {
  const { data, error } = await db.from("player_forecast_source_observations").select(SOURCE_OBSERVATION_COLUMNS).eq("id", expected.id).limit(2);
  if (error || !Array.isArray(data) || data.length !== 1 || !matchesPlannedObservation(data[0], expected)) {
    throw new Error("Planned source observation conflicts or cannot be verified.");
  }
}

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
  observationId?: string;
}): Promise<{ inserted: boolean; payloadHash: string }> {
  const availableAt = args.availableAt ?? new Date().toISOString();
  const observedAt = args.observedAt ?? availableAt;
  const payloadHash = playerForecastSourcePayloadHash(args.payload);
  if (args.observationId !== undefined && !validPlannedObservationId(args.observationId)) throw new Error("Invalid planned observation ID.");
  const row = {
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
      ...(args.observationId !== undefined ? { id: args.observationId } : {}),
    };
  const { error } = await args.supabase.from("player_forecast_source_observations").insert(row);
  if (error?.code === "23505") {
    if (args.observationId) await verifyPlannedObservation(args.supabase, row as PlannedSourceObservation);
    return { inserted: false, payloadHash };
  }
  if (error) throw error;
  return { inserted: true, payloadHash };
}

