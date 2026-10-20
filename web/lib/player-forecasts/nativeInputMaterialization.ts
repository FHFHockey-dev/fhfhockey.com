import type { SupabaseClient } from "@supabase/supabase-js";
import { createHash } from "node:crypto";
import { assembleCurrentRosterNativeInputs, type CurrentRosterNativeInputs } from "./currentRosterNativeInputs";
import { buildNativeSkaterBaselineSnapshot } from "./baselineGeneration";
import { buildNativeGoalieWinRates, buildNativeGoalieVolumeRates, buildNativeGoalieShutoutRates, buildNativeGoalieSummaryWinRates,
  NATIVE_GOALIE_WIN_POLICY_VERSION, NATIVE_GOALIE_VOLUME_POLICY_VERSION, NATIVE_GOALIE_SHUTOUT_POLICY_VERSION,
  NATIVE_GOALIE_SUMMARY_WIN_POLICY_VERSION } from "./goalieBaselineRates";
import { CURRENT_APPEARANCE_POLICY_VERSION, PRIOR_APPEARANCE_POLICY_VERSION } from "./baselineRates";
import { verifyBaselineHistoricalSources } from "./baselineSourceLineage";
import { buildRosterObservationSkaterParticipationReceipt, type RosterObservationSkaterParticipationInput } from "./modeledSkaterParticipation";
import { buildRosterObservationGoalieParticipationReceipt, buildRosterObservationGoalieStartReceipt,
  type RosterObservationGoalieParticipationInput, type RosterObservationGoalieStartInput } from "./modeledGoalieParticipation";
import { buildRollingWindowGoalieParticipationReceipt, buildRollingWindowGoalieStartReceipt, buildRollingWindowSkaterParticipationReceipt,
  type RollingWindowGoalieParticipationInput, type RollingWindowGoalieStartInput, type RollingWindowSkaterParticipationInput } from "./rollingWindowParticipation";
import { withinDeadline } from "../rosterScheduleData/planningInputs";
import { timestampMicros } from "../projections/evidenceTime";
import { capturePlayerForecastSourceObservation, matchesPlannedObservation, SOURCE_OBSERVATION_COLUMNS,
  playerForecastSourcePayloadHash as hash, validPlannedObservationId, type PlannedSourceObservation } from "./sourceSnapshot";

type ParticipationInput = RosterObservationSkaterParticipationInput | RosterObservationGoalieParticipationInput | RosterObservationGoalieStartInput
  | RollingWindowSkaterParticipationInput | RollingWindowGoalieParticipationInput | RollingWindowGoalieStartInput;
type ParentIdentity = { id: string; hash: string; availableAt: string; capturedAt: string };
export type NativeMaterializationParent = ParentIdentity & (
  { original: { url: string; rawBody: string; bodySha256: string }; derived?: never }
  | { derived: { payload: unknown; parentHashes: string[]; originalSerialization?: string;
    clockRepresentation?: "javascript_millisecond_projection" }; original?: never });
