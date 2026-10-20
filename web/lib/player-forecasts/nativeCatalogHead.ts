import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { timestampMicros } from "../projections/evidenceTime";
import { withinDeadline } from "../rosterScheduleData/planningInputs";
import { capturePlayerForecastSourceObservation, playerForecastSourcePayloadHash as hash,
  SOURCE_OBSERVATION_COLUMNS, validPlannedObservationId, verifyPlannedObservation, type PlannedSourceObservation } from "./sourceSnapshot";

export const NATIVE_CATALOG_PIN_KEYS = ["PLAYER_FORECAST_BASELINE_RELEASE_IDS", "PLAYER_FORECAST_ROSTER_OBSERVATION_SKATER_PARTICIPATION_RELEASES",
  "PLAYER_FORECAST_ROSTER_OBSERVATION_GOALIE_PARTICIPATION_RELEASES", "PLAYER_FORECAST_ROSTER_OBSERVATION_GOALIE_START_RELEASES",
  "PLAYER_FORECAST_ROLLING_14D_SKATER_PARTICIPATION_RELEASES", "PLAYER_FORECAST_ROLLING_14D_GOALIE_PARTICIPATION_RELEASES",
  "PLAYER_FORECAST_ROLLING_14D_GOALIE_START_RELEASES"] as const;
/** Groups added after the first published selections. Absent means nothing selected, so earlier
 * heads still parse and hash unchanged, and a selection without them is byte-identical to before. */
const ADDED_PIN_KEYS = new Set<string>(NATIVE_CATALOG_PIN_KEYS.slice(4));
const legacyKeys = ["PLAYER_FORECAST_PARTICIPATION_RELEASES", "PLAYER_FORECAST_GOALIE_PARTICIPATION_RELEASES",
  "PLAYER_FORECAST_FROZEN_WINDOW_SKATER_PARTICIPATION_RELEASES", "PLAYER_FORECAST_FROZEN_WINDOW_GOALIE_PARTICIPATION_RELEASES", "PLAYER_FORECAST_FROZEN_WINDOW_GOALIE_START_RELEASES"];
const emptyPins = Object.fromEntries([...NATIVE_CATALOG_PIN_KEYS, ...legacyKeys].map(key => [key, ""]));
export function unavailableNativeCatalogEnvironment(environment: Record<string, string | undefined>) {
  return { environment: Object.freeze({ ...environment, ...emptyPins }), selection: null, limitation: "native_catalog_head_unavailable_or_invalid" };
}
const datasets = ["contribution-bundle-v1", "skater-roster-observation-participation-bundle-v1", "goalie-roster-observation-participation-bundle-v1", "goalie-roster-observation-start-bundle-v1",
  "skater-rolling-14d-participation-bundle-v1", "goalie-rolling-14d-participation-bundle-v1", "goalie-rolling-14d-start-bundle-v1"];
const time = (value: unknown) => typeof value === "string" ? Number(timestampMicros(value) ?? NaN) : NaN;
const selectionVersion = "native-catalog-selection-v1";
const uuid = z.string().refine(validPlannedObservationId), digest = z.string().regex(/^[a-f0-9]{64}$/), clock = z.string().refine(value => Number.isFinite(time(value)));
const selectionShape = z.object({ version: z.literal(selectionVersion), seasonId: z.number().int().positive(), issuedAt: clock, expiresAt: clock,
  packageHash: digest, pins: z.object(Object.fromEntries(NATIVE_CATALOG_PIN_KEYS.map(key => [key, ADDED_PIN_KEYS.has(key) ? z.string().optional() : z.string()])) as
    Record<typeof NATIVE_CATALOG_PIN_KEYS[number], z.ZodString | z.ZodOptional<z.ZodString>>).strict(),
  releases: z.array(z.object({ id: uuid, payloadHash: digest, dataset: z.string() }).strict()).min(1).max(32) }).strict();
