// @vitest-environment node
import { advanceNativeCatalogHead, prepareNativeCatalogObservation, resolveNativeCatalogEnvironment, NATIVE_CATALOG_PIN_KEYS, type NativeCatalogHead } from "./nativeCatalogHead";
import { loadNativeContributionBundle } from "./nativeContributionAdmission";
import { describe, expect, it, vi } from "vitest";
import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { CadenceTransport, runNativeCadence, validateCadenceCommand } from "../../scripts/native-baseline-cadence";
import { materializeNativeInputs, prepareNativeInputMaterialization, verifyNativeMaterialization,
  type NativeMaterializationRequest } from "./nativeInputMaterialization";
import { assembleCurrentRosterNativeInputs } from "./currentRosterNativeInputs";
import { buildSkaterParticipationReceipt } from "./modeledSkaterParticipation";
import { buildRosterObservationSkaterParticipationReceipt } from "./modeledSkaterParticipation";
import { buildSkaterBaselineRates } from "./baselineRates";
import { baselineAppearanceFromBoxscore } from "./baselineSourceLineage";
import { buildBaselineContributionBundle, buildNativeSkaterBaselineSnapshot } from "./baselineGeneration";
import { prepareNativeCadenceOutputs, type NativeOutputPreparationCommand } from "./nativeCadenceOutputPreparation";
import { contributionBundleChecksum, contributionBundleCandidateInputHash } from "./contributionStore";
import { capturePlayerForecastSourceObservation, playerForecastSourcePayloadHash as hash, type PlannedSourceObservation } from "./sourceSnapshot";
import { publishNativeBaselinePlan, validateNativeBaselinePublication, type NativeBaselinePublicationPlan } from "./nativeBaselinePublication";
import { bindNativeCadenceMaterialization, nativeCadenceClosureScope, nativeCadenceInputManifest, publishNativeBaselineCadence, publishJournaledNativeBaselineCadence, publishObservedNativeBaselineCadence, observeClosedNativeCadenceSources } from "./nativeBaselineCadence";
const now = new Date("2026-10-15T12:00:00Z");
const ids = [1, 2].map(n => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`);
function materializationFixture(): NativeMaterializationRequest {
  const game = { id: 2026020001, seasonId: 20262027, date: "2026-10-01", type: 2 as const,
    startTime: "2026-10-01T23:00:00Z", homeTeamId: 1, awayTeamId: 2, endpoints: ["boxscore" as const] };
  const body = { id: game.id, season: game.seasonId, gameDate: game.date, gameType: 2, startTimeUTC: game.startTime,
    gameState: "FINAL", homeTeam: { id: 1 }, awayTeam: { id: 2 }, playerByGameStats: {
      homeTeam: { forwards: [{ playerId: 77, toi: "20:00", goals: 2, assists: 1, sog: 4, hits: 1, blockedShots: 1, pim: 0 }], defense: [], goalies: [{ playerId: 99 }] },
      awayTeam: { forwards: [{ playerId: 111 }], defense: [], goalies: [{ playerId: 100 }] } } };
  const rawBody = JSON.stringify(body);
  const request: NativeMaterializationRequest = { runId: ids[0], sourceKey: "native-inputs", date: "2026-10-15", closureScopeHash: "a".repeat(64), nativeSelection: [],
    acquisition: { seasonId: 20262027, cutoffAt: "2026-10-15T10:00:00Z", games: [game],
      roster: [{ playerId: 7, nhlPlayerId: 77, teamId: 1, rosterRevision: "roster", playerClass: "skater" },
        { playerId: 8, nhlPlayerId: 88, teamId: 1, rosterRevision: "roster", playerClass: "skater" }],
      receipts: [{ url: `https://api-web.nhle.com/v1/gamecenter/${game.id}/boxscore`, capturedAt: "2026-10-02T03:00:00Z",
        bodySha256: createHash("sha256").update(rawBody).digest("hex"), rawBody }] } };
  request.nativeSelection = assembleCurrentRosterNativeInputs(request.acquisition, now).skaters.map(row => ({
    playerId: row.payload.playerId, policyVersion: row.payload.policyVersion!, inputHash: row.payload_hash }));
  return request;
}
function nativeFixture(issuedAt = "2026-10-15T11:00:00Z"): NativeBaselinePublicationPlan {
  const cutoffAt = "2026-10-15T10:00:00Z", expiresAt = "2026-10-15T18:00:00Z";
  const game = { id: 2025020001, seasonId: 20252026, date: "2026-04-01", type: 2, startTime: "2026-04-01T01:00:00Z", homeTeamId: 1, awayTeamId: 2 };
  const rawRow = { id: 1, game_id: game.id, season_id: game.seasonId, payload_hash: "a".repeat(64), fetched_at: "2026-04-01T10:00:00Z",
    payload: { id: game.id, season: game.seasonId, gameDate: game.date, gameType: 2, gameState: "FINAL", homeTeam: { id: 1 }, awayTeam: { id: 2 },
      playerByGameStats: { homeTeam: { forwards: [{ playerId: 77, toi: "20:00", goals: 2, assists: 1, sog: 4 }], defense: [], goalies: [{ playerId: 88 }] },
        awayTeam: { forwards: [{ playerId: 99 }], defense: [], goalies: [{ playerId: 100 }] } } } };
  const appearances = [baselineAppearanceFromBoxscore({ rawRow, game, nhlPlayerId: 77, teamId: 1, cutoffAt, population: "skater" })!];
  const common = { playerId: 7, nhlPlayerId: 77, seasonId: 20262027, cutoffAt, sourceWatermark: "pending", projections: [], appearances };
  const payload = { basis: "captured_current", capturedAt: cutoffAt, playerId: 7, nhlPlayerId: 77, teamId: 1, rosterRevision: "roster",
    definitionHash: buildSkaterBaselineRates(common).definitionHash, projections: [], appearances };
  const snapshot = buildSkaterBaselineRates({ ...common, sourceWatermark: hash(payload) });
  const built = buildBaselineContributionBundle({ seasonId: 20262027, cutoffAt, issuedAt, expiresAt, scheduleRevision: "schedule",
    snapshots: [{ snapshot, teamId: 1, rosterRevision: "roster" }] });
  const planned = [3, 4, 5, 6].map(n => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`);
  const sources = built.sources.map(source => ({ ...source, released: true }));
  const unsigned = { ...built.manifest, evaluationPolicyId: planned[1], reviewId: planned[2], released: true };
  const { checksum: _old, ...withoutChecksum } = unsigned;
  const bundle = { manifest: { ...withoutChecksum, checksum: contributionBundleChecksum({ manifest: withoutChecksum, sources }) }, sources };
  const candidateInputHash = contributionBundleCandidateInputHash(bundle);
  const policy = { version: "baseline-evaluation-policy-v1", seasonId: 20262027, policyVersion: snapshot.policyVersion,
    candidateInputHash, status: "owner_approved", allowedPublicUses: ["totals"], prospectiveEvidenceRef: "synthetic-only", ownerApprovalRef: "synthetic-only", approvedAt: cutoffAt };
  const review = { version: "baseline-validation-review-v1", seasonId: 20262027, policyVersion: snapshot.policyVersion,
    candidateInputHash, policyHash: hash(policy), bundleChecksum: bundle.manifest.checksum, status: "owner_approved", eligible: true,
    prospectiveEvidenceRef: "synthetic-only", ownerApprovalRef: "synthetic-only", reviewedAt: issuedAt };
  const row = (id: string, dataset: string, kind: string, body: any, at: string, revision: string | null = null, metadata = {}) => ({ id,
    provider: "fhfh", dataset_key: dataset, entity_kind: kind, entity_key: kind === "player" ? "20262027:7" : "20262027", source_url: null,
    source_revision_key: revision, observed_at: at, available_at: at, payload_hash: hash(body), payload: body, metadata });
  return { version: "native-baseline-publication-plan-v1", seasonId: 20262027, rows: [
    row(planned[0], "baseline-inputs-v1", "player", payload, cutoffAt), row(planned[1], policy.version, "baseline_evaluation_policy", policy, cutoffAt),
    row(planned[2], review.version, "baseline_validation_review", review, issuedAt),
    { ...row(planned[3], "contribution-bundle-v1", "seasonal_rate_bundle", bundle, issuedAt, bundle.manifest.checksum,
      { policyVersion: snapshot.policyVersion, released: true }), observed_at: cutoffAt }] };
}
function fixture(issuedAt = "2026-10-15T11:00:00Z", expiresAt = "2026-10-15T18:00:00Z"): NativeBaselinePublicationPlan {
  const evidence = { id: "synthetic", hash: "a".repeat(64), availableAt: "2026-10-15T09:00:00Z", capturedAt: "2026-10-15T09:00:00Z" };
  const input = { version: "skater-participation-input-v1" as const, cutoffAt: "2026-10-15T10:00:00Z",
    scope: { playerId: 7, nhlPlayerId: 77, seasonId: 20262027, teamId: 1, gameId: 30, scheduledAt: "2026-10-15T23:00:00Z", scheduleRevision: "schedule", rosterRevision: "roster" },
    scheduleEvidence: evidence, rosterEvidence: evidence, history: { complete: true, windowStartAt: "2026-08-16T10:00:00Z", scheduleEvidence: evidence,
      games: [{ gameId: 10, teamId: 1, scheduledAt: "2026-10-14T00:00:00Z", occurred: true, eligible: true, positiveMinutes: true,
        resolution: "positive_toi" as const, eligibilityEvidence: evidence, outcomeEvidence: evidence }] } };
  const clocks = { issuedAt, expiresAt };
  const payload = { version: "skater-participation-bundle-v1", seasonId: 20262027, ...clocks, released: true,
    allowedUses: { assignment: true, totals: true, comparison: false, conditionalTieBreak: false }, ownerApprovalRef: "synthetic-only", reviewRef: "synthetic-only",
    entries: [{ input, receipt: buildSkaterParticipationReceipt(input, clocks) }] };
  return { version: "native-baseline-publication-plan-v1", seasonId: 20262027, rows: [{ id: ids[0], provider: "fhfh", dataset_key: payload.version,
    entity_kind: "participation_bundle", entity_key: "20262027", source_url: null, source_revision_key: null,
    observed_at: clocks.issuedAt, available_at: clocks.issuedAt, payload_hash: hash(payload), payload, metadata: {} }] };
}
function database(initial: PlannedSourceObservation[] = [], problem?: "commit_then_error" | "fail_second" | "unknown" | "duplicate" | "fail_publication" | "unknown_result" | "head_commit_then_error" | "head_unknown" | "fail_closure" | "unknown_closure" | "postgres_timestamps") {
  const stored = structuredClone(initial), writes: string[] = [], heads: NativeCatalogHead[] = [];
  let casCalls = 0;
  const from = vi.fn((table = "player_forecast_source_observations") => {
    let value: any, selection: any[] = table === "native_forecast_catalog_heads" ? heads.slice() : stored.slice(), single = false;
    const q: any = { select: () => q, abortSignal: () => q,
      in: (key: string, values: unknown[]) => { selection = selection.filter(r => values.includes((r as any)[key])); return q; },
      eq: (key: string, x: unknown) => { selection = selection.filter(r => (key === "payload->>runId" ? r.payload.runId : (r as any)[key]) === x); return q; },
      limit: (n: number) => { selection = selection.slice(0, n); return q; },
      insert: (row: any) => { value = row; return q; },
      single: () => { single = true; return q; },
      then: (ok: any, fail: any) => {
        if (value) {
          writes.push(value.id);
          if (stored.some(row => row.id === value.id)) return Promise.resolve({ error: { code: "23505" } }).then(ok, fail);
          if (stored.some(row => row.provider === value.provider && row.dataset_key === value.dataset_key
            && row.entity_key === value.entity_key && row.payload_hash === value.payload_hash)) return Promise.resolve({ error: { code: "23505" } }).then(ok, fail);
          if (problem === "fail_publication" && value.dataset_key !== "native-baseline-cadence-slot-v1") return Promise.resolve({ error: { code: "failure" } }).then(ok, fail);
          if (problem === "unknown_result" && value.dataset_key === "native-baseline-cadence-slot-v1" && value.payload.phase === "result") return Promise.reject(new Error("result acknowledgement unavailable")).then(ok, fail);
          if (problem === "unknown") return Promise.reject(new Error("unknown state")).then(ok, fail);
          if (problem === "fail_closure" && value.entity_kind === "producer_closure") return Promise.resolve({ error: { code: "failure" } }).then(ok, fail);
          if (problem === "fail_second" && writes.length === 2) return Promise.resolve({ error: { code: "failure" } }).then(ok, fail);
          if (problem === "duplicate") return Promise.resolve({ error: { code: "23505" } }).then(ok, fail);
          stored.push({ ...structuredClone(value), source_url: value.source_url ?? null });
          if (problem === "unknown_closure" && value.entity_kind === "producer_closure") return Promise.reject(new Error("closure acknowledgement unknown")).then(ok, fail);
          return Promise.resolve({ data: single ? { id: value.id } : null, error: problem === "commit_then_error" ? { code: "uncertain" } : null }).then(ok, fail);
        }
        if (problem === "unknown" && writes.length) return Promise.reject(new Error("readback unavailable")).then(ok, fail);
        if (problem === "unknown_closure" && stored.some(row => row.entity_kind === "producer_closure")) return Promise.reject(new Error("closure readback unavailable")).then(ok, fail);
        if (problem === "head_unknown" && table === "native_forecast_catalog_heads" && casCalls) return Promise.reject(new Error("head unavailable")).then(ok, fail);
        const data = problem === "postgres_timestamps" ? selection.map(row => ({ ...row,
          ...(typeof row.observed_at === "string" ? { observed_at: row.observed_at.replace(/Z$/, "+00:00") } : {}),
          ...(typeof row.available_at === "string" ? { available_at: row.available_at.replace(/Z$/, "+00:00") } : {}) })) : selection;
        return Promise.resolve({ data, error: null }).then(ok, fail);
      } };
    return q;
  });
  const rpc = vi.fn((_name: string, args: any) => {
    const q: any = { abortSignal: () => q, then: (ok: any, fail: any) => {
      casCalls++;
      if (problem === "head_unknown") return Promise.reject(new Error("unknown CAS")).then(ok, fail);
      const old = heads.find(row => row.id === args.p_head_id);
      if (old ? old.revision !== args.p_expected_revision || old.payload_hash !== args.p_expected_hash || old.season_id !== args.p_season_id : args.p_expected_revision !== 0) return Promise.resolve({ data: [], error: { code: "40001" } }).then(ok, fail);
      const next = { id: args.p_head_id, season_id: args.p_season_id, revision: args.p_expected_revision + 1,
        observation_id: args.p_observation_id, payload_hash: args.p_payload_hash, selected_at: now.toISOString() };
      if (old) Object.assign(old, next); else heads.push(next);
      return (problem === "head_commit_then_error" ? Promise.reject(new Error("lost CAS acknowledgement")) : Promise.resolve({ data: [next], error: null })).then(ok, fail);
    } }; return q;
  });
  return { db: { from, rpc } as any, stored, writes, from, heads, rpc, clearProblem: () => { problem = undefined; } };
}
describe("bounded publication coordinator (synthetic only)", () => {
  const cadenceRequest = (plan = fixture(now.toISOString())) => {
    const manifest = nativeCadenceInputManifest(plan);
    return { publicationPlan: plan, slotKey: "morning:2026-10-15", inputSourceKey: "native-inputs", cadence: {
      date: "2026-10-15", now, requiredSources: ["native-inputs"],
      sources: [{ key: "native-inputs", date: "2026-10-15", status: "complete" as "complete" | "partial" | "failed",
        revision: manifest.revision, completedAt: "2026-10-15T11:30:00Z", expectedItems: manifest.expectedItems, completedItems: manifest.expectedItems }],
      games: [{ gameId: 30, startsAt: "2026-10-15T23:00:00Z" }],
      previous: [] as Array<{ key: string; status: "pending" | "running" | "succeeded" | "failed" | "unknown"; attempts: number }>,
    } };
  };
  it("executes the native publication stage behind the due/completion gates without selecting or activating it", async () => {
    const native = nativeFixture(now.toISOString()); native.rows.push(...fixture(now.toISOString()).rows);
    const request = cadenceRequest(native), databaseState = database();
    const preview = await publishNativeBaselineCadence(request, { db: databaseState.db });
    expect(preview.status).toBe("dry_run"); expect(databaseState.from).not.toHaveBeenCalled();
    const result = await publishNativeBaselineCadence(request, { dryRun: false, db: databaseState.db, approvedPackageHash: hash(request.publicationPlan) });
    expect(result).toMatchObject({ status: "persisted_not_activated", attempt: 1,
      selectedCatalogUpdated: false, cadenceComplete: false, activationApproved: false });
    expect(databaseState.writes).toEqual(request.publicationPlan.rows.map(row => row.id));
    const repeated = await publishNativeBaselineCadence(request, { dryRun: false, db: databaseState.db, approvedPackageHash: hash(request.publicationPlan) });
    expect(repeated).toMatchObject({ publication: { attemptedWrites: 0 } });
    expect(databaseState.writes).toHaveLength(request.publicationPlan.rows.length);
  });
  it("atomically journals publication once and derives deduplication from stored rows rather than caller receipts", async () => {
    const request = cadenceRequest(), db = database(), options = { dryRun: false, db: db.db, approvedPackageHash: hash(request.publicationPlan), monotonic: () => 0 };
    const results = await Promise.all([publishJournaledNativeBaselineCadence(request, options), publishJournaledNativeBaselineCadence(request, options)]);
    expect(results.filter(result => result.status === "persisted_not_activated")).toHaveLength(1);
    expect(db.stored.filter(row => row.dataset_key === "native-baseline-cadence-slot-v1")).toHaveLength(2);
    expect(db.stored.filter(row => row.dataset_key !== "native-baseline-cadence-slot-v1")).toHaveLength(1);
    request.cadence.previous = [{ key: request.slotKey, status: "failed", attempts: 0 }];
    const writes = db.writes.length;
    expect(await publishJournaledNativeBaselineCadence(request, options)).toMatchObject({ status: "held", reasons: ["slot_succeeded"], cadenceComplete: false, selectedCatalogUpdated: false });
    expect(db.writes).toHaveLength(writes);
  });
  it("uses only durably failed attempts for recovery and stops after three", async () => {
    const request = cadenceRequest(), db = database([], "fail_publication"), options = { dryRun: false, db: db.db, approvedPackageHash: hash(request.publicationPlan), monotonic: () => 0 };
    for (const attempt of [1, 2, 3]) {
      expect(await publishJournaledNativeBaselineCadence(request, options)).toMatchObject({ status: "stopped", attempt, journalConfirmed: true, cadenceComplete: false });
    }
    expect(db.stored.filter(row => (row.payload as any).status === "failed")).toHaveLength(3);
    const writes = db.writes.length;
    expect(await publishJournaledNativeBaselineCadence(request, options)).toMatchObject({ status: "held", reasons: ["recovery_exhausted"] });
    expect(db.writes).toHaveLength(writes);
  });
  it("reconciles an unacknowledged terminal journal only from exact publication row readback without republishing", async () => {
    const request = cadenceRequest(), db = database([], "unknown_result"), options = { dryRun: false, db: db.db, approvedPackageHash: hash(request.publicationPlan), monotonic: () => 0 };
    expect(await publishJournaledNativeBaselineCadence(request, options)).toMatchObject({ status: "journal_unknown", journalConfirmed: false });
    const publicationWrites = db.writes.filter(id => id === request.publicationPlan.rows[0].id).length;
    db.clearProblem();
    expect(await publishJournaledNativeBaselineCadence(request, options)).toMatchObject({ status: "held", reasons: ["cadence_slot_persisted_reconciled"], cadenceComplete: false });
    expect(db.writes.filter(id => id === request.publicationPlan.rows[0].id)).toHaveLength(publicationWrites);
    expect(await publishJournaledNativeBaselineCadence(request, options)).toMatchObject({ status: "held", reasons: ["slot_succeeded"] });
  });
  it("does not recover an unknown slot when a planned publication row is absent or changed", async () => {
    const request = cadenceRequest(), db = database([], "unknown_result"), options = { dryRun: false, db: db.db, approvedPackageHash: hash(request.publicationPlan), monotonic: () => 0 };
    await publishJournaledNativeBaselineCadence(request, options); db.clearProblem();
    const row = db.stored.find(row => row.id === request.publicationPlan.rows[0].id)!; row.payload_hash = "f".repeat(64);
    const writes = db.writes.length;
    expect(await publishJournaledNativeBaselineCadence(request, options)).toMatchObject({ status: "held", reasons: ["cadence_slot_unknown"] });
    expect(db.writes).toHaveLength(writes);
  });
  it("materializes only declared acquired inputs, preserving source clocks and unsupported-player missingness", async () => {
    const request = materializationFixture(), db = database();
    const dry = await materializeNativeInputs(request, { now, db: db.db });
    expect(dry.status).toBe("dry_run"); expect(db.from).not.toHaveBeenCalled();
    expect(dry.manifest.expectedItems).toBe(1);
    expect((dry.report.payload as any).coverage[1]).toMatchObject({ playerId: 8, observationEmitted: false,
      seasonAppearanceAbsence: "unverified", historyStatus: "no_verified_appearances_in_selected_games" });
    expect(dry.rows.find(row => row.entity_kind === "player")?.available_at).toBe(request.acquisition.cutoffAt);
    vi.useFakeTimers(); vi.setSystemTime(now);
    try {
      const result = await materializeNativeInputs(request, { now, db: db.db, dryRun: false });
      expect(result.status).toBe("closed");
      expect(db.writes.at(-1)).toBe(result.closure.id);
      await expect(verifyNativeMaterialization(db.db, result.closure)).resolves.toBeUndefined();
      const plan = { version: "native-baseline-publication-plan-v1" as const, seasonId: 20262027,
        rows: result.rows.filter(row => row.entity_kind === "player") };
      expect(nativeCadenceInputManifest(plan)).toEqual(result.manifest);
      const original = db.stored.find(row => row.dataset_key === "native-original-http-v1")!;
      (original.payload as any).rawBody += " ";
      await expect(verifyNativeMaterialization(db.db, result.closure)).rejects.toThrow("changed");
    } finally { vi.useRealTimers(); }
  });
  it("never closes missing or failed required acquisitions, changed originals or uncertain parent writes", async () => {
    for (const kind of ["missing", "failed", "changed"] as const) {
      const request = materializationFixture(), db = database();
      if (kind === "missing") request.acquisition.receipts = [];
      if (kind === "failed") request.acquisition.failures = [{ url: request.acquisition.receipts[0].url, reason: "timeout" }];
      if (kind === "changed") request.acquisition.receipts[0].bodySha256 = "f".repeat(64);
      await expect(materializeNativeInputs(request, { now, db: db.db, dryRun: false })).rejects.toThrow();
      expect(db.writes).toEqual([]);
    }
    const db = database([], "unknown");
    expect(await materializeNativeInputs(materializationFixture(), { now, db: db.db, dryRun: false })).toMatchObject({ status: "unknown" });
    expect(db.writes).toHaveLength(1);
    expect(db.stored.some(row => row.entity_kind === "producer_closure")).toBe(false);
  });
  it("withholds closure for missing required parent originals and cyclic or mismatched lineage", () => {
    const request = materializationFixture(), parent = { id: "parent", hash: "a".repeat(64),
      availableAt: "2026-10-15T09:00:00Z", capturedAt: "2026-10-15T09:00:00Z", url: null };
    request.requiredParents = [parent];
    expect(() => prepareNativeInputMaterialization(request, now.toISOString())).toThrow("incomplete");
    const payload = { schedule: "synthetic" }, key = hash(payload);
    request.requiredParents = [{ ...parent, hash: key }];
    request.parents = [{ ...parent, hash: key, derived: { payload, parentHashes: [key] } }];
    expect(() => prepareNativeInputMaterialization(request, now.toISOString())).toThrow("cyclic");
  });
  it("preserves explicit source microseconds and only accepts the exact declared JavaScript millisecond projection", () => {
    const request = materializationFixture(), rawBody = '{"source":"synthetic"}', key = createHash("sha256").update(rawBody).digest("hex");
    const original = { id: "original", hash: key, availableAt: "2026-10-15T09:00:00.195262Z", capturedAt: "2026-10-15T09:00:00.195262Z" };
    const payload = { normalized: "synthetic" }, derived = { id: "derived", hash: hash(payload), availableAt: "2026-10-15T09:00:00.195Z", capturedAt: "2026-10-15T09:00:00.195Z" };
    request.requiredParents = [{ ...original, url: "https://api-web.nhle.com/v1/schedule/2026-10-01" }, { ...derived, url: null }];
    request.parents = [{ ...original, original: { url: request.requiredParents[0].url!, rawBody, bodySha256: key } },
      { ...derived, derived: { payload, parentHashes: [key] } }];
    expect(() => prepareNativeInputMaterialization(request, now.toISOString())).toThrow("precedes");
    request.parents[1].derived!.clockRepresentation = "javascript_millisecond_projection";
    const result = prepareNativeInputMaterialization(request, now.toISOString());
    expect((result.rows.find(row => row.entity_kind === "input_parent")!.payload as any).parents[0].capturedAt).toBe(original.capturedAt);
    request.parents[1].capturedAt = request.requiredParents[1].capturedAt = "2026-10-15T09:00:00.196Z";
    request.parents[1].availableAt = request.requiredParents[1].availableAt = "2026-10-15T09:00:00.196Z";
    expect(() => prepareNativeInputMaterialization(request, now.toISOString())).toThrow("projection");
  });
  it("requires exact selected native policy/hash and preserves additional observations' older original cutoff", () => {
    const request = materializationFixture();
    const old = structuredClone(assembleCurrentRosterNativeInputs(request.acquisition, now).skaters[0]);
    old.available_at = old.payload.capturedAt = "2026-10-15T09:00:00Z";
    for (const appearance of old.payload.appearances) appearance.availableAt = old.available_at;
    old.payload_hash = hash(old.payload);
    request.additionalNativeObservations = [old];
    request.nativeSelection = [{ playerId: 7, policyVersion: old.payload.policyVersion!, inputHash: old.payload_hash }];
    const raw = request.acquisition.receipts[0], payload = JSON.parse(raw.rawBody), canonical = hash(payload);
    request.requiredParents = [{ id: `http:${raw.bodySha256}`, hash: raw.bodySha256, availableAt: raw.capturedAt, capturedAt: raw.capturedAt, url: raw.url },
      { id: `canonical:${canonical}`, hash: canonical, availableAt: raw.capturedAt, capturedAt: raw.capturedAt, url: null }];
    request.parents = [{ ...request.requiredParents[0], original: { url: raw.url, rawBody: raw.rawBody, bodySha256: raw.bodySha256 } },
      { ...request.requiredParents[1], derived: { payload, parentHashes: [raw.bodySha256] } }];
    const prepared = prepareNativeInputMaterialization(request, now.toISOString());
    expect(prepared.rows.find(row => row.entity_kind === "player")).toMatchObject({ available_at: old.available_at, payload_hash: old.payload_hash });
    request.nativeSelection[0].inputHash = "f".repeat(64);
    expect(() => prepareNativeInputMaterialization(request, now.toISOString())).toThrow("identity/hash/original cutoff");
  });
  it("reuses byte-exact already-published input IDs and stable source rows across distinct runs under semantic uniqueness", async () => {
    const request = materializationFixture(), old = prepareNativeInputMaterialization(request, now.toISOString()).rows.find(row => row.entity_kind === "player")!;
    old.id = "00000000-0000-4000-8000-000000000099"; old.metadata = { actualPublishedInput: true }; old.source_revision_key = null;
    request.existingInputs = [old];
    const db = database([old]);
    vi.useFakeTimers(); vi.setSystemTime(now);
    try {
      const first = await materializeNativeInputs(request, { now, dryRun: false, db: db.db });
      expect(first.rows.find(row => row.entity_kind === "player")).toEqual(old);
      expect(db.writes).not.toContain(old.id);
      const count = db.writes.length, secondRequest = { ...request, runId: ids[1] };
      vi.setSystemTime(new Date(now.getTime() + 1000));
      const second = await materializeNativeInputs(secondRequest, { now, dryRun: false, db: db.db });
      expect(second.rows).toEqual(first.rows);
      expect(db.writes.length - count).toBe(2);
      await expect(verifyNativeMaterialization(db.db, second.closure)).resolves.toBeUndefined();
    } finally { vi.useRealTimers(); }
  });
  it.each(["fail_closure", "unknown_closure"] as const)("reconciles same-run %s without redating the immutable report or assuming closure", async mode => {
    const request = materializationFixture(), db = database([], mode);
    vi.useFakeTimers(); vi.setSystemTime(now);
    try {
      expect(await materializeNativeInputs(request, { now, dryRun: false, db: db.db })).toMatchObject({ status: "unknown" });
      const report = structuredClone(db.stored.find(row => row.entity_kind === "input_materialization")!);
      const count = db.writes.length; db.clearProblem(); vi.setSystemTime(new Date(now.getTime() + 60000));
      const resumed = await materializeNativeInputs(request, { now: new Date(), dryRun: false, db: db.db });
      expect(resumed.status).toBe("closed"); expect(resumed.report).toEqual(report);
      expect((resumed.closure.payload as any).closedAt).toBe((report.payload as any).closedAt);
      expect(db.writes.length - count).toBe(mode === "fail_closure" ? 1 : 0);
      const countAfter = db.writes.length; vi.setSystemTime(new Date(now.getTime() + 120000));
      expect(await materializeNativeInputs(request, { now: new Date(), dryRun: false, db: db.db })).toMatchObject({ status: "closed", writes: 0, reconciled: true });
      expect(db.writes).toHaveLength(countAfter);
    } finally { vi.useRealTimers(); }
  });
  it("reproduces additional native inputs after equivalent PostgREST outer timestamp formatting without changing original capture strings", async () => {
    const request = materializationFixture();
    request.additionalNativeObservations = [assembleCurrentRosterNativeInputs(request.acquisition, now).skaters[0]];
    const preview = prepareNativeInputMaterialization(request, now.toISOString());
    request.existingInputs = preview.rows.filter(row => row.entity_kind === "player");
    const db = database(request.existingInputs, "postgres_timestamps");
    vi.useFakeTimers(); vi.setSystemTime(now);
    try {
      const result = await materializeNativeInputs(request, { now, dryRun: false, db: db.db });
      expect(result.status).toBe("closed"); expect(result.manifest).toEqual(preview.manifest);
      const writes = db.writes.length;
      expect(await materializeNativeInputs(request, { now, dryRun: false, db: db.db })).toMatchObject({ status: "closed", writes: 0 });
      expect(db.writes).toHaveLength(writes);
      expect((result.rows.find(row => row.entity_kind === "player")!.payload as any).capturedAt).toBe(request.acquisition.cutoffAt);
    } finally { vi.useRealTimers(); }
  });
  it("uses original payload capture spelling consistently when a supplied typed envelope has an equivalent timestamp", async () => {
    const request = materializationFixture(), original = prepareNativeInputMaterialization(request, now.toISOString());
    const observation = assembleCurrentRosterNativeInputs(request.acquisition, now).skaters[0];
    observation.available_at = observation.available_at.replace(/Z$/, "+00:00");
    request.additionalNativeObservations = [observation];
    const prepared = prepareNativeInputMaterialization(request, now.toISOString());
    expect(prepared.manifest).toEqual(original.manifest);
    expect(prepared.rows.find(row => row.entity_kind === "player")?.available_at).toBe(observation.payload.capturedAt);
    const db = database(); vi.useFakeTimers(); vi.setSystemTime(now);
    try {
      const result = await materializeNativeInputs(request, { now, dryRun: false, db: db.db });
      expect(result.status).toBe("closed"); await expect(verifyNativeMaterialization(db.db, result.closure)).resolves.toBeUndefined();
    } finally { vi.useRealTimers(); }
  });
  it("runs the standalone materialize command dry by default with exact bounded files and private receipts", async () => {
    const directory = mkdtempSync(join(tmpdir(), "native-cadence-cli-")), request = materializationFixture(), path = join(directory, "input.json");
    const bytes = JSON.stringify(request); writeFileSync(path, bytes);
    const network = vi.spyOn(globalThis, "fetch").mockImplementation(() => { throw new Error("No network"); });
    vi.useFakeTimers(); vi.setSystemTime(now);
    try {
      const result = await runNativeCadence(["materialize", "--input", path, "--input-sha256", createHash("sha256").update(bytes).digest("hex"), "--out", join(directory, "result")]);
      expect(result).toMatchObject({ status: "dry_run", networkRequests: 0, insertAttempts: 0 }); expect(network).not.toHaveBeenCalled();
      expect(JSON.parse(readFileSync(join(directory, "result/intent.json"), "utf8"))).toMatchObject({ execute: false, target: null });
      await expect(runNativeCadence(["materialize", "--input", path, "--input-sha256", "f".repeat(64), "--out", join(directory, "bad")])).rejects.toThrow("hash_mismatch");
      await expect(runNativeCadence(["materialize", "--input", path, "--input-sha256", createHash("sha256").update(bytes).digest("hex"), "--out", join(directory, "bad-target"), "--execute-target", "https://other.invalid", "--execute-intent", "synthetic"])).rejects.toThrow("target");
    } finally { network.mockRestore(); vi.useRealTimers(); rmSync(directory, { recursive: true, force: true }); }
  });
  it("allows the measured standalone publication class above32MiB but rejects the48MiB total ceiling", async () => {
    const plan = fixture(now.toISOString());
    const row = plan.rows[0]; plan.rows = [];
    for (let index = 0; index < 8; index++) {
      const copy = structuredClone(row), payload = copy.payload as any;
      copy.id = `00000000-0000-4000-8000-${String(700 + index).padStart(12, "0")}`;
      payload.entries[0].input.scope.playerId += index; payload.entries[0].input.scope.nhlPlayerId += index;
      payload.entries[0].receipt = buildSkaterParticipationReceipt(payload.entries[0].input, { issuedAt: payload.issuedAt, expiresAt: payload.expiresAt });
      copy.payload_hash = hash(payload); copy.metadata = { capacityFixture: "x".repeat(6 * 1024 * 1024) };
      plan.rows.push(copy);
    }
    const fits = { ...plan, rows: plan.rows.slice(0, 6) };
    expect(Buffer.byteLength(JSON.stringify(fits))).toBeGreaterThan(32 * 1024 * 1024);
    expect((await validateNativeBaselinePublication(fits, now)).rows).toBe(6);
    await expect(validateNativeBaselinePublication(plan, now)).rejects.toThrow("byte bound");
  });
  describe("offline later-issuance preparation", () => {
    const closedAt = "2026-10-15T11:30:00.000Z", dueAt = "2026-10-15T12:00:00.000Z", expiresAt = "2026-10-15T18:00:00.000Z";
    const reviewedAt = "2026-10-15T11:00:00.000Z";
    const setup = () => {
      const request = materializationFixture(), first = prepareNativeInputMaterialization(request, closedAt);
      const requiredAcquisitionScopes = { "native-inputs": { scopeHash: (first.report.payload as any).acquisitionScopeHash, cutoffAt: request.acquisition.cutoffAt } };
      const games = [{ gameId: 30, startsAt: "2026-10-15T23:00:00Z" }];
      request.closureScopeHash = nativeCadenceClosureScope({ publicationPlan: { seasonId: 20262027 }, requiredAcquisitionScopes,
        cadence: { date: request.date, requiredSources: [request.sourceKey], games } } as any);
      const proof = { status: "closed", ...prepareNativeInputMaterialization(request, closedAt) };
      const input = proof.rows.find(row => row.entity_kind === "player")!, payload = input.payload as any;
      const snapshot = buildNativeSkaterBaselineSnapshot({ ...payload, seasonId: 20262027, cutoffAt: payload.capturedAt, sourceWatermark: input.payload_hash });
      const built = buildBaselineContributionBundle({ seasonId: 20262027, cutoffAt: payload.capturedAt, issuedAt: reviewedAt, expiresAt,
        scheduleRevision: "schedule", snapshots: [{ snapshot, teamId: payload.teamId, rosterRevision: payload.rosterRevision }] });
      const planned = [10, 11, 12].map(n => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`);
      const sources = built.sources.map(source => ({ ...source, released: true }));
      const { checksum: _old, ...unsigned } = { ...built.manifest, evaluationPolicyId: planned[0], reviewId: planned[1], released: true };
      const bundle = { manifest: { ...unsigned, checksum: contributionBundleChecksum({ manifest: unsigned, sources }) }, sources };
      const candidateInputHash = contributionBundleCandidateInputHash(bundle);
      const policy = { version: "baseline-evaluation-policy-v1", seasonId: 20262027, policyVersion: snapshot.policyVersion, candidateInputHash,
        status: "owner_approved", allowedPublicUses: ["totals"], prospectiveEvidenceRef: "synthetic-only", ownerApprovalRef: "synthetic-only", approvedAt: payload.capturedAt };
      const review = { version: "baseline-validation-review-v1", seasonId: 20262027, policyVersion: snapshot.policyVersion, candidateInputHash,
        policyHash: hash(policy), bundleChecksum: bundle.manifest.checksum, status: "owner_approved", eligible: true,
        prospectiveEvidenceRef: "synthetic-only", ownerApprovalRef: "synthetic-only", reviewedAt };
      const row = (id: string, dataset: string, kind: string, body: any, at: string, revision: string | null = null, metadata = {}) => ({ id, provider: "fhfh",
        dataset_key: dataset, entity_kind: kind, entity_key: "20262027", source_url: null, source_revision_key: revision, observed_at: at, available_at: at,
        payload_hash: hash(body), payload: body, metadata });
      const reviewedPlan: NativeBaselinePublicationPlan = { version: "native-baseline-publication-plan-v1", seasonId: 20262027, rows: [input,
        row(planned[0], policy.version, "baseline_evaluation_policy", policy, payload.capturedAt), row(planned[1], review.version, "baseline_validation_review", review, reviewedAt),
        row(planned[2], "contribution-bundle-v1", "seasonal_rate_bundle", bundle, reviewedAt, bundle.manifest.checksum, { policyVersion: snapshot.policyVersion, released: true })] };
      const command: NativeOutputPreparationCommand = { version: "native-output-preparation-v1", slotKey: "morning:2026-10-15", dueAt,
        materialization: { runId: request.runId, sourceKey: request.sourceKey, date: request.date, closureScopeHash: request.closureScopeHash },
        games, requiredAcquisitionScopes, reviewedPlan };
      return { command, proof, bundle };
    };
    it("binds an acquired request so its closure matches the cadence scopes prepare and publish require", () => {
      const original = materializationFixture(), before = hash(original);
      const games = [{ gameId: 30, startsAt: "2026-10-15T23:00:00Z" }];
      const bound = bindNativeCadenceMaterialization(original, { runId: ids[1], sourceKey: "native-daily", date: "2026-10-15", seasonId: 20262027, games });
      expect(hash(original)).toBe(before);
      const closure = prepareNativeInputMaterialization(bound.request, closedAt).closure.payload as any;
      expect(closure).toMatchObject({ runId: ids[1], scopeHash: bound.closureScopeHash,
        acquisitionScopeHash: bound.requiredAcquisitionScopes["native-daily"].scopeHash, inputCutoffAt: bound.requiredAcquisitionScopes["native-daily"].cutoffAt });
      expect(bound.closureScopeHash).toBe(nativeCadenceClosureScope({ publicationPlan: { seasonId: 20262027 }, requiredAcquisitionScopes: bound.requiredAcquisitionScopes,
        cadence: { date: "2026-10-15", requiredSources: ["native-daily"], games } } as any));
      const otherGames = bindNativeCadenceMaterialization(original, { runId: ids[1], sourceKey: "native-daily", date: "2026-10-15", seasonId: 20262027, games: [] });
      expect(otherGames.closureScopeHash).not.toBe(bound.closureScopeHash);
    });
    let counter = 100;
    const nextId = () => `00000000-0000-4000-8000-${String(counter++).padStart(12, "0")}`;
    it("reissues identical means after closure with pending reviews, then validates only once reviewed", async () => {
      const { command, proof, bundle } = setup(), before = hash(command.reviewedPlan);
      const result = await prepareNativeCadenceOutputs(command, proof, now, nextId);
      expect(hash(command.reviewedPlan)).toBe(before);
      expect(result.receipt).toMatchObject({ issuedAt: now.toISOString(), nativeInputs: 1, nativeSources: bundle.sources.length, networkRequests: 0, databaseWrites: 0, headSelection: false });
      const reissued = result.plan.rows.find(row => row.entity_kind === "seasonal_rate_bundle")!.payload as any;
      expect(reissued.manifest.issuedAt).toBe(now.toISOString());
      expect(reissued.sources.map(({ issuedAt: _i, ...rest }: any) => rest)).toEqual(bundle.sources.map(({ issuedAt: _i, ...rest }: any) => rest));
      const pending = result.plan.rows.find(row => row.entity_kind === "baseline_validation_review")!;
      expect(pending.payload).toMatchObject({ status: "pending_independent_review", eligible: false });
      expect(result.cadenceCommand.catalogHead).toBeNull();
      const catalogHead = { headId: ids[0], observationId: ids[1], expectedRevision: 0, expectedHash: null };
      await expect(validateCadenceCommand({ ...result.cadenceCommand, catalogHead } as any, proof, now)).rejects.toThrow("admission failed");
      const approved = { ...(pending.payload as any), status: "owner_approved", eligible: true, ownerApprovalRef: "synthetic-only", reviewedAt: now.toISOString() };
      Object.assign(pending, { payload: approved, payload_hash: hash(approved) });
      await expect(validateCadenceCommand({ ...result.cadenceCommand, catalogHead } as any, proof, now)).resolves.toMatchObject({ validation: { rows: result.plan.rows.length } });
    });
    it("refuses early, expired, tampered and mismatched-scope preparation", async () => {
      const early = setup();
      await expect(prepareNativeCadenceOutputs(early.command, early.proof, new Date("2026-10-15T11:59:59.999Z"))).rejects.toThrow("slot_not_due");
      const expired = setup();
      await expect(prepareNativeCadenceOutputs(expired.command, expired.proof, new Date(expiresAt))).rejects.toThrow("original_source_expired");
      const tampered = setup(), bundleRow = tampered.command.reviewedPlan.rows.find(row => row.entity_kind === "seasonal_rate_bundle")!;
      const changed = structuredClone(bundleRow.payload as any); changed.sources[0].sourceVersion = "altered";
      Object.assign(bundleRow, { payload: changed, payload_hash: hash(changed) });
      await expect(prepareNativeCadenceOutputs(tampered.command, tampered.proof, now)).rejects.toThrow("reproduced_source_changed");
      const scope = setup(); scope.command.games = [];
      await expect(prepareNativeCadenceOutputs(scope.command, scope.proof, now)).rejects.toThrow("cadence_closure_scope_mismatch");
      const open = setup();
      await expect(prepareNativeCadenceOutputs(open.command, { ...open.proof, status: "unknown" }, now)).rejects.toThrow("closed_materialization_proof_required");
      const forged = setup();
      await expect(prepareNativeCadenceOutputs(forged.command, { ...forged.proof, manifest: { ...forged.proof.manifest, expectedItems: 99 } }, now))
        .rejects.toThrow("materialization_manifest_unbound");
      const acquisition = setup(); acquisition.command.requiredAcquisitionScopes["native-inputs"].cutoffAt = "2026-10-15T09:59:59Z";
      await expect(prepareNativeCadenceOutputs(acquisition.command, acquisition.proof, now)).rejects.toThrow("acquisition_scope_mismatch");
    });
    it("runs the prepare CLI offline with exact files and refuses an execution target", async () => {
      const { command, proof } = setup(), directory = mkdtempSync(join(tmpdir(), "native-cadence-prepare-"));
      const write = (name: string, value: unknown) => { const bytes = JSON.stringify(value), path = join(directory, name); writeFileSync(path, bytes);
        return [path, createHash("sha256").update(bytes).digest("hex")]; };
      const [input, inputHash] = write("command.json", command), [proofPath, proofHash] = write("proof.json", proof);
      const network = vi.spyOn(globalThis, "fetch").mockImplementation(() => { throw new Error("No network"); });
      vi.useFakeTimers(); vi.setSystemTime(now);
      try {
        const args = ["--input", input, "--input-sha256", inputHash, "--proof", proofPath, "--proof-sha256", proofHash];
        const result = await runNativeCadence(["prepare", ...args, "--out", join(directory, "out")]);
        expect(result).toMatchObject({ stage: "prepare", status: "outputs_built_pending_independent_review_and_catalog_head", execute: false, networkRequests: 0 });
        expect(network).not.toHaveBeenCalled();
        expect(JSON.parse(readFileSync(join(directory, "out/cadence-command.json"), "utf8")).catalogHead).toBeNull();
        await expect(runNativeCadence(["prepare", ...args, "--out", join(directory, "out")])).rejects.toThrow();
        await expect(runNativeCadence(["prepare", ...args, "--out", join(directory, "exec"), "--execute-target", "https://fyhftlxokyjtpndbkfse.supabase.co",
          "--execute-intent", "synthetic"])).rejects.toThrow("offline_prepare");
      } finally { network.mockRestore(); vi.useRealTimers(); rmSync(directory, { recursive: true, force: true }); }
    });
  });
  it("refuses an earlier published output plan as post-closure production without modifying its issuance", async () => {
    const materialization = materializationFixture(), prepared = prepareNativeInputMaterialization(materialization, now.toISOString());
    const plan = nativeFixture(); plan.rows[0] = prepared.rows.find(row => row.entity_kind === "player")!;
    const input = { ...cadenceRequest(plan), requiredAcquisitionScopes: { "native-inputs": {
      scopeHash: (prepared.report.payload as any).acquisitionScopeHash, cutoffAt: materialization.acquisition.cutoffAt } } };
    materialization.closureScopeHash = nativeCadenceClosureScope(input);
    const proof = { status: "closed", ...prepareNativeInputMaterialization(materialization, now.toISOString()) };
    const before = hash(plan);
    await expect(validateCadenceCommand({ version: "native-cadence-command-v1", cadenceInput: input,
      producerReceiptIds: { "native-inputs": proof.closure.id }, catalogHead: { headId: ids[0], observationId: ids[1], expectedRevision: 0, expectedHash: null } }, proof, now))
      .rejects.toThrow("outputs_must_be_issued_after_closed_inputs");
    expect(hash(plan)).toBe(before);
  });
  it("guards SDK requests by exact host/table/row and recomputes deadline after durable intent", async () => {
    const request = materializationFixture(), prepared = prepareNativeInputMaterialization(request, now.toISOString()), row = prepared.rows[0];
    const response = (value: unknown) => new Response(new ReadableStream({ type: "bytes", start(controller) {
      controller.enqueue(new TextEncoder().encode(JSON.stringify(value))); controller.close();
    } }));
    const network = vi.fn(async (_input: any, init?: RequestInit) => init?.method === "POST" ? new Response(null, { status: 204 }) : response([row]));
    const events: unknown[] = [], transport = new CadenceTransport({ materialization: request, prepared }, network,
      (action, fields) => events.push({ action, ...fields }));
    const origin = "https://fyhftlxokyjtpndbkfse.supabase.co/rest/v1/player_forecast_source_observations";
    const query = new URLSearchParams({ select: "id,provider,dataset_key,entity_kind,entity_key,source_url,source_revision_key,observed_at,available_at,payload_hash,payload,metadata", id: `eq.${row.id}`, limit: "2" });
    await transport.fetch(`${origin}?${query}`, { headers: { authorization: "Bearer synthetic-secret" } });
    await transport.fetch(origin, { method: "POST", body: JSON.stringify(row) });
    expect(network).toHaveBeenCalledTimes(2); expect(JSON.stringify(events)).not.toContain("synthetic-secret");
    await expect(transport.fetch(origin, { method: "POST", body: JSON.stringify(row) })).rejects.toThrow("write_scope");
    await expect(transport.fetch(`${origin}?${query}&limit=2`)).rejects.toThrow("duplicate_query");
    await expect(transport.fetch("https://other.invalid/rest/v1/player_forecast_source_observations")).rejects.toThrow("scope");
    await expect(transport.fetch(origin.replace("player_forecast_source_observations", "users"))).rejects.toThrow("path");
    let elapsed = 0;
    const expired = new CadenceTransport({ materialization: request, prepared }, network, () => { elapsed = 180001; }, () => elapsed);
    await expect(expired.fetch(`${origin}?${query}`)).rejects.toThrow("deadline_before_request");
    expect(expired.requests).toBe(0); expect(network).toHaveBeenCalledTimes(2);
  });
  it("uses the actual SDK through the standalone guard to close inputs without any external transport", async () => {
    const request = materializationFixture(), stored = new Map<string, any>();
    const reply = (value: unknown) => new Response(new ReadableStream({ type: "bytes", start(controller) {
      controller.enqueue(new TextEncoder().encode(JSON.stringify(value))); controller.close();
    } }));
    vi.useFakeTimers(); vi.setSystemTime(now);
    try {
      const network = vi.fn(async (value: any, init?: RequestInit) => {
        if (init?.method === "POST") { const row = JSON.parse(String(init.body)); stored.set(row.id, row); return new Response(null, { status: 204 }); }
        const query = new URL(String(value)).searchParams;
        const rows = [...stored.values()].filter(row => [...query].every(([key, filter]) => ["select", "limit"].includes(key)
          || filter === `eq.${key === "payload->>runId" ? row.payload.runId : row[key]}`));
        return reply(rows);
      });
      const transport = new CadenceTransport({ materialization: request, prepared: prepareNativeInputMaterialization(request, now.toISOString()) }, network, () => {});
      const db = createClient("https://fyhftlxokyjtpndbkfse.supabase.co", "synthetic-no-authority", {
        auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }, global: { fetch: transport.fetch } });
      const result = await materializeNativeInputs(request, { now, dryRun: false, db });
      expect(result.status).toBe("closed"); expect(stored.has(result.closure.id)).toBe(true);
      expect(transport.inserts).toBe(result.rows.length + 2); expect(network).toHaveBeenCalledTimes(transport.requests);
    } finally { vi.useRealTimers(); }
  });
  it.each(["output", "cas"] as const)("does not reserve or send %s writes when durable intent crosses original expiry", async kind => {
    vi.useFakeTimers(); vi.setSystemTime(now);
    try {
      const expiresAt = new Date(now.getTime() + 1000).toISOString(), plan = fixture(now.toISOString(), expiresAt);
      const command = { version: "native-cadence-command-v1" as const, cadenceInput: cadenceRequest(plan), producerReceiptIds: {},
        catalogHead: { headId: ids[0], observationId: ids[1], expectedRevision: 0, expectedHash: null } };
      const selection = { ...plan.rows[0], id: ids[1], payload: { expiresAt }, payload_hash: hash({ expiresAt }) };
      const network = vi.fn(async () => new Response(null, { status: 204 }));
      const transport = new CadenceTransport({ command, selection }, network, () => vi.setSystemTime(new Date(now.getTime() + 2000)), () => 0);
      const url = "https://fyhftlxokyjtpndbkfse.supabase.co/rest/v1/";
      const body = kind === "output" ? plan.rows[0] : { p_head_id: ids[0], p_season_id: plan.seasonId, p_expected_revision: 0,
        p_expected_hash: null, p_observation_id: selection.id, p_payload_hash: selection.payload_hash };
      await expect(transport.fetch(url + (kind === "output" ? "player_forecast_source_observations" : "rpc/cas_native_forecast_catalog_head"),
        { method: "POST", body: JSON.stringify(body) })).rejects.toThrow("expired_write_before_request");
      expect(transport.requests).toBe(0); expect(transport.inserts).toBe(0); expect(transport.uploaded).toBe(0); expect(network).not.toHaveBeenCalled();
    } finally { vi.useRealTimers(); }
  });
  it("observes exact durable acquired scope but never treats an older development scope as a requested overnight scope", async () => {
    const materialization = materializationFixture();
    const preview = prepareNativeInputMaterialization(materialization, now.toISOString());
    const plan = { version: "native-baseline-publication-plan-v1" as const, seasonId: 20262027,
      rows: preview.rows.filter(row => row.entity_kind === "player") };
    const request = { ...cadenceRequest(plan), requiredAcquisitionScopes: { "native-inputs": {
      scopeHash: (preview.report.payload as any).acquisitionScopeHash, cutoffAt: materialization.acquisition.cutoffAt } } };
    materialization.closureScopeHash = nativeCadenceClosureScope(request);
    vi.useFakeTimers(); vi.setSystemTime(now);
    try {
      const db = database(), result = await materializeNativeInputs(materialization, { now, dryRun: false, db: db.db });
      const ids = { "native-inputs": result.closure.id };
      expect(await observeClosedNativeCadenceSources(request, db.db, ids)).toMatchObject({ complete: true });
      request.requiredAcquisitionScopes["native-inputs"].cutoffAt = "2026-10-15T11:59:00Z";
      expect(await observeClosedNativeCadenceSources(request, db.db, ids)).toMatchObject({ complete: false,
        reason: "producer_closed_receipt_invalid:native-inputs" });
      request.requiredAcquisitionScopes["native-inputs"].cutoffAt = materialization.acquisition.cutoffAt;
      request.requiredAcquisitionScopes["native-inputs"].scopeHash = "f".repeat(64);
      expect(await observeClosedNativeCadenceSources(request, db.db, ids)).toMatchObject({ complete: false });
    } finally { vi.useRealTimers(); }
  });
  it("persists participation inputs with acquired original/derived parents while preserving an unsupported model output", async () => {
    const request = materializationFixture();
    const rawBody = JSON.stringify({ gameWeek: [] }), bodySha256 = createHash("sha256").update(rawBody).digest("hex");
    const original = { id: `http:${bodySha256}`, hash: bodySha256, availableAt: "2026-10-15T09:00:00Z", capturedAt: "2026-10-15T09:00:00Z" };
    const payload = { sourceHashes: [bodySha256], declaredFrame: "synthetic_incomplete" }, evidence = { ...original, id: "frame", hash: hash(payload) };
    request.requiredParents = [{ ...original, url: "https://api-web.nhle.com/v1/schedule/2026-10-01" }, { ...evidence, url: null }];
    request.parents = [{ ...original, original: { url: request.requiredParents[0].url!, rawBody, bodySha256 } },
      { ...evidence, derived: { payload, parentHashes: [bodySha256] } }];
    const common = { cutoffAt: request.acquisition.cutoffAt, scope: { playerId: 7, nhlPlayerId: 77, teamId: 1,
      seasonId: 20262027, gameId: 30, scheduledAt: "2026-10-15T23:00:00Z", scheduleRevision: "schedule", rosterRevision: "roster" },
      scheduleEvidence: evidence, rosterEvidence: evidence, targetRosterObservation: null,
      history: { complete: false, windowStartAt: "2026-09-29T04:00:00Z", windowEndAt: "2026-10-13T04:00:00Z", scheduleEvidence: evidence, games: [] } };
    const input = { ...common, version: "skater-roster-observation-participation-input-v1" as const, playerClass: "skater" as const };
    request.acquisition.roster[1].playerClass = "goalie";
    const goalie = { ...common, playerClass: "goalie" as const, scope: { ...common.scope, playerId: 8, nhlPlayerId: 88 } };
    request.participationInputs = [input, { ...goalie, version: "goalie-roster-observation-participation-input-v1" },
      { ...goalie, version: "goalie-roster-observation-start-input-v1" }];
    expect(buildRosterObservationSkaterParticipationReceipt(input, { issuedAt: now.toISOString(), expiresAt: "2026-10-15T18:00:00Z" }).probability).toBeNull();
    vi.useFakeTimers(); vi.setSystemTime(now);
    try {
      const db = database(), result = await materializeNativeInputs(request, { now, dryRun: false, db: db.db });
      expect(result.status).toBe("closed"); expect(result.manifest.expectedItems).toBe(4);
      await expect(verifyNativeMaterialization(db.db, result.closure)).resolves.toBeUndefined();
      const standalone = result.rows.find(row => row.entity_kind === "participation_input")!;
      expect((standalone.payload as any).inputs).toEqual([input]);
      const laterPlan = { version: "native-baseline-publication-plan-v1" as const, seasonId: 20262027,
        rows: [...result.rows.filter(row => row.entity_kind === "player"), ...result.rows.filter(row => row.entity_kind === "participation_input")
          .map(row => ({ ...row, dataset_key: (row.payload as any).dataset, entity_kind: "participation_bundle",
            payload: { entries: (row.payload as any).inputs.map((input: any) => ({ input })) } }))] };
      expect(nativeCadenceInputManifest(laterPlan)).toEqual(result.manifest);
      const changed = structuredClone(request); changed.parents = changed.parents!.slice(1); changed.requiredParents = changed.requiredParents!.slice(1);
      expect(() => prepareNativeInputMaterialization(changed, now.toISOString())).toThrow("missing");
    } finally { vi.useRealTimers(); }
  });
  it("holds caller-complete inputs without an actual durable closed producer receipt", async () => {
    const request = cadenceRequest(), db = database();
    expect(await observeClosedNativeCadenceSources(request, db.db)).toMatchObject({ complete: false, reason: "producer_closed_receipt_missing:native-inputs" });
    expect(await publishObservedNativeBaselineCadence(request, { db: db.db, dryRun: false, approvedPackageHash: hash(request.publicationPlan) }))
      .toMatchObject({ status: "held", cadenceComplete: false });
    expect(db.writes).toEqual([]);
  });
  it("atomically selects all four exact pinsets and resolves them once without weakening native admission", async () => {
    const plan = nativeFixture(now.toISOString()), validation = await validateNativeBaselinePublication(plan, now), db = database(plan.rows);
    const observation = prepareNativeCatalogObservation({ plan, pins: validation.proposedPins, observationId: ids[1], issuedAt: now.toISOString() });
    const selection = await advanceNativeCatalogHead({ db: db.db, headId: ids[0], expectedRevision: 0, expectedHash: null, observation, now, dryRun: false });
    expect(selection).toMatchObject({ status: "selected", selectedCatalogUpdated: true });
    const resolved = await resolveNativeCatalogEnvironment(db.db, plan.seasonId, now, { PLAYER_FORECAST_NATIVE_CATALOG_HEAD_ID: ids[0], PLAYER_FORECAST_ROSTER_OBSERVATION_GOALIE_START_RELEASES: "stale" });
    expect(resolved.selection?.revision).toBe(1); expect(resolved.environment.PLAYER_FORECAST_ROSTER_OBSERVATION_GOALIE_START_RELEASES).toBe("");
    expect((await loadNativeContributionBundle(db.db, plan.seasonId, now, { environment: resolved.environment })).sources.length).toBeGreaterThan(0);
    const stale = await advanceNativeCatalogHead({ db: db.db, headId: ids[0], expectedRevision: 0, expectedHash: null, observation: { ...observation, id: "00000000-0000-4000-8000-000000000009" }, now, dryRun: false });
    // Same immutable semantic tuple under a fresh UUID is rejected before CAS, so selection stays unacknowledged.
    expect(stale).toMatchObject({ status: "unknown", selectedCatalogUpdated: false }); expect(db.heads[0].revision).toBe(1);
  });
  it("admits a selected catalog strictly before its expiry and fails closed exactly at and after it", async () => {
    const plan = nativeFixture(now.toISOString()), validation = await validateNativeBaselinePublication(plan, now), db = database(plan.rows);
    const observation = prepareNativeCatalogObservation({ plan, pins: validation.proposedPins, observationId: ids[1], issuedAt: now.toISOString() });
    await advanceNativeCatalogHead({ db: db.db, headId: ids[0], expectedRevision: 0, expectedHash: null, observation, now, dryRun: false });
    const expiresAt = Date.parse((observation.payload as any).expiresAt), environment = { PLAYER_FORECAST_NATIVE_CATALOG_HEAD_ID: ids[0] };
    const at = async (ms: number) => resolveNativeCatalogEnvironment(db.db, plan.seasonId, new Date(ms), environment);
    expect((await at(expiresAt - 1)).selection?.revision).toBe(1);
    for (const ms of [expiresAt, expiresAt + 1]) {
      const resolved = await at(ms);
      expect(resolved.selection).toBeNull(); expect(resolved.limitation).toBeTruthy();
      for (const key of NATIVE_CATALOG_PIN_KEYS) expect(resolved.environment[key]).toBe("");
    }
    // A clock before issuance never admits a future-issued selection.
    expect((await at(now.getTime() - 1)).selection).toBeNull();
  });
  it.each(["hash", "season", "missing"])("fails closed for an invalid enabled %s head rather than using stale environment pins", async kind => {
    const plan = nativeFixture(now.toISOString()), validation = await validateNativeBaselinePublication(plan, now), db = database(plan.rows);
    const observation = prepareNativeCatalogObservation({ plan, pins: validation.proposedPins, observationId: ids[1], issuedAt: now.toISOString() });
    await advanceNativeCatalogHead({ db: db.db, headId: ids[0], expectedRevision: 0, expectedHash: null, observation, now, dryRun: false });
    if (kind === "hash") db.heads[0].payload_hash = "f".repeat(64);
    if (kind === "missing") db.heads.splice(0);
    const resolved = await resolveNativeCatalogEnvironment(db.db, kind === "season" ? 20252026 : plan.seasonId, now,
      { PLAYER_FORECAST_NATIVE_CATALOG_HEAD_ID: ids[0], PLAYER_FORECAST_BASELINE_RELEASE_IDS: plan.rows[3].id });
    expect(resolved.selection).toBeNull(); expect(resolved.limitation).toBeTruthy();
    for (const key of NATIVE_CATALOG_PIN_KEYS) expect(resolved.environment[key]).toBe("");
  });
  it.each(["head_commit_then_error", "head_unknown"] as const)("uses exact head readback for %s CAS acknowledgements", async problem => {
    const plan = nativeFixture(now.toISOString()), validation = await validateNativeBaselinePublication(plan, now), db = database(plan.rows, problem);
    const observation = prepareNativeCatalogObservation({ plan, pins: validation.proposedPins, observationId: ids[1], issuedAt: now.toISOString() });
    expect(await advanceNativeCatalogHead({ db: db.db, headId: ids[0], expectedRevision: 0, expectedHash: null, observation, now, dryRun: false }))
      .toMatchObject({ status: problem === "head_unknown" ? "unknown" : "selected", selectedCatalogUpdated: problem !== "head_unknown" });
    expect(db.rpc).toHaveBeenCalledTimes(1);
  });
  it("keeps head selection default-off without a lookup or an implicit latest-row query", async () => {
    const db = database(), environment = { PLAYER_FORECAST_BASELINE_RELEASE_IDS: "unchanged" };
    expect(await resolveNativeCatalogEnvironment(db.db, 20262027, now, environment)).toMatchObject({ environment, selection: null, limitation: null });
    expect(db.from).not.toHaveBeenCalled();
  });
  it.each(["early", "partial", "manifest", "count", "clock", "succeeded", "running", "unknown", "exhausted"])("holds %s native cadence without DB work", async reason => {
    const request = cadenceRequest(), databaseState = database();
    if (reason === "early") request.cadence.now = new Date("2026-10-15T11:59:59Z");
    if (reason === "partial") request.cadence.sources[0].status = "partial";
    if (reason === "manifest") request.cadence.sources[0].revision = "other-inputs";
    if (reason === "count") request.cadence.sources[0].expectedItems++;
    if (reason === "clock") request.cadence.sources[0].completedAt = "2026-10-15T09:59:59Z";
    if (["succeeded", "running", "unknown", "exhausted"].includes(reason)) request.cadence.previous = [{ key: request.slotKey,
      status: reason === "exhausted" ? "failed" : reason as "succeeded" | "running" | "unknown", attempts: reason === "exhausted" ? 3 : 1 }];
    expect((await publishNativeBaselineCadence(request, { dryRun: false, db: databaseState.db, approvedPackageHash: hash(request.publicationPlan) })).status).toBe("held");
    expect(databaseState.from).not.toHaveBeenCalled();
  });
  it("prepares the distinct T-15 native stage and recovers only a failed slot below its attempt cap", async () => {
    const plan = fixture("2026-10-15T22:45:00Z", "2026-10-15T23:00:00Z");
    const request = cadenceRequest(plan);
    request.cadence.now = new Date("2026-10-15T22:45:00Z"); request.slotKey = "news:30:2026-10-15T23:00:00.000Z";
    request.cadence.previous = [{ key: request.slotKey, status: "failed", attempts: 2 }];
    expect(await publishNativeBaselineCadence(request)).toMatchObject({ status: "dry_run", slot: { kind: "news_revision", action: "recover_failed" },
      cadenceComplete: false });
    request.cadence.games[0].gameId = 31; request.slotKey = "news:31:2026-10-15T23:00:00.000Z";
    expect(await publishNativeBaselineCadence(request)).toMatchObject({ status: "held", reasons: ["native_target_scope_mismatch"] });
  });
  it.each(["game", "start", "season", "unscoped_catalog", "old_issuance", "completion_after_issuance"])("rejects a %s publication that does not bind the cadence slot", async reason => {
    const request = cadenceRequest(), databaseState = database();
    if (reason === "game") request.cadence.games[0].gameId = 31;
    if (reason === "start") request.cadence.games[0].startsAt = "2026-10-15T23:30:00Z";
    if (reason === "season") request.publicationPlan.seasonId = 20252026;
    if (reason === "unscoped_catalog") {
      request.publicationPlan = nativeFixture(now.toISOString());
      Object.assign(request.cadence.sources[0], nativeCadenceInputManifest(request.publicationPlan));
    }
    if (reason === "old_issuance") request.publicationPlan = fixture();
    if (reason === "completion_after_issuance") {
      request.cadence.now = new Date("2026-10-15T12:05:00Z");
      request.cadence.sources[0].completedAt = "2026-10-15T12:00:01Z";
    }
    const result = await publishNativeBaselineCadence(request, { dryRun: false, db: databaseState.db,
      approvedPackageHash: hash(request.publicationPlan) });
    expect(result).toMatchObject({ status: "held", reasons: ["native_target_scope_mismatch"] });
    expect(databaseState.from).not.toHaveBeenCalled();
  });
  it("rejects ambiguous manifest input keys while keeping distinct goalie producer policies separate", () => {
    const plan = nativeFixture(), duplicated = structuredClone(plan.rows[0]);
    duplicated.id = ids[1]; duplicated.payload_hash = "f".repeat(64); plan.rows.push(duplicated);
    expect(() => nativeCadenceInputManifest(plan)).toThrow("Ambiguous native cadence input identity");
    (plan.rows[0].payload as any).policyVersion = "native-goalie-appearance-volume-rates-v1";
    (duplicated.payload as any).policyVersion = "native-goalie-appearance-win-rates-v1";
    expect(nativeCadenceInputManifest(plan).expectedItems).toBe(2);
  });
  it("rejects oversized cadence metadata before DB work", async () => {
    const request = cadenceRequest(), databaseState = database();
    request.cadence.sources = Array.from({ length: 33 }, () => request.cadence.sources[0]);
    await expect(publishNativeBaselineCadence(request, { db: databaseState.db })).rejects.toThrow("metadata bound");
    expect(databaseState.from).not.toHaveBeenCalled();
  });
  it("replays native inputs plus exact planned policy/review/checksum dependencies and rejects changed review chronology", async () => {
    const plan = nativeFixture();
    expect((await validateNativeBaselinePublication(plan, now)).proposedPins.PLAYER_FORECAST_BASELINE_RELEASE_IDS).toBe(plan.rows[3].id);
    const db = database();
    expect((await publishNativeBaselinePlan(plan, { now, dryRun: false, approvedPackageHash: hash(plan), db: db.db })).status).toBe("persisted_not_activated");
    expect(db.writes).toEqual(plan.rows.map(row => row.id));
    const review = plan.rows[2].payload as any;
    review.reviewedAt = plan.rows[0].available_at; plan.rows[2].available_at = review.reviewedAt; plan.rows[2].observed_at = review.reviewedAt;
    plan.rows[2].payload_hash = hash(review);
    await expect(validateNativeBaselinePublication(plan, now)).rejects.toThrow("admission failed");
  });
  it("defaults to local replay without DB calls and emits proposed pins only", async () => {
    const plan = fixture(), db = database();
    const result = await publishNativeBaselinePlan(plan, { now, db: db.db });
    expect(result.status).toBe("dry_run"); expect(db.from).not.toHaveBeenCalled();
    expect(result.proposedPins.PLAYER_FORECAST_PARTICIPATION_RELEASES).toBe(`${ids[0]}:${plan.rows[0].payload_hash}`);
  });
  it("refuses multiple complete bundles for one policy instead of pretending the store combines them", async () => {
    const plan = nativeFixture();
    plan.rows.push({ ...structuredClone(plan.rows[3]), id: ids[0] });
    await expect(validateNativeBaselinePublication(plan, now)).rejects.toThrow("Native publication admission failed");
  });
  it.each(["hash", "receipt", "chronology", "approval", "duplicate", "unreferenced_input"])("rejects %s before any DB call", async kind => {
    const plan = fixture(), db = database(), row = plan.rows[0], payload = row.payload as any;
    if (kind === "hash") row.payload_hash = "f".repeat(64);
    if (kind === "receipt") payload.entries[0].receipt.probability = 0.25;
    if (kind === "chronology") row.available_at = "2026-10-15T13:00:00Z";
    if (kind === "approval") payload.ownerApprovalRef = "";
    if (kind === "duplicate") plan.rows.push(row);
    if (kind === "unreferenced_input") plan.rows.push({ ...row, id: ids[1], dataset_key: "baseline-inputs-v1", entity_kind: "player", entity_key: "20262027:7" });
    if (["receipt", "approval"].includes(kind)) row.payload_hash = hash(payload);
    await expect(publishNativeBaselinePlan(plan, { now, dryRun: false, approvedPackageHash: hash(plan), db: db.db })).rejects.toThrow();
    expect(db.from).not.toHaveBeenCalled();
  });
  it("persists, verifies exact readback and resumes identical package without duplicate writes", async () => {
    const plan = fixture(), db = database();
    const execute = () => publishNativeBaselinePlan(plan, { now, dryRun: false, approvedPackageHash: hash(plan), db: db.db });
    expect((await execute()).status).toBe("persisted_not_activated"); expect(db.writes).toEqual([ids[0]]);
    expect((await execute()).attemptedWrites).toBe(0); expect(db.writes).toEqual([ids[0]]);
  });
  it("stops uncertain writes, reconciles committed rows and labels unavailable state unknown", async () => {
    for (const mode of ["commit_then_error", "unknown"] as const) {
      const plan = fixture(), db = database([], mode);
      const result = await publishNativeBaselinePlan(plan, { now, dryRun: false, approvedPackageHash: hash(plan), db: db.db });
      expect(result.status).toBe("stopped"); expect(db.writes).toEqual([ids[0]]);
      expect(mode === "unknown" ? result.unknownIds : result.presentIds).toEqual([ids[0]]);
      expect(result.missingIds).toEqual([]);
    }
  });
  it("stops a two-row batch at its second failure without repeating the first write", async () => {
    const plan = fixture(), second = structuredClone(plan.rows[0]), payload = second.payload as any;
    second.id = ids[1]; payload.entries[0].input.scope.playerId = 8; payload.entries[0].input.scope.nhlPlayerId = 88;
    payload.entries[0].receipt = buildSkaterParticipationReceipt(payload.entries[0].input,
      { issuedAt: payload.issuedAt, expiresAt: payload.expiresAt });
    second.payload_hash = hash(payload); plan.rows.push(second);
    const db = database([], "fail_second");
    const result = await publishNativeBaselinePlan(plan, { now, dryRun: false, approvedPackageHash: hash(plan), db: db.db });
    expect(result.status).toBe("stopped"); expect(db.writes).toEqual(ids);
    expect(result.presentIds).toEqual([ids[0]]); expect(result.missingIds).toEqual([ids[1]]);
  });
  it("rejects conflicting existing IDs, changed approval hashes and exhausted budget without writes", async () => {
    const plan = fixture(), db = database([{ ...plan.rows[0], entity_key: "other" }]);
    expect((await publishNativeBaselinePlan(plan, { now, dryRun: false, approvedPackageHash: hash(plan), db: db.db })).status).toBe("stopped");
    expect(db.writes).toEqual([]);
    await expect(publishNativeBaselinePlan(plan, { now, dryRun: false, approvedPackageHash: "wrong", db: db.db })).rejects.toThrow("Exact publication");
    let ticks = 0; const empty = database();
    const expired = await publishNativeBaselinePlan(plan, { now, dryRun: false, approvedPackageHash: hash(plan), db: empty.db, monotonic: () => ticks++ ? 180000 : 0 });
    expect(expired.status).toBe("stopped"); expect(empty.writes).toEqual([]);
  });
  it("planned generic helper collision requires exact ID/scope/clock/payload readback", async () => {
    const row = fixture().rows[0];
    const capture = (db: any) => capturePlayerForecastSourceObservation({ supabase: db, observationId: row.id, provider: row.provider, datasetKey: row.dataset_key,
      entityKind: row.entity_kind, entityKey: row.entity_key, observedAt: row.observed_at, availableAt: row.available_at, payload: row.payload });
    expect(await capture(database([row], "duplicate").db)).toMatchObject({ inserted: false, payloadHash: row.payload_hash });
    for (const changed of [{ ...row, id: ids[1] }, { ...row, entity_key: "foreign" }, { ...row, available_at: "2026-10-15T10:00:00Z" }]) {
      await expect(capture(database([changed], "duplicate").db)).rejects.toThrow("cannot be verified");
    }
  });
});
