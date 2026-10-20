import type { SupabaseClient } from "@supabase/supabase-js";
import type { ContributionAllowedUses, ContributionParticipation } from "./contributions";
import { buildGoalieParticipationReceipt, goalieParticipationFromReceipt,
  type GoalieParticipationInput, type GoalieParticipationReceipt, buildFrozenWindowGoalieParticipationReceipt,
  type FrozenWindowGoalieParticipationInput, type FrozenWindowGoalieParticipationReceipt, buildFrozenWindowGoalieStartReceipt,
  type FrozenWindowGoalieStartInput, type FrozenWindowGoalieStartReceipt, buildRosterObservationGoalieParticipationReceipt, buildRosterObservationGoalieStartReceipt,
  type RosterObservationGoalieParticipationInput, type RosterObservationGoalieParticipationReceipt,
  type RosterObservationGoalieStartInput, type RosterObservationGoalieStartReceipt } from "./modeledGoalieParticipation";
import { buildRollingWindowGoalieParticipationReceipt, buildRollingWindowGoalieStartReceipt,
  type RollingWindowGoalieParticipationInput, type RollingWindowGoalieParticipationReceipt,
  type RollingWindowGoalieStartInput, type RollingWindowGoalieStartReceipt } from "./rollingWindowParticipation";
import { playerForecastSourcePayloadHash } from "./sourceSnapshot";
import { timestampMicros } from "../projections/evidenceTime";

export const GOALIE_PARTICIPATION_DATASET = "goalie-participation-bundle-v1";
export const FROZEN_WINDOW_GOALIE_PARTICIPATION_DATASET = "goalie-frozen-window-participation-bundle-v1";
export const FROZEN_WINDOW_GOALIE_START_DATASET = "goalie-frozen-window-start-bundle-v1";
export const ROSTER_OBSERVATION_GOALIE_PARTICIPATION_DATASET = "goalie-roster-observation-participation-bundle-v1";
export const ROSTER_OBSERVATION_GOALIE_START_DATASET = "goalie-roster-observation-start-bundle-v1";
export const ROLLING_WINDOW_GOALIE_PARTICIPATION_DATASET = "goalie-rolling-14d-participation-bundle-v1";
export const ROLLING_WINDOW_GOALIE_START_DATASET = "goalie-rolling-14d-start-bundle-v1";
export type GoalieParticipationBundle = {
  version: typeof GOALIE_PARTICIPATION_DATASET; seasonId: number; issuedAt: string; expiresAt: string;
  released: boolean; allowedUses: ContributionAllowedUses;
  /** References to exact external owner/reviewer decisions; no performance threshold implied. */
  ownerApprovalRef: string; reviewRef: string;
  entries: Array<{ input: GoalieParticipationInput; receipt: GoalieParticipationReceipt }>;
};
export type FrozenWindowGoalieParticipationBundle = Omit<GoalieParticipationBundle, "version" | "entries"> & {
  version: typeof FROZEN_WINDOW_GOALIE_PARTICIPATION_DATASET;
  entries: Array<{ input: FrozenWindowGoalieParticipationInput; receipt: FrozenWindowGoalieParticipationReceipt }>;
};
export type FrozenWindowGoalieStartBundle = Omit<GoalieParticipationBundle, "version" | "entries"> & {
  version: typeof FROZEN_WINDOW_GOALIE_START_DATASET;
  entries: Array<{ input: FrozenWindowGoalieStartInput; receipt: FrozenWindowGoalieStartReceipt }>;
};
export type RosterObservationGoalieParticipationBundle = Omit<GoalieParticipationBundle, "version" | "entries"> & {
  version: typeof ROSTER_OBSERVATION_GOALIE_PARTICIPATION_DATASET;
  entries: Array<{ input: RosterObservationGoalieParticipationInput; receipt: RosterObservationGoalieParticipationReceipt }>;
};
export type RosterObservationGoalieStartBundle = Omit<GoalieParticipationBundle, "version" | "entries"> & {
  version: typeof ROSTER_OBSERVATION_GOALIE_START_DATASET;
  entries: Array<{ input: RosterObservationGoalieStartInput; receipt: RosterObservationGoalieStartReceipt }>;
};
export type RollingWindowGoalieParticipationBundle = Omit<GoalieParticipationBundle, "version" | "entries"> & {
  version: typeof ROLLING_WINDOW_GOALIE_PARTICIPATION_DATASET;
  entries: Array<{ input: RollingWindowGoalieParticipationInput; receipt: RollingWindowGoalieParticipationReceipt }>;
};
export type RollingWindowGoalieStartBundle = Omit<GoalieParticipationBundle, "version" | "entries"> & {
  version: typeof ROLLING_WINDOW_GOALIE_START_DATASET;
  entries: Array<{ input: RollingWindowGoalieStartInput; receipt: RollingWindowGoalieStartReceipt }>;
};
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const HASH = /^[0-9a-f]{64}$/;
const nonempty = (value: unknown) => typeof value === "string" && value.trim().length > 0;
const time = (value: string) => { const parsed = timestampMicros(value); return parsed === null ? NaN : Number(parsed); };