export type NativeMaterializationRequest = {
  runId: string; sourceKey: string; date: string; closureScopeHash: string;
  acquisition: CurrentRosterNativeInputs;
  /** Explicit acquisition allowlist, not inferred from the subset of model inputs. */
  requiredParents?: Array<ParentIdentity & { url: string | null }>;
  parents?: NativeMaterializationParent[];
  participationInputs?: ParticipationInput[];
  nativeSelection: Array<{ playerId: number; policyVersion: string; inputHash: string }>;
  additionalNativeObservations?: Array<Pick<PlannedSourceObservation, "provider" | "dataset_key" | "entity_kind" | "entity_key" | "available_at" | "payload_hash"> & { payload: any }>;
  /** Exact immutable rows already published under the store's semantic unique key. */
  existingInputs?: PlannedSourceObservation[];
};
const VERSION = "native-input-materialization-v1";
// Retained six-policy/1,260-input inventory measured >41MB before parent packing.
const MAX_BYTES = 64 * 1024 * 1024;
/** Participation inputs one request may carry; the v2 driver checks it offline before binding a request. */
export const NATIVE_MATERIALIZATION_MAX_PARTICIPATION_INPUTS = 1500;
function packed<T>(values: T[]): T[][] {
  const groups: T[][] = []; let group: T[] = [], bytes = 2;
  for (const value of values) {
    const size = Buffer.byteLength(JSON.stringify(value)) + 1;
    if (size > 8 * 1024 * 1024 - 4096) throw new Error("Materialization item exceeds immutable row bound.");
    if (bytes + size > 8 * 1024 * 1024 - 4096) { groups.push(group); group = []; bytes = 2; }
    group.push(value); bytes += size;
  }
  if (group.length) groups.push(group);
  return groups;
}
const identity = (runId: string, key: string) => {
  const value = hash({ runId, key });
  return `${value.slice(0, 8)}-${value.slice(8, 12)}-4${value.slice(13, 16)}-a${value.slice(17, 20)}-${value.slice(20, 32)}`;
};
export function nativeInputManifest(items: Array<{ key: string; hash: string; availableAt: string }>) {
  const inputs = items.slice().sort((a, b) => a.key.localeCompare(b.key) || a.hash.localeCompare(b.hash));
  if (new Set(inputs.map(value => value.key)).size !== inputs.length) throw new Error("Ambiguous native cadence input identity.");
  return { revision: hash(inputs), expectedItems: inputs.length,
    availableAt: inputs.reduce<string | null>((latest, value) => latest === null || timestampMicros(value.availableAt)! > timestampMicros(latest)! ? value.availableAt : latest, null) };
}

