import type { SupabaseClient } from "@supabase/supabase-js";
import { timestampMicros } from "../projections/evidenceTime";
import { withinDeadline } from "../rosterScheduleData/planningInputs";
import { resolveNativeCatalogEnvironment, unavailableNativeCatalogEnvironment, type NativeCatalogHead } from "./nativeCatalogHead";
import { validPlannedObservationId } from "./sourceSnapshot";

/** Same budget as the planning head read; a miss counts as an unavailable head. */
export const FORECAST_SERVING_DEADLINE_MS = 8000;
export type NativeUnavailableReason = "native_catalog_head_unavailable_or_invalid" | "native_catalog_expired";
type ServingEnvironment = Readonly<Record<string, string | undefined>>;
/** `environment` is what the forecast loaders read: the process env before
 * activation, the head's pins only for native, and blank pins otherwise. */
export type ForecastServingSource =
  | { kind: "legacy"; reason: "native_not_activated"; environment: ServingEnvironment }
  | { kind: "native"; headId: string; headRevision: number; issuedAt: string; expiresAt: string; environment: ServingEnvironment }
  | { kind: "legacy_flagged" | "empty"; reason: NativeUnavailableReason; environment: ServingEnvironment };
export type ForecastSourceSummary = { kind: ForecastServingSource["kind"]; headRevision: number | null; expiresAt: string | null; reason: string | null };

const micros = (value: unknown) => typeof value === "string" ? Number(timestampMicros(value) ?? NaN) : NaN;

/** Pre-activation is legacy; a configured but unusable head never keeps the process pins (D-2: anything but `legacy_flagged` is `empty`). */
export function unavailableForecastServingSource(env: ServingEnvironment, reason: NativeUnavailableReason = "native_catalog_head_unavailable_or_invalid"): ForecastServingSource {
  if (!env.PLAYER_FORECAST_NATIVE_CATALOG_HEAD_ID) return { kind: "legacy", reason: "native_not_activated", environment: env };
  return { kind: env.FORGE_NATIVE_SERVING_FALLBACK === "legacy_flagged" ? "legacy_flagged" : "empty", reason,
    environment: unavailableNativeCatalogEnvironment({ ...env }).environment };
}

export function forecastSourceSummary(source: ForecastServingSource): ForecastSourceSummary {
  return source.kind === "native" ? { kind: "native", headRevision: source.headRevision, expiresAt: source.expiresAt, reason: null }
    : { kind: source.kind, headRevision: null, expiresAt: null, reason: source.reason };
}

function linkSignals(deadline: AbortSignal, external?: AbortSignal) {
  if (!external) return deadline;
  const controller = new AbortController(), abort = () => controller.abort();
  if (deadline.aborted || external.aborted) abort();
  deadline.addEventListener("abort", abort, { once: true }); external.addEventListener("abort", abort, { once: true });
  return controller.signal;
}

/** The immutable selection row behind a head, read for its issuance window only.
 * On success the resolver has already validated this row against the same clock. */
async function readSelectionWindow(db: SupabaseClient<any>, headId: string, seasonId: number, signal: AbortSignal, known?: NativeCatalogHead) {
  let head = known;
  if (!head) {
    const result = await db.from("native_forecast_catalog_heads").select("id,season_id,revision,observation_id,payload_hash").eq("id", headId).limit(2).abortSignal(signal);
    if (result.error || !Array.isArray(result.data) || result.data.length !== 1 || result.data[0].season_id !== seasonId) return null;
    head = result.data[0] as NativeCatalogHead;
  }
  const result = await db.from("player_forecast_source_observations").select("id,payload_hash,payload").eq("id", head.observation_id).limit(2).abortSignal(signal);
  const row = Array.isArray(result.data) && result.data.length === 1 ? result.data[0] : null;
  const issuedAt = row?.payload?.issuedAt, expiresAt = row?.payload?.expiresAt;
  if (result.error || !row || row.payload_hash !== head.payload_hash || !Number.isFinite(micros(issuedAt)) || !Number.isFinite(micros(expiresAt))) return null;
  return { head, issuedAt: issuedAt as string, expiresAt: expiresAt as string };
}

/** The single server-side forecast source for Start Chart, RSO and FORGE (one call per request).
 * `seasonId` may be lazy so pre-activation requests make no lookups at all. */
export async function selectForecastServingSource(db: SupabaseClient<any>, seasonId: number | (() => Promise<number>), now = new Date(),
  env: ServingEnvironment = process.env, signal?: AbortSignal): Promise<ForecastServingSource> {
  const headId = env.PLAYER_FORECAST_NATIVE_CATALOG_HEAD_ID;
  if (!headId) return unavailableForecastServingSource(env);
  try {
    return await withinDeadline(Date.now() + FORECAST_SERVING_DEADLINE_MS, async deadlineSignal => {
      const linked = linkSignals(deadlineSignal, signal);
      const season = typeof seasonId === "function" ? await seasonId() : seasonId;
      const resolved = await resolveNativeCatalogEnvironment(db, season, now, { ...env }, linked);
      const expired = (window: { expiresAt: string } | null) => !!window && micros(window.expiresAt) <= now.getTime() * 1000;
      if (resolved.selection) {
        const window = await readSelectionWindow(db, headId, season, linked, resolved.selection);
        if (!window || expired(window)) return unavailableForecastServingSource(env, window ? "native_catalog_expired" : undefined);
        return { kind: "native", headId, headRevision: window.head.revision, issuedAt: window.issuedAt, expiresAt: window.expiresAt, environment: resolved.environment };
      }
      // The resolver reports every failure alike; only an expired selection gets its own reason.
      const window = validPlannedObservationId(headId) ? await readSelectionWindow(db, headId, season, linked).catch(() => null) : null;
      return unavailableForecastServingSource(env, expired(window) ? "native_catalog_expired" : undefined);
    });
  } catch { return unavailableForecastServingSource(env); }
}