export type NativeCatalogSelection = z.infer<typeof selectionShape>;
export type NativeCatalogHead = { id: string; season_id: number; revision: number; observation_id: string; payload_hash: string; selected_at: string };
const headColumns = "id,season_id,revision,observation_id,payload_hash,selected_at";
function validateSelection(value: unknown, seasonId: number, now: Date): NativeCatalogSelection {
  const selection = selectionShape.parse(value);
  if (selection.seasonId !== seasonId || time(selection.issuedAt) > now.getTime() * 1000 || time(selection.expiresAt) <= now.getTime() * 1000
    || time(selection.expiresAt) <= time(selection.issuedAt) || Buffer.byteLength(JSON.stringify(selection)) > 64 * 1024
    || new Set(selection.releases.map(row => row.id)).size !== selection.releases.length) throw new Error("Invalid native catalog selection.");
  const expected: NativeCatalogSelection["releases"] = [];
  for (const [index, key] of NATIVE_CATALOG_PIN_KEYS.entries()) {
    for (const entry of (selection.pins[key] ?? "").split(",").filter(Boolean)) {
      const parts = entry.split(":");
      const release = selection.releases.find(row => row.id === parts[0]);
      if (!release || release.dataset !== datasets[index] || (index === 0 ? parts.length !== 1 : parts.length !== 2 || parts[1] !== release.payloadHash)) throw new Error("Native catalog pin/hash mismatch.");
      expected.push(release);
    }
  }
  if (!selection.pins[NATIVE_CATALOG_PIN_KEYS[0]] || expected.length !== selection.releases.length
    || new Set(expected.map(row => row.id)).size !== expected.length) throw new Error("Native catalog release scope mismatch.");
  return selection;
}
function validHead(value: any, id: string, seasonId: number): value is NativeCatalogHead {
  return value?.id === id && value.season_id === seasonId && Number.isSafeInteger(value.revision) && value.revision > 0
    && validPlannedObservationId(value.observation_id) && /^[a-f0-9]{64}$/.test(value.payload_hash) && Number.isFinite(time(value.selected_at));
}
async function readHead(db: SupabaseClient<any>, id: string, seasonId: number, signal?: AbortSignal) {
  const query = db.from("native_forecast_catalog_heads").select(headColumns).eq("id", id).limit(2);
  const result = await (signal ? query.abortSignal(signal) : query);
  if (result.error || !Array.isArray(result.data) || result.data.length > 1 || result.data.length === 1 && !validHead(result.data[0], id, seasonId)) throw new Error("Native catalog head unavailable.");
  return result.data[0] as NativeCatalogHead | undefined;
}
async function verifyReleases(db: SupabaseClient<any>, selection: NativeCatalogSelection, signal?: AbortSignal, metadataOnly = false) {
  const query = db.from("player_forecast_source_observations").select(`id,provider,dataset_key,entity_key,available_at,payload_hash${metadataOnly ? "" : ",payload"}`)
    .in("id", selection.releases.map(row => row.id)).limit(selection.releases.length + 1);
  const result = await (signal ? query.abortSignal(signal) : query);
  if (result.error || !Array.isArray(result.data) || result.data.length !== selection.releases.length
    || Buffer.byteLength(JSON.stringify(result.data)) > 32 * 1024 * 1024 || new Set(result.data.map((row: any) => row.id)).size !== result.data.length) throw new Error("Native catalog releases unavailable.");
  for (const expected of selection.releases) {
    // PostgREST cannot infer the conditional projection string; every field is
    // checked below before this untyped Data API row is used.
    const actual: any = result.data.find((row: any) => row.id === expected.id), payload = actual?.payload;
    const expiresAt = payload?.manifest?.expiresAt ?? payload?.expiresAt;
    if (!actual || actual.provider !== "fhfh" || actual.entity_key !== String(selection.seasonId) || actual.dataset_key !== expected.dataset
      || actual.payload_hash !== expected.payloadHash || !Number.isFinite(time(actual.available_at))
      || !metadataOnly && (hash(payload) !== expected.payloadHash || !Number.isFinite(time(expiresAt)) || time(selection.expiresAt) > time(expiresAt))
      || time(actual.available_at) > time(selection.issuedAt)) throw new Error("Native catalog release hash/clock mismatch.");
  }
}
/** Explicit exact-head opt-in only. An invalid enabled head clears every release
 * pin, never falls back to the process's older catalog. Admission stays separate. */
