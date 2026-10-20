import type { SupabaseClient } from "@supabase/supabase-js";
import type { ContributionAllowedUses, ContributionParticipation } from "./contributions";
import { buildSkaterParticipationReceipt, participationFromReceipt,
  type SkaterParticipationInput, type SkaterParticipationReceipt, buildFrozenWindowSkaterParticipationReceipt,
  type FrozenWindowSkaterParticipationInput, type FrozenWindowSkaterParticipationReceipt, buildRosterObservationSkaterParticipationReceipt,
  type RosterObservationSkaterParticipationInput, type RosterObservationSkaterParticipationReceipt } from "./modeledSkaterParticipation";
import { buildRollingWindowSkaterParticipationReceipt, type RollingWindowSkaterParticipationInput,
  type RollingWindowSkaterParticipationReceipt } from "./rollingWindowParticipation";
import { playerForecastSourcePayloadHash } from "./sourceSnapshot";
import { timestampMicros } from "../projections/evidenceTime";

export const PARTICIPATION_DATASET = "skater-participation-bundle-v1";
export const FROZEN_WINDOW_SKATER_PARTICIPATION_DATASET = "skater-frozen-window-participation-bundle-v1";
export const ROSTER_OBSERVATION_SKATER_PARTICIPATION_DATASET = "skater-roster-observation-participation-bundle-v1";
export const ROLLING_WINDOW_SKATER_PARTICIPATION_DATASET = "skater-rolling-14d-participation-bundle-v1";
export const SKATER_PARTICIPATION_RELEASE_LIMITS = Object.freeze({
  releases: 8, bundleEntries: 500, bundleBytes: 8 * 1024 * 1024,
  // Owned17 + candidate45 skaters ×20games =1240entries. The measured600-entry
  // preparation uses5.81MB; at its largest11.5KB entry,1240need14.3MB.
  aggregateEntries: 1500, aggregateBytes: 24 * 1024 * 1024,
});
export type SkaterParticipationBundle = {
  version: typeof PARTICIPATION_DATASET; seasonId: number; issuedAt: string; expiresAt: string;
  released: boolean; allowedUses: ContributionAllowedUses;
  /** References to exact external owner/reviewer decisions; no performance threshold implied. */
  ownerApprovalRef: string; reviewRef: string;
  entries: Array<{ input: SkaterParticipationInput; receipt: SkaterParticipationReceipt }>;
};
export type FrozenWindowSkaterParticipationBundle = Omit<SkaterParticipationBundle, "version" | "entries"> & {
  version: typeof FROZEN_WINDOW_SKATER_PARTICIPATION_DATASET;
  entries: Array<{ input: FrozenWindowSkaterParticipationInput; receipt: FrozenWindowSkaterParticipationReceipt }>;
};
export type RosterObservationSkaterParticipationBundle = Omit<SkaterParticipationBundle, "version" | "entries"> & {
  version: typeof ROSTER_OBSERVATION_SKATER_PARTICIPATION_DATASET;
  entries: Array<{ input: RosterObservationSkaterParticipationInput; receipt: RosterObservationSkaterParticipationReceipt }>;
};
export type RollingWindowSkaterParticipationBundle = Omit<SkaterParticipationBundle, "version" | "entries"> & {
  version: typeof ROLLING_WINDOW_SKATER_PARTICIPATION_DATASET;
  entries: Array<{ input: RollingWindowSkaterParticipationInput; receipt: RollingWindowSkaterParticipationReceipt }>;
};
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const HASH = /^[0-9a-f]{64}$/;
const nonempty = (value: unknown) => typeof value === "string" && value.trim().length > 0;
const time = (value: string) => { const parsed = timestampMicros(value); return parsed === null ? NaN : Number(parsed); };

/** One bounded read of exact ID:payload-hash releases. Default disabled, no writes.
 * Reproduction authenticates arithmetic, not source truth: publication review must
 * establish genuine complete eligibility/label inputs before allowlisting bytes. */
