import type { SupabaseClient } from "@supabase/supabase-js";
import { capturePlayerForecastSourceObservation, matchesPlannedObservation, playerForecastSourcePayloadHash as hash,
  SOURCE_OBSERVATION_COLUMNS, validPlannedObservationId, type PlannedSourceObservation } from "./sourceSnapshot";
import { persistContributionBundle } from "./contributionStore";
import { loadNativeContributionBundle } from "./nativeContributionAdmission";
import { loadModeledSkaterParticipation, loadFrozenWindowSkaterParticipation, loadRosterObservationSkaterParticipation,
  loadRollingWindowSkaterParticipation } from "./modeledSkaterParticipationStore";
import { loadModeledGoalieParticipation, loadFrozenWindowGoalieParticipation, loadFrozenWindowGoalieStarts,
  loadRosterObservationGoalieParticipation, loadRosterObservationGoalieStarts, loadRollingWindowGoalieParticipation,
  loadRollingWindowGoalieStarts } from "./modeledGoalieParticipationStore";
import { timestampMicros } from "../projections/evidenceTime";

// Actual complete six-policy/three-method selection measured 35,355,173 bytes.
// Standalone SDK publication only; this is not a public API response/request limit.
export const PUBLICATION_LIMITS = Object.freeze({ rows: 320, rowBytes: 8 * 1024 * 1024, totalBytes: 48 * 1024 * 1024,
  requestMs: 8000, totalMs: 180000 });
export type NativeBaselinePublicationPlan = { version: "native-baseline-publication-plan-v1"; seasonId: number;
  rows: PlannedSourceObservation[] };
const participationMethods = [
  ["skater-participation-bundle-v1", "PLAYER_FORECAST_PARTICIPATION_RELEASES", loadModeledSkaterParticipation],
  ["skater-frozen-window-participation-bundle-v1", "PLAYER_FORECAST_FROZEN_WINDOW_SKATER_PARTICIPATION_RELEASES", loadFrozenWindowSkaterParticipation],
  ["skater-roster-observation-participation-bundle-v1", "PLAYER_FORECAST_ROSTER_OBSERVATION_SKATER_PARTICIPATION_RELEASES", loadRosterObservationSkaterParticipation],
  ["goalie-participation-bundle-v1", "PLAYER_FORECAST_GOALIE_PARTICIPATION_RELEASES", loadModeledGoalieParticipation],
  ["goalie-frozen-window-participation-bundle-v1", "PLAYER_FORECAST_FROZEN_WINDOW_GOALIE_PARTICIPATION_RELEASES", loadFrozenWindowGoalieParticipation],
  ["goalie-frozen-window-start-bundle-v1", "PLAYER_FORECAST_FROZEN_WINDOW_GOALIE_START_RELEASES", loadFrozenWindowGoalieStarts],
  ["goalie-roster-observation-participation-bundle-v1", "PLAYER_FORECAST_ROSTER_OBSERVATION_GOALIE_PARTICIPATION_RELEASES", loadRosterObservationGoalieParticipation],
  ["goalie-roster-observation-start-bundle-v1", "PLAYER_FORECAST_ROSTER_OBSERVATION_GOALIE_START_RELEASES", loadRosterObservationGoalieStarts],
  ["skater-rolling-14d-participation-bundle-v1", "PLAYER_FORECAST_ROLLING_14D_SKATER_PARTICIPATION_RELEASES", loadRollingWindowSkaterParticipation],
  ["goalie-rolling-14d-participation-bundle-v1", "PLAYER_FORECAST_ROLLING_14D_GOALIE_PARTICIPATION_RELEASES", loadRollingWindowGoalieParticipation],
  ["goalie-rolling-14d-start-bundle-v1", "PLAYER_FORECAST_ROLLING_14D_GOALIE_START_RELEASES", loadRollingWindowGoalieStarts],
] as const;
const kinds: Record<string, string> = { "baseline-inputs-v1": "player", "goalie-baseline-inputs-v1": "player",
  "baseline-evaluation-policy-v1": "baseline_evaluation_policy", "baseline-validation-review-v1": "baseline_validation_review",
  "contribution-bundle-v1": "seasonal_rate_bundle", ...Object.fromEntries(participationMethods.map(([dataset]) => [dataset, "participation_bundle"])) };