/** One bounded read of exact ID:payload-hash releases. Default disabled, no writes.
 * Reproduction authenticates arithmetic, not source truth: publication review must
 * establish genuine complete eligibility/label inputs before allowlisting bytes. */
async function loadGoalieParticipation(db: SupabaseClient<any>, seasonId: number, now: Date,
  options: { environment?: Record<string, string | undefined>; signal?: AbortSignal },
  mode: "current" | "frozen_appearance" | "frozen_start" | "roster_appearance" | "roster_start" | "rolling_appearance" | "rolling_start"): Promise<{
    sources: ContributionParticipation[]; checksum: string | null; limitations: string[];
  }> {
  const frozen = mode !== "current";
  const dataset = mode === "rolling_start" ? ROLLING_WINDOW_GOALIE_START_DATASET
    : mode === "rolling_appearance" ? ROLLING_WINDOW_GOALIE_PARTICIPATION_DATASET
    : mode === "roster_start" ? ROSTER_OBSERVATION_GOALIE_START_DATASET
    : mode === "roster_appearance" ? ROSTER_OBSERVATION_GOALIE_PARTICIPATION_DATASET
    : mode === "frozen_start" ? FROZEN_WINDOW_GOALIE_START_DATASET
    : frozen ? FROZEN_WINDOW_GOALIE_PARTICIPATION_DATASET : GOALIE_PARTICIPATION_DATASET;
  const empty = (reason: string) => ({ sources: [], checksum: null, limitations: [reason] });
  const releases = (options.environment ?? process.env)[mode === "rolling_start" ? "PLAYER_FORECAST_ROLLING_14D_GOALIE_START_RELEASES"
    : mode === "rolling_appearance" ? "PLAYER_FORECAST_ROLLING_14D_GOALIE_PARTICIPATION_RELEASES"
    : mode === "roster_start" ? "PLAYER_FORECAST_ROSTER_OBSERVATION_GOALIE_START_RELEASES"
    : mode === "roster_appearance" ? "PLAYER_FORECAST_ROSTER_OBSERVATION_GOALIE_PARTICIPATION_RELEASES"
    : mode === "frozen_start" ? "PLAYER_FORECAST_FROZEN_WINDOW_GOALIE_START_RELEASES"
    : frozen ? "PLAYER_FORECAST_FROZEN_WINDOW_GOALIE_PARTICIPATION_RELEASES" : "PLAYER_FORECAST_GOALIE_PARTICIPATION_RELEASES"]
    ?.split(",").map(value => value.trim()).filter(Boolean) ?? [];
  if (!releases.length) return empty("modeled_participation_serving_disabled");
  const pins = releases.map(value => value.split(":"));
  if (!Number.isSafeInteger(seasonId) || !Number.isFinite(now.getTime()) || pins.length > 8
    || pins.some(pin => pin.length !== 2 || !UUID.test(pin[0]) || !HASH.test(pin[1]))
    || new Set(pins.map(pin => pin[0])).size !== pins.length) return empty("invalid_participation_release_allowlist");
  let query = db.from("player_forecast_source_observations")
    .select("id,provider,dataset_key,entity_kind,entity_key,available_at,payload_hash,payload")
    .in("id", pins.map(pin => pin[0])).eq("provider", "fhfh").eq("dataset_key", dataset)
    .eq("entity_kind", "participation_bundle").eq("entity_key", String(seasonId)).limit(9);
  if (options.signal) query = query.abortSignal(options.signal);
  const { data, error } = await query;
  if (error || !Array.isArray(data) || data.length !== pins.length) return empty("participation_release_unavailable");
  const sources: ContributionParticipation[] = [], seen = new Set<string>();
  let bytes = 0, entries = 0;
  try {
    for (const row of data) {
      const pin = pins.find(value => value[0] === row.id), payload = row.payload as GoalieParticipationBundle | FrozenWindowGoalieParticipationBundle | FrozenWindowGoalieStartBundle
        | RosterObservationGoalieParticipationBundle | RosterObservationGoalieStartBundle | RollingWindowGoalieParticipationBundle | RollingWindowGoalieStartBundle;
      bytes += Buffer.byteLength(JSON.stringify(payload), "utf8");
      const uses = payload?.allowedUses;
      if (!pin || seen.has(`release:${row.id}`) || bytes > 8 * 1024 * 1024 || row.provider !== "fhfh"
        || row.dataset_key !== dataset || row.entity_kind !== "participation_bundle"
        || row.entity_key !== String(seasonId) || row.payload_hash !== pin[1]
        || playerForecastSourcePayloadHash(payload) !== pin[1] || payload.version !== dataset
        || payload.seasonId !== seasonId || payload.released !== true || !nonempty(payload.ownerApprovalRef)
        || !nonempty(payload.reviewRef) || !uses || Object.keys(uses).length !== 4
        || ["assignment", "totals", "comparison", "conditionalTieBreak"].some(key => typeof uses[key as keyof ContributionAllowedUses] !== "boolean")
        || !Number.isFinite(time(payload.issuedAt)) || time(payload.issuedAt) !== time(row.available_at)
        || time(payload.issuedAt) > now.getTime() * 1000 || !Number.isFinite(time(payload.expiresAt))
        || time(payload.expiresAt) <= now.getTime() * 1000 || !Array.isArray(payload.entries)
        || !payload.entries.length || payload.entries.length > 500) return empty("invalid_participation_release");
      seen.add(`release:${row.id}`);
      entries += payload.entries.length;
      if (entries > 500) return empty("invalid_participation_release");
      for (const entry of payload.entries) {
        if (sources.length >= 500 || entry.input.scope.seasonId !== seasonId
          || entry.receipt.issuedAt !== payload.issuedAt || entry.receipt.expiresAt !== payload.expiresAt) return empty("invalid_participation_release");
        const clocks = { issuedAt: payload.issuedAt, expiresAt: payload.expiresAt };
        const rebuilt = mode === "rolling_start" ? buildRollingWindowGoalieStartReceipt(entry.input as RollingWindowGoalieStartInput, clocks)
          : mode === "rolling_appearance" ? buildRollingWindowGoalieParticipationReceipt(entry.input as RollingWindowGoalieParticipationInput, clocks)
          : mode === "roster_start" ? buildRosterObservationGoalieStartReceipt(entry.input as RosterObservationGoalieStartInput, clocks)
          : mode === "roster_appearance" ? buildRosterObservationGoalieParticipationReceipt(entry.input as RosterObservationGoalieParticipationInput, clocks)
          : mode === "frozen_start" ? buildFrozenWindowGoalieStartReceipt(entry.input as FrozenWindowGoalieStartInput, clocks)
          : frozen ? buildFrozenWindowGoalieParticipationReceipt(entry.input as FrozenWindowGoalieParticipationInput, clocks)
          : buildGoalieParticipationReceipt(entry.input as GoalieParticipationInput, clocks);
        if (playerForecastSourcePayloadHash(rebuilt) !== playerForecastSourcePayloadHash(entry.receipt)) return empty("participation_receipt_mismatch");
        const key = `${rebuilt.scope.playerId}:${rebuilt.scope.gameId}`;
        if (seen.has(key)) return empty("conflicting_participation_release");
        seen.add(key);
        const source = goalieParticipationFromReceipt(rebuilt, uses);
        if (source) sources.push(source);
      }
    }
  } catch { return empty("invalid_participation_release"); }
  return { sources, checksum: playerForecastSourcePayloadHash(pins.slice().sort((a, b) => a[0].localeCompare(b[0]))),
    limitations: [mode.startsWith("rolling_") ? "Experimental rolling 14-day history with official season-roster observation continuation proxy; calibration unavailable; source completeness is owner-reviewed."
      : mode.startsWith("roster_") ? "Experimental official season-roster observation continuation proxy; calibration unavailable; source completeness is owner-reviewed."
      : mode === "frozen_start" ? "Experimental frozen-window goalie official starter frequency; calibration unavailable; source completeness is owner-reviewed."
      : frozen ? "Experimental frozen-window goalie appearance frequency; calibration unavailable; source completeness is owner-reviewed."
      : "Experimental modeled goalie participation; calibration unavailable; source completeness is owner-reviewed."] };
}


