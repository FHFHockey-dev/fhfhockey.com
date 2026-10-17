import type { SupabaseClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import { advanceNativeCatalogHead, prepareNativeCatalogObservation } from "./nativeCatalogHead";
import { nativeInputManifest, verifyNativeMaterialization } from "./nativeInputMaterialization";
import { withinDeadline } from "../rosterScheduleData/planningInputs";
import { prepareForecastCadence, type ForecastCadenceInput } from "../fantasy-projections/seasonJobs";
import { capturePlayerForecastSourceObservation, matchesPlannedObservation, SOURCE_OBSERVATION_COLUMNS,
  verifyPlannedObservation, playerForecastSourcePayloadHash as hash, type PlannedSourceObservation } from "./sourceSnapshot";
import { publishNativeBaselinePlan, validateNativeBaselinePublication, PUBLICATION_LIMITS,
  type NativeBaselinePublicationPlan } from "./nativeBaselinePublication";

export const NATIVE_BASELINE_CADENCE_LIMITS = Object.freeze({ sources: 32, previous: 128, metadataBytes: 64 * 1024 });
const localDate = (value: string) => new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York",
  year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(value));
const seasonForDate = (date: string) => {
  const year = Number(date.slice(0, 4)) - (Number(date.slice(5, 7)) < 7 ? 1 : 0);
  return year * 10000 + year + 1;
};

/** The observer must count these declared immutable inputs, not elapsed time or
 * detailed-queue success. A manifest is an identity binding, not completeness proof. */
export function nativeCadenceInputManifest(plan: NativeBaselinePublicationPlan) {
  const inputs = plan.rows.flatMap<{ key: string; hash: string; availableAt: string }>(row => {
    const payload = row.payload as any;
    if (row.entity_kind === "player") return [{ key: `${row.dataset_key}:${row.entity_key}:${payload.policyVersion ?? "legacy"}`, hash: row.payload_hash, availableAt: row.available_at }];
    if (row.entity_kind === "participation_bundle") return payload.entries.map((entry: any) => ({
      key: `${row.dataset_key}:${entry.input.scope.playerId}:${entry.input.scope.gameId}`,
      hash: hash(entry.input), availableAt: entry.input.cutoffAt,
    }));
    return [];
  });
  return nativeInputManifest(inputs);
}

/** Native publication stage for one explicit 08:00-NY or T-15 decision.
 * Callers supply actual durable source/attempt receipts and an exactly reviewed
 * plan. This neither observes upstream jobs nor replaces the public selector.
 * No legacy detailed worker or scheduler is invoked by this adapter. */