const priority = (row: PlannedSourceObservation) => row.entity_kind === "player" ? 0
  : row.entity_kind === "baseline_evaluation_policy" ? 1 : row.entity_kind === "baseline_validation_review" ? 2
    : row.entity_kind === "seasonal_rate_bundle" ? 3 : 4;

/** Existing admission contracts run over exact local rows; this client has no network capability. */
function memoryClient(rows: PlannedSourceObservation[]): SupabaseClient<any> {
  return { from(table: string) {
    if (table !== "player_forecast_source_observations") throw new Error("Unexpected publication replay table.");
    let selected = rows.slice();
    const query: any = { select: () => query,
      eq: (key: string, value: unknown) => { selected = selected.filter(row => (row as any)[key] === value); return query; },
      in: (key: string, values: unknown[]) => { selected = selected.filter(row => values.includes((row as any)[key])); return query; },
      limit: (count: number) => { selected = selected.slice(0, count); return query; },
      then: (ok: any, fail: any) => Promise.resolve({ data: selected, error: null }).then(ok, fail) };
    return query;
  } } as unknown as SupabaseClient<any>;
}

export async function validateNativeBaselinePublication(plan: NativeBaselinePublicationPlan, now: Date) {
  if (plan?.version !== "native-baseline-publication-plan-v1" || Object.keys(plan).some(key => !["version", "seasonId", "rows"].includes(key))
    || !Number.isSafeInteger(plan.seasonId) || !Number.isFinite(now.getTime()) || !Array.isArray(plan.rows)
    || !plan.rows.length || plan.rows.length > PUBLICATION_LIMITS.rows) throw new Error("Invalid bounded publication plan.");
  let bytes = 0;
  const seen = new Set<string>();
  for (const row of plan.rows) {
    const size = Buffer.byteLength(JSON.stringify(row)); bytes += size;
    const at = timestampMicros(row.available_at), observed = timestampMicros(row.observed_at);
    if (Object.keys(row).length !== SOURCE_OBSERVATION_COLUMNS.split(",").length
      || Object.keys(row).some(key => !SOURCE_OBSERVATION_COLUMNS.split(",").includes(key))
      || !validPlannedObservationId(row.id) || seen.has(row.id) || row.provider !== "fhfh" || kinds[row.dataset_key] !== row.entity_kind
      || row.payload_hash !== hash(row.payload) || size > PUBLICATION_LIMITS.rowBytes || bytes > PUBLICATION_LIMITS.totalBytes
      || at === null || observed === null || observed > at || at > BigInt(now.getTime()) * BigInt(1000)
      || !row.metadata || typeof row.metadata !== "object" || Array.isArray(row.metadata)
      || !(row.source_url === null || typeof row.source_url === "string")
      || !(row.source_revision_key === null || typeof row.source_revision_key === "string")
      || (row.entity_kind === "player" ? !row.entity_key.startsWith(`${plan.seasonId}:`) : row.entity_key !== String(plan.seasonId))) {
      throw new Error("Publication identity, hash, clock or byte bound mismatch.");
    }
    seen.add(row.id);
  }
  const db = memoryClient(plan.rows), proposedPins: Record<string, string> = {};
  const bundles = plan.rows.filter(row => row.dataset_key === "contribution-bundle-v1");
  if (bundles.length) {
    for (const row of bundles) {
      const payload = row.payload as any;
      await persistContributionBundle(db, { ...payload, dryRun: true, snapshotId: row.id });
      const expected = { ...row, source_url: null, source_revision_key: payload.manifest.checksum,
        observed_at: payload.manifest.inputCutoff, available_at: payload.manifest.issuedAt,
        metadata: { policyVersion: payload.manifest.policyVersion, released: payload.manifest.released } };
      if (!matchesPlannedObservation(row, expected)) throw new Error("Bundle envelope mismatch.");
    }
    proposedPins.PLAYER_FORECAST_BASELINE_RELEASE_IDS = bundles.map(row => row.id).sort().join(",");
    const admitted = await loadNativeContributionBundle(db, plan.seasonId, now, { environment: proposedPins });
    const expected = bundles.flatMap(row => (row.payload as any).sources.map((source: any) => source.sourceId)).sort();
    if (JSON.stringify(admitted.sources.map(source => source.sourceId).sort()) !== JSON.stringify(expected)
      || admitted.manifests.length !== bundles.length) throw new Error("Native publication admission failed.");
  }
  const needed = new Set(bundles.flatMap(row => { const p = row.payload as any; return [p.manifest.evaluationPolicyId, p.manifest.reviewId]; }));
  const watermarks = new Set(bundles.flatMap(row => (row.payload as any).sources.map((source: any) => source.sourceWatermark)));
  for (const row of plan.rows) {
    if (row.entity_kind === "player" && !watermarks.has(row.payload_hash)
      || ["baseline_evaluation_policy", "baseline_validation_review"].includes(row.entity_kind) && !needed.has(row.id)) throw new Error("Unreferenced publication input or approval.");
  }
  for (const [dataset, environmentKey, loader] of participationMethods) {
    const rows = plan.rows.filter(row => row.dataset_key === dataset);
    if (!rows.length) continue;
    proposedPins[environmentKey] = rows.map(row => `${row.id}:${row.payload_hash}`).sort().join(",");
    const admitted = await loader(db, plan.seasonId, now, { environment: proposedPins });
    const expected = rows.flatMap(row => (row.payload as any).entries.filter((entry: any) => entry.receipt.probability !== null)
      .map((entry: any) => `participation:${hash(entry.receipt)}`)).sort();
    if (!admitted.checksum || JSON.stringify(admitted.sources.map(source => source.revisionId).sort()) !== JSON.stringify(expected)) {
      throw new Error("Participation publication admission failed.");
    }
  }
  return { packageHash: hash(plan), proposedPins, rows: plan.rows.length, bytes };
}