/** Pure producer over an explicit acquisition packet. No collection or public-use grant. */
/** The acquisition identity the closure binds: declared scope (without raw receipts), required parents and policy selection. */
export function nativeAcquisitionScopeHash(request: Pick<NativeMaterializationRequest, "acquisition" | "requiredParents" | "nativeSelection">) {
  const { receipts: _receipts, ...scope } = request.acquisition;
  return hash({ scope, requiredParents: request.requiredParents ?? [], nativeSelection: request.nativeSelection });
}
export function prepareNativeInputMaterialization(request: NativeMaterializationRequest, closedAt: string) {
  const clock = timestampMicros(closedAt), cutoff = timestampMicros(request.acquisition.cutoffAt);
  if (!validPlannedObservationId(request.runId) || !/^[a-f0-9]{64}$/.test(request.closureScopeHash)
    || !request.sourceKey?.trim() || request.sourceKey.length > 128 || !/^\d{4}-\d{2}-\d{2}$/.test(request.date)
    || clock === null || cutoff === null || cutoff > clock
    || new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" }).format(new Date(closedAt)) !== request.date
    || Buffer.byteLength(JSON.stringify(request)) > MAX_BYTES) throw new Error("Invalid bounded materialization request.");
  if (!Array.isArray(request.acquisition.roster) || !request.acquisition.roster.length || request.acquisition.roster.length > 100
    || new Set(request.acquisition.roster.map(value => value.playerId)).size !== request.acquisition.roster.length
    || new Set(request.acquisition.roster.map(value => value.nhlPlayerId)).size !== request.acquisition.roster.length) throw new Error("Materialization roster identity bound exceeded.");
  // Existing assembler retains its 50-player batch bound; larger explicit scopes use the same originals in two bounded batches.
  const batches = [request.acquisition.roster.slice(0, 50), request.acquisition.roster.slice(50)].filter(rows => rows.length)
    .map(roster => assembleCurrentRosterNativeInputs({ ...request.acquisition, roster }, new Date(closedAt)));
  const assembled = { ...batches[0], skaters: batches.flatMap(batch => batch.skaters), goalieWins: batches.flatMap(batch => batch.goalieWins),
    goalieVolume: batches.flatMap(batch => batch.goalieVolume), coverage: batches.flatMap(batch => batch.coverage) };
  if (!Array.isArray(request.nativeSelection) || request.nativeSelection.length > 200
    || !Array.isArray(request.additionalNativeObservations ?? []) || (request.additionalNativeObservations?.length ?? 0) > 200
    || new Set(request.nativeSelection.map(value => `${value.playerId}:${value.policyVersion}`)).size !== request.nativeSelection.length
    || request.nativeSelection.some(value => !Number.isSafeInteger(value.playerId) || !/^[a-f0-9]{64}$/.test(value.inputHash))) throw new Error("Explicit native policy selection is missing or ambiguous.");
  // A fully acquired declared subset is not complete season history or current overnight readiness.
  if (!request.acquisition.games.length || assembled.sourceReceiptCoverage !== "complete_for_approved_urls"
    || request.acquisition.failures?.length || assembled.missingSources.length) throw new Error("Required acquisition sources are incomplete.");
  const rows: PlannedSourceObservation[] = [], items: Array<{ key: string; hash: string; availableAt: string }> = [];
  const row = (_key: string, dataset: string, kind: string, entity: string, payload: unknown, at: string,
    sourceUrl: string | null = null): PlannedSourceObservation => ({ id: identity(VERSION, `${dataset}:${kind}:${entity}:${hash(payload)}`), provider: "fhfh",
    dataset_key: dataset, entity_kind: kind, entity_key: entity, source_url: sourceUrl, source_revision_key: hash(payload),
    observed_at: at, available_at: at, payload_hash: hash(payload), payload, metadata: { materializationProtocol: VERSION } });
  const parents = request.parents ?? [], required = request.requiredParents ?? [], participation = request.participationInputs ?? [];
  if (parents.length > 1024 || required.length !== parents.length || participation.length > NATIVE_MATERIALIZATION_MAX_PARTICIPATION_INPUTS
    || new Set(required.map(parent => parent.hash)).size !== required.length) throw new Error("Parent acquisition scope is incomplete or duplicated.");
  const parentMap = new Map(parents.map(parent => [parent.hash, parent]));
  if (parentMap.size !== parents.length) throw new Error("Ambiguous materialization parent identity.");
  for (const parent of parents) {
    const declared = required.find(value => value.hash === parent.hash), captured = timestampMicros(parent.capturedAt), available = timestampMicros(parent.availableAt);
    if (!declared || declared.id !== parent.id || declared.capturedAt !== parent.capturedAt || declared.availableAt !== parent.availableAt
      || !parent.id?.trim() || !/^[a-f0-9]{64}$/.test(parent.hash) || captured === null || available === null || available > captured || captured > cutoff
      || Buffer.byteLength(JSON.stringify(parent)) > 2 * 1024 * 1024) throw new Error("Required original parent is missing or outside cutoff.");
    if (parent.original) {
      const original = parent.original;
      if (parent.derived || declared.url !== original.url || !/^https:\/\/api(?:-web)?\.nhle\.com\//.test(original.url)
        || !original.rawBody?.length || Buffer.byteLength(original.rawBody) > 1024 * 1024 || original.bodySha256 !== parent.hash
        || createHash("sha256").update(original.rawBody, "utf8").digest("hex") !== parent.hash) throw new Error("Original parent URL/bytes/hash mismatch.");
    } else if (!parent.derived || declared.url !== null
      || (parent.derived.originalSerialization === undefined ? hash(parent.derived.payload) !== parent.hash
        : Buffer.byteLength(parent.derived.originalSerialization) > 1024 * 1024
          || createHash("sha256").update(parent.derived.originalSerialization, "utf8").digest("hex") !== parent.hash
          || hash(JSON.parse(parent.derived.originalSerialization)) !== hash(parent.derived.payload))
      || !Array.isArray(parent.derived.parentHashes) || !parent.derived.parentHashes.length
      || new Set(parent.derived.parentHashes).size !== parent.derived.parentHashes.length) throw new Error("Derived parent lacks original lineage.");
  }
  const walk = (key: string, path = new Set<string>()): void => {
    const parent = parentMap.get(key);
    if (!parent || path.has(key)) throw new Error("Required original parent is missing or cyclic.");
    if (parent.derived) for (const ancestor of parent.derived.parentHashes) {
      const original = parentMap.get(ancestor);
      if (!original) throw new Error("Required original parent is missing.");
      if (parent.derived.clockRepresentation !== undefined) {
        if (parent.derived.clockRepresentation !== "javascript_millisecond_projection" || !original.original
          || parent.capturedAt !== new Date(original.capturedAt).toISOString()) throw new Error("Invalid explicit millisecond parent projection.");
      } else if (timestampMicros(original.capturedAt)! > timestampMicros(parent.capturedAt)!) throw new Error("Derived parent precedes original acquisition.");
      walk(ancestor, new Set([...path, key]));
    }
  };
  for (const parent of parents) {
    walk(parent.hash);
  }
  for (const [index, group] of packed(parents).entries()) rows.push(row(`parents:${index}`, "native-materialization-parent-v1", "input_parent",
    `${request.acquisition.seasonId}:${index}`, { parents: group }, group.reduce((latest, value) => timestampMicros(value.capturedAt)! > timestampMicros(latest)!
      ? value.capturedAt : latest, group[0].capturedAt)));
  for (const receipt of request.acquisition.receipts) rows.push(row(`original:${receipt.url}`, "native-original-http-v1", "http_receipt",
    receipt.url, receipt, receipt.capturedAt, receipt.url));
  const additional = request.additionalNativeObservations ?? [];
  const candidates = [...assembled.skaters, ...assembled.goalieWins, ...assembled.goalieVolume, ...additional];
  for (const selection of request.nativeSelection) {
    const matching = candidates.filter(value => value.payload?.playerId === selection.playerId
      && value.payload?.policyVersion === selection.policyVersion && value.payload_hash === selection.inputHash);
    const observation = matching[0], payload = observation?.payload as any;
    const player = request.acquisition.roster.find(value => value.playerId === selection.playerId);
    const captured = timestampMicros(observation?.available_at);
    if (!observation || matching.some(value => value.provider !== observation.provider || value.dataset_key !== observation.dataset_key
      || value.entity_kind !== observation.entity_kind || value.entity_key !== observation.entity_key
      || hash(value.payload) !== hash(payload) || timestampMicros(value.available_at) !== captured) || !player
      || observation.provider !== "fhfh" || observation.entity_kind !== "player" || observation.entity_key !== `${request.acquisition.seasonId}:${player.playerId}`
      || observation.payload_hash !== hash(payload) || payload.basis !== "captured_current"
      || payload.nhlPlayerId !== player.nhlPlayerId || payload.teamId !== player.teamId || payload.rosterRevision !== player.rosterRevision
      || captured === null || captured > cutoff || captured !== timestampMicros(payload.capturedAt)
      || !Array.isArray(payload.projections) || payload.projections.length || !Array.isArray(payload.appearances) || payload.appearances.length > 200
      || !payload.appearances.length && selection.policyVersion !== CURRENT_APPEARANCE_POLICY_VERSION) {
      throw new Error("Selected native observation identity/hash/original cutoff is invalid.");
    }
    const calculation = { ...payload, seasonId: request.acquisition.seasonId, cutoffAt: payload.capturedAt, sourceWatermark: observation.payload_hash };
    let snapshot;
    if ([CURRENT_APPEARANCE_POLICY_VERSION, PRIOR_APPEARANCE_POLICY_VERSION].includes(selection.policyVersion)) {
      if (player.playerClass !== "skater" || observation.dataset_key !== "baseline-inputs-v1") throw new Error("Selected skater policy has wrong population.");
      if (selection.policyVersion === PRIOR_APPEARANCE_POLICY_VERSION) verifyBaselineHistoricalSources(payload.historicalSources, payload.appearances,
        payload.nhlPlayerId, request.acquisition.seasonId, payload.capturedAt, payload.limitations ?? []);
      snapshot = buildNativeSkaterBaselineSnapshot(calculation);
    } else {
      if (player.playerClass !== "goalie" || observation.dataset_key !== "goalie-baseline-inputs-v1") throw new Error("Selected goalie policy has wrong population.");
      if (selection.policyVersion === NATIVE_GOALIE_WIN_POLICY_VERSION) snapshot = buildNativeGoalieWinRates(calculation);
      else if (selection.policyVersion === NATIVE_GOALIE_VOLUME_POLICY_VERSION) snapshot = buildNativeGoalieVolumeRates(calculation);
      else if (selection.policyVersion === NATIVE_GOALIE_SHUTOUT_POLICY_VERSION) snapshot = buildNativeGoalieShutoutRates(calculation);
      else if (selection.policyVersion === NATIVE_GOALIE_SUMMARY_WIN_POLICY_VERSION) snapshot = buildNativeGoalieSummaryWinRates(calculation);
      else throw new Error("Unsupported selected native policy.");
    }
    if (snapshot.definitionHash !== payload.definitionHash) throw new Error("Native policy definition mismatch.");
    if (additional.includes(observation)) {
      // Existing validators establish source semantics; this layer also retains original byte parents.
      const bind = (value: any): void => {
        if (!value || typeof value !== "object") return;
        for (const [key, child] of Object.entries(value)) {
          if (["contentHash", "bodySha256"].includes(key) && typeof child === "string"
            && !parentMap.has(child) && !request.acquisition.receipts.some(receipt => receipt.bodySha256 === child)) {
            throw new Error("Additional native observation lacks acquired original parent.");
          }
          if (child && typeof child === "object") bind(child);
        }
      };
      bind(payload);
    }
    const key = `${observation.dataset_key}:${observation.entity_key}:${payload.policyVersion}`;
    items.push({ key, hash: observation.payload_hash, availableAt: payload.capturedAt });
    rows.push(row(key, observation.dataset_key, "player", observation.entity_key, payload, payload.capturedAt));
  }
  if (additional.some(value => !request.nativeSelection.some(selection => selection.playerId === value.payload?.playerId
    && selection.policyVersion === value.payload?.policyVersion && selection.inputHash === value.payload_hash))) throw new Error("Unselected additional native observation.");
  if ((request.existingInputs?.length ?? 0) > 200 || new Set(request.existingInputs?.map(value => value.id)).size !== (request.existingInputs?.length ?? 0)
    || new Set(request.existingInputs?.map(value => `${value.provider}:${value.dataset_key}:${value.entity_key}:${value.payload_hash}`)).size !== (request.existingInputs?.length ?? 0)) {
    throw new Error("Existing native input identity bound exceeded.");
  }
  for (const existing of request.existingInputs ?? []) {
    const index = rows.findIndex(value => value.entity_kind === "player" && value.payload_hash === existing.payload_hash
      && value.provider === existing.provider && value.dataset_key === existing.dataset_key && value.entity_key === existing.entity_key);
    const expected = rows[index];
    if (!expected || !validPlannedObservationId(existing.id) || existing.entity_kind !== "player"
      || hash(existing.payload) !== existing.payload_hash || hash(existing.payload) !== hash(expected.payload)
      || timestampMicros(existing.available_at) !== timestampMicros(expected.available_at)
      || timestampMicros(existing.observed_at) === null || timestampMicros(existing.observed_at)! > timestampMicros(existing.available_at)!) {
      throw new Error("Existing native input immutable envelope does not match materialized original.");
    }
    rows[index] = structuredClone(existing);
  }
  const groups = new Map<string, ParticipationInput[]>();
  for (const input of participation) {
    const player = request.acquisition.roster.find(candidate => candidate.playerId === input.scope.playerId);
    if (!player || player.nhlPlayerId !== input.scope.nhlPlayerId || player.teamId !== input.scope.teamId
      || player.playerClass !== input.playerClass || player.rosterRevision !== input.scope.rosterRevision || input.scope.seasonId !== request.acquisition.seasonId
      || timestampMicros(input.cutoffAt) === null || timestampMicros(input.cutoffAt)! > cutoff) throw new Error("Participation input is outside materialized roster/cutoff.");
    // Existing method builders remain authoritative about supported/null model outputs.
    // Here every evidence reference must additionally resolve to acquired original lineage.
    const checkEvidence = (value: any): void => {
      if (!value || typeof value !== "object") return;
      if ("id" in value && "hash" in value && "availableAt" in value && "capturedAt" in value) {
        const parent = parentMap.get(value.hash);
        if (!parent || parent.id !== value.id || parent.availableAt !== value.availableAt || parent.capturedAt !== value.capturedAt) {
          throw new Error("Participation evidence lacks required acquired parent.");
        }
      }
      for (const child of Object.values(value)) if (child && typeof child === "object") checkEvidence(child);
    };
    checkEvidence(input);
    // Discarded builder result only validates the input. These temporary clocks are never persisted as a forecast.
    const clocks = { issuedAt: closedAt, expiresAt: new Date(new Date(closedAt).getTime() + 1).toISOString() };
    const dataset = input.version === "skater-roster-observation-participation-input-v1" ? "skater-roster-observation-participation-bundle-v1"
      : input.version === "goalie-roster-observation-participation-input-v1" ? "goalie-roster-observation-participation-bundle-v1"
        : input.version === "goalie-roster-observation-start-input-v1" ? "goalie-roster-observation-start-bundle-v1"
          : input.version === "skater-rolling-14d-participation-input-v1" ? "skater-rolling-14d-participation-bundle-v1"
            : input.version === "goalie-rolling-14d-participation-input-v1" ? "goalie-rolling-14d-participation-bundle-v1"
              : input.version === "goalie-rolling-14d-start-input-v1" ? "goalie-rolling-14d-start-bundle-v1" : null;
    if (!dataset) throw new Error("Unsupported materialized participation method.");
    if (input.version === "skater-roster-observation-participation-input-v1") buildRosterObservationSkaterParticipationReceipt(input, clocks);
    else if (input.version === "goalie-roster-observation-participation-input-v1") buildRosterObservationGoalieParticipationReceipt(input, clocks);
    else if (input.version === "goalie-roster-observation-start-input-v1") buildRosterObservationGoalieStartReceipt(input, clocks);
    else if (input.version === "skater-rolling-14d-participation-input-v1") buildRollingWindowSkaterParticipationReceipt(input, clocks);
    else if (input.version === "goalie-rolling-14d-participation-input-v1") buildRollingWindowGoalieParticipationReceipt(input, clocks);
    else buildRollingWindowGoalieStartReceipt(input, clocks);
    items.push({ key: `${dataset}:${input.scope.playerId}:${input.scope.gameId}`, hash: hash(input), availableAt: input.cutoffAt });
    const group = groups.get(dataset) ?? []; group.push(input); groups.set(dataset, group);
  }
  for (const [dataset, allInputs] of groups) for (const [index, inputs] of packed(allInputs).entries()) {
    rows.push(row(`participation:${dataset}:${index}`, "native-participation-input-v1", "participation_input",
      `${request.acquisition.seasonId}:${dataset}:${index}`, { dataset, inputs }, inputs.reduce((latest, value) =>
        timestampMicros(value.cutoffAt)! > timestampMicros(latest)! ? value.cutoffAt : latest, inputs[0].cutoffAt)));
  }
  const manifest = nativeInputManifest(items);
  if (!manifest.expectedItems) throw new Error("No native input was materialized; coverage alone is not a forecast input.");
  const { receipts: _receipts, ...scope } = request.acquisition;
  const report = row("materialization", VERSION, "input_materialization", `${request.date}:${request.sourceKey}`, {
    version: VERSION, runId: request.runId, sourceKey: request.sourceKey, date: request.date, closureScopeHash: request.closureScopeHash,
    scope, requiredParents: required, nativeSelection: request.nativeSelection,
    additionalHashes: additional.map(value => value.payload_hash),
    existingInputIds: (request.existingInputs ?? []).map(value => value.id),
    acquisitionScopeHash: nativeAcquisitionScopeHash(request), closedAt, manifest, coverage: assembled.coverage,
    selectedHistoryCoverage: assembled.selectedHistoryCoverage,
    rows: rows.map(value => ({ id: value.id, hash: value.payload_hash, dataset: value.dataset_key })),
  }, closedAt);
  // Run identities are stable even when an interrupted call is resumed at a later clock.
  report.id = identity(request.runId, "materialization");
  const closure = row("closure", "native-producer-closure-v1", "producer_closure", `${request.date}:${request.sourceKey}`, {
    version: "native-producer-closure-v1", producerVersion: VERSION, status: "closed", scopeHash: request.closureScopeHash,
    acquisitionScopeHash: nativeAcquisitionScopeHash(request), inputCutoffAt: request.acquisition.cutoffAt,
    inputRevision: manifest.revision, expectedItems: manifest.expectedItems, completedItems: manifest.expectedItems,
    runId: request.runId, closedAt, materializationId: report.id, materializationHash: report.payload_hash,
  }, closedAt);
  closure.id = identity(request.runId, "closure");
  const all = [...rows, report, closure];
  if (all.length > 320 || all.some(value => Buffer.byteLength(JSON.stringify(value)) > 8 * 1024 * 1024)
    || Buffer.byteLength(JSON.stringify(all)) > MAX_BYTES || new Set(all.map(value => value.id)).size !== all.length) throw new Error("Materialization row/byte/identity bound exceeded.");
  return { rows, report, closure, manifest };
}