export async function resolveNativeCatalogEnvironment(db: SupabaseClient<any>, seasonId: number, now: Date,
  environment: Record<string, string | undefined> = process.env, signal?: AbortSignal) {
  const id = environment.PLAYER_FORECAST_NATIVE_CATALOG_HEAD_ID;
  if (!id) return { environment, selection: null, limitation: null };
  try {
    if (!validPlannedObservationId(id)) throw new Error("Invalid head ID.");
    const head = await readHead(db, id, seasonId, signal); if (!head || time(head.selected_at) > now.getTime() * 1000) throw new Error("Missing head.");
    const query = db.from("player_forecast_source_observations").select(SOURCE_OBSERVATION_COLUMNS).eq("id", head.observation_id).limit(2);
    const result = await (signal ? query.abortSignal(signal) : query);
    if (result.error || !Array.isArray(result.data) || result.data.length !== 1) throw new Error("Missing selection.");
    const row = result.data[0], selection = validateSelection(row.payload, seasonId, now);
    if (row.provider !== "fhfh" || row.dataset_key !== selectionVersion || row.entity_kind !== "catalog_selection" || row.entity_key !== String(seasonId)
      || row.payload_hash !== head.payload_hash || hash(row.payload) !== head.payload_hash
      || time(row.available_at) !== time(selection.issuedAt) || time(selection.issuedAt) > time(head.selected_at)) throw new Error("Selection envelope mismatch.");
    // Existing native/participation loaders rehash the full immutable payloads
    // and admit their original expiries; do not transfer those bodies twice.
    await verifyReleases(db, selection, signal, true);
    return { environment: Object.freeze({ ...environment, ...emptyPins, ...selection.pins }), selection: head, limitation: null };
  } catch { return unavailableNativeCatalogEnvironment(environment); }
}

/** Derive immutable pin references from the existing publisher's validated plan.
 * This helper grants no release/admission and does not write a mutable head. */