/** No automatic activation or retries. Reconcile uncertain writes only by exact ID readback. */
export async function publishNativeBaselinePlan(plan: NativeBaselinePublicationPlan, options: {
  now: Date; dryRun?: boolean; approvedPackageHash?: string; db?: SupabaseClient<any>; monotonic?: () => number;
}) {
  const frozen = JSON.parse(JSON.stringify(plan)) as NativeBaselinePublicationPlan;
  const monotonic = options.monotonic ?? (() => performance.now()), start = monotonic();
  const validation = await validateNativeBaselinePublication(frozen, options.now);
  if (options.dryRun ?? true) return { ...validation, status: "dry_run" as const, attemptedWrites: 0, presentIds: [], missingIds: [], unknownIds: [] };
  if (options.approvedPackageHash !== validation.packageHash || !options.db) throw new Error("Exact publication package approval and client required.");
  const controller = new AbortController();
  let attemptedWrites = 0;
  const ids = frozen.rows.map(row => row.id);
  const expiries = frozen.rows.flatMap(row => {
    const payload = row.payload as any, value = payload?.manifest?.expiresAt ?? payload?.expiresAt;
    return typeof value === "string" ? [Date.parse(value)] : [];
  });
  const call = async <T>(operation: () => PromiseLike<T>): Promise<T> => {
    const remaining = Math.min(PUBLICATION_LIMITS.requestMs, PUBLICATION_LIMITS.totalMs - (monotonic() - start));
    if (remaining <= 0) throw new Error("Publication deadline exceeded.");
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      return await Promise.race([Promise.resolve().then(operation), new Promise<never>((_, reject) => {
        timer = setTimeout(() => { controller.abort(); reject(new Error("Publication request timed out.")); }, remaining);
      })]);
    } finally { if (timer) clearTimeout(timer); }
  };
  // Scope helper internals to this exact table and shared cancellation signal.
  const db = { from(table: string) {
    if (table !== "player_forecast_source_observations") throw new Error("Publication table scope denied.");
    const wrap = (query: any): any => new Proxy(query, { get(target, key) {
      if (key === "then") return target.abortSignal(controller.signal).then.bind(target);
      const value = Reflect.get(target, key);
      return typeof value === "function" ? (...args: any[]) => wrap(value.apply(target, args)) : value;
    } });
    return wrap(options.db!.from(table));
  } } as unknown as SupabaseClient<any>;
  const read = () => call(async () => {
    const result = await db.from("player_forecast_source_observations").select(SOURCE_OBSERVATION_COLUMNS).in("id", ids).limit(ids.length + 1);
    if (result.error || !Array.isArray(result.data) || result.data.length > ids.length
      || Buffer.byteLength(JSON.stringify(result.data)) > PUBLICATION_LIMITS.totalBytes
      || new Set(result.data.map((row: any) => row.id)).size !== result.data.length
      || result.data.some((row: any) => !ids.includes(row.id) || !matchesPlannedObservation(row, frozen.rows.find(expected => expected.id === row.id)!))) throw new Error("Publication readback mismatch.");
    return result.data as PlannedSourceObservation[];
  });
  let present: PlannedSourceObservation[] | undefined;
  let stage: "preflight" | "write" | "readback" | "replay" = "preflight";
  let pendingId: string | null = null;
  try {
    present = await read();
    await validateNativeBaselinePublication(frozen, new Date(options.now.getTime() + monotonic() - start));
    const existing = new Set(present.map(row => row.id));
    for (const row of frozen.rows.slice().sort((a, b) => priority(a) - priority(b) || a.id.localeCompare(b.id))) {
      if (existing.has(row.id)) continue;
      stage = "write"; pendingId = row.id;
      if (expiries.some(expiry => expiry <= options.now.getTime() + monotonic() - start)) throw new Error("Publication expired before write.");
      await call<unknown>(() => {
        attemptedWrites++;
        return row.dataset_key === "contribution-bundle-v1"
        ? persistContributionBundle(db, { ...(row.payload as any), dryRun: false, snapshotId: row.id })
        : capturePlayerForecastSourceObservation({ supabase: db, observationId: row.id, provider: row.provider,
          datasetKey: row.dataset_key, entityKind: row.entity_kind, entityKey: row.entity_key, sourceUrl: row.source_url,
          sourceRevisionKey: row.source_revision_key, observedAt: row.observed_at, availableAt: row.available_at,
          payload: row.payload, metadata: row.metadata });
      });
    }
    stage = "readback"; pendingId = null;
    present = await read();
    if (present.length !== ids.length) throw new Error("Publication readback incomplete.");
    stage = "replay";
    await validateNativeBaselinePublication({ ...frozen, rows: present }, new Date(options.now.getTime() + monotonic() - start));
    return { ...validation, status: "persisted_not_activated" as const, attemptedWrites, presentIds: ids, missingIds: [], unknownIds: [] };
  } catch {
    // No write is retried. An aborted/hung request leaves reconciliation unknown.
    try { present = controller.signal.aborted ? undefined : await read(); } catch { present = undefined; }
    const presentIds = present?.map(row => row.id) ?? [];
    return { ...validation, status: "stopped" as const, attemptedWrites, presentIds,
      missingIds: present ? ids.filter(id => !presentIds.includes(id)) : [], unknownIds: present ? [] : ids,
      stoppedAt: stage, pendingId };
  }
}