async function loadSkaterParticipation(db: SupabaseClient<any>, seasonId: number, now: Date,
  options: { environment?: Record<string, string | undefined>; signal?: AbortSignal }, mode: "current" | "frozen" | "roster_observation" | "rolling"): Promise<{
    sources: ContributionParticipation[]; checksum: string | null; limitations: string[];
  }> {
  const frozen = mode !== "current";
  const dataset = mode === "rolling" ? ROLLING_WINDOW_SKATER_PARTICIPATION_DATASET
    : mode === "roster_observation" ? ROSTER_OBSERVATION_SKATER_PARTICIPATION_DATASET
    : frozen ? FROZEN_WINDOW_SKATER_PARTICIPATION_DATASET : PARTICIPATION_DATASET;
  const empty = (reason: string) => ({ sources: [], checksum: null, limitations: [reason] });
  const releases = (options.environment ?? process.env)[mode === "rolling" ? "PLAYER_FORECAST_ROLLING_14D_SKATER_PARTICIPATION_RELEASES"
    : mode === "roster_observation" ? "PLAYER_FORECAST_ROSTER_OBSERVATION_SKATER_PARTICIPATION_RELEASES"
    : frozen ? "PLAYER_FORECAST_FROZEN_WINDOW_SKATER_PARTICIPATION_RELEASES" : "PLAYER_FORECAST_PARTICIPATION_RELEASES"]
    ?.split(",").map(value => value.trim()).filter(Boolean) ?? [];
  if (!releases.length) return empty("modeled_participation_serving_disabled");
  const pins = releases.map(value => value.split(":"));
  if (!Number.isSafeInteger(seasonId) || !Number.isFinite(now.getTime()) || pins.length > SKATER_PARTICIPATION_RELEASE_LIMITS.releases
    || pins.some(pin => pin.length !== 2 || !UUID.test(pin[0]) || !HASH.test(pin[1]))
    || new Set(pins.map(pin => pin[0])).size !== pins.length) return empty("invalid_participation_release_allowlist");
  let query = db.from("player_forecast_source_observations")
    .select("id,provider,dataset_key,entity_kind,entity_key,available_at,payload_hash,payload")
    .in("id", pins.map(pin => pin[0])).eq("provider", "fhfh").eq("dataset_key", dataset)
    .eq("entity_kind", "participation_bundle").eq("entity_key", String(seasonId)).limit(SKATER_PARTICIPATION_RELEASE_LIMITS.releases + 1);
  if (options.signal) query = query.abortSignal(options.signal);
  const { data, error } = await query;
  if (error || !Array.isArray(data) || data.length !== pins.length) return empty("participation_release_unavailable");
  const sources: ContributionParticipation[] = [], seen = new Set<string>();
  let bytes = 0, entries = 0;
  try {
    for (const row of data) {
      const pin = pins.find(value => value[0] === row.id), payload = row.payload as SkaterParticipationBundle | FrozenWindowSkaterParticipationBundle | RosterObservationSkaterParticipationBundle
        | RollingWindowSkaterParticipationBundle;
      const rowBytes = Buffer.byteLength(JSON.stringify(payload), "utf8");
      bytes += rowBytes;
      const uses = payload?.allowedUses;
      if (!pin || seen.has(`release:${row.id}`) || rowBytes > SKATER_PARTICIPATION_RELEASE_LIMITS.bundleBytes
        || bytes > SKATER_PARTICIPATION_RELEASE_LIMITS.aggregateBytes || row.provider !== "fhfh"
        || row.dataset_key !== dataset || row.entity_kind !== "participation_bundle"
        || row.entity_key !== String(seasonId) || row.payload_hash !== pin[1]
        || playerForecastSourcePayloadHash(payload) !== pin[1] || payload.version !== dataset
        || payload.seasonId !== seasonId || payload.released !== true || !nonempty(payload.ownerApprovalRef)
        || !nonempty(payload.reviewRef) || !uses || Object.keys(uses).length !== 4
        || ["assignment", "totals", "comparison", "conditionalTieBreak"].some(key => typeof uses[key as keyof ContributionAllowedUses] !== "boolean")
        || !Number.isFinite(time(payload.issuedAt)) || time(payload.issuedAt) !== time(row.available_at)
        || time(payload.issuedAt) > now.getTime() * 1000 || !Number.isFinite(time(payload.expiresAt))
        || time(payload.expiresAt) <= now.getTime() * 1000 || !Array.isArray(payload.entries)
        || !payload.entries.length || payload.entries.length > SKATER_PARTICIPATION_RELEASE_LIMITS.bundleEntries) return empty("invalid_participation_release");
      seen.add(`release:${row.id}`);
      entries += payload.entries.length;
      if (entries > SKATER_PARTICIPATION_RELEASE_LIMITS.aggregateEntries) return empty("invalid_participation_release");
      for (const entry of payload.entries) {
        if (sources.length >= SKATER_PARTICIPATION_RELEASE_LIMITS.aggregateEntries || entry.input.scope.seasonId !== seasonId
          || entry.receipt.issuedAt !== payload.issuedAt || entry.receipt.expiresAt !== payload.expiresAt) return empty("invalid_participation_release");
        const clocks = { issuedAt: payload.issuedAt, expiresAt: payload.expiresAt };
        const rebuilt = mode === "rolling" ? buildRollingWindowSkaterParticipationReceipt(entry.input as RollingWindowSkaterParticipationInput, clocks)
          : mode === "roster_observation" ? buildRosterObservationSkaterParticipationReceipt(entry.input as RosterObservationSkaterParticipationInput, clocks)
          : frozen ? buildFrozenWindowSkaterParticipationReceipt(entry.input as FrozenWindowSkaterParticipationInput, clocks)
          : buildSkaterParticipationReceipt(entry.input as SkaterParticipationInput, clocks);
        if (playerForecastSourcePayloadHash(rebuilt) !== playerForecastSourcePayloadHash(entry.receipt)) return empty("participation_receipt_mismatch");
        const key = `${rebuilt.scope.playerId}:${rebuilt.scope.gameId}`;
        if (seen.has(key)) return empty("conflicting_participation_release");
        seen.add(key);
        const source = participationFromReceipt(rebuilt, uses);
        if (source) sources.push(source);
      }
    }
  } catch { return empty("invalid_participation_release"); }
  return { sources, checksum: playerForecastSourcePayloadHash(pins.slice().sort((a, b) => a[0].localeCompare(b[0]))),
    limitations: [mode === "rolling" ? "Experimental rolling 14-day history with official season-roster observation continuation proxy; calibration unavailable; source completeness is owner-reviewed."
      : mode === "roster_observation" ? "Experimental official season-roster observation continuation proxy; calibration unavailable; source completeness is owner-reviewed."
      : frozen ? "Experimental frozen-window skater appearance frequency; calibration unavailable; source completeness is owner-reviewed."
      : "Experimental modeled skater participation; calibration unavailable; source completeness is owner-reviewed."] };
}