export function loadModeledGoalieParticipation(db: SupabaseClient<any>, seasonId: number, now: Date,
  options: { environment?: Record<string, string | undefined>; signal?: AbortSignal } = {}) {
  return loadGoalieParticipation(db, seasonId, now, options, "current");
}

/** Separate exact-hash allowlist; disabled by default, never inherits v1 approval. */
export function loadFrozenWindowGoalieParticipation(db: SupabaseClient<any>, seasonId: number, now: Date,
  options: { environment?: Record<string, string | undefined>; signal?: AbortSignal } = {}) {
  return loadGoalieParticipation(db, seasonId, now, options, "frozen_appearance");
}


/** Distinct event and allowlist; appearance approval never grants start-model use. */
export function loadFrozenWindowGoalieStarts(db: SupabaseClient<any>, seasonId: number, now: Date,
  options: { environment?: Record<string, string | undefined>; signal?: AbortSignal } = {}) {
  return loadGoalieParticipation(db, seasonId, now, options, "frozen_start");
}


/** New observation policies never inherit strict-method allowlists. */
export function loadRosterObservationGoalieParticipation(db: SupabaseClient<any>, seasonId: number, now: Date,
  options: { environment?: Record<string, string | undefined>; signal?: AbortSignal } = {}) {
  return loadGoalieParticipation(db, seasonId, now, options, "roster_appearance");
}
export function loadRosterObservationGoalieStarts(db: SupabaseClient<any>, seasonId: number, now: Date,
  options: { environment?: Record<string, string | undefined>; signal?: AbortSignal } = {}) {
  return loadGoalieParticipation(db, seasonId, now, options, "roster_start");
}

/** Rolling 14-day window: separate appearance and start allowlists; never inherits roster-observation approval. */
export function loadRollingWindowGoalieParticipation(db: SupabaseClient<any>, seasonId: number, now: Date,
  options: { environment?: Record<string, string | undefined>; signal?: AbortSignal } = {}) {
  return loadGoalieParticipation(db, seasonId, now, options, "rolling_appearance");
}
export function loadRollingWindowGoalieStarts(db: SupabaseClient<any>, seasonId: number, now: Date,
  options: { environment?: Record<string, string | undefined>; signal?: AbortSignal } = {}) {
  return loadGoalieParticipation(db, seasonId, now, options, "rolling_start");
}