export async function publishNativeBaselineCadence(input: {
  cadence: ForecastCadenceInput; slotKey: string; inputSourceKey: string;
  publicationPlan: NativeBaselinePublicationPlan;
  requiredAcquisitionScopes?: Record<string, { scopeHash: string; cutoffAt: string }>;
}, options: { dryRun?: boolean; approvedPackageHash?: string; db?: SupabaseClient<any>; monotonic?: () => number } = {}) {
  if (!Array.isArray(input.cadence.sources) || input.cadence.sources.length > NATIVE_BASELINE_CADENCE_LIMITS.sources
    || !Array.isArray(input.cadence.requiredSources) || input.cadence.requiredSources.length > NATIVE_BASELINE_CADENCE_LIMITS.sources
    || !Array.isArray(input.cadence.previous) || input.cadence.previous.length > NATIVE_BASELINE_CADENCE_LIMITS.previous
    || Buffer.byteLength(JSON.stringify({ cadence: input.cadence, slotKey: input.slotKey, inputSourceKey: input.inputSourceKey }))
      > NATIVE_BASELINE_CADENCE_LIMITS.metadataBytes) throw new Error("Native cadence metadata bound exceeded.");
  const now = new Date(input.cadence.now.getTime());
  const frozen = JSON.parse(JSON.stringify(input)) as typeof input;
  frozen.cadence.now = now;
  const decision = prepareForecastCadence(frozen.cadence);
  const slot = decision.slots.find(candidate => candidate.key === frozen.slotKey);
  if (!slot) throw new Error("Native cadence slot is outside the declared scope.");
  const held = (reasons: string[]) => ({ status: "held" as const, slot, reasons,
    activationApproved: false as const, selectedCatalogUpdated: false as const, cadenceComplete: false as const });
  if (slot.action === "hold") return held(slot.reasons);
  if (frozen.publicationPlan.seasonId !== seasonForDate(frozen.cadence.date)) return held(["native_target_scope_mismatch"]);
  await validateNativeBaselinePublication(frozen.publicationPlan, now);
  const manifest = nativeCadenceInputManifest(frozen.publicationPlan);
  const source = frozen.cadence.sources.find(candidate => candidate.key === frozen.inputSourceKey && candidate.date === frozen.cadence.date);
  if (!frozen.cadence.requiredSources.includes(frozen.inputSourceKey) || !manifest.expectedItems || !source
    || source.revision !== manifest.revision || source.expectedItems !== manifest.expectedItems
    || source.completedItems !== manifest.expectedItems || !source.completedAt || manifest.availableAt === null
    || Date.parse(source.completedAt) < Date.parse(manifest.availableAt)) return held(["native_input_manifest_mismatch"]);
  const targets: Array<{ playerId: number; nhlPlayerId: number; teamId: number; rosterRevision: string;
    seasonId: number; gameId: number; scheduledAt: string }> = [];
  const outputs: string[] = [];
  const baselines: any[] = [];
  for (const row of frozen.publicationPlan.rows) {
    const payload = row.payload as any;
    if (row.entity_kind === "participation_bundle") {
      targets.push(...payload.entries.map((entry: any) => entry.input.scope));
      outputs.push(payload.issuedAt);
    }
    if (row.entity_kind === "seasonal_rate_bundle") {
      outputs.push(payload.manifest.issuedAt);
      baselines.push(...payload.sources);
      targets.push(...payload.sources.filter((value: any) => value.gameId != null));
    }
  }
  const gameClocks = new Map<number, number>();
  for (const target of targets) {
    const start = Date.parse(target.scheduledAt), previous = gameClocks.get(target.gameId);
    if (!Number.isSafeInteger(target.gameId) || !Number.isFinite(start) || start <= now.getTime()
      || target.seasonId !== frozen.publicationPlan.seasonId || seasonForDate(localDate(target.scheduledAt)) !== target.seasonId
      || previous !== undefined && previous !== start) return held(["native_target_scope_mismatch"]);
    gameClocks.set(target.gameId, start);
  }
  const requiredGames = slot.gameId === null ? frozen.cadence.games : frozen.cadence.games.filter(game => game.gameId === slot.gameId);
  if (!requiredGames.length || requiredGames.some(game => gameClocks.get(game.gameId) !== Date.parse(game.startsAt))
    || baselines.some(baseline => !targets.some(target => target.playerId === baseline.playerId
      && target.nhlPlayerId === baseline.nhlPlayerId && target.teamId === baseline.teamId
      && target.rosterRevision === baseline.rosterRevision && (baseline.gameId == null || target.gameId === baseline.gameId)))
    || !outputs.length || outputs.some(issuedAt => localDate(issuedAt) !== frozen.cadence.date
      || Date.parse(issuedAt) < Date.parse(slot.dueAt) || Date.parse(issuedAt) < Date.parse(source.completedAt!))) {
    return held(["native_target_scope_mismatch"]);
  }
  const publication = await publishNativeBaselinePlan(frozen.publicationPlan, { ...options, now });
  return { status: publication.status, slot, inputManifest: manifest, publication,
    attempt: (frozen.cadence.previous.find(previous => previous.key === slot.key)?.attempts ?? 0) + (options.dryRun === false ? 1 : 0),
    // Persisted rows/proposed pins are not proof that a consumer selected them.
    activationApproved: false as const, selectedCatalogUpdated: false as const, cadenceComplete: false as const };
}