export function prepareNativeCatalogObservation(args: { plan: { seasonId: number; rows: PlannedSourceObservation[] }; pins: Record<string, string>;
  observationId: string; issuedAt: string }) {
  if (!validPlannedObservationId(args.observationId)) throw new Error("Invalid catalog observation ID.");
  if (Object.keys(args.pins).some(key => !NATIVE_CATALOG_PIN_KEYS.includes(key as typeof NATIVE_CATALOG_PIN_KEYS[number]))) throw new Error("Unsupported catalog pin group.");
  const pins = Object.fromEntries(NATIVE_CATALOG_PIN_KEYS.flatMap(key => ADDED_PIN_KEYS.has(key) && !args.pins[key] ? []
    : [[key, args.pins[key] ?? ""]])) as NativeCatalogSelection["pins"];
  const selected = new Set(Object.values(pins).flatMap(value => (value ?? "").split(",").filter(Boolean).map(value => value.split(":")[0])));
  const rows = args.plan.rows.filter(row => selected.has(row.id));
  const expiries = rows.map(row => { const value = row.payload as any; return value.manifest?.expiresAt ?? value.expiresAt; }).sort((a, b) => time(a) - time(b));
  const payload = validateSelection({ version: selectionVersion, seasonId: args.plan.seasonId, issuedAt: args.issuedAt, expiresAt: expiries[0], packageHash: hash(args.plan), pins,
    releases: rows.map(row => ({ id: row.id, payloadHash: row.payload_hash, dataset: row.dataset_key })) }, args.plan.seasonId, new Date(args.issuedAt));
  return { id: args.observationId, provider: "fhfh", dataset_key: selectionVersion, entity_kind: "catalog_selection", entity_key: String(payload.seasonId),
    source_url: null, source_revision_key: payload.packageHash, observed_at: args.issuedAt, available_at: args.issuedAt, payload_hash: hash(payload), payload, metadata: {} } satisfies PlannedSourceObservation;
}
/** One CAS, no retry. A lost acknowledgement succeeds only after exact head readback. */
export async function advanceNativeCatalogHead(args: { db: SupabaseClient<any>; headId: string; expectedRevision: number; expectedHash: string | null;
  observation: PlannedSourceObservation; now: Date; dryRun?: boolean }) {
  const selection = validateSelection(args.observation.payload, Number(args.observation.entity_key), args.now);
  if (!validPlannedObservationId(args.headId) || !Number.isSafeInteger(args.expectedRevision) || args.expectedRevision < 0
    || (args.expectedRevision === 0 ? args.expectedHash !== null : !/^[a-f0-9]{64}$/.test(args.expectedHash ?? ""))
    || args.observation.payload_hash !== hash(selection)) throw new Error("Invalid catalog CAS identity.");
  if (!validPlannedObservationId(args.observation.id) || args.observation.provider !== "fhfh" || args.observation.dataset_key !== selectionVersion
    || args.observation.entity_kind !== "catalog_selection" || args.observation.entity_key !== String(selection.seasonId)
    || args.observation.source_revision_key !== selection.packageHash || args.observation.source_url !== null
    || time(args.observation.observed_at) !== time(selection.issuedAt) || time(args.observation.available_at) !== time(selection.issuedAt)) throw new Error("Invalid catalog observation envelope.");
  if (args.dryRun !== false) return { status: "dry_run" as const, selectedCatalogUpdated: false };
  const deadline = Date.now() + 30000;
  try {
    await withinDeadline(Math.min(deadline, Date.now() + 8000), signal => verifyReleases(args.db, selection, signal));
    await withinDeadline(Math.min(deadline, Date.now() + 8000), () => capturePlayerForecastSourceObservation({ supabase: args.db, observationId: args.observation.id, provider: args.observation.provider,
      datasetKey: args.observation.dataset_key, entityKind: args.observation.entity_kind, entityKey: args.observation.entity_key,
      sourceRevisionKey: args.observation.source_revision_key, observedAt: args.observation.observed_at, availableAt: args.observation.available_at,
      payload: args.observation.payload, metadata: args.observation.metadata }));
    await withinDeadline(Math.min(deadline, Date.now() + 8000), () => verifyPlannedObservation(args.db, args.observation));
    let acknowledgementUnknown = false;
    try {
      const acknowledgement = await withinDeadline(Math.min(deadline, Date.now() + 8000), signal => args.db.rpc("cas_native_forecast_catalog_head", { p_head_id: args.headId, p_season_id: selection.seasonId,
        p_expected_revision: args.expectedRevision, p_expected_hash: args.expectedHash, p_observation_id: args.observation.id, p_payload_hash: args.observation.payload_hash }).abortSignal(signal));
      acknowledgementUnknown = !!acknowledgement.error && acknowledgement.error.code !== "40001";
    } catch { acknowledgementUnknown = true; }
    const head = await withinDeadline(Math.min(deadline, Date.now() + 8000), signal => readHead(args.db, args.headId, selection.seasonId, signal));
    if (head?.revision === args.expectedRevision + 1 && head.observation_id === args.observation.id && head.payload_hash === args.observation.payload_hash) return { status: "selected" as const, selectedCatalogUpdated: true, head };
    return { status: acknowledgementUnknown ? "unknown" as const : "conflict" as const, selectedCatalogUpdated: false };
  } catch { return { status: "unknown" as const, selectedCatalogUpdated: false }; }
}
