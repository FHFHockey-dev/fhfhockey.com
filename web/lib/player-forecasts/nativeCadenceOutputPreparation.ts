import { randomUUID } from "node:crypto";
import { buildBaselineContributionBundle, buildNativeSkaterBaselineSnapshot } from "./baselineGeneration";
import { buildGoalieContributionBundle, buildNativeGoalieShutoutRates, buildNativeGoalieSummaryWinRates,
  buildNativeGoalieVolumeRates, buildNativeGoalieWinRates } from "./goalieBaselineRates";
import { PRIOR_APPEARANCE_POLICY_VERSION } from "./baselineRates";
import { verifyBaselineHistoricalSources } from "./baselineSourceLineage";
import { buildRosterObservationSkaterParticipationReceipt } from "./modeledSkaterParticipation";
import { buildRosterObservationGoalieParticipationReceipt, buildRosterObservationGoalieStartReceipt } from "./modeledGoalieParticipation";
import { contributionBundleCandidateInputHash, contributionBundleChecksum, persistContributionBundle } from "./contributionStore";
import { SKATER_PARTICIPATION_RELEASE_LIMITS } from "./modeledSkaterParticipationStore";
import { nativeCadenceClosureScope, nativeCadenceInputManifest, publishObservedNativeBaselineCadence } from "./nativeBaselineCadence";
import type { NativeBaselinePublicationPlan } from "./nativeBaselinePublication";
import { playerForecastSourcePayloadHash as hash, type PlannedSourceObservation } from "./sourceSnapshot";
import { timestampMicros } from "../projections/evidenceTime";

/** Offline issuance of later same-method outputs from one closed materialization.
 * It reproduces the reviewed plan's means, identities, expiries and nulls exactly;
 * only issuance changes. Reviews come back pending, and the catalog head stays null.
 * With `daily`, the frozen native means are issued anew under one explicit new expiry
 * (cutoffs and means unchanged, so the approved candidate hashes still hold) and
 * participation bundles are built from the proof's fresh participation inputs. */
export type NativeOutputPreparationCommand = {
  version: "native-output-preparation-v1";
  slotKey: string; dueAt: string;
  materialization: { runId: string; sourceKey: string; date: string; closureScopeHash: string };
  games: Array<{ gameId: number; startsAt: string }>;
  requiredAcquisitionScopes: Record<string, { scopeHash: string; cutoffAt: string }>;
  /** Previously reviewed plan over the same inputs: policies, reviews, bundles and selected participation bundles. */
  reviewedPlan: NativeBaselinePublicationPlan;
  daily?: { expiresAt: string; participationOwnerApprovalRef: string };
};
type ClosedProof = { status: string; rows: PlannedSourceObservation[]; report: PlannedSourceObservation;
  closure: PlannedSourceObservation; manifest: ReturnType<typeof nativeCadenceInputManifest> };
const fail = (reason: string): never => { throw new Error(reason); };
const micros = (value: string) => timestampMicros(value) ?? fail("invalid_clock");
const goalieBuilders: Record<string, (input: any) => any> = {
  "native-goalie-appearance-win-rates-v1": buildNativeGoalieWinRates,
  "native-goalie-appearance-volume-rates-v1": buildNativeGoalieVolumeRates,
  "native-goalie-appearance-shutout-rates-v1": buildNativeGoalieShutoutRates,
  "native-goalie-appearance-summary-win-rates-v1": buildNativeGoalieSummaryWinRates };
const participationBuilders: Record<string, (input: any, clocks: { issuedAt: string; expiresAt: string }) => any> = {
  "skater-roster-observation-participation-bundle-v1": buildRosterObservationSkaterParticipationReceipt,
  "goalie-roster-observation-participation-bundle-v1": buildRosterObservationGoalieParticipationReceipt,
  "goalie-roster-observation-start-bundle-v1": buildRosterObservationGoalieStartReceipt };
// Leaves headroom under the 8 MiB publication row bound for the envelope and metadata;
// bundles also stay within the participation stores' per-bundle entry cap.
const DAILY_PARTICIPATION_BUNDLE_BYTES = 7 * 1024 * 1024;
const withoutIssuance = ({ issuedAt: _issued, released: _released, ...rest }: any) => rest;
const withoutIssuedAt = ({ issuedAt: _issued, ...rest }: any) => rest;