const JOURNAL_DATASET = "native-baseline-cadence-slot-v1";
type JournalPayload = { version: typeof JOURNAL_DATASET; seasonId: number; slotKey: string; attempt: number;
  phase: "claim" | "result"; owner: string; packageHash: string; inputRevision: string; recordedAt: string;
  status: "running" | "succeeded" | "failed" };
/** Deterministic primary keys make the claim insert atomic across callers. */
export function nativeCadenceJournalIds(seasonId: number, slotKey: string) {
  return [1, 2, 3].flatMap(attempt => (["claim", "result"] as const).map(phase => {
    const key = hash({ version: JOURNAL_DATASET, seasonId, slotKey, attempt, phase });
    return { attempt, phase, id: `${key.slice(0, 8)}-${key.slice(8, 12)}-4${key.slice(13, 16)}-a${key.slice(17, 20)}-${key.slice(20, 32)}` };
  }));
}
function journalRow(payload: JournalPayload): PlannedSourceObservation {
  const identity = nativeCadenceJournalIds(payload.seasonId, payload.slotKey).find(row => row.attempt === payload.attempt && row.phase === payload.phase)!;
  return { id: identity.id, provider: "fhfh", dataset_key: JOURNAL_DATASET, entity_kind: "cadence_slot",
    entity_key: `${payload.seasonId}:${payload.slotKey}`, source_url: null, source_revision_key: payload.packageHash,
    observed_at: payload.recordedAt, available_at: payload.recordedAt, payload_hash: hash(payload), payload,
    metadata: { phase: payload.phase, attempt: payload.attempt } };
}

/** Durable publication-stage deduplication. This does not claim upstream job
 * completeness or install/select a serving catalog. No caller attempt receipt
 * is used; an unacknowledged claim blocks recovery until exact row readback. */