export function loadModeledSkaterParticipation(db: SupabaseClient<any>, seasonId: number, now: Date,
  options: { environment?: Record<string, string | undefined>; signal?: AbortSignal } = {}) {
  return loadSkaterParticipation(db, seasonId, now, options, "current");
}

/** Separate exact-hash allowlist; disabled by default, never inherits v1 approval. */
export function loadFrozenWindowSkaterParticipation(db: SupabaseClient<any>, seasonId: number, now: Date,
  options: { environment?: Record<string, string | undefined>; signal?: AbortSignal } = {}) {
  return loadSkaterParticipation(db, seasonId, now, options, "frozen");
}


/** New proxy policy requires its own exact-hash release approval. */
export function loadRosterObservationSkaterParticipation(db: SupabaseClient<any>, seasonId: number, now: Date,
  options: { environment?: Record<string, string | undefined>; signal?: AbortSignal } = {}) {
  return loadSkaterParticipation(db, seasonId, now, options, "roster_observation");
}

/** Rolling 14-day window: its own exact-hash allowlist; never inherits roster-observation approval. */
export function loadRollingWindowSkaterParticipation(db: SupabaseClient<any>, seasonId: number, now: Date,
  options: { environment?: Record<string, string | undefined>; signal?: AbortSignal } = {}) {
  return loadSkaterParticipation(db, seasonId, now, options, "rolling");
}