export async function prepareNativeCadenceOutputs(command: NativeOutputPreparationCommand, proof: ClosedProof,
  now: Date, newId: () => string = randomUUID) {
  const { materialization: request, reviewedPlan } = command;
  if (command?.version !== "native-output-preparation-v1" || reviewedPlan?.version !== "native-baseline-publication-plan-v1") fail("preparation_command_required");
  const closure = proof?.closure?.payload as any, issuedAt = now.toISOString(), seasonId = reviewedPlan.seasonId;
  if (proof?.status !== "closed" || !closure || closure.runId !== request.runId || closure.scopeHash !== request.closureScopeHash
    || closure.materializationHash !== proof.report.payload_hash || hash(proof.report.payload) !== proof.report.payload_hash
    || hash(closure) !== proof.closure.payload_hash) fail("closed_materialization_proof_required");
  // The top-level manifest is a convenience copy; bind it to the hashed report and closure.
  if (!proof.manifest || hash(proof.manifest) !== hash((proof.report.payload as any).manifest) || closure.inputRevision !== proof.manifest.revision
    || closure.expectedItems !== proof.manifest.expectedItems) fail("materialization_manifest_unbound");
  const required = command.requiredAcquisitionScopes?.[request.sourceKey];
  if (!required || required.scopeHash !== closure.acquisitionScopeHash || required.cutoffAt !== closure.inputCutoffAt) fail("acquisition_scope_mismatch");
  if (micros(issuedAt) < micros(command.dueAt)) fail("slot_not_due");
  if (micros(issuedAt) < micros(closure.closedAt)) fail("outputs_must_be_issued_after_closed_inputs");
  const reported = new Map(((proof.report.payload as any).rows ?? []).map((row: any) => [row.id, row]));
  if (new Set(proof.rows.map(row => row.id)).size !== proof.rows.length || reported.size !== proof.rows.length
    || proof.rows.some(row => hash(row.payload) !== row.payload_hash || (reported.get(row.id) as any)?.hash !== row.payload_hash
    || (reported.get(row.id) as any)?.dataset !== row.dataset_key)) fail("materialized_row_mismatch");
  const daily = command.daily;
  if (daily && (micros(daily.expiresAt) <= micros(issuedAt) || micros(daily.expiresAt) > micros(issuedAt) + BigInt(12 * 3600 * 1000000)
    || !daily.participationOwnerApprovalRef?.trim()
    || reviewedPlan.rows.some(row => row.entity_kind === "participation_bundle"))) fail("invalid_daily_issuance");
  // Daily runs replace participation, so only the native inputs must match the reviewed plan (checked per source below).
  if (!daily && hash(nativeCadenceInputManifest(reviewedPlan)) !== hash(proof.manifest)) fail("reviewed_plan_input_manifest_mismatch");
  const byId = new Map(reviewedPlan.rows.map(row => [row.id, row]));
  const oldBundles = reviewedPlan.rows.filter(row => row.entity_kind === "seasonal_rate_bundle");
  const oldSources = oldBundles.flatMap(row => (row.payload as any).sources);
  const inputs = proof.rows.filter(row => row.entity_kind === "player"), fresh = new Map<string, any>();
  for (const row of inputs) {
    const payload = row.payload as any, prior = oldSources.filter((source: any) => source.sourceWatermark === row.payload_hash);
    if (!prior.length) fail("reviewed_sources_missing_for_input");
    const { scheduleRevision } = prior[0], expiresAt = daily?.expiresAt ?? prior[0].expiresAt;
    if (prior.some((source: any) => (!daily && source.expiresAt !== expiresAt) || source.scheduleRevision !== scheduleRevision)) fail("reviewed_source_clock_conflict");
    // Reissuing never renews an original expiry. A daily run is a new issuance with its own stated
    // expiry (at most twelve hours), new row identities, and unchanged cutoffs and means.
    if (micros(expiresAt) <= micros(issuedAt)) fail("original_source_expired");
    const calculation = { ...payload, seasonId, cutoffAt: payload.capturedAt, sourceWatermark: row.payload_hash };
    let snapshot: any;
    if (row.dataset_key === "baseline-inputs-v1") {
      if (payload.policyVersion === PRIOR_APPEARANCE_POLICY_VERSION) verifyBaselineHistoricalSources(payload.historicalSources, payload.appearances,
        payload.nhlPlayerId, seasonId, payload.capturedAt, payload.limitations ?? []);
      snapshot = buildNativeSkaterBaselineSnapshot(calculation);
    } else snapshot = (goalieBuilders[payload.policyVersion] ?? fail("unsupported_native_policy"))(calculation);
    if (snapshot.definitionHash !== payload.definitionHash) fail("definition_hash_changed");
    const parameters = { seasonId, cutoffAt: payload.capturedAt, issuedAt, expiresAt, scheduleRevision,
      snapshots: [{ snapshot, teamId: payload.teamId, rosterRevision: payload.rosterRevision }] };
    const generated = row.dataset_key === "baseline-inputs-v1" ? buildBaselineContributionBundle(parameters) : buildGoalieContributionBundle(parameters);
    if (generated.sources.length !== prior.length) fail("reproduced_source_count_changed");
    for (const source of generated.sources) {
      const old = prior.find((value: any) => value.sourceId === source.sourceId);
      const comparable = (value: any) => daily ? withoutIssuance({ ...value, expiresAt: null }) : withoutIssuance(value);
      if (!old || hash(comparable(source)) !== hash(comparable(old))) fail("reproduced_source_changed");
      if (fresh.has(source.sourceId)) fail("duplicate_source_identity");
      fresh.set(source.sourceId, { ...source, released: true });
    }
  }
  if (fresh.size !== oldSources.length) fail("reviewed_source_without_input");
  const envelope = (dataset: string, kind: string, payload: any, observedAt: string, revision: string | null, metadata: Record<string, unknown>,
    id = newId()): PlannedSourceObservation => ({ id, provider: "fhfh", dataset_key: dataset, entity_kind: kind, entity_key: String(seasonId),
    source_url: null, source_revision_key: revision, observed_at: observedAt, available_at: issuedAt, payload_hash: hash(payload), payload, metadata });
  const rows: PlannedSourceObservation[] = [...inputs], reviews: Array<Record<string, string>> = [], policies = new Set<string>();
  for (const original of oldBundles) {
    const old = original.payload as any, policy = byId.get(old.manifest.evaluationPolicyId), previousReview = byId.get(old.manifest.reviewId);
    if (!policy || !previousReview) fail("reviewed_policy_or_review_missing");
    if (!daily && micros(old.manifest.expiresAt) <= micros(issuedAt)) fail("original_bundle_expired");
    const reviewId = newId(), sources = old.sources.map((source: any) => fresh.get(source.sourceId));
    const { checksum: _checksum, ...unsigned } = { ...old.manifest, issuedAt, reviewId, ...(daily ? { expiresAt: daily.expiresAt } : {}) };
    const bundle = { manifest: { ...unsigned, checksum: contributionBundleChecksum({ manifest: unsigned as any, sources }) }, sources };
    const candidateInputHash = contributionBundleCandidateInputHash(bundle as any);
    if (candidateInputHash !== contributionBundleCandidateInputHash(old) || candidateInputHash !== (policy!.payload as any).candidateInputHash) fail("candidate_input_changed");
    const review = { ...(previousReview!.payload as any), bundleChecksum: bundle.manifest.checksum, status: "pending_independent_review",
      eligible: false, ownerApprovalRef: "", reviewedAt: null };
    const bundleRow = envelope("contribution-bundle-v1", "seasonal_rate_bundle", bundle, bundle.manifest.inputCutoff, bundle.manifest.checksum,
      { policyVersion: bundle.manifest.policyVersion, released: true });
    if (!policies.has(policy!.id)) { policies.add(policy!.id); rows.push(policy!); }
    // Daily issuance states what it re-issues; consumers and reviewers see the original clocks and cutoff.
    const disclosure = daily ? { dailyReissueOf: original.id, originalIssuedAt: old.manifest.issuedAt, originalExpiresAt: old.manifest.expiresAt,
      nativeInputCutoff: old.manifest.inputCutoff,
      disclosure: "Frozen means re-issued unchanged under a new stated expiry; their history excludes every game after the native input cutoff." } : {};
    rows.push(envelope("baseline-validation-review-v1", "baseline_validation_review", review, issuedAt, candidateInputHash,
      { pendingIndependentReview: true, ...disclosure }, reviewId), bundleRow);
    // Dry validation only; any database access fails.
    await persistContributionBundle({ from() { throw new Error("No database permitted"); } } as any, { ...bundle, dryRun: true, snapshotId: bundleRow.id } as any);
    reviews.push({ policyVersion: bundle.manifest.policyVersion, reviewId, bundleId: bundleRow.id, originalBundleId: original.id, candidateInputHash });
  }
  let participationEntries = 0, nullParticipation = 0;
  if (daily) {
    const groups = new Map<string, any[]>();
    for (const row of proof.rows.filter(value => value.dataset_key === "native-participation-input-v1")) {
      const payload = row.payload as any; groups.set(payload.dataset, [...(groups.get(payload.dataset) ?? []), ...payload.inputs]);
    }
    for (const [dataset, inputs] of [...groups].sort(([a], [b]) => a.localeCompare(b))) {
      const build = participationBuilders[dataset] ?? fail("unsupported_participation_method");
      const entries = inputs.map((input: any) => {
        const receipt = build(input, { issuedAt, expiresAt: daily.expiresAt });
        participationEntries++; if (receipt.probability === null) nullParticipation++;
        return { input, receipt };
      });
      // Partition entries into bundles under the per-row byte bound; no player/game appears twice.
      const groupsOfEntries: any[][] = [[]]; let bytes = 0;
      for (const entry of entries) {
        const size = Buffer.byteLength(JSON.stringify(entry)) + 1;
        if ((bytes + size > DAILY_PARTICIPATION_BUNDLE_BYTES || groupsOfEntries.at(-1)!.length >= SKATER_PARTICIPATION_RELEASE_LIMITS.bundleEntries)
          && groupsOfEntries.at(-1)!.length) { groupsOfEntries.push([]); bytes = 0; }
        groupsOfEntries.at(-1)!.push(entry); bytes += size;
      }
      for (const group of groupsOfEntries) {
        const payload = { version: dataset, seasonId, issuedAt, expiresAt: daily.expiresAt, released: true,
          allowedUses: { assignment: true, totals: true, comparison: true, conditionalTieBreak: true },
          ownerApprovalRef: daily.participationOwnerApprovalRef, reviewRef: "", entries: group };
        rows.push({ ...envelope(dataset, "participation_bundle", payload, issuedAt, null, { pendingIndependentReview: true }),
          source_revision_key: hash(payload) });
      }
    }
  }
  for (const original of daily ? [] : reviewedPlan.rows.filter(row => row.entity_kind === "participation_bundle")) {
    const old = original.payload as any, build = participationBuilders[old.version] ?? fail("unsupported_participation_method");
    if (micros(old.expiresAt) <= micros(issuedAt)) fail("original_participation_expired");
    const entries = old.entries.map((entry: any) => {
      const receipt = build(entry.input, { issuedAt, expiresAt: old.expiresAt });
      if (hash(withoutIssuedAt(receipt)) !== hash(withoutIssuedAt(entry.receipt))) fail("participation_estimate_changed");
      participationEntries++; if (receipt.probability === null) nullParticipation++;
      return { input: entry.input, receipt };
    });
    rows.push(envelope(original.dataset_key, "participation_bundle", { ...old, issuedAt, reviewRef: "", entries }, original.observed_at, null,
      { ...original.metadata, pendingIndependentReview: true }));
  }
  const plan: NativeBaselinePublicationPlan = { version: "native-baseline-publication-plan-v1", seasonId, rows };
  if (hash(nativeCadenceInputManifest(plan)) !== hash(proof.manifest)) fail("prepared_plan_input_manifest_mismatch");
  const cadenceInput: Parameters<typeof publishObservedNativeBaselineCadence>[0] = { slotKey: command.slotKey, inputSourceKey: request.sourceKey,
    publicationPlan: plan, requiredAcquisitionScopes: command.requiredAcquisitionScopes,
    cadence: { now, date: request.date, requiredSources: [request.sourceKey], games: command.games, previous: [],
      sources: [{ key: request.sourceKey, date: request.date, status: "complete", revision: proof.manifest.revision,
        completedAt: closure.closedAt, expectedItems: proof.manifest.expectedItems, completedItems: proof.manifest.expectedItems }] } };
  if (nativeCadenceClosureScope(cadenceInput) !== request.closureScopeHash) fail("cadence_closure_scope_mismatch");
  return { plan, cadenceCommand: { version: "native-cadence-command-v1" as const, cadenceInput,
    producerReceiptIds: { [request.sourceKey]: proof.closure.id }, catalogHead: null },
  receipt: { status: "outputs_built_pending_independent_review_and_catalog_head", issuedAt, dueAt: command.dueAt, closedAt: closure.closedAt,
    nativeInputs: inputs.length, nativeSources: fresh.size, participationEntries, nullParticipation, rows: rows.length, reviews,
    ...(daily ? { dailyExpiresAt: daily.expiresAt, nativeMeansFrozenAtCutoff: [...new Set(inputs.map(row => (row.payload as any).capturedAt))].sort() } : {}),
    planHash: hash(plan), networkRequests: 0, databaseWrites: 0, publicationExecuted: false, headSelection: false } };
}