export async function publishJournaledNativeBaselineCadence(input: Parameters<typeof publishNativeBaselineCadence>[0],
  options: Parameters<typeof publishNativeBaselineCadence>[1] = {}) {
  if (options.dryRun !== false) return publishNativeBaselineCadence(input, options);
  if (!options.db || options.approvedPackageHash !== hash(input.publicationPlan)) throw new Error("Exact cadence package approval and client required.");
  const monotonic = options.monotonic ?? (() => performance.now()), started = monotonic();
  const frozen = JSON.parse(JSON.stringify(input)) as typeof input;
  frozen.cadence.now = new Date(input.cadence.now.getTime());
  // Validate the finite plan, due slot and declared inputs before any journal IO.
  const preliminary = await publishNativeBaselineCadence({ ...frozen, cadence: { ...frozen.cadence, previous: [] } }, { ...options, dryRun: true });
  if (preliminary.status === "held") return preliminary;
  const deadline = Date.now() + 180000;
  const db = { from(table: string) {
    if (table !== "player_forecast_source_observations") throw new Error("Cadence journal table scope denied.");
    const wrap = (query: any): any => new Proxy(query, { get(target, key) {
      if (key === "then") return (ok: any, fail: any) => withinDeadline(Math.min(deadline, Date.now() + 8000),
        signal => target.abortSignal(signal)).then(ok, fail);
      const value = Reflect.get(target, key);
      return typeof value === "function" ? (...args: any[]) => wrap(value.apply(target, args)) : value;
    } });
    return wrap(options.db!.from(table));
  } } as unknown as SupabaseClient<any>;
  const clock = () => new Date(frozen.cadence.now.getTime() + monotonic() - started).toISOString();
  const held = (reason: string) => ({ status: "held" as const, reasons: [reason], activationApproved: false as const,
    selectedCatalogUpdated: false as const, cadenceComplete: false as const });
  const ids = nativeCadenceJournalIds(frozen.publicationPlan.seasonId, frozen.slotKey);
  let stored: PlannedSourceObservation[];
  try {
    const result = await db.from("player_forecast_source_observations").select(SOURCE_OBSERVATION_COLUMNS).in("id", ids.map(row => row.id)).limit(ids.length + 1);
    if (result.error || !Array.isArray(result.data) || result.data.length > ids.length
      || Buffer.byteLength(JSON.stringify(result.data)) > NATIVE_BASELINE_CADENCE_LIMITS.metadataBytes
      || new Set(result.data.map((row: any) => row.id)).size !== result.data.length) return held("cadence_journal_unavailable");
    stored = result.data;
    for (const row of stored) {
      const value = row.payload as JournalPayload;
      if (!value || value.version !== JOURNAL_DATASET || value.seasonId !== frozen.publicationPlan.seasonId || value.slotKey !== frozen.slotKey
        || !ids.some(id => id.id === row.id && id.attempt === value.attempt && id.phase === value.phase)
        || !/^[a-f0-9]{64}$/.test(value.packageHash) || !/^[a-f0-9]{64}$/.test(value.inputRevision)
        || !/^[a-f0-9-]{36}$/.test(value.owner) || !Number.isFinite(Date.parse(value.recordedAt))
        || Date.parse(value.recordedAt) > Date.parse(clock()) || !matchesPlannedObservation(row, journalRow(value))
        || (value.phase === "claim" ? value.status !== "running" : !["succeeded", "failed"].includes(value.status))) return held("cadence_journal_conflict");
    }
  } catch { return held("cadence_journal_unavailable"); }
  let latest: JournalPayload | undefined;
  for (let attempt = 1; attempt <= 3; attempt++) {
    const claim = stored.find(row => (row.payload as JournalPayload).attempt === attempt && (row.payload as JournalPayload).phase === "claim")?.payload as JournalPayload | undefined;
    const terminal = stored.find(row => (row.payload as JournalPayload).attempt === attempt && (row.payload as JournalPayload).phase === "result")?.payload as JournalPayload | undefined;
    if (terminal && (!claim || terminal.owner !== claim.owner || terminal.packageHash !== claim.packageHash
      || terminal.inputRevision !== claim.inputRevision || Date.parse(terminal.recordedAt) < Date.parse(claim.recordedAt))
      || claim && attempt > 1 && latest?.status !== "failed") return held("cadence_journal_conflict");
    if (!claim) {
      if (stored.some(row => (row.payload as JournalPayload).attempt > attempt)) return held("cadence_journal_conflict");
      break;
    }
    latest = terminal ?? claim;
  }
  const write = async (payload: JournalPayload) => {
    const row = journalRow(payload);
    try {
      const inserted = await capturePlayerForecastSourceObservation({ supabase: db, observationId: row.id, provider: row.provider,
        datasetKey: row.dataset_key, entityKind: row.entity_kind, entityKey: row.entity_key, sourceRevisionKey: row.source_revision_key,
        observedAt: row.observed_at, availableAt: row.available_at, payload, metadata: row.metadata });
      if (!inserted.inserted && payload.phase === "claim") return false;
    } catch {
      // A lost acknowledgement is reconciled by our unique owner-bound row.
      try { await verifyPlannedObservation(db, row); } catch { return false; }
    }
    try { await verifyPlannedObservation(db, row); return true; } catch { return false; }
  };
  if (latest?.status === "running") {
    if (latest.packageHash !== options.approvedPackageHash) return held("cadence_slot_unknown");
    try {
      const rows = frozen.publicationPlan.rows;
      const result = await db.from("player_forecast_source_observations").select(SOURCE_OBSERVATION_COLUMNS).in("id", rows.map(row => row.id)).limit(rows.length + 1);
      if (result.error || !Array.isArray(result.data) || result.data.length !== rows.length
        || Buffer.byteLength(JSON.stringify(result.data)) > PUBLICATION_LIMITS.totalBytes
        || new Set(result.data.map((row: any) => row.id)).size !== rows.length
        || result.data.some((row: any) => !rows.some(expected => expected.id === row.id && matchesPlannedObservation(row, expected)))) return held("cadence_slot_unknown");
      const reconciled = await write({ ...latest, phase: "result", status: "succeeded", recordedAt: clock() });
      return held(reconciled ? "cadence_slot_persisted_reconciled" : "cadence_journal_unknown");
    } catch { return held("cadence_slot_unknown"); }
  }
  frozen.cadence.previous = latest ? [{ key: frozen.slotKey, status: latest.status, attempts: latest.attempt }] : [];
  const preview = await publishNativeBaselineCadence(frozen, { ...options, dryRun: true });
  if (preview.status === "held") return preview;
  const claim: JournalPayload = { version: JOURNAL_DATASET, seasonId: frozen.publicationPlan.seasonId, slotKey: frozen.slotKey,
    attempt: (latest?.attempt ?? 0) + 1, phase: "claim", owner: randomUUID(), packageHash: options.approvedPackageHash,
    inputRevision: nativeCadenceInputManifest(frozen.publicationPlan).revision, recordedAt: clock(), status: "running" };
  if (!await write(claim)) return held("cadence_claim_unconfirmed");
  let result: Awaited<ReturnType<typeof publishNativeBaselineCadence>>;
  try { result = await publishNativeBaselineCadence(frozen, { ...options, db, dryRun: false }); }
  catch { return held("cadence_slot_unknown"); }
  const publication = "publication" in result ? result.publication : undefined;
  // Uncertain publisher state never earns a failed receipt/retry allowance.
  if (!publication || publication.unknownIds.length) return { ...held("cadence_slot_unknown"), publicationResult: result };
  const confirmed = await write({ ...claim, phase: "result", status: publication.status === "persisted_not_activated" ? "succeeded" : "failed", recordedAt: clock() });
  return { ...result, journalConfirmed: confirmed, ...(!confirmed ? { status: "journal_unknown" as const } : {}),
    selectedCatalogUpdated: false as const, activationApproved: false as const, cadenceComplete: false as const };
}