/** Reproduce from durable originals and standalone inputs, rather than trusting counts. */
export async function verifyNativeMaterialization(db: SupabaseClient<any>, closure: PlannedSourceObservation, deadline = Date.now() + 180000) {
  const value = closure.payload as any;
  const read = async (id: string) => {
    if (!validPlannedObservationId(id)) throw new Error("Invalid materialization parent ID.");
    const result = await withinDeadline(Math.min(deadline, Date.now() + 8000), signal => db.from("player_forecast_source_observations")
      .select(SOURCE_OBSERVATION_COLUMNS).eq("id", id).limit(2).abortSignal(signal));
    const row = result.data?.[0] as PlannedSourceObservation | undefined;
    if (result.error || result.data?.length !== 1 || !row || Buffer.byteLength(JSON.stringify(row)) > 8 * 1024 * 1024
      || row.payload_hash !== hash(row.payload)) throw new Error("Materialized input readback unavailable or changed.");
    return row;
  };
  const report = await read(value.materializationId), payload = report.payload as any;
  if (report.payload_hash !== value.materializationHash || !Array.isArray(payload.rows) || payload.rows.length > 318) throw new Error("Materialization report mismatch.");
  const rows: PlannedSourceObservation[] = [];
  let bytes = 0;
  for (const reference of payload.rows) {
    const row = await read(reference.id);
    bytes += Buffer.byteLength(JSON.stringify(row));
    if (bytes > MAX_BYTES) throw new Error("Materialization parent byte bound exceeded.");
    if (row.payload_hash !== reference.hash || row.dataset_key !== reference.dataset) throw new Error("Materialization parent mismatch.");
    rows.push(row);
  }
  const rebuilt = prepareNativeInputMaterialization({ runId: payload.runId, sourceKey: payload.sourceKey, date: payload.date,
    closureScopeHash: payload.closureScopeHash, acquisition: { ...payload.scope,
      receipts: rows.filter(row => row.dataset_key === "native-original-http-v1").map(row => row.payload) },
    requiredParents: payload.requiredParents,
    parents: rows.filter(row => row.dataset_key === "native-materialization-parent-v1").flatMap(row => (row.payload as any).parents),
    participationInputs: rows.filter(row => row.dataset_key === "native-participation-input-v1").flatMap(row => (row.payload as any).inputs),
    nativeSelection: payload.nativeSelection,
    additionalNativeObservations: rows.filter(row => row.entity_kind === "player" && payload.additionalHashes.includes(row.payload_hash)).map(row => ({
      provider: row.provider, dataset_key: row.dataset_key, entity_kind: row.entity_kind, entity_key: row.entity_key,
      // The typed outer timestamptz may use an equivalent Data API rendering.
      // Replay the unchanged captured string authenticated inside the payload;
      // preparation still verifies exact instant equality against existingInputs.
      available_at: (row.payload as any).capturedAt, payload_hash: row.payload_hash, payload: row.payload })),
    existingInputs: rows.filter(row => payload.existingInputIds.includes(row.id)),
  } as NativeMaterializationRequest, payload.closedAt);
  if (!matchesPlannedObservation(report, rebuilt.report) || !matchesPlannedObservation(closure, rebuilt.closure)
    || rebuilt.rows.length !== rows.length || rebuilt.rows.some(expected => !rows.some(actual => matchesPlannedObservation(actual, expected)))) {
    throw new Error("Materialization cannot be reproduced from durable original inputs.");
  }
}