export function nativeCadenceClosureScope(input: Parameters<typeof publishNativeBaselineCadence>[0]) {
  return hash({ seasonId: input.publicationPlan.seasonId, date: input.cadence.date,
    requiredSources: input.cadence.requiredSources.slice().sort(), games: input.cadence.games.slice().sort((a, b) => a.gameId - b.gameId),
    requiredAcquisitionScopes: input.requiredAcquisitionScopes ?? {} });
}
/** Reproduce the materializer's durable original inputs before accepting closure.
 * Neither manifest identity nor caller counts imply completion. */
export async function observeClosedNativeCadenceSources(input: Parameters<typeof publishNativeBaselineCadence>[0],
  db: SupabaseClient<any>, receiptIds: Record<string, string> = {}) {
  const manifest = nativeCadenceInputManifest(input.publicationPlan), sources: ForecastCadenceInput["sources"] = [];
  const deadline = Date.now() + 180000;
  if (input.cadence.requiredSources.length > NATIVE_BASELINE_CADENCE_LIMITS.sources) throw new Error("Producer receipt bound exceeded.");
  for (const key of input.cadence.requiredSources) {
    const id = receiptIds[key];
    if (!id || !/^[a-f0-9-]{36}$/.test(id)) return { complete: false as const, sources, reason: `producer_closed_receipt_missing:${key}` };
    try {
      const result = await withinDeadline(Math.min(deadline, Date.now() + 8000), signal => db.from("player_forecast_source_observations")
        .select(SOURCE_OBSERVATION_COLUMNS).eq("id", id).limit(2).abortSignal(signal));
      const row = result.data?.[0], value = row?.payload;
      const required = input.requiredAcquisitionScopes?.[key];
      if (result.error || !Array.isArray(result.data) || result.data.length !== 1 || !row || row.id !== id || Buffer.byteLength(JSON.stringify(row)) > 64 * 1024
        || row.provider !== "fhfh" || row.dataset_key !== "native-producer-closure-v1" || row.entity_kind !== "producer_closure"
        || row.entity_key !== `${input.cadence.date}:${key}` || row.payload_hash !== hash(value)
        || value?.version !== "native-producer-closure-v1" || value.producerVersion !== "native-input-materialization-v1" || value.status !== "closed"
        || !required || !/^[a-f0-9]{64}$/.test(required.scopeHash) || value.acquisitionScopeHash !== required.scopeHash
        || value.inputCutoffAt !== required.cutoffAt
        || value.scopeHash !== nativeCadenceClosureScope(input) || value.inputRevision !== manifest.revision
        || value.expectedItems !== manifest.expectedItems || value.completedItems !== manifest.expectedItems
        || !/^[a-f0-9-]{36}$/.test(value.runId) || !Number.isFinite(Date.parse(value.closedAt))
        || Date.parse(value.closedAt) > input.cadence.now.getTime() || !Number.isFinite(Date.parse(row.available_at))
        || Date.parse(row.available_at) < Date.parse(value.closedAt) || Date.parse(row.available_at) > input.cadence.now.getTime()
        || Date.parse(value.closedAt) < Date.parse(manifest.availableAt ?? "") || Date.parse(row.observed_at) !== Date.parse(value.closedAt)) {
        return { complete: false as const, sources, reason: `producer_closed_receipt_invalid:${key}` };
      }
      await verifyNativeMaterialization(db, row as PlannedSourceObservation, deadline);
      sources.push({ key, date: input.cadence.date, revision: value.inputRevision, status: "complete", completedAt: value.closedAt,
        expectedItems: value.expectedItems, completedItems: value.completedItems });
    } catch { return { complete: false as const, sources, reason: `producer_closed_receipt_unavailable:${key}` }; }
  }
  return { complete: true as const, sources, reason: null };
}

/** Default-off coherent publication/selection path. The observer, journal,
 * publisher and selector each require their own exact durable evidence. */
export async function publishObservedNativeBaselineCadence(input: Parameters<typeof publishNativeBaselineCadence>[0],
  options: NonNullable<Parameters<typeof publishNativeBaselineCadence>[1]> & { producerReceiptIds?: Record<string, string>;
    catalogHead?: { headId: string; expectedRevision: number; expectedHash: string | null; observationId: string } } = {}) {
  if (!options.db || options.dryRun !== false) return publishJournaledNativeBaselineCadence(input, options);
  const observed = await observeClosedNativeCadenceSources(input, options.db, options.producerReceiptIds);
  if (!observed.complete) return { status: "held" as const, reasons: [observed.reason], selectedCatalogUpdated: false, cadenceComplete: false };
  const result = await publishJournaledNativeBaselineCadence({ ...input, cadence: { ...input.cadence, sources: observed.sources } }, options);
  if (result.status !== "persisted_not_activated" || !("publication" in result) || !("journalConfirmed" in result) || !result.journalConfirmed || !options.catalogHead) return result;
  const observation = prepareNativeCatalogObservation({ plan: input.publicationPlan, pins: result.publication.proposedPins,
    observationId: options.catalogHead.observationId, issuedAt: input.cadence.now.toISOString() });
  const selected = await advanceNativeCatalogHead({ db: options.db, ...options.catalogHead, observation, now: input.cadence.now, dryRun: false });
  return { ...result, catalogSelection: selected, selectedCatalogUpdated: selected.selectedCatalogUpdated,
    // Actual natural-run acceptance remains an operational gate, not a caller flag.
    cadenceComplete: selected.selectedCatalogUpdated, upstreamClosedReceiptVerified: true };
}