export async function materializeNativeInputs(request: NativeMaterializationRequest, options: {
  now: Date; dryRun?: boolean; db?: SupabaseClient<any>;
}) {
  const frozen = structuredClone(request);
  let prepared = prepareNativeInputMaterialization(frozen, options.now.toISOString());
  if (options.dryRun !== false) return { status: "dry_run" as const, ...prepared, writes: 0 };
  if (!options.db) throw new Error("Explicit materialization database required.");
  const deadline = Date.now() + 180000;
  const db = { from(table: string) {
    if (table !== "player_forecast_source_observations") throw new Error("Materialization table denied.");
    const wrap = (query: any): any => new Proxy(query, { get(target, key) {
      if (key === "then") return (ok: any, fail: any) => withinDeadline(Math.min(deadline, Date.now() + 8000),
        signal => target.abortSignal(signal)).then(ok, fail);
      const member = Reflect.get(target, key);
      return typeof member === "function" ? (...args: any[]) => wrap(member.apply(target, args)) : member;
    } });
    return wrap(options.db!.from(table));
  } } as unknown as SupabaseClient<any>;
  let writes = 0;
  const existingRun = async (dataset: string, kind: string) => {
    const result = await db.from("player_forecast_source_observations").select(SOURCE_OBSERVATION_COLUMNS)
      .eq("provider", "fhfh").eq("dataset_key", dataset).eq("entity_kind", kind)
      .eq("entity_key", `${frozen.date}:${frozen.sourceKey}`).eq("payload->>runId", frozen.runId).limit(2);
    if (result.error || !Array.isArray(result.data) || result.data.length > 1) throw new Error("Materialization run readback unavailable.");
    return result.data[0] as PlannedSourceObservation | undefined;
  };
  let closed: PlannedSourceObservation | undefined, report: PlannedSourceObservation | undefined;
  try {
    closed = await existingRun("native-producer-closure-v1", "producer_closure");
    report = await existingRun(VERSION, "input_materialization");
    if (closed || report) {
      const prior = prepareNativeInputMaterialization(frozen, ((closed ?? report)!.payload as any).closedAt);
      if (closed && !matchesPlannedObservation(closed, prior.closure)
        || !report || !matchesPlannedObservation(report, prior.report)) throw new Error("Materialization run identity conflicts.");
      await verifyNativeMaterialization(db, prior.closure, deadline);
      prepared = prior;
      if (closed) return { status: "closed" as const, ...prepared, writes: 0, reconciled: true, publicUsesApproved: false as const };
    }
  } catch {
    return { status: "unknown" as const, ...prepared, writes: 0, reason: "materialization_run_requires_exact_readback", publicUsesApproved: false as const };
  }
  const persist = async (row: PlannedSourceObservation) => {
    // Every parent is acknowledged and exactly read back before closure is even attempted.
    const present = await db.from("player_forecast_source_observations").select(SOURCE_OBSERVATION_COLUMNS).eq("id", row.id).limit(2);
    if (present.error || !Array.isArray(present.data) || present.data.length > 1) throw new Error("Materialization input preflight unavailable.");
    if (present.data.length) {
      if (!matchesPlannedObservation(present.data[0], row)) throw new Error("Existing materialization input conflicts.");
      return;
    }
    await capturePlayerForecastSourceObservation({ supabase: db, observationId: row.id, provider: row.provider,
      datasetKey: row.dataset_key, entityKind: row.entity_kind, entityKey: row.entity_key, sourceUrl: row.source_url,
      sourceRevisionKey: row.source_revision_key, observedAt: row.observed_at, availableAt: row.available_at,
      payload: row.payload, metadata: row.metadata });
    writes++;
    const result = await db.from("player_forecast_source_observations").select(SOURCE_OBSERVATION_COLUMNS).eq("id", row.id).limit(2);
    if (result.error || result.data?.length !== 1 || !matchesPlannedObservation(result.data[0], row)) throw new Error("Materialization write acknowledgement requires exact readback.");
  };
  try {
    for (const row of prepared.rows) await persist(row);
    // Reuse an acknowledged immutable report's original clock; never redate a same-run retry.
    if (!report) prepared = prepareNativeInputMaterialization(frozen, new Date().toISOString());
    await persist(prepared.report);
    await persist(prepared.closure);
    await verifyNativeMaterialization(db, prepared.closure, deadline);
    return { status: "closed" as const, ...prepared, writes, publicUsesApproved: false as const,
      limitation: "Complete only for declared acquisition scope; no current-period or complete season history claim." };
  } catch {
    try {
      const retained = await existingRun("native-producer-closure-v1", "producer_closure");
      if (!retained || !matchesPlannedObservation(retained, prepared.closure)) throw new Error("Closure is not acknowledged.");
      await verifyNativeMaterialization(db, retained, deadline);
      return { status: "closed" as const, ...prepared, writes, reconciled: true, publicUsesApproved: false as const };
    } catch { return { status: "unknown" as const, ...prepared, writes, reason: "materialization_run_requires_exact_readback", publicUsesApproved: false as const }; }
  }
}
